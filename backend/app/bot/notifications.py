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
from app.db.models import HabitTick, UserHabit, UserStreak, WebState, WebUser
from app.db.session import AsyncSessionLocal

log = logging.getLogger(__name__)

# Время рассылки. По умолчанию 15:00 UTC = 18:00 МСК.
# Можно перенастроить через env NOTIFY_HOUR_UTC.
NOTIFY_HOUR_UTC = int(os.getenv("NOTIFY_HOUR_UTC", "15"))

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


async def _pick_notification_type(session, user: WebUser) -> tuple[str, str] | None:
    """Вычисляет какой тип уведомления подходит юзеру СЕЙЧАС и какой
    текст отправить. Возвращает (type_id, text) или None если ничего
    не подходит / уже отправляли сегодня.
    """
    today = _today_str()
    cooldowns = user.notification_cooldowns or {}

    journey = None
    if user.id is not None:
        web_state = await session.get(WebState, user.id)
        journey = (web_state.journey if web_state else None) or {}

    # 1. pending_task_reminder
    if "pending_task_reminder" in NOTIFICATION_PRIORITY \
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
    if "practice_check" in NOTIFICATION_PRIORITY \
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
    if "continue_journey" in NOTIFICATION_PRIORITY \
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


async def _send_notification(bot, user: WebUser, ntype: str, text: str) -> bool:
    """Отправляет одно уведомление. Возвращает True если успешно."""
    try:
        await bot.bot.send_message(
            chat_id=user.telegram_id,
            text=text,
            reply_markup=_make_keyboard(),
        )
        return True
    except Forbidden as e:
        # Юзер заблокировал бота. Помечаем notifications_enabled=False
        # чтобы не пробовать снова.
        log.info("user %s blocked the bot — disabling notifications: %s", user.id, e)
        user.notifications_enabled = False
        return False
    except (BadRequest, NetworkError, TimedOut) as e:
        log.warning("notify send_message failed for user %s (%s): %s", user.id, ntype, e)
        return False
    except Exception as e:
        log.warning("notify unexpected error for user %s (%s): %s", user.id, ntype, e)
        return False


async def _send_daily_round(bot) -> None:
    """Один проход рассылки: смотрит всех релевантных юзеров и шлёт по
    одному уведомлению на юзера (первое подходящее по приоритету)."""
    sent_count = 0
    skipped_count = 0
    error_count = 0

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(WebUser).where(
                WebUser.telegram_id.isnot(None),
                WebUser.notifications_enabled.is_(True),
            )
        )).scalars().all()

        for user in rows:
            picked = await _pick_notification_type(session, user)
            if not picked:
                skipped_count += 1
                continue
            ntype, text = picked
            ok = await _send_notification(bot, user, ntype, text)
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


async def notifications_loop() -> None:
    """Бесконечный loop фоновой проверки. Ждёт нужный час, шлёт раунд,
    спит до следующего дня. Идемпотентно через cool-down — даже если
    процесс перезагрузится в течение часа, повторно не отправит."""
    last_run_date: str | None = None
    while True:
        try:
            now = datetime.now(timezone.utc)
            if now.hour == NOTIFY_HOUR_UTC:
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
