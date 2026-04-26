"""
Scores routes:
  GET  /api/scores  — merged web + bot scores (if Telegram linked)
  PUT  /api/scores  — writes to web_scores; also syncs to bot scores if linked
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Score, WebScore, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()


@router.get("/scores")
async def get_scores(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    result: dict[str, float] = {}

    # Bot scores (base layer — only if Telegram linked)
    if current_user.telegram_id:
        bot_rows = (
            await session.execute(select(Score).where(Score.user_id == current_user.telegram_id))
        ).scalars().all()
        for r in bot_rows:
            result[r.aspect] = float(r.value)

    # Web scores override bot scores
    web_rows = (
        await session.execute(select(WebScore).where(WebScore.web_user_id == current_user.id))
    ).scalars().all()
    for r in web_rows:
        result[r.aspect] = float(r.value)

    return result


@router.put("/scores")
async def put_scores(
    body: dict[str, float],
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    now = datetime.utcnow()

    for aspect, value in body.items():
        # Update web_scores
        row = await session.get(WebScore, (current_user.id, aspect))
        if row is None:
            session.add(WebScore(web_user_id=current_user.id, aspect=aspect, value=value, updated_at=now))
        else:
            row.value = value
            row.updated_at = now

        # Mirror to bot scores if Telegram linked
        if current_user.telegram_id:
            bot_row = await session.get(Score, (current_user.telegram_id, aspect))
            if bot_row is None:
                session.add(Score(user_id=current_user.telegram_id, aspect=aspect, value=value, updated_at=now))
            else:
                bot_row.value = value
                bot_row.updated_at = now

    await session.commit()
    return {"ok": True}
