// Путешествие по аспекту БС (Белая Сенсорика) — планета Terra Harmonia.
//
// Источник истины — `bs-l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив
// объектов. Все правки контента делаются в md, не здесь.

import { parseJourneyMd } from '../parseScripts'
import bsL0Md from './bs-l0.md?raw'
import bsL1Md from './bs-l1.md?raw'

const l0 = parseJourneyMd(bsL0Md)
const l1 = parseJourneyMd(bsL1Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'bs-intro-N', поэтому переименуем.
export const BS_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `bs-intro-${i + 1}`
}))

export const BS_LEVEL_0_SCRIPTS = l0.scripts
export const BS_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }

export const BS_LEVEL_1_SCRIPTS = l1.scripts
export const BS_LEVEL_1_COMPLETE = l1.complete ?? { text: 'Уровень пройден.' }
