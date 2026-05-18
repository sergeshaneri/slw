// Контент Si-навыков (БС). Объединение по архетипам + универсальные.
//
// Структура одного навыка совпадает с FE_CONTENT (data/skills/Fe/):
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует SI_CONTENT
// (а также FE_CONTENT для Fe-навыков). ID не пересекаются: Si без
// префикса, Fe с префиксом 'fe-'.
//
// Источник контента: Si/Навыки БС — <Архетип>.md и Si/Навыки БС — Универсальные.md.
// На текущий момент заполнены пилотные навыки (см. healer.js).
// Незаполненные — SkillDetail покажет «Подробный разбор скоро будет».

import type { Skill } from '@/types/skill'
import { CORE } from './core'
import { HEALER } from './healer'
import { AESTHETE } from './aesthete'
import { HEDONIST } from './hedonist'
import { KEEPER } from './keeper'

export const SI_CONTENT: Record<string, Skill> = {
  ...CORE,
  ...HEALER,
  ...AESTHETE,
  ...HEDONIST,
  ...KEEPER
}

export function getSiContent(skillId: string): Skill | null {
  return SI_CONTENT[skillId] ?? null
}

export function hasSiContent(skillId: string): boolean {
  return skillId in SI_CONTENT
}
