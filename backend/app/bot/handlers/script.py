import re
from datetime import datetime

from sqlalchemy import select
from telegram import Update
from telegram.ext import ContextTypes

from app.bot.fsm import IN_SCRIPT, WAITING_OPEN_ANSWER, WAITING_SCORE, WAITING_THEORY_NOTE
from app.bot.handlers.events import emit_step_completed, pull_web_progress
from app.content.loader import Step, first_step, get_step, next_step
from app.db.models import Answer, DiaryEntry, UserState
from app.db.session import AsyncSessionLocal
from app.bot.handlers.start import (
    MAIN_KEYBOARD, NEXT_KEYBOARD, NEXT_INSIGHT_KEYBOARD,
    ACK_KEYBOARD, SCORE_KEYBOARD, REFLECTION_KEYBOARD,
)


async def _mark_completed(user_id: int, step_id: str | None) -> None:
    """Перед переходом на следующий шаг помечаем текущий пройденным
    в общем event-логе. Web подтянет это в свой completedScripts."""
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
    async with AsyncSessionLocal() as session:
        state = await session.get(UserState, user_id)
        if state is None:
            state = UserState(user_id=user_id)
            session.add(state)
        state.current_step_id = step_id
        state.last_active_at = datetime.utcnow()
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


async def cmd_go(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # Если юзер ушёл вперёд в web — подтягиваем его прогресс перед стартом,
    # чтобы бот не показывал шаг, который web уже отметил пройденным.
    await pull_web_progress(update.effective_user.id)
    state = await _get_state(update.effective_user.id)
    step = get_step(state.current_step_id) if state and state.current_step_id else first_step()
    await update.message.reply_text("Поехали!")
    return await show_step(update, context, step)


async def cmd_resume(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await pull_web_progress(update.effective_user.id)
    state = await _get_state(update.effective_user.id)
    if not state or not state.current_step_id:
        return await cmd_go(update, context)
    step = get_step(state.current_step_id)
    if not step:
        return await cmd_go(update, context)
    return await show_step(update, context, step)


async def on_next_keyboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    step_id = state.current_step_id if state else None
    await _mark_completed(update.effective_user.id, step_id)
    nxt = next_step(step_id) if step_id else None
    if nxt is None:
        await update.message.reply_text("Путешествие завершено!", reply_markup=MAIN_KEYBOARD)
        return IN_SCRIPT
    return await show_step(update, context, nxt)


async def on_ack_keyboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    step_id = state.current_step_id if state else None
    if step_id:
        await _save_answer(update.effective_user.id, step_id, "exercise_ack", text="ack")
    await _mark_completed(update.effective_user.id, step_id)
    await update.message.reply_text("Записал!", reply_markup=MAIN_KEYBOARD)
    nxt = next_step(step_id) if step_id else None
    if nxt is None:
        await update.message.reply_text("Путешествие завершено!", reply_markup=MAIN_KEYBOARD)
        return IN_SCRIPT
    return await show_step(update, context, nxt)


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

    nxt = next_step(step_id) if step_id else None
    if nxt is None:
        await update.message.reply_text("Путешествие завершено!", reply_markup=MAIN_KEYBOARD)
        return IN_SCRIPT
    return await show_step(update, context, nxt)


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

    nxt = next_step(step_id) if step_id else None
    if nxt is None:
        await update.message.reply_text("Путешествие завершено!", reply_markup=MAIN_KEYBOARD)
        return IN_SCRIPT
    return await show_step(update, context, nxt)


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
