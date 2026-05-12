// Контент Ne-навыков. Объединение по архетипам.
//
// Структура одного навыка совпадает с SI_CONTENT и FE_CONTENT:
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует NE_CONTENT
// после SI_CONTENT и FE_CONTENT. ID не пересекаются: Si без префикса,
// Fe с префиксом 'fe-', Ne — короткие латинские ID без префикса
// (read-program, variants, socratic, ...).

import { NE_CORE } from './core'

export const NE_CONTENT = {
  ...NE_CORE
}

export function getNeContent(skillId) {
  return NE_CONTENT[skillId] ?? null
}

export function hasNeContent(skillId) {
  return skillId in NE_CONTENT
}
