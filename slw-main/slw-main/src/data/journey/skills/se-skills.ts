// Сборка всего, что относится к навыкам ЧС.
//
// Источники:
//   - `se-tree.js` — структура архетипов (4) + 4 общих базовых сквозным слоем.
//   - `se-surveys.md` — текст 47 анкет (4 общих + 12 + 9 + 10 + 12 = 47).
//   - `parseSurveys.js` — общий парсер (БС/ЧИ/ЧЛ/ЧС).
//
// Прогрессивная анкета (как у БС/ЧИ/ЧЛ):
//   В каждом блоке 3 утверждения. Юзер может пройти за 1, 2 или 3 «прохода»
//   по 5 утверждений. Pass=1 — берём первое утверждение из каждого блока,
//   pass=2 — второе, pass=3 — третье.

import type { Survey } from '@/types/script'
import { parseSurveys } from './parseSurveys'
import seSurveysMd from './se-surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, SKILL_TO_ARCHETYPE_FOR_PARSER,
  SKILL_BY_RUS_NAME, ALL_SKILL_IDS, getSkillsForArchetype,
  calcArchetypeAvg as calcArchetypeAvgFromTree,
  SURVEY_BLOCKS, SURVEY_BLOCK_KEYS, BLOCK_RUS_TO_KEY
} from './se-tree'
import type { SeArchetypeKey } from './se-tree'
import type { SkillStateEntry, SurveyStatement } from './index'

const SE_SURVEYS: Record<string, Survey> = parseSurveys(seSurveysMd, {
  skillByRusName: SKILL_BY_RUS_NAME,
  skillToArchetype: SKILL_TO_ARCHETYPE_FOR_PARSER,
  blockRusToKey: BLOCK_RUS_TO_KEY,
  surveyBlockKeys: SURVEY_BLOCK_KEYS,
})

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, ALL_SKILL_IDS, getSkillsForArchetype,
  SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  SE_SURVEYS,
}

export function getSeSurvey(skillId: string): Survey | null {
  return SE_SURVEYS[skillId] ?? null
}

// Среднее по 5 имеющимся блокам.
export function calcSeSurveyResult(answers: Record<string, number[]> | undefined): {
  blocks: Record<string, number | null>
  skill: number | null
} {
  const blocks: Record<string, number | null> = {}
  const blockAvgs: number[] = []
  for (const key of SURVEY_BLOCK_KEYS) {
    const arr = answers?.[key] ?? []
    const valid = arr.filter(n => Number.isFinite(n))
    const avg = valid.length > 0
      ? valid.reduce((s, n) => s + n, 0) / valid.length
      : null
    blocks[key] = avg
    if (avg != null) blockAvgs.push(avg)
  }
  const skill = blockAvgs.length > 0
    ? blockAvgs.reduce((s, n) => s + n, 0) / blockAvgs.length
    : null
  return { blocks, skill }
}

export function getSeCompletedPasses(skillEntry: SkillStateEntry | undefined): number {
  if (!skillEntry) return 0
  if (Number.isFinite(skillEntry.passes)) return skillEntry.passes as number
  const answers = skillEntry.answers ?? {}
  let max = 0
  for (const key of SURVEY_BLOCK_KEYS) {
    const arr = answers[key] ?? []
    const len = arr.filter(n => Number.isFinite(n)).length
    if (len > max) max = len
  }
  return max
}

export function getSeNextPass(skillEntry: SkillStateEntry | undefined): number {
  const done = getSeCompletedPasses(skillEntry)
  return done >= 3 ? 0 : done + 1
}

export function getSeStatementsForPass(survey: Survey | null | undefined, pass: number): SurveyStatement[] {
  if (!survey || !pass) return []
  const stmtIndex = Math.max(0, Math.min(2, pass - 1))
  const out: SurveyStatement[] = []
  for (const blockKey of SURVEY_BLOCK_KEYS) {
    const arr = survey.blocks?.[blockKey] ?? []
    if (arr.length === 0) continue
    const idx = Math.min(stmtIndex, arr.length - 1)
    out.push({ blockKey, statement: arr[idx], statementIndex: idx, pass })
  }
  return out
}

export function getSeStatementsForFullRange(
  survey: Survey | null | undefined,
  startPass: number,
  endPass = 3
): SurveyStatement[] {
  if (!survey) return []
  const out: SurveyStatement[] = []
  for (let p = startPass; p <= endPass; p++) {
    out.push(...getSeStatementsForPass(survey, p))
  }
  return out
}

export function buildSeSurveyStatements(
  survey: Survey | null | undefined,
  mode: 'short' | 'full',
  startPass: number
): SurveyStatement[] {
  if (mode === 'full') return getSeStatementsForFullRange(survey, startPass, 3)
  return getSeStatementsForPass(survey, startPass)
}

// Среднее по архетипу: 4 общих + специфичные. Используется в Колесе ЧС.
export function calcSeArchetypeAvg(
  skills: Record<string, SkillStateEntry> | undefined,
  archetypeKey: SeArchetypeKey
): number | null {
  return calcArchetypeAvgFromTree(skills, archetypeKey)
}

// Общая оценка ЧС: среднее по архетипам, в которых есть хоть одна анкета.
// Используется JourneyView для записи scores['Se'] после анкеты.
export function calcSeScoreFromSkills(skills: Record<string, SkillStateEntry> | undefined): number | null {
  const archeAvgs = ARCHETYPE_KEYS
    .map(k => calcSeArchetypeAvg(skills, k))
    .filter((v): v is number => v != null)
  if (archeAvgs.length === 0) return null
  return archeAvgs.reduce((s, n) => s + n, 0) / archeAvgs.length
}

// Сколько навыков ЧС оценено всего (из 47).
export function getSeSkillProgress(skills: Record<string, SkillStateEntry> | undefined): {
  completed: number
  total: number
  remaining: number
} {
  const completed = ALL_SKILL_IDS.filter(id =>
    Number.isFinite(skills?.[id]?.result)
  ).length
  return { completed, total: ALL_SKILL_IDS.length, remaining: ALL_SKILL_IDS.length - completed }
}
