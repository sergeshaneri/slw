"""
Events route — общий лог прогресса между TG-ботом и веб-приложением.

  GET  /api/events?since_id=N — события юзера (по telegram_id и/или
                                 web_user_id) с id > since_id. Фронт применяет
                                 их к своему journey (см. App.jsx loadFromApi).
  POST /api/events             — фронт пишет своё событие (тип
                                 `step_completed`). Бот в cmd_go/cmd_resume
                                 подтягивает их через pull_web_progress
                                 и сдвигает свой current_step_id вперёд.

Бот пишет напрямую в БД из `app.bot.handlers.events.emit_step_completed`.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.bot.handlers.events import _step_by_short
from app.db.models import JourneyEvent, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter(prefix="/events")


class EventIn(BaseModel):
    type: str          # 'step_completed' (пока единственный тип)
    aspect: str
    level: int = 0
    short_id: str


@router.get("")
async def get_events(
    since_id: int = 0,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    # Юзер видит события, привязанные либо к его web_user_id, либо к его TG-id
    # (если TG залинкован). Это позволяет подтянуть прогресс, который бот
    # записал ДО того, как юзер связал аккаунты.
    conditions = [JourneyEvent.web_user_id == current_user.id]
    if current_user.telegram_id:
        conditions.append(JourneyEvent.telegram_id == current_user.telegram_id)

    stmt = (
        select(JourneyEvent)
        .where(or_(*conditions))
        .where(JourneyEvent.id > since_id)
        .order_by(JourneyEvent.id.asc())
    )
    rows = (await session.execute(stmt)).scalars().all()

    return {
        "events": [
            {
                "id": e.id,
                "source": e.source,
                "type": e.type,
                "aspect": e.aspect,
                "level": e.level,
                "short_id": e.short_id,
                "step_id": e.step_id,
                "payload": e.payload,
                "created_at": e.created_at.isoformat(),
            }
            for e in rows
        ],
        "last_id": rows[-1].id if rows else since_id,
    }


@router.post("")
async def post_event(
    body: EventIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.type != "step_completed":
        raise HTTPException(400, f"Unsupported event type: {body.type}")

    # Best-effort: резолвим full step_id на момент инсёрта. Если не нашли —
    # ивент всё равно пишем (бот сам матчит по aspect+level+short_id).
    step = _step_by_short(body.aspect, body.level, body.short_id)
    full_step_id = step.id if step else None

    session.add(JourneyEvent(
        telegram_id=current_user.telegram_id,  # может быть None — тогда бот не увидит
        web_user_id=current_user.id,
        source="web",
        type="step_completed",
        aspect=body.aspect,
        level=body.level,
        short_id=body.short_id,
        step_id=full_step_id,
        payload={"resolved": full_step_id is not None},
    ))
    await session.commit()
    return {"ok": True}


@router.post("/backfill")
async def backfill_my_progress(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Материализовать прошлый прогресс из bot-таблиц (`user_state`) в
    `journey_events`. Идемпотентен: удаляет существующие `step_completed`
    события перед заливкой. Нужен, потому что startCommand на Railway
    залочен через railway.toml (см. CLAUDE.md gotcha) и `python -m
    app.scripts.backfill_events` нельзя дёрнуть с дашборда — этот endpoint
    делает то же самое для запросившего юзера.
    """
    if not current_user.telegram_id:
        return {"backfilled": 0, "skipped": "no_telegram"}
    # Импорт внутри, чтобы избежать кросс-модульного цикла на старте.
    from app.scripts.backfill_events import _backfill_user
    count = await _backfill_user(session, current_user.telegram_id, dry_run=False)
    return {"backfilled": count, "telegram_id": current_user.telegram_id}
