"""Реферальная система: код-генерация, lookup, начисление наград.

Каждый юзер имеет уникальный `referral_code` (генерится lazy при первом
запросе профиля). При регистрации по ссылке `?ref=XXX` `referrer_id`
закрепляется навсегда. Награды начисляются стардастом, dedup'ятся через
journey_events с type='referral_milestone'.

Вехи (см. ACTION_RATES снизу):
  • referee_registered   — реферал зарегистрировался
  • referee_first_step   — реферал прошёл первый шаг путешествия
  • referee_diary_10     — реферал написал 10 записей в дневнике
  • referee_linked_tg    — реферал залинковал Telegram
  • referee_first_insight — реферал опубликовал первый инсайт

Приветственный бонус новому юзеру (welcome_bonus) — отдельная веха
без referrer-награды, выдаётся самому referee при создании аккаунта
если он пришёл по ссылке.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JourneyEvent, WebState, WebUser

log = logging.getLogger(__name__)

# Награды referrer'у за каждую веху приглашённого. Без капа (one-time per
# referral × milestone), dedup через events.
MILESTONE_REWARDS: dict[str, tuple[int, str]] = {
    # action_code : (stardust_amount, label_for_toast)
    "referee_registered":    (25, "реферал зарегистрировался"),
    "referee_first_step":    (25, "реферал прошёл первый шаг"),
    "referee_diary_10":      (50, "реферал написал 10 записей в дневнике"),
    "referee_linked_tg":     (25, "реферал залинковал Telegram"),
    "referee_first_insight": (25, "реферал опубликовал инсайт"),
}

# Приветственный бонус новому юзеру за регистрацию по ссылке.
WELCOME_BONUS_STARDUST = 50
WELCOME_BONUS_CODE = "referee_welcome"
WELCOME_BONUS_LABEL = "стартовый пакет по приглашению"


def generate_code() -> str:
    """8-символьный URL-safe код. ~62^8 ≈ 200 трлн вариантов — коллизия
    маловероятна, но UNIQUE-индекс на referral_code защитит на DB-уровне."""
    return secrets.token_urlsafe(6)[:8]


async def ensure_referral_code(session: AsyncSession, user: WebUser) -> str:
    """Если у юзера ещё нет referral_code — генерим и сохраняем. Возвращает код."""
    if user.referral_code:
        return user.referral_code
    # Пытаемся несколько раз на случай collision (крайне маловероятно).
    for _ in range(5):
        code = generate_code()
        existing = await session.execute(
            select(WebUser.id).where(WebUser.referral_code == code).limit(1)
        )
        if existing.first() is None:
            user.referral_code = code
            try:
                await session.commit()
                return code
            except Exception as e:
                log.warning("ensure_referral_code commit failed: %s", e)
                await session.rollback()
    # Fallback: используем user_id (не короткий, но уникальный).
    user.referral_code = f"u{user.id}"
    try:
        await session.commit()
    except Exception:
        await session.rollback()
    return user.referral_code


async def lookup_by_code(session: AsyncSession, code: str) -> Optional[WebUser]:
    """Найти юзера по referral_code. Возвращает None если не найден."""
    if not code:
        return None
    code = code.strip()[:32]
    result = await session.execute(
        select(WebUser).where(WebUser.referral_code == code).limit(1)
    )
    return result.scalar_one_or_none()


async def _add_stardust(
    session: AsyncSession, user_id: int, amount: int,
) -> Optional[int]:
    """Прибавляет стардаст к web_state.journey.stardust. Возвращает new total
    или None если WebState для юзера ещё не существует (новенький не сделал
    save'а)."""
    ws = await session.get(WebState, user_id)
    if not ws:
        return None
    journey = dict(ws.journey or {})
    current = int(journey.get("stardust", 0) or 0)
    new_total = current + amount
    journey["stardust"] = new_total
    ws.journey = journey
    ws.updated_at = datetime.utcnow()
    return new_total


async def award_milestone(
    session: AsyncSession,
    referee_id: int,
    milestone_code: str,
) -> Optional[dict]:
    """Начисляет referrer'у стардаст за веху referee. Best-effort.

    1. Проверяем что у referee есть referrer_id (если нет — пришёл сам).
    2. Dedupe: если для этой (referrer, referee, milestone) тройки уже есть
       event — пропускаем.
    3. Прибавляем стардаст к референеру, пишем event.
    4. Возвращаем dict для логирования / уведомлений.

    Не валит parent-операцию: всё в try/except, в случае ошибки возвращает None.
    """
    if milestone_code not in MILESTONE_REWARDS:
        log.warning("award_milestone: unknown code=%s", milestone_code)
        return None

    amount, label = MILESTONE_REWARDS[milestone_code]

    try:
        referee = await session.get(WebUser, referee_id)
        if not referee or not referee.referrer_id:
            return None

        referrer_id = referee.referrer_id

        # Dedupe: ищем существующий event для этой тройки.
        existing = await session.execute(
            select(JourneyEvent.id)
            .where(JourneyEvent.web_user_id == referrer_id)
            .where(JourneyEvent.type == "referral_milestone")
            .where(JourneyEvent.payload["milestone_code"].astext == milestone_code)
            .where(JourneyEvent.payload["referee_id"].astext == str(referee_id))
            .limit(1)
        )
        if existing.first():
            return None

        # Начислить стардаст referrer'у.
        new_total = await _add_stardust(session, referrer_id, amount)
        if new_total is None:
            # У referrer'а нет WebState — крайне редкий edge case.
            log.warning("award_milestone: no WebState for referrer_id=%s", referrer_id)
            return None

        # Audit-event для dedupe и UI «история наград».
        evt = JourneyEvent(
            web_user_id=referrer_id,
            source="web",
            type="referral_milestone",
            payload={
                "milestone_code": milestone_code,
                "referee_id": referee_id,
                "amount_stardust": amount,
            },
            created_at=datetime.utcnow(),
        )
        session.add(evt)
        await session.commit()

        return {
            "milestone_code": milestone_code,
            "stardust_delta": amount,
            "label": label,
            "referrer_id": referrer_id,
            "new_stardust_total": new_total,
        }
    except Exception as e:
        log.exception("award_milestone failed: %s", e)
        try:
            await session.rollback()
        except Exception:
            pass
        return None


async def grant_welcome_bonus(session: AsyncSession, referee_id: int) -> Optional[dict]:
    """Стартовый пакет (+50 стардаст) для нового юзера, пришедшего по реф-
    ссылке. Dedup по journey_events (referee_welcome × user_id)."""
    try:
        # Dedupe: уже выдавали?
        existing = await session.execute(
            select(JourneyEvent.id)
            .where(JourneyEvent.web_user_id == referee_id)
            .where(JourneyEvent.type == "referral_milestone")
            .where(JourneyEvent.payload["milestone_code"].astext == WELCOME_BONUS_CODE)
            .limit(1)
        )
        if existing.first():
            return None

        new_total = await _add_stardust(session, referee_id, WELCOME_BONUS_STARDUST)
        if new_total is None:
            return None

        evt = JourneyEvent(
            web_user_id=referee_id,
            source="web",
            type="referral_milestone",
            payload={
                "milestone_code": WELCOME_BONUS_CODE,
                "amount_stardust": WELCOME_BONUS_STARDUST,
            },
            created_at=datetime.utcnow(),
        )
        session.add(evt)
        await session.commit()
        return {
            "milestone_code": WELCOME_BONUS_CODE,
            "stardust_delta": WELCOME_BONUS_STARDUST,
            "label": WELCOME_BONUS_LABEL,
            "new_stardust_total": new_total,
        }
    except Exception as e:
        log.exception("grant_welcome_bonus failed: %s", e)
        try:
            await session.rollback()
        except Exception:
            pass
        return None


async def get_my_referrals(
    session: AsyncSession, referrer_id: int,
) -> dict:
    """Список приглашённых + прогресс по вехам + сумма заработанного стардаста.

    Возвращает {referrals_count, stardust_earned, referrals: [...]}.
    Только для собственного профиля (приватный список).
    """
    # Все юзеры с referrer_id = me
    rows = (await session.execute(
        select(WebUser.id, WebUser.display_name, WebUser.email, WebUser.telegram_first_name, WebUser.created_at)
        .where(WebUser.referrer_id == referrer_id)
        .order_by(WebUser.created_at.desc())
        .limit(100)
    )).all()

    referee_ids = [r[0] for r in rows]
    # Вехи по каждому referee
    milestones_by_referee: dict[int, list[str]] = {}
    total_stardust = 0
    if referee_ids:
        events = (await session.execute(
            select(JourneyEvent.payload)
            .where(JourneyEvent.web_user_id == referrer_id)
            .where(JourneyEvent.type == "referral_milestone")
        )).all()
        for row in events:
            p = row[0] or {}
            ref_id = p.get("referee_id")
            code = p.get("milestone_code")
            amt = p.get("amount_stardust") or 0
            if ref_id is not None and code:
                milestones_by_referee.setdefault(int(ref_id), []).append(code)
                total_stardust += int(amt)

    referrals = []
    for rid, dname, email, tg_name, created in rows:
        display = dname or tg_name or (email.split("@")[0] if email else f"#{rid}")
        codes = milestones_by_referee.get(rid, [])
        referrals.append({
            "user_id": rid,
            "display_name": display,
            "joined_at": created.isoformat() if created else None,
            "milestones_completed": codes,
        })

    return {
        "referrals_count": len(referrals),
        "stardust_earned": total_stardust,
        "referrals": referrals,
    }


# Хелперы для проверки «является ли это первой записью» — используются в хуках.

async def is_first_diary_count(
    session: AsyncSession, user_id: int, target_count: int,
) -> bool:
    """Проверяет: текущее число web-записей в дневнике равно target_count.
    Используется в хуке post_diary — если после insert'а юзер достиг 10
    записей, награждаем referrer'а."""
    from app.db.models import WebDiaryEntry
    count = (await session.execute(
        select(func.count(WebDiaryEntry.id))
        .where(WebDiaryEntry.web_user_id == user_id)
    )).scalar() or 0
    return count == target_count


async def is_first_insight(session: AsyncSession, user_id: int) -> bool:
    """Проверяет: у юзера РОВНО 1 публичный/любой инсайт. Используется в
    хуке post_insight — если только что создал первый, награждаем referrer."""
    from app.db.models import AspectInsight
    count = (await session.execute(
        select(func.count(AspectInsight.id))
        .where(AspectInsight.web_user_id == user_id)
    )).scalar() or 0
    return count == 1


async def is_first_step_completed(session: AsyncSession, user_id: int) -> bool:
    """Проверяет: у юзера РОВНО 1 step_completed в journey_events
    (от web или bot). Используется в хуке post_step_completed и в auth/sync
    бэкфилле."""
    count = (await session.execute(
        select(func.count(JourneyEvent.id))
        .where(JourneyEvent.web_user_id == user_id)
        .where(JourneyEvent.type == "step_completed")
    )).scalar() or 0
    return count == 1
