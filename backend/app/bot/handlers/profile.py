from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.bot.handlers.start import ASPECT_TAGLINES, show_aspect_picker
from app.content.loader import load_steps
from app.db.models import Answer, DiaryEntry, UserState
from app.db.session import AsyncSessionLocal


async def cmd_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    async with AsyncSessionLocal() as session:
        state = await session.get(UserState, user_id)

        answers = (await session.execute(
            select(Answer).where(Answer.user_id == user_id).order_by(Answer.created_at)
        )).scalars().all()

        diary = (await session.execute(
            select(DiaryEntry).where(DiaryEntry.user_id == user_id)
            .order_by(DiaryEntry.created_at.desc()).limit(3)
        )).scalars().all()

    total = len(load_steps())
    done = len({a.step_id for a in answers})
    pct = int(done / total * 100) if total else 0

    lines = ["Профиль"]
    current_aspect = state.current_aspect if state else None
    if current_aspect and current_aspect != "onboarding":
        tagline = ASPECT_TAGLINES.get(current_aspect, "")
        suffix = f" — {tagline}" if tagline else ""
        lines.append(f"\nТекущая планета: {current_aspect}{suffix}")
    lines.append(f"\nПрогресс: {done}/{total} шагов ({pct}%)")

    scores = [(a.step_id, a.value_num) for a in answers if a.kind == "question" and a.value_num is not None]
    if scores:
        lines.append("\nОценки:")
        for step_id, val in scores:
            lines.append(f"  {step_id.split('-')[-1]}: {int(val)}/10")

    reflections = [a for a in answers if a.kind == "reflection" and a.text]
    if reflections:
        lines.append("\nПоследние рефлексии:")
        for a in reflections[-3:]:
            short = a.text[:120] + "…" if len(a.text) > 120 else a.text
            lines.append(f"  • {short}")

    theory_notes = [e for e in diary if e.source == "theory"]
    regular_diary = [e for e in diary if e.source != "theory"]

    if theory_notes:
        lines.append("\nЗаметки к теории:")
        for e in theory_notes:
            short = e.text[:120] + "…" if len(e.text) > 120 else e.text
            label = f" [{e.step_id}]" if e.step_id else ""
            lines.append(f"  • {short}{label}")

    if regular_diary:
        lines.append("\nДневник:")
        for e in regular_diary:
            short = e.text[:120] + "…" if len(e.text) > 120 else e.text
            lines.append(f"  • {short}")

    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("▶ Продолжить путешествие", callback_data="profile:resume")],
        [InlineKeyboardButton("🪐 Сменить планету", callback_data="profile:switch_aspect")],
        [InlineKeyboardButton("🌐 Открыть на сайте", url="https://sergeshaneri.github.io/slw/")],
    ])

    await update.message.reply_text("\n".join(lines), reply_markup=markup)


async def on_profile_resume(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    await query.edit_message_reply_markup(reply_markup=None)
    await query.message.reply_text("Продолжаем! Напиши /resume")


async def on_profile_switch_aspect(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Кнопка «🪐 Сменить планету» в профиле — отдаёт пикер планет.
    Тот же UX что и /aspect, но кликом из профиля.
    """
    query = update.callback_query
    await query.answer()
    await query.edit_message_reply_markup(reply_markup=None)
    await show_aspect_picker(update, context)
