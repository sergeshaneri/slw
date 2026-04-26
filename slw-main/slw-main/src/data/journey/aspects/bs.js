// Путешествие по аспекту БС (Белая Сенсорика) — планета Terra Harmonia.
//
// Источник истины — `bs-l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив
// объектов. Все правки контента делаются в md, не здесь.
//
// Каждый уровень делится на core (основной маршрут) и pool
// (опциональные шаги, помеченные `pool: true` в md). См.
// `SCRIPT_GUIDELINES.md` §8.

import { parseJourneyMd } from '../parseScripts'
import { SKILL_TO_ARCHETYPE, ARCHETYPE_KEYS } from '../skills/tree'
import bsL0Md from './bs-l0.md?raw'
import bsL1Md from './bs-l1.md?raw'

const l0 = parseJourneyMd(bsL0Md)
const l1 = parseJourneyMd(bsL1Md)

const splitCorePool = (scripts) => ({
  core: scripts.filter(s => !s.pool),
  pool: scripts.filter(s => s.pool)
})

// Pool анкет (type='survey') для L0 идёт «по очереди» через 4 архетипа,
// чтобы пользователь видел разные ветки навыков, а не сидел 12 анкет
// подряд по Целителю. Не-survey шаги pool (если будут) сохраняются в
// исходном порядке и идут после анкет.
function interleaveSurveysByArchetype(poolScripts) {
  const surveys = poolScripts.filter(s => s.type === 'survey')
  const others = poolScripts.filter(s => s.type !== 'survey')

  // Группируем survey-шаги по архетипу из tree.js.
  const buckets = {}
  for (const key of ARCHETYPE_KEYS) buckets[key] = []
  for (const s of surveys) {
    const arche = SKILL_TO_ARCHETYPE[s.skill]
    if (arche && buckets[arche]) buckets[arche].push(s)
    else others.push(s)  // если skill не размечен — кладём в хвост
  }

  // Round-robin: на каждом круге берём по одному из каждого ведра,
  // пока все не опустеют. Архетипы в порядке ARCHETYPE_KEYS:
  // Целитель → Эстет → Мастер Наслаждения → Хранитель Очага.
  const interleaved = []
  let added = true
  let cursor = 0
  while (added) {
    added = false
    for (const key of ARCHETYPE_KEYS) {
      const item = buckets[key][cursor]
      if (item) {
        interleaved.push(item)
        added = true
      }
    }
    cursor++
  }

  return [...interleaved, ...others]
}

const l0Split = splitCorePool(l0.scripts)
l0Split.pool = interleaveSurveysByArchetype(l0Split.pool)
const l1Split = splitCorePool(l1.scripts)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'bs-intro-N', поэтому переименуем.
export const BS_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `bs-intro-${i + 1}`
}))

export const BS_LEVEL_0_CORE = l0Split.core
export const BS_LEVEL_0_POOL = l0Split.pool
export const BS_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }

export const BS_LEVEL_1_CORE = l1Split.core
export const BS_LEVEL_1_POOL = l1Split.pool
export const BS_LEVEL_1_COMPLETE = l1.complete ?? { text: 'Уровень пройден.' }
