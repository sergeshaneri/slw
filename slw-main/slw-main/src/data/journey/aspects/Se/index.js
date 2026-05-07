// Путешествие по аспекту Se (Чёрная Сенсорика, ЧС) — планета Imperium Magnum.
//
// Источник истины — `l*.md` (core-сценарий уровня) и
// `l0-surveys.md` (47 анкет по навыкам). Vite импортирует их как
// сырой текст через `?raw`, парсер `parseScripts.js` раскручивает в
// массив объектов. Все правки контента делаются в md, не здесь.
//
// Уровни идут линейным core-маршрутом. Анкеты лежат отдельно от L0
// и доступны только через дерево навыков (Колесо Se), не из L0-чата.

import { parseJourneyMd } from '../../parseScripts'
import { SKILL_TO_ARCHETYPE, ARCHETYPE_KEYS } from '../../skills/se-tree'
import seL0Md from './l0.md?raw'
import seL0SurveysMd from './l0-surveys.md?raw'
import seL1Md from './l1.md?raw'
import seL2Md from './l2.md?raw'
import seL3Md from './l3.md?raw'

const l0 = parseJourneyMd(seL0Md)
const l0Surveys = parseJourneyMd(seL0SurveysMd)
const l1 = parseJourneyMd(seL1Md)
const l2 = parseJourneyMd(seL2Md)
const l3 = parseJourneyMd(seL3Md)

// Survey-шаги идут «по очереди» через 4 архетипа, чтобы пользователь
// видел разные ветки навыков, а не сидел 12 анкет подряд по Защитнику.
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
  // Защитник → Правитель → Строитель → Герой.
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
// Журнал ожидает id вида 'se-intro-N', поэтому переименуем.
export const SE_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `se-intro-${i + 1}`
}))

export const SE_LEVEL_0_CORE = l0.scripts
export const SE_LEVEL_0_SURVEYS = interleaveSurveysByArchetype(l0Surveys.scripts)
export const SE_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }

export const SE_LEVEL_1_CORE = l1.scripts
export const SE_LEVEL_1_COMPLETE = l1.complete ?? { text: 'Уровень пройден.' }

export const SE_LEVEL_2_CORE = l2.scripts
export const SE_LEVEL_2_COMPLETE = l2.complete ?? { text: 'Уровень пройден.' }

export const SE_LEVEL_3_CORE = l3.scripts
export const SE_LEVEL_3_COMPLETE = l3.complete ?? { text: 'Уровень пройден.' }
