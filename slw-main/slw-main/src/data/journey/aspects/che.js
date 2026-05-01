// Путешествие по аспекту ЧЭ (Чёрная Этика) — планета Passio Ignis.
//
// Источник истины — `che-l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив объектов.
// Все правки контента — в md, не здесь.
//
// L3 — стартовая часть (4 круга = 20 шагов); продолжение по запросу.
// Анкеты навыков для ЧЭ пока не интегрированы — будут добавлены позже отдельным md.

import { parseJourneyMd } from '../parseScripts'
import cheL0Md from './che-l0.md?raw'
import cheL1Md from './che-l1.md?raw'
import cheL2Md from './che-l2.md?raw'
import cheL3Md from './che-l3.md?raw'

const l0 = parseJourneyMd(cheL0Md)
const l1 = parseJourneyMd(cheL1Md)
const l2 = parseJourneyMd(cheL2Md)
const l3 = parseJourneyMd(cheL3Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'che-intro-N'.
export const CHE_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `che-intro-${i + 1}`
}))

// CSURV-1..3 для ядерных навыков (Эмо-осознанность, Выразительность,
// Конгруэнтность) встроены инлайн в che-l0.md как часть L0-чата
// после R-3 «Намерение на завтра» — пользователь проходит их в линейном
// потоке. Параллельный пул surveys (как у БС) здесь не используется.
export const CHE_LEVEL_0_CORE = l0.scripts
export const CHE_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }

export const CHE_LEVEL_1_CORE = l1.scripts
export const CHE_LEVEL_1_COMPLETE = l1.complete ?? { text: 'Уровень пройден.' }

export const CHE_LEVEL_2_CORE = l2.scripts
export const CHE_LEVEL_2_COMPLETE = l2.complete ?? { text: 'Уровень пройден.' }

export const CHE_LEVEL_3_CORE = l3.scripts
export const CHE_LEVEL_3_COMPLETE = l3.complete ?? { text: 'Уровень пройден.' }
