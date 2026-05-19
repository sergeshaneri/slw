"""
Diary routes:
  GET  /api/diary  — merged web + bot diary (if Telegram linked), newest first
  POST /api/diary  — saves to web_diary_entries; mirrors to diary_entries if linked
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AnalyticsReport,
    DiaryEntry,
    Emotion,
    Training,
    WebDiaryEntry,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user
from app.web.streak import bump_streak

router = APIRouter()


class DiaryIn(BaseModel):
    text: str
    aspect: str | None = None
    source: str = "web"
    extra: dict | None = None


@router.get("/diary")
async def get_diary(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    entries = []

    # Web diary entries
    web_rows = (
        await session.execute(
            select(WebDiaryEntry)
            .where(WebDiaryEntry.web_user_id == current_user.id)
            .order_by(WebDiaryEntry.created_at.desc())
        )
    ).scalars().all()
    for r in web_rows:
        entries.append({
            "id": f"w{r.id}",
            "text": r.text,
            "aspect": r.aspect,
            "source": r.source,
            "extra": r.extra,
            "created_at": r.created_at.isoformat(),
        })

    # Bot diary entries (if Telegram linked)
    if current_user.telegram_id:
        bot_rows = (
            await session.execute(
                select(DiaryEntry)
                .where(DiaryEntry.user_id == current_user.telegram_id)
                .order_by(DiaryEntry.created_at.desc())
            )
        ).scalars().all()
        for r in bot_rows:
            entries.append({
                "id": f"b{r.id}",
                "text": r.text,
                "aspect": r.aspect,
                "source": r.source,
                "extra": None,
                "created_at": r.created_at.isoformat(),
            })

    # Sort all entries by date, newest first
    entries.sort(key=lambda e: e["created_at"], reverse=True)
    return entries


@router.post("/diary")
async def post_diary(
    body: DiaryIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    now = datetime.utcnow()

    # Save to web diary
    entry = WebDiaryEntry(
        web_user_id=current_user.id,
        text=body.text,
        aspect=body.aspect,
        source=body.source,
        extra=body.extra,
        created_at=now,
    )
    session.add(entry)

    # Mirror to bot diary if Telegram linked
    if current_user.telegram_id:
        session.add(DiaryEntry(
            user_id=current_user.telegram_id,
            text=body.text,
            aspect=body.aspect,
            source=body.source,
            created_at=now,
        ))

    await bump_streak(session, current_user.id)
    await session.commit()
    await session.refresh(entry)

    # XP: 2 за обычную запись (кап 5/день), либо 5 за «полный обзор дня»
    # (source='daily-review', кап 1/день — бонус выдаётся только один раз
    # в сутки даже если в DailyReview юзер заполнил несколько аспектов).
    from app.web.xp import award_xp
    xp_action = "daily_review" if body.source == "daily-review" else "diary_entry"
    xp = await award_xp(session, current_user.id, xp_action)

    # Реферальная веха: если у юзера стало РОВНО 10 записей в дневнике →
    # referrer +50 стардаст. Best-effort, dedupe внутри award_milestone.
    try:
        from app.web.referral import award_milestone, is_first_diary_count
        if await is_first_diary_count(session, current_user.id, 10):
            await award_milestone(session, current_user.id, "referee_diary_10")
    except Exception:
        pass  # best-effort

    return {"id": f"w{entry.id}", "xp": xp}


# ── Структурированные данные из vault-импорта ──────────────────────────────

@router.get("/diary/emotions")
async def get_emotions(
    min_intensity: int | None = None,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Все эмоции юзера. Опц. фильтр по минимальной интенсивности (для пиков)."""
    q = select(Emotion).where(Emotion.web_user_id == current_user.id)
    if min_intensity is not None:
        q = q.where(Emotion.intensity >= min_intensity)
    q = q.order_by(Emotion.date.desc(), Emotion.id.desc())
    rows = (await session.execute(q)).scalars().all()
    return [
        {
            "id": r.id,
            "date": r.date,
            "name": r.name,
            "intensity": r.intensity,
            "trigger": r.trigger,
            "body_sensation": r.body_sensation,
            "roots": r.roots,
            "lesson": r.lesson,
            "action": r.action,
            "diary_entry_id": r.diary_entry_id,
        }
        for r in rows
    ]


@router.get("/diary/trainings")
async def get_trainings(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    rows = (
        await session.execute(
            select(Training)
            .where(Training.web_user_id == current_user.id)
            .order_by(Training.date.desc(), Training.id.desc())
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "date": r.date,
            "exercise": r.exercise,
            "sets": r.sets,
            "reps": r.reps,
            "weight_kg": float(r.weight_kg) if r.weight_kg is not None else None,
            "notes": r.notes,
        }
        for r in rows
    ]


@router.get("/diary/analytics")
async def get_analytics(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Список аналитических отчётов (без content_md — только метаданные)."""
    rows = (
        await session.execute(
            select(AnalyticsReport)
            .where(AnalyticsReport.web_user_id == current_user.id)
            .order_by(AnalyticsReport.period_start.desc())
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "type": r.type,
            "period_start": r.period_start,
            "period_end": r.period_end,
            "title": r.title,
            "source": r.source,
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/diary/analytics/{report_id}")
async def get_analytics_report(
    report_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    r = await session.get(AnalyticsReport, report_id)
    if not r or r.web_user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": r.id,
        "type": r.type,
        "period_start": r.period_start,
        "period_end": r.period_end,
        "title": r.title,
        "source": r.source,
        "content_md": r.content_md,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


@router.get("/diary/template")
async def get_diary_template(
    current_user: WebUser = Depends(get_current_user),
) -> dict:
    """Шаблон записи дневника (импортированный из vault'а)."""
    return {
        "template": current_user.diary_template,
        "categorization_rules": current_user.categorization_rules,
    }
