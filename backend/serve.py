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
        # TMA-юзеры регистрируются по telegram_id без email/пароля. Снимаем
        # NOT NULL чтобы INSERT в /api/auth/telegram-webapp проходил.
        # ALTER ... DROP NOT NULL идемпотентен: повторный запуск ОК.
        await conn.execute(text(
            "ALTER TABLE web_users ALTER COLUMN email DROP NOT NULL"
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

    # coach_calls — таблица для логов ИИ-вызовов. Та же стратегия:
    # отдельная транзакция, timeout, не валим сервис если упало.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS coach_calls (
                        id                 BIGSERIAL PRIMARY KEY,
                        web_user_id        INTEGER NOT NULL,
                        prompt             TEXT NOT NULL,
                        response           TEXT,
                        focus_aspect       TEXT,
                        paid_with_stardust BOOLEAN NOT NULL DEFAULT false,
                        tokens_in          INTEGER,
                        tokens_out         INTEGER,
                        error              TEXT,
                        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS coach_calls_user_idx "
                    "ON coach_calls (web_user_id, created_at DESC)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning(
            "coach_calls DDL failed (AI summon disabled, "
            "but bot+web are up): %s", e
        )

    # public_profiles + aspect_insights + insight_likes — community-фичи.
    # Та же стратегия: отдельная транзакция, timeout, не ронять сервис.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS public_profiles (
                        web_user_id    INTEGER PRIMARY KEY,
                        bio            TEXT,
                        focus_aspects  JSONB,
                        interests      JSONB,
                        inspirations   JSONB,
                        goals          JSONB,
                        is_public      BOOLEAN NOT NULL DEFAULT true,
                        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aspect_insights (
                        id            BIGSERIAL PRIMARY KEY,
                        web_user_id   INTEGER NOT NULL,
                        aspect        TEXT NOT NULL,
                        kind          TEXT NOT NULL,
                        text          TEXT NOT NULL,
                        is_public     BOOLEAN NOT NULL DEFAULT true,
                        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS aspect_insights_user_idx "
                    "ON aspect_insights (web_user_id, created_at DESC)"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS aspect_insights_aspect_idx "
                    "ON aspect_insights (aspect, created_at DESC)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS insight_likes (
                        insight_id   BIGINT NOT NULL,
                        web_user_id  INTEGER NOT NULL,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (insight_id, web_user_id)
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS insight_likes_insight_idx "
                    "ON insight_likes (insight_id)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning(
            "community DDL failed (profile/leaderboard disabled, "
            "but bot+web are up): %s", e
        )

    # web_achievements + расширение insight_likes до реакций.
    # ALTER ADD COLUMN идемпотентен (IF NOT EXISTS).
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS web_achievements (
                        web_user_id  INTEGER NOT NULL,
                        code         TEXT NOT NULL,
                        unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (web_user_id, code)
                    )
                """))
                await conn.execute(text(
                    "ALTER TABLE insight_likes "
                    "ADD COLUMN IF NOT EXISTS reaction TEXT NOT NULL DEFAULT 'heart'"
                ))
                await conn.commit()
    except Exception as e:
        log.warning(
            "achievements/reactions DDL failed (features may be limited, "
            "but bot+web are up): %s", e
        )

    # Аватар на профиле + коммент к реакции + таблица подписок.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text(
                    "ALTER TABLE public_profiles "
                    "ADD COLUMN IF NOT EXISTS avatar TEXT"
                ))
                await conn.execute(text(
                    "ALTER TABLE insight_likes "
                    "ADD COLUMN IF NOT EXISTS comment TEXT"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS subscriptions (
                        follower_id  INTEGER NOT NULL,
                        target_id    INTEGER NOT NULL,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (follower_id, target_id)
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS subscriptions_follower_idx "
                    "ON subscriptions (follower_id)"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS subscriptions_target_idx "
                    "ON subscriptions (target_id)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning(
            "avatar/comment/subscriptions DDL failed (features limited, "
            "but bot+web are up): %s", e
        )

    # aspect_messages — чат внутри холла аспекта.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aspect_messages (
                        id           BIGSERIAL PRIMARY KEY,
                        aspect       TEXT NOT NULL,
                        web_user_id  INTEGER NOT NULL,
                        text         TEXT NOT NULL,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS aspect_messages_aspect_idx "
                    "ON aspect_messages (aspect, id DESC)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning(
            "aspect_messages DDL failed (hall chat disabled, "
            "but bot+web are up): %s", e
        )

    # Уведомления + ЛС + трекер привычек.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS notifications (
                        id           BIGSERIAL PRIMARY KEY,
                        web_user_id  INTEGER NOT NULL,
                        type         TEXT NOT NULL,
                        payload      JSONB,
                        is_read      BOOLEAN NOT NULL DEFAULT false,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS notifications_user_idx "
                    "ON notifications (web_user_id, id DESC)"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS notifications_unread_idx "
                    "ON notifications (web_user_id, is_read)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS direct_messages (
                        id            BIGSERIAL PRIMARY KEY,
                        sender_id     INTEGER NOT NULL,
                        recipient_id  INTEGER NOT NULL,
                        text          TEXT NOT NULL,
                        read_at       TIMESTAMPTZ,
                        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS dm_pair_idx "
                    "ON direct_messages (sender_id, recipient_id, id DESC)"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS dm_recipient_idx "
                    "ON direct_messages (recipient_id, id DESC)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS habit_ticks (
                        web_user_id  INTEGER NOT NULL,
                        aspect       TEXT NOT NULL,
                        date         TEXT NOT NULL,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (web_user_id, aspect, date)
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS habit_ticks_user_idx "
                    "ON habit_ticks (web_user_id, date DESC)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning(
            "notifications/dm/habits DDL failed: %s", e
        )

    # Серверный стрик + выбранные привычки.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS user_streaks (
                        web_user_id      INTEGER PRIMARY KEY,
                        current          INTEGER NOT NULL DEFAULT 0,
                        longest          INTEGER NOT NULL DEFAULT 0,
                        last_active_date TEXT,
                        shield_until     TEXT,
                        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS user_habits (
                        web_user_id  INTEGER NOT NULL,
                        aspect       TEXT NOT NULL,
                        title        TEXT NOT NULL,
                        exercise_id  TEXT,
                        started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (web_user_id, aspect)
                    )
                """))
                await conn.commit()
    except Exception as e:
        log.warning("user_streaks/user_habits DDL failed: %s", e)

    # Sync с локальным vault: отчёты, цели, эмоции, тренировки
    # + два ALTER на web_users (diary_template, categorization_rules).
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text(
                    "ALTER TABLE web_users "
                    "ADD COLUMN IF NOT EXISTS diary_template TEXT"
                ))
                await conn.execute(text(
                    "ALTER TABLE web_users "
                    "ADD COLUMN IF NOT EXISTS categorization_rules TEXT"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS analytics_reports (
                        id            BIGSERIAL PRIMARY KEY,
                        web_user_id   INTEGER NOT NULL,
                        type          TEXT NOT NULL,
                        period_start  TEXT NOT NULL,
                        period_end    TEXT NOT NULL,
                        source        TEXT NOT NULL,
                        title         TEXT,
                        content_md    TEXT NOT NULL,
                        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS analytics_reports_user_idx "
                    "ON analytics_reports (web_user_id, period_start DESC)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aspect_goals (
                        web_user_id  INTEGER NOT NULL,
                        aspect       TEXT NOT NULL,
                        content_md   TEXT NOT NULL,
                        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (web_user_id, aspect)
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS emotions (
                        id              BIGSERIAL PRIMARY KEY,
                        web_user_id     INTEGER NOT NULL,
                        diary_entry_id  INTEGER,
                        date            TEXT NOT NULL,
                        name            TEXT NOT NULL,
                        intensity       SMALLINT,
                        trigger         TEXT,
                        body_sensation  TEXT,
                        roots           TEXT,
                        lesson          TEXT,
                        action          TEXT,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS emotions_user_idx "
                    "ON emotions (web_user_id, date DESC)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS trainings (
                        id              BIGSERIAL PRIMARY KEY,
                        web_user_id     INTEGER NOT NULL,
                        diary_entry_id  INTEGER,
                        date            TEXT NOT NULL,
                        exercise        TEXT NOT NULL,
                        sets            SMALLINT,
                        reps            SMALLINT,
                        weight_kg       NUMERIC,
                        notes           TEXT,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS trainings_user_idx "
                    "ON trainings (web_user_id, date DESC)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning("vault-sync DDL failed: %s", e)

    # Q&A в холле + закладки.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text(
                    "ALTER TABLE aspect_messages "
                    "ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'message'"
                ))
                await conn.execute(text(
                    "ALTER TABLE aspect_messages "
                    "ADD COLUMN IF NOT EXISTS parent_id BIGINT"
                ))
                await conn.execute(text(
                    "ALTER TABLE aspect_messages "
                    "ADD COLUMN IF NOT EXISTS is_best BOOLEAN NOT NULL DEFAULT false"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS aspect_messages_kind_idx "
                    "ON aspect_messages (aspect, kind, id DESC)"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS aspect_messages_parent_idx "
                    "ON aspect_messages (parent_id)"
                ))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS bookmarks (
                        web_user_id  INTEGER NOT NULL,
                        kind         TEXT NOT NULL,
                        target_id    BIGINT NOT NULL,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        PRIMARY KEY (web_user_id, kind, target_id)
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS bookmarks_user_idx "
                    "ON bookmarks (web_user_id, kind, created_at DESC)"
                ))
                await conn.commit()
    except Exception as e:
        log.warning("Q&A/bookmarks DDL failed: %s", e)

    # Onboarding: server flag «прошёл Quick Tour» + JSONB карта закрытых
    # подсказок/карточек DiscoverMore. Идемпотентны (IF NOT EXISTS), отдельная
    # транзакция + 15-секундный timeout — чтобы один зависший ALTER не валил
    # весь старт.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text(
                    "ALTER TABLE web_users "
                    "ADD COLUMN IF NOT EXISTS onboarding_done "
                    "BOOLEAN DEFAULT FALSE NOT NULL"
                ))
                await conn.execute(text(
                    "ALTER TABLE web_users "
                    "ADD COLUMN IF NOT EXISTS hints_seen "
                    "JSONB DEFAULT '{}'::jsonb NOT NULL"
                ))
                await conn.commit()
    except Exception as e:
        log.warning("onboarding flags DDL failed: %s", e)

    # TG-нотификации (2026-05): notifications_enabled — глобальный toggle,
    # notification_cooldowns — JSONB { type: 'YYYY-MM-DD' } чтобы не спамить
    # один тип чаще раза в сутки. Поля идемпотентны.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text(
                    "ALTER TABLE web_users "
                    "ADD COLUMN IF NOT EXISTS notifications_enabled "
                    "BOOLEAN DEFAULT TRUE NOT NULL"
                ))
                await conn.execute(text(
                    "ALTER TABLE web_users "
                    "ADD COLUMN IF NOT EXISTS notification_cooldowns "
                    "JSONB DEFAULT '{}'::jsonb NOT NULL"
                ))
                await conn.commit()
    except Exception as e:
        log.warning("notifications DDL failed: %s", e)

    # user_aspect_state — мульти-аспектный прогресс бота. Одна строка на
    # пару (юзер, аспект). Source of truth для current_step_id внутри
    # аспекта; user_state.current_step_id остаётся как денормализованная
    # копия для текущего аспекта (legacy + быстрый доступ).
    #
    # Миграция существующих юзеров: для каждого user_state с
    # (current_aspect, current_step_id) заполняем user_aspect_state.
    # Идемпотентно через ON CONFLICT DO NOTHING.
    try:
        async with asyncio.timeout(15):
            async with engine.connect() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS user_aspect_state (
                        telegram_id      BIGINT NOT NULL,
                        aspect           TEXT NOT NULL,
                        current_step_id  TEXT,
                        finished         BOOLEAN NOT NULL DEFAULT false,
                        last_active_at   TIMESTAMPTZ,
                        PRIMARY KEY (telegram_id, aspect)
                    )
                """))
                await conn.execute(text(
                    "INSERT INTO user_aspect_state "
                    "  (telegram_id, aspect, current_step_id, last_active_at) "
                    "SELECT user_id, current_aspect, current_step_id, last_active_at "
                    "  FROM user_state "
                    "  WHERE current_aspect IS NOT NULL "
                    "    AND current_step_id IS NOT NULL "
                    "ON CONFLICT (telegram_id, aspect) DO NOTHING"
                ))
                await conn.commit()
    except Exception as e:
        log.warning("user_aspect_state DDL failed: %s", e)

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

        # Запускаем фоновый scheduler TG-нотификаций. Loop ждёт нужный
        # час дня (NOTIFY_HOUR_UTC, по умолчанию 15:00 UTC = 18:00 МСК)
        # и шлёт уведомления подходящим юзерам. Cool-down защищает от
        # повторов при перезапуске. Никогда не валит main — ошибки внутри
        # ловятся, loop продолжается.
        from app.bot.notifications import notifications_loop
        notify_task = asyncio.create_task(notifications_loop())

        await server.serve()   # blocks until uvicorn exits

        notify_task.cancel()
        await bot.updater.stop()
        await bot.stop()


if __name__ == "__main__":
    asyncio.run(main())
