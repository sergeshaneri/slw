// Контент Fi-навыков. Объединение по архетипам.
//
// Структура одного навыка совпадает со SKILLS_CONTENT (Si) и FE_CONTENT (Fe):
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует FI_CONTENT после
// FE/NE/NI/TE/TI_CONTENT. ID не пересекаются: Fi с префиксом 'fi-'.
//
// 58 навыков:
//   - core: 2 (fi-trust, fi-values-check)
//   - diplomat: 17
//   - confessor: 14
//   - ancestor: 9
//   - friend: 16

import type { Skill } from '@/types/skill'
import { CORE } from './core'
import { DIPLOMAT } from './diplomat'
import { CONFESSOR } from './confessor'
import { ANCESTOR } from './ancestor'
import { FRIEND } from './friend'

export const FI_CONTENT: Record<string, Skill> = {
  ...CORE,
  ...DIPLOMAT,
  ...CONFESSOR,
  ...ANCESTOR,
  ...FRIEND
}

export function getFiContent(skillId: string): Skill | null {
  return FI_CONTENT[skillId] ?? null
}

export function hasFiContent(skillId: string): boolean {
  return skillId in FI_CONTENT
}
