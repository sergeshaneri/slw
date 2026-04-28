"""
Notifications:
  GET    /api/notifications              — последние N уведомлений
  GET    /api/notifications/unread_count — счётчик непрочитанных (для bell)
  POST   /api/notifications/mark_read    — пометить все/конкретные прочитанными
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()


class MarkReadIn(BaseModel):
    ids: list[int] | None = None  # None = пометить все


@router.get("/notifications")
async def get_notifications(
    limit: int = 30,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    limit = max(1, min(limit, 100))
    rows = (
        await session.execute(
            select(Notification)
            .where(Notification.web_user_id == current_user.id)
            .order_by(Notification.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": n.id,
            "type": n.type,
            "payload": n.payload,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in rows
    ]


@router.get("/notifications/unread_count")
async def get_unread_count(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    count = int((
        await session.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.web_user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        )
    ).scalar_one())
    return {"unread_count": count}


@router.post("/notifications/mark_read")
async def mark_read(
    body: MarkReadIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = (
        update(Notification)
        .where(
            Notification.web_user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    if body.ids:
        stmt = stmt.where(Notification.id.in_(body.ids))
    await session.execute(stmt)
    await session.commit()
    return {"ok": True}
