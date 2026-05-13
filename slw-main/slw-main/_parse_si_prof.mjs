// Parse Si/профессии БС.md into JSON, then emit the updated aspects.js professions block.
import fs from 'fs'

const mdPath = 'C:/Serge/slw-slw-instruct/slw-slw-instruct/Si/профессии БС.md'
const md = fs.readFileSync(mdPath, 'utf8')

// Split by profession headers "### N. Name"
const blocks = md.split(/\n### (\d+)\. (.+)\n/)
// blocks[0] = preamble, then triples: [num, title, body, num, title, body, ...]
const professions = []
for (let i = 1; i + 2 < blocks.length; i += 3) {
  const num = parseInt(blocks[i], 10)
  const title = blocks[i + 1].trim()
  const body = blocks[i + 2]
  // body starts with the descriptive paragraph(s), then "**Ключевые навыки БС:**\n- *Skill* — desc."
  const descMatch = body.match(/^\n([\s\S]+?)\n\n\*\*Ключевые навыки БС:\*\*/)
  if (!descMatch) {
    console.error(`No description match at #${num}: ${title}`)
    continue
  }
  const desc = descMatch[1].trim().replace(/\s+/g, ' ')
  // Extract skills: lines starting with "- *Name* — desc."
  const skillsBlock = body.slice(descMatch.index + descMatch[0].length)
  const skillRe = /^- \*([^*]+)\* — (.+?)$/gm
  const skills = []
  let m
  while ((m = skillRe.exec(skillsBlock))) {
    if (skills.length >= 4) break // each profession has 4
    const name = m[1].trim()
    const sd = m[2].trim().replace(/\.$/, '')
    skills.push({ name, desc: sd })
  }
  if (skills.length !== 4) {
    console.error(`#${num} ${title}: got ${skills.length} skills, expected 4`)
  }
  professions.push({ num, name: title, desc, skills })
}

console.log(`Parsed ${professions.length} professions`)
// Sanity check: ensure all have 4 skills
const bad = professions.filter(p => p.skills.length !== 4)
console.log(`Professions with ≠4 skills: ${bad.length}`)
if (bad.length) console.log(bad.map(p => `#${p.num} ${p.name} (${p.skills.length})`).join('\n'))

// Categories (from ## headers in markdown order)
const catHeaders = md.match(/^## .+? \(\d+\)$/gm)
console.log('\nCategories:')
catHeaders.forEach(h => console.log('  ', h))

// Emit a flat array of {name, desc, skills} for aspects.js (single quotes escaped)
function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
const emitted = ['  professions: [']
let categoryIndex = -1
const categoryNames = catHeaders.map(h => h.replace(/^## /, ''))
// Walk through markdown to determine category for each profession
const catBoundaries = []
const catRe = /^## (.+? \(\d+\))$/gm
let cm
while ((cm = catRe.exec(md))) {
  catBoundaries.push({ idx: cm.index, name: cm[1] })
}
function catForNum(num) {
  // find profession's position in markdown
  const profRe = new RegExp(`^### ${num}\\. `, 'm')
  const pm = profRe.exec(md)
  if (!pm) return null
  let last = null
  for (const c of catBoundaries) if (c.idx < pm.index) last = c.name
  return last
}

let lastCat = ''
for (const p of professions) {
  const cat = catForNum(p.num)
  if (cat && cat !== lastCat) {
    emitted.push(`    // — ${cat} —`)
    lastCat = cat
  }
  emitted.push(`    {`)
  emitted.push(`      name: '${esc(p.name)}',`)
  emitted.push(`      desc: '${esc(p.desc)}',`)
  emitted.push(`      skills: [`)
  for (let i = 0; i < p.skills.length; i++) {
    const s = p.skills[i]
    const comma = i < p.skills.length - 1 ? ',' : ''
    emitted.push(`        { name: '${esc(s.name)}', desc: '${esc(s.desc)}' }${comma}`)
  }
  emitted.push(`      ]`)
  emitted.push(`    }${p.num < professions.length ? ',' : ''}`)
}
emitted.push('  ],')

fs.writeFileSync('_si_prof_block.txt', emitted.join('\n'))
console.log(`\nEmitted ${emitted.length} lines to _si_prof_block.txt`)
console.log(`Total professions in output: ${professions.length}`)
