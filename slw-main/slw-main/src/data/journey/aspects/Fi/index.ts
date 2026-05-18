// Путешествие по аспекту Fi (Белая Этика, БЭ) — планета Anima Humanitatis.
//
// Источник истины — `l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив объектов.
// Все правки контента — в md, не здесь.
//
// L3 — стартовая часть (4 круга = 20 шагов); продолжение по запросу.
// Анкеты навыков для Fi пока не интегрированы — будут добавлены позже отдельным md.

import type { Script } from '@/types/script'
import type { CompleteEntry, IntroEntry } from '../../parseScripts'
import { parseJourneyMd } from '../../parseScripts'
import fiL0Md from './l0.md?raw'
import fiL1Md from './l1.md?raw'
import fiL2Md from './l2.md?raw'
import fiL3Md from './l3.md?raw'

const l0 = parseJourneyMd(fiL0Md)
const l1 = parseJourneyMd(fiL1Md)
const l2 = parseJourneyMd(fiL2Md)
const l3 = parseJourneyMd(fiL3Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'fi-intro-N'.
export const FI_ASPECT_INTRO: IntroEntry[] = l0.intro.map((entry, i) => ({
  ...entry,
  id: `fi-intro-${i + 1}`
}))

export const FI_LEVEL_0_CORE: Script[] = l0.scripts
export const FI_LEVEL_0_COMPLETE: CompleteEntry = l0.complete ?? { text: 'Уровень пройден.' }

export const FI_LEVEL_1_CORE: Script[] = l1.scripts
export const FI_LEVEL_1_COMPLETE: CompleteEntry = l1.complete ?? { text: 'Уровень пройден.' }

export const FI_LEVEL_2_CORE: Script[] = l2.scripts
export const FI_LEVEL_2_COMPLETE: CompleteEntry = l2.complete ?? { text: 'Уровень пройден.' }

export const FI_LEVEL_3_CORE: Script[] = l3.scripts
export const FI_LEVEL_3_COMPLETE: CompleteEntry = l3.complete ?? { text: 'Уровень пройден.' }
