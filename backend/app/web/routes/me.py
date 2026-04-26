from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Answer, DiaryEntry, Score, ScriptStep
from app.db.session import get_session

router = APIRouter()


@router.get("/me")
async def get_me(user_id: int, session: AsyncSession = Depends(get_session)) -> dict:
    """Temporary: user_id passed as query param. Will be replaced by cookie auth."""
    scores_rows = (
        await session.execute(select(Score).where(Score.user_id == user_id))
    ).scalars().all()

    total = (await session.execute(
        select(func.count()).select_from(ScriptStep)
        .where(ScriptStep.aspect == "БС", ScriptStep.level == 0)
    )).scalar_one()

    done = (await session.execute(
        select(func.count()).select_from(Answer).where(Answer.user_id == user_id)
    )).scalar_one()

    diary = (await session.execute(
        select(DiaryEntry).where(DiaryEntry.user_id == user_id)
        .order_by(DiaryEntry.created_at.desc()).limit(5)
    )).scalars().all()

    return {
        "scores": {s.aspect: float(s.value) for s in scores_rows},
        "progress": {"done": done, "total": total},
        "last_diary": [{"text": e.text, "created_at": e.created_at.isoformat()} for e in diary],
    }
