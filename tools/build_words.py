"""
Парсер «упорядоченных» тезаурусов аспектов → JSON для бэка.

ВНИМАНИЕ: с 2026-05 `backend/app/content/words.json` ведётся ВРУЧНУЮ.
Парсер тянул всё подряд (172 слова по ЧЛ, включая «KPI», «SWOT-анализ»,
«ERP-система» — листья и англицизмы, не для «слова дня»). Решение:
~50 курированных слов на аспект (по принципу тиров из БС, см.
`Si/Базовые слова БС.md`).

Этот скрипт оставлен как утилита для будущего парсинга, но
ПО УМОЛЧАНИЮ ПИШЕТ В `words_auto.json` (не в `words.json`),
чтобы случайный запуск не затёр ручную курацию.

Если когда-нибудь захочется автоматизировать снова — выставь
`OUTPUT_FILENAME = "words.json"` ниже и убедись, что фильтр
работает по принципу тиров (см. БС файл).

---

Источник: `тезаурус с определениями/{Имя аспекта} ... упорядочен{ная,ный}*.md`.
Поддерживает два формата:
  • БЛ-стиль: `### Слово` → следующий параграф = определение.
  • ЧЛ-стиль: `* **Слово:**` буллеты → текст после двоеточия.

Выход: `backend/app/content/words_auto.json` со структурой:
  {
    "Si": [
      {
        "word": "...",
        "short_def": "...",     # первое предложение
        "long_def": "...",      # полное определение
        "group": "..."          # из `## N. Group Name` или `**N\\. Group**`
      },
      ...
    ],
    ...
  }

Запуск: `python tools/build_words.py`. Идемпотентен — генерирует одинаковый
JSON при одинаковых .md.

Маппинг файлов на аспекты:
  «Белая Сенсорика (БС)» → Si
  «Чёрная Сенсорика (ЧС)» → Se
  ... и т.д.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# Маппинг кириллических аббревиатур аспектов на латинские ключи (как на фронте).
ASPECT_MAP = {
    "БС": "Si", "ЧС": "Se",
    "БЛ": "Ti", "ЧЛ": "Te",
    "БЭ": "Fi", "ЧЭ": "Fe",
    "БИ": "Ni", "ЧИ": "Ne",
}

# Регэксп для извлечения аббревиатуры аспекта из имени файла.
# Примеры: «Белая Логика (БЛ) - упорядоченная.md», «Черная Логика (ЧЛ) - упорядоченная.md».
ASPECT_FROM_FILENAME = re.compile(r"\(([А-ЯЁ]{2})\)")

# Что считаем «упорядоченным» файлом.
ORDERED_PATTERNS = ("упорядоч",)


def aspect_from_filename(name: str) -> str | None:
    m = ASPECT_FROM_FILENAME.search(name)
    if not m:
        return None
    cyr = m.group(1)
    return ASPECT_MAP.get(cyr)


def first_sentence(text: str, max_len: int = 200) -> str:
    """Первое предложение для short_def. Обрезаем по `.`, `!`, `?` (но не
    по сокращениям типа «и т.д.»). Лимит длины ~200 символов."""
    text = text.strip()
    # Простая эвристика: режем по `. ` (точка + пробел), берём первую часть.
    # Если найдено — обрезаем; если нет — берём весь текст до max_len.
    parts = re.split(r"(?<=[.!?])\s+", text)
    first = parts[0] if parts else text
    if len(first) > max_len:
        # Слишком длинно — режем по словам.
        words = first.split()
        out = []
        total = 0
        for w in words:
            if total + len(w) + 1 > max_len:
                break
            out.append(w)
            total += len(w) + 1
        first = " ".join(out) + "…"
    return first


def normalize_word(raw: str) -> str:
    """Чистит слово от markdown-обёрток (звёздочки, курсив) и trailing-знаков."""
    w = raw.strip()
    # Удаляем bold/italic обёртки.
    w = re.sub(r"\*+", "", w)
    # Удаляем trailing `:` если осталось.
    w = w.rstrip(":：")
    return w.strip()


def strip_md(text: str) -> str:
    """Убирает markdown-обёртки `*курсив*` и `**bold**` из текста определения,
    чтобы фронт не показывал лишние звёздочки. Сохраняет читаемость."""
    if not text:
        return text
    # `**bold**` → `bold`
    text = re.sub(r"\*\*([^*]+?)\*\*", r"\1", text)
    # `*italic*` → `italic`
    text = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"\1", text)
    return text.strip()


def parse_h3_style(text: str) -> list[dict]:
    """Формат `## Group` ... `### Word` ... текст-определение ... `### Word` ...
    Возвращает [{word, short_def, long_def, group}, ...]."""
    out: list[dict] = []
    current_group = ""
    # Разбиваем на блоки по `### ` или `## ` headings.
    # Идём построчно, накапливая текст после `### Word` до следующего heading.
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        # Group: `## N. Name` или `## Name`.
        m_h2 = re.match(r"^##\s+(?:\d+\.\s+)?(.+?)\s*$", line)
        if m_h2 and not line.startswith("###"):
            current_group = m_h2.group(1).strip()
            i += 1
            continue
        # Word: `### Word` (одиночная строка).
        m_h3 = re.match(r"^###\s+(.+?)\s*$", line)
        if m_h3:
            word = normalize_word(m_h3.group(1))
            # Собираем тело до следующего `###` или `##` или `---` или EOF.
            body_lines: list[str] = []
            i += 1
            while i < len(lines):
                ln = lines[i]
                if ln.startswith("### ") or ln.startswith("## ") or ln.startswith("---"):
                    break
                body_lines.append(ln)
                i += 1
            body = "\n".join(body_lines).strip()
            if word and body and len(word) <= 80:
                clean_body = strip_md(body)
                out.append({
                    "word": word,
                    "short_def": first_sentence(clean_body),
                    "long_def": clean_body,
                    "group": current_group,
                })
            continue
        i += 1
    return out


def parse_bullet_style(text: str) -> list[dict]:
    """Формат `* **Word:** определение...`. Используется в ЧЛ-файле.
    Группа берётся из ближайшего `**N\\. Group Name**` параграфа выше."""
    out: list[dict] = []
    current_group = ""
    lines = text.split("\n")
    i = 0
    # Регэкспы для буллет-записей и групп.
    re_bullet = re.compile(r"^\s*\*\s+\*\*([^*]+?):?\*\*\s*(.*)")
    re_group = re.compile(r"^\s*\*\*(\d+\\?\.\s+[^*]+?)\*\*\s*$")
    while i < len(lines):
        line = lines[i]
        m_grp = re_group.match(line)
        if m_grp:
            # `**N\. Group Name**` (escape для . иногда есть)
            g = m_grp.group(1).replace("\\.", ".").strip()
            # Убираем ведущую нумерацию.
            g_clean = re.sub(r"^\d+\.\s*", "", g)
            current_group = g_clean
            i += 1
            continue
        m_bul = re_bullet.match(line)
        if m_bul:
            word = normalize_word(m_bul.group(1))
            inline_def = m_bul.group(2).strip()
            # Подбираем продолжение определения с последующих строк (до пустой
            # или следующего буллета).
            body_extra: list[str] = []
            j = i + 1
            while j < len(lines):
                nxt = lines[j]
                if not nxt.strip():
                    break
                if re_bullet.match(nxt) or nxt.startswith("###") or nxt.startswith("##"):
                    break
                body_extra.append(nxt.strip())
                j += 1
            body = inline_def
            if body_extra:
                body = (body + " " + " ".join(body_extra)).strip()
            if word and body and len(word) <= 80:
                clean_body = strip_md(body)
                out.append({
                    "word": word,
                    "short_def": first_sentence(clean_body),
                    "long_def": clean_body,
                    "group": current_group,
                })
            i = j
            continue
        i += 1
    return out


def parse_file(path: Path) -> list[dict]:
    """Применяет оба парсера и объединяет результаты, удаляя дубли по слову."""
    text = path.read_text(encoding="utf-8")
    entries = parse_h3_style(text) + parse_bullet_style(text)
    # Dedupe по слову (lowercase для устойчивости): оставляем первое вхождение.
    seen: set[str] = set()
    out: list[dict] = []
    for e in entries:
        key = e["word"].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    thesaurus_dir = root / "тезаурус с определениями"
    if not thesaurus_dir.exists():
        print(f"Тезаурус-папка не найдена: {thesaurus_dir}")
        return 1

    by_aspect: dict[str, list[dict]] = {}

    for f in sorted(thesaurus_dir.iterdir()):
        name = f.name
        # Берём только «упорядоченные».
        if not any(p in name for p in ORDERED_PATTERNS):
            continue
        aspect = aspect_from_filename(name)
        if not aspect:
            print(f"  ! не распознал аспект в имени: {name}")
            continue
        entries = parse_file(f)
        if not entries:
            print(f"  ! ноль слов: {name}")
            continue
        by_aspect.setdefault(aspect, []).extend(entries)
        print(f"  ✓ {name} → {aspect}: {len(entries)} слов")

    # Финальная dedupe по аспекту (если из нескольких файлов одного аспекта).
    for asp, lst in by_aspect.items():
        seen: set[str] = set()
        deduped: list[dict] = []
        for e in lst:
            key = e["word"].lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(e)
        by_aspect[asp] = deduped

    # См. шапку модуля: пишем в words_auto.json, а не в words.json
    # (последний — ручная курация, не трогаем).
    OUTPUT_FILENAME = "words_auto.json"
    output_path = root / "backend" / "app" / "content" / OUTPUT_FILENAME
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(by_aspect, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    total = sum(len(v) for v in by_aspect.values())
    print(f"\n→ {output_path}")
    print(f"  Всего: {total} слов по {len(by_aspect)} аспектам:")
    for asp, lst in sorted(by_aspect.items()):
        print(f"    {asp}: {len(lst)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
