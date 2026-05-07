import re
from datetime import datetime

from sqlalchemy import select
from telegram import Update
from telegram.ext import ContextTypes

from app.bot.fsm import IN_SCRIPT, WAITING_OPEN_ANSWER, WAITING_SCORE, WAITING_THEORY_NOTE
from app.bot.handlers.events import emit_step_completed
from app.content.loader import (
    Step, aspect_of_step, first_step_for_aspect, get_step, next_step_for_aspect,
)
from app.db.models import Answer, DiaryEntry, UserAspectState, UserState
from app.db.session import AsyncSessionLocal
from app.bot.handlers.start import (
    MAIN_KEYBOARD, NEXT_KEYBOARD, NEXT_INSIGHT_KEYBOARD,
    ACK_KEYBOARD, SCORE_KEYBOARD, REFLECTION_KEYBOARD,
    show_aspect_picker,
)


async def _mark_completed(user_id: int, step_id: str | None) -> None:
    """Перед переходом на следующий шаг — материализуем "прошлый шаг пройден"
    в общем event-логе. emit_step_completed внутри глотает все ошибки."""
    if not step_id:
        return
    step = get_step(step_id)
    if step:
        await emit_step_completed(user_id, step)

TG_MAX = 4000

INFO_KINDS = {"onboarding", "intro", "theory", "word", "complete"}
QUESTION_KINDS = {"question"}
EXERCISE_KINDS = {"exercise"}
REFLECTION_KINDS = {"reflection"}


def _strip_md(text: str) -> str:
    text = re.sub(r"^#[^\n]*\n?", "", text, count=1)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*+", "", text)
    text = re.sub(r"_{1,2}(.+?)_{1,2}", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"`+(.+?)`+", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"^[-]{3,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _trim(text: str) -> str:
    text = _strip_md(text)
    if len(text) <= TG_MAX:
        return text
    return text[:TG_MAX] + "\n\n(текст обрезан)"


async def _get_state(user_id: int) -> UserState | None:
    async with AsyncSessionLocal() as session:
        return await session.get(UserState, user_id)


async def _save_state(user_id: int, step_id: str) -> None:
    """Записать текущий шаг в обе таблицы:
      - user_state.current_step_id + last_active_at (легаси-кеш для текущего аспекта)
      - user_aspect_state[(user, step.aspect)] (source of truth)
    """
    step = get_step(step_id)
    if not step:
        return
    now = datetime.utcnow()
    async with AsyncSessionLocal() as session:
        # user_state — кеш + last_active глобально.
        state = await session.get(UserState, user_id)
        if state is None:
            state = UserState(user_id=user_id)
            session.add(state)
        state.current_aspect = step.aspect
        state.current_level = step.level
        state.current_step_id = step_id
        state.last_active_at = now

        # user_aspect_state — per-aspect папка.
        aspect_state = await session.get(UserAspectState, (user_id, step.aspect))
        if aspect_state is None:
            aspect_state = UserAspectState(telegram_id=user_id, aspect=step.aspect)
            session.add(aspect_state)
        aspect_state.current_step_id = step_id
        aspect_state.last_active_at = now
        # Юзер вернулся к шагу в аспекте, который мы ранее пометили как
        # finished — снимаем флаг (например, после контент-апдейта).
        aspect_state.finished = False

        await session.commit()


async def _mark_aspect_finished(user_id: int, aspect: str) -> None:
    """Отметить аспект завершённым (next_step_for_aspect вернул None)."""
    async with AsyncSessionLocal() as session:
        aspect_state = await session.get(UserAspectState, (user_id, aspect))
        if aspect_state is None:
            aspect_state = UserAspectState(telegram_id=user_id, aspect=aspect)
            session.add(aspect_state)
        aspect_state.finished = True
        aspect_state.last_active_at = datetime.utcnow()
        await session.commit()


async def _save_answer(user_id: int, step_id: str, kind: str,
                       text: str | None = None, value_num: float | None = None) -> None:
    async with AsyncSessionLocal() as session:
        session.add(Answer(
            user_id=user_id, step_id=step_id, kind=kind,
            text=text, value_num=value_num,
        ))
        await session.commit()


async def show_step(update: Update, context: ContextTypes.DEFAULT_TYPE, step: Step) -> int:
    msg = update.effective_message
    await _save_state(update.effective_user.id, step.id)

    body = _trim(step.body_md)
    header = f"{step.title}\n\n" if step.title and step.kind not in ("intro", "onboarding") else ""

    if step.kind in INFO_KINDS:
        if step.kind == "complete":
            await msg.reply_text(header + body, reply_markup=MAIN_KEYBOARD)
            return IN_SCRIPT
        if step.kind in ("theory", "word"):
            await msg.reply_text(header + body, reply_markup=NEXT_INSIGHT_KEYBOARD)
        else:
            await msg.reply_text(header + body, reply_markup=NEXT_KEYBOARD)
        return IN_SCRIPT

    elif step.kind in QUESTION_KINDS:
        await msg.reply_text(header + body)
        await msg.reply_text("Введи число от 1 до 10:", reply_markup=SCORE_KEYBOARD)
        return WAITING_SCORE

    elif step.kind in EXERCISE_KINDS:
        await msg.reply_text(header + body, reply_markup=ACK_KEYBOARD)
        return IN_SCRIPT

    elif step.kind in REFLECTION_KINDS:
        await msg.reply_text(header + body)
        await msg.reply_text("Напиши свои мысли:", reply_markup=REFLECTION_KEYBOARD)
        return WAITING_OPEN_ANSWER

    return IN_SCRIPT


async def _advance(update: Update, context: ContextTypes.DEFAULT_TYPE,
                   step_id: str | None) -> int:
    """Продвинуть юзера к следующему шагу в его текущем аспекте.

    Конец «аспекта»:
      • onboarding — помечаем finished и сразу показываем пикер планет.
      • реальный аспект — помечаем finished и пишем «пройден полностью!».
    """
    user_id = update.effective_user.id
    aspect = aspect_of_step(step_id) if step_id else None
    if not aspect:
        # Без аспекта дальше не двинемся — отдадим пикер.
        await show_aspect_picker(update, context)
        return IN_SCRIPT
    nxt = next_step_for_aspect(aspect, step_id)
    if nxt is None:
        await _mark_aspect_finished(user_id, aspect)
        if aspect == "onboarding":
            await update.message.reply_text(
                "Теперь выбери, с какой планеты начать путешествие.",
                reply_markup=MAIN_KEYBOARD,
            )
            await show_aspect_picker(update, context)
        else:
            await update.message.reply_text(
                f"Планета «{aspect}» пройдена полностью!\n\n"
                "Можешь выбрать другую через /aspect.",
                reply_markup=MAIN_KEYBOARD,
            )
        return IN_SCRIPT
    return await show_step(update, context, nxt)


async def cmd_go(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Старт/продолжение в текущем аспекте. Если аспекта нет — пикер."""
    user_id = update.effective_user.id
    state = await _get_state(user_id)
    aspect = state.current_aspect if state else None
    if not aspect:
        await show_aspect_picker(update, context)
        return IN_SCRIPT

    # Берём папку аспекта; если её ещё нет — стартуем с первого шага.
    async with AsyncSessionLocal() as session:
        aspect_state = await session.get(UserAspectState, (user_id, aspect))
    step = None
    if aspect_state and aspect_state.current_step_id:
        step = get_step(aspect_state.current_step_id)
    if step is None:
        step = first_step_for_aspect(aspect)
    if step is None:
        # Аспекта нет в контенте (юзер выбрал что-то странное) — пикер.
        await show_aspect_picker(update, context)
        return IN_SCRIPT

    await update.message.reply_text("Поехали!")
    return await show_step(update, context, step)


async def cmd_resume(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """То же что /go, но без 'Поехали!' — для кнопки 'Продолжить'."""
    user_id = update.effective_user.id
    state = await _get_state(user_id)
    aspect = state.current_aspect if state else None
    if not aspect:
        await show_aspect_picker(update, context)
        return IN_SCRIPT
    async with AsyncSessionLocal() as session:
        aspect_state = await session.get(UserAspectState, (user_id, aspect))
    step = None
    if aspect_state and aspect_state.current_step_id:
        step = get_step(aspect_state.current_step_id)
    if step is None:
        step = first_step_for_aspect(aspect)
    if step is None:
        await show_aspect_picker(update, context)
        return IN_SCRIPT
    return await show_step(update, context, step)


async def on_next_keyboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    step_id = state.current_step_id if state else None
    await _mark_completed(update.effective_user.id, step_id)
    return await _advance(update, context, step_id)


async def on_ack_keyboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    step_id = state.current_step_id if state else None
    if step_id:
        await _save_answer(update.effective_user.id, step_id, "exercise_ack", text="ack")
    await _mark_completed(update.effective_user.id, step_id)
    await update.message.reply_text("Записал!", reply_markup=MAIN_KEYBOARD)
    return await _advance(update, context, step_id)


async def on_insight_keyboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    context.user_data["pending_note_step_id"] = state.current_step_id if state else None
    await update.message.reply_text("Напиши свой инсайт:", reply_markup=REFLECTION_KEYBOARD)
    return WAITING_THEORY_NOTE


async def on_open_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    step_id = state.current_step_id if state else None
    if step_id:
        await _save_answer(update.effective_user.id, step_id, "reflection", text=update.message.text)
    await _mark_completed(update.effective_user.id, step_id)
    await update.message.reply_text("Записал.", reply_markup=MAIN_KEYBOARD)
    return await _advance(update, context, step_id)


async def on_score_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    try:
        val = int(text)
        if not 1 <= val <= 10:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введи число от 1 до 10.", reply_markup=SCORE_KEYBOARD)
        return WAITING_SCORE

    state = await _get_state(update.effective_user.id)
    step_id = state.current_step_id if state else None
    if step_id:
        await _save_answer(update.effective_user.id, step_id, "question", value_num=val)
        step = get_step(step_id)
        if step:
            fu_text = step.get_follow_up_text(val)
            if fu_text:
                await update.message.reply_text(_strip_md(fu_text))
    await _mark_completed(update.effective_user.id, step_id)
    return await _advance(update, context, step_id)


async def on_theory_note(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    step_id = context.user_data.pop("pending_note_step_id", None)
    async with AsyncSessionLocal() as session:
        session.add(DiaryEntry(
            user_id=update.effective_user.id,
            text=update.message.text,
            source="theory",
            step_id=step_id,
        ))
        await session.commit()
    await update.message.reply_text("Инсайт сохранён.", reply_markup=MAIN_KEYBOARD)
    return IN_SCRIPT
