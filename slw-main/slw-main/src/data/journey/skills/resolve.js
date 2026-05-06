// Helpers для резолва анкеты по skillId независимо от аспекта.
// Используется в SurveyScreen / SurveyChoice / JourneyView, чтобы
// не плодить ветвление на каждом вызове getSurvey.

import { getSurvey } from './index'
import { getNeSurvey, ALL_SKILL_IDS as NE_SKILL_IDS_ARRAY } from './ne-skills'
import { getNiSurvey, ALL_SKILL_IDS as NI_SKILL_IDS_ARRAY } from './ni-skills'

const NE_SKILL_IDS_SET = new Set(NE_SKILL_IDS_ARRAY)
const NI_SKILL_IDS_SET = new Set(NI_SKILL_IDS_ARRAY)

export function isNeSkill(skillId) {
  return NE_SKILL_IDS_SET.has(skillId)
}

export function isNiSkill(skillId) {
  return NI_SKILL_IDS_SET.has(skillId)
}

export function resolveSurvey(skillId) {
  if (NE_SKILL_IDS_SET.has(skillId)) return getNeSurvey(skillId) ?? null
  if (NI_SKILL_IDS_SET.has(skillId)) return getNiSurvey(skillId) ?? null
  return getSurvey(skillId) ?? null
}
