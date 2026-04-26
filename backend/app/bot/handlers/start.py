from datetime import datetime

from sqlalchemy import select
from telegram import Update
from telegram.ext import ContextTypes

from app.db.models import User, UserState
from app.db.session import AsyncSessionLocal


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
            if state:
                state.last_active_at = datetime.utcnow()

        await session.commit()

    name = tg_user.first_name or "друг"
    await update.message.reply_text(
        f"Привет, {name}! 👋\n\n"
        "Я SLW-коуч — помогу тебе исследовать Соционическое Колесо Баланса.\n\n"
        "Начнём с Белой Сенсорики (БС) — Уровень 0.\n"
        "Готов? Напиши /go чтобы начать."
    )
