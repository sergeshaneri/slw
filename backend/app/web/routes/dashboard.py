"""
Dashboard — главный экран для залогиненных юзеров. Один endpoint собирает
все данные сразу: меньше round-trip'ов, нет «мерцания» блоков.

  GET /api/dashboard

Возвращает: profile (имя, аватар, фокус-аспекты), streak, habits с
ticked_today, scores, прогресс уровня для актуального аспекта (фокус
или самый продвинутый), карточка коуча, последние уведомления, лента
подписок ИЛИ топ-авторы для рекомендации, мини-heatmap 30 дней,
слово дня, текущий "active aspect" (для приветственного блока).
"""
import logging
from collections import Counter
from datetime import date, datetime, timedelta
from random import Random

log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AspectInsight,
    CoachCall,
    DirectMessage,
    HabitTick,
    InsightLike,
    JourneyEvent,
    Notification,
    PublicProfile,
    Subscription,
    UserHabit,
    UserStreak,
    WebDiaryEntry,
    WebScore,
    WebState,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user

router = APIRouter()

ASPECT_KEYS = ["БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"]


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def _display_name(user: WebUser) -> str:
    if user.display_name:
        return user.display_name
    if user.telegram_first_name:
        return user.telegram_first_name
    if user.email:
        return user.email.split("@")[0]
    return f"user{user.id}"


# ── Слово дня ────────────────────────────────────────────────────────────────
# Курируемая подборка цитат, разбитая по аспектам. Frontend hallContent.js
# тоже её содержит, но дашборд не загружает контент-конфиг — поэтому держим
# минимальную зеркальную копию здесь.

_QUOTES_BY_ASPECT = {
    "ЧИ": [
        ("Воображение важнее знания.", "Альберт Эйнштейн"),
        ("Возможное — это то, что ещё не доказало свою невозможность.", "Артур Кларк"),
    ],
    "БС": [
        ("Прежде чем познавать звёзды — научись чувствовать тело.", "народная мудрость"),
        ("Простота — это высшая форма утончённости.", "Леонардо да Винчи"),
    ],
    "БЭ": [
        ("Любовь — это бесконечное прощение, проявленное в нежном взгляде.", "Питер Устинов"),
    ],
    "БЛ": [
        ("Ясность — самая лучшая форма уважения к собеседнику.", "Нассим Талеб"),
    ],
    "БИ": [
        ("Время — самая редкая валюта.", "Жан де Лабрюйер"),
    ],
    "ЧС": [
        ("Сила — это способность не уступать себе.", "современный коуч"),
    ],
    "ЧЭ": [
        ("Эмоция — это твой способ присутствовать.", "Торкель Ландгрен"),
    ],
    "ЧЛ": [
        ("Сделанное лучше идеального.", "инженерная мудрость"),
    ],
}


_CYR_TO_LAT_LOCAL = {
    "БС": "Si", "ЧС": "Se",
    "БЛ": "Ti", "ЧЛ": "Te",
    "БЭ": "Fi", "ЧЭ": "Fe",
    "БИ": "Ni", "ЧИ": "Ne",
}


def _word_of_day(focus_aspects: list[str]) -> dict:
    """Слово дня. Сначала пытаемся взять из тезаурус-словаря (words.json,
    сгенерирован парсером из «упорядоченных» .md). Если для выбранного
    аспекта слов нет — fallback на курируемые цитаты (_QUOTES_BY_ASPECT).

    Привязано к дате (YYYY-MM-DD) — за один день не меняется, все юзеры
    видят одно слово (хорошо для шеринга и обсуждений в холле).
    """
    from app.web.routes.words import get_words_for_aspect

    today = _today()
    seed = sum(ord(c) for c in today)
    rng = Random(seed)
    pool_aspects = focus_aspects or list(_QUOTES_BY_ASPECT.keys())
    aspect = rng.choice(pool_aspects)

    # Берём список «упорядоченных» слов для аспекта (latin-ключ).
    aspect_latin = _CYR_TO_LAT_LOCAL.get(aspect, aspect)
    words = get_words_for_aspect(aspect_latin)
    if words:
        w = rng.choice(words)
        return {
            "aspect": aspect,
            "kind": "word",
            "word": w.get("word"),
            "short_def": w.get("short_def"),
            "long_def": w.get("long_def"),
            "group": w.get("group"),
            # Сохраняем text/author для back-compat — фронт сначала смотрит
            # на kind='word', потом fallback на text/author.
            "text": w.get("short_def"),
            "author": "",
        }

    # Fallback на цитаты, если words.json пуст для этого аспекта.
    quotes = _QUOTES_BY_ASPECT.get(aspect) or _QUOTES_BY_ASPECT["ЧИ"]
    text, author = rng.choice(quotes)
    return {"aspect": aspect, "kind": "quote", "text": text, "author": author}


# ── Подбор актуального аспекта ──────────────────────────────────────────────

async def _resolve_active_aspect(
    session: AsyncSession,
    user: WebUser,
    focus_aspects: list[str],
) -> str | None:
    """Что показывать как «актуальный аспект» юзера:
      1) если задан focus_aspects[0] — он
      2) иначе — самый продвинутый по числу пройденных шагов
      3) иначе — None (предложим «выбери сферу»)
    """
    if focus_aspects:
        return focus_aspects[0]

    je_conds = [JourneyEvent.web_user_id == user.id]
    if user.telegram_id:
        je_conds.append(JourneyEvent.telegram_id == user.telegram_id)
    rows = (
        await session.execute(
            select(JourneyEvent.aspect, func.count())
            .where(
                JourneyEvent.type == "step_completed",
                JourneyEvent.aspect.is_not(None),
                or_(*je_conds),
            )
            .group_by(JourneyEvent.aspect)
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()
    if rows and rows[0]:
        return rows[0]

    # Fallback на journey-state.completedScripts: если фронт когда-то писал
    # туда префиксы аспектов — выводим самый частый.
    state = await session.get(WebState, user.id)
    if state and isinstance(state.journey, dict):
        cs = state.journey.get("completedScripts")
        if isinstance(cs, list) and cs:
            counts = Counter()
            for sid in cs:
                if isinstance(sid, str):
                    # Скрипт-id обычно начинается с 'bs-', 'chi-', 'bl-' и т.д.
                    # У нас полный mapping в registry.js, но достаточно префикса.
                    prefix = sid.split("-")[0].upper() if "-" in sid else None
                    if prefix in {"BS", "CHI", "BL", "BE", "BI", "CHS", "CHE", "CHL"}:
                        counts[prefix] += 1
            if counts:
                top, _ = counts.most_common(1)[0]
                return {
                    "BS": "БС", "CHI": "ЧИ", "BL": "БЛ", "BE": "БЭ",
                    "BI": "БИ", "CHS": "ЧС", "CHE": "ЧЭ", "CHL": "ЧЛ",
                }.get(top)
    return None


async def _level_progress_for_aspect(
    session: AsyncSession,
    user: WebUser,
    aspect: str,
) -> dict:
    """Прогресс уровня по конкретному аспекту: число пройденных шагов в
    journey_events. Без жёсткой нормализации (порог уровней — TODO когда
    появятся скрипты уровней)."""
    conds = [JourneyEvent.web_user_id == user.id]
    if user.telegram_id:
        conds.append(JourneyEvent.telegram_id == user.telegram_id)
    count = int((
        await session.execute(
            select(func.count(func.distinct(JourneyEvent.id)))
            .where(
                and_(
                    JourneyEvent.type == "step_completed",
                    JourneyEvent.aspect == aspect,
                    or_(*conds),
                )
            )
        )
    ).scalar_one())
    return {"aspect": aspect, "completed_steps": count}


# ── Лента подписок / рекомендации авторов ───────────────────────────────────

async def _subs_feed(
    session: AsyncSession,
    user: WebUser,
    limit: int = 5,
) -> list:
    """Свежие инсайты от тех на кого подписан юзер."""
    sub_ids = (
        await session.execute(
            select(Subscription.target_id).where(Subscription.follower_id == user.id)
        )
    ).scalars().all()
    if not sub_ids:
        return []

    rows = (
        await session.execute(
            select(AspectInsight, WebUser, PublicProfile)
            .join(WebUser, WebUser.id == AspectInsight.web_user_id)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(
                AspectInsight.is_public.is_(True),
                AspectInsight.web_user_id.in_(sub_ids),
            )
            .order_by(AspectInsight.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        {
            "id": ins.id,
            "aspect": ins.aspect,
            "kind": ins.kind,
            "text": ins.text,
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "created_at": ins.created_at.isoformat(),
        }
        for ins, u, pp in rows
    ]


async def _suggested_authors(
    session: AsyncSession,
    user: WebUser,
    limit: int = 5,
) -> list:
    """Рекомендованные авторы для подписки: публичные юзеры с наибольшей
    активностью (insights × 5 + reactions_received), исключая себя и тех
    на кого уже подписан. Плюс юзеры без инсайтов в выдачу не попадают."""
    already = set((
        await session.execute(
            select(Subscription.target_id).where(Subscription.follower_id == user.id)
        )
    ).scalars().all())
    already.add(user.id)

    # Counts: insights и likes_received per юзер.
    insight_counts = dict(
        (await session.execute(
            select(AspectInsight.web_user_id, func.count())
            .where(AspectInsight.is_public.is_(True))
            .group_by(AspectInsight.web_user_id)
        )).all()
    )
    like_counts = dict(
        (await session.execute(
            select(AspectInsight.web_user_id, func.count(InsightLike.insight_id))
            .join(InsightLike, InsightLike.insight_id == AspectInsight.id)
            .where(AspectInsight.is_public.is_(True))
            .group_by(AspectInsight.web_user_id)
        )).all()
    )

    # Загружаем кандидатов.
    candidate_ids = [int(uid) for uid in insight_counts if int(uid) not in already]
    if not candidate_ids:
        return []
    rows = (
        await session.execute(
            select(WebUser, PublicProfile)
            .outerjoin(PublicProfile, PublicProfile.web_user_id == WebUser.id)
            .where(WebUser.id.in_(candidate_ids))
            .where(or_(PublicProfile.is_public.is_(None), PublicProfile.is_public.is_(True)))
        )
    ).all()

    items = []
    for u, pp in rows:
        ic = int(insight_counts.get(u.id, 0))
        lc = int(like_counts.get(u.id, 0))
        score = ic * 5 + lc
        if score <= 0:
            continue
        items.append({
            "user_id": u.id,
            "display_name": _display_name(u),
            "avatar": (pp.avatar if pp else None),
            "focus_aspects": (pp.focus_aspects if pp else None) or [],
            "insights_count": ic,
            "likes_received": lc,
            "score": score,
        })
    items.sort(key=lambda x: x["score"], reverse=True)
    return items[:limit]


# ── Heatmap 30 days ─────────────────────────────────────────────────────────

async def _heatmap_30d(session: AsyncSession, user: WebUser) -> list:
    days = 30
    since = datetime.utcnow() - timedelta(days=days)
    counts: dict[str, int] = {}

    def add(d: str) -> None:
        counts[d] = counts.get(d, 0) + 1

    je_conds = [JourneyEvent.web_user_id == user.id]
    if user.telegram_id:
        je_conds.append(JourneyEvent.telegram_id == user.telegram_id)
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

    diary_rows = (
        await session.execute(
            select(WebDiaryEntry.created_at)
            .where(
                WebDiaryEntry.web_user_id == user.id,
                WebDiaryEntry.created_at >= since,
            )
        )
    ).all()
    for (ts,) in diary_rows:
        if ts:
            add(ts.strftime("%Y-%m-%d"))

    ins_rows = (
        await session.execute(
            select(AspectInsight.created_at)
            .where(
                AspectInsight.web_user_id == user.id,
                AspectInsight.created_at >= since,
            )
        )
    ).all()
    for (ts,) in ins_rows:
        if ts:
            add(ts.strftime("%Y-%m-%d"))

    since_str = since.strftime("%Y-%m-%d")
    tick_rows = (
        await session.execute(
            select(HabitTick.date)
            .where(
                HabitTick.web_user_id == user.id,
                HabitTick.date >= since_str,
            )
        )
    ).scalars().all()
    for d in tick_rows:
        if d:
            add(d)

    return [{"date": d, "count": c} for d, c in sorted(counts.items())]


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    today = _today()

    # Профиль и аватар.
    pp = await session.get(PublicProfile, current_user.id)
    focus_aspects = (pp.focus_aspects if pp and isinstance(pp.focus_aspects, list) else None) or []

    # Стрик.
    streak_row = await session.get(UserStreak, current_user.id)
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    if streak_row is None:
        streak_status = "none"
        streak_payload = {
            "current": 0, "longest": 0, "last_active_date": None,
            "shield_until": None, "status": "none",
        }
    else:
        if streak_row.last_active_date == today:
            streak_status = "ticked_today"
        elif streak_row.last_active_date == yesterday:
            streak_status = "due_today"
        elif streak_row.shield_until and streak_row.shield_until >= today:
            streak_status = "shielded"
        elif streak_row.last_active_date is None:
            streak_status = "none"
        else:
            streak_status = "broken"
        streak_payload = {
            "current": int(streak_row.current or 0),
            "longest": int(streak_row.longest or 0),
            "last_active_date": streak_row.last_active_date,
            "shield_until": streak_row.shield_until,
            "status": streak_status,
        }

    # Привычки + сегодняшние тики.
    habit_rows = (
        await session.execute(
            select(UserHabit).where(UserHabit.web_user_id == current_user.id)
        )
    ).scalars().all()
    today_ticks = set((
        await session.execute(
            select(HabitTick.aspect)
            .where(HabitTick.web_user_id == current_user.id, HabitTick.date == today)
        )
    ).scalars().all())
    habits_payload = [
        {
            "aspect": h.aspect,
            "title": h.title,
            "exercise_id": h.exercise_id,
            "ticked_today": h.aspect in today_ticks,
        }
        for h in habit_rows
    ]
    extra_ticks = sorted([a for a in today_ticks if not any(h.aspect == a for h in habit_rows)])

    # Оценки 8 аспектов.
    score_rows = (
        await session.execute(
            select(WebScore).where(WebScore.web_user_id == current_user.id)
        )
    ).scalars().all()
    scores = {r.aspect: float(r.value) for r in score_rows}

    # Активный аспект и прогресс.
    active_aspect = await _resolve_active_aspect(session, current_user, focus_aspects)
    level_progress = (
        await _level_progress_for_aspect(session, current_user, active_aspect)
        if active_aspect else None
    )

    # Общее число пройденных шагов — для empty-state «начни путешествие»
    # и для гейта ИИ-коуча (нужно ≥5).
    je_conds = [JourneyEvent.web_user_id == current_user.id]
    if current_user.telegram_id:
        je_conds.append(JourneyEvent.telegram_id == current_user.telegram_id)
    server_steps = int((
        await session.execute(
            select(func.count(func.distinct(JourneyEvent.id)))
            .where(
                JourneyEvent.type == "step_completed",
                or_(*je_conds),
            )
        )
    ).scalar_one())
    # Frontend journey.completedScripts тоже учитываем (фронт там мерджит
    # web+bot). Берём max.
    web_state = await session.get(WebState, current_user.id)
    scripts_steps = 0
    if web_state and isinstance(web_state.journey, dict):
        cs_root = web_state.journey.get("completedScripts")
        if isinstance(cs_root, list):
            scripts_steps = max(scripts_steps, len(cs_root))
        # Per-aspect: aspects[*].completedScripts.
        aspects_map = web_state.journey.get("aspects")
        if isinstance(aspects_map, dict):
            total = 0
            for v in aspects_map.values():
                if isinstance(v, dict):
                    cs = v.get("completedScripts")
                    if isinstance(cs, list):
                        total += len(cs)
            scripts_steps = max(scripts_steps, total)
    total_steps_completed = max(server_steps, scripts_steps)

    # Коуч-карточка.
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    coach_used = int((
        await session.execute(
            select(func.count())
            .select_from(CoachCall)
            .where(
                CoachCall.web_user_id == current_user.id,
                CoachCall.paid_with_stardust.is_(False),
                CoachCall.created_at >= today_start,
                CoachCall.error.is_(None),
            )
        )
    ).scalar_one())
    streak_days_for_quota = int(streak_row.current) if streak_row else 0
    bonus = 2 if streak_days_for_quota >= 14 else 1 if streak_days_for_quota >= 7 else 0
    coach_payload = {
        "used_today": coach_used,
        "daily_limit": 1 + bonus,
        "remaining_today": max((1 + bonus) - coach_used, 0),
        "streak_bonus": bonus,
    }

    # Уведомления — счётчик + последние 3.
    unread_count = int((
        await session.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.web_user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        )
    ).scalar_one())
    last_notifs = (
        await session.execute(
            select(Notification)
            .where(Notification.web_user_id == current_user.id)
            .order_by(Notification.id.desc())
            .limit(3)
        )
    ).scalars().all()
    notif_payload = {
        "unread_count": unread_count,
        "latest": [
            {
                "id": n.id,
                "type": n.type,
                "payload": n.payload,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in last_notifs
        ],
    }

    # Непрочитанные ЛС — для бейджа на карточке "Сообщения".
    dm_unread = int((
        await session.execute(
            select(func.count())
            .select_from(DirectMessage)
            .where(
                DirectMessage.recipient_id == current_user.id,
                DirectMessage.read_at.is_(None),
            )
        )
    ).scalar_one())

    # Лента подписок ИЛИ топ-авторы.
    feed = await _subs_feed(session, current_user, limit=5)
    suggested = await _suggested_authors(session, current_user, limit=5) if not feed else []

    # Heatmap 30d.
    heatmap = await _heatmap_30d(session, current_user)

    # Слово дня.
    word = _word_of_day(focus_aspects)

    # DiscoverMore: количество публичных инсайтов + срез сегодняшних
    # дневниковых записей по источникам (для карточки "запиши день"
    # ищем 'daily-review' в этой мапе). Любой из этих блоков — best-effort:
    # если запрос упал (например, новая колонка в БД ещё не создана при
    # первом старте после деплоя) — не валим весь dashboard, просто
    # отдаём дефолты.
    pub_insights_count = 0
    diary_today_count_by_source: dict[str, int] = {}
    following_count = 0

    try:
        pub_insights_count = int((
            await session.execute(
                select(func.count())
                .select_from(AspectInsight)
                .where(
                    AspectInsight.web_user_id == current_user.id,
                    AspectInsight.is_public.is_(True),
                )
            )
        ).scalar_one())
    except Exception as e:
        log.warning("dashboard pub_insights_count failed: %s", e)

    try:
        # Передаём date-объект, а не ISO-строку: postgres иначе может
        # ругнуться `operator does not exist: date = unknown` (asyncpg
        # bind-param приходит без типа).
        today_date = date.today()
        diary_today_rows = (
            await session.execute(
                select(WebDiaryEntry.source, func.count())
                .where(
                    WebDiaryEntry.web_user_id == current_user.id,
                    func.date(WebDiaryEntry.created_at) == today_date,
                )
                .group_by(WebDiaryEntry.source)
            )
        ).all()
        diary_today_count_by_source = {row[0]: int(row[1]) for row in diary_today_rows}
    except Exception as e:
        log.warning("dashboard diary_today_count_by_source failed: %s", e)

    try:
        following_count = int((
            await session.execute(
                select(func.count())
                .select_from(Subscription)
                .where(Subscription.follower_id == current_user.id)
            )
        ).scalar_one())
    except Exception as e:
        log.warning("dashboard following_count failed: %s", e)

    # Кладём bio/avatar в data.user, чтобы DiscoverMore мог понять,
    # заполнен ли профиль (карточка "Заполни профиль").
    return {
        "today": today,
        "user": {
            "user_id": current_user.id,
            "display_name": _display_name(current_user),
            "avatar": (pp.avatar if pp else None),
            "bio": (pp.bio if pp else None),
            "focus_aspects": focus_aspects,
            "following_count": following_count,
            "onboarding_done": bool(getattr(current_user, "onboarding_done", False)),
            "hints_seen": dict(getattr(current_user, "hints_seen", None) or {}),
        },
        "streak": streak_payload,
        "habits": habits_payload,
        "extra_ticks": extra_ticks,
        "scores": scores,
        "active_aspect": active_aspect,
        "level_progress": level_progress,
        "total_steps_completed": total_steps_completed,
        "is_newbie": total_steps_completed == 0,
        "coach_unlocked": total_steps_completed >= 5,
        "coach": coach_payload,
        "notifications": notif_payload,
        "dm_unread_count": dm_unread,
        "subs_feed": feed,
        "suggested_authors": suggested,
        "heatmap_30d": heatmap,
        "word_of_day": word,
        "published_insights_count": pub_insights_count,
        "diary_today_count_by_source": diary_today_count_by_source,
    }
