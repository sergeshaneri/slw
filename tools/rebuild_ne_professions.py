"""Regenerate ASPECT_DATA.Ne.professions from профессии ЧИ.md (107 items, full content).

Match structure of Fe.professions: { name, desc (FULL), keySkills: [{skill, note}] }.
"""
import re

with open('Ne/профессии ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Split into individual profession blocks (separated by ### N. headers)
# Each profession ends at the next ### or final ## section
items = re.split(r'\n(?=### \d+\. )', text)
profs = []
for item in items:
    # Match: ### N. Name\n\nDesc paragraph\n\n**Ключевые навыки ЧИ:**\n- *skill* — note\n- ...
    m = re.match(
        r'### (\d+)\. (.+?)\n\n(.+?)\n\n\*\*Ключевые навыки ЧИ:\*\*\n(.*?)(?:\n---|\Z)',
        item, re.DOTALL,
    )
    if not m:
        continue
    num = int(m.group(1))
    name = m.group(2).strip()
    desc = re.sub(r'\s+', ' ', m.group(3).strip())
    # Strip bold/italic markers in desc
    desc = re.sub(r'\*\*(.+?)\*\*', r'\1', desc)
    desc = re.sub(r'\*(.+?)\*', r'\1', desc)
    # Strip parenthetical English in name (keep Russian only)
    name = re.sub(r'\s*\([a-zA-Z][^)]*\)\s*$', '', name).strip()

    # Parse skills bullet list
    skills_raw = m.group(4)
    key_skills = []
    for line in skills_raw.strip().split('\n'):
        sm = re.match(r'- \*(.+?)\*\s*(?:—|-)\s*(.+)', line.strip())
        if sm:
            skill = sm.group(1).strip()
            note = re.sub(r'\s+', ' ', sm.group(2).strip()).rstrip('.')
            key_skills.append({'skill': skill, 'note': note})

    if 1 <= num <= 107:
        profs.append({'name': name, 'desc': desc, 'keySkills': key_skills, 'num': num})

profs.sort(key=lambda p: p['num'])
print(f'Parsed professions: {len(profs)}')
print(f'  avg keySkills per profession: {sum(len(p["keySkills"]) for p in profs)/len(profs):.1f}')
print(f'  professions with <4 keySkills: {sum(1 for p in profs if len(p["keySkills"]) < 4)}')
assert len(profs) == 107, f'Expected 107, got {len(profs)}'

def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def js_obj(p):
    ks_items = ',\n'.join(
        f"      {{ skill: {js_str(ks['skill'])}, note: {js_str(ks['note'])} }}"
        for ks in p['keySkills']
    )
    return (
        f"    {{\n"
        f"      name: {js_str(p['name'])},\n"
        f"      desc: {js_str(p['desc'])},\n"
        f"      keySkills: [\n{ks_items}\n      ]\n"
        f"    }}"
    )

profs_js = '[\n' + ',\n'.join(js_obj(p) for p in profs) + '\n  ]'

# Substitute in aspects.js
asp_path = 'slw-main/slw-main/src/data/aspects.js'
with open(asp_path, 'r', encoding='utf-8') as f:
    text = f.read()

ne_start = text.find('ASPECT_DATA.Ne = {')
ni_start = text.find('ASPECT_DATA.Ni = {')
ne_block = text[ne_start:ni_start]

pat = re.compile(r'(  professions: )\[.*?\n  \](,?)\n', re.DOTALL)
m = pat.search(ne_block)
assert m, 'professions field not found in Ne'
ne_new = ne_block[:m.start()] + m.group(1) + profs_js + m.group(2) + '\n' + ne_block[m.end():]

new_text = text[:ne_start] + ne_new + text[ni_start:]
print(f'old len: {len(text)}, new len: {len(new_text)}, delta: {len(new_text)-len(text)}')

with open(asp_path, 'w', encoding='utf-8') as f:
    f.write(new_text)
print('saved')
