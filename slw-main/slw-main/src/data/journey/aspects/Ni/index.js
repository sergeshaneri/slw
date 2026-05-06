// Путешествие по аспекту Ni (Белая Интуиция, БИ) — планета Tempum Spiralis.
//
// Источник истины — `l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив объектов.
// Все правки контента — в md, не здесь.
//
// L3 — стартовая часть (4 круга = 20 шагов); продолжение по запросу.
// Анкеты навыков для Ni реализованы только для 3 общих базовых
// (attunement / subconscious-listening / inner-silence) — встроены инлайн
// в l0.md как часть L0-чата. Полное дерево навыков БИ (43 навыка по 4
// архетипам) и анкеты для архетипных навыков пока не интегрированы.

import { parseJourneyMd } from '../../parseScripts'
import niL0Md from './l0.md?raw'
import niL1Md from './l1.md?raw'
import niL2Md from './l2.md?raw'
import niL3Md from './l3.md?raw'

const l0 = parseJourneyMd(niL0Md)
const l1 = parseJourneyMd(niL1Md)
const l2 = parseJourneyMd(niL2Md)
const l3 = parseJourneyMd(niL3Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'ni-intro-N'.
export const NI_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `ni-intro-${i + 1}`
}))

export const NI_LEVEL_0_CORE = l0.scripts
export const NI_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }

export const NI_LEVEL_1_CORE = l1.scripts
export const NI_LEVEL_1_COMPLETE = l1.complete ?? { text: 'Уровень пройден.' }

export const NI_LEVEL_2_CORE = l2.scripts
export const NI_LEVEL_2_COMPLETE = l2.complete ?? { text: 'Уровень пройден.' }

export const NI_LEVEL_3_CORE = l3.scripts
export const NI_LEVEL_3_COMPLETE = l3.complete ?? { text: 'Уровень пройден.' }
