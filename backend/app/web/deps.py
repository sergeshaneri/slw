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


async def get_current_user_optional(
    authorization: str | None = Header(None, description="Bearer <token>"),
    session: AsyncSession = Depends(get_session),
) -> WebUser | None:
    """То же что get_current_user, но без auth → возвращает None.

    Используется в эндпоинтах, доступных гостям, но имеющих
    «персонализированные» поля для залогиненных (is_followed_by_me,
    bookmarked, my_reaction и т.п.). Если токен невалидный — тоже None,
    не падаем с 401.
    """
    if not authorization:
        return None
    try:
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            return None
        user_id = decode_token(token)
    except (JWTError, ValueError):
        return None

    return await session.get(WebUser, user_id)
