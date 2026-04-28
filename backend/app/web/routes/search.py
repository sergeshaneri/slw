"""
Search — простой поиск по своим и публичным сущностям.

  GET /api/search?q=...&scope=all|mine|community

scope:
  mine       — только свои инсайты + дневник
  community  — только публичные инсайты от юзеров с публичным профилем
  all        — обе категории (default)

Реализация: ILIKE по text-полям. Без ranking, без stemming. Когда контента
станет много — перейдём на full-text search (`tsvector`) или pgvector.
"""
from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AspectInsight,
    PublicProfile,
    WebDiaryEntry,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()


def _display_name(user: WebUser) -> str:
    if user.display_name:
        return user.display_name
    if user.telegram_first_name:
        return user.telegram_first_name
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.id}"


@router.get("/search")
async def search(
    q: str = "",
    scope: str = "all",
    limit: int = 20,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    q = (q or "").strip()
    if len(q) < 2:
        return {"q": q, "scope": scope, "my_insights": [], "diary": [], "community_insights": []}
    limit = max(1, min(limit, 50))
    pattern = f"%{q}%"

    out = {
        "q": q,
        "scope": scope,
        "my_insights": [],
        "diary": [],
        "community_insights": [],
    }

    if scope in ("all", "mine"):
        my_ins = (
            await session.execute(
                select(AspectInsight)
                .where(
                    AspectInsight.web_user_id == current_user.id,
                    AspectInsight.text.ilike(pattern),
                )
                .order_by(AspectInsight.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        out["my_insights"] = [
            {
                "id": r.id,
                "aspect": r.aspect,
                "kind": r.kind,
                "text": r.text,
                "is_public": r.is_public,
                "created_at": r.created_at.isoformat(),
            }
            for r in my_ins
        ]

        diary = (
            await session.execute(
                select(WebDiaryEntry)
                .where(
                    WebDiaryEntry.web_user_id == current_user.id,
                    WebDiaryEntry.text.ilike(pattern),
                )
                .order_by(WebDiaryEntry.created_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        out["diary"] = [
            {
                "id": r.id,
                "aspect": r.aspect,
                "text": r.text,
                "created_at": r.created_at.isoformat(),
            }
            for r in diary
        ]

    if scope in ("all", "community"):
        rows = (
            await session.execute(
                select(AspectInsight, WebUser, PublicProfile)
                .join(WebUser, WebUser.id == AspectInsight.web_user_id)
                .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
                .where(
                    AspectInsight.is_public.is_(True),
                    AspectInsight.text.ilike(pattern),
                )
                .where(
                    or_(
                        PublicProfile.is_public.is_(None),
                        PublicProfile.is_public.is_(True),
                    )
                )
                .order_by(AspectInsight.created_at.desc())
                .limit(limit)
            )
        ).all()
        out["community_insights"] = [
            {
                "id": r.id,
                "aspect": r.aspect,
                "kind": r.kind,
                "text": r.text,
                "user_id": u.id,
                "display_name": _display_name(u),
                "avatar": (pp.avatar if pp else None),
                "created_at": r.created_at.isoformat(),
            }
            for r, u, pp in rows
        ]

    return out
