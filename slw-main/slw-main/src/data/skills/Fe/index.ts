// Контент Fe-навыков. Объединение по архетипам.
//
// Структура одного навыка совпадает с SKILLS_CONTENT (Si):
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует FE_CONTENT
// после SKILLS_CONTENT (Si). ID не пересекаются: Si без префикса,
// Fe с префиксом 'fe-'.

import type { Skill } from '@/types/skill'
import { CORE } from './core'
import { ZAVODILA } from './zavodila'
import { ORATOR } from './orator'
import { ARTIST } from './artist'
import { MASTER_ATMO } from './master-atmo'

export const FE_CONTENT: Record<string, Skill> = {
  ...CORE,
  ...ZAVODILA,
  ...ORATOR,
  ...ARTIST,
  ...MASTER_ATMO
}

export function getFeContent(skillId: string): Skill | null {
  return FE_CONTENT[skillId] ?? null
}

export function hasFeContent(skillId: string): boolean {
  return skillId in FE_CONTENT
}
