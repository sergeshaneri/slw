"""
CLI: python -m app.content.build
Reads Si/level_0/ .md files, writes app/content/compiled.json.
Run this after editing .md files.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent.parent  # slw-slw-instruct/
SI_L0 = ROOT / "Si" / "level_0"
OUT = Path(__file__).parent / "compiled.json"

# Ordered mapping: (subfolder, filename_prefix) → (kind, title)
L0_BS_STEPS: list[tuple[str, str, str, str]] = [
    ("misc",          "01_planet_intro",       "info",          "Планета БС"),
    ("misc",          "02_welcome",            "info",          "Добро пожаловать"),
    ("misc",          "03_level_goal",         "info",          "Цель уровня"),
    ("theory",        "01_phenomenology",      "info",          "Что такое БС"),
    ("theory",        "02_key_questions",      "info",          "Ключевые вопросы"),
    ("theory",        "03_metaphors",          "info",          "Метафоры"),
    ("theory",        "04_shadow_gift_intro",  "info",          "Тень и дар"),
    ("questions",     "01_first_contact",      "open_question", "Первый контакт"),
    ("questions",     "02_current_state",      "open_question", "Текущее состояние"),
    ("exercises_now", "01_attention_basic",    "exercise_ack",  "Практика внимания"),
    ("exercises_now", "02_environment_audit",  "exercise_ack",  "Аудит среды"),
]


def _find_file(subfolder: str, prefix: str) -> Path | None:
    folder = SI_L0 / subfolder
    for f in folder.glob(f"{prefix}*.md"):
        return f
    return None


def _extract_title(text: str, fallback: str) -> str:
    m = re.search(r"^#\s+(.+)", text, re.MULTILINE)
    return m.group(1).strip() if m else fallback


def build() -> None:
    steps = []
    for ord_idx, (subfolder, prefix, kind, default_title) in enumerate(L0_BS_STEPS, start=1):
        path = _find_file(subfolder, prefix)
        if path is None:
            print(f"WARN: not found {subfolder}/{prefix}*.md")
            continue
        body = path.read_text(encoding="utf-8")
        title = _extract_title(body, default_title)
        step_id = f"bs_L0_{subfolder}_{prefix}"
        steps.append({
            "id": step_id,
            "aspect": "БС",
            "level": 0,
            "ord": ord_idx,
            "kind": kind,
            "source_file": str(path.relative_to(ROOT)),
            "title": title,
            "body_md": body,
            "meta": None,
        })

    OUT.write_text(json.dumps(steps, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: wrote {len(steps)} steps → {OUT}")


if __name__ == "__main__":
    build()
