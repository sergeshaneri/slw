import re
from datetime import datetime

from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.bot.fsm import IN_SCRIPT, WAITING_EXERCISE_ACK, WAITING_OPEN_ANSWER, WAITING_SCORE, WAITING_THEORY_NOTE
from app.content.loader import Step, first_step, get_step, next_step
from app.db.models import Answer, DiaryEntry, UserState
from app.db.session import AsyncSessionLocal
from app.bot.handlers.start import MAIN_KEYBOARD

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


def _btn(label: str, data: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton(label, callback_data=data)]])


def _btn_with_note(label: str, data: str, step_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(label, callback_data=data)],
        [InlineKeyboardButton("Записать заметку ✏️", callback_data=f"note_btn:{step_id}")],
    ])


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
        label = step.button or "Далее ▶"
        if step.kind == "complete":
            await msg.reply_text(header + body)
            return IN_SCRIPT
        if step.kind in ("theory", "word"):
            markup = _btn_with_note(label, f"next:{step.id}", step.id)
        else:
            markup = _btn(label, f"next:{step.id}")
        await msg.reply_text(header + body, reply_markup=markup)
        return IN_SCRIPT

    elif step.kind in QUESTION_KINDS:
        await msg.reply_text(header + body)
        await msg.reply_text("Введи число от 1 до 10:", reply_markup=MAIN_KEYBOARD)
        return WAITING_SCORE

    elif step.kind in EXERCISE_KINDS:
        markup = _btn("Выполнил ✓", f"ack:{step.id}")
        await msg.reply_text(header + body, reply_markup=markup)
        return WAITING_EXERCISE_ACK

    elif step.kind in REFLECTION_KINDS:
        await msg.reply_text(header + body)
        await msg.reply_text("Напиши свои мысли:", reply_markup=MAIN_KEYBOARD)
        return WAITING_OPEN_ANSWER

    return IN_SCRIPT


async def cmd_go(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    step = get_step(state.current_step_id) if state and state.current_step_id else first_step()
    await update.message.reply_text("Поехали!")
    return await show_step(update, context, step)


async def cmd_resume(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    if not state or not state.current_step_id:
        await update.message.reply_text("Ты ещё не начал. Напиши /go.")
        return IN_SCRIPT
    step = get_step(state.current_step_id)
    if not step:
        await update.message.reply_text("Напиши /go чтобы начать.")
        return IN_SCRIPT
    return await show_step(update, context, step)


async def on_next_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    current_id = query.data.split(":", 1)[1]
    await query.edit_message_reply_markup(reply_markup=None)

    nxt = next_step(current_id)
    if nxt is None:
        await query.message.reply_text("Путешествие завершено!")
        return IN_SCRIPT
    return await show_step(update, context, nxt)


async def on_ack_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    current_id = query.data.split(":", 1)[1]
    await _save_answer(query.from_user.id, current_id, "exercise_ack", text="ack")
    await query.edit_message_reply_markup(reply_markup=None)
    await query.message.reply_text("Записал!", reply_markup=MAIN_KEYBOARD)

    nxt = next_step(current_id)
    if nxt is None:
        await query.message.reply_text("Путешествие завершено!")
        return IN_SCRIPT
    return await show_step(update, context, nxt)


async def on_open_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    state = await _get_state(update.effective_user.id)
    step_id = state.current_step_id if state else None
    if step_id:
        await _save_answer(update.effective_user.id, step_id, "reflection", text=update.message.text)
    await update.message.reply_text("Записал.", reply_markup=MAIN_KEYBOARD)

    nxt = next_step(step_id) if step_id else None
    if nxt is None:
        await update.message.reply_text("Путешествие завершено!")
        return IN_SCRIPT
    return await show_step(update, context, nxt)


async def on_score_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    try:
        val = int(text)
        if not 1 <= val <= 10:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введи число от 1 до 10.")
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

    nxt = next_step(step_id) if step_id else None
    if nxt is None:
        await update.message.reply_text("Путешествие завершено!")
        return IN_SCRIPT
    return await show_step(update, context, nxt)


async def on_continue_in_score(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Введи число от 1 до 10, чтобы продолжить.")
    return WAITING_SCORE


async def on_continue_in_open(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Напиши свои мысли, чтобы продолжить.")
    return WAITING_OPEN_ANSWER


async def on_note_btn(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    step_id = query.data.split(":", 1)[1]
    context.user_data["pending_note_step_id"] = step_id
    await query.message.reply_text("Напиши свою заметку к этому разделу:")
    return WAITING_THEORY_NOTE


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
    await update.message.reply_text("Заметка сохранена.", reply_markup=MAIN_KEYBOARD)
    return IN_SCRIPT
