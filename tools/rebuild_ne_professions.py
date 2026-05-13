"""Regenerate ASPECT_DATA.Ne.professions from профессии ЧИ.md (107 items)."""
import re

with open('Ne/профессии ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Split by ### N. headers
items = re.split(r'\n(?=### \d+\. )', text)
profs = []
for item in items:
    m = re.match(r'### (\d+)\. (.+?)\n\n(.+?)\n\n\*\*Ключевые навыки', item, re.DOTALL)
    if not m:
        continue
    num = int(m.group(1))
    name = m.group(2).strip()
    desc = re.sub(r'\s+', ' ', m.group(3).strip())
    # Strip bold markers
    desc = re.sub(r'\*\*(.+?)\*\*', r'\1', desc)
    desc = re.sub(r'\*(.+?)\*', r'\1', desc)
    # Strip parenthetical English in name (keep Russian only if both exist)
    name = re.sub(r'\s*\([a-zA-Z][^)]*\)\s*$', '', name).strip()
    # Truncate desc to ~3 sentences for UI readability
    sentences = re.split(r'(?<=[.!?])\s+', desc)
    desc = ' '.join(sentences[:3])
    if 1 <= num <= 107:
        profs.append({'name': name, 'desc': desc, 'num': num})

profs.sort(key=lambda p: p['num'])
print(f'Parsed professions: {len(profs)}')
assert len(profs) == 107, f'Expected 107, got {len(profs)}'

def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def js_obj(p):
    return f"    {{ name: {js_str(p['name'])}, desc: {js_str(p['desc'])} }}"

profs_js = '[\n' + ',\n'.join(js_obj(p) for p in profs) + '\n  ]'

# Substitute in aspects.js — find Ne block, replace professions field
asp_path = 'slw-main/slw-main/src/data/aspects.js'
with open(asp_path, 'r', encoding='utf-8') as f:
    text = f.read()

ne_start = text.find('ASPECT_DATA.Ne = {')
ni_start = text.find('ASPECT_DATA.Ni = {')
ne_block = text[ne_start:ni_start]

# Replace 'professions: [...]' field
pat = re.compile(r'(  professions: )\[.*?\n  \](,?)\n', re.DOTALL)
m = pat.search(ne_block)
assert m, 'professions field not found in Ne'
ne_new = ne_block[:m.start()] + m.group(1) + profs_js + m.group(2) + '\n' + ne_block[m.end():]

new_text = text[:ne_start] + ne_new + text[ni_start:]
print(f'old len: {len(text)}, new len: {len(new_text)}, delta: {len(new_text)-len(text)}')

with open(asp_path, 'w', encoding='utf-8') as f:
    f.write(new_text)
print('saved')
