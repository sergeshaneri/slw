import asyncio
import logging

from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ConversationHandler,
    MessageHandler,
    filters,
)

from app.bot.fsm import IN_SCRIPT, WAITING_EXERCISE_ACK, WAITING_OPEN_ANSWER, WAITING_SCORE, WAITING_THEORY_NOTE
from app.bot.handlers.admin import cmd_reload, cmd_reset
from app.bot.handlers.note import cmd_note
from app.bot.handlers.profile import cmd_profile, on_profile_resume
from app.bot.handlers.progress import cmd_progress
from app.bot.handlers.script import (
    cmd_go,
    cmd_resume,
    on_ack_button,
    on_continue_in_open,
    on_continue_in_score,
    on_next_button,
    on_note_btn,
    on_open_answer,
    on_score_answer,
    on_theory_note,
)
from app.bot.handlers.start import cmd_start

from app.config import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# Reply-keyboard button text
BTN_PROFILE = filters.Regex(r"^Профиль$")
BTN_CONTINUE = filters.Regex(r"^Продолжить$")


def run() -> None:
    asyncio.set_event_loop(asyncio.new_event_loop())
    app = ApplicationBuilder().token(settings.bot_token).build()

    # Global handlers (outside conversation)
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("reload", cmd_reload))
    app.add_handler(CommandHandler("reset", cmd_reset))
    app.add_handler(CommandHandler("profile", cmd_profile))
    app.add_handler(CommandHandler("note", cmd_note))
    app.add_handler(CommandHandler("progress", cmd_progress))
    app.add_handler(CallbackQueryHandler(on_profile_resume, pattern=r"^profile:resume$"))
    app.add_handler(MessageHandler(BTN_PROFILE & ~filters.COMMAND, cmd_profile))

    script_conv = ConversationHandler(
        entry_points=[
            CommandHandler("go", cmd_go),
            CommandHandler("resume", cmd_resume),
            MessageHandler(BTN_CONTINUE & ~filters.COMMAND, cmd_resume),
        ],
        states={
            IN_SCRIPT: [
                CallbackQueryHandler(on_next_button, pattern=r"^next:"),
                CallbackQueryHandler(on_ack_button, pattern=r"^ack:"),
                CallbackQueryHandler(on_note_btn, pattern=r"^note_btn:"),
            ],
            WAITING_OPEN_ANSWER: [
                MessageHandler(BTN_CONTINUE & ~filters.COMMAND, on_continue_in_open),
                MessageHandler(filters.TEXT & ~filters.COMMAND & ~BTN_PROFILE & ~BTN_CONTINUE, on_open_answer),
            ],
            WAITING_EXERCISE_ACK: [
                CallbackQueryHandler(on_ack_button, pattern=r"^ack:"),
            ],
            WAITING_SCORE: [
                MessageHandler(BTN_CONTINUE & ~filters.COMMAND, on_continue_in_score),
                MessageHandler(filters.TEXT & ~filters.COMMAND & ~BTN_PROFILE & ~BTN_CONTINUE, on_score_answer),
            ],
            WAITING_THEORY_NOTE: [
                MessageHandler(BTN_CONTINUE & ~filters.COMMAND, cmd_resume),
                MessageHandler(filters.TEXT & ~filters.COMMAND & ~BTN_PROFILE & ~BTN_CONTINUE, on_theory_note),
            ],
        },
        fallbacks=[
            CommandHandler("start", cmd_start),
            CommandHandler("note", cmd_note),
            CommandHandler("profile", cmd_profile),
            MessageHandler(BTN_PROFILE & ~filters.COMMAND, cmd_profile),
            MessageHandler(BTN_CONTINUE & ~filters.COMMAND, cmd_resume),
        ],
        per_chat=False,
        per_user=True,
        per_message=False,
    )
    app.add_handler(script_conv)

    log.info("Bot started")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    run()
