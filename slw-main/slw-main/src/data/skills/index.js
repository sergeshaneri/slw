// Aspect-aware lookup для контента навыков.
//
// Контент по аспектам разложен по подпапкам:
//   ./Si/ — БС (4 универсальных + 47 архетипных по 4 архетипам)
//   ./Fe/ — ЧЭ (3 ядерных + 34 архетипных по 4 архетипам)
//   ./Ne/ — ЧИ (3 общих базовых + 33 архетипных по 4 архетипам = 36)
//   ./Ni/ — БИ (3 общих базовых + 40 архетипных по 4 архетипам = 43)
//   ./skillsContent.js — устаревший пилотный контент БС (пока `scan` —
//        для совместимости со старым state.skills, до полной выписки в Si/)
//
// ID навыков не пересекаются: Si без префикса (`signals`, `body-listening`...),
// Fe с префиксом `fe-` (`fe-awareness`, `fe-pause`...), Ne без префикса
// (`attention-essence`, `read-program`...), Ni без префикса (`attunement`,
// `meaning-making`...). Поэтому единый lookup безопасен.
//
// Когда добавятся контенты для Te/Ti/Se/Fi — расширим этот файл
// новыми импортами в том же паттерне.

import {
  SKILLS_CONTENT as LEGACY_SI_CONTENT,
  getUnlockedSkillLevel
} from './skillsContent'
import { SI_CONTENT } from './Si'
import { FE_CONTENT } from './Fe'
import { NE_CONTENT } from './Ne'
import { NI_CONTENT } from './Ni'
import {
  ARCHETYPES as SI_ARCHETYPES,
  SKILL_TO_ARCHETYPE as SI_SKILL_TO_ARCHETYPE,
  SKILL_TREE as SI_SKILL_TREE,
  COMMON_BASE_SKILLS as SI_COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS as SI_COMMON_BASE_IDS
} from '../journey/skills'
import {
  ARCHETYPES as FE_ARCHETYPES,
  SKILL_TO_ARCHETYPE as FE_SKILL_TO_ARCHETYPE,
  SKILL_TREE as FE_SKILL_TREE,
  COMMON_BASE_SKILLS as FE_COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS as FE_COMMON_BASE_IDS
} from '../journey/fe-skills/tree'
import {
  ARCHETYPES as NE_ARCHETYPES,
  SKILL_TO_ARCHETYPE as NE_SKILL_TO_ARCHETYPE,
  SKILL_TREE as NE_SKILL_TREE,
  COMMON_BASE_SKILLS as NE_COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS as NE_COMMON_BASE_IDS
} from '../journey/skills/ne-tree'
import {
  ARCHETYPES as NI_ARCHETYPES,
  SKILL_TO_ARCHETYPE as NI_SKILL_TO_ARCHETYPE,
  SKILL_TREE as NI_SKILL_TREE,
  COMMON_BASE_SKILLS as NI_COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS as NI_COMMON_BASE_IDS
} from '../journey/skills/ni-tree'

export function getSkillContent(skillId) {
  return SI_CONTENT[skillId] ?? FE_CONTENT[skillId] ?? NE_CONTENT[skillId] ?? NI_CONTENT[skillId] ?? LEGACY_SI_CONTENT[skillId] ?? null
}

export function hasSkillContent(skillId) {
  return (skillId in SI_CONTENT) || (skillId in FE_CONTENT) || (skillId in NE_CONTENT) || (skillId in NI_CONTENT) || (skillId in LEGACY_SI_CONTENT)
}

// Вернуть имя навыка из любого источника: контент → Si tree → Fe tree → Ne tree → Ni tree → COMMON_BASE → fallback на id.
export function getSkillName(skillId) {
  const content = getSkillContent(skillId)
  if (content?.name) return content.name

  const siKey = SI_SKILL_TO_ARCHETYPE[skillId]
  if (siKey) {
    const skill = (SI_SKILL_TREE[siKey] ?? []).find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  const feKey = FE_SKILL_TO_ARCHETYPE[skillId]
  if (feKey) {
    const skill = (FE_SKILL_TREE[feKey] ?? []).find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  const neKey = NE_SKILL_TO_ARCHETYPE[skillId]
  if (neKey) {
    const skill = (NE_SKILL_TREE[neKey] ?? []).find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  const niKey = NI_SKILL_TO_ARCHETYPE[skillId]
  if (niKey) {
    const skill = (NI_SKILL_TREE[niKey] ?? []).find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  if (SI_COMMON_BASE_IDS?.has(skillId)) {
    const skill = SI_COMMON_BASE_SKILLS.find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  if (FE_COMMON_BASE_IDS?.has(skillId)) {
    const skill = FE_COMMON_BASE_SKILLS.find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  if (NE_COMMON_BASE_IDS?.has(skillId)) {
    const skill = NE_COMMON_BASE_SKILLS.find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  if (NI_COMMON_BASE_IDS?.has(skillId)) {
    const skill = NI_COMMON_BASE_SKILLS.find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  return skillId
}

// Вернуть человекочитаемое имя архетипа навыка («Целитель», «Заводила», «Мифотворец», ...).
// Для общих ядерных навыков Fe/Ne/Ni — null (отображать пустоту вместо «общий»).
export function getArchetypeNameForSkill(skillId) {
  const siKey = SI_SKILL_TO_ARCHETYPE[skillId]
  if (siKey) return SI_ARCHETYPES[siKey]?.name ?? null

  const feKey = FE_SKILL_TO_ARCHETYPE[skillId]
  if (feKey) return FE_ARCHETYPES[feKey]?.name ?? null

  const neKey = NE_SKILL_TO_ARCHETYPE[skillId]
  if (neKey) return NE_ARCHETYPES[neKey]?.name ?? null

  const niKey = NI_SKILL_TO_ARCHETYPE[skillId]
  if (niKey) return NI_ARCHETYPES[niKey]?.name ?? null

  return null
}

export { getUnlockedSkillLevel }
