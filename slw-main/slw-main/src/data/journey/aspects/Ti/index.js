// Путешествие по аспекту Ti (Белая Логика, БЛ) — планета Structura Mentis.
//
// Источник истины — `l*.md`. Vite импортирует их как сырой текст
// через `?raw`, парсер `parseScripts.js` раскручивает в массив объектов.
// Все правки контента — в md, не здесь.
//
// Анкет навыков для Ti пока нет — будут добавлены позже отдельным md.

import { parseJourneyMd } from '../../parseScripts'
import tiL0Md from './l0.md?raw'

const l0 = parseJourneyMd(tiL0Md)

// «intro» в md превращается в массив с id='intro-1', 'intro-2', …
// Журнал ожидает id вида 'bl-intro-N'.
export const TI_ASPECT_INTRO = l0.intro.map((entry, i) => ({
  ...entry,
  id: `bl-intro-${i + 1}`
}))

export const TI_LEVEL_0_CORE = l0.scripts
export const TI_LEVEL_0_COMPLETE = l0.complete ?? { text: 'Уровень пройден.' }
