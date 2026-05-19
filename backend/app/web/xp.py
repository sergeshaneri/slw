"""Универсальное начисление XP за социальные/community-события.

Каждое начисление:
  • атомарно прибавляет к `web_state.journey.xp`
  • пишет audit-record в `journey_events` с type='xp_awarded'
  • уважает дневной кап по `payload.action_code` (анти-фарм)

Не валит parent-операцию: если что-то упало, возвращаем `xp_delta=0` и логируем.
Фронт читает `xp_delta` из ответа и показывает toast «+N XP за …».
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import JourneyEvent, WebState

log = logging.getLogger(__name__)


# Стандартный набор action_code → (xp, daily_cap). Каждое значение — отдельный
# код, чтобы дневной кап считался независимо. None в cap = без капа.
ACTION_RATES: dict[str, tuple[int, Optional[int]]] = {
    "hall_insight_post":         (8, 5),
    "hall_recommendation_post":  (5, 5),
    "hall_question_post":        (3, 5),
    "hall_answer_post":          (5, 10),
    "hall_answer_marked_best":   (10, None),   # одобрено автором — без капа
    "react_to_insight":          (1, 20),       # ты отреагировал
    "received_reaction":         (1, 30),       # на твой инсайт отреагировали
    "habit_tick":                (1, 8),        # один тик в день максимум за каждый аспект
    "diary_entry":               (2, 5),
    "daily_review":              (5, 1),
    "new_follower":              (2, 10),
}

# Человекочитаемые подписи для toast (используются на фронте через action_code).
ACTION_LABELS: dict[str, str] = {
    "hall_insight_post":         "за инсайт в холле",
    "hall_recommendation_post":  "за рекомендацию",
    "hall_question_post":        "за вопрос",
    "hall_answer_post":          "за ответ",
    "hall_answer_marked_best":   "за лучший ответ ✨",
    "react_to_insight":          "за реакцию",
    "received_reaction":         "тебе оценили инсайт",
    "habit_tick":                "за практику",
    "diary_entry":               "за запись в дневник",
    "daily_review":              "за обзор дня",
    "new_follower":              "новый подписчик",
}


async def award_xp(
    session: AsyncSession,
    user_id: int,
    action_code: str,
) -> dict:
    """Best-effort XP-grant. Возвращает {xp_delta, daily_cap_reached, action_code, label}.

    Если daily_cap превышен — xp_delta=0, daily_cap_reached=True.
    Если что-то упало (DB error, нет WebState и т.п.) — xp_delta=0, без exception.

    Использование:
        result = await award_xp(session, current_user.id, "hall_insight_post")
        return {..., "xp": result}
    """
    if action_code not in ACTION_RATES:
        log.warning("award_xp: unknown action_code=%s", action_code)
        return _empty_result(action_code)

    amount, daily_cap = ACTION_RATES[action_code]

    try:
        # Проверяем дневной кап.
        if daily_cap is not None:
            since = datetime.utcnow() - timedelta(hours=24)
            count_q = (
                select(func.count(JourneyEvent.id))
                .where(JourneyEvent.web_user_id == user_id)
                .where(JourneyEvent.type == "xp_awarded")
                .where(JourneyEvent.created_at >= since)
                .where(JourneyEvent.payload["action_code"].astext == action_code)
            )
            try:
                count = (await session.execute(count_q)).scalar() or 0
            except Exception as e:
                # `payload->>action_code` может падать если payload NULL у старых
                # рядов или если jsonb-индекс отсутствует — best-effort fallback
                # на «без капа».
                log.warning("award_xp cap-check failed: %s — пропускаем кап", e)
                count = 0

            if count >= daily_cap:
                return {
                    "xp_delta": 0,
                    "daily_cap_reached": True,
                    "action_code": action_code,
                    "label": ACTION_LABELS.get(action_code, action_code),
                }

        # Прибавляем к web_state.journey.xp. Если строки нет (юзер без state) —
        # не создаём, просто пропускаем (это редкий edge case при первой
        # сессии до save'а).
        ws = await session.get(WebState, user_id)
        if not ws:
            log.info("award_xp: no WebState for user_id=%s, skipping", user_id)
            return _empty_result(action_code)

        journey = dict(ws.journey or {})
        current_xp = int(journey.get("xp", 0) or 0)
        new_xp = current_xp + amount
        journey["xp"] = new_xp
        ws.journey = journey  # reassign → SQLAlchemy detects change
        ws.updated_at = datetime.utcnow()

        # Audit-event.
        evt = JourneyEvent(
            web_user_id=user_id,
            source="web",
            type="xp_awarded",
            payload={"action_code": action_code, "amount": amount},
            created_at=datetime.utcnow(),
        )
        session.add(evt)
        await session.commit()

        return {
            "xp_delta": amount,
            "daily_cap_reached": False,
            "action_code": action_code,
            "label": ACTION_LABELS.get(action_code, action_code),
            "new_xp": new_xp,
        }
    except Exception as e:
        log.exception("award_xp failed: %s", e)
        try:
            await session.rollback()
        except Exception:
            pass
        return _empty_result(action_code)


def _empty_result(action_code: str) -> dict:
    return {
        "xp_delta": 0,
        "daily_cap_reached": False,
        "action_code": action_code,
        "label": ACTION_LABELS.get(action_code, action_code),
    }
