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

from app.bot.fsm import IN_SCRIPT, WAITING_OPEN_ANSWER, WAITING_SCORE, WAITING_THEORY_NOTE
from app.bot.handlers.admin import cmd_reload, cmd_reset
from app.bot.handlers.aspect import cmd_aspect, on_aspect_pick
from app.bot.handlers.note import cmd_note
from app.bot.handlers.profile import cmd_profile, on_profile_resume
from app.bot.handlers.progress import cmd_progress
from app.bot.handlers.script import (
    cmd_go,
    cmd_resume,
    on_ack_keyboard,
    on_insight_keyboard,
    on_next_keyboard,
    on_open_answer,
    on_score_answer,
    on_theory_note,
)
from app.bot.handlers.start import cmd_start

from app.config import settings

logging.basicConfig(level=logging.INFO)
# Глушим INFO-спам от httpx (каждый getUpdates бота → строка лога ~раз
# в 5 сек) и telegram-stack-а. WARNING/ERROR сквозь себя пропускают.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("telegram.ext.Updater").setLevel(logging.WARNING)
log = logging.getLogger(__name__)

BTN_PROFILE  = filters.Regex(r"^Профиль$")
BTN_CONTINUE = filters.Regex(r"^Продолжить$")
BTN_NEXT     = filters.Regex(r"^Далее ▶$")
BTN_ACK      = filters.Regex(r"^Выполнил ✓$")
BTN_INSIGHT  = filters.Regex(r"^Записать инсайт$")

# все кнопки нижней клавиатуры — исключаем из text-хендлеров
BTN_ANY = BTN_PROFILE | BTN_CONTINUE | BTN_NEXT | BTN_ACK | BTN_INSIGHT | \
          filters.Regex(r"^(Ввести оценку|Написать ответ)$")


def build() -> "Application":
    """Build and return the configured Application (without starting polling)."""
    app = ApplicationBuilder().token(settings.bot_token).build()

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
            CommandHandler("aspect", cmd_aspect),
            MessageHandler(BTN_CONTINUE & ~filters.COMMAND, cmd_resume),
            CallbackQueryHandler(on_aspect_pick, pattern=r"^aspect:"),
        ],
        states={
            IN_SCRIPT: [
                MessageHandler(BTN_NEXT & ~filters.COMMAND, on_next_keyboard),
                MessageHandler(BTN_ACK & ~filters.COMMAND, on_ack_keyboard),
                MessageHandler(BTN_INSIGHT & ~filters.COMMAND, on_insight_keyboard),
            ],
            WAITING_OPEN_ANSWER: [
                MessageHandler(filters.TEXT & ~filters.COMMAND & ~BTN_ANY, on_open_answer),
            ],
            WAITING_SCORE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND & ~BTN_ANY, on_score_answer),
            ],
            WAITING_THEORY_NOTE: [
                MessageHandler(BTN_CONTINUE & ~filters.COMMAND, cmd_resume),
                MessageHandler(filters.TEXT & ~filters.COMMAND & ~BTN_ANY, on_theory_note),
            ],
        },
        fallbacks=[
            # /go и /resume — также fallback, чтобы юзер мог рестартануть
            # из любого состояния (например, после /reset, который чистит
            # БД но не FSM-состояние диалога).
            CommandHandler("go", cmd_go),
            CommandHandler("resume", cmd_resume),
            CommandHandler("start", cmd_start),
            CommandHandler("note", cmd_note),
            CommandHandler("profile", cmd_profile),
            CommandHandler("aspect", cmd_aspect),
            MessageHandler(BTN_PROFILE & ~filters.COMMAND, cmd_profile),
            MessageHandler(BTN_CONTINUE & ~filters.COMMAND, cmd_resume),
            CallbackQueryHandler(on_aspect_pick, pattern=r"^aspect:"),
        ],
        per_chat=False,
        per_user=True,
        per_message=False,
    )
    app.add_handler(script_conv)
    return app


def run() -> None:
    """Standalone entry point (used when running bot without web server)."""
    build().run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    run()
