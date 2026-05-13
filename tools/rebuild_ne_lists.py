"""Regenerate ASPECT_DATA.Ne {culturalDifferences, childRaising, childhoodQuestions} from sources.

Use FULL source text (not truncated/paraphrased).
"""
import re

# ============================================================
# 1. culturalDifferences — 50 plain strings (full content)
# ============================================================
with open('Ne/Культурные отличия ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

cd_items = []
items = re.split(r'\n(?=\d+\. )', text)
for item in items:
    m = re.match(r'(\d+)\.\s+(.+?)(?:\n\n|\n###|\n---|\Z)', item, re.DOTALL)
    if not m:
        continue
    num = int(m.group(1))
    body = re.sub(r'\s+', ' ', m.group(2).strip())
    # Strip ** bold markers
    body = re.sub(r'\*\*(.+?)\*\*', r'\1', body)
    # Strip italic markers
    body = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'\1', body)
    if 1 <= num <= 50:
        cd_items.append((num, body))
cd_items.sort()
print(f'culturalDifferences: {len(cd_items)} items, avg {sum(len(b) for _,b in cd_items)//max(len(cd_items),1)} chars')
assert len(cd_items) == 50

# ============================================================
# 2. childRaising — 50 {name, desc}
# ============================================================
with open('Ne/как привить ребенку ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

cr_items = []
items = re.split(r'\n(?=\d+\.\s+\*\*)', text)
for item in items:
    m = re.match(r'(\d+)\.\s+\*\*(.+?)\.?\*\*\s*(.+?)(?:\n\n|\n###|\n---|\Z)', item, re.DOTALL)
    if not m:
        continue
    num = int(m.group(1))
    name = re.sub(r'\s+', ' ', m.group(2).strip()).rstrip('.')
    desc = re.sub(r'\s+', ' ', m.group(3).strip())
    # Strip nested formatting
    desc = re.sub(r'\*\*(.+?)\*\*', r'\1', desc)
    desc = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'\1', desc)
    if 1 <= num <= 50:
        cr_items.append((num, name, desc))
cr_items.sort()
print(f'childRaising: {len(cr_items)} items, avg desc {sum(len(d) for _,_,d in cr_items)//max(len(cr_items),1)} chars')
assert len(cr_items) == 50

# ============================================================
# 3. childhoodQuestions — 50 plain strings
# ============================================================
with open('Ne/вопросы про детство ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

cq_items = []
items = re.split(r'\n(?=\d+\. )', text)
for item in items:
    m = re.match(r'(\d+)\.\s+(.+?)(?:\n\n|\n###|\n---|\Z)', item, re.DOTALL)
    if not m:
        continue
    num = int(m.group(1))
    body = re.sub(r'\s+', ' ', m.group(2).strip())
    body = re.sub(r'\*\*(.+?)\*\*', r'\1', body)
    body = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'\1', body)
    if 1 <= num <= 50:
        cq_items.append((num, body))
cq_items.sort()
print(f'childhoodQuestions: {len(cq_items)} items, avg {sum(len(b) for _,b in cq_items)//max(len(cq_items),1)} chars')
assert len(cq_items) == 50

# ============================================================
# Generate JS and substitute
# ============================================================
def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def js_plain_array(items):
    return '[\n' + ',\n'.join(f'    {js_str(b)}' for _, b in items) + '\n  ]'

def js_obj_array(items):
    return '[\n' + ',\n'.join(
        f"    {{ name: {js_str(n)}, desc: {js_str(d)} }}"
        for _, n, d in items
    ) + '\n  ]'

cd_js = js_plain_array(cd_items)
cr_js = js_obj_array(cr_items)
cq_js = js_plain_array(cq_items)

asp_path = 'slw-main/slw-main/src/data/aspects.js'
with open(asp_path, 'r', encoding='utf-8') as f:
    text = f.read()

ne_start = text.find('ASPECT_DATA.Ne = {')
ni_start = text.find('ASPECT_DATA.Ni = {')
ne_block = text[ne_start:ni_start]

def replace_field(block, fieldname, new_js):
    pat = re.compile(r'(  ' + re.escape(fieldname) + r': )\[.*?\n  \](,?)\n', re.DOTALL)
    m = pat.search(block)
    if not m:
        return block, False
    return block[:m.start()] + m.group(1) + new_js + m.group(2) + '\n' + block[m.end():], True

ne_new = ne_block
for field, js in [
    ('culturalDifferences', cd_js),
    ('childRaising', cr_js),
    ('childhoodQuestions', cq_js),
]:
    ne_new, ok = replace_field(ne_new, field, js)
    print(f'replaced {field}: {ok}')

new_text = text[:ne_start] + ne_new + text[ni_start:]
print(f'old len: {len(text)}, new len: {len(new_text)}, delta: {len(new_text)-len(text)}')

with open(asp_path, 'w', encoding='utf-8') as f:
    f.write(new_text)
print('saved')
