import logging

from telegram.ext import ApplicationBuilder, CommandHandler

from app.bot.handlers.note import cmd_note
from app.bot.handlers.progress import cmd_progress
from app.bot.handlers.start import cmd_start
from app.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def run() -> None:
    app = ApplicationBuilder().token(settings.bot_token).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("note", cmd_note))
    app.add_handler(CommandHandler("progress", cmd_progress))

    log.info("Bot started")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    run()
