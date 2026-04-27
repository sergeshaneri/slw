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
