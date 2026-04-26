"""
Auth routes:
  POST /api/auth/register   — email + password
  POST /api/auth/login      — email + password
  POST /api/auth/telegram   — Telegram Login Widget (creates or logs in)
  POST /api/auth/link       — link Telegram to existing email account (requires auth)
  POST /api/auth/add-email  — add email+password to existing TG-only account (requires auth)
  GET  /api/auth/me         — current user info (requires auth)
"""
import urllib.parse
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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

FRONTEND_URL = "https://sergeshaneri.github.io/slw"


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class AddEmailIn(BaseModel):
    email: str
    password: str


class TelegramAuthIn(BaseModel):
    # Accept any extra fields Telegram may send (last_name, photo_url, etc.)
    # so they're included in the hash check string
    model_config = ConfigDict(extra="allow")

    id: int
    first_name: str = ""
    last_name: str | None = None
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
        "is_admin": user.is_admin,
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


# ── Add email + password to TG-only account ──────────────────────────────────

@router.post("/add-email")
async def add_email(
    body: AddEmailIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """User зарегался через TG (нет email) и хочет добавить email+пароль,
    чтобы можно было входить и тем, и другим способом."""
    if current_user.email:
        raise HTTPException(400, "У этого аккаунта уже есть email")

    # Проверяем, что email не занят кем-то ещё.
    conflict = (
        await session.execute(select(WebUser).where(WebUser.email == body.email))
    ).scalar_one_or_none()
    if conflict and conflict.id != current_user.id:
        raise HTTPException(400, "Этот email уже зарегистрирован")

    current_user.email = body.email
    current_user.password_hash = hash_password(body.password)
    await session.commit()
    await session.refresh(current_user)
    return _user_out(current_user)


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def me(current_user: WebUser = Depends(get_current_user)) -> dict:
    return _user_out(current_user)


# ── Telegram OAuth start (no-popup, full-page redirect) ──────────────────────
# Frontend links directly to this endpoint. It builds the Telegram OAuth URL
# and redirects the browser there — no widget popup needed, works on mobile.

@router.get("/telegram-start")
async def telegram_start() -> RedirectResponse:
    bot_id = settings.bot_token.split(":")[0]
    origin = urllib.parse.quote("https://sergeshaneri.github.io", safe="")
    return_to = urllib.parse.quote(
        "https://slw-production.up.railway.app/api/auth/telegram-redirect",
        safe="",
    )
    tg_url = (
        f"https://oauth.telegram.org/auth"
        f"?bot_id={bot_id}&origin={origin}"
        f"&return_to={return_to}&embed=1&request_access=write"
    )
    return RedirectResponse(tg_url)


# ── Telegram redirect (callback after OAuth) ──────────────────────────────────
# Telegram sends auth params here as query string after the user authorizes.
# We verify, create/find user, then redirect to the frontend with a JWT token.

@router.get("/telegram-redirect")
async def telegram_redirect(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> RedirectResponse:
    params = dict(request.query_params)
    if not verify_telegram_auth(params):
        raise HTTPException(400, "Invalid Telegram auth data")

    tg_id = int(params["id"])
    first_name = params.get("first_name", "")
    username = params.get("username")

    user = (
        await session.execute(select(WebUser).where(WebUser.telegram_id == tg_id))
    ).scalar_one_or_none()

    if not user:
        user = WebUser(
            telegram_id=tg_id,
            telegram_username=username,
            telegram_first_name=first_name,
            created_at=datetime.utcnow(),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        user.telegram_username = username
        user.telegram_first_name = first_name
        await session.commit()

    token = create_token(user.id)
    return RedirectResponse(f"{FRONTEND_URL}?token={token}")
