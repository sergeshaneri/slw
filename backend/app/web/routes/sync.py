"""
Sync route:
  GET /api/sync/bot-state — returns the user's position in the Telegram bot
                            (aspect, level, streak). Only meaningful when
                            Telegram account is linked.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserState, WebUser
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
    if not state:
        return {"linked": True, "state": None}

    return {
        "linked": True,
        "state": {
            "current_aspect": state.current_aspect,
            "current_level": state.current_level,
            "current_step_id": state.current_step_id,
            "streak_days": state.streak_days,
            "last_active_at": state.last_active_at.isoformat() if state.last_active_at else None,
        },
    }
