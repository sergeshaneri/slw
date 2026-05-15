"""
State routes (whl_journey + whl_history):
  GET  /api/state  — load state (включает updated_at для optimistic locking)
  PUT  /api/state  — save state с optimistic-locking-проверкой

Optimistic locking:
  Клиент шлёт `expected_updated_at` (ISO-string из последнего GET).
  Сервер сверяет с текущим `web_state.updated_at`. Если не совпадает —
  409 conflict с текущим updated_at в теле; клиент должен перечитать
  state и попробовать снова.

  Если `expected_updated_at` НЕ передан — проверка не выполняется
  (для обратной совместимости со старым фронтом и admin-инструментами).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import WebState, WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()


def _iso(dt: datetime | None) -> str | None:
    """Стабильный ISO-формат для сравнения. Всё в UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


class StateIn(BaseModel):
    journey: dict | None = None
    history: list | None = None
    # Optimistic locking: если передан и не совпадает с current updated_at — 409.
    expected_updated_at: str | None = None


@router.get("/state")
async def get_state(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await session.get(WebState, current_user.id)
    return {
        "journey": row.journey if row else None,
        "history": row.history if row else None,
        "updated_at": _iso(row.updated_at) if row else None,
    }


@router.put("/state")
async def put_state(
    body: StateIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    row = await session.get(WebState, current_user.id)
    if row is None:
        row = WebState(web_user_id=current_user.id)
        session.add(row)
        current_updated_at = None
    else:
        current_updated_at = _iso(row.updated_at)

    # Optimistic locking. Только если клиент явно указал ожидаемую версию.
    # Сравниваем как строки, чтобы избежать tz-tzinfo пристрастий.
    if body.expected_updated_at is not None:
        if current_updated_at != body.expected_updated_at:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "state_conflict",
                    "message": "State was modified by another session or admin action",
                    "current_updated_at": current_updated_at,
                    "your_expected": body.expected_updated_at,
                },
            )

    if body.journey is not None:
        row.journey = body.journey
    if body.history is not None:
        row.history = body.history
    row.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(row)
    return {
        "ok": True,
        "updated_at": _iso(row.updated_at),
    }
