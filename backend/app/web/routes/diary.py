"""
Diary routes:
  GET  /api/diary          — list entries (newest first)
  POST /api/diary          — add entry
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import WebDiaryEntry, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()


class DiaryIn(BaseModel):
    text: str
    aspect: str | None = None
    source: str = "web"
    extra: dict | None = None  # promptTitle, prompt, scriptId, etc.


@router.get("/diary")
async def get_diary(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    rows = (
        await session.execute(
            select(WebDiaryEntry)
            .where(WebDiaryEntry.web_user_id == current_user.id)
            .order_by(WebDiaryEntry.created_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "text": r.text,
            "aspect": r.aspect,
            "source": r.source,
            "extra": r.extra,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/diary")
async def post_diary(
    body: DiaryIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    entry = WebDiaryEntry(
        web_user_id=current_user.id,
        text=body.text,
        aspect=body.aspect,
        source=body.source,
        extra=body.extra,
        created_at=datetime.utcnow(),
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return {"id": entry.id}
