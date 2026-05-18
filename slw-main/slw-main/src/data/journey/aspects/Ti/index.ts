// Путешествие по аспекту Ti (Белая Логика, БЛ) — планета Structura Mentalis.
//
// Источник истины — `l*.md` (core-сценарий уровня) и
// `l0-surveys.md` (41 анкета по навыкам). Vite импортирует их как
// сырой текст через `?raw`, парсер `parseScripts.js` раскручивает в
// массив объектов. Все правки контента делаются в md, не здесь.
//
// Уровни идут линейным core-маршрутом. Анкеты лежат отдельно от L0
// и доступны только через дерево навыков (Колесо БЛ), не из L0-чата.

import type { Script } from '@/types/script'
import type { CompleteEntry, IntroEntry } from '../../parseScripts'
import { parseJourneyMd } from '../../parseScripts'
import { SKILL_TO_ARCHETYPE, ARCHETYPE_KEYS } from '../../skills/ti-tree'
import type { TiArchetypeKey } from '../../skills/ti-tree'
import tiL0Md from './l0.md?raw'
import tiL0SurveysMd from './l0-surveys.md?raw'
import tiL1Md from './l1.md?raw'
import tiL2Md from './l2.md?raw'
import tiL3Md from './l3.md?raw'

const l0 = parseJourneyMd(tiL0Md)
const l0Surveys = parseJourneyMd(tiL0SurveysMd)
const l1 = parseJourneyMd(tiL1Md)
const l2 = parseJourneyMd(tiL2Md)
const l3 = parseJourneyMd(tiL3Md)

// Survey-шаги идут «по очереди» через 4 архетипа, чтобы пользователь
// видел разные ветки навыков, а не сидел 8/7/11/12 анкет подряд по
// одному архетипу. Round-robin: Аналитик → Архитектор → Хранитель → Энциклопедист.
function interleaveSurveysByArchetype(surveys: Script[]): Script[] {
  const buckets: Record<TiArchetypeKey, Script[]> = {
    analyst: [], architect: [], guardian: [], encyclopedist: []
  }
  const others: Script[] = []
  for (const s of surveys) {
    const arche = s.skill ? SKILL_TO_ARCHETYPE[s.skill] : undefined
    if (arche && buckets[arche]) buckets[arche].push(s)
    else others.push(s)
  }

  const interleaved: Script[] = []
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
// Журнал ожидает id вида 'bl-intro-N'.
export const TI_ASPECT_INTRO: IntroEntry[] = l0.intro.map((entry, i) => ({
  ...entry,
  id: `bl-intro-${i + 1}`
}))

export const TI_LEVEL_0_CORE: Script[] = l0.scripts
export const TI_LEVEL_0_SURVEYS: Script[] = interleaveSurveysByArchetype(l0Surveys.scripts)
export const TI_LEVEL_0_COMPLETE: CompleteEntry = l0.complete ?? { text: 'Уровень пройден.' }

export const TI_LEVEL_1_CORE: Script[] = l1.scripts
export const TI_LEVEL_1_COMPLETE: CompleteEntry = l1.complete ?? { text: 'Уровень пройден.' }

export const TI_LEVEL_2_CORE: Script[] = l2.scripts
export const TI_LEVEL_2_COMPLETE: CompleteEntry = l2.complete ?? { text: 'Уровень пройден.' }

export const TI_LEVEL_3_CORE: Script[] = l3.scripts
export const TI_LEVEL_3_COMPLETE: CompleteEntry = l3.complete ?? { text: 'Уровень пройден.' }
