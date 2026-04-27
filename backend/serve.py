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

    # journey_events — НОВАЯ таблица. Изолируем от ALTER-ов выше: отдельная
    # транзакция, try/except + 15-секундный timeout. Если CREATE TABLE как-то
    # повиснет под PgBouncer'ом (см. CLAUDE.md gotcha про Alembic) — логируем,
    # фичу sync events отключаем, но bot+web всё равно стартуют. Лучше так,
    # чем уронить весь сервис.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS journey_events (
                        id           BIGSERIAL PRIMARY KEY,
                        telegram_id  BIGINT,
                        web_user_id  INTEGER,
                        source       TEXT NOT NULL,
                        type         TEXT NOT NULL,
                        aspect       TEXT,
                        level        SMALLINT,
                        short_id     TEXT,
                        step_id      TEXT,
                        payload      JSONB,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS journey_events_tg_idx "
                    "ON journey_events (telegram_id, created_at)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning(
            "journey_events DDL failed (sync events disabled, "
            "but bot+web are up): %s", e
        )

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
