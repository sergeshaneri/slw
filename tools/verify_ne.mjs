// Structural verification of Ne content after dedup + expansion.
// Run from project root: node tools/verify_ne.mjs

import { HALL_CONTENT } from '../slw-main/slw-main/src/data/hallContent.js'
import { ASPECT_DATA } from '../slw-main/slw-main/src/data/aspects.js'
import { NE_CONTENT } from '../slw-main/slw-main/src/data/skills/Ne/index.js'
import { NE_SKILL_BLOCKS } from '../slw-main/slw-main/src/data/skills/Ne/skill-blocks.js'
import { ALL_SKILL_IDS as NE_TREE_IDS } from '../slw-main/slw-main/src/data/journey/skills/ne-tree.js'

const fail = []
const ok = []

// --- HALL_CONTENT.Ne ---
const hall = HALL_CONTENT.Ne
const hallChecks = [
  ['quotes',           80],
  ['figures',          20],
  ['arts',            102],
  ['interestingFacts', 90],
  ['archetypes',        4],
]
for (const [field, expected] of hallChecks) {
  const got = hall[field]?.length ?? 0
  const msg = `HALL.Ne.${field}: ${got}/${expected}`
  if (got === expected) ok.push(msg)
  else fail.push(`${msg} ✗`)
}

// --- ASPECT_DATA.Ne ---
const asp = ASPECT_DATA.Ne
// Forbidden fields (should be absent)
for (const forbidden of ['quotes', 'historicalFigures', 'art']) {
  if (forbidden in asp) fail.push(`ASPECT_DATA.Ne.${forbidden}: PRESENT (should be removed) ✗`)
  else ok.push(`ASPECT_DATA.Ne.${forbidden}: absent ✓`)
}
// Required fields with expected sizes
const aspChecks = [
  ['professions',  107],
  ['myths',         50],
  ['culturalDifferences', 50],
  ['childRaising', 50],
  ['childhoodQuestions', 50],
  ['skills',        36],
]
for (const [field, expected] of aspChecks) {
  const got = asp[field]?.length ?? 0
  const msg = `ASPECT_DATA.Ne.${field}: ${got}/${expected}`
  if (got >= expected) ok.push(msg + ' ✓')
  else fail.push(`${msg} ✗`)
}

// --- Sanity: Fe lacks same fields (Fe is the canonical pattern) ---
const fe = ASPECT_DATA.Fe
for (const forbidden of ['quotes', 'historicalFigures', 'art']) {
  if (forbidden in fe) fail.push(`ASPECT_DATA.Fe.${forbidden}: PRESENT (Fe should also lack) ✗`)
  else ok.push(`ASPECT_DATA.Fe.${forbidden}: absent (Fe baseline) ✓`)
}

// --- Skill blocks coverage ---
const blockIds = new Set(NE_SKILL_BLOCKS.map(b => b.skillId))
const treeIds = new Set(NE_TREE_IDS)
const missing = [...treeIds].filter(x => !blockIds.has(x))
if (missing.length === 0) ok.push(`NE_SKILL_BLOCKS covers all ${treeIds.size} tree skills ✓`)
else fail.push(`NE_SKILL_BLOCKS missing: ${missing.join(', ')} ✗`)

// --- SkillDetail+SkillTraits content coverage ---
const contentIds = new Set(Object.keys(NE_CONTENT))
const missingContent = [...treeIds].filter(x => !contentIds.has(x))
if (missingContent.length === 0) ok.push(`NE_CONTENT covers all ${treeIds.size} tree skills ✓`)
else fail.push(`NE_CONTENT missing: ${missingContent.join(', ')} ✗`)

// --- Reports ---
console.log('=== PASSED ===')
ok.forEach(m => console.log('  ' + m))
if (fail.length > 0) {
  console.log('\n=== FAILED ===')
  fail.forEach(m => console.log('  ' + m))
  process.exit(1)
} else {
  console.log('\nAll checks passed.')
}
