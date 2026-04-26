"""
Combined entry point: Telegram bot + FastAPI in one asyncio event loop.
Uvicorn listens on $PORT (Railway injects this).
"""
import asyncio
import logging
import os

import uvicorn

from app.bot.main import build as build_bot
from app.web.main import app as web_app

log = logging.getLogger(__name__)


async def main() -> None:
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
