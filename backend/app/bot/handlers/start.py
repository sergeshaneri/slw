from datetime import datetime

from sqlalchemy import select
from telegram import ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.db.models import User, UserState
from app.db.session import AsyncSessionLocal

def _kb(*buttons):
    return ReplyKeyboardMarkup([list(buttons)], resize_keyboard=True, one_time_keyboard=False)

MAIN_KEYBOARD         = _kb("Продолжить", "Профиль")
NEXT_KEYBOARD         = _kb("Далее ▶", "Профиль")
NEXT_INSIGHT_KEYBOARD = _kb("Далее ▶", "Записать инсайт", "Профиль")
ACK_KEYBOARD          = _kb("Выполнил ✓", "Профиль")
SCORE_KEYBOARD        = _kb("Ввести оценку", "Профиль")
REFLECTION_KEYBOARD   = _kb("Написать ответ", "Профиль")


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await session.get(User, tg_user.id)
        if user is None:
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

    name = tg_user.first_name or "друг"
    await update.message.reply_text(
        f"Привет, {name}!\n\n"
        "Я СКБ-коуч — помогу тебе исследовать Соционическое Колесо Баланса.\n\n"
        "Напиши /go чтобы начать путешествие.",
        reply_markup=MAIN_KEYBOARD,
    )
