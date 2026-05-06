#!/usr/bin/env python3
"""
SLW Vault Sync — двусторонний мост между локальным SLW-Mine vault'ом
и веб-приложением SLW.

Использование:
  python tools/vault_sync.py import        # vault → веб (через POST)
  python tools/vault_sync.py export        # веб → vault (распаковывает ZIP)
  python tools/vault_sync.py diff          # показать что изменилось на бэке
  python tools/vault_sync.py status        # быстрая проверка соединения

Конфиг через переменные окружения (или .env-файл рядом со скриптом):
  SLW_BACKEND   — URL бэка, например https://slw-production.up.railway.app
  SLW_TOKEN     — JWT (скопировать из браузера: localStorage.slw_token)
  SLW_VAULT     — абсолютный путь к локальному SLW-Mine vault'у
  SLW_YEAR      — год для имён файлов '04.24 пт.md' (default: текущий)

Conflict-protocol:
  Если на бэке за время с последней синхронизации появились/изменились
  записи на ту же дату, что и в локальном vault — скрипт пишет в
  vault/conflicts/{date}-{type}.md ОБЕ версии и не трогает БД для этой
  даты. Юзер разруливает руками.

Зависимости:
  requests   (`pip install requests`)
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("Нужен пакет requests. Поставь: pip install requests", file=sys.stderr)
    sys.exit(1)


# ── Конфиг ──────────────────────────────────────────────────────────────────

def _load_env_file() -> None:
    """Простой ручной load .env (без зависимости от python-dotenv)."""
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env_file()


def _config() -> dict:
    backend = os.environ.get("SLW_BACKEND", "").rstrip("/")
    token = os.environ.get("SLW_TOKEN", "").strip()
    vault = os.environ.get("SLW_VAULT", "").strip()
    year = os.environ.get("SLW_YEAR", str(datetime.now().year))
    if not backend or not token or not vault:
        print("Не хватает конфига. Создай tools/.env со значениями:", file=sys.stderr)
        print("  SLW_BACKEND=https://slw-production.up.railway.app", file=sys.stderr)
        print("  SLW_TOKEN=<JWT из localStorage.slw_token>", file=sys.stderr)
        print("  SLW_VAULT=/абсолютный/путь/к/SLW-Mine", file=sys.stderr)
        sys.exit(2)
    if not Path(vault).is_dir():
        print(f"SLW_VAULT не существует или не папка: {vault}", file=sys.stderr)
        sys.exit(2)
    return {"backend": backend, "token": token, "vault": vault, "year": int(year)}


def _headers(cfg: dict) -> dict:
    return {
        "Authorization": f"Bearer {cfg['token']}",
        "Content-Type": "application/json",
    }


# ── Парсер диария (минимальная копия backend/app/sync/parser.py) ───────────
# Зависимостей не хочется, поэтому небольшой дубль.

_FNAME_RE = re.compile(r"^(\d{2})\.(\d{2})(?:\s+\S+)?$", re.IGNORECASE)
_ISO_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def _parse_date(stem: str, year: int) -> str | None:
    m = _ISO_RE.match(stem)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = _FNAME_RE.match(stem)
    if m:
        return f"{year}-{m.group(1)}-{m.group(2)}"
    return None


_EMO_FIELDS = {
    "эмоция": "name", "интенсивность": "intensity", "триггер": "trigger",
    "ощущение": "body_sensation", "ощущения": "body_sensation",
    "корни": "roots", "урок": "lesson", "что сделал": "action",
    "что сделала": "action",
}


def _parse_table_row(line: str):
    if not line.startswith("|"):
        return None
    parts = [p.strip() for p in line.strip().strip("|").split("|")]
    if len(parts) < 2:
        return None
    val = parts[1]
    if val in ("—", "-", "–", ""):
        val = ""
    return parts[0].lower(), val


def _parse_emotions(md: str) -> list[dict]:
    out = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        row = _parse_table_row(lines[i])
        if row and row[0] == "эмоция" and row[1] and row[1] not in ("название", "<название>"):
            cur = {"name": row[1]}
            j = i + 1
            while j < len(lines):
                nx = _parse_table_row(lines[j])
                if not nx:
                    break
                key, val = nx
                if set(val) <= {"-", " "}:
                    j += 1
                    continue
                if key == "эмоция":
                    break
                if key in ("поле", "значение"):
                    j += 1
                    continue
                attr = _EMO_FIELDS.get(key)
                if attr:
                    if attr == "intensity":
                        m = re.search(r"\d+", val)
                        if m:
                            cur["intensity"] = int(m.group())
                    else:
                        cur[attr] = val or None
                j += 1
            if cur.get("name"):
                out.append(cur)
            i = j
        else:
            i += 1
    return out


_TRAIN_RE = re.compile(
    r"^[\-\*•]\s*(?P<exercise>.+?)\s+(?P<sets>\d+)\s*[x×]\s*(?P<reps>\d+)"
    r"(?:\s*[x×@]\s*(?P<weight>\d+(?:[.,]\d+)?))?",
    re.UNICODE,
)


def _parse_trainings(md: str) -> list[dict]:
    out = []
    in_section = False
    for line in md.splitlines():
        st = line.strip()
        if re.match(r"^#+\s+тренировк", st, re.IGNORECASE) or \
           re.match(r"^\*\*\s*тренировк", st, re.IGNORECASE):
            in_section = True
            continue
        if in_section and st.startswith("#"):
            in_section = False
            continue
        if not in_section:
            continue
        m = _TRAIN_RE.match(line)
        if m:
            w = None
            if m.group("weight"):
                try:
                    w = float(m.group("weight").replace(",", "."))
                except ValueError:
                    pass
            out.append({
                "exercise": m.group("exercise").strip(),
                "sets": int(m.group("sets")),
                "reps": int(m.group("reps")),
                "weight_kg": w,
            })
    return out


def _parse_meta(md: str) -> dict:
    head = md[:1500]
    out: dict = {}
    m = re.search(r"(?:общая\s+)?энергия\s*[:\-]\s*(\d+)", head, re.IGNORECASE)
    if m:
        out["energy"] = int(m.group(1))
    m = re.search(r"коф[еэ]\s*[:\-]\s*(\d+)", head, re.IGNORECASE)
    if m:
        out["coffee"] = int(m.group(1))
    m = re.search(r"сон\s*[:\-]\s*(.+?)(?:\n|$)", head, re.IGNORECASE)
    if m:
        out["sleep"] = m.group(1).strip()
    return out


def _hash(text: str) -> str:
    return hashlib.sha1((text or "").encode("utf-8")).hexdigest()


# ── Сборщик payload ────────────────────────────────────────────────────────

ASPECTS = {"БС", "БЭ", "БЛ", "БИ", "ЧС", "ЧЭ", "ЧЛ", "ЧИ"}


def _collect_diary(vault: Path, year: int) -> list[dict]:
    folder = vault / "diary"
    if not folder.is_dir():
        return []
    out = []
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() != ".md":
            continue
        date = _parse_date(path.stem, year)
        if not date:
            print(f"  ! пропускаю {path.name} — не распознали дату")
            continue
        text = path.read_text(encoding="utf-8")
        out.append({
            "date": date,
            "raw_text": text,
            "extra": _parse_meta(text),
            "emotions": _parse_emotions(text),
            "trainings": _parse_trainings(text),
            "local_hash": _hash(text),
            "local_mtime": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
        })
    return out


_GOAL_FNAME_RE = re.compile(r"^(БС|БЭ|БЛ|БИ|ЧС|ЧЭ|ЧЛ|ЧИ)(?:\b|[\-_])", re.IGNORECASE)


def _collect_goals(vault: Path) -> list[dict]:
    folder = vault / "goals"
    if not folder.is_dir():
        return []
    out = []
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() != ".md":
            continue
        m = _GOAL_FNAME_RE.match(path.stem)
        if not m:
            continue  # tasks.md, README.md etc.
        out.append({
            "aspect": m.group(1).upper(),
            "content_md": path.read_text(encoding="utf-8"),
        })
    return out


# Имя файла аналитики Mine: '29.03-05.04.md', 'Месяц 29.03-24.04.md'.
_ANALYTICS_RE = re.compile(
    r"^(?:(?P<prefix>месяц|неделя|month|week)\s+)?"
    r"(?P<sd>\d{2})\.(?P<sm>\d{2})-(?P<ed>\d{2})\.(?P<em>\d{2})$",
    re.IGNORECASE,
)


def _collect_analytics(vault: Path, year: int) -> list[dict]:
    folder = vault / "analytics"
    if not folder.is_dir():
        return []
    out = []
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() != ".md":
            continue
        m = _ANALYTICS_RE.match(path.stem)
        if not m:
            continue
        sd = f"{year}-{m.group('sm')}-{m.group('sd')}"
        ed = f"{year}-{m.group('em')}-{m.group('ed')}"
        prefix = (m.group("prefix") or "").lower()
        report_type = "month" if prefix in ("месяц", "month") else "week"
        out.append({
            "type": report_type,
            "period_start": sd,
            "period_end": ed,
            "title": path.stem,
            "content_md": path.read_text(encoding="utf-8"),
        })
    return out


def _collect_template(vault: Path) -> str | None:
    p = vault / "templates" / "template.md"
    if p.is_file():
        return p.read_text(encoding="utf-8")
    return None


def _collect_learnings(vault: Path) -> str | None:
    p = vault / "skills" / "skb-coach-skill" / "learnings.md"
    if p.is_file():
        return p.read_text(encoding="utf-8")
    return None


# ── Команды ────────────────────────────────────────────────────────────────

def cmd_status(cfg: dict) -> int:
    """Quick connectivity check."""
    try:
        r = requests.get(f"{cfg['backend']}/healthz", timeout=10)
        r.raise_for_status()
    except Exception as e:
        print(f"backend unreachable: {e}", file=sys.stderr)
        return 1
    try:
        r = requests.get(f"{cfg['backend']}/api/auth/me", headers=_headers(cfg), timeout=10)
        r.raise_for_status()
    except Exception as e:
        print(f"токен не валиден: {e}", file=sys.stderr)
        return 1
    user = r.json()
    print(f"OK · backend={cfg['backend']} user={user.get('email') or user.get('display_name')}")
    print(f"vault={cfg['vault']}")
    return 0


def cmd_diff(cfg: dict, args) -> int:
    params = {}
    if args.since:
        params["since"] = args.since
    r = requests.get(
        f"{cfg['backend']}/api/sync/vault/diff",
        headers=_headers(cfg),
        params=params,
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    print(f"diary changed:    {len(data.get('diary', []))}")
    print(f"analytics changed:{len(data.get('analytics', []))}")
    if args.verbose:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0


def cmd_import(cfg: dict, args) -> int:
    """Vault → backend. Перед import делаем diff и проверяем коллизии."""
    vault = Path(cfg["vault"])
    year = cfg["year"]

    print(f"Сканирую vault: {vault}")
    diary = _collect_diary(vault, year)
    goals = _collect_goals(vault)
    analytics = _collect_analytics(vault, year)
    template = _collect_template(vault)
    learnings = _collect_learnings(vault)

    print(f"  diary:     {len(diary)}")
    print(f"  goals:     {len(goals)}")
    print(f"  analytics: {len(analytics)}")
    print(f"  template:  {'yes' if template else 'no'}")
    print(f"  learnings: {'yes' if learnings else 'no'}")

    if args.dry_run:
        print("dry-run — на бэк ничего не отправляем")
        return 0

    payload = {
        "diary": diary,
        "goals": goals,
        "analytics": analytics,
        "template": template,
        "learnings": learnings,
    }
    print(f"Шлю на {cfg['backend']}/api/sync/vault/import…")
    r = requests.post(
        f"{cfg['backend']}/api/sync/vault/import",
        headers=_headers(cfg),
        json=payload,
        timeout=120,
    )
    if r.status_code >= 400:
        print(f"ошибка {r.status_code}: {r.text}", file=sys.stderr)
        return 1
    res = r.json()
    print("Готово. Counts:")
    for k, v in (res.get("counts") or {}).items():
        print(f"  {k}: {v}")

    conflicts = res.get("conflicts") or []
    if conflicts:
        print(f"\n⚠ конфликтов: {len(conflicts)} — пишу в {vault}/conflicts/")
        cdir = vault / "conflicts"
        cdir.mkdir(exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        for c in conflicts:
            d = c.get("date", "undated")
            fname = cdir / f"{d}-{ts}.md"
            fname.write_text(
                f"# Conflict on {d}\n\n"
                f"{c.get('reason', '')}\n\n"
                f"## Версия из веба\n\n{c.get('web_text', '—')}\n\n"
                f"## Версия из vault'а\n\n{c.get('vault_text', '—')}\n",
                encoding="utf-8",
            )
            print(f"  {fname}")
    return 0


def cmd_export(cfg: dict, args) -> int:
    """Backend → vault. Скачиваем ZIP и распаковываем."""
    print(f"Запрашиваю ZIP с {cfg['backend']}…")
    r = requests.get(
        f"{cfg['backend']}/api/sync/vault/export",
        headers={"Authorization": f"Bearer {cfg['token']}"},
        timeout=120,
    )
    if r.status_code >= 400:
        print(f"ошибка {r.status_code}: {r.text}", file=sys.stderr)
        return 1

    target = Path(args.target) if args.target else Path(cfg["vault"])
    target.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        names = zf.namelist()
        print(f"В архиве: {len(names)} файлов. Распаковываю в {target}…")
        for name in names:
            dest = target / name
            if args.merge and dest.exists():
                # Merge mode: не перезаписываем существующие файлы.
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(name) as src, open(dest, "wb") as dst:
                dst.write(src.read())
    print("Готово.")
    return 0


# ── CLI ────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(prog="vault_sync", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="проверить соединение и токен")

    p_diff = sub.add_parser("diff", help="что изменилось на бэке")
    p_diff.add_argument("--since", help="ISO timestamp, например 2026-04-20T00:00:00")
    p_diff.add_argument("-v", "--verbose", action="store_true")

    p_imp = sub.add_parser("import", help="отправить vault → бэк")
    p_imp.add_argument("--dry-run", action="store_true",
                       help="только распарсить, ничего не отправлять")

    p_exp = sub.add_parser("export", help="скачать с бэка → vault")
    p_exp.add_argument("--target", help="папка для распаковки (default: vault)")
    p_exp.add_argument("--merge", action="store_true",
                       help="не перезаписывать существующие файлы")

    args = parser.parse_args()
    cfg = _config()

    if args.cmd == "status":
        return cmd_status(cfg)
    if args.cmd == "diff":
        return cmd_diff(cfg, args)
    if args.cmd == "import":
        return cmd_import(cfg, args)
    if args.cmd == "export":
        return cmd_export(cfg, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
