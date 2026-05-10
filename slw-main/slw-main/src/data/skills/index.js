// Aspect-aware lookup для контента навыков.
//
// Контент аспекта Si (БС) лежит в ./skillsContent.js (исторически).
// Контент аспекта Fe (ЧЭ) — в ./Fe/ (по архетипным файлам).
//
// ID навыков не пересекаются: Si без префикса (`scan`, `interoception`...),
// Fe с префиксом `fe-` (`fe-awareness`, `fe-pause`...). Поэтому единый lookup
// через две таблицы безопасен.
//
// Когда добавятся реальные tree-контенты для Te/Ti/Ne/Ni/Se/Fi — расширим
// этот файл новыми импортами.

import {
  SKILLS_CONTENT,
  hasSkillContent as hasSiContent,
  getUnlockedSkillLevel
} from './skillsContent'
import { FE_CONTENT } from './Fe'
import {
  ARCHETYPES as SI_ARCHETYPES,
  SKILL_TO_ARCHETYPE as SI_SKILL_TO_ARCHETYPE,
  SKILL_TREE as SI_SKILL_TREE
} from '../journey/skills'
import {
  ARCHETYPES as FE_ARCHETYPES,
  SKILL_TO_ARCHETYPE as FE_SKILL_TO_ARCHETYPE,
  SKILL_TREE as FE_SKILL_TREE,
  COMMON_BASE_SKILLS as FE_COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS as FE_COMMON_BASE_IDS
} from '../journey/fe-skills/tree'

export function getSkillContent(skillId) {
  return SKILLS_CONTENT[skillId] ?? FE_CONTENT[skillId] ?? null
}

export function hasSkillContent(skillId) {
  return hasSiContent(skillId) || (skillId in FE_CONTENT)
}

// Вернуть имя навыка из любого источника: контент → Si tree → Fe tree → fallback на id.
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

  if (FE_COMMON_BASE_IDS?.has(skillId)) {
    const skill = FE_COMMON_BASE_SKILLS.find(s => s.id === skillId)
    if (skill?.name) return skill.name
  }

  return skillId
}

// Вернуть человекочитаемое имя архетипа навыка («Целитель», «Заводила», ...).
// Для общих ядерных навыков Fe — null (отображать пустоту вместо «общий»).
export function getArchetypeNameForSkill(skillId) {
  const siKey = SI_SKILL_TO_ARCHETYPE[skillId]
  if (siKey) return SI_ARCHETYPES[siKey]?.name ?? null

  const feKey = FE_SKILL_TO_ARCHETYPE[skillId]
  if (feKey) return FE_ARCHETYPES[feKey]?.name ?? null

  return null
}

export { getUnlockedSkillLevel }
