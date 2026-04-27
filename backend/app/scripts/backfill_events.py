"""
Одноразовый бэкфилл: материализовать прошлый прогресс из бот-таблиц
(`user_state`, `answers`) в общий event-лог `journey_events`.

Зачем: до запуска event-лога бот не писал события. Если у юзера в TG большой
прогресс (current_step_id где-то далеко от начала), web после деплоя будет
видеть пустой completedScripts. Этот скрипт пробегает по всем юзерам и
эмитит `step_completed` для каждого шага, ord которого МЕНЬШЕ ord-а текущего
шага юзера (значит юзер уже за него прошёл).

Запуск (Railway run / `railway run`):

    python -m app.scripts.backfill_events                # бэкфилл всех юзеров
    python -m app.scripts.backfill_events --telegram-id 5439403  # только одного
    python -m app.scripts.backfill_events --dry-run      # только показать план

Идемпотентен: перед заливкой удаляет существующие `step_completed` события
для каждого обрабатываемого telegram_id, чтобы не было дублей при повторном
запуске.
"""
import argparse
import asyncio
from datetime import datetime

from sqlalchemy import delete, select

from app.content.loader import load_steps
from app.db.models import JourneyEvent, User, UserState
from app.db.session import AsyncSessionLocal


def _short_id(step_id: str, aspect: str | None, level: int | None) -> str:
    s = step_id
    aspect_lower = (aspect or "").lower()
    if aspect_lower and s.startswith(f"{aspect_lower}-"):
        s = s[len(aspect_lower) + 1:]
    level_prefix = f"L{level}-"
    if level is not None and s.startswith(level_prefix):
        s = s[len(level_prefix):]
    return s


async def _backfill_user(session, telegram_id: int, dry_run: bool) -> int:
    """Возвращает число записанных (или планируемых) событий."""
    state = await session.get(UserState, telegram_id)
    if not state or not state.current_step_id:
        return 0

    steps = load_steps()
    current = next((s for s in steps if s.id == state.current_step_id), None)
    if not current:
        print(f"  [!] tg={telegram_id}: current_step_id={state.current_step_id} не найден в compiled.json")
        return 0

    # Все шаги с меньшим ord — пройдены. Сам current не помечаем (юзер на нём).
    completed = [s for s in steps if s.ord < current.ord]
    if not completed:
        return 0

    if dry_run:
        return len(completed)

    # Idempotency: убираем прошлые backfill-события (если перезапускаем скрипт).
    await session.execute(
        delete(JourneyEvent).where(
            JourneyEvent.telegram_id == telegram_id,
            JourneyEvent.source == "bot",
            JourneyEvent.type == "step_completed",
        )
    )

    now = datetime.utcnow()
    for s in completed:
        session.add(JourneyEvent(
            telegram_id=telegram_id,
            source="bot",
            type="step_completed",
            aspect=s.aspect,
            level=s.level,
            short_id=_short_id(s.id, s.aspect, s.level),
            step_id=s.id,
            payload={"kind": s.kind, "title": s.title, "backfilled": True},
            created_at=now,
        ))
    await session.commit()
    return len(completed)


async def main(telegram_id: int | None, dry_run: bool) -> None:
    async with AsyncSessionLocal() as session:
        if telegram_id is not None:
            users = [await session.get(User, telegram_id)]
            users = [u for u in users if u]
        else:
            users = (await session.execute(select(User))).scalars().all()

        print(f"=== backfill: {len(users)} юзера(ей) {'(dry-run)' if dry_run else ''} ===")
        total = 0
        for u in users:
            n = await _backfill_user(session, u.id, dry_run)
            if n:
                print(f"  tg={u.id} ({u.username or '—'}): {n} step_completed")
                total += n
        print(f"=== итого: {total} событий ===")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--telegram-id", type=int, default=None, help="Только для этого TG-id.")
    p.add_argument("--dry-run", action="store_true", help="Не писать в БД, только показать план.")
    args = p.parse_args()
    asyncio.run(main(args.telegram_id, args.dry_run))
