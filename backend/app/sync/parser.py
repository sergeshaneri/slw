"""
Парсер диарийных markdown-файлов в формате SLW-Mine.

См. PIPELINE.md §4 (Поток A) и templates/template.md в SLW-Mine vault.
Каждый день — один .md с секциями:
  • Метаданные (дата, общая энергия, сон)
  • Мини-лог (нарратив утро/день/вечер/ночь)
  • Глубокий лог эмоций (таблицы — каждая эмоция = отдельная таблица 7 строк)
  • Тренировки
  • Кофе-трекинг
  • Очищение и здоровье
  • Финансы
  • Все 8 сфер (Колесо Баланса)
  • Рефлексия

Парсер достаёт:
  - raw text целиком → web_diary_entries.text
  - emotions[] → отдельная таблица
  - trainings[] → отдельная таблица
  - extra dict (energy, sleep, coffee, finances) → web_diary_entries.extra

Принцип: «лучше пропустить чем неправильно категоризировать» — если паттерн
не распознан, остаётся в raw text без структурирования.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ParsedEmotion:
    name: str
    intensity: int | None = None
    trigger: str | None = None
    body_sensation: str | None = None
    roots: str | None = None
    lesson: str | None = None
    action: str | None = None


@dataclass
class ParsedTraining:
    exercise: str
    sets: int | None = None
    reps: int | None = None
    weight_kg: float | None = None
    notes: str | None = None


@dataclass
class ParsedDiary:
    date: str                           # 'YYYY-MM-DD'
    raw_text: str                       # markdown целиком
    emotions: list[ParsedEmotion] = field(default_factory=list)
    trainings: list[ParsedTraining] = field(default_factory=list)
    extra: dict = field(default_factory=dict)


# ── Дата из имени файла ─────────────────────────────────────────────────────

# Mine: '04.24 пт.md' → 2026-04-24 (год берём из default_year или контекста)
_FNAME_RE = re.compile(r"^(\d{2})\.(\d{2})(?:\s+\S+)?(?:\.md)?$", re.IGNORECASE)
# Альтернатива: '2026-04-24.md', '04.24-2026.md' и пр.
_ISO_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:\s|\.md|$)")


def parse_date_from_filename(name: str, default_year: int) -> str | None:
    """Возвращает 'YYYY-MM-DD' или None если не распознали."""
    name = name.strip()
    m = _ISO_RE.match(name)
    if m:
        y, mo, d = m.group(1), m.group(2), m.group(3)
        return f"{y}-{mo}-{d}"
    m = _FNAME_RE.match(name)
    if m:
        mo, d = m.group(1), m.group(2)
        return f"{default_year}-{mo}-{d}"
    return None


# ── Эмоции ──────────────────────────────────────────────────────────────────

# Эмоция в Mine — это таблица из 7 строк:
#   | Поле | Значение |
#   |------|----------|
#   | Эмоция | <название> |
#   | Интенсивность | <1-10 или —> |
#   | Триггер | ... |
#   ...
# Парсим по заголовку «Эмоция | <название>» и ищем 6 строк после.

_EMO_FIELD_MAP = {
    "эмоция":         "name",
    "интенсивность":  "intensity",
    "триггер":        "trigger",
    "ощущение":       "body_sensation",
    "ощущения":       "body_sensation",
    "корни":          "roots",
    "урок":           "lesson",
    "что сделал":     "action",
    "что сделала":    "action",
}


def _parse_table_row(line: str) -> tuple[str, str] | None:
    """| key | value | → (key, value), normalised lowercase для key."""
    if not line.startswith("|"):
        return None
    parts = [p.strip() for p in line.strip().strip("|").split("|")]
    if len(parts) < 2:
        return None
    key = parts[0].lower()
    val = parts[1]
    # Прочерк / тире / em-dash → None.
    if val in ("—", "-", "–", "", "—"):
        val = ""
    return key, val


def parse_emotions(md: str) -> list[ParsedEmotion]:
    """Скан по строкам: ищем «| Эмоция | <непусто>» и собираем 6 следующих
    строк-полей. Завершаем эмоцию когда встречаем разделитель / новую таблицу.
    """
    emotions: list[ParsedEmotion] = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        row = _parse_table_row(lines[i])
        if row and row[0] == "эмоция" and row[1] and row[1] not in ("название", "<название>"):
            # Старт эмоции.
            current = ParsedEmotion(name=row[1])
            j = i + 1
            while j < len(lines):
                next_row = _parse_table_row(lines[j])
                if not next_row:
                    break
                key, val = next_row
                # Пропускаем разделители (---) — это вторая строка таблицы.
                if set(val) <= {"-", " "}:
                    j += 1
                    continue
                if key == "эмоция":
                    break  # начало следующей эмоции
                if key in ("поле", "значение"):
                    j += 1
                    continue
                attr = _EMO_FIELD_MAP.get(key)
                if attr:
                    if attr == "intensity":
                        try:
                            current.intensity = int(re.search(r"\d+", val).group())
                        except (AttributeError, ValueError):
                            pass
                    else:
                        setattr(current, attr, val or None)
                j += 1
            if current.name:
                emotions.append(current)
            i = j
        else:
            i += 1
    return emotions


# ── Тренировки ──────────────────────────────────────────────────────────────

# Mine-формат свободный, обычно списком:
#   - приседания 3×10
#   - отжимания 4×15
# Или таблица:
#   | Упражнение | Подходы | Повторы | Вес |
#   | присед     | 3       | 10      | 60  |

_TRAIN_LINE_RE = re.compile(
    r"^[\-\*•]\s*(?P<exercise>.+?)\s+"
    r"(?P<sets>\d+)\s*[x×]\s*(?P<reps>\d+)"
    r"(?:\s*[x×@]\s*(?P<weight>\d+(?:[.,]\d+)?))?",
    re.UNICODE,
)


def parse_trainings(md: str) -> list[ParsedTraining]:
    """Идём по секции «Тренировки» (## Тренировки или **Тренировки**),
    пока не встретим следующий заголовок. Ищем строки вида:
       - присед 3×10
       - присед 3×10×60
    """
    trainings: list[ParsedTraining] = []
    lines = md.splitlines()
    in_section = False
    for line in lines:
        stripped = line.strip()
        # Заходим в секцию.
        if re.match(r"^#+\s+тренировк", stripped, re.IGNORECASE) or \
           re.match(r"^\*\*\s*тренировк", stripped, re.IGNORECASE):
            in_section = True
            continue
        # Выход — следующий заголовок.
        if in_section and stripped.startswith("#"):
            in_section = False
            continue
        if not in_section:
            continue
        m = _TRAIN_LINE_RE.match(line)
        if m:
            weight = None
            if m.group("weight"):
                try:
                    weight = float(m.group("weight").replace(",", "."))
                except ValueError:
                    pass
            trainings.append(ParsedTraining(
                exercise=m.group("exercise").strip(),
                sets=int(m.group("sets")),
                reps=int(m.group("reps")),
                weight_kg=weight,
            ))
            continue
        # Опционально: строка-таблица `| присед | 3 | 10 | 60 |`.
        if stripped.startswith("|") and stripped.count("|") >= 4:
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if cells and not all(set(c) <= {"-", " "} for c in cells):
                # Первый cell — упражнение, второй — sets, третий — reps,
                # четвёртый (опц.) — вес.
                if cells[0].lower() in ("упражнение", "exercise"):
                    continue
                ex = cells[0]
                if not ex:
                    continue
                try:
                    sets = int(cells[1]) if len(cells) > 1 and cells[1].isdigit() else None
                except (ValueError, IndexError):
                    sets = None
                try:
                    reps = int(cells[2]) if len(cells) > 2 and cells[2].isdigit() else None
                except (ValueError, IndexError):
                    reps = None
                weight = None
                if len(cells) > 3:
                    try:
                        weight = float(cells[3].replace(",", "."))
                    except ValueError:
                        pass
                trainings.append(ParsedTraining(
                    exercise=ex,
                    sets=sets,
                    reps=reps,
                    weight_kg=weight,
                ))
    return trainings


# ── Метаданные ──────────────────────────────────────────────────────────────

_META_PATTERNS = {
    "energy":  re.compile(r"(?:общая\s+)?энергия\s*[:\-]\s*(\d+)", re.IGNORECASE),
    "sleep":   re.compile(r"сон\s*[:\-]\s*(.+?)(?:\n|$)", re.IGNORECASE),
    "coffee":  re.compile(r"коф[еэ]\s*[:\-]\s*(\d+)", re.IGNORECASE),
}


def parse_meta(md: str) -> dict:
    """Простое выдёргивание метаданных из верхней части файла."""
    head = md[:1500]  # обычно метаданные в начале
    out: dict = {}
    for key, rx in _META_PATTERNS.items():
        m = rx.search(head)
        if not m:
            continue
        v = m.group(1).strip()
        if key in ("energy", "coffee"):
            try:
                out[key] = int(v)
            except ValueError:
                pass
        else:
            out[key] = v
    return out


# ── Главный entry point ────────────────────────────────────────────────────

def parse_diary(filename: str, content: str, default_year: int) -> ParsedDiary | None:
    """Парсит один диарийный файл. Возвращает None если дату не распознали."""
    date = parse_date_from_filename(filename, default_year)
    if not date:
        return None
    return ParsedDiary(
        date=date,
        raw_text=content,
        emotions=parse_emotions(content),
        trainings=parse_trainings(content),
        extra=parse_meta(content),
    )
