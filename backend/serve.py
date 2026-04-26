"""
Combined entry point: Telegram bot + FastAPI in one asyncio event loop.
Uvicorn listens on $PORT (Railway injects this).
"""
import asyncio
import logging
import os

import uvicorn
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.bot.main import build as build_bot
from app.config import settings
from app.web.main import app as web_app

log = logging.getLogger(__name__)


async def apply_ddl() -> None:
    """Add any missing columns that alembic can't apply due to lock issues.

    Каждая строка соответствует «миграции», которую alembic не катит на Railway.
    Все ALTER должны быть идемпотентны (`IF NOT EXISTS`), чтобы перезапуски
    контейнера не падали.
    """
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as conn:
        await conn.execute(text(
            "ALTER TABLE web_users ADD COLUMN IF NOT EXISTS display_name TEXT"
        ))
        await conn.execute(text(
            "ALTER TABLE web_users "
            "ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false"
        ))
        await conn.commit()
    await engine.dispose()


async def main() -> None:
    await apply_ddl()
    port = int(os.environ.get("PORT", 8000))

    bot = build_bot()
    server = uvicorn.Server(uvicorn.Config(web_app, host="0.0.0.0", port=port, log_level="info"))

    async with bot:
        await bot.updater.start_polling(drop_pending_updates=True)
        await bot.start()
        log.info("Bot started")

        await server.serve()   # blocks until uvicorn exits

        await bot.updater.stop()
        await bot.stop()


if __name__ == "__main__":
    asyncio.run(main())
