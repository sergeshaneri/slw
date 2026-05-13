"""Regenerate HALL_CONTENT.Ne quotes/arts/interestingFacts from source markdown."""
import re

# ---- Parse quotes source ----
with open('Ne/цитаты ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

quotes = []
items = re.split(r'\n(?=\d+\. \*\*)', text)
for item in items:
    m = re.match(r'(\d+)\. \*\*(.+?)\*\*\n\s+\*(.+?)\*\n\s+(.+?)(?:\n\n|\n---|\Z)', item, re.DOTALL)
    if not m:
        continue
    num = int(m.group(1))
    text_raw = m.group(2).strip()
    text_clean = text_raw
    if text_clean.startswith('«') and text_clean.endswith('».'):
        text_clean = text_clean[1:-2]
    elif text_clean.startswith('«') and text_clean.endswith('»'):
        text_clean = text_clean[1:-1]
    author = m.group(3).strip().rstrip('.')
    note = re.sub(r'\s+', ' ', m.group(4).strip())
    if 1 <= num <= 80:
        quotes.append({'text': text_clean, 'author': author, 'note': note, 'num': num})
quotes.sort(key=lambda q: q['num'])
print(f'Parsed quotes: {len(quotes)}')
assert len(quotes) == 80, f'Expected 80 quotes, got {len(quotes)}'

# ---- Parse facts source ----
with open('Ne/интересные факты по ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

facts = []
items = re.split(r'\n(?=\d+\. \*\*)', text)
for item in items:
    m = re.match(r'(\d+)\. \*\*(.+?)\*\*(.*?)(?:\n\n|\n---|\Z)', item, re.DOTALL)
    if not m:
        continue
    num = int(m.group(1))
    title_bold = re.sub(r'\s+', ' ', m.group(2).strip())
    rest = re.sub(r'\s+', ' ', m.group(3).strip())
    if not rest:
        sent_end = title_bold.find('.')
        if sent_end > 0:
            name = title_bold[:sent_end].strip()
            desc = title_bold[sent_end+1:].strip()
        else:
            name = title_bold[:60].strip()
            desc = title_bold
    else:
        name = title_bold.rstrip('.,:;—-')
        desc = rest
    if 1 <= num <= 90:
        facts.append({'name': name, 'desc': desc, 'num': num})
facts.sort(key=lambda f: f['num'])
print(f'Parsed facts: {len(facts)}')
assert len(facts) == 90, f'Expected 90 facts, got {len(facts)}'

# ---- Parse arts source ----
with open('Ne/Искусство ЧИ.md', 'r', encoding='utf-8') as f:
    text = f.read()

sections = [
    ('book', '## 📚 20 книг', None),
    ('film', '## 🎬 20 фильмов', None),
    ('film', '## 📺 15 сериалов', 'series'),
    ('painting', '## 🖼 15 картин и графических произведений', None),
    ('music', '## 🎵 15 музыкальных произведений и альбомов', None),
    ('painting', '## 🗿 6 скульптур', 'sculpture'),
    ('painting', '## 🏛 6 произведений архитектуры', 'architecture'),
    ('film', '## 🎭 5 театральных произведений', 'theater'),
]

arts = []
for type_key, hdr, kind in sections:
    idx = text.find(hdr)
    assert idx >= 0, f'Section not found: {hdr}'
    next_idx = text.find('\n## ', idx + len(hdr))
    if next_idx < 0:
        next_idx = len(text)
    section_text = text[idx + len(hdr):next_idx]
    items = re.split(r'\n(?=\d+\. \*\*)', section_text)
    for item in items:
        m = re.match(r'(\d+)\. \*\*(.+?)\*\*\n\s+(.+?)(?:\n\n|\n---|\Z)', item, re.DOTALL)
        if not m:
            continue
        title = m.group(2).strip()
        note = re.sub(r'\s+', ' ', m.group(3).strip())
        if kind == 'series':
            title = f'Сериал «{title}»'
        elif kind == 'sculpture':
            title = f'Скульптура: {title}'
        elif kind == 'architecture':
            title = f'Архитектура: {title}'
        elif kind == 'theater':
            title = f'Театр: {title}'
        arts.append({'type': type_key, 'title': title, 'note': note})

print(f'Parsed arts: {len(arts)}')
by_t = {}
for a in arts:
    by_t[a['type']] = by_t.get(a['type'], 0) + 1
print('  by type:', by_t)

# ---- JS string escaping helper ----
def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def js_obj_quote(q):
    return f"      {{ text: {js_str(q['text'])}, author: {js_str(q['author'])}, note: {js_str(q['note'])} }}"

def js_obj_fact(f):
    return f"      {{ name: {js_str(f['name'])}, desc: {js_str(f['desc'])} }}"

def js_obj_art(a):
    return f"      {{ type: {js_str(a['type'])}, title: {js_str(a['title'])}, note: {js_str(a['note'])} }}"

quotes_js = '[\n' + ',\n'.join(js_obj_quote(q) for q in quotes) + '\n    ]'
facts_js = '[\n' + ',\n'.join(js_obj_fact(f) for f in facts) + '\n    ]'
arts_js = '[\n' + ',\n'.join(js_obj_art(a) for a in arts) + '\n    ]'

# ---- Now substitute in hallContent.js ----
hall_path = 'slw-main/slw-main/src/data/hallContent.js'
with open(hall_path, 'r', encoding='utf-8') as f:
    hall = f.read()

ne_start = hall.find('  Ne: {')
si_start = hall.find('  Si: {')
ne_block = hall[ne_start:si_start]

def replace_array(block, fieldname, new_js):
    pat = re.compile(rf'(    {re.escape(fieldname)}: )\[.*?\n    \](,?)\n', re.DOTALL)
    m = pat.search(block)
    if not m:
        return block, False
    return block[:m.start()] + m.group(1) + new_js + m.group(2) + '\n' + block[m.end():], True

ne_new, ok1 = replace_array(ne_block, 'quotes', quotes_js)
print(f'quotes replaced: {ok1}')
ne_new, ok2 = replace_array(ne_new, 'arts', arts_js)
print(f'arts replaced: {ok2}')
ne_new, ok3 = replace_array(ne_new, 'interestingFacts', facts_js)
print(f'interestingFacts replaced: {ok3}')

new_hall = hall[:ne_start] + ne_new + hall[si_start:]
print(f'old hallContent.js len: {len(hall)}, new len: {len(new_hall)}, delta: {len(new_hall)-len(hall)}')

with open(hall_path, 'w', encoding='utf-8') as f:
    f.write(new_hall)
print('saved')
