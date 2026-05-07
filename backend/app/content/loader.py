import json
from dataclasses import dataclass, field
from pathlib import Path

_COMPILED = Path(__file__).parent / "compiled.json"


@dataclass
class FollowUp:
    min: int
    max: int
    text: str


@dataclass
class Step:
    id: str
    aspect: str
    level: int
    ord: int
    kind: str        # onboarding | intro | theory | question | exercise | word | reflection | complete
    source_file: str
    title: str
    body_md: str
    meta: dict = field(default_factory=dict)

    @property
    def xp(self) -> int:
        return (self.meta or {}).get("xp", 0)

    @property
    def stardust(self) -> int:
        return (self.meta or {}).get("stardust", 0)

    @property
    def button(self) -> str | None:
        return (self.meta or {}).get("button")

    @property
    def follow_ups(self) -> list[FollowUp]:
        return [FollowUp(**f) for f in (self.meta or {}).get("follow_ups", [])]

    def get_follow_up_text(self, ans: int) -> str | None:
        for fu in self.follow_ups:
            if fu.min <= ans <= fu.max:
                return fu.text.replace("{ans}", str(ans))
        fups = self.follow_ups
        if fups:
            return fups[-1].text.replace("{ans}", str(ans))
        return None


_cache: list[Step] | None = None


def load_steps() -> list[Step]:
    global _cache
    if _cache is None:
        data = json.loads(_COMPILED.read_text(encoding="utf-8"))
        _cache = sorted([Step(**item) for item in data], key=lambda s: s.ord)
    return _cache


def get_step(step_id: str) -> Step | None:
    return next((s for s in load_steps() if s.id == step_id), None)


def next_step(current_id: str) -> Step | None:
    steps = load_steps()
    for i, s in enumerate(steps):
        if s.id == current_id and i + 1 < len(steps):
            return steps[i + 1]
    return None


def first_step() -> Step:
    return load_steps()[0]


# ── Per-aspect navigation ──────────────────────────────────────────────────
#
# Для multi-aspect бота: внутри одного аспекта ходим по `ord` отсортированно,
# но при переходе между аспектами не уезжаем автоматом в соседний. После
# конца аспекта возвращаем None — вызывающий код сам ставит finished=true.

def available_aspects() -> list[str]:
    """Список аспектов, у которых есть хоть один шаг в compiled-контенте.
    Псевдо-аспект 'onboarding' (мета-секция для intro-флоу) исключаем —
    в пикере его быть не должно, это не выбор юзера, а сквозной онбординг.
    """
    seen: list[str] = []
    for s in load_steps():
        if not s.aspect or s.aspect == "onboarding":
            continue
        if s.aspect not in seen:
            seen.append(s.aspect)
    return seen


def first_step_for_aspect(aspect: str) -> Step | None:
    """Стартовый шаг аспекта (минимальный ord). None если аспекта нет."""
    aspect_steps = [s for s in load_steps() if s.aspect == aspect]
    return aspect_steps[0] if aspect_steps else None


def next_step_for_aspect(aspect: str, current_id: str | None) -> Step | None:
    """Следующий шаг ВНУТРИ аспекта. None после последнего шага аспекта.

    `current_id` может быть None (например, если шаг удалили при контент-
    апдейте) — тогда возвращаем первый шаг аспекта как safe-fallback.
    """
    aspect_steps = [s for s in load_steps() if s.aspect == aspect]
    if not aspect_steps:
        return None
    if not current_id:
        return aspect_steps[0]
    for i, s in enumerate(aspect_steps):
        if s.id == current_id and i + 1 < len(aspect_steps):
            return aspect_steps[i + 1]
    return None


def aspect_of_step(step_id: str) -> str | None:
    """Какому аспекту принадлежит шаг. Удобно для миграции legacy-state."""
    s = get_step(step_id)
    return s.aspect if s else None


def short_id_for(step: Step) -> str:
    """`бс-L0-T-1` → `T-1`; `бс-intro-1` → `intro-1`; `onboarding-intro-1` → `intro-1`.

    Bot хранит ID в полном формате (с aspect+level в префиксе), web хранит
    в коротком (только `T-1` / `intro-1` scoped per current aspect+level).
    Эта функция делает преобразование bot → web. Лежит здесь, в
    нейтральном модуле, чтобы и web-роуты, и bot-хендлеры могли её
    импортировать без кросс-package зависимостей.
    """
    s = step.id
    aspect_lower = (step.aspect or "").lower()
    if aspect_lower and s.startswith(f"{aspect_lower}-"):
        s = s[len(aspect_lower) + 1:]
    level_prefix = f"L{step.level}-"
    if s.startswith(level_prefix):
        s = s[len(level_prefix):]
    return s
