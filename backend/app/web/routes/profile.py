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
    Bookmark,
    CoachCall,
    InsightLike,
    JourneyEvent,
    PublicProfile,
    Subscription,
    WebAchievement,
    WebScore,
    WebState,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user, get_current_user_optional
from app.web.notify import notify
from app.web.streak import bump_streak

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
    # ── Прогресс по XP ──
    "first_step":    {"title": "Первый шаг",    "icon": "🚶", "desc": "Прошёл первый шаг путешествия",
                      "check": lambda c: c["xp"] >= 1},
    "xp_10":         {"title": "Десятка",       "icon": "⚜",  "desc": "Накопил 10 XP",
                      "check": lambda c: c["xp"] >= 10},
    "xp_50":         {"title": "Полсотни",      "icon": "🏅", "desc": "Накопил 50 XP",
                      "check": lambda c: c["xp"] >= 50},
    "xp_100":        {"title": "Сотня",         "icon": "🏆", "desc": "Накопил 100 XP",
                      "check": lambda c: c["xp"] >= 100},
    "xp_500":        {"title": "Полтыщи",       "icon": "🥈", "desc": "Накопил 500 XP",
                      "check": lambda c: c["xp"] >= 500},
    "xp_1000":       {"title": "Тысячник",      "icon": "👑", "desc": "Накопил 1000 XP",
                      "check": lambda c: c["xp"] >= 1000},

    # ── Стрики ──
    "streak_3":      {"title": "Тройка",        "icon": "🌱", "desc": "Стрик 3 дня",
                      "check": lambda c: c["streak"] >= 3},
    "streak_7":      {"title": "Неделя огня",   "icon": "🔥", "desc": "Стрик 7 дней",
                      "check": lambda c: c["streak"] >= 7},
    "streak_30":     {"title": "Месяц огня",    "icon": "🌋", "desc": "Стрик 30 дней",
                      "check": lambda c: c["streak"] >= 30},
    "streak_100":    {"title": "Стохроник",     "icon": "💎", "desc": "Стрик 100 дней",
                      "check": lambda c: c["streak"] >= 100},

    # ── Дневник ──
    "first_diary":   {"title": "Первая запись", "icon": "📝", "desc": "Сделал запись в дневнике",
                      "check": lambda c: c["diary_count"] >= 1},
    "diary_10":      {"title": "Хроникёр",      "icon": "📖", "desc": "10 записей в дневнике",
                      "check": lambda c: c["diary_count"] >= 10},
    "diary_all":     {"title": "Всеохват",      "icon": "🎯", "desc": "Записи по всем 8 аспектам",
                      "check": lambda c: c["diary_aspects"] >= 8},

    # ── Инсайты (свои) ──
    "first_insight": {"title": "Первый инсайт", "icon": "💡", "desc": "Опубликовал первый инсайт",
                      "check": lambda c: c["insights_count"] >= 1},
    "five_insights": {"title": "Мысль течёт",   "icon": "🧠", "desc": "5 опубликованных инсайтов",
                      "check": lambda c: c["insights_count"] >= 5},
    "insights_10":   {"title": "Мыслитель",     "icon": "📚", "desc": "10 опубликованных инсайтов",
                      "check": lambda c: c["insights_count"] >= 10},
    "storyteller":   {"title": "Рассказчик",    "icon": "🎙",  "desc": "Длинный инсайт (более 500 символов)",
                      "check": lambda c: c["has_long_insight"]},

    # ── Реакции получено ──
    "liked_by_5":    {"title": "Резонанс",      "icon": "✨", "desc": "5 реакций на твои инсайты",
                      "check": lambda c: c["likes_received"] >= 5},
    "liked_by_25":   {"title": "Эхо",           "icon": "🔊", "desc": "25 реакций на твои инсайты",
                      "check": lambda c: c["likes_received"] >= 25},
    "all_reactions": {"title": "Палитра",       "icon": "🎨", "desc": "Получил все 4 типа реакций",
                      "check": lambda c: c["distinct_received_types"] >= 4},

    # ── Реакции отдано (мотивация поддерживать других) ──
    "first_react":   {"title": "Поддержка",     "icon": "🤝", "desc": "Поставил первую реакцию другому",
                      "check": lambda c: c["reactions_given"] >= 1},
    "react_10":      {"title": "Активист",      "icon": "👍", "desc": "Поставил 10 реакций",
                      "check": lambda c: c["reactions_given"] >= 10},
    "bridge":        {"title": "Мостостроитель", "icon": "🌉", "desc": "Реакции 5 разным авторам",
                      "check": lambda c: c["distinct_targets_reacted"] >= 5},

    # ── Коуч ──
    "first_coach":   {"title": "Зов коуча",     "icon": "🤖", "desc": "Первый ИИ-вызов",
                      "check": lambda c: c["coach_calls"] >= 1},
    "coach_5":       {"title": "Беседа",        "icon": "💬", "desc": "5 ИИ-вызовов",
                      "check": lambda c: c["coach_calls"] >= 5},

    # ── Аспекты ──
    "polymath":      {"title": "Полиглот",      "icon": "🌐", "desc": "Оценил все 8 аспектов",
                      "check": lambda c: c["scored_aspects"] >= 8},
    "score_8":       {"title": "Эксперт",       "icon": "⭐", "desc": "Оценка 8+ хотя бы в одном аспекте",
                      "check": lambda c: c["max_score"] >= 8},
    "balanced":      {"title": "Баланс",        "icon": "⚖", "desc": "Все 8 аспектов оценены ≥ 5",
                      "check": lambda c: c["scored_5_count"] >= 8},

    # ── Профиль ──
    "profile_full":  {"title": "Цельный",       "icon": "🪞", "desc": "Заполнил bio, цели и 5+ карточек вдохновения",
                      "check": lambda c: c["bio_filled"] and c["goals_count"] >= 3 and c["inspirations_count"] >= 5},
    "tg_linked":     {"title": "Связной",       "icon": "🔗", "desc": "Связал Telegram с веб-аккаунтом",
                      "check": lambda c: c["tg_linked"]},
}


# ── Schemas ─────────────────────────────────────────────────────────────────

class InspirationCard(BaseModel):
    type: str
    title: str
    note: str | None = None
    aspect: str | None = None


class ProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=600)
    avatar: str | None = Field(default=None, max_length=10)
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


def compute_xp_from_state(journey: object) -> tuple[int, int]:
    """Pure-функция: считает (real_xp, count_scripts) из journey-JSONB.

    real_xp — серверная сумма XP с весами скриптов (T=5, B=10, U=15...),
              фронт пишет в `journey.xp` через `awardXP(script.xp, ...)`.
              Это самая точная метрика.
    count   — сумма len(completedScripts) по всем aspects-папкам.
              Используется как fallback / sanity-check.

    Возвращает (0, 0) если journey не объект или пустой.
    """
    if not isinstance(journey, dict):
        return (0, 0)
    real_xp = int(journey.get("xp") or 0)

    count = 0
    aspects = journey.get("aspects") or {}
    if isinstance(aspects, dict):
        for folder in aspects.values():
            if isinstance(folder, dict):
                cs = folder.get("completedScripts")
                if isinstance(cs, list):
                    count += len(cs)
    # Backwards compat — старая плоская структура (до v8).
    legacy_cs = journey.get("completedScripts")
    if isinstance(legacy_cs, list):
        count = max(count, len(legacy_cs))

    return (real_xp, count)


async def _xp(session: AsyncSession, user: WebUser) -> int:
    """Серверный XP юзера. MAX между тремя источниками:

      1. **real_xp** — `web_state.journey.xp`. Фронт через `awardXP`
         кладёт сумму с весами (T=5/B=10/U=15/R=10/...). Это
         «настоящий» XP, который видит юзер в шапке чата.
      2. **count_scripts** — количество ID в `completedScripts` по
         всем папкам аспектов. Простой fallback, если фронтовый xp
         потерялся (старый state до v8 / частичный сброс).
      3. **events_count** — count записей `step_completed` в
         `journey_events` для этого юзера (бот + веб).

    Берём MAX чтобы:
    - Веб-юзер с реальным `journey.xp=1500` показал 1500 (а не 30
      скриптов как раньше).
    - Бот-юзер без веб-state показал событийный count.
    - Сбой одного источника не обнулял остальные.
    """
    from sqlalchemy import and_, or_
    conditions = [JourneyEvent.web_user_id == user.id]
    if user.telegram_id:
        conditions.append(JourneyEvent.telegram_id == user.telegram_id)
    events_count = int((
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
    real_xp, count_scripts = compute_xp_from_state(state.journey if state else None)

    return max(real_xp, count_scripts, events_count)


async def _streak(session: AsyncSession, user: WebUser) -> int:
    """Стрик: серверный UserStreak в приоритете, fallback на бот-тир и journey."""
    from app.db.models import UserStreak
    row = await session.get(UserStreak, user.id)
    if row and row.current:
        return int(row.current)
    if user.telegram_id:
        from app.db.models import UserState
        bot_row = await session.get(UserState, user.telegram_id)
        if bot_row and bot_row.streak_days:
            return int(bot_row.streak_days)
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
    from app.db.models import WebDiaryEntry
    xp = await _xp(session, user)
    streak = await _streak(session, user)

    insights_count = int((
        await session.execute(
            select(func.count())
            .select_from(AspectInsight)
            .where(AspectInsight.web_user_id == user.id)
        )
    ).scalar_one())
    has_long_insight = bool((
        await session.execute(
            select(func.count())
            .select_from(AspectInsight)
            .where(
                AspectInsight.web_user_id == user.id,
                func.length(AspectInsight.text) > 500,
            )
        )
    ).scalar_one())

    # Реакции получено: всего и по типам.
    likes_received = int((
        await session.execute(
            select(func.count())
            .select_from(InsightLike)
            .join(AspectInsight, AspectInsight.id == InsightLike.insight_id)
            .where(AspectInsight.web_user_id == user.id)
        )
    ).scalar_one())
    distinct_received_types = int((
        await session.execute(
            select(func.count(func.distinct(InsightLike.reaction)))
            .select_from(InsightLike)
            .join(AspectInsight, AspectInsight.id == InsightLike.insight_id)
            .where(AspectInsight.web_user_id == user.id)
        )
    ).scalar_one())

    # Реакции отдано: всего и скольким разным авторам.
    reactions_given = int((
        await session.execute(
            select(func.count())
            .select_from(InsightLike)
            .where(InsightLike.web_user_id == user.id)
        )
    ).scalar_one())
    distinct_targets_reacted = int((
        await session.execute(
            select(func.count(func.distinct(AspectInsight.web_user_id)))
            .select_from(InsightLike)
            .join(AspectInsight, AspectInsight.id == InsightLike.insight_id)
            .where(InsightLike.web_user_id == user.id)
        )
    ).scalar_one())

    coach_calls = int((
        await session.execute(
            select(func.count())
            .select_from(CoachCall)
            .where(CoachCall.web_user_id == user.id, CoachCall.error.is_(None))
        )
    ).scalar_one())

    # Дневник: записи и сколько разных аспектов покрыто.
    diary_count = int((
        await session.execute(
            select(func.count())
            .select_from(WebDiaryEntry)
            .where(WebDiaryEntry.web_user_id == user.id)
        )
    ).scalar_one())
    diary_aspects = int((
        await session.execute(
            select(func.count(func.distinct(WebDiaryEntry.aspect)))
            .where(
                WebDiaryEntry.web_user_id == user.id,
                WebDiaryEntry.aspect.is_not(None),
            )
        )
    ).scalar_one())

    # Аспекты и оценки.
    score_rows = (
        await session.execute(
            select(WebScore.aspect, WebScore.value).where(WebScore.web_user_id == user.id)
        )
    ).all()
    scored_aspects = len({a for a, _ in score_rows})
    max_score = max((float(v) for _, v in score_rows), default=0.0)
    scored_5_count = sum(1 for _, v in score_rows if float(v) >= 5)

    # Профиль: для profile_full.
    pp = await session.get(PublicProfile, user.id)
    bio_filled = bool(pp and pp.bio and pp.bio.strip())
    goals_count = len(pp.goals) if pp and isinstance(pp.goals, list) else 0
    inspirations_count = len(pp.inspirations) if pp and isinstance(pp.inspirations, list) else 0

    ctx = {
        "xp": xp,
        "streak": streak,
        "insights_count": insights_count,
        "has_long_insight": has_long_insight,
        "likes_received": likes_received,
        "distinct_received_types": distinct_received_types,
        "reactions_given": reactions_given,
        "distinct_targets_reacted": distinct_targets_reacted,
        "coach_calls": coach_calls,
        "diary_count": diary_count,
        "diary_aspects": diary_aspects,
        "scored_aspects": scored_aspects,
        "max_score": max_score,
        "scored_5_count": scored_5_count,
        "bio_filled": bio_filled,
        "goals_count": goals_count,
        "inspirations_count": inspirations_count,
        "tg_linked": user.telegram_id is not None,
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

    # Возвращаем кортеж: все коды + только что разблокированные.
    # Фронт показывает тоаст за newly + начисляет +1 стардаст за каждый.
    return sorted(have | earned), sorted(new_codes)


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
    my_comment: dict[int, str | None] = {iid: None for iid in insight_ids}
    if viewer_user is not None:
        my_rows = (
            await session.execute(
                select(InsightLike.insight_id, InsightLike.reaction, InsightLike.comment)
                .where(
                    InsightLike.insight_id.in_(insight_ids),
                    InsightLike.web_user_id == viewer_user.id,
                )
            )
        ).all()
        for iid, rtype, comment in my_rows:
            my_reaction[int(iid)] = rtype or "heart"
            my_comment[int(iid)] = comment
    return reactions, my_reaction, my_comment


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
        reactions_map, my_reaction_map, my_comment_map = await _reactions_for_insights(
            session, ids, viewer_user
        )
        # Закладки viewer'а на эти инсайты.
        bookmarked_set: set[int] = set()
        if viewer_user is not None:
            bm_rows = (
                await session.execute(
                    select(Bookmark.target_id)
                    .where(
                        Bookmark.web_user_id == viewer_user.id,
                        Bookmark.kind == "insight",
                        Bookmark.target_id.in_(ids),
                    )
                )
            ).scalars().all()
            bookmarked_set = set(int(x) for x in bm_rows)

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
                "my_comment": my_comment_map.get(r.id),
                "liked_by_me": my_reaction_map.get(r.id) is not None,
                "bookmarked_by_me": r.id in bookmarked_set,
                "created_at": r.created_at.isoformat(),
            })

    # Ачивки.
    newly_unlocked: list[str] = []
    if grant_achievements:
        codes, newly_unlocked = await _check_and_grant_achievements(session, target_user)
    else:
        codes = sorted((
            await session.execute(
                select(WebAchievement.code)
                .where(WebAchievement.web_user_id == target_user.id)
            )
        ).scalars().all())
    achievements = await _achievements_payload(session, codes)

    # Подписки.
    followers_count = int((
        await session.execute(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.target_id == target_user.id)
        )
    ).scalar_one())
    following_count = int((
        await session.execute(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.follower_id == target_user.id)
        )
    ).scalar_one())
    is_followed_by_me = False
    if viewer_user is not None and viewer_user.id != target_user.id:
        existing = (
            await session.execute(
                select(Subscription)
                .where(
                    Subscription.follower_id == viewer_user.id,
                    Subscription.target_id == target_user.id,
                )
            )
        ).scalar_one_or_none()
        is_followed_by_me = existing is not None

    return {
        "user_id": target_user.id,
        "display_name": _display_name(target_user),
        "avatar": (profile.avatar if profile else None),
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
        "newly_unlocked": newly_unlocked,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_followed_by_me": is_followed_by_me,
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
    if body.avatar is not None:
        profile.avatar = body.avatar.strip()[:10] or None
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
    viewer: WebUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Публичный профиль. Опциональная auth: если viewer передал валидный
    JWT — `_profile_payload` посчитает is_followed_by_me относительно него
    (это нужно чтобы кнопка «Подписаться/Подписан» сохраняла состояние
    после reload). Гости без auth получают is_followed_by_me=False.
    """
    target = await session.get(WebUser, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    profile = await session.get(PublicProfile, user_id)
    # Скрытый профиль — 404 для всех кроме самого юзера.
    if profile is not None and profile.is_public is False:
        if viewer is None or viewer.id != target.id:
            raise HTTPException(status_code=404, detail="Profile is private")

    return await _profile_payload(
        session, target, profile, viewer_user=viewer, include_private=False
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
    reactions_map, _, _ = await _reactions_for_insights(session, ids, viewer_user=None)
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
    await bump_streak(session, current_user.id)
    await session.commit()
    await session.refresh(insight)

    # XP: 8 за инсайт, 5 за рекомендацию. Кап 5/день (для каждого kind свой
    # action_code, считаются независимо).
    from app.web.xp import award_xp
    xp_action = "hall_insight_post" if body.kind == "insight" else "hall_recommendation_post"
    xp = await award_xp(session, current_user.id, xp_action)

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
        "xp": xp,
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
    comment: str | None = Field(default=None, max_length=300)


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

    cleaned_comment = (body.comment or "").strip()[:300] or None

    my_reaction: str | None
    my_comment: str | None
    notify_owner = False
    if existing is None:
        session.add(InsightLike(
            insight_id=insight_id,
            web_user_id=current_user.id,
            reaction=body.reaction,
            comment=cleaned_comment,
        ))
        my_reaction = body.reaction
        my_comment = cleaned_comment
        notify_owner = True
    elif (existing.reaction or "heart") == body.reaction and body.comment is None:
        # Toggle off: тот же тип, без коммента → снимаем.
        await session.delete(existing)
        my_reaction = None
        my_comment = None
    else:
        # Меняем тип и/или обновляем коммент.
        existing.reaction = body.reaction
        if body.comment is not None:
            existing.comment = cleaned_comment
        my_reaction = body.reaction
        my_comment = existing.comment

    # Уведомление автору инсайта (один раз — на новой реакции).
    if notify_owner:
        await notify(
            session,
            user_id=insight.web_user_id,
            type_="reaction",
            payload={
                "insight_id": insight_id,
                "reaction": body.reaction,
                "actor_id": current_user.id,
                "actor_name": _display_name(current_user),
                "preview": (insight.text or "")[:120],
                "comment": cleaned_comment,
            },
            skip_if_self=current_user.id,
        )
    await bump_streak(session, current_user.id)
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

    # XP: 1 реактору (кап 20/день), 1 автору инсайта (кап 30/день).
    # Награждаем только при первой реакции (notify_owner=True), не при toggle/swap.
    from app.web.xp import award_xp
    xp_reactor = await award_xp(session, current_user.id, "react_to_insight") if notify_owner else None
    if notify_owner and insight.web_user_id != current_user.id:
        await award_xp(session, insight.web_user_id, "received_reaction")

    return {
        "my_reaction": my_reaction,
        "my_comment": my_comment,
        "reactions": reactions,
        "total": sum(reactions.values()),
        "xp": xp_reactor,
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


# ── Кто реагировал ──────────────────────────────────────────────────────────
# Зачем: главный путь к коннекту между юзерами. Видя «кому откликнулось»
# твой инсайт, можно зайти на их профиль и связаться (когда появятся ЛС).
#
# Видимость: возвращаем только реагировавших с публичным профилем; сколько
# скрыли свой профиль — отдаём агрегированно как `hidden_count`. Для
# приватного инсайта — только владелец инсайта может видеть список
# (по сути это уже не публичная фича, а «кто отреагировал на моё личное»).

@router.get("/profile/insights/{insight_id}/reactions")
async def get_insight_reactions(
    insight_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    insight = await session.get(AspectInsight, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    if insight.is_public is False:
        # Приватный — внешним не показываем (для своего фронт зовёт через
        # /me/insights, там есть отдельный путь по той же таблице).
        raise HTTPException(status_code=404, detail="Insight is private")

    rows = (
        await session.execute(
            select(InsightLike, WebUser, PublicProfile)
            .join(WebUser, WebUser.id == InsightLike.web_user_id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(InsightLike.insight_id == insight_id)
            .order_by(InsightLike.created_at.desc())
        )
    ).all()

    reactors: list[dict] = []
    hidden_count = 0
    for like, user, pp in rows:
        # is_public=true по умолчанию, либо явно
        is_public = True if pp is None else bool(pp.is_public)
        if not is_public:
            hidden_count += 1
            continue
        reactors.append({
            "user_id": user.id,
            "display_name": _display_name(user),
            "avatar": (pp.avatar if pp else None),
            "reaction": like.reaction or "heart",
            "comment": like.comment,
            "focus_aspects": (pp.focus_aspects if pp else None) or [],
            "created_at": like.created_at.isoformat(),
        })

    return {
        "insight_id": insight_id,
        "reactors": reactors,
        "hidden_count": hidden_count,
        "total": len(reactors) + hidden_count,
    }


# ── Подписки ────────────────────────────────────────────────────────────────

@router.post("/profile/{user_id}/follow")
async def follow_user(
    user_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = await session.get(WebUser, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Проверяем, существовала ли подписка — нужно для XP-награждения только
    # при НОВОЙ подписке (повторный POST после refollow не должен начислять).
    existing = (
        await session.execute(
            select(Subscription).where(
                Subscription.follower_id == current_user.id,
                Subscription.target_id == user_id,
            ).limit(1)
        )
    ).scalar_one_or_none()
    was_new = existing is None

    stmt = pg_insert(Subscription).values(
        follower_id=current_user.id, target_id=user_id,
    ).on_conflict_do_nothing(index_elements=["follower_id", "target_id"])
    await session.execute(stmt)

    # Уведомляем target — у него новый подписчик.
    await notify(
        session,
        user_id=user_id,
        type_="follow",
        payload={
            "actor_id": current_user.id,
            "actor_name": _display_name(current_user),
        },
        skip_if_self=current_user.id,
    )
    await session.commit()

    # XP: 2 target'у за нового подписчика (кап 10/день).
    # Награждаем только реально новые подписки, чтобы refollow не накручивал.
    if was_new:
        from app.web.xp import award_xp
        await award_xp(session, user_id, "new_follower")

    followers_count = int((
        await session.execute(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.target_id == user_id)
        )
    ).scalar_one())
    return {"following": True, "followers_count": followers_count}


@router.delete("/profile/{user_id}/follow")
async def unfollow_user(
    user_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    await session.execute(
        delete(Subscription).where(
            Subscription.follower_id == current_user.id,
            Subscription.target_id == user_id,
        )
    )
    await session.commit()
    followers_count = int((
        await session.execute(
            select(func.count())
            .select_from(Subscription)
            .where(Subscription.target_id == user_id)
        )
    ).scalar_one())
    return {"following": False, "followers_count": followers_count}


@router.get("/profile/me/subscriptions")
async def my_subscriptions(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    """На кого я подписан."""
    rows = (
        await session.execute(
            select(WebUser, PublicProfile)
            .join(Subscription, Subscription.target_id == WebUser.id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(Subscription.follower_id == current_user.id)
            .order_by(Subscription.created_at.desc())
        )
    ).all()
    return [
        {
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "focus_aspects": (pp.focus_aspects if pp else None) or [],
            "is_public": True if pp is None else bool(pp.is_public),
        }
        for u, pp in rows
    ]


@router.get("/profile/me/followers")
async def my_followers(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    """Кто на меня подписан. Скрытые юзеры исключаются."""
    rows = (
        await session.execute(
            select(WebUser, PublicProfile)
            .join(Subscription, Subscription.follower_id == WebUser.id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(Subscription.target_id == current_user.id)
            .order_by(Subscription.created_at.desc())
        )
    ).all()
    out = []
    for u, pp in rows:
        is_public = True if pp is None else bool(pp.is_public)
        if not is_public:
            continue
        out.append({
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "focus_aspects": (pp.focus_aspects if pp else None) or [],
        })
    return out


# ── Heatmap активности ──────────────────────────────────────────────────────
# Возвращает массив [{date: 'YYYY-MM-DD', count: N}] за последние N дней.
# Источники: journey_events (step_completed), web_diary_entries, aspect_insights.
# Один день = объединение всех источников; для GitHub-style визуализации.

@router.get("/profile/{user_id}/heatmap")
async def get_heatmap(
    user_id: int,
    days: int = 180,
    session: AsyncSession = Depends(get_session),
) -> dict:
    days = max(7, min(days, 365))
    target = await session.get(WebUser, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    profile = await session.get(PublicProfile, user_id)
    if profile is not None and profile.is_public is False:
        raise HTTPException(status_code=404, detail="Profile is private")

    from sqlalchemy import or_
    from app.db.models import HabitTick, WebDiaryEntry
    from datetime import timedelta

    since = datetime.utcnow() - timedelta(days=days)
    counts: dict[str, int] = {}

    def add(date_str: str, n: int = 1) -> None:
        counts[date_str] = counts.get(date_str, 0) + n

    # journey_events: web_user_id или telegram_id
    je_conds = [JourneyEvent.web_user_id == target.id]
    if target.telegram_id:
        je_conds.append(JourneyEvent.telegram_id == target.telegram_id)
    je_rows = (
        await session.execute(
            select(JourneyEvent.created_at)
            .where(
                JourneyEvent.type == "step_completed",
                JourneyEvent.created_at >= since,
                or_(*je_conds),
            )
        )
    ).all()
    for (ts,) in je_rows:
        if ts:
            add(ts.strftime("%Y-%m-%d"))

    # diary entries
    diary_rows = (
        await session.execute(
            select(WebDiaryEntry.created_at)
            .where(
                WebDiaryEntry.web_user_id == target.id,
                WebDiaryEntry.created_at >= since,
            )
        )
    ).all()
    for (ts,) in diary_rows:
        if ts:
            add(ts.strftime("%Y-%m-%d"))

    # инсайты
    ins_rows = (
        await session.execute(
            select(AspectInsight.created_at)
            .where(
                AspectInsight.web_user_id == target.id,
                AspectInsight.created_at >= since,
            )
        )
    ).all()
    for (ts,) in ins_rows:
        if ts:
            add(ts.strftime("%Y-%m-%d"))

    # тики практик — самый сильный сигнал ежедневной активности
    since_str = since.strftime("%Y-%m-%d")
    tick_rows = (
        await session.execute(
            select(HabitTick.date)
            .where(
                HabitTick.web_user_id == target.id,
                HabitTick.date >= since_str,
            )
        )
    ).scalars().all()
    for d in tick_rows:
        if d:
            add(d)

    return {
        "user_id": user_id,
        "days": days,
        "from": since.strftime("%Y-%m-%d"),
        "to": datetime.utcnow().strftime("%Y-%m-%d"),
        "data": [{"date": d, "count": c} for d, c in sorted(counts.items())],
    }


# ── Insight comments ─────────────────────────────────────────────────────────
# Полноценные комменты под инсайтом (отличаются от insight_likes.comment —
# тот опц. строка в реакции). DESC by created_at, без вложенности (одноуровневые).
# Notify тип 'insight_comment' — отправляется автору инсайта при чужом комменте.

from app.db.models import InsightComment  # noqa: E402  (рядом с роутами комментов)


class CommentBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.get("/insights/{insight_id}/comments")
async def list_insight_comments(
    insight_id: int,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """Публичный (без auth) — кто угодно может посмотреть тред под публичным инсайтом.
    Под приватным или удалённым инсайтом возвращаем 404.
    """
    insight = await session.get(AspectInsight, insight_id)
    if not insight or insight.is_public is False:
        raise HTTPException(status_code=404, detail="Insight not found")

    rows = (
        await session.execute(
            select(InsightComment, WebUser, PublicProfile)
            .join(WebUser, WebUser.id == InsightComment.web_user_id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(InsightComment.insight_id == insight_id)
            .order_by(InsightComment.created_at.asc())
        )
    ).all()
    out = []
    for c, u, pp in rows:
        out.append({
            "id": c.id,
            "insight_id": c.insight_id,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": pp.avatar if pp else None,
            "text": c.text,
            "created_at": c.created_at.isoformat(),
        })
    return out


@router.post("/insights/{insight_id}/comments")
async def post_insight_comment(
    insight_id: int,
    body: CommentBody,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    insight = await session.get(AspectInsight, insight_id)
    if not insight or insight.is_public is False:
        raise HTTPException(status_code=404, detail="Insight not found")

    cleaned = body.text.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Empty text")

    new_comment = InsightComment(
        insight_id=insight_id,
        web_user_id=current_user.id,
        text=cleaned,
    )
    session.add(new_comment)
    await session.flush()  # получаем id

    # Уведомление автору инсайта (если коммент не от самого автора).
    await notify(
        session,
        user_id=insight.web_user_id,
        type_="insight_comment",
        payload={
            "insight_id": insight_id,
            "comment_id": new_comment.id,
            "actor_id": current_user.id,
            "actor_name": _display_name(current_user),
            "preview": cleaned[:120],
            "insight_preview": (insight.text or "")[:120],
        },
        skip_if_self=current_user.id,
    )
    await bump_streak(session, current_user.id)
    await session.commit()

    return {
        "id": new_comment.id,
        "insight_id": insight_id,
        "user_id": current_user.id,
        "display_name": _display_name(current_user),
        "text": cleaned,
        "created_at": new_comment.created_at.isoformat() if new_comment.created_at else datetime.utcnow().isoformat(),
    }


@router.delete("/insights/{insight_id}/comments/{comment_id}")
async def delete_insight_comment(
    insight_id: int,
    comment_id: int,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Удалить свой комментарий. Автор инсайта тоже может — модерация треда."""
    comment = await session.get(InsightComment, comment_id)
    if not comment or comment.insight_id != insight_id:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.web_user_id != current_user.id:
        # Автор инсайта может тоже удалять (модерация под своим инсайтом).
        insight = await session.get(AspectInsight, insight_id)
        if not insight or insight.web_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")

    await session.delete(comment)
    await session.commit()
    return {"deleted": True, "id": comment_id}
