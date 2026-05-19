"""
Community — соцслой: подписки на аспекты, лента подписок.

Эндпоинты
─────────
  POST   /api/community/aspect-sub                       — подписаться на аспект
  DELETE /api/community/aspect-sub/{aspect}              — отписаться
  GET    /api/community/aspects-subscribed               — список подписок

  GET    /api/community/feed?offset=&limit=              — лента: инсайты подписок
                                                           (user-follows + aspect-subs)
                                                           + best-answer Q&A из подписанных аспектов.

Aspect-ключи на бэке — кириллица. Маппинг лат→кир делает фронт перед отправкой
(см. api/client.ts).

«Подписка на аспект» отделена от `public_profiles.focus_aspects` — последнее
display-поле «прорабатываю», эта таблица — реальный источник активности
для /api/community/feed.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AspectInsight,
    AspectMessage,
    AspectSubscription,
    PublicProfile,
    Subscription,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user
from app.web.streak import bump_streak

router = APIRouter()


# ── Constants ─────────────────────────────────────────────────────────────────

# Полный список валидных кир. aspect-ключей. Фронт всегда шлёт уже-кир после
# latToCyr — но защищаемся от мусора в теле запроса.
VALID_ASPECTS = {"БС", "ЧС", "БЛ", "ЧЛ", "БЭ", "ЧЭ", "БИ", "ЧИ"}


def _display_name(user: WebUser) -> str:
    if user.display_name:
        return user.display_name
    if user.telegram_first_name:
        return user.telegram_first_name
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.id}"


# ── Aspect subscriptions ──────────────────────────────────────────────────────


class AspectSubBody(BaseModel):
    aspect: str


@router.post("/community/aspect-sub")
async def subscribe_to_aspect(
    body: AspectSubBody,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.aspect not in VALID_ASPECTS:
        raise HTTPException(status_code=400, detail=f"Invalid aspect: {body.aspect}")
    stmt = pg_insert(AspectSubscription).values(
        web_user_id=current_user.id,
        aspect=body.aspect,
    ).on_conflict_do_nothing(
        index_elements=["web_user_id", "aspect"],
    )
    await session.execute(stmt)
    await session.commit()
    await bump_streak(session, current_user.id)
    return {"subscribed": True, "aspect": body.aspect}


@router.delete("/community/aspect-sub/{aspect}")
async def unsubscribe_from_aspect(
    aspect: str,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await session.execute(
        delete(AspectSubscription).where(
            AspectSubscription.web_user_id == current_user.id,
            AspectSubscription.aspect == aspect,
        )
    )
    await session.commit()
    return {"subscribed": False, "aspect": aspect}


@router.get("/community/aspects-subscribed")
async def list_subscribed_aspects(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    rows = (
        await session.execute(
            select(AspectSubscription.aspect)
            .where(AspectSubscription.web_user_id == current_user.id)
        )
    ).scalars().all()
    return list(rows)


# ── Feed ─────────────────────────────────────────────────────────────────────


@router.get("/community/feed")
async def community_feed(
    offset: int = 0,
    limit: int = 30,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """
    Лента активности:
      • aspect_insights от юзеров, на которых я подписан (subscriptions)
      • aspect_insights в аспектах, на которые я подписан (aspect_subscriptions)
      • aspect_messages с kind='answer' AND is_best=true в подписанных аспектах
    DESC by created_at, общий offset/limit.

    Реализация: три отдельных запроса → merge в Python → sort → slice.
    На текущем объёме (<10K insights, <1K best-answers) это нормально и проще,
    чем CTE-union с разными колонками. Можно оптимизировать когда объём
    реально начнёт раздражать.
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    # Окно для тяжёлой страницы: тянем с запасом, чтобы после merge
    # хватило на offset+limit. Cap 500 — соц-лента не растёт быстрее.
    window = min(offset + limit + 50, 500)

    user_id = current_user.id

    follow_target_rows = (
        await session.execute(
            select(Subscription.target_id).where(Subscription.follower_id == user_id)
        )
    ).scalars().all()
    follow_targets: list[int] = list(follow_target_rows)

    aspect_rows = (
        await session.execute(
            select(AspectSubscription.aspect).where(AspectSubscription.web_user_id == user_id)
        )
    ).scalars().all()
    subscribed_aspects: list[str] = list(aspect_rows)

    if not follow_targets and not subscribed_aspects:
        return []

    # ── Insights ─────────────────────────────────────────────────────────────
    # Условие: автор ∈ follow_targets ∨ aspect ∈ subscribed_aspects.
    # Только публичные (is_public).
    insight_conditions = []
    if follow_targets:
        insight_conditions.append(AspectInsight.web_user_id.in_(follow_targets))
    if subscribed_aspects:
        insight_conditions.append(AspectInsight.aspect.in_(subscribed_aspects))

    insight_rows = (
        await session.execute(
            select(AspectInsight, WebUser, PublicProfile)
            .join(WebUser, WebUser.id == AspectInsight.web_user_id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(
                AspectInsight.is_public.is_(True),
                AspectInsight.web_user_id != user_id,  # себя в ленте не показываем
                or_(*insight_conditions),
            )
            .order_by(AspectInsight.created_at.desc())
            .limit(window)
        )
    ).all()

    follow_set = set(follow_targets)
    insights_out: list[dict] = []
    for ins, u, pp in insight_rows:
        user_public = True if pp is None else bool(pp.is_public)
        if not user_public:
            continue
        source = "follow-user" if u.id in follow_set else "follow-aspect"
        insights_out.append({
            "kind": "insight",
            "id": ins.id,
            "aspect": ins.aspect,
            "text": ins.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": pp.avatar if pp else None,
            "created_at": ins.created_at.isoformat(),
            "source": source,
            "_ts": ins.created_at,
        })

    # ── Q&A best-answer ──────────────────────────────────────────────────────
    qa_out: list[dict] = []
    if subscribed_aspects:
        qa_rows = (
            await session.execute(
                select(AspectMessage, WebUser, PublicProfile)
                .join(WebUser, WebUser.id == AspectMessage.web_user_id)
                .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
                .where(
                    AspectMessage.kind == "answer",
                    AspectMessage.is_best.is_(True),
                    AspectMessage.aspect.in_(subscribed_aspects),
                    AspectMessage.web_user_id != user_id,
                )
                .order_by(AspectMessage.created_at.desc())
                .limit(window)
            )
        ).all()
        for msg, u, pp in qa_rows:
            user_public = True if pp is None else bool(pp.is_public)
            if not user_public:
                continue
            qa_out.append({
                "kind": "qa",
                "id": msg.id,
                "aspect": msg.aspect,
                "text": msg.text,
                "user_id": u.id,
                "display_name": _display_name(u),
                "avatar": pp.avatar if pp else None,
                "created_at": msg.created_at.isoformat(),
                "source": "follow-aspect",
                "_ts": msg.created_at,
            })

    merged = insights_out + qa_out
    merged.sort(key=lambda r: r["_ts"], reverse=True)
    page = merged[offset:offset + limit]
    # _ts — служебное поле, для UI оставляем только iso created_at.
    for r in page:
        r.pop("_ts", None)
    return page


# ── Trending (Phase 5) ───────────────────────────────────────────────────────
# Trending живёт здесь, а не в hall.py, потому что зависит от
# aspect_subscriptions для будущих фильтров. Сейчас просто читает hall-данные
# за окно 7 дней. Используется HallView.Overview через отдельный fetch.

from datetime import timedelta


@router.get("/community/trending/{aspect}")
async def trending_in_hall(
    aspect: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Топ за 7 дней в холле аспекта:
      • insights — top-3 по сумме реакций (insight_likes count)
      • qa — top-3 best-answer Q&A (DESC by created_at, уже отфильтрованы is_best)

    Публичный (без auth) — холл и так открыт чтению.
    """
    if aspect not in VALID_ASPECTS:
        raise HTTPException(status_code=400, detail=f"Invalid aspect: {aspect}")
    cutoff = datetime.utcnow() - timedelta(days=7)

    # Top insights — по сумме лайков всех типов.
    from sqlalchemy import func
    from app.db.models import InsightLike

    insights_q = (
        select(
            AspectInsight,
            WebUser,
            PublicProfile,
            func.count(InsightLike.web_user_id).label("likes"),
        )
        .join(WebUser, WebUser.id == AspectInsight.web_user_id)
        .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
        .outerjoin(InsightLike, InsightLike.insight_id == AspectInsight.id)
        .where(
            AspectInsight.aspect == aspect,
            AspectInsight.is_public.is_(True),
            AspectInsight.created_at >= cutoff,
        )
        .group_by(AspectInsight.id, WebUser.id, PublicProfile.web_user_id)
        .order_by(func.count(InsightLike.web_user_id).desc(), AspectInsight.created_at.desc())
        .limit(3)
    )
    insight_rows = (await session.execute(insights_q)).all()
    trending_insights = []
    for ins, u, pp, likes in insight_rows:
        user_public = True if pp is None else bool(pp.is_public)
        if not user_public:
            continue
        trending_insights.append({
            "id": ins.id,
            "text": ins.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": pp.avatar if pp else None,
            "likes": int(likes or 0),
            "created_at": ins.created_at.isoformat(),
        })

    # Top best-answer Q&A.
    qa_rows = (
        await session.execute(
            select(AspectMessage, WebUser, PublicProfile)
            .join(WebUser, WebUser.id == AspectMessage.web_user_id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(
                AspectMessage.aspect == aspect,
                AspectMessage.kind == "answer",
                AspectMessage.is_best.is_(True),
                AspectMessage.created_at >= cutoff,
            )
            .order_by(AspectMessage.created_at.desc())
            .limit(3)
        )
    ).all()
    trending_qa = []
    for msg, u, pp in qa_rows:
        user_public = True if pp is None else bool(pp.is_public)
        if not user_public:
            continue
        trending_qa.append({
            "id": msg.id,
            "text": msg.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": pp.avatar if pp else None,
            "created_at": msg.created_at.isoformat(),
        })

    return {"insights": trending_insights, "qa": trending_qa}
