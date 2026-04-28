"""
Hall — тематическое пространство одного аспекта:

  GET    /api/hall/{aspect}/overview      — сводка для вкладки «Обзор»
  GET    /api/hall/{aspect}/messages      — чат (с polling, since_id для diff)
  POST   /api/hall/{aspect}/messages      — отправить сообщение в чат
  DELETE /api/hall/{aspect}/messages/{id} — удалить своё (или is_admin)
  GET    /api/hall/{aspect}/insights      — лента публичных инсайтов аспекта
  GET    /api/hall/{aspect}/leaderboard   — топ-10 юзеров по аспекту
  GET    /api/hall/{aspect}/inspirations  — карточки вдохновения (с тегом аспекта)

Все эндпоинты требуют JWT (доступ для залогиненных). Публикация инсайта/
сообщения создаёт записи в существующих таблицах (`aspect_insights`,
`aspect_messages`).
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AspectInsight,
    AspectMessage,
    InsightLike,
    PublicProfile,
    WebScore,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user
from app.web.notify import notify_hall_writers
from app.web.streak import bump_streak

router = APIRouter()

ASPECT_KEYS = {"БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"}


def _validate_aspect(aspect: str) -> str:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    return aspect


def _display_name(user: WebUser) -> str:
    if user.display_name:
        return user.display_name
    if user.telegram_first_name:
        return user.telegram_first_name
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.id}"


# ── Schemas ─────────────────────────────────────────────────────────────────

class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


# ── Сводка для вкладки «Обзор» ──────────────────────────────────────────────

@router.get("/hall/{aspect}/overview")
async def get_overview(
    aspect: str,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    aspect = _validate_aspect(aspect)

    # Моя оценка по аспекту.
    my_score_row = (
        await session.execute(
            select(WebScore.value)
            .where(
                WebScore.web_user_id == current_user.id,
                WebScore.aspect == aspect,
            )
        )
    ).scalar_one_or_none()
    my_score = float(my_score_row) if my_score_row is not None else None

    # Число публичных инсайтов в аспекте + мои в нём.
    insights_total = int((
        await session.execute(
            select(func.count())
            .select_from(AspectInsight)
            .where(
                AspectInsight.aspect == aspect,
                AspectInsight.is_public.is_(True),
            )
        )
    ).scalar_one())
    my_insights_in_aspect = int((
        await session.execute(
            select(func.count())
            .select_from(AspectInsight)
            .where(
                AspectInsight.aspect == aspect,
                AspectInsight.web_user_id == current_user.id,
            )
        )
    ).scalar_one())

    # Активные за 24 часа: писали в чат или публиковали инсайт по аспекту.
    since = datetime.utcnow() - timedelta(hours=24)
    active_writers = set((
        await session.execute(
            select(AspectMessage.web_user_id.distinct())
            .where(
                AspectMessage.aspect == aspect,
                AspectMessage.created_at >= since,
            )
        )
    ).scalars().all())
    active_authors = set((
        await session.execute(
            select(AspectInsight.web_user_id.distinct())
            .where(
                AspectInsight.aspect == aspect,
                AspectInsight.is_public.is_(True),
                AspectInsight.created_at >= since,
            )
        )
    ).scalars().all())
    active_24h = len(active_writers | active_authors)

    # Превью последних 3 сообщений и 3 инсайтов.
    msg_rows = (
        await session.execute(
            select(AspectMessage, WebUser, PublicProfile)
            .join(WebUser, WebUser.id == AspectMessage.web_user_id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(AspectMessage.aspect == aspect)
            .order_by(AspectMessage.id.desc())
            .limit(3)
        )
    ).all()
    last_messages = [
        {
            "id": m.id,
            "text": m.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "created_at": m.created_at.isoformat(),
        }
        for m, u, pp in msg_rows
    ]

    ins_rows = (
        await session.execute(
            select(AspectInsight, WebUser, PublicProfile)
            .join(WebUser, WebUser.id == AspectInsight.web_user_id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(
                AspectInsight.aspect == aspect,
                AspectInsight.is_public.is_(True),
            )
            .order_by(AspectInsight.created_at.desc())
            .limit(3)
        )
    ).all()
    last_insights = [
        {
            "id": ins.id,
            "kind": ins.kind,
            "text": ins.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "created_at": ins.created_at.isoformat(),
        }
        for ins, u, pp in ins_rows
    ]

    # Моя позиция в топе по числу публичных инсайтов (быстро).
    rank_row = (
        await session.execute(
            select(AspectInsight.web_user_id, func.count())
            .where(
                AspectInsight.aspect == aspect,
                AspectInsight.is_public.is_(True),
            )
            .group_by(AspectInsight.web_user_id)
            .order_by(func.count().desc())
        )
    ).all()
    my_rank = None
    for i, (uid, _cnt) in enumerate(rank_row, start=1):
        if uid == current_user.id:
            my_rank = i
            break

    return {
        "aspect": aspect,
        "my_score": my_score,
        "my_insights": my_insights_in_aspect,
        "my_rank": my_rank,
        "insights_total": insights_total,
        "active_24h": active_24h,
        "last_messages": last_messages,
        "last_insights": last_insights,
    }


# ── Чат ─────────────────────────────────────────────────────────────────────

@router.get("/hall/{aspect}/messages")
async def get_messages(
    aspect: str,
    since_id: int = 0,
    limit: int = 100,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    aspect = _validate_aspect(aspect)
    limit = max(1, min(limit, 200))

    q = (
        select(AspectMessage, WebUser, PublicProfile)
        .join(WebUser, WebUser.id == AspectMessage.web_user_id)
        .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
        .where(AspectMessage.aspect == aspect)
    )
    if since_id > 0:
        # При polling возвращаем только новые сообщения (id > since_id).
        q = q.where(AspectMessage.id > since_id).order_by(AspectMessage.id.asc()).limit(limit)
    else:
        # Initial load — последние limit, отсортированные по id desc, потом
        # фронт сам разворачивает или показывает в обратном порядке.
        q = q.order_by(AspectMessage.id.desc()).limit(limit)

    rows = (await session.execute(q)).all()
    if since_id == 0:
        rows = list(reversed(rows))

    items = [
        {
            "id": m.id,
            "text": m.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "is_mine": u.id == current_user.id,
            "created_at": m.created_at.isoformat(),
        }
        for m, u, pp in rows
    ]
    last_id = items[-1]["id"] if items else since_id
    return {"messages": items, "last_id": last_id}


@router.post("/hall/{aspect}/messages")
async def post_message(
    aspect: str,
    body: MessageIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    aspect = _validate_aspect(aspect)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is empty")

    msg = AspectMessage(
        aspect=aspect,
        web_user_id=current_user.id,
        text=text[:2000],
    )
    session.add(msg)
    await session.commit()
    await session.refresh(msg)

    # Уведомляем всех, кто писал в этот холл, кроме автора.
    await notify_hall_writers(
        session,
        aspect=aspect,
        new_message_id=msg.id,
        actor_id=current_user.id,
        actor_name=_display_name(current_user),
        text_preview=text,
    )
    await bump_streak(session, current_user.id)
    await session.commit()

    pp = await session.get(PublicProfile, current_user.id)
    return {
        "id": msg.id,
        "text": msg.text,
        "user_id": current_user.id,
        "display_name": _display_name(current_user),
        "avatar": (pp.avatar if pp else None),
        "is_mine": True,
        "created_at": msg.created_at.isoformat(),
    }


@router.delete("/hall/{aspect}/messages/{message_id}")
async def delete_message(
    aspect: str,
    message_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    aspect = _validate_aspect(aspect)
    msg = await session.get(AspectMessage, message_id)
    if not msg or msg.aspect != aspect:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.web_user_id != current_user.id and not bool(getattr(current_user, "is_admin", False)):
        raise HTTPException(status_code=403, detail="Not your message")
    await session.delete(msg)
    await session.commit()
    return {"ok": True}


# ── Лента инсайтов аспекта ──────────────────────────────────────────────────

@router.get("/hall/{aspect}/insights")
async def get_insights_feed(
    aspect: str,
    limit: int = 30,
    sort: str = "new",
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    aspect = _validate_aspect(aspect)
    limit = max(1, min(limit, 100))

    # Базовая выборка: только публичные инсайты этого аспекта от юзеров с
    # публичным профилем (либо без записи в profiles).
    q = (
        select(AspectInsight, WebUser, PublicProfile)
        .join(WebUser, WebUser.id == AspectInsight.web_user_id)
        .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
        .where(
            AspectInsight.aspect == aspect,
            AspectInsight.is_public.is_(True),
        )
        .where(
            (PublicProfile.is_public.is_(None)) | (PublicProfile.is_public.is_(True))
        )
    )
    if sort == "popular":
        # Сортировка по числу реакций (LEFT JOIN aggregated).
        q = q.order_by(AspectInsight.created_at.desc())
    else:
        q = q.order_by(AspectInsight.created_at.desc())
    q = q.limit(limit)

    rows = (await session.execute(q)).all()
    if not rows:
        return []

    ids = [r[0].id for r in rows]
    # Реакции к этим инсайтам.
    react_rows = (
        await session.execute(
            select(InsightLike.insight_id, InsightLike.reaction, func.count())
            .where(InsightLike.insight_id.in_(ids))
            .group_by(InsightLike.insight_id, InsightLike.reaction)
        )
    ).all()
    reactions_map: dict[int, dict[str, int]] = {}
    for iid, rtype, cnt in react_rows:
        reactions_map.setdefault(int(iid), {})[rtype or "heart"] = int(cnt)

    my_rows = (
        await session.execute(
            select(InsightLike.insight_id, InsightLike.reaction, InsightLike.comment)
            .where(
                InsightLike.insight_id.in_(ids),
                InsightLike.web_user_id == current_user.id,
            )
        )
    ).all()
    my_reaction_map = {int(iid): (rtype or "heart") for iid, rtype, _ in my_rows}
    my_comment_map = {int(iid): comment for iid, _, comment in my_rows}

    out = []
    for ins, u, pp in rows:
        r_counts = reactions_map.get(ins.id, {})
        out.append({
            "id": ins.id,
            "aspect": ins.aspect,
            "kind": ins.kind,
            "text": ins.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "focus_aspects": (pp.focus_aspects if pp else None) or [],
            "reactions": r_counts,
            "likes": sum(r_counts.values()),
            "my_reaction": my_reaction_map.get(ins.id),
            "my_comment": my_comment_map.get(ins.id),
            "created_at": ins.created_at.isoformat(),
        })

    if sort == "popular":
        out.sort(key=lambda x: x["likes"], reverse=True)
    return out


# ── Топ-10 юзеров по аспекту ────────────────────────────────────────────────

@router.get("/hall/{aspect}/leaderboard")
async def get_aspect_leaderboard(
    aspect: str,
    limit: int = 10,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    aspect = _validate_aspect(aspect)
    limit = max(1, min(limit, 50))

    # Считаем «вклад» как: число публичных инсайтов * 5 + число реакций
    # на свои инсайты в этом аспекте. Простая проксика, без идеала.
    insight_count_subq = (
        select(
            AspectInsight.web_user_id.label("uid"),
            func.count().label("cnt"),
        )
        .where(
            AspectInsight.aspect == aspect,
            AspectInsight.is_public.is_(True),
        )
        .group_by(AspectInsight.web_user_id)
        .subquery()
    )
    likes_count_subq = (
        select(
            AspectInsight.web_user_id.label("uid"),
            func.count(InsightLike.insight_id).label("likes"),
        )
        .join(InsightLike, InsightLike.insight_id == AspectInsight.id)
        .where(
            AspectInsight.aspect == aspect,
            AspectInsight.is_public.is_(True),
        )
        .group_by(AspectInsight.web_user_id)
        .subquery()
    )

    rows = (
        await session.execute(
            select(
                WebUser,
                PublicProfile,
                insight_count_subq.c.cnt,
                likes_count_subq.c.likes,
            )
            .join(insight_count_subq, insight_count_subq.c.uid == WebUser.id)
            .outerjoin(likes_count_subq, likes_count_subq.c.uid == WebUser.id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(
                (PublicProfile.is_public.is_(None)) | (PublicProfile.is_public.is_(True))
            )
        )
    ).all()

    # Сортируем в питоне для простоты.
    items = []
    for u, pp, cnt, likes in rows:
        cnt = int(cnt or 0)
        likes = int(likes or 0)
        score = cnt * 5 + likes
        items.append({
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "focus_aspects": (pp.focus_aspects if pp else None) or [],
            "insights_count": cnt,
            "likes_received": likes,
            "score": score,
            "is_me": u.id == current_user.id,
        })
    items.sort(key=lambda x: x["score"], reverse=True)
    items = items[:limit]
    for i, it in enumerate(items, start=1):
        it["rank"] = i
    return items


# ── Уголок вдохновения (от юзеров) ──────────────────────────────────────────

@router.get("/hall/{aspect}/inspirations")
async def get_inspirations(
    aspect: str,
    limit: int = 30,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    aspect = _validate_aspect(aspect)
    limit = max(1, min(limit, 100))

    rows = (
        await session.execute(
            select(WebUser, PublicProfile)
            .join(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(PublicProfile.is_public.is_(True))
            .where(PublicProfile.inspirations.is_not(None))
        )
    ).all()

    out = []
    for u, pp in rows:
        if not isinstance(pp.inspirations, list):
            continue
        for it in pp.inspirations:
            if not isinstance(it, dict):
                continue
            if it.get("aspect") == aspect:
                out.append({
                    "type": it.get("type", "other"),
                    "title": it.get("title", ""),
                    "note": it.get("note"),
                    "user_id": u.id,
                    "display_name": _display_name(u),
                    "avatar": pp.avatar,
                })
    # Без сортировки — пока возвращаем как есть. Применяем cap.
    return out[:limit]
