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
