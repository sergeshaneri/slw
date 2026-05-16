from datetime import datetime

from sqlalchemy import select
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    Update,
    WebAppInfo,
)
from telegram.ext import ContextTypes

from app.bot.handlers.app_button import WEBAPP_URL
from app.content.loader import available_aspects, first_step_for_aspect, get_step
from app.db.models import User, UserAspectState, UserState
from app.db.session import AsyncSessionLocal

def _kb(*buttons):
    return ReplyKeyboardMarkup([list(buttons)], resize_keyboard=True, one_time_keyboard=False)

MAIN_KEYBOARD         = _kb("Продолжить", "Профиль")
NEXT_KEYBOARD         = _kb("Далее ▶", "Профиль")
NEXT_INSIGHT_KEYBOARD = _kb("Далее ▶", "Записать инсайт", "Профиль")
ACK_KEYBOARD          = _kb("Выполнил ✓", "Профиль")
SCORE_KEYBOARD        = _kb("Ввести оценку", "Профиль")
REFLECTION_KEYBOARD   = _kb("Написать ответ", "Профиль")

# Короткие описания планет — те же что в web `data/aspects.js:ASPECT_REALMS`.
# Показываем рядом с кодом аспекта в InlineKeyboard /aspect-пикера.
ASPECT_TAGLINES = {
    "ЧЛ": "мир действий и эффективности",
    "БЛ": "мир структур и причин",
    "ЧЭ": "мир эмоций и яркости",
    "БЭ": "мир чувств и отношений",
    "ЧС": "мир проявленности и воли",
    "БС": "мир баланса ощущений",
    "ЧИ": "мир идей и возможностей",
    "БИ": "мир подсознания и времени",
}

ONBOARDING_ASPECT = "onboarding"


def _webapp_inline_kb() -> InlineKeyboardMarkup:
    """Inline-кнопка для запуска Mini App. Шлём отдельным сообщением
    после основного приветствия — чтобы reply-клавиатура (Продолжить/
    Профиль) осталась внизу, и inline-кнопка не конфликтовала с ней."""
    return InlineKeyboardMarkup([[
        InlineKeyboardButton(
            "🌟 Открыть приложение",
            web_app=WebAppInfo(url=WEBAPP_URL),
        )
    ]])


async def _send_webapp_invite(update: Update, text: str) -> None:
    """Отправляет короткое сообщение с inline-кнопкой WebApp. Best-effort:
    падение шлёт лог и не валит conv-flow."""
    msg = update.effective_message
    if not msg:
        return
    try:
        await msg.reply_text(text, reply_markup=_webapp_inline_kb())
    except Exception:
        # Не критично — у юзера всё равно есть menu-button слева от поля ввода.
        pass


async def _is_onboarding_finished(user_id: int) -> bool:
    """True если юзер дошёл до конца онбординга (4 intro-шага)."""
    async with AsyncSessionLocal() as session:
        row = await session.get(UserAspectState, (user_id, ONBOARDING_ASPECT))
    return bool(row and row.finished)


async def show_aspect_picker(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Показать inline-клавиатуру с доступными аспектами.

    Текущий аспект юзера помечен ✓, завершённые — 🏆.
    Аспекты берутся из compiled-контента (только те, у которых есть шаги).
    """
    user_id = update.effective_user.id
    aspects = available_aspects()

    if not aspects:
        msg = update.effective_message
        if msg:
            await msg.reply_text("Контент путешествия пока не собран.", reply_markup=MAIN_KEYBOARD)
        return

    async with AsyncSessionLocal() as session:
        state = await session.get(UserState, user_id)
        current_aspect = state.current_aspect if state else None
        rows = (
            await session.execute(
                select(UserAspectState).where(UserAspectState.telegram_id == user_id)
            )
        ).scalars().all()
    finished_set = {r.aspect for r in rows if r.finished}
    started_set = {r.aspect for r in rows if r.current_step_id}

    buttons = []
    for asp in aspects:
        marker = ""
        if asp in finished_set:
            marker = "🏆 "
        elif asp == current_aspect:
            marker = "✓ "
        elif asp in started_set:
            marker = "· "
        tagline = ASPECT_TAGLINES.get(asp, "")
        label = f"{marker}{asp} · {tagline}" if tagline else f"{marker}{asp}"
        buttons.append([InlineKeyboardButton(label, callback_data=f"aspect:{asp}")])

    text = "Выбери планету:"
    if current_aspect and current_aspect != ONBOARDING_ASPECT:
        text = (
            "Текущая планета — ✓. Завершённые — 🏆, начатые — ·.\n"
            "Выбери, на какую перейти:"
        )
    msg = update.effective_message
    if msg:
        await msg.reply_text(text, reply_markup=InlineKeyboardMarkup(buttons))


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Точка входа.

    Логика:
      • Если юзер уже выбрал реальный аспект (current_aspect ≠ onboarding)
        → короткое приветствие, кнопка «Продолжить» восстановит шаг.
      • Если онбординг ещё не закончен → ведём по 4 intro-шагам.
        После последнего → _advance вернёт пикер (см. script.py).
      • Если онбординг закончен но аспект не выбран (юзер пробежал
        онбординг и закрыл бот) → сразу пикер.
    """
    tg_user = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await session.get(User, tg_user.id)
        if user is None:
            user = User(
                id=tg_user.id,
                username=tg_user.username,
                first_name=tg_user.first_name,
                language_code=tg_user.language_code,
            )
            session.add(user)

            state = UserState(user_id=tg_user.id, last_active_at=datetime.utcnow())
            session.add(state)
        else:
            state = await session.get(UserState, tg_user.id)
            if state is None:
                state = UserState(user_id=tg_user.id, last_active_at=datetime.utcnow())
                session.add(state)
            else:
                state.last_active_at = datetime.utcnow()

        await session.commit()
        current_aspect = state.current_aspect

    name = tg_user.first_name or "друг"

    # Поздний импорт — show_step живёт в script.py, который сам импортирует
    # show_aspect_picker отсюда (кросс-модульный цикл иначе).
    from app.bot.fsm import IN_SCRIPT
    from app.bot.handlers.script import show_step

    # 1. Юзер уже выбрал реальный аспект — короткое приветствие.
    if current_aspect and current_aspect != ONBOARDING_ASPECT:
        await update.message.reply_text(
            f"Привет, {name}! Сейчас ты на планете «{current_aspect}». "
            "Жми «Продолжить» или /aspect чтобы сменить планету.",
            reply_markup=MAIN_KEYBOARD,
        )
        await _send_webapp_invite(
            update,
            "Полная версия доступна в приложении — там колесо, дашборд, "
            "дневник, ИИ-коуч и сообщество:",
        )
        return IN_SCRIPT

    # 2. Онбординг ещё не пройден — стартуем (или продолжаем) его.
    if not await _is_onboarding_finished(tg_user.id):
        await update.message.reply_text(
            f"Привет, {name}!\n\n"
            "Я СКБ-коуч — помогу тебе исследовать Соционическое Колесо Баланса.",
            reply_markup=MAIN_KEYBOARD,
        )
        await _send_webapp_invite(
            update,
            "Можно пройти курс прямо здесь в чате, а можно открыть приложение — "
            "там визуальное колесо, карта планет, дашборд и дневник:",
        )
        # Если уже шёл по онбордингу — продолжим с того же шага.
        step = None
        if current_aspect == ONBOARDING_ASPECT and state and state.current_step_id:
            step = get_step(state.current_step_id)
        if step is None:
            step = first_step_for_aspect(ONBOARDING_ASPECT)
        if step is None:
            # Контента онбординга нет в compiled — fallback на пикер.
            await show_aspect_picker(update, context)
            return IN_SCRIPT
        return await show_step(update, context, step)

    # 3. Онбординг пройден, аспект не выбран — пикер.
    await update.message.reply_text(
        f"Привет, {name}! Выбери планету для путешествия.",
        reply_markup=MAIN_KEYBOARD,
    )
    await _send_webapp_invite(
        update,
        "Или открой приложение — там вся карта аспектов сразу:",
    )
    await show_aspect_picker(update, context)
    return IN_SCRIPT
