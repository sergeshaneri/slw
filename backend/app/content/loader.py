import json
from dataclasses import dataclass
from pathlib import Path

_COMPILED = Path(__file__).parent / "compiled.json"


@dataclass
class Step:
    id: str
    aspect: str
    level: int
    ord: int
    kind: str
    source_file: str
    title: str
    body_md: str
    meta: dict | None


_cache: list[Step] | None = None


def load_steps() -> list[Step]:
    global _cache
    if _cache is None:
        data = json.loads(_COMPILED.read_text(encoding="utf-8"))
        _cache = [Step(**item) for item in data]
    return _cache


def get_step(step_id: str) -> Step | None:
    return next((s for s in load_steps() if s.id == step_id), None)


def steps_for(aspect: str, level: int) -> list[Step]:
    return sorted(
        [s for s in load_steps() if s.aspect == aspect and s.level == level],
        key=lambda s: s.ord,
    )
