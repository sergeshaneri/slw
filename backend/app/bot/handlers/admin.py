import subprocess
import sys

from telegram import Update
from telegram.ext import ContextTypes

from app.content import loader

ADMIN_ID = 54394403


async def cmd_reload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_user.id != ADMIN_ID:
        return

    await update.message.reply_text("Обновляю контент...")
    try:
        subprocess.run([sys.executable, "-m", "app.content.build"], check=True)
        subprocess.run([sys.executable, "-m", "app.content.seed"], check=True)
        loader._cache = None  # сбросить кеш
        await update.message.reply_text("Готово. Контент обновлён.")
    except subprocess.CalledProcessError as e:
        await update.message.reply_text(f"Ошибка: {e}")
