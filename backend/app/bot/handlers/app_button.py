"""Команда /app — показывает кнопку запуска Mini App.

Существующий /start идёт через ConversationHandler с онбордингом —
его не трогаем. Эта команда параллельна: юзер может в любой момент
открыть веб-приложение, не выходя из бот-диалога.

Menu button (рядом с полем ввода) настраивается в BotFather и тоже
ведёт в Mini App — это основной путь. /app — фоллбэк для юзеров,
которые не видят menu button (старые клиенты, кастомные темы).
"""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes

# URL gh-pages билда. Должен совпадать с тем, что зарегистрирован в BotFather
# как Mini App URL.
WEBAPP_URL = "https://sergeshaneri.github.io/slw/"


async def cmd_app(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Прислать кнопку «Открыть SLW» с web_app=WebAppInfo."""
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton(
            "🌟 Открыть SLW",
            web_app=WebAppInfo(url=WEBAPP_URL),
        )
    ]])
    msg = update.effective_message
    if msg:
        await msg.reply_text(
            "Открой приложение — путешествие по 8 аспектам, дневник, коуч.",
            reply_markup=kb,
        )
