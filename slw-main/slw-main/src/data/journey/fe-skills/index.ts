// Сборка всего, что относится к навыкам ЧЭ (Fe).
//
// Источники:
//   - `tree.js` — структура архетипов и распределение навыков ЧЭ.
//   - `surveys.md` — текст 34 анкет (по 15 утверждений в 5 блоках × 3 утверждения).
//   - `parseSurveys.js` — парсер.
//
// Используется параллельно с `data/journey/skills/index.js` (БС/общая инфраструктура).
// Идентификаторы навыков Fe имеют префикс `fe-` для глобальной уникальности
// в едином `state.skills` map.

import type { Survey } from '@/types/script'
import { parseSurveys } from './parseSurveys'
import surveysMd from './surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILLS, COMMON_BASE_SKILL_IDS, getSkillsForArchetype,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  calcArchetypeAvg, calcFeScoreFromSkills, getSkillProgress
} from './tree'

const SURVEYS_FE: Record<string, Survey> = parseSurveys(surveysMd)

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILLS, COMMON_BASE_SKILL_IDS, getSkillsForArchetype,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  SURVEYS_FE,
  calcArchetypeAvg, calcFeScoreFromSkills, getSkillProgress
}

// Возвращает анкету Fe по skillId или null.
export function getSurveyFe(skillId: string): Survey | null {
  return SURVEYS_FE[skillId] ?? null
}

// Множество всех id анкет Fe (для маршрутизации getSurvey между Si и Fe).
export const FE_SKILL_ID_SET: Set<string> = new Set(Object.keys(SURVEYS_FE))
