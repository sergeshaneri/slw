"""/aspect — переключение между аспектами в multi-aspect боте.

`/aspect` показывает inline-клавиатуру с доступными аспектами
(из compiled-контента). Текущий помечен ✓, завершённые — 🏆.

Callback `aspect:<key>` переключает `user_state.current_aspect` на
выбранный, восстанавливает текущий шаг из `user_aspect_state` (или
стартует с первого если папка пуста), и показывает шаг юзеру.
"""
from datetime import datetime

from telegram import Update
from telegram.ext import ContextTypes

from app.bot.fsm import IN_SCRIPT
from app.bot.handlers.start import show_aspect_picker
from app.content.loader import first_step_for_aspect, get_step
from app.db.models import UserAspectState, UserState
from app.db.session import AsyncSessionLocal


async def cmd_aspect(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Текстовая команда /aspect — показать пикер."""
    await show_aspect_picker(update, context)
    return IN_SCRIPT


async def on_aspect_pick(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Callback `aspect:<key>` от inline-кнопки.

    1. Парсим выбранный аспект из callback_data.
    2. Обновляем user_state.current_aspect.
    3. Берём текущий шаг из user_aspect_state[(user, aspect)] или
       first_step_for_aspect — папка создаётся ленивым _save_state в show_step.
    4. Показываем шаг.
    """
    query = update.callback_query
    await query.answer()
    if not query.data or not query.data.startswith("aspect:"):
        return IN_SCRIPT
    aspect = query.data.split(":", 1)[1]
    user_id = update.effective_user.id

    # Обновляем "текущий аспект" в user_state.
    async with AsyncSessionLocal() as session:
        state = await session.get(UserState, user_id)
        if state is None:
            state = UserState(user_id=user_id)
            session.add(state)
        state.current_aspect = aspect
        state.last_active_at = datetime.utcnow()
        # Если папка аспекта уже есть — копируем current_step_id в кеш
        # user_state для совместимости со старым sync-кодом.
        aspect_state = await session.get(UserAspectState, (user_id, aspect))
        cached_step_id = aspect_state.current_step_id if aspect_state else None
        if cached_step_id:
            state.current_step_id = cached_step_id
        await session.commit()

    # Резолвим шаг для показа.
    step = None
    if cached_step_id:
        step = get_step(cached_step_id)
    if step is None:
        step = first_step_for_aspect(aspect)
    if step is None:
        # Аспекта нет в контенте — fallback на пикер.
        await query.message.reply_text(
            f"В аспекте «{aspect}» пока нет шагов."
        )
        await show_aspect_picker(update, context)
        return IN_SCRIPT

    # Поздний импорт — show_step живёт в script.py, который сам импортирует
    # show_aspect_picker из start.py (кросс-модульный цикл иначе).
    from app.bot.handlers.script import show_step
    await query.message.reply_text(f"Аспект: {aspect}")
    return await show_step(update, context, step)
