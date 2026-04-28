"""
Habit tracker — ежедневный «тик» практики по аспекту.

  GET  /api/habits/today          — что я сегодня тикнул (по всем аспектам)
  GET  /api/habits/{aspect}       — история по аспекту (последние 90 дней)
  POST /api/habits/{aspect}/tick  — отметить сегодняшнюю практику (idempotent)
  DELETE /api/habits/{aspect}/tick — снять сегодняшний тик

PK по (web_user_id, aspect, date) гарантирует идемпотентность.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import HabitTick, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()

ASPECT_KEYS = {"БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"}


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


@router.get("/habits/today")
async def get_today(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    today = _today()
    rows = (
        await session.execute(
            select(HabitTick.aspect)
            .where(
                HabitTick.web_user_id == current_user.id,
                HabitTick.date == today,
            )
        )
    ).scalars().all()
    return {"date": today, "aspects": sorted(set(rows))}


@router.get("/habits/{aspect}")
async def get_history(
    aspect: str,
    days: int = 90,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    days = max(7, min(days, 365))
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    rows = (
        await session.execute(
            select(HabitTick.date)
            .where(
                HabitTick.web_user_id == current_user.id,
                HabitTick.aspect == aspect,
                HabitTick.date >= since,
            )
            .order_by(HabitTick.date.desc())
        )
    ).scalars().all()
    return {
        "aspect": aspect,
        "days": days,
        "from": since,
        "dates": list(rows),
    }


@router.post("/habits/{aspect}/tick")
async def tick(
    aspect: str,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    today = _today()
    stmt = pg_insert(HabitTick).values(
        web_user_id=current_user.id,
        aspect=aspect,
        date=today,
    ).on_conflict_do_nothing(index_elements=["web_user_id", "aspect", "date"])
    await session.execute(stmt)
    await session.commit()
    return {"aspect": aspect, "date": today, "ticked": True}


@router.delete("/habits/{aspect}/tick")
async def untick(
    aspect: str,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    today = _today()
    await session.execute(
        delete(HabitTick).where(
            HabitTick.web_user_id == current_user.id,
            HabitTick.aspect == aspect,
            HabitTick.date == today,
        )
    )
    await session.commit()
    return {"aspect": aspect, "date": today, "ticked": False}
