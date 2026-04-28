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

from app.db.models import DiaryEntry, WebDiaryEntry, WebUser
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
    return {"id": f"w{entry.id}"}
