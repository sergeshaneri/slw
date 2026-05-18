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

import type { Skill } from '@/types/skill'
import { NE_CORE } from './core'
import { SAGE } from './sage'
import { PIONEER } from './pioneer'
import { CATALYST } from './catalyst'
import { VISIONARY } from './visionary'

export const NE_CONTENT: Record<string, Skill> = {
  ...NE_CORE,
  ...SAGE,
  ...PIONEER,
  ...CATALYST,
  ...VISIONARY
}

export function getNeContent(skillId: string): Skill | null {
  return NE_CONTENT[skillId] ?? null
}

export function hasNeContent(skillId: string): boolean {
  return skillId in NE_CONTENT
}
