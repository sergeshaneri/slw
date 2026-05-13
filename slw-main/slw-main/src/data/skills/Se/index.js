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

import { CORE } from './core'
import { DEFENDER } from './defender'
import { RULER } from './ruler'

export const SE_CONTENT = {
  ...CORE,
  ...DEFENDER,
  ...RULER
  // builder.js и hero.js (включая radical-acceptance) добавятся
  // по мере их написания и будут подмешаны сюда.
}

export function getSeContent(skillId) {
  return SE_CONTENT[skillId] ?? null
}

export function hasSeContent(skillId) {
  return skillId in SE_CONTENT
}
