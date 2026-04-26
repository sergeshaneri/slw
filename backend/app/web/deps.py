"""FastAPI dependencies for authenticated routes."""
from fastapi import Depends, Header, HTTPException
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import WebUser
from app.db.session import get_session
from app.web.auth import decode_token


async def get_current_user(
    authorization: str = Header(..., description="Bearer <token>"),
    session: AsyncSession = Depends(get_session),
) -> WebUser:
    try:
        token = authorization.removeprefix("Bearer ").strip()
        user_id = decode_token(token)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await session.get(WebUser, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
