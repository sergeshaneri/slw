"""
CLI: python -m app.content.build
Reads:
  - slw-main/src/data/journey/onboarding.js       (4 onboarding steps)
  - slw-main/src/data/journey/aspects/bs-l0.md    (BS L0 content)
  - slw-main/src/data/journey/aspects/bs-l1.md    (BS L1 content)
Writes app/content/compiled.json.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent.parent  # slw-slw-instruct/
WEB_DATA = ROOT / "slw-main" / "slw-main" / "src" / "data" / "journey"
OUT = Path(__file__).parent / "compiled.json"

SECTION_RE = re.compile(r'^##\s+(.+)$', re.MULTILINE)
FOLLOWUP_RE = re.compile(r'^###\s+followUp\s+(.+)$', re.MULTILINE)


def _parse_onboarding_js(path: Path, start_ord: int) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    ids = re.findall(r"id:\s*'([^']+)'", text)
    buttons = re.findall(r"button:\s*'([^']+)'", text)
    texts = re.findall(r"text:\s*`([\s\S]+?)`", text)
    steps = []
    for i, (sid, body, btn) in enumerate(zip(ids, texts, buttons)):
        steps.append(_make_step(
            id=sid, aspect="onboarding", level=0,
            ord=start_ord + i, kind="onboarding",
            title=f"Знакомство {i + 1}", body_md=body.strip(),
            button=btn, source=str(path.relative_to(ROOT)),
        ))
    return steps


def _split_sections(text: str) -> list[tuple[str, str]]:
    matches = list(SECTION_RE.finditer(text))
    result = []
    for i, m in enumerate(matches):
        header = m.group(1).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        result.append((header, text[start:end].strip()))
    return result


def _extract_follow_ups(body: str) -> tuple[str, list[dict]]:
    matches = list(FOLLOWUP_RE.finditer(body))
    if not matches:
        return body, []
    main_body = body[:matches[0].start()].strip()
    fups = []
    for i, m in enumerate(matches):
        rng = m.group(1).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        ftext = body[start:end].strip()
        r = re.match(r'^(\d+)\s*-\s*(\d+)$', rng)
        if r:
            fups.append({"min": int(r[1]), "max": int(r[2]), "text": ftext})
    return main_body, fups


def _split_meta_and_body(text: str) -> tuple[dict, str]:
    lines = text.split('\n')
    meta: dict = {}
    i = 0
    while i < len(lines):
        m = re.match(r'^([a-z]+):\s*(.+)$', lines[i])
        if m:
            meta[m.group(1)] = m.group(2).strip()
            i += 1
            continue
        if lines[i].strip() == '':
            i += 1
            break
        break
    return meta, '\n'.join(lines[i:]).strip()


def _make_step(*, id, aspect, level, ord, kind, title, body_md,
               button=None, xp=0, stardust=0, follow_ups=None, source="") -> dict:
    return {
        "id": id,
        "aspect": aspect,
        "level": level,
        "ord": ord,
        "kind": kind,
        "source_file": source,
        "title": title,
        "body_md": body_md,
        "meta": {
            "xp": xp,
            "stardust": stardust,
            "button": button,
            "follow_ups": follow_ups or [],
        },
    }


def _parse_bs_md(path: Path, aspect: str, level: int, start_ord: int,
                 open_question_prefixes: set[str] | None = None) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    sections = _split_sections(text)
    steps = []
    intro_count = 0
    script_count = 0

    for header, body in sections:
        src = str(path.relative_to(ROOT))

        if header == 'complete' or header.startswith('complete '):
            _, cbody = _split_meta_and_body(body)
            steps.append(_make_step(
                id=f"{aspect.lower()}-L{level}-complete",
                aspect=aspect, level=level,
                ord=start_ord + 1000,  # always last
                kind="complete", title="Уровень пройден",
                body_md=cbody, source=src,
            ))
            continue

        if header.startswith('intro'):
            m = re.match(r'intro\s*[·.]\s*(\d+)', header)
            idx = int(m.group(1)) if m else (intro_count + 1)
            intro_count = idx
            meta, ibody = _split_meta_and_body(body)
            steps.append(_make_step(
                id=f"{aspect.lower()}-intro-{idx}",
                aspect=aspect, level=level,
                ord=start_ord + idx,
                kind="intro", title=f"Введение в {aspect} {idx}",
                body_md=ibody, xp=int(meta.get("xp", 0)),
                button=meta.get("button", "Далее"), source=src,
            ))
            continue

        m = re.match(r'^([A-Z]+-\d+)\s*[·.]\s*([a-z_]+)\s*[·.]\s*(.+)$', header)
        if not m:
            continue
        sid, kind, title = m.group(1), m.group(2), m.group(3).strip()
        # В L1 B-шаги — открытый текстовый ответ, не числовой
        if open_question_prefixes:
            prefix = re.match(r'^([A-Z]+)', sid)
            if prefix and prefix.group(1) in open_question_prefixes and kind == "question":
                kind = "reflection"
        script_count += 1

        main_body, fups = _extract_follow_ups(body)
        meta, sbody = _split_meta_and_body(main_body)

        steps.append(_make_step(
            id=f"{aspect.lower()}-L{level}-{sid}",
            aspect=aspect, level=level,
            ord=start_ord + 100 + script_count,
            kind=kind, title=title,
            body_md=sbody,
            xp=int(meta.get("xp", 0)),
            stardust=int(meta.get("stardust", 0)),
            button=meta.get("button", None),
            follow_ups=fups,
            source=src,
        ))

    return steps


def build() -> None:
    all_steps: list[dict] = []

    ob_steps = _parse_bs_md(WEB_DATA / "onboarding.md", "onboarding", 0, start_ord=1)
    all_steps.extend(ob_steps)

    bs_steps = _parse_bs_md(WEB_DATA / "aspects" / "bs-l0.md", "БС", 0, start_ord=10)
    all_steps.extend(bs_steps)

    bs1_steps = _parse_bs_md(
        WEB_DATA / "aspects" / "bs-l1.md", "БС", 1, start_ord=200,
        open_question_prefixes={"B"},
    )
    all_steps.extend(bs1_steps)

    # Assign clean global ord
    all_steps.sort(key=lambda s: s["ord"])
    for i, s in enumerate(all_steps, start=1):
        s["ord"] = i

    OUT.write_text(json.dumps(all_steps, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: wrote {len(all_steps)} steps -> {OUT}")


if __name__ == "__main__":
    build()
