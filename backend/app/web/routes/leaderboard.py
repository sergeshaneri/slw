"""
Leaderboard:

  GET /api/leaderboard?limit=20  — топ юзеров по XP

XP считается из трёх источников, MAX (синхронизировано с profile._xp):
  1. **real_xp** — `web_state.journey.xp`. Реальная сумма с весами
     скриптов (T=5/B=10/U=15/R=10/...), которую фронт пишет через
     `awardXP`. Это «настоящий» XP юзера — тот, что виден в шапке чата.
  2. **count_scripts** — сумма `len(completedScripts)` по всем папкам
     `aspects`. Fallback для случаев, когда `journey.xp` потерян.
  3. **events_count** — count записей step_completed в journey_events
     (от бота + от веба через POST /api/events/step-completed).

Берём MAX: фронт мерджит bot-events в completedScripts при загрузке,
поэтому source overlapping — суммирование задвоит. MAX даёт точку
истины — какой бы источник ни оказался самым полным.

До 2026-05 leaderboard смотрел только на легаси плоский
`journey.completedScripts` (всегда 0 в новой структуре) + count
событий. Веб-юзеры показывались с XP = только bot-event-count, реальный
weighted journey.xp игнорировался — отсюда расхождение с тем, что
показано в шапке чата.

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
from app.web.routes.profile import compute_xp_from_state

router = APIRouter()


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

    # web_state.journey для всех — нужен journey.xp и aspects-completedScripts.
    state_rows = (await session.execute(select(WebState))).scalars().all()
    state_map = {s.web_user_id: s.journey for s in state_rows}

    items = []
    for user, profile in users_rows:
        events_count = web_counts.get(user.id, 0)
        if user.telegram_id:
            events_count += tg_counts.get(user.telegram_id, 0)
        real_xp, count_scripts = compute_xp_from_state(state_map.get(user.id))
        xp = max(real_xp, count_scripts, events_count)
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
