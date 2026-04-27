"""Bot side of journey_events sync: emit `step_completed` on advance.

Все ошибки глотаем — sync это side-effect, никогда не должен ломать
основной TG-флоу. Если БД недоступна, таблицы нет (DDL упал), connection
утёк — бот молча продолжает работать с юзером, просто event не запишется.
"""
import logging

from app.content.loader import Step, short_id_for
from app.db.models import JourneyEvent
from app.db.session import AsyncSessionLocal

log = logging.getLogger(__name__)


async def emit_step_completed(telegram_id: int, step: Step) -> None:
    try:
        async with AsyncSessionLocal() as session:
            session.add(JourneyEvent(
                telegram_id=telegram_id,
                source="bot",
                type="step_completed",
                aspect=step.aspect,
                level=step.level,
                short_id=short_id_for(step),
                step_id=step.id,
            ))
            await session.commit()
    except Exception as e:
        log.warning(
            "emit_step_completed(tg=%s, step=%s) failed: %s",
            telegram_id, step.id, e,
        )
