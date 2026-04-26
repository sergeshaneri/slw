// Путешествие по аспекту БС (Белая Сенсорика) — планета Terra Harmonia.
//
// Источник истины — `bs-l0.md`. Vite импортирует его как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает его в массив
// объектов. Все правки контента делаются в md, не здесь.

import { parseJourneyMd } from '../parseScripts'
import bsL0Md from './bs-l0.md?raw'

const parsed = parseJourneyMd(bsL0Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'bs-intro-N', поэтому переименуем.
export const BS_ASPECT_INTRO = parsed.intro.map((entry, i) => ({
  ...entry,
  id: `bs-intro-${i + 1}`
}))

export const BS_LEVEL_0_SCRIPTS = parsed.scripts

export const BS_LEVEL_0_COMPLETE = parsed.complete ?? {
  text: 'Уровень пройден.'
}
