"""Admin-only эндпоинты для саппорта и операций.

Гейтится по `web_users.is_admin`. Включает read-only диагностику + ряд
write-операций (restore, promote, impersonate). Все мутации логируют
старое состояние в audit-поля JSONB.

Эндпоинты:
- GET  /api/admin/user-diagnostic — диагностика прогресса юзера
- POST /api/admin/restore-from-diary — восстановить completedScripts из дневника
- GET  /api/admin/users — пагинированный список юзеров
- POST /api/admin/promote — выдать/забрать is_admin
- POST /api/admin/impersonate — выдать JWT от имени другого юзера
- POST /api/admin/rollback-restore — откатить последний restore-from-diary
"""
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Answer,
    JourneyEvent,
    ScriptStep,
    User,
    UserAspectState,
    UserState,
    WebDiaryEntry,
    WebState,
    WebUser,
)
from app.db.session import get_session
from app.web.auth import create_token
from app.web.deps import get_current_user

log = logging.getLogger(__name__)

router = APIRouter(prefix="/admin")


def _require_admin(user: WebUser) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")


async def _find_target(
    session: AsyncSession,
    email: str | None,
    tg_username: str | None,
    display_name: str | None,
    user_id: int | None,
    telegram_id: int | None,
) -> WebUser | None:
    """Найти юзера по любому из переданных критериев. Возвращает первого совпавшего."""
    if user_id is not None:
        return await session.get(WebUser, user_id)

    conditions = []
    if telegram_id is not None:
        conditions.append(WebUser.telegram_id == telegram_id)
    if email:
        conditions.append(WebUser.email == email.strip().lower())
    if tg_username:
        # tg_username может быть с/без @ — снимаем
        clean = tg_username.lstrip("@").strip()
        conditions.append(WebUser.telegram_username == clean)
    if display_name:
        # display_name может быть частичный — ILIKE
        conditions.append(WebUser.display_name.ilike(f"%{display_name.strip()}%"))

    if not conditions:
        return None

    return (await session.execute(
        select(WebUser).where(or_(*conditions)).limit(1)
    )).scalar_one_or_none()


def _summarize_journey(journey: dict | None) -> dict[str, Any]:
    """Сжатый срез web_state.journey: contentVersion + по аспектам level/lengths."""
    if not journey:
        return {"present": False}

    out: dict[str, Any] = {
        "present": True,
        "contentVersion": journey.get("contentVersion"),
        "currentAspect": journey.get("currentAspect"),
        "screen": journey.get("screen"),
        "onboardingStep": journey.get("onboardingStep"),
        "xp": journey.get("xp"),
        "streak": journey.get("streak"),
        "stardust": journey.get("stardust"),
        "totalCompleted": journey.get("totalCompleted"),
        "lastActiveDate": journey.get("lastActiveDate"),
        "skillsCount": len(journey.get("skills") or {}),
    }

    aspects_summary: dict[str, Any] = {}
    aspects = journey.get("aspects") or {}
    for key, folder in aspects.items():
        if not isinstance(folder, dict):
            continue
        aspects_summary[key] = {
            "currentLevel": folder.get("currentLevel"),
            "currentScriptId": folder.get("currentScriptId"),
            "completedScripts": len(folder.get("completedScripts") or []),
            "messages": len(folder.get("messages") or []),
            "pendingTasks": len(folder.get("pendingTasks") or []),
        }
    out["aspects"] = aspects_summary
    return out


@router.get("/user-diagnostic")
async def user_diagnostic(
    email: str | None = Query(None, description="email юзера в web_users"),
    tg_username: str | None = Query(None, description="telegram username (с/без @)"),
    telegram_id: int | None = Query(None, description="прямой telegram user_id"),
    display_name: str | None = Query(None, description="часть display_name (ILIKE)"),
    user_id: int | None = Query(None, description="web_users.id если известен"),
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Срез прогресса юзера для диагностики «сбился прогресс».

    Один из параметров (email / tg_username / telegram_id / display_name / user_id) обязателен.
    """
    _require_admin(current_user)

    if not any([email, tg_username, telegram_id, display_name, user_id]):
        raise HTTPException(
            status_code=400,
            detail="Нужен хотя бы один из: email, tg_username, telegram_id, display_name, user_id",
        )

    target = await _find_target(session, email, tg_username, display_name, user_id, telegram_id)
    if not target:
        raise HTTPException(status_code=404, detail="Юзер не найден")

    # 1. WebState — собственно сломанный journey + history
    web_state = await session.get(WebState, target.id)
    web_state_summary = _summarize_journey(web_state.journey if web_state else None)
    web_state_summary["updated_at"] = (
        web_state.updated_at.isoformat() if web_state and web_state.updated_at else None
    )

    # 2. journey_events — сколько событий и в разрезе аспектов
    event_conditions = [JourneyEvent.web_user_id == target.id]
    if target.telegram_id:
        event_conditions.append(JourneyEvent.telegram_id == target.telegram_id)

    try:
        events_count = (await session.execute(
            select(func.count(JourneyEvent.id)).where(or_(*event_conditions))
        )).scalar_one() or 0

        events_by_aspect_rows = (await session.execute(
            select(JourneyEvent.aspect, JourneyEvent.source, func.count(JourneyEvent.id))
            .where(or_(*event_conditions))
            .group_by(JourneyEvent.aspect, JourneyEvent.source)
        )).all()
        events_by_aspect = [
            {"aspect": aspect, "source": source, "count": count}
            for aspect, source, count in events_by_aspect_rows
        ]

        latest_events_rows = (await session.execute(
            select(JourneyEvent)
            .where(or_(*event_conditions))
            .order_by(JourneyEvent.id.desc())
            .limit(5)
        )).scalars().all()
        latest_events = [
            {
                "id": e.id,
                "source": e.source,
                "type": e.type,
                "aspect": e.aspect,
                "level": e.level,
                "short_id": e.short_id,
                "step_id": e.step_id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in latest_events_rows
        ]
    except Exception as e:
        log.warning("journey_events query failed: %s", e)
        events_count = 0
        events_by_aspect = []
        latest_events = [{"error": str(e)}]

    # 3. Bot-side прогресс (только если есть TG-линк)
    bot_state_summary: dict[str, Any] = {"linked": bool(target.telegram_id)}
    if target.telegram_id:
        bot_user_state = await session.get(UserState, target.telegram_id)
        bot_state_summary["user_state"] = (
            {
                "current_aspect": bot_user_state.current_aspect,
                "current_level": bot_user_state.current_level,
                "current_step_id": bot_user_state.current_step_id,
                "streak_days": bot_user_state.streak_days,
                "last_active_at": (
                    bot_user_state.last_active_at.isoformat()
                    if bot_user_state.last_active_at else None
                ),
            }
            if bot_user_state else None
        )

        aspect_state_rows = (await session.execute(
            select(UserAspectState).where(UserAspectState.telegram_id == target.telegram_id)
        )).scalars().all()
        bot_state_summary["user_aspect_state"] = [
            {
                "aspect": row.aspect,
                "current_step_id": row.current_step_id,
                "finished": row.finished,
                "last_active_at": (
                    row.last_active_at.isoformat() if row.last_active_at else None
                ),
            }
            for row in aspect_state_rows
        ]

        # Сколько ответов на B-вопросы юзер дал в боте — это потенциально
        # реконструируемая часть прогресса (видим, какие шаги пройдены).
        answers_count = (await session.execute(
            select(func.count(Answer.id)).where(Answer.user_id == target.telegram_id)
        )).scalar_one() or 0
        bot_state_summary["answers_count"] = answers_count

        # Чтобы понять, насколько активна юзер в боте — берём данные из users
        bot_user = await session.get(User, target.telegram_id)
        bot_state_summary["bot_user"] = (
            {
                "username": bot_user.username,
                "first_name": bot_user.first_name,
                "created_at": bot_user.created_at.isoformat() if bot_user.created_at else None,
            }
            if bot_user else None
        )

    # 4. Дневник — главный источник косвенных следов
    diary_count = (await session.execute(
        select(func.count(WebDiaryEntry.id)).where(WebDiaryEntry.web_user_id == target.id)
    )).scalar_one() or 0

    diary_by_aspect_rows = (await session.execute(
        select(WebDiaryEntry.aspect, WebDiaryEntry.source, func.count(WebDiaryEntry.id))
        .where(WebDiaryEntry.web_user_id == target.id)
        .group_by(WebDiaryEntry.aspect, WebDiaryEntry.source)
    )).all()
    diary_by_aspect = [
        {"aspect": aspect, "source": source, "count": count}
        for aspect, source, count in diary_by_aspect_rows
    ]

    # Записи с привязкой к scriptId (journey-survey-statement) — самые ценные
    # для реконструкции, потому что точно показывают пройденные шаги.
    diary_with_script_rows = (await session.execute(
        select(WebDiaryEntry)
        .where(WebDiaryEntry.web_user_id == target.id)
        .order_by(WebDiaryEntry.id.desc())
        .limit(50)
    )).scalars().all()
    diary_script_refs: list[dict[str, Any]] = []
    for row in diary_with_script_rows:
        extra = row.extra or {}
        script_id = extra.get("scriptId")
        if script_id:
            diary_script_refs.append({
                "diary_id": row.id,
                "aspect": row.aspect,
                "scriptId": script_id,
                "promptTitle": extra.get("promptTitle"),
                "source": row.source,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            })

    diary_summary = {
        "count": diary_count,
        "by_aspect_source": diary_by_aspect,
        "with_script_refs_last_50": diary_script_refs,
    }

    # 5. Рекомендация по сценарию восстановления
    recommendation = _build_recommendation(
        web_state_summary, events_count, bot_state_summary, diary_summary
    )

    return {
        "user": {
            "id": target.id,
            "email": target.email,
            "telegram_id": target.telegram_id,
            "telegram_username": target.telegram_username,
            "telegram_first_name": target.telegram_first_name,
            "display_name": target.display_name,
            "is_admin": target.is_admin,
            "created_at": target.created_at.isoformat() if target.created_at else None,
        },
        "web_state": web_state_summary,
        "events": {
            "count": events_count,
            "by_aspect_source": events_by_aspect,
            "latest": latest_events,
        },
        "bot": bot_state_summary,
        "diary": diary_summary,
        "recommendation": recommendation,
    }


def _build_recommendation(
    web_state: dict, events_count: int, bot: dict, diary: dict
) -> dict[str, Any]:
    """Эвристика выбора стратегии восстановления."""
    linked = bot.get("linked", False)
    aspect_state = bot.get("user_aspect_state") or []
    has_bot_progress = any(row.get("current_step_id") for row in aspect_state) or bool(
        (bot.get("user_state") or {}).get("current_step_id") if isinstance(bot.get("user_state"), dict) else False
    )
    journey_present = web_state.get("present", False)
    aspects = web_state.get("aspects") or {}
    sum_completed_scripts = sum(
        (folder.get("completedScripts") or 0) for folder in aspects.values()
    )
    has_web_progress = sum_completed_scripts > 0
    total_completed = web_state.get("totalCompleted") or 0
    # Drift = глобальный totalCompleted сильно больше суммы completedScripts
    # по аспектам. Это значит, что прогресс был, но completedScripts стёрся
    # (например при CONTENT_VERSION bump до v25). Порог 10 — чтобы не ловить
    # шумные расхождения на 1-2 скрипта.
    data_drift = total_completed - sum_completed_scripts > 10
    diary_has_script_refs = len(diary.get("with_script_refs_last_50") or []) > 0

    if data_drift and diary_has_script_refs:
        scenario = "data_drift_recoverable"
        action = (
            f"totalCompleted={total_completed} сильно больше суммы completedScripts="
            f"{sum_completed_scripts} — прогресс был стёрт (вероятно при бампе "
            "CONTENT_VERSION). В дневнике есть scriptId — восстанавливаемо через "
            "POST /api/admin/restore-from-diary."
        )
    elif data_drift and not diary_has_script_refs:
        scenario = "data_drift_partial"
        action = (
            f"totalCompleted={total_completed} больше суммы completedScripts="
            f"{sum_completed_scripts}, но scriptId-ссылок в дневнике нет. "
            "Восстановить точные шаги нельзя, можно поднять currentLevel вручную."
        )
    elif events_count > 0 and not has_web_progress:
        scenario = "events_present_but_not_merged"
        action = (
            "В journey_events есть записи, но web_state.completedScripts пуст. "
            "Скорее всего фронт не запускает мёрдж — попроси юзера сделать "
            "hard reload (Ctrl+F5) или logout/login. Если не помогло — нужен "
            "ручной restore из events."
        )
    elif linked and has_bot_progress and events_count == 0:
        scenario = "bot_progress_no_events"
        action = (
            "У юзера есть прогресс в боте (user_aspect_state), но events ещё не "
            "сгенерированы. Бэкфилл должен сработать при следующем GET /api/events. "
            "Попроси её перезайти в веб."
        )
    elif linked and has_bot_progress and events_count > 0 and has_web_progress:
        scenario = "all_synced"
        action = "Всё на месте — events и веб state синхронизированы. Проблема в чём-то ещё."
    elif not linked and not has_web_progress and diary_has_script_refs:
        scenario = "diary_only_recovery"
        action = (
            "TG не залинкован, веб state пуст, но в дневнике есть scriptId-ссылки. "
            "Реконструкция возможна вручную: собрать список scriptId из дневника, "
            "проставить как completedScripts + currentLevel = max(level из scriptId)."
        )
    elif not linked and not has_web_progress and not diary_has_script_refs:
        scenario = "data_lost"
        action = (
            "Прогресс восстановить не из чего: TG не залинкован, web state пуст, "
            "дневник не содержит scriptId. Можно только вручную выставить уровень "
            "по аспектам по количеству записей дневника и беседе с юзером."
        )
    elif has_web_progress and not journey_present:
        scenario = "ghost_progress"
        action = "Парадокс — есть прогресс, но web_state нет. Скорее всего ошибка в данных."
    else:
        scenario = "unclear"
        action = "Сценарий не определён, нужен ручной разбор данных."

    return {
        "scenario": scenario,
        "action": action,
        "signals": {
            "tg_linked": linked,
            "has_bot_progress": has_bot_progress,
            "events_count": events_count,
            "has_web_progress": has_web_progress,
            "sum_completedScripts": sum_completed_scripts,
            "totalCompleted": total_completed,
            "data_drift": data_drift,
            "diary_has_script_refs": diary_has_script_refs,
            "web_state_present": journey_present,
            "web_content_version": web_state.get("contentVersion"),
        },
    }


# ── Restore from diary ──────────────────────────────────────────────────────
# Маппинг кириллических кодов аспектов из web_diary_entries.aspect на латинские
# ключи в web_state.journey.aspects.
CYR_TO_LAT_ASPECT = {
    "БС": "Si",
    "ЧС": "Se",
    "БЛ": "Ti",
    "ЧЛ": "Te",
    "БЭ": "Fi",
    "ЧЭ": "Fe",
    "БИ": "Ni",
    "ЧИ": "Ne",
}

# Скрипты «итог уровня» — их наличие в дневнике говорит о факте закрытия L0.
# R-1..R-3 — стандартные имена рефлексий в L0 каждого аспекта.
LEVEL_COMPLETE_MARKERS = {0: {"R-2", "R-3"}}


def _detect_completed_level(scripts: set[str]) -> int:
    """Возвращает максимально подтверждённый L по набору пройденных скриптов.

    Эвристика: для L0 — наличие R-2 («Итоги уровня») или R-3 («Намерение»)
    означает закрытие уровня. L1/L2/L3 — не реализовано (нужен контент-маркер).
    """
    if scripts & LEVEL_COMPLETE_MARKERS[0]:
        return 1  # L0 закрыт → следующий уровень 1
    return 0


@router.post("/restore-from-diary")
async def restore_from_diary(
    payload: dict = Body(...),
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Восстановить web_state.journey.aspects[X].completedScripts из дневника.

    Тело запроса:
        {
            "telegram_id": 2057105065,  // или email, или user_id
            "dry_run": true,            // default true
            "bump_levels": true,        // default true — поднимать currentLevel при R-2/R-3
        }

    Действие:
    1. Находит юзера
    2. Собирает все extra.scriptId из web_diary_entries, группирует по аспекту
    3. Маппит кириллицу → латиницу
    4. Мёрджит в completedScripts (set-объединение, не дубли)
    5. Если bump_levels=true и есть R-2/R-3 → currentLevel = max(current, 1)
    6. Если не dry_run → пишет в БД, бэкап старого journey в _backup_before_restore
    7. Возвращает diff: per-aspect added scripts, level before/after, applied flag

    Гейтится по is_admin.
    """
    _require_admin(current_user)

    email = payload.get("email")
    tg_username = payload.get("tg_username")
    telegram_id = payload.get("telegram_id")
    display_name = payload.get("display_name")
    user_id = payload.get("user_id")
    dry_run = payload.get("dry_run", True)
    bump_levels = payload.get("bump_levels", True)

    if not any([email, tg_username, telegram_id, display_name, user_id]):
        raise HTTPException(
            status_code=400,
            detail="Нужен хотя бы один из: email, tg_username, telegram_id, display_name, user_id",
        )

    target = await _find_target(session, email, tg_username, display_name, user_id, telegram_id)
    if not target:
        raise HTTPException(status_code=404, detail="Юзер не найден")

    web_state = await session.get(WebState, target.id)
    if not web_state or not web_state.journey:
        raise HTTPException(
            status_code=409,
            detail="У юзера нет web_state.journey — нечего восстанавливать (juniety пуст)",
        )

    # 1. Собрать scriptId из дневника
    diary_rows = (await session.execute(
        select(WebDiaryEntry).where(WebDiaryEntry.web_user_id == target.id)
    )).scalars().all()

    scripts_by_aspect: dict[str, set[str]] = {}
    diary_aspects_seen: set[str] = set()
    for row in diary_rows:
        extra = row.extra or {}
        script_id = extra.get("scriptId")
        cyr_aspect = row.aspect
        if not script_id or not cyr_aspect:
            continue
        diary_aspects_seen.add(cyr_aspect)
        lat_aspect = CYR_TO_LAT_ASPECT.get(cyr_aspect)
        if not lat_aspect:
            # Например 'general', 'onboarding' — пропускаем
            continue
        scripts_by_aspect.setdefault(lat_aspect, set()).add(script_id)

    # 2. Сформировать diff и новый journey
    journey = dict(web_state.journey)
    journey_aspects = dict(journey.get("aspects") or {})

    per_aspect_diff: list[dict[str, Any]] = []
    any_changes = False

    for lat_aspect, diary_scripts in scripts_by_aspect.items():
        folder = dict(journey_aspects.get(lat_aspect) or {})
        existing_scripts = set(folder.get("completedScripts") or [])
        merged_scripts = existing_scripts | diary_scripts
        added_scripts = sorted(diary_scripts - existing_scripts)

        current_level_before = folder.get("currentLevel") or 0
        detected_level = _detect_completed_level(merged_scripts)
        current_level_after = (
            max(current_level_before, detected_level) if bump_levels else current_level_before
        )

        if added_scripts or current_level_after != current_level_before:
            any_changes = True

        per_aspect_diff.append({
            "aspect": lat_aspect,
            "completedScripts_before": sorted(existing_scripts),
            "completedScripts_added": added_scripts,
            "completedScripts_after": sorted(merged_scripts),
            "currentLevel_before": current_level_before,
            "currentLevel_after": current_level_after,
        })

        # Готовим обновлённую папку для записи (использвается только если не dry_run)
        folder["completedScripts"] = sorted(merged_scripts)
        if bump_levels and current_level_after != current_level_before:
            folder["currentLevel"] = current_level_after
        journey_aspects[lat_aspect] = folder

    journey["aspects"] = journey_aspects

    # 3. Список аспектов из дневника, которые мы не смогли смаппить
    unmapped_aspects = sorted(
        a for a in diary_aspects_seen
        if a not in CYR_TO_LAT_ASPECT and a not in ("general", "onboarding")
    )

    result: dict[str, Any] = {
        "user": {
            "id": target.id,
            "email": target.email,
            "telegram_id": target.telegram_id,
        },
        "dry_run": dry_run,
        "bump_levels": bump_levels,
        "applied": False,
        "any_changes": any_changes,
        "diff_by_aspect": per_aspect_diff,
        "unmapped_diary_aspects": unmapped_aspects,
    }

    # 4. Применить, если не dry_run и есть изменения
    if not dry_run and any_changes:
        # Бэкап старого journey в audit-поле перед перезаписью.
        # Очищаем _backup_before_restore из original_journey, чтобы вложенные
        # бэкапы не разрастались (последний restore «съест» предыдущие).
        original_journey = {
            k: v for k, v in (web_state.journey or {}).items()
            if k != "_backup_before_restore"
        }
        journey["_backup_before_restore"] = {
            "at": datetime.utcnow().isoformat(),
            "by_admin_id": current_user.id,
            "previous_journey": original_journey,
        }
        web_state.journey = journey
        web_state.updated_at = datetime.utcnow()
        await session.commit()
        result["applied"] = True

    return result


# ── Users list ──────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    limit: int = Query(50, ge=1, le=200, description="Сколько вернуть (max 200)"),
    offset: int = Query(0, ge=0),
    search: str | None = Query(
        None, description="Подстрока для поиска по email/display_name/tg_username"
    ),
    sort: str = Query(
        "recent",
        description="recent | xp | created — порядок сортировки",
    ),
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Пагинированный список юзеров с метриками: XP, completedScripts, lastActiveDate.

    Гейтится по is_admin. Берёт данные из web_users LEFT JOIN web_state.
    """
    _require_admin(current_user)

    base = select(WebUser, WebState).outerjoin(WebState, WebState.web_user_id == WebUser.id)

    if search:
        pattern = f"%{search.strip()}%"
        base = base.where(or_(
            WebUser.email.ilike(pattern),
            WebUser.display_name.ilike(pattern),
            WebUser.telegram_username.ilike(pattern),
            WebUser.telegram_first_name.ilike(pattern),
        ))

    if sort == "created":
        base = base.order_by(desc(WebUser.created_at))
    elif sort == "xp":
        # JSONB-сортировка по xp — fallback на created_at при null.
        base = base.order_by(
            desc(WebState.journey["xp"].astext.cast_to(__import__("sqlalchemy").Integer)),
            desc(WebUser.created_at),
        )
    else:
        # recent — по updated_at WebState, затем по created_at юзера
        base = base.order_by(desc(WebState.updated_at), desc(WebUser.created_at))

    total = (await session.execute(
        select(func.count(WebUser.id)).where(
            WebUser.id.in_(select(WebUser.id).where(
                or_(
                    WebUser.email.ilike(f"%{search.strip()}%") if search else True,
                    WebUser.display_name.ilike(f"%{search.strip()}%") if search else True,
                    WebUser.telegram_username.ilike(f"%{search.strip()}%") if search else True,
                    WebUser.telegram_first_name.ilike(f"%{search.strip()}%") if search else True,
                ) if search else True
            ))
        )
    )).scalar_one() or 0

    rows = (await session.execute(base.limit(limit).offset(offset))).all()

    users_out: list[dict[str, Any]] = []
    for user_row, state_row in rows:
        journey = (state_row.journey if state_row else None) or {}
        aspects = journey.get("aspects") or {}
        sum_completed = sum(
            len((folder or {}).get("completedScripts") or [])
            for folder in aspects.values()
        )
        users_out.append({
            "id": user_row.id,
            "email": user_row.email,
            "telegram_id": user_row.telegram_id,
            "telegram_username": user_row.telegram_username,
            "telegram_first_name": user_row.telegram_first_name,
            "display_name": user_row.display_name,
            "is_admin": user_row.is_admin,
            "created_at": user_row.created_at.isoformat() if user_row.created_at else None,
            "updated_at": (
                state_row.updated_at.isoformat()
                if state_row and state_row.updated_at else None
            ),
            "xp": journey.get("xp") or 0,
            "totalCompleted": journey.get("totalCompleted") or 0,
            "sum_completedScripts": sum_completed,
            "currentAspect": journey.get("currentAspect"),
            "lastActiveDate": journey.get("lastActiveDate"),
            "contentVersion": journey.get("contentVersion"),
            "skillsCount": len(journey.get("skills") or {}),
        })

    return {
        "users": users_out,
        "limit": limit,
        "offset": offset,
        "total": total,
    }


# ── Promote / demote admin ──────────────────────────────────────────────────

@router.post("/promote")
async def promote_user(
    payload: dict = Body(...),
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Выдать или забрать is_admin у другого юзера.

    Тело: { "user_id" | "email" | "telegram_id" | "tg_username", "is_admin": bool }

    Защита от самовыстрела: нельзя забрать админа у себя через этот endpoint.
    """
    _require_admin(current_user)

    target = await _find_target(
        session,
        email=payload.get("email"),
        tg_username=payload.get("tg_username"),
        display_name=None,
        user_id=payload.get("user_id"),
        telegram_id=payload.get("telegram_id"),
    )
    if not target:
        raise HTTPException(status_code=404, detail="Юзер не найден")

    new_value = bool(payload.get("is_admin", True))

    if target.id == current_user.id and not new_value:
        raise HTTPException(
            status_code=400,
            detail="Нельзя самому себе забрать админа через этот endpoint",
        )

    old_value = target.is_admin
    target.is_admin = new_value
    await session.commit()

    log.info(
        "admin promote: %s set is_admin=%s for user_id=%s (was %s)",
        current_user.email or current_user.id, new_value, target.id, old_value,
    )
    return {
        "user_id": target.id,
        "email": target.email,
        "telegram_id": target.telegram_id,
        "is_admin_before": old_value,
        "is_admin_after": new_value,
    }


# ── Impersonate ─────────────────────────────────────────────────────────────

@router.post("/impersonate")
async def impersonate_user(
    payload: dict = Body(...),
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Выдать JWT от имени другого юзера — позволяет админу увидеть UI так,
    как видит юзер. Используй с осторожностью: токен реален и пишет от его лица.

    Тело: { "user_id" | "email" | "telegram_id" | "tg_username" }
    """
    _require_admin(current_user)

    target = await _find_target(
        session,
        email=payload.get("email"),
        tg_username=payload.get("tg_username"),
        display_name=None,
        user_id=payload.get("user_id"),
        telegram_id=payload.get("telegram_id"),
    )
    if not target:
        raise HTTPException(status_code=404, detail="Юзер не найден")

    token = create_token(target.id)
    log.warning(
        "admin impersonate: %s issued token for user_id=%s",
        current_user.email or current_user.id, target.id,
    )
    return {
        "user": {
            "id": target.id,
            "email": target.email,
            "display_name": target.display_name,
            "telegram_id": target.telegram_id,
        },
        "token": token,
        "warning": "Этот токен действует как полноценный логин юзера. Не пиши от его имени.",
    }


# ── Rollback restore ────────────────────────────────────────────────────────

@router.post("/rollback-restore")
async def rollback_restore(
    payload: dict = Body(...),
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Откатить последний restore-from-diary к сохранённому бэкапу.

    Тело: { "user_id" | "email" | "telegram_id" | "tg_username" }
    """
    _require_admin(current_user)

    target = await _find_target(
        session,
        email=payload.get("email"),
        tg_username=payload.get("tg_username"),
        display_name=None,
        user_id=payload.get("user_id"),
        telegram_id=payload.get("telegram_id"),
    )
    if not target:
        raise HTTPException(status_code=404, detail="Юзер не найден")

    web_state = await session.get(WebState, target.id)
    if not web_state or not web_state.journey:
        raise HTTPException(status_code=409, detail="Нет web_state для отката")

    backup = (web_state.journey or {}).get("_backup_before_restore")
    if not backup or not backup.get("previous_journey"):
        raise HTTPException(
            status_code=409,
            detail="В web_state.journey нет _backup_before_restore — откатывать нечего",
        )

    web_state.journey = backup["previous_journey"]
    web_state.updated_at = datetime.utcnow()
    await session.commit()

    log.info(
        "admin rollback-restore: %s rolled back user_id=%s (backup made at %s)",
        current_user.email or current_user.id, target.id, backup.get("at"),
    )
    return {
        "user_id": target.id,
        "rolled_back_to": backup.get("at"),
        "by_admin_id": backup.get("by_admin_id"),
    }
