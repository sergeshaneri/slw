"""TG-нотификации для веб-юзеров: ежедневная рассылка через `bot.send_message`.

Архитектура (MVP, 2026-05):
- Background-task запускается в `serve.py:main()` через `asyncio.create_task`
- Раз в час просыпается, проверяет — пора ли отправлять (текущий час UTC
  совпадает с `NOTIFY_HOUR_UTC`). Если да — пробегает по всем
  залогиненным юзерам с `telegram_id IS NOT NULL`, для каждого вычисляет
  ОДИН подходящий тип уведомления и шлёт.
- Cool-down: `web_users.notification_cooldowns` хранит карту
  `{ type: 'YYYY-MM-DD' }`. Если для этого типа уже отправляли сегодня —
  пропускаем. Это защищает от повторов при перезапуске процесса.
- Отключение: `web_users.notifications_enabled=false` исключает юзера.

Типы (приоритет сверху вниз — отдаём только первый подходящий):
1. **pending_task_reminder** — есть pendingTasks 'taken' старше 2 дней.
   «Ты брал упражнение X — как оно?»
2. **practice_check** — есть user_habits, нет habit_ticks за 2+ дня.
   «Как твоя регулярная практика «X»?»
3. **continue_journey** — last_active_date старше 2 дней, есть начатый
   аспект (completedScripts > 0). «Готов продолжить путешествие?»
4. **new_feature** — broadcast от админа (отдельный endpoint, здесь нет).

Все отправки идут с inline-кнопкой «Открыть приложение» (WebApp).
Ошибки send_message ловим best-effort: BlockedByUser / Forbidden /
NetworkError — пишем в лог и идём дальше.

Расширение в будущем (TODO):
- per-user timezone (сейчас все 15:00 UTC = 18:00 МСК)
- разные типы в разное время дня
- web-toggle настройки в ProfileView
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.error import Forbidden, BadRequest, NetworkError, TimedOut

from app.bot.main import get_app
from app.config import settings
from app.db.models import (
    HabitTick,
    NotificationLog,
    NotificationSettings,
    UserHabit,
    UserStreak,
    WebState,
    WebUser,
)
from app.db.session import AsyncSessionLocal

log = logging.getLogger(__name__)

# Дефолт времени рассылки — 15:00 UTC = 18:00 МСК. Реальное значение
# теперь хранится в БД (NotificationSettings.notify_hour_utc), управляется
# через admin endpoint. Env var NOTIFY_HOUR_UTC оставлен как fallback
# на случай если БД ещё не инициализирована при первом старте.
DEFAULT_NOTIFY_HOUR_UTC = int(os.getenv("NOTIFY_HOUR_UTC", "15"))

# Сколько ждать между circular-проверками. 1 час достаточно.
CHECK_INTERVAL_SECONDS = 60 * 60

# Какие типы рассылаем в дневном проходе и в каком порядке (priority).
# Per-user отдаём только первое подходящее, чтобы не спамить.
NOTIFICATION_PRIORITY = [
    "pending_task_reminder",
    "practice_check",
    "continue_journey",
]

# Cool-down per type. Один день: повторно один и тот же тип в этот же
# календарный день не шлём.
COOLDOWN_DAYS = 1


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _make_keyboard() -> InlineKeyboardMarkup:
    """Кнопка «🎯 Открыть приложение» под каждым уведомлением."""
    return InlineKeyboardMarkup([[
        InlineKeyboardButton(
            "🎯 Открыть приложение",
            web_app=WebAppInfo(url=settings.app_url),
        )
    ]])


async def _get_settings(session) -> NotificationSettings:
    """Singleton notification_settings (id=1). Создаём дефолт если нет."""
    row = await session.get(NotificationSettings, 1)
    if row is None:
        row = NotificationSettings(id=1)
        session.add(row)
        await session.flush()
    return row


async def _pick_notification_type(
    session, user: WebUser, ns: NotificationSettings
) -> tuple[str, str] | None:
    """Вычисляет какой тип уведомления подходит юзеру СЕЙЧАС и какой
    текст отправить. Возвращает (type_id, text) или None если ничего
    не подходит / уже отправляли сегодня / тип выключен админом.
    """
    today = _today_str()
    cooldowns = user.notification_cooldowns or {}

    journey = None
    if user.id is not None:
        web_state = await session.get(WebState, user.id)
        journey = (web_state.journey if web_state else None) or {}

    # 1. pending_task_reminder
    if ns.type_pending_task_reminder \
            and "pending_task_reminder" in NOTIFICATION_PRIORITY \
            and cooldowns.get("pending_task_reminder") != today:
        aspects = (journey or {}).get("aspects") or {}
        # Ищем самое старое taken-задание (status='taken').
        oldest_taken = None
        for aspect_key, folder in aspects.items():
            for task in (folder or {}).get("pendingTasks") or []:
                if task.get("status") != "taken":
                    continue
                added_at = task.get("addedAt")
                if not added_at:
                    continue
                age_ms = datetime.now().timestamp() * 1000 - added_at
                age_days = age_ms / (1000 * 60 * 60 * 24)
                if age_days >= 2:
                    if oldest_taken is None or added_at < oldest_taken["addedAt"]:
                        oldest_taken = task
        if oldest_taken:
            return ("pending_task_reminder",
                    "У тебя есть взятое упражнение — как оно? "
                    "Зайди и отметь результат, даже если получилось не так, как хотел.")

    # 2. practice_check
    if ns.type_practice_check \
            and "practice_check" in NOTIFICATION_PRIORITY \
            and cooldowns.get("practice_check") != today:
        habits = (await session.execute(
            select(UserHabit).where(UserHabit.web_user_id == user.id)
        )).scalars().all()
        if habits:
            yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
            two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
            recent_ticks = (await session.execute(
                select(HabitTick).where(
                    HabitTick.web_user_id == user.id,
                    HabitTick.date.in_([yesterday, two_days_ago, today]),
                )
            )).scalars().all()
            if not recent_ticks:
                habit_titles = ", ".join(h.title for h in habits[:2])
                return ("practice_check",
                        f"Не было отметок за последние пару дней по практикам: «{habit_titles}». "
                        "Получается держать? Если выпадает — не страшно, главное вернуться.")

    # 3. continue_journey
    if ns.type_continue_journey \
            and "continue_journey" in NOTIFICATION_PRIORITY \
            and cooldowns.get("continue_journey") != today:
        streak = await session.get(UserStreak, user.id)
        last_active = streak.last_active_date if streak else None
        two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
        if not last_active or last_active < two_days_ago:
            total_completed = (journey or {}).get("totalCompleted") or 0
            if total_completed > 0:
                return ("continue_journey",
                        "Ты в середине пути — давай вернёмся? "
                        "Один маленький шаг сегодня запускает стрик заново.")

    return None


async def _send_notification(
    bot, session, user: WebUser, ntype: str, text: str
) -> bool:
    """Отправляет одно уведомление. Логирует в notification_log.
    Возвращает True если успешно."""
    error_msg: str | None = None
    success = False
    try:
        await bot.bot.send_message(
            chat_id=user.telegram_id,
            text=text,
            reply_markup=_make_keyboard(),
        )
        success = True
    except Forbidden as e:
        # Юзер заблокировал бота. Помечаем notifications_enabled=False
        # чтобы не пробовать снова.
        log.info("user %s blocked the bot — disabling notifications: %s", user.id, e)
        user.notifications_enabled = False
        error_msg = f"Forbidden: {e}"
    except (BadRequest, NetworkError, TimedOut) as e:
        log.warning("notify send_message failed for user %s (%s): %s", user.id, ntype, e)
        error_msg = str(e)
    except Exception as e:
        log.warning("notify unexpected error for user %s (%s): %s", user.id, ntype, e)
        error_msg = str(e)

    # Пишем в журнал любую отправку (включая ошибки)
    session.add(NotificationLog(
        web_user_id=user.id,
        telegram_id=user.telegram_id,
        type=ntype,
        text=text if success else None,
        error=error_msg,
    ))
    return success


async def _send_daily_round(bot) -> dict[str, int]:
    """Один проход рассылки: смотрит всех релевантных юзеров и шлёт по
    одному уведомлению на юзера (первое подходящее по приоритету).
    Возвращает summary {sent, skipped, errors} — для UI."""
    sent_count = 0
    skipped_count = 0
    error_count = 0

    async with AsyncSessionLocal() as session:
        ns = await _get_settings(session)
        if not ns.enabled:
            log.info("notify daily round skipped: globally disabled")
            await session.commit()
            return {"sent": 0, "skipped": 0, "errors": 0, "globally_disabled": True}

        rows = (await session.execute(
            select(WebUser).where(
                WebUser.telegram_id.isnot(None),
                WebUser.notifications_enabled.is_(True),
            )
        )).scalars().all()

        for user in rows:
            picked = await _pick_notification_type(session, user, ns)
            if not picked:
                skipped_count += 1
                continue
            ntype, text = picked
            ok = await _send_notification(bot, session, user, ntype, text)
            if ok:
                # Обновляем cool-down
                cd = dict(user.notification_cooldowns or {})
                cd[ntype] = _today_str()
                user.notification_cooldowns = cd
                sent_count += 1
            else:
                error_count += 1

        await session.commit()

    log.info(
        "notify daily round done: sent=%d skipped=%d errors=%d",
        sent_count, skipped_count, error_count,
    )
    return {"sent": sent_count, "skipped": skipped_count, "errors": error_count}


async def broadcast_message(
    text_msg: str,
    target: str = "all",  # 'all' | 'tg_linked' | 'recent_30d'
) -> dict[str, int]:
    """Админский broadcast — отправить кастомный текст пачке юзеров
    с inline-кнопкой «🎯 Открыть приложение».

    target:
      - 'all' — все с telegram_id (включая отключивших напоминания)
      - 'tg_linked' — все с telegram_id и notifications_enabled=True
      - 'recent_30d' — активные за последние 30 дней (user_streaks)
    """
    bot = get_app()
    if bot is None:
        return {"sent": 0, "errors": 0, "error": "bot not ready"}

    sent_count = 0
    error_count = 0

    async with AsyncSessionLocal() as session:
        stmt = select(WebUser).where(WebUser.telegram_id.isnot(None))
        if target == "tg_linked":
            stmt = stmt.where(WebUser.notifications_enabled.is_(True))
        elif target == "recent_30d":
            stmt = stmt.where(WebUser.notifications_enabled.is_(True))
            # recent — фильтр по UserStreak.last_active_date >= today-30
            from datetime import timedelta
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
            stmt = stmt.where(
                WebUser.id.in_(
                    select(UserStreak.web_user_id)
                    .where(UserStreak.last_active_date >= cutoff)
                )
            )

        rows = (await session.execute(stmt)).scalars().all()

        for user in rows:
            ok = await _send_notification(bot, session, user, "broadcast", text_msg)
            if ok:
                sent_count += 1
            else:
                error_count += 1

        await session.commit()

    log.info("broadcast done: sent=%d errors=%d target=%s", sent_count, error_count, target)
    return {"sent": sent_count, "errors": error_count, "target": target}


async def send_test_notification(user_id: int) -> dict:
    """Тест: шлёт админу сразу все 3 типа подряд (с заглушечным
    текстом). Используется для проверки внешнего вида сообщений."""
    bot = get_app()
    if bot is None:
        return {"sent": 0, "error": "bot not ready"}

    test_messages = [
        ("pending_task_reminder",
         "[ТЕСТ] Ты брал упражнение — как оно? Зайди и отметь результат."),
        ("practice_check",
         "[ТЕСТ] Не было отметок за пару дней по практике. Получается держать?"),
        ("continue_journey",
         "[ТЕСТ] Ты в середине пути — давай вернёмся? Один шаг сегодня запустит стрик."),
    ]

    sent = 0
    async with AsyncSessionLocal() as session:
        user = await session.get(WebUser, user_id)
        if not user or not user.telegram_id:
            return {"sent": 0, "error": "user has no telegram_id"}
        for ntype, text_msg in test_messages:
            ok = await _send_notification(bot, session, user, f"test:{ntype}", text_msg)
            if ok:
                sent += 1
        await session.commit()
    return {"sent": sent, "of": len(test_messages)}


async def _read_notify_hour() -> int:
    """Час отправки берётся из notification_settings (admin может менять
    через UI). При ошибке БД — fallback на env DEFAULT_NOTIFY_HOUR_UTC."""
    try:
        async with AsyncSessionLocal() as session:
            ns = await session.get(NotificationSettings, 1)
            if ns is not None:
                return int(ns.notify_hour_utc)
    except Exception as e:
        log.warning("read notify_hour_utc from DB failed: %s", e)
    return DEFAULT_NOTIFY_HOUR_UTC


async def notifications_loop() -> None:
    """Бесконечный loop фоновой проверки. Ждёт нужный час (из БД), шлёт
    раунд, спит до следующего дня. Идемпотентно через cool-down — даже
    если процесс перезагрузится в течение часа, повторно не отправит.
    Каждую итерацию читаем час из настроек заново — admin может поменять
    без рестарта."""
    last_run_date: str | None = None
    while True:
        try:
            now = datetime.now(timezone.utc)
            notify_hour = await _read_notify_hour()
            if now.hour == notify_hour:
                today = now.strftime("%Y-%m-%d")
                if last_run_date != today:
                    bot = get_app()
                    if bot is None:
                        log.warning("notify: bot Application is not ready yet, skipping")
                    else:
                        log.info("notify: starting daily round at %s UTC", now.isoformat())
                        await _send_daily_round(bot)
                        last_run_date = today
        except Exception as e:
            # Никогда не валим loop — пишем в лог и продолжаем.
            log.exception("notifications_loop iteration failed: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
