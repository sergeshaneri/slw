from telegram import Update
from telegram.ext import ContextTypes

from app.db.models import DiaryEntry
from app.db.session import AsyncSessionLocal


async def cmd_note(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = " ".join(context.args) if context.args else ""
    if not text:
        await update.message.reply_text("Использование: /note <текст>")
        return

    async with AsyncSessionLocal() as session:
        entry = DiaryEntry(user_id=update.effective_user.id, text=text, source="bot")
        session.add(entry)
        await session.commit()

    await update.message.reply_text("Записал в дневник.")
