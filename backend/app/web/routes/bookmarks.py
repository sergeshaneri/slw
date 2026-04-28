"""
Bookmarks — закладки на сущности «себе на память».

  GET    /api/bookmarks                       — мои закладки (с превью)
  POST   /api/bookmarks/insight/{id}          — добавить инсайт в закладки
  DELETE /api/bookmarks/insight/{id}          — убрать инсайт из закладок

PK по (user, kind, target_id) — идемпотентно. Сейчас kind='insight';
позже добавим 'message' (Q&A) если понадобится.

Закладки на приватные/удалённые инсайты возвращаются как 'unavailable'
без раскрытия содержимого.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AspectInsight,
    Bookmark,
    PublicProfile,
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


@router.get("/bookmarks")
async def list_bookmarks(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    rows = (
        await session.execute(
            select(Bookmark)
            .where(Bookmark.web_user_id == current_user.id)
            .order_by(Bookmark.created_at.desc())
        )
    ).scalars().all()
    if not rows:
        return []

    insight_ids = [r.target_id for r in rows if r.kind == "insight"]
    insights_map: dict[int, dict] = {}
    if insight_ids:
        ins_rows = (
            await session.execute(
                select(AspectInsight, WebUser, PublicProfile)
                .join(WebUser, WebUser.id == AspectInsight.web_user_id)
                .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
                .where(AspectInsight.id.in_(insight_ids))
            )
        ).all()
        for ins, u, pp in ins_rows:
            # Скрытые юзеры/приватные инсайты помечаем как недоступные.
            user_public = True if pp is None else bool(pp.is_public)
            available = bool(ins.is_public) and user_public
            insights_map[ins.id] = {
                "id": ins.id,
                "aspect": ins.aspect,
                "kind": ins.kind,
                "text": ins.text if available else None,
                "user_id": u.id,
                "display_name": _display_name(u),
                "avatar": (pp.avatar if pp else None),
                "available": available,
                "created_at": ins.created_at.isoformat(),
            }

    out = []
    for r in rows:
        if r.kind == "insight":
            payload = insights_map.get(r.target_id)
            if payload is None:
                out.append({
                    "kind": "insight",
                    "target_id": r.target_id,
                    "available": False,
                    "saved_at": r.created_at.isoformat(),
                })
            else:
                out.append({
                    "kind": "insight",
                    "saved_at": r.created_at.isoformat(),
                    "target_id": r.target_id,
                    **payload,
                })
    return out


@router.post("/bookmarks/insight/{insight_id}")
async def add_bookmark_insight(
    insight_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    insight = await session.get(AspectInsight, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    stmt = pg_insert(Bookmark).values(
        web_user_id=current_user.id,
        kind="insight",
        target_id=insight_id,
    ).on_conflict_do_nothing(
        index_elements=["web_user_id", "kind", "target_id"],
    )
    await session.execute(stmt)
    await session.commit()
    return {"bookmarked": True, "kind": "insight", "target_id": insight_id}


@router.delete("/bookmarks/insight/{insight_id}")
async def remove_bookmark_insight(
    insight_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await session.execute(
        delete(Bookmark).where(
            Bookmark.web_user_id == current_user.id,
            Bookmark.kind == "insight",
            Bookmark.target_id == insight_id,
        )
    )
    await session.commit()
    return {"bookmarked": False, "kind": "insight", "target_id": insight_id}
