from sqlalchemy import func, select
from telegram import Update
from telegram.ext import ContextTypes

from app.db.models import Answer, Score, ScriptStep
from app.db.session import AsyncSessionLocal


async def cmd_progress(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    async with AsyncSessionLocal() as session:
        scores = (await session.execute(select(Score).where(Score.user_id == user_id))).scalars().all()

        # Считаем все шаги БС по всем уровням сразу.
        total_steps = (await session.execute(
            select(func.count()).select_from(ScriptStep).where(ScriptStep.aspect == "БС")
        )).scalar_one()

        max_level = (await session.execute(
            select(func.max(ScriptStep.level)).select_from(ScriptStep).where(ScriptStep.aspect == "БС")
        )).scalar_one()

        done_steps = (await session.execute(
            select(func.count()).select_from(Answer).where(Answer.user_id == user_id)
        )).scalar_one()

    if not scores and done_steps == 0:
        await update.message.reply_text("Ты ещё не начал. Напиши /go чтобы стартовать.")
        return

    pct = int(done_steps / total_steps * 100) if total_steps else 0
    level_range = f"уровни 0–{max_level}" if max_level and max_level > 0 else "уровень 0"
    lines = [f"Прогресс БС ({level_range}): {done_steps}/{total_steps} шагов ({pct}%)\n"]
    for s in scores:
        lines.append(f"{s.aspect}: {s.value}/10")

    await update.message.reply_text("\n".join(lines))
