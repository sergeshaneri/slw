"""
Public profile + insights:

  GET    /api/profile/me                — мой профиль (full, с приватной частью)
  PUT    /api/profile/me                — обновить мой профиль
  GET    /api/profile/{user_id}         — публичный профиль чужого юзера
  GET    /api/profile/me/insights       — мои инсайты (включая приватные)
  POST   /api/profile/insights          — создать инсайт
  DELETE /api/profile/insights/{id}     — удалить свой инсайт
  POST   /api/profile/insights/{id}/like — лайкнуть/анлайкнуть (toggle)

Профиль создаётся lazy: первый PUT делает upsert, GET до этого момента
возвращает пустой дефолт. Это не ломает регистрацию и не требует миграции
существующих юзеров.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AspectInsight,
    InsightLike,
    JourneyEvent,
    PublicProfile,
    WebScore,
    WebState,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()

ASPECT_KEYS = ["БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"]
INSIGHT_KINDS = {"insight", "recommendation"}
INSPIRATION_TYPES = {"film", "book", "music", "activity", "person", "other"}


# ── Schemas ─────────────────────────────────────────────────────────────────

class InspirationCard(BaseModel):
    type: str
    title: str
    note: str | None = None
    aspect: str | None = None


class ProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=600)
    focus_aspects: list[str] | None = None
    interests: list[str] | None = None
    inspirations: list[InspirationCard] | None = None
    goals: list[str] | None = None
    is_public: bool | None = None


class InsightIn(BaseModel):
    aspect: str
    kind: str = "insight"
    text: str = Field(min_length=1, max_length=2000)
    is_public: bool = True


# ── Helpers ─────────────────────────────────────────────────────────────────

def _validate_aspects(aspects: list[str] | None, max_count: int) -> list[str]:
    if not aspects:
        return []
    cleaned = [a for a in aspects if a in ASPECT_KEYS]
    if len(cleaned) > max_count:
        cleaned = cleaned[:max_count]
    return cleaned


def _clean_str_list(items: list[str] | None, max_count: int, max_len: int) -> list[str]:
    if not items:
        return []
    out = []
    for it in items:
        if not isinstance(it, str):
            continue
        s = it.strip()
        if s:
            out.append(s[:max_len])
        if len(out) >= max_count:
            break
    return out


def _clean_inspirations(items: list[InspirationCard] | None) -> list[dict]:
    if not items:
        return []
    out = []
    for card in items:
        if card.type not in INSPIRATION_TYPES:
            continue
        title = card.title.strip()
        if not title:
            continue
        out.append({
            "type": card.type,
            "title": title[:100],
            "note": (card.note or "").strip()[:300] or None,
            "aspect": card.aspect if card.aspect in ASPECT_KEYS else None,
        })
        if len(out) >= 24:
            break
    return out


def _display_name(user: WebUser) -> str:
    if user.display_name:
        return user.display_name
    if user.telegram_first_name:
        return user.telegram_first_name
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.id}"


async def _xp(session: AsyncSession, user: WebUser) -> int:
    """Серверный XP-эквивалент: MAX между journey_events и completedScripts.

    Источники:
      1. journey_events.web_user_id == user.id (события от веба — пока никто
         не пишет, заготовка)
      2. journey_events.telegram_id == user.telegram_id (события от бота)
      3. web_state.journey -> 'completedScripts' (массив id шагов, веб-чат
         туда дописывает; фронт также мерджит туда bot-события).

    Берём MAX (а не SUM): фронт уже мерджит bot-events в completedScripts,
    поэтому суммирование задвоит. См. также leaderboard.py.
    """
    from sqlalchemy import and_, or_
    conditions = [JourneyEvent.web_user_id == user.id]
    if user.telegram_id:
        conditions.append(JourneyEvent.telegram_id == user.telegram_id)
    events_xp = int((
        await session.execute(
            select(func.count(func.distinct(JourneyEvent.id)))
            .where(
                and_(
                    JourneyEvent.type == "step_completed",
                    or_(*conditions),
                )
            )
        )
    ).scalar_one())

    state = await session.get(WebState, user.id)
    scripts_xp = 0
    if state and isinstance(state.journey, dict):
        cs = state.journey.get("completedScripts")
        if isinstance(cs, list):
            scripts_xp = len(cs)

    return max(events_xp, scripts_xp)


async def _profile_payload(
    session: AsyncSession,
    target_user: WebUser,
    profile: PublicProfile | None,
    viewer_user: WebUser | None,
    *,
    include_private: bool,
) -> dict:
    """Сборка JSON-ответа для GET /profile/{id} и GET /profile/me."""
    xp = await _xp(session, target_user)
    score_rows = (
        await session.execute(
            select(WebScore).where(WebScore.web_user_id == target_user.id)
        )
    ).scalars().all()
    scores = {r.aspect: float(r.value) for r in score_rows}

    # Инсайты: для своего профиля — все, для чужого — только публичные.
    insight_q = select(AspectInsight).where(
        AspectInsight.web_user_id == target_user.id
    )
    if not include_private:
        insight_q = insight_q.where(AspectInsight.is_public.is_(True))
    insight_q = insight_q.order_by(AspectInsight.created_at.desc())
    insights_rows = (await session.execute(insight_q)).scalars().all()

    insights_payload = []
    if insights_rows:
        ids = [r.id for r in insights_rows]
        # Счётчики лайков одним запросом.
        like_counts_rows = (
            await session.execute(
                select(InsightLike.insight_id, func.count())
                .where(InsightLike.insight_id.in_(ids))
                .group_by(InsightLike.insight_id)
            )
        ).all()
        like_counts = {iid: int(c) for iid, c in like_counts_rows}
        # Лайкнул ли viewer.
        liked_by_viewer: set[int] = set()
        if viewer_user is not None:
            liked_rows = (
                await session.execute(
                    select(InsightLike.insight_id)
                    .where(
                        InsightLike.insight_id.in_(ids),
                        InsightLike.web_user_id == viewer_user.id,
                    )
                )
            ).scalars().all()
            liked_by_viewer = set(int(x) for x in liked_rows)

        for r in insights_rows:
            insights_payload.append({
                "id": r.id,
                "aspect": r.aspect,
                "kind": r.kind,
                "text": r.text,
                "is_public": r.is_public,
                "likes": like_counts.get(r.id, 0),
                "liked_by_me": r.id in liked_by_viewer,
                "created_at": r.created_at.isoformat(),
            })

    return {
        "user_id": target_user.id,
        "display_name": _display_name(target_user),
        "bio": (profile.bio if profile else None),
        "focus_aspects": (profile.focus_aspects if profile else None) or [],
        "interests": (profile.interests if profile else None) or [],
        "inspirations": (profile.inspirations if profile else None) or [],
        "goals": (profile.goals if profile else None) or [],
        "is_public": (profile.is_public if profile else True),
        "xp": xp,
        "scores": scores,
        "insights": insights_payload,
    }


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/profile/me")
async def get_my_profile(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    profile = await session.get(PublicProfile, current_user.id)
    return await _profile_payload(
        session, current_user, profile, current_user, include_private=True
    )


@router.put("/profile/me")
async def update_my_profile(
    body: ProfileUpdate,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    profile = await session.get(PublicProfile, current_user.id)
    is_new = profile is None
    if is_new:
        profile = PublicProfile(web_user_id=current_user.id)
        session.add(profile)

    # PATCH-семантика: апдейтим только то, что прислано (не None).
    if body.bio is not None:
        profile.bio = body.bio.strip()[:600] or None
    if body.focus_aspects is not None:
        profile.focus_aspects = _validate_aspects(body.focus_aspects, max_count=3)
    if body.interests is not None:
        profile.interests = _clean_str_list(body.interests, max_count=12, max_len=40)
    if body.inspirations is not None:
        profile.inspirations = _clean_inspirations(body.inspirations)
    if body.goals is not None:
        profile.goals = _clean_str_list(body.goals, max_count=3, max_len=200)
    if body.is_public is not None:
        profile.is_public = body.is_public
    profile.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(profile)
    return await _profile_payload(
        session, current_user, profile, current_user, include_private=True
    )


@router.get("/profile/{user_id}")
async def get_public_profile(
    user_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    target = await session.get(WebUser, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    profile = await session.get(PublicProfile, user_id)
    # Скрытый профиль — 404 для всех кроме самого юзера. Этот эндпоинт
    # без auth, так что просто 404.
    if profile is not None and profile.is_public is False:
        raise HTTPException(status_code=404, detail="Profile is private")

    return await _profile_payload(
        session, target, profile, viewer_user=None, include_private=False
    )


# ── Insights ────────────────────────────────────────────────────────────────

@router.get("/profile/me/insights")
async def get_my_insights(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    rows = (
        await session.execute(
            select(AspectInsight)
            .where(AspectInsight.web_user_id == current_user.id)
            .order_by(AspectInsight.created_at.desc())
        )
    ).scalars().all()
    if not rows:
        return []

    ids = [r.id for r in rows]
    like_counts_rows = (
        await session.execute(
            select(InsightLike.insight_id, func.count())
            .where(InsightLike.insight_id.in_(ids))
            .group_by(InsightLike.insight_id)
        )
    ).all()
    like_counts = {iid: int(c) for iid, c in like_counts_rows}
    return [
        {
            "id": r.id,
            "aspect": r.aspect,
            "kind": r.kind,
            "text": r.text,
            "is_public": r.is_public,
            "likes": like_counts.get(r.id, 0),
            "liked_by_me": False,  # это «свои», лайкать самому себе нельзя
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/profile/insights")
async def post_insight(
    body: InsightIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=400, detail="Unknown aspect")
    if body.kind not in INSIGHT_KINDS:
        raise HTTPException(status_code=400, detail="kind must be 'insight' or 'recommendation'")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is empty")

    insight = AspectInsight(
        web_user_id=current_user.id,
        aspect=body.aspect,
        kind=body.kind,
        text=text[:2000],
        is_public=body.is_public,
    )
    session.add(insight)
    await session.commit()
    await session.refresh(insight)
    return {
        "id": insight.id,
        "aspect": insight.aspect,
        "kind": insight.kind,
        "text": insight.text,
        "is_public": insight.is_public,
        "likes": 0,
        "liked_by_me": False,
        "created_at": insight.created_at.isoformat(),
    }


@router.delete("/profile/insights/{insight_id}")
async def delete_insight(
    insight_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    insight = await session.get(AspectInsight, insight_id)
    if not insight or insight.web_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Insight not found")
    # Удаляем лайки и сам инсайт.
    await session.execute(delete(InsightLike).where(InsightLike.insight_id == insight_id))
    await session.delete(insight)
    await session.commit()
    return {"ok": True}


@router.post("/profile/insights/{insight_id}/like")
async def toggle_like(
    insight_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    insight = await session.get(AspectInsight, insight_id)
    if not insight or insight.is_public is False:
        raise HTTPException(status_code=404, detail="Insight not found")
    if insight.web_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot like your own insight")

    existing = (
        await session.execute(
            select(InsightLike).where(
                InsightLike.insight_id == insight_id,
                InsightLike.web_user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        await session.delete(existing)
        liked = False
    else:
        session.add(InsightLike(insight_id=insight_id, web_user_id=current_user.id))
        liked = True
    await session.commit()

    total = (
        await session.execute(
            select(func.count())
            .select_from(InsightLike)
            .where(InsightLike.insight_id == insight_id)
        )
    ).scalar_one()
    return {"liked": liked, "likes": int(total)}
