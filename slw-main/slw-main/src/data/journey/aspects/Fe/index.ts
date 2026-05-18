// Путешествие по аспекту Fe (Чёрная Этика, ЧЭ) — планета Passio Ignis.
//
// Источник истины — `l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив объектов.
// Все правки контента — в md, не здесь.
//
// L3 — стартовая часть (4 круга = 20 шагов); продолжение по запросу.
// Анкеты навыков для Fe пока не интегрированы — будут добавлены позже отдельным md.

import type { Script } from '@/types/script'
import type { CompleteEntry, IntroEntry } from '../../parseScripts'
import { parseJourneyMd } from '../../parseScripts'
import feL0Md from './l0.md?raw'
import feL1Md from './l1.md?raw'
import feL2Md from './l2.md?raw'
import feL3Md from './l3.md?raw'

const l0 = parseJourneyMd(feL0Md)
const l1 = parseJourneyMd(feL1Md)
const l2 = parseJourneyMd(feL2Md)
const l3 = parseJourneyMd(feL3Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'che-intro-N'.
export const FE_ASPECT_INTRO: IntroEntry[] = l0.intro.map((entry, i) => ({
  ...entry,
  id: `che-intro-${i + 1}`
}))

// CSURV-1..3 для ядерных навыков (Эмо-осознанность, Выразительность,
// Конгруэнтность) встроены инлайн в l0.md как часть L0-чата
// после R-3 «Намерение на завтра» — пользователь проходит их в линейном
// потоке. Параллельный пул surveys (как у Si) здесь не используется.
export const FE_LEVEL_0_CORE: Script[] = l0.scripts
export const FE_LEVEL_0_COMPLETE: CompleteEntry = l0.complete ?? { text: 'Уровень пройден.' }

export const FE_LEVEL_1_CORE: Script[] = l1.scripts
export const FE_LEVEL_1_COMPLETE: CompleteEntry = l1.complete ?? { text: 'Уровень пройден.' }

export const FE_LEVEL_2_CORE: Script[] = l2.scripts
export const FE_LEVEL_2_COMPLETE: CompleteEntry = l2.complete ?? { text: 'Уровень пройден.' }

export const FE_LEVEL_3_CORE: Script[] = l3.scripts
export const FE_LEVEL_3_COMPLETE: CompleteEntry = l3.complete ?? { text: 'Уровень пройден.' }
