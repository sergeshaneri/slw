from datetime import datetime

from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.content.loader import available_aspects
from app.db.models import User, UserAspectState, UserState
from app.db.session import AsyncSessionLocal

def _kb(*buttons):
    return ReplyKeyboardMarkup([list(buttons)], resize_keyboard=True, one_time_keyboard=False)

MAIN_KEYBOARD         = _kb("Продолжить", "Профиль")
NEXT_KEYBOARD         = _kb("Далее ▶", "Профиль")
NEXT_INSIGHT_KEYBOARD = _kb("Далее ▶", "Записать инсайт", "Профиль")
ACK_KEYBOARD          = _kb("Выполнил ✓", "Профиль")
SCORE_KEYBOARD        = _kb("Ввести оценку", "Профиль")
REFLECTION_KEYBOARD   = _kb("Написать ответ", "Профиль")


async def show_aspect_picker(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать inline-клавиатуру с доступными аспектами.

    Текущий аспект юзера помечен ✓, завершённые — 🏆.
    Аспекты берутся из compiled-контента (только те, у которых есть шаги).
    """
    user_id = update.effective_user.id
    aspects = available_aspects()

    if not aspects:
        msg = update.effective_message
        if msg:
            await msg.reply_text("Контент путешествия пока не собран.", reply_markup=MAIN_KEYBOARD)
        return

    async with AsyncSessionLocal() as session:
        state = await session.get(UserState, user_id)
        current_aspect = state.current_aspect if state else None
        rows = (
            await session.execute(
                select(UserAspectState).where(UserAspectState.telegram_id == user_id)
            )
        ).scalars().all()
    finished_set = {r.aspect for r in rows if r.finished}
    started_set = {r.aspect for r in rows if r.current_step_id}

    buttons = []
    for asp in aspects:
        marker = ""
        if asp in finished_set:
            marker = "🏆 "
        elif asp == current_aspect:
            marker = "✓ "
        elif asp in started_set:
            marker = "· "
        buttons.append([InlineKeyboardButton(f"{marker}{asp}", callback_data=f"aspect:{asp}")])

    text = "Выбери аспект:"
    if current_aspect:
        text = (
            "Текущий аспект помечен ✓. Завершённые — 🏆, начатые — ·.\n"
            "Выбери, в какой аспект перейти:"
        )
    msg = update.effective_message
    if msg:
        await msg.reply_text(text, reply_markup=InlineKeyboardMarkup(buttons))


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await session.get(User, tg_user.id)
        is_new = user is None
        if is_new:
            user = User(
                id=tg_user.id,
                username=tg_user.username,
                first_name=tg_user.first_name,
                language_code=tg_user.language_code,
            )
            session.add(user)

            state = UserState(user_id=tg_user.id, last_active_at=datetime.utcnow())
            session.add(state)
        else:
            state = await session.get(UserState, tg_user.id)
            if state is None:
                state = UserState(user_id=tg_user.id, last_active_at=datetime.utcnow())
                session.add(state)
            else:
                state.last_active_at = datetime.utcnow()

        await session.commit()
        current_aspect = state.current_aspect

    name = tg_user.first_name or "друг"
    await update.message.reply_text(
        f"Привет, {name}!\n\n"
        "Я СКБ-коуч — помогу тебе исследовать Соционическое Колесо Баланса.\n\n"
        "В путешествии 8 аспектов — выбираешь любой и идёшь по нему. "
        "В любой момент можно сменить аспект через /aspect.",
        reply_markup=MAIN_KEYBOARD,
    )

    if not current_aspect:
        # Новый юзер или вернулся без выбранного аспекта — сразу пикер.
        await show_aspect_picker(update, context)
    else:
        await update.message.reply_text(
            f"Сейчас ты в аспекте «{current_aspect}». "
            "Жми «Продолжить» или /aspect чтобы переключиться.",
            reply_markup=MAIN_KEYBOARD,
        )
