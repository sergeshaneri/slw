"""
Leaderboard:

  GET /api/leaderboard?limit=20  — топ юзеров по XP

XP = количество завершённых шагов в `journey_events` (`type='step_completed'`).
Юзеры с приватным профилем (public_profiles.is_public=false) исключаются.
Юзеры без журнал-событий (нулевой XP) исключаются — иначе пустой список
свежих регистраций перебивает реальных активных.

Эндпоинт публичный (без auth) — это «витрина» приложения.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JourneyEvent, PublicProfile, WebUser
from app.db.session import get_session

router = APIRouter()


@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
) -> list:
    limit = max(1, min(limit, 100))

    # Шаг 1: топ user_id по числу step_completed-событий.
    xp_subq = (
        select(
            JourneyEvent.web_user_id.label("uid"),
            func.count().label("xp"),
        )
        .where(
            JourneyEvent.type == "step_completed",
            JourneyEvent.web_user_id.is_not(None),
        )
        .group_by(JourneyEvent.web_user_id)
        .subquery()
    )

    rows = (
        await session.execute(
            select(WebUser, xp_subq.c.xp, PublicProfile)
            .join(xp_subq, WebUser.id == xp_subq.c.uid)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            # Если профиль явно скрыт (is_public=false) — исключаем.
            # Если профиля нет — пускаем (по умолчанию профиль публичный).
            .where(
                (PublicProfile.is_public.is_(None))
                | (PublicProfile.is_public.is_(True))
            )
            .order_by(xp_subq.c.xp.desc())
            .limit(limit)
        )
    ).all()

    out = []
    for rank, (user, xp, profile) in enumerate(rows, start=1):
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
            "xp": int(xp),
            "focus_aspects": focus,
        })
    return out
