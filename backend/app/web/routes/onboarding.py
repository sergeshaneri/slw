"""Onboarding flags для трёхслойной системы:
  • Layer 1 (Quick Tour) — POST /complete ставит web_users.onboarding_done.
  • Layer 2 (Hints)      — POST /hint  пишет ключ в hints_seen JSONB.
  • Layer 3 (DiscoverMore) — POST /dismiss-card пишет 'discover-<key>' туда же.

Все эндпоинты только меняют флаги — без побочных эффектов.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.db.models import WebUser
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class HintRequest(BaseModel):
    key: str


@router.post("/complete")
async def mark_onboarding_done(
    user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Юзер прошёл главный Quick Tour."""
    user.onboarding_done = True
    await session.commit()
    return {"ok": True, "onboarding_done": True}


@router.post("/hint")
async def mark_hint_seen(
    body: HintRequest,
    user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Юзер закрыл tooltip-подсказку — больше не показывать."""
    seen = dict(user.hints_seen or {})
    seen[body.key] = True
    user.hints_seen = seen
    # JSONB needs flag_modified to persist nested mutation
    flag_modified(user, "hints_seen")
    await session.commit()
    return {"ok": True, "hints_seen": seen}


@router.post("/dismiss-card")
async def dismiss_discover_card(
    body: HintRequest,
    user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Юзер скрыл карточку из «Открой больше» на дашборде. Использует
    тот же hints_seen с префиксом 'discover-' в ключе."""
    seen = dict(user.hints_seen or {})
    seen[f"discover-{body.key}"] = True
    user.hints_seen = seen
    flag_modified(user, "hints_seen")
    await session.commit()
    return {"ok": True}
