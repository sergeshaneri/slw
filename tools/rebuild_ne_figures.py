"""Regenerate HALL_CONTENT.Ne.figures from исторические личности ЧИ.md (20 items, full content).

Source structure:
  ### 🦉 Архетип Мудрец — …  (section header with archetype emoji)
  **N. Name (dates)** — desc text.

Output: [{ name: 'Дар./Тень. Name (dates) · Архетип', note: 'Full desc' }]
"""
import re

with open('Ne/исторические личности ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Parse: track current section header (Гар/Тень) and archetype
# Section pattern: "## 10 примеров зрелого проявления ЧИ" / "## 10 примеров теневого проявления ЧИ"
# Archetype pattern: "### 🦉 Архетип Мудрец" / "### 🧭 Архетип Первооткрыватель" / "### 🔥 Архетип Катализатор" / "### 🌅 Архетип Визионер"

archetypes = {
    '🦉': 'Мудрец',
    '🧭': 'Первооткрыватель',
    '🔥': 'Катализатор',
    '🌅': 'Визионер',
}

figures = []
current_mode = None  # 'Дар' or 'Тень'
current_arch = None

for line in text.split('\n'):
    line = line.rstrip()
    if line.startswith('## 10 примеров зрелого'):
        current_mode = 'Дар'
    elif line.startswith('## 10 примеров теневого') or line.startswith('## Тень'):
        current_mode = 'Тень'
    elif line.startswith('### '):
        for em, name in archetypes.items():
            if em in line:
                current_arch = name
                break
    else:
        # Match: "**N. Name (dates)** — desc"
        m = re.match(r'\*\*(\d+)\. (.+?)\*\*\s*[—-]\s*(.+)', line)
        if m and current_mode and current_arch:
            num = int(m.group(1))
            name_part = m.group(2).strip()
            desc = m.group(3).strip()
            # Normalize whitespace, strip nested formatting
            desc = re.sub(r'\s+', ' ', desc)
            desc = re.sub(r'\*\*(.+?)\*\*', r'\1', desc)
            desc = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'\1', desc)
            full_name = f'{current_mode}. {name_part} · {("Тень " if current_mode == "Тень" else "")}{current_arch}'.strip()
            # Cleaner: "Дар. Leonardo da Vinci (1452–1519) · Мудрец" or "Тень. ... · Тень Мудреца"
            if current_mode == 'Тень':
                full_name = f'Тень. {name_part} · Тень {current_arch}а'
                # Fix grammar for "Тень Мудреца" / "Тень Первооткрывателя" / etc.
                full_name = full_name.replace('Тень Мудреца', 'Тень Мудреца')
                full_name = full_name.replace('Тень Первооткрывателя', 'Тень Первооткрывателя')
                full_name = full_name.replace('Тень Катализатора', 'Тень Катализатора')
                full_name = full_name.replace('Тень Визионера', 'Тень Визионера')
                # Better: use direct mapping
                ten_map = {
                    'Мудрец': 'Мудреца',
                    'Первооткрыватель': 'Первооткрывателя',
                    'Катализатор': 'Катализатора',
                    'Визионер': 'Визионера',
                }
                full_name = f'Тень. {name_part} · Тень {ten_map[current_arch]}'
            else:
                full_name = f'Дар. {name_part} · {current_arch}'
            figures.append({'name': full_name, 'note': desc, 'num': num, 'mode': current_mode})

# Sort: дары (1-10) first, then тени (1-10)
figures.sort(key=lambda f: (f['mode'] != 'Дар', f['num']))
print(f'figures: {len(figures)} items')
print(f'  avg note len: {sum(len(f["note"]) for f in figures)//max(len(figures),1)} chars')
for f in figures[:2]:
    print(f'  [{f["mode"]}] {f["name"]}: {f["note"][:100]}...')
assert len(figures) == 20, f'Expected 20, got {len(figures)}'

def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def js_obj(f):
    return f"      {{ name: {js_str(f['name'])}, note: {js_str(f['note'])} }}"

figures_js = '[\n' + ',\n'.join(js_obj(f) for f in figures) + '\n    ]'

hall_path = 'slw-main/slw-main/src/data/hallContent.js'
with open(hall_path, 'r', encoding='utf-8') as f:
    hall = f.read()

ne_start = hall.find('  Ne: {')
si_start = hall.find('  Si: {')
ne_block = hall[ne_start:si_start]

pat = re.compile(r'(    figures: )\[.*?\n    \](,?)\n', re.DOTALL)
m = pat.search(ne_block)
assert m, 'figures field not found in HALL.Ne'
ne_new = ne_block[:m.start()] + m.group(1) + figures_js + m.group(2) + '\n' + ne_block[m.end():]

new_hall = hall[:ne_start] + ne_new + hall[si_start:]
print(f'old hall len: {len(hall)}, new len: {len(new_hall)}, delta: {len(new_hall)-len(hall)}')

with open(hall_path, 'w', encoding='utf-8') as f:
    f.write(new_hall)
print('saved')
