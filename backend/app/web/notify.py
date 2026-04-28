"""Хелперы для создания уведомлений.

Используются из routes/profile.py (реакции, follow), routes/hall.py
(новое сообщение в холле где ты писал), routes/dm.py (новое ЛС).

Все функции — best-effort: если запись упала, не валим основной запрос.
Юзер всё равно увидит свежее уведомление при следующем открытии bell-ленты,
если БД работает.
"""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AspectMessage, Notification

log = logging.getLogger(__name__)


async def notify(
    session: AsyncSession,
    user_id: int,
    type_: str,
    payload: dict,
    *,
    skip_if_self: int | None = None,
) -> None:
    """Создать одно уведомление. Если skip_if_self == user_id — не создаём
    (нет смысла уведомлять о собственном действии)."""
    if skip_if_self is not None and skip_if_self == user_id:
        return
    try:
        session.add(Notification(
            web_user_id=user_id,
            type=type_,
            payload=payload,
        ))
    except Exception as e:
        log.warning("notify add failed (%s → user=%s): %s", type_, user_id, e)


async def notify_hall_writers(
    session: AsyncSession,
    aspect: str,
    new_message_id: int,
    actor_id: int,
    actor_name: str,
    text_preview: str,
) -> None:
    """Уведомить всех, кто писал в этот холл, кроме текущего автора.
    Дедуп по уникальным web_user_id (один раз на юзера в час делать
    rate-limit пока не будем — простой набор уникальных авторов холла)."""
    try:
        rows = (
            await session.execute(
                select(AspectMessage.web_user_id.distinct())
                .where(AspectMessage.aspect == aspect)
            )
        ).scalars().all()
        for uid in rows:
            if int(uid) == actor_id:
                continue
            session.add(Notification(
                web_user_id=int(uid),
                type="hall_reply",
                payload={
                    "aspect": aspect,
                    "message_id": new_message_id,
                    "actor_id": actor_id,
                    "actor_name": actor_name,
                    "preview": text_preview[:160],
                },
            ))
    except Exception as e:
        log.warning("notify_hall_writers failed: %s", e)
