// Helpers для резолва анкеты по skillId независимо от аспекта.
// Используется в SurveyScreen / SurveyChoice / JourneyView, чтобы
// не плодить ветвление на каждом вызове getSurvey.

import { getSurvey } from './index'
import { getNeSurvey, ALL_SKILL_IDS as NE_SKILL_IDS_ARRAY } from './ne-skills'
import { getNiSurvey, ALL_SKILL_IDS as NI_SKILL_IDS_ARRAY } from './ni-skills'
import { getTeSurvey, ALL_SKILL_IDS as TE_SKILL_IDS_ARRAY } from './te-skills'
import { getTiSurvey, ALL_SKILL_IDS as TI_SKILL_IDS_ARRAY } from './ti-skills'
import { getFiSurvey, ALL_SKILL_IDS as FI_SKILL_IDS_ARRAY } from './fi-skills'
import { getSeSurvey, ALL_SKILL_IDS as SE_SKILL_IDS_ARRAY } from './se-skills'

const NE_SKILL_IDS_SET = new Set(NE_SKILL_IDS_ARRAY)
const NI_SKILL_IDS_SET = new Set(NI_SKILL_IDS_ARRAY)
const TE_SKILL_IDS_SET = new Set(TE_SKILL_IDS_ARRAY)
const TI_SKILL_IDS_SET = new Set(TI_SKILL_IDS_ARRAY)
const FI_SKILL_IDS_SET = new Set(FI_SKILL_IDS_ARRAY)
const SE_SKILL_IDS_SET = new Set(SE_SKILL_IDS_ARRAY)

export function isNeSkill(skillId) {
  return NE_SKILL_IDS_SET.has(skillId)
}

export function isNiSkill(skillId) {
  return NI_SKILL_IDS_SET.has(skillId)
}

export function isTeSkill(skillId) {
  return TE_SKILL_IDS_SET.has(skillId)
}

export function isTiSkill(skillId) {
  return TI_SKILL_IDS_SET.has(skillId)
}

export function isFiSkill(skillId) {
  return FI_SKILL_IDS_SET.has(skillId)
}

export function isSeSkill(skillId) {
  return SE_SKILL_IDS_SET.has(skillId)
}

export function resolveSurvey(skillId) {
  if (NE_SKILL_IDS_SET.has(skillId)) return getNeSurvey(skillId) ?? null
  if (NI_SKILL_IDS_SET.has(skillId)) return getNiSurvey(skillId) ?? null
  if (TE_SKILL_IDS_SET.has(skillId)) return getTeSurvey(skillId) ?? null
  if (TI_SKILL_IDS_SET.has(skillId)) return getTiSurvey(skillId) ?? null
  if (FI_SKILL_IDS_SET.has(skillId)) return getFiSurvey(skillId) ?? null
  if (SE_SKILL_IDS_SET.has(skillId)) return getSeSurvey(skillId) ?? null
  return getSurvey(skillId) ?? null
}
