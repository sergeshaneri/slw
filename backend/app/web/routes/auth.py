"""
Auth routes:
  POST /api/auth/register   — email + password
  POST /api/auth/login      — email + password
  POST /api/auth/telegram   — Telegram Login Widget (creates or logs in)
  POST /api/auth/link       — link Telegram to existing email account (requires auth)
  GET  /api/auth/me         — current user info (requires auth)
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Score, WebScore, WebUser
from app.db.session import get_session
from app.web.auth import (
    create_token,
    hash_password,
    verify_password,
    verify_telegram_auth,
)
from app.web.deps import get_current_user

router = APIRouter(prefix="/auth")


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class TelegramAuthIn(BaseModel):
    id: int
    first_name: str = ""
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


def _user_out(user: WebUser, token: str | None = None) -> dict:
    out: dict = {
        "id": user.id,
        "email": user.email,
        "telegram_id": user.telegram_id,
        "telegram_username": user.telegram_username,
        "telegram_first_name": user.telegram_first_name,
    }
    if token:
        out["token"] = token
    return out


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterIn, session: AsyncSession = Depends(get_session)) -> dict:
    existing = (
        await session.execute(select(WebUser).where(WebUser.email == body.email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Email already registered")

    user = WebUser(
        email=body.email,
        password_hash=hash_password(body.password),
        telegram_first_name=body.name or None,
        created_at=datetime.utcnow(),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return _user_out(user, create_token(user.id))


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginIn, session: AsyncSession = Depends(get_session)) -> dict:
    user = (
        await session.execute(select(WebUser).where(WebUser.email == body.email))
    ).scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return _user_out(user, create_token(user.id))


# ── Telegram Login Widget (create or log in) ──────────────────────────────────

@router.post("/telegram")
async def telegram_auth(body: TelegramAuthIn, session: AsyncSession = Depends(get_session)) -> dict:
    data = body.model_dump()
    if not verify_telegram_auth(data):
        raise HTTPException(400, "Invalid Telegram auth data")

    # Find or create web user by telegram_id
    user = (
        await session.execute(select(WebUser).where(WebUser.telegram_id == body.id))
    ).scalar_one_or_none()

    if not user:
        user = WebUser(
            telegram_id=body.id,
            telegram_username=body.username,
            telegram_first_name=body.first_name,
            created_at=datetime.utcnow(),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        # Update display name in case it changed
        user.telegram_username = body.username
        user.telegram_first_name = body.first_name
        await session.commit()

    return _user_out(user, create_token(user.id))


# ── Link Telegram to email account ───────────────────────────────────────────

@router.post("/link")
async def link_telegram(
    body: TelegramAuthIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    data = body.model_dump()
    if not verify_telegram_auth(data):
        raise HTTPException(400, "Invalid Telegram auth data")

    # Check telegram_id not already used by another web user
    conflict = (
        await session.execute(select(WebUser).where(WebUser.telegram_id == body.id))
    ).scalar_one_or_none()
    if conflict and conflict.id != current_user.id:
        raise HTTPException(409, "This Telegram account is already linked to another user")

    current_user.telegram_id = body.id
    current_user.telegram_username = body.username
    current_user.telegram_first_name = body.first_name

    # Copy bot scores → web_scores (only aspects not yet scored in web)
    bot_scores = (
        await session.execute(select(Score).where(Score.user_id == body.id))
    ).scalars().all()
    existing_web_aspects = {
        row.aspect
        for row in (
            await session.execute(
                select(WebScore).where(WebScore.web_user_id == current_user.id)
            )
        ).scalars().all()
    }
    for s in bot_scores:
        if s.aspect not in existing_web_aspects:
            session.add(WebScore(
                web_user_id=current_user.id,
                aspect=s.aspect,
                value=s.value,
                updated_at=datetime.utcnow(),
            ))

    await session.commit()
    await session.refresh(current_user)
    return _user_out(current_user)


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def me(current_user: WebUser = Depends(get_current_user)) -> dict:
    return _user_out(current_user)
