import subprocess
import sys

from sqlalchemy import delete, text
from sqlalchemy import update as sa_update
from telegram import Update
from telegram.ext import ContextTypes

from app.content import loader
from app.db.models import Answer, DiaryEntry, UserAspectState, UserState
from app.db.session import AsyncSessionLocal

ADMIN_ID = 54394403


async def cmd_reload(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_user.id != ADMIN_ID:
        return

    await update.message.reply_text("Обновляю контент...")
    try:
        subprocess.run([sys.executable, "-m", "app.content.build"], check=True)
        subprocess.run([sys.executable, "-m", "app.content.seed"], check=True)
        loader._cache = None
        await update.message.reply_text("Готово. Контент обновлён.")
    except subprocess.CalledProcessError as e:
        await update.message.reply_text(f"Ошибка: {e}")


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Полный сброс прогресса юзера до состояния «впервые открыл бота».

    Сносит:
      • answers, diary_entries
      • user_state.current_aspect/level/step (NULL)
      • все строки user_aspect_state для этого юзера (включая onboarding)
      • journey_events bot-source — чтобы веб не подтянул историю обратно
        при следующей синхронизации

    Без admin-гейта: каждый юзер может сбросить **свой собственный**
    прогресс. По соображениям UX тестирования.
    """
    user_id = update.effective_user.id
    async with AsyncSessionLocal() as session:
        await session.execute(delete(Answer).where(Answer.user_id == user_id))
        await session.execute(delete(DiaryEntry).where(DiaryEntry.user_id == user_id))
        await session.execute(
            delete(UserAspectState).where(UserAspectState.telegram_id == user_id)
        )
        await session.execute(
            sa_update(UserState).where(UserState.user_id == user_id).values(
                current_aspect=None,
                current_level=None,
                current_step_id=None,
                streak_days=0,
                last_active_at=None,
            )
        )
        # journey_events может ещё не существовать (если DDL упал) — best-effort.
        try:
            await session.execute(
                text("DELETE FROM journey_events WHERE telegram_id = :uid AND source = 'bot'"),
                {"uid": user_id},
            )
        except Exception:
            pass
        await session.commit()

    await update.message.reply_text(
        "Прогресс сброшен полностью. Жми /start — будет онбординг с нуля.",
    )
