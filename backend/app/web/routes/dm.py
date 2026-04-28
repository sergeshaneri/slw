"""
Direct messages — личные сообщения между взаимно подписанными юзерами.

  GET  /api/dm/threads                — список диалогов (по последнему сообщению)
  GET  /api/dm/threads/{user_id}      — сообщения с конкретным юзером
  POST /api/dm/threads/{user_id}      — отправить сообщение
  POST /api/dm/threads/{user_id}/read — пометить тред прочитанным
  GET  /api/dm/unread_count           — счётчик непрочитанных (для bell)

Правило приватности: писать можно только если оба фолловят друг друга
(mutual follow). Это закрывает классический «спам незнакомцам».
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    DirectMessage,
    Notification,
    PublicProfile,
    Subscription,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user
from app.web.streak import bump_streak

router = APIRouter()


class DMIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


def _display_name(user: WebUser) -> str:
    if user.display_name:
        return user.display_name
    if user.telegram_first_name:
        return user.telegram_first_name
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.id}"


async def _is_mutual_follow(session: AsyncSession, a: int, b: int) -> bool:
    rows = (
        await session.execute(
            select(Subscription)
            .where(
                or_(
                    and_(Subscription.follower_id == a, Subscription.target_id == b),
                    and_(Subscription.follower_id == b, Subscription.target_id == a),
                )
            )
        )
    ).scalars().all()
    return len(rows) >= 2


# ── Список тредов ───────────────────────────────────────────────────────────

@router.get("/dm/threads")
async def list_threads(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Каждый тред — последний обмен с конкретным собеседником.
    Партнёр определяется: для каждого сообщения ↔ user_id, который не я.
    """
    rows = (
        await session.execute(
            select(DirectMessage)
            .where(
                or_(
                    DirectMessage.sender_id == current_user.id,
                    DirectMessage.recipient_id == current_user.id,
                )
            )
            .order_by(DirectMessage.id.desc())
        )
    ).scalars().all()

    seen: set[int] = set()
    threads: list[dict] = []
    partners_to_load: set[int] = set()
    for m in rows:
        partner = m.recipient_id if m.sender_id == current_user.id else m.sender_id
        if partner in seen:
            continue
        seen.add(partner)
        partners_to_load.add(partner)
        threads.append({
            "partner_id": partner,
            "last_message": {
                "id": m.id,
                "text": m.text,
                "is_mine": m.sender_id == current_user.id,
                "read": m.read_at is not None,
                "created_at": m.created_at.isoformat(),
            },
            "unread_from_partner": 0,  # заполним ниже
        })

    if not threads:
        return []

    # Подгружаем профили партнёров.
    user_rows = (
        await session.execute(
            select(WebUser, PublicProfile)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(WebUser.id.in_(partners_to_load))
        )
    ).all()
    user_map = {u.id: (u, pp) for u, pp in user_rows}

    # Считаем непрочитанные с каждого партнёра.
    unread_rows = (
        await session.execute(
            select(DirectMessage.sender_id, func.count())
            .where(
                DirectMessage.recipient_id == current_user.id,
                DirectMessage.read_at.is_(None),
                DirectMessage.sender_id.in_(partners_to_load),
            )
            .group_by(DirectMessage.sender_id)
        )
    ).all()
    unread_map = {int(uid): int(c) for uid, c in unread_rows}

    for t in threads:
        u, pp = user_map.get(t["partner_id"], (None, None))
        if u is None:
            t["display_name"] = f"user{t['partner_id']}"
            t["avatar"] = None
        else:
            t["display_name"] = _display_name(u)
            t["avatar"] = (pp.avatar if pp else None)
        t["unread_from_partner"] = unread_map.get(t["partner_id"], 0)
    return threads


# ── Тред с конкретным юзером ────────────────────────────────────────────────

@router.get("/dm/threads/{user_id}")
async def get_thread(
    user_id: int,
    limit: int = 100,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    partner = await session.get(WebUser, user_id)
    if not partner:
        raise HTTPException(status_code=404, detail="User not found")

    mutual = await _is_mutual_follow(session, current_user.id, user_id)
    pp = await session.get(PublicProfile, user_id)

    rows = (
        await session.execute(
            select(DirectMessage)
            .where(
                or_(
                    and_(DirectMessage.sender_id == current_user.id,
                         DirectMessage.recipient_id == user_id),
                    and_(DirectMessage.sender_id == user_id,
                         DirectMessage.recipient_id == current_user.id),
                )
            )
            .order_by(DirectMessage.id.asc())
            .limit(limit)
        )
    ).scalars().all()

    return {
        "partner": {
            "user_id": partner.id,
            "display_name": _display_name(partner),
            "avatar": (pp.avatar if pp else None),
        },
        "mutual": mutual,
        "messages": [
            {
                "id": m.id,
                "text": m.text,
                "is_mine": m.sender_id == current_user.id,
                "read": m.read_at is not None,
                "created_at": m.created_at.isoformat(),
            }
            for m in rows
        ],
    }


# ── Отправка ────────────────────────────────────────────────────────────────

@router.post("/dm/threads/{user_id}")
async def send_message(
    user_id: int,
    body: DMIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")
    partner = await session.get(WebUser, user_id)
    if not partner:
        raise HTTPException(status_code=404, detail="User not found")

    if not await _is_mutual_follow(session, current_user.id, user_id):
        raise HTTPException(
            status_code=403,
            detail="Direct messages require mutual follow. "
                   "You both must subscribe to each other first.",
        )

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is empty")

    msg = DirectMessage(
        sender_id=current_user.id,
        recipient_id=user_id,
        text=text[:4000],
    )
    session.add(msg)

    # Уведомление получателю.
    session.add(Notification(
        web_user_id=user_id,
        type="dm",
        payload={
            "sender_id": current_user.id,
            "sender_name": _display_name(current_user),
            "preview": text[:160],
        },
    ))

    await bump_streak(session, current_user.id)
    await session.commit()
    await session.refresh(msg)
    return {
        "id": msg.id,
        "text": msg.text,
        "is_mine": True,
        "read": False,
        "created_at": msg.created_at.isoformat(),
    }


# ── Пометить тред прочитанным ───────────────────────────────────────────────

@router.post("/dm/threads/{user_id}/read")
async def mark_thread_read(
    user_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await session.execute(
        update(DirectMessage)
        .where(
            DirectMessage.sender_id == user_id,
            DirectMessage.recipient_id == current_user.id,
            DirectMessage.read_at.is_(None),
        )
        .values(read_at=datetime.utcnow())
    )
    await session.commit()
    return {"ok": True}


# ── Глобальный счётчик непрочитанных DM ────────────────────────────────────

@router.get("/dm/unread_count")
async def unread_count(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    count = int((
        await session.execute(
            select(func.count())
            .select_from(DirectMessage)
            .where(
                DirectMessage.recipient_id == current_user.id,
                DirectMessage.read_at.is_(None),
            )
        )
    ).scalar_one())
    return {"unread_count": count}
