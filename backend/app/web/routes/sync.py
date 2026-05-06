"""
Sync route:
  GET /api/sync/bot-state — returns the user's position in the Telegram bot.

Multi-aspect: возвращает массив `aspects[]` с прогрессом юзера по каждому
аспекту, плюс top-level `current_aspect/current_level/current_step_id` для
backwards-совместимости со старым фронтом (тот читал только текущий аспект).

Уровень в `aspects[].current_level` берём из загруженного content-shape
(loader знает, к какому level относится step). Это избавляет от
дублирования level в DB.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.loader import get_step
from app.db.models import UserAspectState, UserState, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter(prefix="/sync")


@router.get("/bot-state")
async def get_bot_state(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not current_user.telegram_id:
        return {"linked": False}

    state = await session.get(UserState, current_user.telegram_id)
    aspect_rows = (
        await session.execute(
            select(UserAspectState).where(UserAspectState.telegram_id == current_user.telegram_id)
        )
    ).scalars().all()

    aspects_payload = []
    for row in aspect_rows:
        step = get_step(row.current_step_id) if row.current_step_id else None
        aspects_payload.append({
            "aspect": row.aspect,
            "current_step_id": row.current_step_id,
            "current_level": step.level if step else None,
            "finished": row.finished,
            "last_active_at": row.last_active_at.isoformat() if row.last_active_at else None,
        })

    if not state and not aspect_rows:
        return {"linked": True, "state": None}

    # Top-level fields — для backwards-совместимости со старым sync-кодом
    # фронта. Новый фронт читает aspects[].
    return {
        "linked": True,
        "state": {
            "current_aspect": state.current_aspect if state else None,
            "current_level": state.current_level if state else None,
            "current_step_id": state.current_step_id if state else None,
            "streak_days": state.streak_days if state else 0,
            "last_active_at": (
                state.last_active_at.isoformat()
                if state and state.last_active_at else None
            ),
            "aspects": aspects_payload,
        },
    }
