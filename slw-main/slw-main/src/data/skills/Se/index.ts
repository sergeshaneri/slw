// Контент Se-навыков (ЧС). Объединение по архетипам + универсальные.
//
// Структура одного навыка совпадает с SI_CONTENT / FE_CONTENT:
//   { id, name, archetype, role, intro, levels: { 1, 2, 3 } }
// На L3 дополнительно поля precaution и dilemma { name, desc }.
//
// Aspect-aware lookup в data/skills/index.js использует SE_CONTENT.
// ID не пересекаются с другими аспектами — у Se без префикса
// (groundedness, boundary-setting, leader-presence, и т.д.).
//
// Источник контента: Se/Навыки ЧС — <Архетип>.md и Se/Навыки ЧС — Универсальные.md
// плюс Se/психчерты ЧС — матрица навыков.md для gift/shadow.
//
// Уровни ЧС: 1 — Воин, 2 — Командир, 3 — Полководец.

import type { Skill } from '@/types/skill'
import { CORE } from './core'
import { DEFENDER } from './defender'
import { RULER } from './ruler'
import { BUILDER } from './builder'
import { HERO } from './hero'

export const SE_CONTENT: Record<string, Skill> = {
  ...CORE,
  ...DEFENDER,
  ...RULER,
  ...BUILDER,
  ...HERO
  // Все 47 навыков ЧС подключены: 4 универсальных + 12 Защитник +
  // 9 Правитель + 10 Строитель + 12 Герой (11 архетипных +
  // radical-acceptance как синергическая вершина).
}

export function getSeContent(skillId: string): Skill | null {
  return SE_CONTENT[skillId] ?? null
}

export function hasSeContent(skillId: string): boolean {
  return skillId in SE_CONTENT
}
