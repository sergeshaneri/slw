"""
AI coach summon:
  GET  /api/coach/quota    — сколько вызовов осталось сегодня
  POST /api/coach/summon   — основной вызов: контекст + system prompt + user prompt → LLM
  GET  /api/coach/history  — последние вызовы юзера

Контекст пользователя бэкенд собирает сам (оценки, дневник, прогресс,
последние вызовы коуча). Юзер пишет только свой запрос — модель
получает структурированный контекст автоматически.

Лимит: 1/день базово + бонус за streak (≥7 → +1, ≥14 → +2). Когда
кончился — фронт может прислать `pay_with_stardust=true` (стардаст
уже списан фронтом из journey-state — см. CLAUDE.md и план фичи).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    CoachCall,
    DiaryEntry,
    Score,
    UserState,
    WebDiaryEntry,
    WebScore,
    WebState,
    WebUser,
)
from app.db.session import get_session
from app.llm import get_llm_client
from app.web.deps import get_current_user

router = APIRouter()


SYSTEM_PROMPT = """Ты — ИИ-коуч в приложении SLW (Соционическое Колесо Баланса).

Контекст приложения:
— 8 аспектов соционики: БС (быт/комфорт), БЭ (отношения), БЛ (логика/системы),
  БИ (время/смысл), ЧС (воля/власть), ЧЭ (эмоции/энергия), ЧЛ (дело/польза),
  ЧИ (идеи/возможности).
— У каждого аспекта 4 уровня прокачки (0..3) и оценка по шкале 0–10.
— Юзер ведёт дневник, проходит сценарии, набирает экспу/стардаст/стрик.

Как ты отвечаешь:
— На русском, по существу, без воды.
— В духе самокоучинга: задаёшь возвратные вопросы, помогаешь юзеру
  самому докопаться до своей истины. Не заваливай советами.
— Опираешься на присланный контекст (его оценки, дневник, прогресс).
  Если контекст пуст — мягко скажи и попроси больше деталей в запросе.
— Не ставишь медицинских/психотерапевтических диагнозов. При красных
  флагах (суицид, насилие, серьёзная травма) — направляешь к специалисту.

Длина ответа: 4–10 коротких абзацев. Без markdown-таблиц."""


# ── Pydantic schemas ────────────────────────────────────────────────────────

class SummonIn(BaseModel):
    prompt: str
    focus_aspect: str | None = None
    pay_with_stardust: bool = False


# ── Quota logic ─────────────────────────────────────────────────────────────

def _streak_bonus(streak_days: int) -> int:
    if streak_days >= 14:
        return 2
    if streak_days >= 7:
        return 1
    return 0


async def _resolve_streak(session: AsyncSession, user: WebUser) -> int:
    """Берём streak из бот-тира если TG привязан, иначе из journey-state."""
    if user.telegram_id:
        row = await session.get(UserState, user.telegram_id)
        if row and row.streak_days:
            return int(row.streak_days)

    web_state = await session.get(WebState, user.id)
    if web_state and isinstance(web_state.journey, dict):
        streak = web_state.journey.get("streak") or web_state.journey.get("streakDays")
        if isinstance(streak, (int, float)):
            return int(streak)
    return 0


async def _used_today(session: AsyncSession, user_id: int) -> int:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = (
        await session.execute(
            select(func.count())
            .select_from(CoachCall)
            .where(
                CoachCall.web_user_id == user_id,
                CoachCall.paid_with_stardust.is_(False),
                CoachCall.created_at >= today_start,
                CoachCall.error.is_(None),
            )
        )
    ).scalar_one()
    return int(count)


@router.get("/coach/quota")
async def get_quota(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    streak = await _resolve_streak(session, current_user)
    bonus = _streak_bonus(streak)
    base = 1
    daily_limit = base + bonus
    used = await _used_today(session, current_user.id)
    return {
        "used_today": used,
        "daily_limit": daily_limit,
        "remaining_today": max(daily_limit - used, 0),
        "base_limit": base,
        "streak_bonus": bonus,
        "streak_days": streak,
        "stardust_cost": 100,
    }


# ── Context builder ─────────────────────────────────────────────────────────

async def _build_user_context(session: AsyncSession, user: WebUser, focus_aspect: str | None) -> str:
    """Собирает короткий markdown-блок с состоянием юзера для подачи в LLM."""
    parts: list[str] = []

    name = user.display_name or user.telegram_first_name or (user.email or "").split("@")[0] or "—"
    parts.append(f"## Профиль\n— Имя: {name}")
    if focus_aspect:
        parts.append(f"— Фокус-аспект на этот вызов: {focus_aspect}")

    # Оценки. Web берём в приоритете, бот-тир как fallback для непривязанных.
    score_rows = (
        await session.execute(
            select(WebScore).where(WebScore.web_user_id == user.id)
        )
    ).scalars().all()
    if not score_rows and user.telegram_id:
        score_rows = (
            await session.execute(
                select(Score).where(Score.user_id == user.telegram_id)
            )
        ).scalars().all()
    if score_rows:
        scores_str = ", ".join(f"{r.aspect}={float(r.value):.1f}" for r in score_rows)
        parts.append(f"## Оценки по аспектам (0–10)\n{scores_str}")
    else:
        parts.append("## Оценки по аспектам\n— ещё нет, юзер не оценивал себя.")

    # Прогресс / стрик / стардаст из journey-state (если фронт записал).
    web_state = await session.get(WebState, user.id)
    progress_lines: list[str] = []
    if web_state and isinstance(web_state.journey, dict):
        j = web_state.journey
        for key, label in [
            ("currentAspect", "Текущий аспект"),
            ("currentLevel", "Текущий уровень"),
            ("streak", "Стрик (дней)"),
            ("xp", "XP"),
            ("stardust", "Стардаст"),
            ("totalCompleted", "Пройдено шагов"),
        ]:
            if key in j and j[key] is not None:
                progress_lines.append(f"— {label}: {j[key]}")
    # Бот-тир: дополняем streak если в journey пусто.
    if user.telegram_id:
        bot_state = await session.get(UserState, user.telegram_id)
        if bot_state:
            if bot_state.current_aspect and not any("Текущий аспект" in l for l in progress_lines):
                progress_lines.append(f"— Текущий аспект (бот): {bot_state.current_aspect}")
            if bot_state.current_level is not None and not any("Текущий уровень" in l for l in progress_lines):
                progress_lines.append(f"— Текущий уровень (бот): {bot_state.current_level}")
            if bot_state.streak_days and not any("Стрик" in l for l in progress_lines):
                progress_lines.append(f"— Стрик (бот, дней): {bot_state.streak_days}")
    if progress_lines:
        parts.append("## Прогресс\n" + "\n".join(progress_lines))

    # Последние 5 записей дневника (web + bot, объединённо).
    diary_items: list[tuple[datetime, str, str | None]] = []
    web_diary = (
        await session.execute(
            select(WebDiaryEntry)
            .where(WebDiaryEntry.web_user_id == user.id)
            .order_by(WebDiaryEntry.created_at.desc())
            .limit(5)
        )
    ).scalars().all()
    for r in web_diary:
        diary_items.append((r.created_at, r.text, r.aspect))
    if user.telegram_id:
        bot_diary = (
            await session.execute(
                select(DiaryEntry)
                .where(DiaryEntry.user_id == user.telegram_id)
                .order_by(DiaryEntry.created_at.desc())
                .limit(5)
            )
        ).scalars().all()
        for r in bot_diary:
            diary_items.append((r.created_at, r.text, r.aspect))
    diary_items.sort(key=lambda x: x[0], reverse=True)
    diary_items = diary_items[:5]
    if diary_items:
        diary_block = "\n".join(
            f"— [{ts:%Y-%m-%d}] " + (f"({asp}) " if asp else "") + _trim(text, 250)
            for ts, text, asp in diary_items
        )
        parts.append(f"## Последние записи дневника\n{diary_block}")
    else:
        parts.append("## Последние записи дневника\n— дневник пуст.")

    # Последние 3 вызова коуча — для непрерывности диалога.
    prev_calls = (
        await session.execute(
            select(CoachCall)
            .where(CoachCall.web_user_id == user.id, CoachCall.error.is_(None))
            .order_by(CoachCall.created_at.desc())
            .limit(3)
        )
    ).scalars().all()
    if prev_calls:
        calls_lines = []
        for c in prev_calls:
            calls_lines.append(
                f"— [{c.created_at:%Y-%m-%d %H:%M}] Q: {_trim(c.prompt, 150)}"
                + (f"\n  A: {_trim(c.response or '', 200)}" if c.response else "")
            )
        parts.append("## Прошлые вызовы коуча\n" + "\n".join(calls_lines))

    return "\n\n".join(parts)


def _trim(text: str, limit: int) -> str:
    text = (text or "").strip().replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 1] + "…"


# ── Summon ──────────────────────────────────────────────────────────────────

@router.post("/coach/summon")
async def summon(
    body: SummonIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is empty")
    if len(prompt) > 4000:
        raise HTTPException(status_code=400, detail="prompt too long (>4000 chars)")

    # Quota gate.
    streak = await _resolve_streak(session, current_user)
    daily_limit = 1 + _streak_bonus(streak)
    used = await _used_today(session, current_user.id)
    if not body.pay_with_stardust and used >= daily_limit:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "quota_exceeded",
                "message": "Дневной лимит ИИ-вызовов исчерпан",
                "daily_limit": daily_limit,
                "used_today": used,
            },
        )

    context = await _build_user_context(session, current_user, body.focus_aspect)
    user_block = f"{context}\n\n## Запрос\n{prompt}"

    client = get_llm_client()
    try:
        response = await client.complete(system=SYSTEM_PROMPT, user=user_block)
    except Exception as exc:
        # Логируем неудачный вызов, но не считаем в квоту.
        session.add(CoachCall(
            web_user_id=current_user.id,
            prompt=prompt,
            response=None,
            focus_aspect=body.focus_aspect,
            paid_with_stardust=body.pay_with_stardust,
            error=f"{type(exc).__name__}: {exc}",
        ))
        await session.commit()
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    call = CoachCall(
        web_user_id=current_user.id,
        prompt=prompt,
        response=response.text,
        focus_aspect=body.focus_aspect,
        paid_with_stardust=body.pay_with_stardust,
        tokens_in=response.tokens_in,
        tokens_out=response.tokens_out,
    )
    session.add(call)
    await session.commit()
    await session.refresh(call)

    new_used = used if body.pay_with_stardust else used + 1
    return {
        "call_id": call.id,
        "response": response.text,
        "tokens_in": response.tokens_in,
        "tokens_out": response.tokens_out,
        "remaining_today": max(daily_limit - new_used, 0),
        "daily_limit": daily_limit,
    }


# ── History ─────────────────────────────────────────────────────────────────

@router.get("/coach/history")
async def get_history(
    limit: int = 20,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    limit = max(1, min(limit, 100))
    rows = (
        await session.execute(
            select(CoachCall)
            .where(CoachCall.web_user_id == current_user.id)
            .order_by(CoachCall.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "prompt": r.prompt,
            "response": r.response,
            "focus_aspect": r.focus_aspect,
            "paid_with_stardust": r.paid_with_stardust,
            "error": r.error,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
