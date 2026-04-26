import subprocess
import sys

from sqlalchemy import delete, update
from telegram import Update
from telegram.ext import ContextTypes

from app.content import loader
from app.db.models import Answer, DiaryEntry, UserState
from app.db.session import AsyncSessionLocal

ADMIN_ID = 54394403


async def cmd_reload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_user.id != ADMIN_ID:
        return

    await update.message.reply_text("Обновляю контент...")
    try:
        subprocess.run([sys.executable, "-m", "app.content.build"], check=True)
        subprocess.run([sys.executable, "-m", "app.content.seed"], check=True)
        loader._cache = None
        await update.message.reply_text("Готово. Контент обновлён.")
    except subprocess.CalledProcessError as e:
        await update.message.reply_text(f"Ошибка: {e}")


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_user.id != ADMIN_ID:
        return

    user_id = update.effective_user.id
    async with AsyncSessionLocal() as session:
        await session.execute(delete(Answer).where(Answer.user_id == user_id))
        await session.execute(delete(DiaryEntry).where(DiaryEntry.user_id == user_id))
        await session.execute(
            update(UserState).where(UserState.user_id == user_id).values(current_step_id=None)
        )
        await session.commit()

    await update.message.reply_text("Прогресс сброшен. Напиши /go чтобы начать заново.")
