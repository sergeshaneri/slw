"""
State routes (whl_journey + whl_history):
  GET  /api/state  — load state
  PUT  /api/state  — save state
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import WebState, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()


class StateIn(BaseModel):
    journey: dict | None = None
    history: list | None = None


@router.get("/state")
async def get_state(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await session.get(WebState, current_user.id)
    return {
        "journey": row.journey if row else None,
        "history": row.history if row else None,
    }


@router.put("/state")
async def put_state(
    body: StateIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await session.get(WebState, current_user.id)
    if row is None:
        row = WebState(web_user_id=current_user.id)
        session.add(row)

    if body.journey is not None:
        row.journey = body.journey
    if body.history is not None:
        row.history = body.history
    row.updated_at = datetime.utcnow()

    await session.commit()
    return {"ok": True}
