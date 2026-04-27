"""
Leaderboard:

  GET /api/leaderboard?limit=20  — топ юзеров по XP

XP = количество завершённых шагов в `journey_events` (`type='step_completed'`).
Считается **в обоих источниках**:
  • web — через `journey_events.web_user_id = web_users.id`
  • bot — через `journey_events.telegram_id = web_users.telegram_id`
    (бот пишет события только с telegram_id; маппинг через web_users)

Юзеры с приватным профилем (public_profiles.is_public=false) исключаются.
Юзеры без журнал-событий (нулевой XP) исключаются — иначе пустой список
свежих регистраций перебивает реальных активных.

Эндпоинт публичный (без auth) — это «витрина» приложения.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_, select
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

    # JOIN web_users → journey_events по любому из ключей:
    #   • прямой web_user_id
    #   • telegram_id (если у юзера привязан TG)
    # COUNT(DISTINCT id) — на случай если позже event запишется с обоими
    # полями: не дублируем в счёте.
    xp_col = func.count(func.distinct(JourneyEvent.id)).label("xp")

    rows = (
        await session.execute(
            select(WebUser, xp_col, PublicProfile)
            .join(
                JourneyEvent,
                and_(
                    JourneyEvent.type == "step_completed",
                    or_(
                        JourneyEvent.web_user_id == WebUser.id,
                        and_(
                            WebUser.telegram_id.is_not(None),
                            JourneyEvent.telegram_id == WebUser.telegram_id,
                        ),
                    ),
                ),
            )
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            # Скрытые профили исключаем; для юзеров без записи в
            # public_profiles считаем по умолчанию публичными.
            .where(
                or_(
                    PublicProfile.is_public.is_(None),
                    PublicProfile.is_public.is_(True),
                )
            )
            .group_by(WebUser.id, PublicProfile.web_user_id)
            .order_by(xp_col.desc())
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
