// Контент Ni-навыков. Объединение по архетипам.
//
// Структура одного навыка совпадает с SI_CONTENT, FE_CONTENT и NE_CONTENT:
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует NI_CONTENT
// после Si/Fe/Ne. ID не пересекаются: Si без префикса, Fe с префиксом 'fe-',
// Ne без префикса (короткие латинские), Ni без префикса (короткие латинские,
// собственные — см. ni-tree.js).

import type { Skill } from '@/types/skill'
import { NI_CORE } from './core'
import { MYTHMAKER } from './mythmaker'
import { SEER } from './seer'
import { DEBUNKER } from './debunker'
import { SHAMAN } from './shaman'

export const NI_CONTENT: Record<string, Skill> = {
  ...NI_CORE,
  ...MYTHMAKER,
  ...SEER,
  ...DEBUNKER,
  ...SHAMAN
}

export function getNiContent(skillId: string): Skill | null {
  return NI_CONTENT[skillId] ?? null
}

export function hasNiContent(skillId: string): boolean {
  return skillId in NI_CONTENT
}
