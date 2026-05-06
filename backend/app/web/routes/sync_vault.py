"""
Двусторонний мост между локальным SLW-Mine vault'ом и веб-БД.

Endpoints (все требуют JWT):

  POST /api/sync/vault/import   — приём массового снимка vault'а (diary,
                                  goals, analytics, template, learnings).
                                  Возвращает counts + list of conflicts.

  GET  /api/sync/vault/export   — отдаёт ZIP в формате Mine vault'а:
                                  diary/YYYY-MM-DD.md, goals/{aspect}.md,
                                  analytics/*.md, template.md, learnings.md.

  GET  /api/sync/vault/diff?since=YYYY-MM-DD
                                — список изменённых на бэке записей с
                                  момента `since`. Используется скриптом
                                  ДО import чтобы детектить конфликты.

Conflict-protocol (по решению юзера):
  Скрипт vault_sync.py перед import делает diff: список записей,
  обновлённых на бэке за время с last_sync_local. Если в его vault'е те же
  даты тоже изменены локально — пишет ОБЕ версии в `vault/conflicts/` и
  оставляет юзеру решать руками.

Дата в Mine хранится в имени файла без года ('04.24 пт.md'). Скрипт сам
определяет default_year по дате модификации файла или из конфига; на
бэк уже шлётся 'YYYY-MM-DD'.
"""
import io
import zipfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AnalyticsReport,
    AspectGoal,
    Emotion,
    Training,
    WebDiaryEntry,
    WebUser,
)
from app.db.session import get_session
from app.web.deps import get_current_user
from app.web.streak import bump_streak

router = APIRouter()

ASPECT_KEYS = {"БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"}


# ── Schemas ─────────────────────────────────────────────────────────────────

class EmotionIn(BaseModel):
    name: str
    intensity: int | None = None
    trigger: str | None = None
    body_sensation: str | None = None
    roots: str | None = None
    lesson: str | None = None
    action: str | None = None


class TrainingIn(BaseModel):
    exercise: str
    sets: int | None = None
    reps: int | None = None
    weight_kg: float | None = None
    notes: str | None = None


class DiaryIn(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    raw_text: str
    extra: dict | None = None
    emotions: list[EmotionIn] = []
    trainings: list[TrainingIn] = []
    # Хеш контента на стороне vault'а для conflict-detection.
    local_hash: str | None = None
    # Время изменения файла на vault'е (UTC ISO).
    local_mtime: str | None = None


class AnalyticsIn(BaseModel):
    type: str = "week"   # 'week' | 'month' | 'custom'
    period_start: str
    period_end: str
    title: str | None = None
    content_md: str


class GoalIn(BaseModel):
    aspect: str
    content_md: str


class VaultImportIn(BaseModel):
    diary: list[DiaryIn] = []
    goals: list[GoalIn] = []
    analytics: list[AnalyticsIn] = []
    template: str | None = None
    learnings: str | None = None
    # Скрипт может сказать «не трогай записи, которые я не прислал».
    # Если False — старые записи в БД остаются. Если True — удаляются.
    replace_all: bool = False


# ── /import ─────────────────────────────────────────────────────────────────

def _content_hash(text: str | None) -> str:
    """Простой stable hash для conflict-detection. SHA1 короче чем SHA256
    и для нашей задачи достаточно — мы сравниваем только наличие изменений.
    """
    import hashlib
    if not text:
        return ""
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


@router.post("/sync/vault/import")
async def import_vault(
    body: VaultImportIn,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    counts = {
        "diary": 0,
        "diary_updated": 0,
        "diary_skipped_conflict": 0,
        "emotions": 0,
        "trainings": 0,
        "goals": 0,
        "analytics": 0,
    }
    conflicts: list[dict] = []

    # ── Дневник ──
    # Один день = одна запись. Если уже есть запись на эту же дату от
    # того же юзера и source='vault' — апдейтим. Если source='web' (юзер
    # писал в вебе) — конфликт, не трогаем, отправляем в conflicts.
    for d in body.diary:
        if not d.date or not d.raw_text.strip():
            continue
        existing = (
            await session.execute(
                select(WebDiaryEntry).where(
                    WebDiaryEntry.web_user_id == current_user.id,
                    WebDiaryEntry.source == "vault",
                    # extra->>'vault_date' = date — уже импорт; иначе по date.
                )
            )
        ).scalars().all()
        same_date = next(
            (e for e in existing
             if isinstance(e.extra, dict) and e.extra.get("vault_date") == d.date),
            None,
        )

        if same_date:
            # Уже была запись из vault — обновляем.
            old_hash = (same_date.extra or {}).get("local_hash")
            new_hash = d.local_hash or _content_hash(d.raw_text)
            if old_hash == new_hash:
                continue  # ничего не изменилось
            same_date.text = d.raw_text
            same_date.aspect = None
            new_extra = dict(same_date.extra or {})
            new_extra.update(d.extra or {})
            new_extra["vault_date"] = d.date
            new_extra["local_hash"] = new_hash
            new_extra["local_mtime"] = d.local_mtime
            same_date.extra = new_extra
            counts["diary_updated"] += 1
            entry_id = same_date.id
        else:
            # Проверка на конфликт: есть ли запись на эту дату из веба?
            web_same_date = (
                await session.execute(
                    select(WebDiaryEntry).where(
                        WebDiaryEntry.web_user_id == current_user.id,
                        WebDiaryEntry.source != "vault",
                    )
                )
            ).scalars().all()
            web_match = next(
                (e for e in web_same_date
                 if e.created_at and e.created_at.strftime("%Y-%m-%d") == d.date),
                None,
            )
            if web_match:
                conflicts.append({
                    "type": "diary",
                    "date": d.date,
                    "web_text": web_match.text,
                    "vault_text": d.raw_text,
                    "reason": "На эту дату есть запись из веба — нужен ручной разбор",
                })
                counts["diary_skipped_conflict"] += 1
                continue

            # Создаём новую запись.
            extra = dict(d.extra or {})
            extra["vault_date"] = d.date
            extra["local_hash"] = d.local_hash or _content_hash(d.raw_text)
            if d.local_mtime:
                extra["local_mtime"] = d.local_mtime
            entry = WebDiaryEntry(
                web_user_id=current_user.id,
                text=d.raw_text,
                aspect=None,
                source="vault",
                extra=extra,
                created_at=_parse_date(d.date) or datetime.utcnow(),
            )
            session.add(entry)
            await session.flush()
            entry_id = entry.id
            counts["diary"] += 1

        # Удаляем старые emotions/trainings этой даты и пишем заново.
        await session.execute(
            delete(Emotion).where(
                Emotion.web_user_id == current_user.id,
                Emotion.date == d.date,
            )
        )
        await session.execute(
            delete(Training).where(
                Training.web_user_id == current_user.id,
                Training.date == d.date,
            )
        )
        for em in d.emotions:
            session.add(Emotion(
                web_user_id=current_user.id,
                diary_entry_id=entry_id,
                date=d.date,
                name=em.name,
                intensity=em.intensity,
                trigger=em.trigger,
                body_sensation=em.body_sensation,
                roots=em.roots,
                lesson=em.lesson,
                action=em.action,
            ))
            counts["emotions"] += 1
        for tr in d.trainings:
            session.add(Training(
                web_user_id=current_user.id,
                diary_entry_id=entry_id,
                date=d.date,
                exercise=tr.exercise,
                sets=tr.sets,
                reps=tr.reps,
                weight_kg=tr.weight_kg,
                notes=tr.notes,
            ))
            counts["trainings"] += 1

    # ── Цели ──
    for g in body.goals:
        if g.aspect not in ASPECT_KEYS:
            continue
        stmt = pg_insert(AspectGoal).values(
            web_user_id=current_user.id,
            aspect=g.aspect,
            content_md=g.content_md,
            updated_at=datetime.utcnow(),
        ).on_conflict_do_update(
            index_elements=["web_user_id", "aspect"],
            set_={"content_md": g.content_md, "updated_at": datetime.utcnow()},
        )
        await session.execute(stmt)
        counts["goals"] += 1

    # ── Аналитика ──
    for a in body.analytics:
        # Идемпотентность по (user, type, period_start, period_end).
        existing = (
            await session.execute(
                select(AnalyticsReport).where(
                    AnalyticsReport.web_user_id == current_user.id,
                    AnalyticsReport.type == a.type,
                    AnalyticsReport.period_start == a.period_start,
                    AnalyticsReport.period_end == a.period_end,
                )
            )
        ).scalar_one_or_none()
        if existing:
            existing.title = a.title
            existing.content_md = a.content_md
            existing.source = "imported"
            existing.updated_at = datetime.utcnow()
        else:
            session.add(AnalyticsReport(
                web_user_id=current_user.id,
                type=a.type,
                period_start=a.period_start,
                period_end=a.period_end,
                source="imported",
                title=a.title,
                content_md=a.content_md,
            ))
        counts["analytics"] += 1

    # ── Шаблон и learnings ──
    if body.template is not None:
        current_user.diary_template = body.template
    if body.learnings is not None:
        current_user.categorization_rules = body.learnings

    if counts["diary"] + counts["diary_updated"] > 0:
        await bump_streak(session, current_user.id)
    await session.commit()

    return {
        "counts": counts,
        "conflicts": conflicts,
        "imported_at": datetime.utcnow().isoformat(),
    }


def _parse_date(s: str) -> Optional[datetime]:
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None


# ── /diff ──────────────────────────────────────────────────────────────────

@router.get("/sync/vault/diff")
async def vault_diff(
    since: str | None = None,
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Что изменилось в БД с момента `since` (ISO timestamp).
    Скрипт vault_sync.py использует это перед import: если на бэке есть
    записи новее last_sync_local — нужен ручной разбор.
    """
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", ""))
        except ValueError:
            since_dt = None

    diary_q = select(WebDiaryEntry).where(WebDiaryEntry.web_user_id == current_user.id)
    if since_dt:
        diary_q = diary_q.where(WebDiaryEntry.created_at >= since_dt)
    diary_rows = (await session.execute(diary_q.order_by(WebDiaryEntry.created_at.desc()))).scalars().all()

    analytics_q = select(AnalyticsReport).where(AnalyticsReport.web_user_id == current_user.id)
    if since_dt:
        analytics_q = analytics_q.where(AnalyticsReport.updated_at >= since_dt)
    analytics_rows = (await session.execute(analytics_q)).scalars().all()

    return {
        "since": since,
        "now": datetime.utcnow().isoformat(),
        "diary": [
            {
                "id": r.id,
                "vault_date": (r.extra or {}).get("vault_date") if isinstance(r.extra, dict) else None,
                "source": r.source,
                "created_at": r.created_at.isoformat(),
                "local_hash": (r.extra or {}).get("local_hash") if isinstance(r.extra, dict) else None,
            }
            for r in diary_rows
        ],
        "analytics": [
            {
                "id": r.id,
                "type": r.type,
                "period_start": r.period_start,
                "period_end": r.period_end,
                "updated_at": r.updated_at.isoformat(),
            }
            for r in analytics_rows
        ],
    }


# ── /export ────────────────────────────────────────────────────────────────

@router.get("/sync/vault/export")
async def export_vault(
    current_user: WebUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """ZIP в структуре Mine vault'а:
        diary/{YYYY-MM-DD}.md
        goals/{aspect}.md
        analytics/{type}-{period_start}--{period_end}.md
        template.md
        learnings.md
        manifest.json — служебная инфа (хеши, last_export)

    Скрипт vault_sync.py распаковывает в локальную папку.
    """
    # Diary.
    diary_rows = (
        await session.execute(
            select(WebDiaryEntry)
            .where(WebDiaryEntry.web_user_id == current_user.id)
            .order_by(WebDiaryEntry.created_at.asc())
        )
    ).scalars().all()

    goals_rows = (
        await session.execute(
            select(AspectGoal).where(AspectGoal.web_user_id == current_user.id)
        )
    ).scalars().all()

    analytics_rows = (
        await session.execute(
            select(AnalyticsReport)
            .where(AnalyticsReport.web_user_id == current_user.id)
            .order_by(AnalyticsReport.period_start.asc())
        )
    ).scalars().all()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "exported_at": datetime.utcnow().isoformat(),
            "user_id": current_user.id,
            "counts": {
                "diary": len(diary_rows),
                "goals": len(goals_rows),
                "analytics": len(analytics_rows),
            },
            "diary_index": [],
        }

        for r in diary_rows:
            # Дата файла: vault_date если был импорт, иначе по created_at.
            extra = r.extra if isinstance(r.extra, dict) else {}
            date_str = extra.get("vault_date") or (
                r.created_at.strftime("%Y-%m-%d") if r.created_at else "undated"
            )
            fname = f"diary/{date_str}.md"
            content = r.text or ""
            # Если записал не из vault — добавляем front-matter про источник.
            if r.source != "vault":
                content = (
                    f"---\nsource: {r.source}\n"
                    f"web_aspect: {r.aspect or '—'}\n"
                    f"created_at: {r.created_at.isoformat() if r.created_at else ''}\n"
                    f"---\n\n{content}"
                )
            zf.writestr(fname, content)
            manifest["diary_index"].append({
                "file": fname,
                "date": date_str,
                "source": r.source,
            })

        for g in goals_rows:
            zf.writestr(f"goals/{g.aspect}.md", g.content_md or "")

        for a in analytics_rows:
            fname = f"analytics/{a.type}-{a.period_start}--{a.period_end}.md"
            zf.writestr(fname, a.content_md or "")

        if current_user.diary_template:
            zf.writestr("templates/template.md", current_user.diary_template)
        if current_user.categorization_rules:
            zf.writestr("skills/skb-coach-skill/learnings.md", current_user.categorization_rules)

        import json as _json
        zf.writestr("manifest.json", _json.dumps(manifest, ensure_ascii=False, indent=2))

    buf.seek(0)
    fname = f"slw-vault-{datetime.utcnow().strftime('%Y-%m-%d')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
