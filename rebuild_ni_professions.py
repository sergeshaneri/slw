"""
Парсит Ni/профессии БИ.md и заменяет блок professions в ASPECT_DATA.Ni
полными описаниями (первый параграф после заголовка, без раздела
"Ключевые навыки БИ").
"""
import re
from pathlib import Path

SRC = Path(r'C:\Serge\slw-slw-instruct\slw-slw-instruct\Ni\профессии БИ.md')
DST = Path(r'C:\Serge\slw-slw-instruct\slw-slw-instruct\slw-main\slw-main\src\data\aspects.js')

# 1. Парсинг источника
src = SRC.read_text(encoding='utf-8')
section_pat = re.compile(r'^### (\d+)\.\s+(.+)$', re.M)
matches = list(section_pat.finditer(src))
assert len(matches) == 105, f'Expected 105, got {len(matches)}'

professions = []
for i, m in enumerate(matches):
    num = int(m.group(1))
    name = m.group(2).strip()
    start = m.end()
    end = matches[i+1].start() if i+1 < len(matches) else len(src)
    body = src[start:end].strip()
    # Берём всё до разделителя \n---\n (включая параграф + блок "Ключевые навыки БИ")
    sep_idx = body.find('\n---\n')
    if sep_idx >= 0:
        body = body[:sep_idx].strip()
    # Разделяем параграф и блок "Ключевые навыки БИ"
    kn_idx = body.find('**Ключевые навыки БИ:**')
    if kn_idx >= 0:
        para = body[:kn_idx].strip()
        kn_part = body[kn_idx:].strip()
        # Свёртка параграфа в одну строку
        para = re.sub(r'\s+', ' ', para)
        # Список ключевых навыков → читаемый блок: переводим - * в обычный текст
        # Каждый буллет на новой строке
        kn_lines = []
        for line in kn_part.split('\n'):
            line = line.strip()
            if line.startswith('- '):
                # Снимаем буллет, заменяем * на ничего (markdown italic)
                item = re.sub(r'\*([^*]+)\*', r'\1', line[2:].strip())
                kn_lines.append(item)
            elif line.startswith('**Ключевые'):
                continue
        kn_text = '; '.join(kn_lines)
        desc = para + '  Ключевые навыки БИ: ' + kn_text + '.'
    else:
        # Если маркера нет — берём всё тело как параграф
        desc = re.sub(r'\s+', ' ', body)
    professions.append((num, name, desc))

# 2. Генерация JS-блока
def js_str(s: str) -> str:
    """Безопасная JS-строка: предпочитаем одинарные, если есть апостроф — двойные."""
    has_single = "'" in s or '’' in s
    has_double = '"' in s
    if has_single and not has_double:
        return '"' + s + '"'
    if has_double and not has_single:
        return "'" + s + "'"
    if has_single and has_double:
        return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
    return "'" + s + "'"

lines = ['  professions: [']
for num, name, desc in professions:
    lines.append('    { name: ' + js_str(name) + ', desc: ' + js_str(desc) + ' },')
# Убрать запятую у последнего
lines[-1] = lines[-1].rstrip(',')
lines.append('  ]')
new_block = '\n'.join(lines)

# 3. Найти и заменить старый блок в aspects.js
dst_text = DST.read_text(encoding='utf-8')

# Найти точную начало блока в ASPECT_DATA.Ni
ni_idx = dst_text.find("name: 'Белая Интуиция'")
assert ni_idx > 0, 'Ni block not found'

# Найти "  professions: [" после ni_idx
prof_start = dst_text.find('\n  professions: [', ni_idx)
assert prof_start > 0, 'professions: [ not found in Ni block'
prof_start += 1  # skip the leading \n

# Найти соответствующий закрывающий "  ]" — баланс скобок
depth = 0
i = prof_start
while i < len(dst_text):
    c = dst_text[i]
    if c == '[':
        depth += 1
    elif c == ']':
        depth -= 1
        if depth == 0:
            # i указывает на закрывающую ]
            # ищем до конца этой строки (т.е. ',' или '\n')
            line_end = dst_text.find('\n', i)
            block_end = line_end if line_end > 0 else i + 1
            break
    i += 1

old_block = dst_text[prof_start:block_end]
print(f'Old block length: {len(old_block)} chars')
print(f'New block length: {len(new_block)} chars')

# Заменить
new_text = dst_text[:prof_start] + new_block + dst_text[block_end:]
DST.write_text(new_text, encoding='utf-8')
print(f'Replaced professions block. Total file: {len(dst_text)} -> {len(new_text)} chars')
print(f'New professions count: {len(professions)}')
