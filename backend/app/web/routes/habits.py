"""
Habit tracker — выбранные практики и ежедневные «тики».

Концепция:
- Юзер выбирает свою ежедневную практику для аспекта (UserHabit) — обычно
  это упражнение из L1 этого аспекта. По одной активной практике на
  (user, aspect).
- Каждый день жмёт «✓ выполнил» — пишется HabitTick (PK по user/aspect/date,
  идемпотентно).
- Тик питает серверный стрик и heatmap.

Эндпоинты:
  GET    /api/habits/me                — мои выбранные практики (по всем аспектам) + сегодняшние тики
  POST   /api/habits/choose            — выбрать/обновить практику для аспекта
  DELETE /api/habits/{aspect}          — снять активную практику
  POST   /api/habits/{aspect}/tick     — отметить сегодняшнюю практику (idempotent)
  DELETE /api/habits/{aspect}/tick     — снять сегодняшний тик
  GET    /api/habits/{aspect}/history  — последние N дней тиков
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import HabitTick, UserHabit, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user
from app.web.streak import bump_streak

router = APIRouter()

ASPECT_KEYS = {"БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"}


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


# ── Schemas ─────────────────────────────────────────────────────────────────

class ChooseHabitIn(BaseModel):
    aspect: str
    title: str = Field(min_length=1, max_length=200)
    exercise_id: str | None = None


# ── Список своих практик ────────────────────────────────────────────────────

@router.get("/habits/me")
async def my_habits(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    today = _today()
    habits_rows = (
        await session.execute(
            select(UserHabit).where(UserHabit.web_user_id == current_user.id)
        )
    ).scalars().all()
    today_rows = (
        await session.execute(
            select(HabitTick.aspect)
            .where(
                HabitTick.web_user_id == current_user.id,
                HabitTick.date == today,
            )
        )
    ).scalars().all()
    today_set = set(today_rows)
    return {
        "date": today,
        "habits": [
            {
                "aspect": h.aspect,
                "title": h.title,
                "exercise_id": h.exercise_id,
                "started_at": h.started_at.isoformat() if h.started_at else None,
                "ticked_today": h.aspect in today_set,
            }
            for h in habits_rows
        ],
        # Тики без выбранной практики (юзер тикал на голую сторону аспекта).
        "extra_ticks": sorted([a for a in today_set if not any(h.aspect == a for h in habits_rows)]),
    }


# ── Выбор / снятие практики ─────────────────────────────────────────────────

@router.post("/habits/choose")
async def choose_habit(
    body: ChooseHabitIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {body.aspect}")
    title = body.title.strip()[:200]
    if not title:
        raise HTTPException(status_code=400, detail="title is empty")

    # UPSERT.
    stmt = pg_insert(UserHabit).values(
        web_user_id=current_user.id,
        aspect=body.aspect,
        title=title,
        exercise_id=body.exercise_id,
    ).on_conflict_do_update(
        index_elements=["web_user_id", "aspect"],
        set_={"title": title, "exercise_id": body.exercise_id},
    )
    await session.execute(stmt)
    await session.commit()
    return {
        "aspect": body.aspect,
        "title": title,
        "exercise_id": body.exercise_id,
    }


@router.delete("/habits/{aspect}")
async def clear_habit(
    aspect: str,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    await session.execute(
        delete(UserHabit).where(
            UserHabit.web_user_id == current_user.id,
            UserHabit.aspect == aspect,
        )
    )
    await session.commit()
    return {"aspect": aspect, "cleared": True}


# ── Тик / снятие тика ───────────────────────────────────────────────────────

@router.post("/habits/{aspect}/tick")
async def tick(
    aspect: str,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    today = _today()
    # Проверяем, был ли уже tick сегодня — чтобы не давать XP за повторный клик
    # (on_conflict_do_nothing глотает дубль, но не сообщает нам).
    existing = (
        await session.execute(
            select(HabitTick.aspect).where(
                HabitTick.web_user_id == current_user.id,
                HabitTick.aspect == aspect,
                HabitTick.date == today,
            ).limit(1)
        )
    ).first()
    was_new = existing is None

    stmt = pg_insert(HabitTick).values(
        web_user_id=current_user.id,
        aspect=aspect,
        date=today,
    ).on_conflict_do_nothing(index_elements=["web_user_id", "aspect", "date"])
    await session.execute(stmt)
    await bump_streak(session, current_user.id)
    await session.commit()

    # XP: 1 за тик (кап 8/день = по одному на каждый из 8 аспектов).
    # Только при НОВОМ тике — повторный (или после untick→tick) не считается.
    xp = None
    if was_new:
        from app.web.xp import award_xp
        xp = await award_xp(session, current_user.id, "habit_tick")

    return {"aspect": aspect, "date": today, "ticked": True, "xp": xp}


@router.delete("/habits/{aspect}/tick")
async def untick(
    aspect: str,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    today = _today()
    await session.execute(
        delete(HabitTick).where(
            HabitTick.web_user_id == current_user.id,
            HabitTick.aspect == aspect,
            HabitTick.date == today,
        )
    )
    await session.commit()
    return {"aspect": aspect, "date": today, "ticked": False}


# ── История ────────────────────────────────────────────────────────────────

@router.get("/habits/{aspect}/history")
async def get_history(
    aspect: str,
    days: int = 90,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown aspect: {aspect}")
    days = max(7, min(days, 365))
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    rows = (
        await session.execute(
            select(HabitTick.date)
            .where(
                HabitTick.web_user_id == current_user.id,
                HabitTick.aspect == aspect,
                HabitTick.date >= since,
            )
            .order_by(HabitTick.date.desc())
        )
    ).scalars().all()
    return {
        "aspect": aspect,
        "days": days,
        "from": since,
        "dates": list(rows),
    }


# ── Back-compat: старый /habits/today ──────────────────────────────────────

@router.get("/habits/today")
async def get_today(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    today = _today()
    rows = (
        await session.execute(
            select(HabitTick.aspect)
            .where(
                HabitTick.web_user_id == current_user.id,
                HabitTick.date == today,
            )
        )
    ).scalars().all()
    return {"date": today, "aspects": sorted(set(rows))}
