// Контент Ti-навыков (БЛ). Объединение по архетипам.
//
// Структура одного навыка совпадает со SKILLS_CONTENT (Si) и FE_CONTENT:
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует TI_CONTENT
// после SI/FE/NE. ID навыков БЛ совпадают с ti-tree.js (без префикса).

import type { Skill } from '@/types/skill'
import { CORE } from './core'
import { ANALYST } from './analyst'
import { ARCHITECT } from './architect'
import { GUARDIAN } from './guardian'
import { ENCYCLOPEDIST } from './encyclopedist'

export const TI_CONTENT: Record<string, Skill> = {
  ...CORE,
  ...ANALYST,
  ...ARCHITECT,
  ...GUARDIAN,
  ...ENCYCLOPEDIST
}

export function getTiContent(skillId: string): Skill | null {
  return TI_CONTENT[skillId] ?? null
}

export function hasTiContent(skillId: string): boolean {
  return skillId in TI_CONTENT
}
