"""Structural verification of Ne content after dedup + expansion."""
import re

def count_list(text, fieldname, indent='    '):
    """Count items in `    fieldname: [\n      { ... }\n    ]`."""
    pat = re.compile(rf'{indent}{re.escape(fieldname)}: \[\n(.*?)\n{indent}\]', re.DOTALL)
    m = pat.search(text)
    if not m:
        return -1
    body = m.group(1)
    # Items are objects starting with "      { " (6-space indent) or strings starting with "      '"
    n_obj = len(re.findall(r'\n      \{', body))
    n_str = len(re.findall(r"\n      '", body))
    return n_obj + n_str + (1 if body.strip().startswith('{') or body.strip().startswith("'") else 0)

def count_aspect_list(block, fieldname):
    pat = re.compile(rf'  {re.escape(fieldname)}: \[\n(.*?)\n  \]', re.DOTALL)
    m = pat.search(block)
    if not m:
        return -1
    body = m.group(1)
    n_obj = len(re.findall(r'\n    \{', body))
    n_str = len(re.findall(r"\n    '", body))
    # Count first item too
    if body.strip().startswith('{') or body.strip().startswith("'"):
        return n_obj + n_str + 1
    return n_obj + n_str

ok = []
fail = []

# --- aspects.js ---
with open('slw-main/slw-main/src/data/aspects.js', 'r', encoding='utf-8') as f:
    aspects = f.read()

# Find Ne and Fe blocks
def extract_block(text, key):
    m_start = re.search(rf'ASPECT_DATA\.{key} = \{{', text)
    if not m_start:
        return None
    # Find next ASPECT_DATA line
    after = text[m_start.end():]
    m_next = re.search(r'\nASPECT_DATA\.\w+ = \{', after)
    end = m_next.start() + m_start.end() if m_next else len(text)
    return text[m_start.start():end]

ne_block = extract_block(aspects, 'Ne')
fe_block = extract_block(aspects, 'Fe')

# Forbidden fields in Ne (and Fe baseline)
for forbidden in ['quotes', 'historicalFigures', 'art']:
    has_ne = re.search(rf'\n  {re.escape(forbidden)}:', ne_block) is not None
    has_fe = re.search(rf'\n  {re.escape(forbidden)}:', fe_block) is not None
    if has_ne:
        fail.append(f'ASPECT_DATA.Ne.{forbidden}: PRESENT (should be removed)')
    else:
        ok.append(f'ASPECT_DATA.Ne.{forbidden}: absent')
    if has_fe:
        fail.append(f'ASPECT_DATA.Fe.{forbidden}: PRESENT (Fe baseline broken!)')
    else:
        ok.append(f'ASPECT_DATA.Fe.{forbidden}: absent (Fe baseline)')

# Required fields with expected sizes (Ne)
asp_checks = [
    ('professions',         107),
    ('myths',                50),
    ('culturalDifferences',  50),
    ('childRaising',         50),
    ('childhoodQuestions',   50),
    ('skills',               36),
]
for field, expected in asp_checks:
    got = count_aspect_list(ne_block, field)
    if got >= expected:
        ok.append(f'ASPECT_DATA.Ne.{field}: {got}/{expected}')
    else:
        fail.append(f'ASPECT_DATA.Ne.{field}: {got}/{expected}')

# --- hallContent.js ---
with open('slw-main/slw-main/src/data/hallContent.js', 'r', encoding='utf-8') as f:
    hall = f.read()

ne_start = hall.find('  Ne: {')
si_start = hall.find('  Si: {')
hall_ne = hall[ne_start:si_start]

hall_checks = [
    ('quotes',           80),
    ('figures',          20),
    ('arts',            102),
    ('interestingFacts', 90),
    ('archetypes',        4),
]
for field, expected in hall_checks:
    got = count_list(hall_ne, field, indent='    ')
    if got >= expected:
        ok.append(f'HALL.Ne.{field}: {got}/{expected}')
    else:
        fail.append(f'HALL.Ne.{field}: {got}/{expected}')

# --- skill-blocks.js coverage ---
with open('slw-main/slw-main/src/data/skills/Ne/skill-blocks.js', 'r', encoding='utf-8') as f:
    sb_text = f.read()
skill_ids_in_blocks = set(re.findall(r"skillId:\s*'([^']+)'", sb_text))

with open('slw-main/slw-main/src/data/journey/skills/ne-tree.js', 'r', encoding='utf-8') as f:
    tree_text = f.read()
# Skill IDs in tree are id: 'foo' fields
skill_ids_in_tree = set(re.findall(r"id:\s*'([^']+)'", tree_text))

# Filter tree IDs: exclude archetype-meta IDs (sage, pioneer, etc.); count only those that look like skills
# Skills don't have nested structure like archetype id. The tree's COMMON_BASE_SKILLS + archetype.skills are
# what we care about. Simpler heuristic: count IDs that appear as `id: 'X'` where X has hyphens or is one of common-base
tree_skill_ids = {sid for sid in skill_ids_in_tree if '-' in sid or sid in ['mindfulness', 'metacognition']}

missing_in_blocks = tree_skill_ids - skill_ids_in_blocks
if missing_in_blocks:
    fail.append(f'NE_SKILL_BLOCKS missing skill IDs: {sorted(missing_in_blocks)}')
else:
    ok.append(f'NE_SKILL_BLOCKS covers all {len(tree_skill_ids)} tree skills')

# Print (ASCII-only for Windows console compatibility)
print('=== PASSED ===')
for m in ok:
    print('  [OK]', m)
if fail:
    print('\n=== FAILED ===')
    for m in fail:
        print('  [FAIL]', m)
    raise SystemExit(1)
else:
    print('\nAll checks passed.')
