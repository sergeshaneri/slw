// Контент Te-навыков. Объединение по архетипам.
//
// Структура одного навыка совпадает с FE_CONTENT (Fe) / SI_CONTENT (Si):
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует TE_CONTENT
// после FE_CONTENT. ID не пересекаются: Si без префикса, Fe с префиксом 'fe-',
// Te с собственными уникальными id (work-vs-busyness, pragmatic-thinking, ...).
//
// Состав:
//   CORE — 7 универсальных (4 сквозных + 3 распределённых):
//     - Подгруппа A (сквозные): work-vs-busyness, goal-holding,
//       cost-benefit-vision, technological-thinking. archetype: 'common'.
//     - Подгруппа B (распределённые): pragmatic-thinking (virtuoso),
//       time-management (organizer), completion (virtuoso). role: 'core'.
//   VIRTUOSO — 12 архетипных Виртуоза (TODO)
//   TECHNOLOGIST — 14 архетипных Технолога (TODO)
//   ORGANIZER — 18 архетипных Организатора (TODO)
//   ENGINEER — 11 архетипных Инженера (TODO)

import { CORE } from './core'
import { VIRTUOSO } from './virtuoso'
import { TECHNOLOGIST } from './technologist'
import { ORGANIZER } from './organizer'

export const TE_CONTENT = {
  ...CORE,
  ...VIRTUOSO,
  ...TECHNOLOGIST,
  ...ORGANIZER
  // ...ENGINEER
}

export function getTeContent(skillId) {
  return TE_CONTENT[skillId] ?? null
}

export function hasTeContent(skillId) {
  return skillId in TE_CONTENT
}
