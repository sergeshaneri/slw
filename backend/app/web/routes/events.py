"""GET /api/events?since_id=N — общий event-лог между TG-ботом и web.

Фронт дёргает на каждой загрузке. Если у юзера TG залинкован, но событий
ещё нет — на ходу делаем бэкфилл из `user_state.current_step_id` (все шаги
с меньшим `ord` = пройдены). Идемпотентен: повторные хиты — no-op.

Все опасные места обёрнуты в try/except — если `journey_events` ещё нет
(DDL упал), отдаём пустой список и не валим запрос.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.content.loader import load_steps, short_id_for
from app.db.models import JourneyEvent, UserState, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

log = logging.getLogger(__name__)

router = APIRouter(prefix="/events")


class StepCompletedIn(BaseModel):
    aspect: str          # 'БС' / 'ЧЭ' / ... (cyrillic — фронт переводит)
    level: int           # 0/1/2/3
    short_id: str        # 'T-1' / 'S-1' / etc
    step_id: str | None = None
    payload: dict | None = None


async def _maybe_backfill(session: AsyncSession, telegram_id: int) -> int:
    """Если у юзера ещё нет bot-events — материализуем прошлый прогресс.
    Идемпотентен: при наличии хотя бы одного события для telegram_id —
    no-op. Возвращает число вставленных записей."""
    existing = (await session.execute(
        select(JourneyEvent.id)
        .where(JourneyEvent.telegram_id == telegram_id)
        .where(JourneyEvent.source == "bot")
        .limit(1)
    )).first()
    if existing:
        return 0

    state = await session.get(UserState, telegram_id)
    if not state or not state.current_step_id:
        return 0

    steps = load_steps()
    current = next((s for s in steps if s.id == state.current_step_id), None)
    if not current:
        return 0

    completed = [s for s in steps if s.ord < current.ord]
    if not completed:
        return 0

    now = datetime.utcnow()
    for s in completed:
        session.add(JourneyEvent(
            telegram_id=telegram_id,
            source="bot",
            type="step_completed",
            aspect=s.aspect,
            level=s.level,
            short_id=short_id_for(s),
            step_id=s.id,
            payload={"backfilled": True},
            created_at=now,
        ))
    await session.commit()
    return len(completed)


@router.get("")
async def get_events(
    since_id: int = 0,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    # Авто-бэкфилл при первом обращении TG-залинкованного юзера. Защищено
    # try/except: таблица journey_events может ещё не существовать (DDL упал),
    # тогда просто отдаём пустой список ниже.
    if current_user.telegram_id:
        try:
            n = await _maybe_backfill(session, current_user.telegram_id)
            if n:
                log.info("backfilled %d events for tg=%s", n, current_user.telegram_id)
        except Exception as e:
            log.warning("on-demand backfill failed: %s", e)

    conditions = [JourneyEvent.web_user_id == current_user.id]
    if current_user.telegram_id:
        conditions.append(JourneyEvent.telegram_id == current_user.telegram_id)

    try:
        rows = (await session.execute(
            select(JourneyEvent)
            .where(or_(*conditions))
            .where(JourneyEvent.id > since_id)
            .order_by(JourneyEvent.id.asc())
        )).scalars().all()
    except Exception as e:
        log.warning("get_events query failed: %s", e)
        return {"events": [], "last_id": since_id}

    return {
        "events": [
            {
                "id": e.id,
                "source": e.source,
                "type": e.type,
                "aspect": e.aspect,
                "level": e.level,
                "short_id": e.short_id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in rows
        ],
        "last_id": rows[-1].id if rows else since_id,
    }


@router.post("/step-completed")
async def post_step_completed(
    body: StepCompletedIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Записать факт прохождения скрипта в append-only journey_events.
    Идемпотентно по (web_user_id, source='web', aspect, short_id) — повторный
    вызов с теми же параметрами не дублирует.

    Это страховка: если web_state.journey.completedScripts когда-то сбросится
    (миграция CONTENT_VERSION, race с другой вкладкой, …), точный список
    пройденных скриптов восстанавливается из этой таблицы.
    """
    # Идемпотентность через explicit-проверку. UNIQUE-constraint мы не
    # создаём отдельной миграцией, чтобы избежать DDL-сложностей на Railway:
    # при гонке вероятность дубля минимальна, и периодический DEDUPE-скрипт
    # может почистить остатки (если когда-то понадобится).
    try:
        existing = (await session.execute(
            select(JourneyEvent.id)
            .where(JourneyEvent.web_user_id == current_user.id)
            .where(JourneyEvent.source == "web")
            .where(JourneyEvent.type == "step_completed")
            .where(JourneyEvent.aspect == body.aspect)
            .where(JourneyEvent.short_id == body.short_id)
            .where(JourneyEvent.level == body.level)
            .limit(1)
        )).first()
    except Exception as e:
        log.warning("step-completed dedupe check failed: %s", e)
        existing = None

    if existing:
        return {"ok": True, "deduped": True, "event_id": existing[0]}

    event = JourneyEvent(
        web_user_id=current_user.id,
        telegram_id=current_user.telegram_id,
        source="web",
        type="step_completed",
        aspect=body.aspect,
        level=body.level,
        short_id=body.short_id,
        step_id=body.step_id,
        payload=body.payload,
        created_at=datetime.utcnow(),
    )
    session.add(event)
    try:
        await session.commit()
    except Exception as e:
        log.warning("step-completed insert failed: %s", e)
        await session.rollback()
        return {"ok": False, "error": str(e)}

    return {"ok": True, "deduped": False, "event_id": event.id}
