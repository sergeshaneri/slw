// Сборка всего, что относится к навыкам ЧЭ.
//
// Источники:
//   - `tree.js` — структура архетипов и распределение навыков ЧЭ.
//   - `surveys.md` — текст 34 анкет (по 15 утверждений в 5 блоках × 3 утверждения).
//   - `parseSurveys.js` — парсер.
//
// Используется параллельно с `data/journey/skills/index.js` (БС/общая инфраструктура).
// Идентификаторы навыков ЧЭ имеют префикс `che-` для глобальной уникальности
// в едином `state.skills` map.

import { parseSurveys } from './parseSurveys'
import surveysMd from './surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILLS, COMMON_BASE_SKILL_IDS, getSkillsForArchetype,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  calcArchetypeAvg, calcCheScoreFromSkills, getSkillProgress
} from './tree'

const SURVEYS_CHE = parseSurveys(surveysMd)

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILLS, COMMON_BASE_SKILL_IDS, getSkillsForArchetype,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  SURVEYS_CHE,
  calcArchetypeAvg, calcCheScoreFromSkills, getSkillProgress
}

// Возвращает анкету ЧЭ по skillId или null.
export function getSurveyChe(skillId) {
  return SURVEYS_CHE[skillId] ?? null
}

// Множество всех id анкет ЧЭ (для маршрутизации getSurvey между БС и ЧЭ).
export const CHE_SKILL_ID_SET = new Set(Object.keys(SURVEYS_CHE))
