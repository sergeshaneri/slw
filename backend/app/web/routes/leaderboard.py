"""
Leaderboard:

  GET /api/leaderboard?limit=20  — топ юзеров по XP

XP считается из двух источников и берётся MAX:
  1. journey_events (`type='step_completed'`):
       • events.web_user_id = web_users.id (события от web — пока не пишутся)
       • events.telegram_id = web_users.telegram_id (события от бота)
  2. web_state.journey -> 'completedScripts' (массив short_id, фронт его
     обновляет и при прохождении в вебе, и при подтягивании bot-events).

Зачем MAX, а не сумма: фронт мерджит bot-events в completedScripts при
каждой загрузке, поэтому списки часто пересекаются — суммирование завысит.

Юзеры с приватным профилем (public_profiles.is_public=false) исключаются.
Юзеры с XP=0 в топ не попадают — иначе свежие регистрации перебивают
реальных активных.

Эндпоинт публичный (без auth) — это «витрина» приложения.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JourneyEvent, PublicProfile, WebState, WebUser
from app.db.session import get_session

router = APIRouter()


def _scripts_count(journey: object) -> int:
    if not isinstance(journey, dict):
        return 0
    cs = journey.get("completedScripts")
    if isinstance(cs, list):
        return len(cs)
    return 0


@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
) -> list:
    limit = max(1, min(limit, 100))

    # Все юзеры с не-скрытым профилем (нет записи в public_profiles
    # = по умолчанию публичный).
    users_rows = (
        await session.execute(
            select(WebUser, PublicProfile)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(
                or_(
                    PublicProfile.is_public.is_(None),
                    PublicProfile.is_public.is_(True),
                )
            )
        )
    ).all()

    # Bulk-счётчики событий, чтобы не делать N запросов.
    tg_counts: dict[int, int] = {
        int(tid): int(c)
        for tid, c in (
            await session.execute(
                select(JourneyEvent.telegram_id, func.count())
                .where(
                    JourneyEvent.type == "step_completed",
                    JourneyEvent.telegram_id.is_not(None),
                )
                .group_by(JourneyEvent.telegram_id)
            )
        ).all()
    }
    web_counts: dict[int, int] = {
        int(wid): int(c)
        for wid, c in (
            await session.execute(
                select(JourneyEvent.web_user_id, func.count())
                .where(
                    JourneyEvent.type == "step_completed",
                    JourneyEvent.web_user_id.is_not(None),
                )
                .group_by(JourneyEvent.web_user_id)
            )
        ).all()
    }

    # web_state.journey для всех — нужен completedScripts.length.
    state_rows = (await session.execute(select(WebState))).scalars().all()
    state_map = {s.web_user_id: s.journey for s in state_rows}

    items = []
    for user, profile in users_rows:
        events_xp = web_counts.get(user.id, 0)
        if user.telegram_id:
            events_xp += tg_counts.get(user.telegram_id, 0)
        scripts_xp = _scripts_count(state_map.get(user.id))
        xp = max(events_xp, scripts_xp)
        if xp > 0:
            items.append((user, profile, xp))

    items.sort(key=lambda t: t[2], reverse=True)
    items = items[:limit]

    out = []
    for rank, (user, profile, xp) in enumerate(items, start=1):
        display_name = (
            user.display_name
            or user.telegram_first_name
            or (user.email.split("@")[0] if user.email else f"user{user.id}")
        )
        focus = (profile.focus_aspects if profile else None) or []
        out.append({
            "rank": rank,
            "user_id": user.id,
            "display_name": display_name,
            "xp": xp,
            "focus_aspects": focus,
        })
    return out
