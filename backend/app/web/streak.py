"""Серверный стрик. Bump-помощник для write-роутов.

Хранит в `user_streaks` глобальный счётчик подряд идущих дней с активностью.
Активность = любой write-эндпоинт, который вызывает bump_streak: тик
привычки, запись дневника, публикация инсайта, сообщение в холле,
реакция, ИИ-вызов, ЛС.

Логика обновления:
- last_active_date == today → no-op (уже сегодня были активны)
- last_active_date == today - 1 → current += 1, longest = max(...)
- gap покрыт shield (shield_until >= last + 1) → current += 1, shield clears
- иначе → current = 1, новый цикл

Все ошибки глотаются: стрик не должен ломать основной запрос.
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserStreak

log = logging.getLogger(__name__)


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


async def bump_streak(session: AsyncSession, web_user_id: int) -> None:
    """Best-effort обновление стрика. Не коммитит сама — оставляет
    транзакцию текущему вызывающему."""
    try:
        today = _today()
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        row = await session.get(UserStreak, web_user_id)
        if row is None:
            stmt = pg_insert(UserStreak).values(
                web_user_id=web_user_id,
                current=1,
                longest=1,
                last_active_date=today,
                shield_until=None,
                updated_at=datetime.utcnow(),
            ).on_conflict_do_nothing(index_elements=["web_user_id"])
            await session.execute(stmt)
            return

        last = row.last_active_date
        if last == today:
            return
        if last == yesterday:
            row.current = (row.current or 0) + 1
        elif last is not None and row.shield_until and row.shield_until >= today:
            # Shield покрывает gap (любой длины — но shield один раз).
            row.current = (row.current or 0) + 1
            row.shield_until = None
        else:
            row.current = 1
            row.shield_until = None

        if row.current > (row.longest or 0):
            row.longest = row.current
        row.last_active_date = today
        row.updated_at = datetime.utcnow()
    except Exception as e:
        log.warning("bump_streak(user=%s) failed: %s", web_user_id, e)


async def get_or_init(session: AsyncSession, web_user_id: int) -> UserStreak:
    """Возвращает row из user_streaks; создаёт пустую если нет."""
    row = await session.get(UserStreak, web_user_id)
    if row is None:
        row = UserStreak(
            web_user_id=web_user_id,
            current=0,
            longest=0,
            last_active_date=None,
            shield_until=None,
        )
        session.add(row)
        await session.flush()
    return row
