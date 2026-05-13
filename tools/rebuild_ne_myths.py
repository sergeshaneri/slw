"""Regenerate ASPECT_DATA.Ne.myths from Мифы и Боги ЧИ.md (50 items)."""
import re

with open('Ne/Мифы и Боги ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Each myth is "### N. NAME\nDESC\n\n"
# Section headers (## 🦉 Архетип Мудрец) separate sections; ignore them.
items = re.split(r'\n(?=### \d+\. )', text)
myths = []
for item in items:
    m = re.match(r'### (\d+)\. (.+?)\n(.+?)(?:\n\n|\n---|\Z)', item, re.DOTALL)
    if not m:
        continue
    num = int(m.group(1))
    name = m.group(2).strip()
    desc = re.sub(r'\s+', ' ', m.group(3).strip())
    # Strip ** bold
    desc = re.sub(r'\*\*(.+?)\*\*', r'\1', desc)
    if 1 <= num <= 50:
        myths.append({'name': name, 'desc': desc, 'num': num})

myths.sort(key=lambda m: m['num'])
print(f'Parsed myths: {len(myths)}')
assert len(myths) == 50, f'Expected 50, got {len(myths)}'

def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def js_obj(m):
    return f"    {{ name: {js_str(m['name'])}, desc: {js_str(m['desc'])} }}"

myths_js = '[\n' + ',\n'.join(js_obj(m) for m in myths) + '\n  ]'

asp_path = 'slw-main/slw-main/src/data/aspects.js'
with open(asp_path, 'r', encoding='utf-8') as f:
    text = f.read()

ne_start = text.find('ASPECT_DATA.Ne = {')
ni_start = text.find('ASPECT_DATA.Ni = {')
ne_block = text[ne_start:ni_start]

pat = re.compile(r'(  myths: )\[.*?\n  \](,?)\n', re.DOTALL)
m = pat.search(ne_block)
assert m, 'myths field not found in Ne'
ne_new = ne_block[:m.start()] + m.group(1) + myths_js + m.group(2) + '\n' + ne_block[m.end():]

new_text = text[:ne_start] + ne_new + text[ni_start:]
print(f'old len: {len(text)}, new len: {len(new_text)}, delta: {len(new_text)-len(text)}')

with open(asp_path, 'w', encoding='utf-8') as f:
    f.write(new_text)
print('saved')
