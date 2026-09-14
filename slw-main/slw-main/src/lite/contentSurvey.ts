import type { AspectKey } from '@/types/aspect'
import type { Survey } from '@/types/script'
import { getSurvey } from '@/data/journey/skills'
import { getNeSurvey } from '@/data/journey/skills/ne-skills'
import { getNiSurvey } from '@/data/journey/skills/ni-skills'
import { getTeSurvey } from '@/data/journey/skills/te-skills'
import { getTiSurvey } from '@/data/journey/skills/ti-skills'
import { getFiSurvey } from '@/data/journey/skills/fi-skills'
import { getSeSurvey } from '@/data/journey/skills/se-skills'

export type SurveyResolver = (skillId: string) => Survey | null

export function resolveSurveyForAspect(aspect: AspectKey, skillId: string): Survey | null {
  switch (aspect) {
    case 'Ne': return getNeSurvey(skillId) ?? null
    case 'Ni': return getNiSurvey(skillId) ?? null
    case 'Te': return getTeSurvey(skillId) ?? null
    case 'Ti': return getTiSurvey(skillId) ?? null
    case 'Fi': return getFiSurvey(skillId) ?? null
    case 'Se': return getSeSurvey(skillId) ?? null
    case 'Si':
    case 'Fe':
      return getSurvey(skillId) ?? null
  }
}

export function createAspectSurveyResolver(aspect: AspectKey): SurveyResolver {
  return skillId => resolveSurveyForAspect(aspect, skillId)
}
