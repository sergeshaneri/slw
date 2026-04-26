"""
Scores routes:
  GET  /api/scores  — {aspect: value, ...}
  PUT  /api/scores  — {aspect: value, ...}
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import WebScore, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()


@router.get("/scores")
async def get_scores(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    rows = (
        await session.execute(select(WebScore).where(WebScore.web_user_id == current_user.id))
    ).scalars().all()
    return {r.aspect: float(r.value) for r in rows}


@router.put("/scores")
async def put_scores(
    body: dict[str, float],
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    now = datetime.utcnow()
    for aspect, value in body.items():
        row = await session.get(WebScore, (current_user.id, aspect))
        if row is None:
            session.add(WebScore(web_user_id=current_user.id, aspect=aspect, value=value, updated_at=now))
        else:
            row.value = value
            row.updated_at = now
    await session.commit()
    return {"ok": True}
