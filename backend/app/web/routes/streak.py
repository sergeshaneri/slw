"""
Streak endpoints:
  GET  /api/streak/me      — серверный стрик юзера (current/longest/last/shield)
  POST /api/streak/shield  — активировать защиту (фронт уже списал стардаст)

Стрик питается через app.web.streak.bump_streak() из write-роутов
(diary, insight, react, hall.message, habits.tick, dm.send).
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import WebUser
from app.db.session import get_session
from app.web.deps import get_current_user
from app.web.streak import get_or_init

router = APIRouter()


class ShieldIn(BaseModel):
    pay_with_stardust: bool = True


@router.get("/streak/me")
async def get_my_streak(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await get_or_init(session, current_user.id)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    # Если последняя активность была давно — фронту полезно понять статус.
    status = "active"
    if row.last_active_date is None:
        status = "none"
    elif row.last_active_date == today:
        status = "ticked_today"
    elif row.last_active_date == yesterday:
        status = "due_today"   # ещё не сделал ничего сегодня — стрик в зоне риска
    else:
        # Гэп больше суток. Проверяем shield.
        if row.shield_until and row.shield_until >= today:
            status = "shielded"
        else:
            status = "broken"
    await session.commit()
    return {
        "current": int(row.current or 0),
        "longest": int(row.longest or 0),
        "last_active_date": row.last_active_date,
        "shield_until": row.shield_until,
        "today": today,
        "status": status,
    }


@router.post("/streak/shield")
async def activate_shield(
    body: ShieldIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Trust-based: стардаст списывает фронт перед запросом. Backend ставит
    shield_until = today + 1 (одно покрытие на ближайший пропуск).
    """
    row = await get_or_init(session, current_user.id)
    if row.shield_until and row.shield_until >= datetime.utcnow().strftime("%Y-%m-%d"):
        # Уже активен — не списываем повторно.
        return {
            "shield_until": row.shield_until,
            "already_active": True,
        }
    tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
    row.shield_until = tomorrow
    row.updated_at = datetime.utcnow()
    await session.commit()
    return {
        "shield_until": row.shield_until,
        "already_active": False,
    }
