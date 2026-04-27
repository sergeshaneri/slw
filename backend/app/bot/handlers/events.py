"""
Sync layer: bot ↔ web через journey_events.

Web хранит ID шагов в коротком формате (`T-1`, `B-1`, `intro-1`), bot — в полном
(`бс-L0-T-1`, `бс-intro-1`, `onboarding-intro-1`). Конверсия short ↔ full
делается через `short_id_for(step)` и таблицу `(aspect, level, short_id) → step`.
"""
from datetime import datetime

from sqlalchemy import select

from app.content.loader import Step, get_step, load_steps
from app.db.models import JourneyEvent, UserState
from app.db.session import AsyncSessionLocal


def short_id_for(step: Step) -> str:
    """`бс-L0-T-1` → `T-1`; `бс-intro-1` → `intro-1`; `onboarding-intro-1` → `intro-1`."""
    s = step.id
    aspect_lower = (step.aspect or "").lower()
    if aspect_lower and s.startswith(f"{aspect_lower}-"):
        s = s[len(aspect_lower) + 1:]
    level_prefix = f"L{step.level}-"
    if s.startswith(level_prefix):
        s = s[len(level_prefix):]
    return s


def _step_by_short(aspect: str | None, level: int | None, short_id: str | None) -> Step | None:
    """Обратное соответствие: ищем шаг в compiled.json по (aspect, level, short_id).
    Используется ботом для resolve web-events и POST-роутом для resolve full step_id."""
    if not aspect or short_id is None:
        return None
    for s in load_steps():
        if s.aspect == aspect and s.level == level and short_id_for(s) == short_id:
            return s
    return None


async def emit_step_completed(telegram_id: int, step: Step) -> None:
    """Юзер прошёл `step` в TG-боте (нажал «Далее», ответил, etc.).
    Web подтянет это и обновит свой completedScripts при ближайшей загрузке."""
    async with AsyncSessionLocal() as session:
        session.add(JourneyEvent(
            telegram_id=telegram_id,
            source="bot",
            type="step_completed",
            aspect=step.aspect,
            level=step.level,
            short_id=short_id_for(step),
            step_id=step.id,
            payload={"kind": step.kind, "title": step.title},
        ))
        await session.commit()


async def pull_web_progress(telegram_id: int) -> str | None:
    """Перед стартом TG-сценария (cmd_go/cmd_resume) проверяем, не ушёл ли
    юзер вперёд в web. Если да — двигаем `user_state.current_step_id` на
    шаг, следующий за самым поздним web-`step_completed`. Возвращает новый
    step_id или None, если ничего не изменилось.

    Работает в одну сторону: web → bot. Bot → web живёт через emit_step_completed."""
    async with AsyncSessionLocal() as session:
        events = (await session.execute(
            select(JourneyEvent).where(
                JourneyEvent.telegram_id == telegram_id,
                JourneyEvent.source == "web",
                JourneyEvent.type == "step_completed",
            )
        )).scalars().all()
        if not events:
            return None

        steps = load_steps()
        # Самый поздний (по ord) web-completed step
        max_ord = -1
        for ev in events:
            target = _step_by_short(ev.aspect, ev.level, ev.short_id)
            if target and target.ord > max_ord:
                max_ord = target.ord
        if max_ord < 0:
            return None

        state = await session.get(UserState, telegram_id)
        current_ord = -1
        if state and state.current_step_id:
            current = get_step(state.current_step_id)
            if current:
                current_ord = current.ord

        if max_ord <= current_ord:
            return None  # бот уже на том же шаге или впереди

        next_after = next((s for s in steps if s.ord > max_ord), None)
        if not next_after:
            return None

        if not state:
            state = UserState(user_id=telegram_id)
            session.add(state)
        state.current_step_id = next_after.id
        state.last_active_at = datetime.utcnow()
        await session.commit()
        return next_after.id
