// Путешествие по аспекту БЛ (Белая Логика) — планета Structura Mentis.
//
// Источник истины — `bl-l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив объектов.
// Все правки контента — в md, не здесь.
//
// Анкет навыков для БЛ пока нет — будут добавлены позже отдельным md.

import { parseJourneyMd } from '../parseScripts'
import blL0Md from './bl-l0.md?raw'

const l0 = parseJourneyMd(blL0Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'bl-intro-N'.
export const BL_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `bl-intro-${i + 1}`
}))

export const BL_LEVEL_0_CORE = l0.scripts
export const BL_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }
