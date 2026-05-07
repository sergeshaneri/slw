// Контент Fe-навыков. Объединение по архетипам.
//
// Структура одного навыка совпадает с SKILLS_CONTENT (Si):
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует FE_CONTENT
// после SKILLS_CONTENT (Si). ID не пересекаются: Si без префикса,
// Fe с префиксом 'fe-'.

import { CORE } from './core'

export const FE_CONTENT = {
  ...CORE
  // ...ZAVODILA, ...ORATOR, ...ARTIST, ...MASTER_ATMO добавятся по ходу.
}

export function getFeContent(skillId) {
  return FE_CONTENT[skillId] ?? null
}

export function hasFeContent(skillId) {
  return skillId in FE_CONTENT
}
