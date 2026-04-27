"""
Public profile + insights + achievements:

  GET    /api/profile/me                  — мой профиль (full)
  PUT    /api/profile/me                  — обновить
  GET    /api/profile/{user_id}           — публичный профиль чужого юзера
  GET    /api/profile/me/insights         — мои инсайты (вкл. приватные)
  POST   /api/profile/insights            — создать инсайт
  DELETE /api/profile/insights/{id}       — удалить свой инсайт
  POST   /api/profile/insights/{id}/react — поставить реакцию (heart/thanks/aha/fire)

Профиль создаётся lazy: первый PUT делает upsert, GET до этого момента
возвращает пустой дефолт. Это не ломает регистрацию и не требует миграции
существующих юзеров.

Ачивки начисляются автоматически на каждом GET /me — это просто
(не требует event-handlers по всему коду) и идемпотентно (INSERT IGNORE).
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AspectInsight,
    CoachCall,
    InsightLike,
    JourneyEvent,
    PublicProfile,
    WebAchievement,
    WebScore,
    WebState,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()

ASPECT_KEYS = ["БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"]
INSIGHT_KINDS = {"insight", "recommendation"}
INSPIRATION_TYPES = {"film", "book", "music", "activity", "person", "other"}

REACTION_TYPES = {"heart", "thanks", "aha", "fire"}

# ── Каталог ачивок ──────────────────────────────────────────────────────────
# Метаданные живут здесь, в БД хранится только факт (web_achievements.code).
# Каждая ачивка — запись `{title, icon, desc, check}`. `check` принимает
# контекст (xp, streak, insights_count, likes_received, coach_calls,
# scored_aspects) и возвращает bool.

ACHIEVEMENT_CATALOG: dict[str, dict] = {
    "first_step":    {"title": "Первый шаг",    "icon": "🚶", "desc": "Прошёл первый шаг путешествия",
                      "check": lambda c: c["xp"] >= 1},
    "xp_10":         {"title": "Десятка",       "icon": "⚜",  "desc": "Накопил 10 XP",
                      "check": lambda c: c["xp"] >= 10},
    "xp_50":         {"title": "Полсотни",      "icon": "🏅", "desc": "Накопил 50 XP",
                      "check": lambda c: c["xp"] >= 50},
    "xp_100":        {"title": "Сотня",         "icon": "🏆", "desc": "Накопил 100 XP",
                      "check": lambda c: c["xp"] >= 100},
    "streak_7":      {"title": "Неделя огня",   "icon": "🔥", "desc": "Стрик 7 дней",
                      "check": lambda c: c["streak"] >= 7},
    "streak_30":     {"title": "Месяц огня",    "icon": "🌋", "desc": "Стрик 30 дней",
                      "check": lambda c: c["streak"] >= 30},
    "first_insight": {"title": "Первый инсайт", "icon": "💡", "desc": "Опубликовал первый инсайт",
                      "check": lambda c: c["insights_count"] >= 1},
    "five_insights": {"title": "Мысль течёт",   "icon": "🧠", "desc": "5 опубликованных инсайтов",
                      "check": lambda c: c["insights_count"] >= 5},
    "liked_by_5":    {"title": "Резонанс",      "icon": "✨", "desc": "5 реакций на твои инсайты",
                      "check": lambda c: c["likes_received"] >= 5},
    "first_coach":   {"title": "Зов коуча",     "icon": "🤖", "desc": "Первый ИИ-вызов",
                      "check": lambda c: c["coach_calls"] >= 1},
    "polymath":      {"title": "Полиглот",      "icon": "🌐", "desc": "Оценил все 8 аспектов",
                      "check": lambda c: c["scored_aspects"] >= 8},
}


# ── Schemas ─────────────────────────────────────────────────────────────────

class InspirationCard(BaseModel):
    type: str
    title: str
    note: str | None = None
    aspect: str | None = None


class ProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=600)
    focus_aspects: list[str] | None = None
    interests: list[str] | None = None
    inspirations: list[InspirationCard] | None = None
    goals: list[str] | None = None
    is_public: bool | None = None


class InsightIn(BaseModel):
    aspect: str
    kind: str = "insight"
    text: str = Field(min_length=1, max_length=2000)
    is_public: bool = True


# ── Helpers ─────────────────────────────────────────────────────────────────

def _validate_aspects(aspects: list[str] | None, max_count: int) -> list[str]:
    if not aspects:
        return []
    cleaned = [a for a in aspects if a in ASPECT_KEYS]
    if len(cleaned) > max_count:
        cleaned = cleaned[:max_count]
    return cleaned


def _clean_str_list(items: list[str] | None, max_count: int, max_len: int) -> list[str]:
    if not items:
        return []
    out = []
    for it in items:
        if not isinstance(it, str):
            continue
        s = it.strip()
        if s:
            out.append(s[:max_len])
        if len(out) >= max_count:
            break
    return out


def _clean_inspirations(items: list[InspirationCard] | None) -> list[dict]:
    if not items:
        return []
    out = []
    for card in items:
        if card.type not in INSPIRATION_TYPES:
            continue
        title = card.title.strip()
        if not title:
            continue
        out.append({
            "type": card.type,
            "title": title[:100],
            "note": (card.note or "").strip()[:300] or None,
            "aspect": card.aspect if card.aspect in ASPECT_KEYS else None,
        })
        if len(out) >= 24:
            break
    return out


def _display_name(user: WebUser) -> str:
    if user.display_name:
        return user.display_name
    if user.telegram_first_name:
        return user.telegram_first_name
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.id}"


async def _xp(session: AsyncSession, user: WebUser) -> int:
    """Серверный XP-эквивалент: MAX между journey_events и completedScripts.

    Источники:
      1. journey_events.web_user_id == user.id (события от веба — пока никто
         не пишет, заготовка)
      2. journey_events.telegram_id == user.telegram_id (события от бота)
      3. web_state.journey -> 'completedScripts' (массив id шагов, веб-чат
         туда дописывает; фронт также мерджит туда bot-события).

    Берём MAX (а не SUM): фронт уже мерджит bot-events в completedScripts,
    поэтому суммирование задвоит. См. также leaderboard.py.
    """
    from sqlalchemy import and_, or_
    conditions = [JourneyEvent.web_user_id == user.id]
    if user.telegram_id:
        conditions.append(JourneyEvent.telegram_id == user.telegram_id)
    events_xp = int((
        await session.execute(
            select(func.count(func.distinct(JourneyEvent.id)))
            .where(
                and_(
                    JourneyEvent.type == "step_completed",
                    or_(*conditions),
                )
            )
        )
    ).scalar_one())

    state = await session.get(WebState, user.id)
    scripts_xp = 0
    if state and isinstance(state.journey, dict):
        cs = state.journey.get("completedScripts")
        if isinstance(cs, list):
            scripts_xp = len(cs)

    return max(events_xp, scripts_xp)


async def _streak(session: AsyncSession, user: WebUser) -> int:
    """Стрик: бот-тир приоритетнее, fallback на journey-state."""
    if user.telegram_id:
        from app.db.models import UserState
        row = await session.get(UserState, user.telegram_id)
        if row and row.streak_days:
            return int(row.streak_days)
    state = await session.get(WebState, user.id)
    if state and isinstance(state.journey, dict):
        s = state.journey.get("streak") or state.journey.get("streakDays")
        if isinstance(s, (int, float)):
            return int(s)
    return 0


async def _check_and_grant_achievements(session: AsyncSession, user: WebUser) -> list[str]:
    """Пересчитывает условия ачивок и вставляет недостающие (idempotent).
    Возвращает список кодов уже разблокированных ачивок (после апдейта).
    Только для своего профиля — иначе бесплатно «начислил» бы себе чужие.
    """
    # Контекст для check-функций.
    xp = await _xp(session, user)
    streak = await _streak(session, user)
    insights_count = int((
        await session.execute(
            select(func.count())
            .select_from(AspectInsight)
            .where(AspectInsight.web_user_id == user.id)
        )
    ).scalar_one())
    likes_received = int((
        await session.execute(
            select(func.count())
            .select_from(InsightLike)
            .join(AspectInsight, AspectInsight.id == InsightLike.insight_id)
            .where(AspectInsight.web_user_id == user.id)
        )
    ).scalar_one())
    coach_calls = int((
        await session.execute(
            select(func.count())
            .select_from(CoachCall)
            .where(CoachCall.web_user_id == user.id, CoachCall.error.is_(None))
        )
    ).scalar_one())
    scored_aspects = int((
        await session.execute(
            select(func.count(func.distinct(WebScore.aspect)))
            .where(WebScore.web_user_id == user.id)
        )
    ).scalar_one())

    ctx = {
        "xp": xp, "streak": streak, "insights_count": insights_count,
        "likes_received": likes_received, "coach_calls": coach_calls,
        "scored_aspects": scored_aspects,
    }

    # Уже разблокированные.
    have = set((
        await session.execute(
            select(WebAchievement.code).where(WebAchievement.web_user_id == user.id)
        )
    ).scalars().all())

    # Что заслужено по текущему контексту.
    earned = {
        code for code, meta in ACHIEVEMENT_CATALOG.items() if meta["check"](ctx)
    }

    new_codes = earned - have
    for code in new_codes:
        # ON CONFLICT DO NOTHING на случай гонки (несколько одновременных GET).
        stmt = pg_insert(WebAchievement).values(
            web_user_id=user.id, code=code,
        ).on_conflict_do_nothing(index_elements=["web_user_id", "code"])
        await session.execute(stmt)
    if new_codes:
        await session.commit()

    return sorted(have | earned)


async def _achievements_payload(session: AsyncSession, codes: list[str]) -> list[dict]:
    """Превращает коды в список объектов с метаданными + датой разблокировки."""
    if not codes:
        return []
    # Подтянем даты unlocked_at.
    # Один запрос только для нужных кодов нам не критичен — берём всё за юзера.
    return [
        {
            "code": code,
            "title": ACHIEVEMENT_CATALOG[code]["title"],
            "icon": ACHIEVEMENT_CATALOG[code]["icon"],
            "desc": ACHIEVEMENT_CATALOG[code]["desc"],
        }
        for code in codes
        if code in ACHIEVEMENT_CATALOG
    ]


async def _reactions_for_insights(
    session: AsyncSession,
    insight_ids: list[int],
    viewer_user: WebUser | None,
) -> tuple[dict[int, dict[str, int]], dict[int, str | None]]:
    """Для группы инсайтов возвращает:
      - reactions[insight_id][reaction_type] = count
      - my_reaction[insight_id] = type|None (что выбрал viewer)
    """
    reactions: dict[int, dict[str, int]] = {}
    if not insight_ids:
        return reactions, {}

    rows = (
        await session.execute(
            select(InsightLike.insight_id, InsightLike.reaction, func.count())
            .where(InsightLike.insight_id.in_(insight_ids))
            .group_by(InsightLike.insight_id, InsightLike.reaction)
        )
    ).all()
    for iid, rtype, cnt in rows:
        reactions.setdefault(int(iid), {})[rtype or "heart"] = int(cnt)

    my_reaction: dict[int, str | None] = {iid: None for iid in insight_ids}
    if viewer_user is not None:
        my_rows = (
            await session.execute(
                select(InsightLike.insight_id, InsightLike.reaction)
                .where(
                    InsightLike.insight_id.in_(insight_ids),
                    InsightLike.web_user_id == viewer_user.id,
                )
            )
        ).all()
        for iid, rtype in my_rows:
            my_reaction[int(iid)] = rtype or "heart"
    return reactions, my_reaction


async def _profile_payload(
    session: AsyncSession,
    target_user: WebUser,
    profile: PublicProfile | None,
    viewer_user: WebUser | None,
    *,
    include_private: bool,
    grant_achievements: bool = False,
) -> dict:
    """Сборка JSON-ответа для GET /profile/{id} и GET /profile/me.

    grant_achievements=True — пересчитывает и начисляет ачивки.
    Применяется только когда target_user == viewer_user (свой профиль).
    """
    xp = await _xp(session, target_user)
    score_rows = (
        await session.execute(
            select(WebScore).where(WebScore.web_user_id == target_user.id)
        )
    ).scalars().all()
    scores = {r.aspect: float(r.value) for r in score_rows}

    # Инсайты: для своего профиля — все, для чужого — только публичные.
    insight_q = select(AspectInsight).where(
        AspectInsight.web_user_id == target_user.id
    )
    if not include_private:
        insight_q = insight_q.where(AspectInsight.is_public.is_(True))
    insight_q = insight_q.order_by(AspectInsight.created_at.desc())
    insights_rows = (await session.execute(insight_q)).scalars().all()

    insights_payload = []
    if insights_rows:
        ids = [r.id for r in insights_rows]
        reactions_map, my_reaction_map = await _reactions_for_insights(
            session, ids, viewer_user
        )
        for r in insights_rows:
            r_counts = reactions_map.get(r.id, {})
            insights_payload.append({
                "id": r.id,
                "aspect": r.aspect,
                "kind": r.kind,
                "text": r.text,
                "is_public": r.is_public,
                "reactions": r_counts,
                "likes": sum(r_counts.values()),  # back-compat для старого фронта
                "my_reaction": my_reaction_map.get(r.id),
                "liked_by_me": my_reaction_map.get(r.id) is not None,
                "created_at": r.created_at.isoformat(),
            })

    # Ачивки.
    if grant_achievements:
        codes = await _check_and_grant_achievements(session, target_user)
    else:
        codes = sorted((
            await session.execute(
                select(WebAchievement.code)
                .where(WebAchievement.web_user_id == target_user.id)
            )
        ).scalars().all())
    achievements = await _achievements_payload(session, codes)

    return {
        "user_id": target_user.id,
        "display_name": _display_name(target_user),
        "bio": (profile.bio if profile else None),
        "focus_aspects": (profile.focus_aspects if profile else None) or [],
        "interests": (profile.interests if profile else None) or [],
        "inspirations": (profile.inspirations if profile else None) or [],
        "goals": (profile.goals if profile else None) or [],
        "is_public": (profile.is_public if profile else True),
        "xp": xp,
        "scores": scores,
        "insights": insights_payload,
        "achievements": achievements,
        # Полный каталог — чтобы фронт мог показать «запертые» ачивки.
        "achievements_catalog": [
            {
                "code": code,
                "title": meta["title"],
                "icon": meta["icon"],
                "desc": meta["desc"],
            }
            for code, meta in ACHIEVEMENT_CATALOG.items()
        ],
    }


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/profile/me")
async def get_my_profile(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    profile = await session.get(PublicProfile, current_user.id)
    return await _profile_payload(
        session, current_user, profile, current_user,
        include_private=True, grant_achievements=True,
    )


@router.put("/profile/me")
async def update_my_profile(
    body: ProfileUpdate,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    profile = await session.get(PublicProfile, current_user.id)
    is_new = profile is None
    if is_new:
        profile = PublicProfile(web_user_id=current_user.id)
        session.add(profile)

    # PATCH-семантика: апдейтим только то, что прислано (не None).
    if body.bio is not None:
        profile.bio = body.bio.strip()[:600] or None
    if body.focus_aspects is not None:
        profile.focus_aspects = _validate_aspects(body.focus_aspects, max_count=3)
    if body.interests is not None:
        profile.interests = _clean_str_list(body.interests, max_count=12, max_len=40)
    if body.inspirations is not None:
        profile.inspirations = _clean_inspirations(body.inspirations)
    if body.goals is not None:
        profile.goals = _clean_str_list(body.goals, max_count=3, max_len=200)
    if body.is_public is not None:
        profile.is_public = body.is_public
    profile.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(profile)
    return await _profile_payload(
        session, current_user, profile, current_user,
        include_private=True, grant_achievements=True,
    )


@router.get("/profile/{user_id}")
async def get_public_profile(
    user_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    target = await session.get(WebUser, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    profile = await session.get(PublicProfile, user_id)
    # Скрытый профиль — 404 для всех кроме самого юзера. Этот эндпоинт
    # без auth, так что просто 404.
    if profile is not None and profile.is_public is False:
        raise HTTPException(status_code=404, detail="Profile is private")

    return await _profile_payload(
        session, target, profile, viewer_user=None, include_private=False
    )


# ── Insights ────────────────────────────────────────────────────────────────

@router.get("/profile/me/insights")
async def get_my_insights(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    rows = (
        await session.execute(
            select(AspectInsight)
            .where(AspectInsight.web_user_id == current_user.id)
            .order_by(AspectInsight.created_at.desc())
        )
    ).scalars().all()
    if not rows:
        return []

    ids = [r.id for r in rows]
    reactions_map, _ = await _reactions_for_insights(session, ids, viewer_user=None)
    return [
        {
            "id": r.id,
            "aspect": r.aspect,
            "kind": r.kind,
            "text": r.text,
            "is_public": r.is_public,
            "reactions": reactions_map.get(r.id, {}),
            "likes": sum(reactions_map.get(r.id, {}).values()),
            "my_reaction": None,  # свои инсайты — реакции от себя нельзя
            "liked_by_me": False,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/profile/insights")
async def post_insight(
    body: InsightIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if body.aspect not in ASPECT_KEYS:
        raise HTTPException(status_code=400, detail="Unknown aspect")
    if body.kind not in INSIGHT_KINDS:
        raise HTTPException(status_code=400, detail="kind must be 'insight' or 'recommendation'")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is empty")

    insight = AspectInsight(
        web_user_id=current_user.id,
        aspect=body.aspect,
        kind=body.kind,
        text=text[:2000],
        is_public=body.is_public,
    )
    session.add(insight)
    await session.commit()
    await session.refresh(insight)
    return {
        "id": insight.id,
        "aspect": insight.aspect,
        "kind": insight.kind,
        "text": insight.text,
        "is_public": insight.is_public,
        "reactions": {},
        "likes": 0,
        "my_reaction": None,
        "liked_by_me": False,
        "created_at": insight.created_at.isoformat(),
    }


@router.delete("/profile/insights/{insight_id}")
async def delete_insight(
    insight_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    insight = await session.get(AspectInsight, insight_id)
    if not insight or insight.web_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Insight not found")
    # Удаляем лайки и сам инсайт.
    await session.execute(delete(InsightLike).where(InsightLike.insight_id == insight_id))
    await session.delete(insight)
    await session.commit()
    return {"ok": True}


class ReactionIn(BaseModel):
    reaction: str = "heart"


@router.post("/profile/insights/{insight_id}/react")
async def react_to_insight(
    insight_id: int,
    body: ReactionIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Поставить реакцию на инсайт. Семантика:
      - если у юзера ещё нет реакции — добавляем
      - если такая же реакция уже стоит — снимаем (toggle off)
      - если стоит другая — заменяем на новую
    """
    if body.reaction not in REACTION_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown reaction; allowed: {sorted(REACTION_TYPES)}")

    insight = await session.get(AspectInsight, insight_id)
    if not insight or insight.is_public is False:
        raise HTTPException(status_code=404, detail="Insight not found")
    if insight.web_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot react to your own insight")

    existing = (
        await session.execute(
            select(InsightLike).where(
                InsightLike.insight_id == insight_id,
                InsightLike.web_user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    my_reaction: str | None
    if existing is None:
        session.add(InsightLike(
            insight_id=insight_id,
            web_user_id=current_user.id,
            reaction=body.reaction,
        ))
        my_reaction = body.reaction
    elif (existing.reaction or "heart") == body.reaction:
        await session.delete(existing)
        my_reaction = None
    else:
        existing.reaction = body.reaction
        my_reaction = body.reaction
    await session.commit()

    # Сводка по всем типам.
    rows = (
        await session.execute(
            select(InsightLike.reaction, func.count())
            .where(InsightLike.insight_id == insight_id)
            .group_by(InsightLike.reaction)
        )
    ).all()
    reactions = {(r or "heart"): int(c) for r, c in rows}
    return {
        "my_reaction": my_reaction,
        "reactions": reactions,
        "total": sum(reactions.values()),
    }


# Back-compat: старый клиент бьёт в /like — делаем алиас на heart-реакцию.
@router.post("/profile/insights/{insight_id}/like")
async def toggle_like_compat(
    insight_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await react_to_insight(
        insight_id=insight_id,
        body=ReactionIn(reaction="heart"),
        current_user=current_user,
        session=session,
    )
