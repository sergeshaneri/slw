// Путешествие по аспекту БС (Белая Сенсорика) — планета Terra Harmonia.
//
// Источник истины — `bs-l*.md` (core-сценарий уровня) и
// `bs-l0-surveys.md` (33 анкеты по навыкам). Vite импортирует их как
// сырой текст через `?raw`, парсер `parseScripts.js` раскручивает в
// массив объектов. Все правки контента делаются в md, не здесь.
//
// Уровни идут линейным core-маршрутом. Анкеты лежат отдельно от L0
// и доступны только через дерево навыков (Колесо БС), не из L0-чата.

import { parseJourneyMd } from '../parseScripts'
import { SKILL_TO_ARCHETYPE, ARCHETYPE_KEYS } from '../skills/tree'
import bsL0Md from './bs-l0.md?raw'
import bsL0SurveysMd from './bs-l0-surveys.md?raw'
import bsL1Md from './bs-l1.md?raw'
import bsL2Md from './bs-l2.md?raw'

const l0 = parseJourneyMd(bsL0Md)
const l0Surveys = parseJourneyMd(bsL0SurveysMd)
const l1 = parseJourneyMd(bsL1Md)
const l2 = parseJourneyMd(bsL2Md)

// Survey-шаги идут «по очереди» через 4 архетипа, чтобы пользователь
// видел разные ветки навыков, а не сидел 12 анкет подряд по Целителю.
function interleaveSurveysByArchetype(surveys) {
  const buckets = {}
  for (const key of ARCHETYPE_KEYS) buckets[key] = []
  const others = []
  for (const s of surveys) {
    const arche = SKILL_TO_ARCHETYPE[s.skill]
    if (arche && buckets[arche]) buckets[arche].push(s)
    else others.push(s)
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

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'bs-intro-N', поэтому переименуем.
export const BS_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `bs-intro-${i + 1}`
}))

export const BS_LEVEL_0_CORE = l0.scripts
export const BS_LEVEL_0_SURVEYS = interleaveSurveysByArchetype(l0Surveys.scripts)
export const BS_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }

export const BS_LEVEL_1_CORE = l1.scripts
export const BS_LEVEL_1_COMPLETE = l1.complete ?? { text: 'Уровень пройден.' }

export const BS_LEVEL_2_CORE = l2.scripts
export const BS_LEVEL_2_COMPLETE = l2.complete ?? { text: 'Уровень пройден.' }
