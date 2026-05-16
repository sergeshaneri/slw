"""
Пересборка блоков ASPECT_DATA.Ni из markdown-источников.
Заменяет в aspects.js следующие массивы внутри ASPECT_DATA.Ni:
  - myths
  - culturalDifferences
  - childRaising
  - childhoodQuestions

Описания берутся полностью из источников, без сокращений.
"""
import re
from pathlib import Path

NI_DIR = Path(r'C:\Serge\slw-slw-instruct\slw-slw-instruct\Ni')
ASPECTS = Path(r'C:\Serge\slw-slw-instruct\slw-slw-instruct\slw-main\slw-main\src\data\aspects.js')


def js_str(s: str) -> str:
    """Безопасная JS-строка."""
    s = s.replace('\\', '\\\\')
    has_single = "'" in s or '’' in s
    has_double = '"' in s
    if not has_single:
        return "'" + s + "'"
    if has_single and not has_double:
        return '"' + s + '"'
    # есть оба — экранируем одинарные внутри одинарных
    return "'" + s.replace("'", "\\'") + "'"


def squash(s: str) -> str:
    """Сжать whitespace. Markdown **bold** и *italic* оставляем как есть —
    MarkdownLite во фронте умеет их рендерить."""
    s = re.sub(r'\s+', ' ', s).strip()
    return s


# ────────────────────────────────────────────────────────
# 1. myths — массив {name, desc}
# Источник: "### N. Название — традиция\n<параграф>"
# ────────────────────────────────────────────────────────
def parse_myths() -> str:
    src = (NI_DIR / 'Мифы и Боги БИ.md').read_text(encoding='utf-8')
    matches = list(re.finditer(r'^### (\d+)\.\s+(.+)$', src, re.M))
    items = []
    for i, m in enumerate(matches):
        name = m.group(2).strip()
        start = m.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(src)
        body = src[start:end].strip()
        # Срезаем по '\n## ' (следующая большая секция) и '\n---\n'
        for sep in ['\n## ', '\n---\n']:
            idx = body.find(sep)
            if idx > 0:
                body = body[:idx]
        body = body.strip()
        desc = squash(body)
        items.append((name, desc))
    print(f'  myths: {len(items)} parsed')

    lines = ['  myths: [']
    for name, desc in items:
        lines.append('    { name: ' + js_str(name) + ', desc: ' + js_str(desc) + ' },')
    lines[-1] = lines[-1].rstrip(',')
    lines.append('  ],')
    return '\n'.join(lines)


# ────────────────────────────────────────────────────────
# 2. culturalDifferences — массив строк
# Источник: каждый "**Феномен**" + текст параграфа → одна строка
# Группы (## Культура, ### Подзаголовок) служат только структурой.
# ────────────────────────────────────────────────────────
def parse_cultural_differences() -> str:
    src = (NI_DIR / 'Культурные отличия БИ.md').read_text(encoding='utf-8')
    items = []
    # Ищем все жирные феномены: **...**  начинающие параграф
    # Паттерн: новый параграф начинается с **<bold>** или (для редких случаев) — без жирного, но это редко.
    # Более надёжно: парс по абзацам, абзац считается элементом если начинается с **
    paragraphs = re.split(r'\n\s*\n', src)
    for p in paragraphs:
        p = p.strip()
        if not p or p.startswith('#') or p.startswith('---'):
            continue
        # Должен начинаться с **
        if not p.startswith('**'):
            continue
        text = squash(p)
        items.append(text)
    print(f'  culturalDifferences: {len(items)} parsed')

    lines = ['  culturalDifferences: [']
    for it in items:
        lines.append('    ' + js_str(it) + ',')
    lines[-1] = lines[-1].rstrip(',')
    lines.append('  ],')
    return '\n'.join(lines)


# ────────────────────────────────────────────────────────
# 3. childRaising — массив {name, desc}
# Источник: "N. **Название.** Описание." внутри ### Раздел
# ────────────────────────────────────────────────────────
def parse_child_raising() -> str:
    src = (NI_DIR / 'как привить ребенку БИ.md').read_text(encoding='utf-8')
    items = []
    # Паттерн: '\n<пустая или начало>N. **Название.** Описание...' до следующего <num>. ** или ### или ---
    # Берём строки, начинающиеся с цифры + точка + пробел + **
    # И собираем многострочный текст до следующего такого же или до ### / ---
    item_pat = re.compile(r'^(\d+)\.\s+\*\*([^*]+?)\.\*\*\s*(.*?)$', re.M)
    matches = list(item_pat.finditer(src))
    for i, m in enumerate(matches):
        num = int(m.group(1))
        name = m.group(2).strip()
        # body — от конца этой строки до начала следующего пункта или раздела
        start = m.end()
        # ищем ближайший следующий маркер
        nxt_starts = []
        if i+1 < len(matches):
            nxt_starts.append(matches[i+1].start())
        for nm in ['\n### ', '\n---\n', '\n## ']:
            idx = src.find(nm, start)
            if idx > 0:
                nxt_starts.append(idx)
        end = min(nxt_starts) if nxt_starts else len(src)
        first_line_rest = m.group(3) or ''
        body_tail = src[start:end].strip()
        full = (first_line_rest + ' ' + body_tail).strip()
        desc = squash(full)
        items.append((num, name, desc))
    print(f'  childRaising: {len(items)} parsed')

    lines = ['  childRaising: [']
    for num, name, desc in items:
        lines.append('    { name: ' + js_str(name) + ', desc: ' + js_str(desc) + ' },')
    lines[-1] = lines[-1].rstrip(',')
    lines.append('  ],')
    return '\n'.join(lines)


# ────────────────────────────────────────────────────────
# 4. childhoodQuestions — массив строк
# Источник: "N. Текст вопроса?" внутри ### Раздел
# ────────────────────────────────────────────────────────
def parse_childhood_questions() -> str:
    src = (NI_DIR / 'вопросы про детство БИ.md').read_text(encoding='utf-8')
    items = []
    # Паттерн: строки начинающиеся с числа + точка + пробел + текст (не **)
    # Не путаем со строками внутри списков из других файлов
    item_pat = re.compile(r'^(\d+)\.\s+([^*\n].+?)$', re.M)
    matches = list(item_pat.finditer(src))
    for m in matches:
        num = int(m.group(1))
        text = m.group(2).strip()
        # Если вопрос разбит на несколько строк — берём до пустой строки
        end_idx = src.find('\n\n', m.end())
        if end_idx > 0 and end_idx < len(src):
            extra = src[m.end():end_idx].strip()
            if extra:
                text = text + ' ' + extra
        text = squash(text)
        items.append((num, text))
    print(f'  childhoodQuestions: {len(items)} parsed')

    lines = ['  childhoodQuestions: [']
    for num, text in items:
        lines.append('    ' + js_str(text) + ',')
    lines[-1] = lines[-1].rstrip(',')
    lines.append('  ],')
    return '\n'.join(lines)


# ────────────────────────────────────────────────────────
# Подмена блока в aspects.js
# ────────────────────────────────────────────────────────
def replace_block(text: str, ni_start: int, field: str, new_block: str) -> str:
    """Найти '\n  <field>: [' после ni_start, сматчить баланс [], заменить."""
    marker = f'\n  {field}: ['
    p_start = text.find(marker, ni_start)
    if p_start < 0:
        raise RuntimeError(f'{field}: [ not found after ni_start={ni_start}')
    p_start += 1  # skip leading \n

    # Найти конец массива (баланс)
    depth = 0
    i = text.find('[', p_start)
    if i < 0:
        raise RuntimeError(f'[ not found for {field}')
    while i < len(text):
        c = text[i]
        if c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                # Включаем символы до конца строки И трейлинг-запятую если есть
                j = i + 1
                # пропустить запятую
                if j < len(text) and text[j] == ',':
                    j += 1
                line_end = text.find('\n', j)
                block_end = line_end if line_end > 0 else j
                break
        i += 1
    else:
        raise RuntimeError(f'closing ] not found for {field}')

    print(f'  {field}: replaced lines {text[:p_start].count(chr(10)) + 1}..{text[:block_end].count(chr(10)) + 1}')
    return text[:p_start] + new_block + text[block_end:]


def main():
    text = ASPECTS.read_text(encoding='utf-8')
    ni_idx = text.find("name: 'Белая Интуиция'")
    assert ni_idx > 0, 'Ni section not found'

    # Парсим все 4 блока
    print('Parsing sources:')
    myths_block = parse_myths()
    cult_block = parse_cultural_differences()
    cr_block = parse_child_raising()
    cq_block = parse_childhood_questions()

    # Заменяем — порядок важен (заменяем с конца файла к началу, чтобы индексы не сдвигались)
    # ASPECT_DATA.Ni поля в порядке файла:
    # myths, culturalDifferences, childRaising, ..., childhoodQuestions
    # Удобнее заменять сначала myths (раньше всего), потом каждый раз обновлять ni_idx
    print('\nReplacing blocks:')
    for field, block in [
        ('myths', myths_block),
        ('culturalDifferences', cult_block),
        ('childRaising', cr_block),
        ('childhoodQuestions', cq_block),
    ]:
        text = replace_block(text, ni_idx, field, block)
        # ni_idx не двигается (он раньше всех заменяемых блоков)

    ASPECTS.write_text(text, encoding='utf-8')
    print(f'\nDone. Total length: {len(text)} chars')


if __name__ == '__main__':
    main()
