// Сборка всего, что относится к навыкам БЭ.
//
// Источники:
//   - `fi-tree.js` — структура архетипов (4) + 2 общих базовых сквозным слоем.
//   - `fi-surveys.md` (копия `Fi/матрица навыков БЭ.md` в сжатом анкетном
//     формате) — текст 58 анкет (2 общих + 17 + 14 + 9 + 16 = 58).
//   - `parseSurveys.js` — общий парсер (БС/ЧИ/БИ/БЭ).
//
// Прогрессивная анкета (как у БС):
//   В каждом блоке 3 утверждения. Юзер может пройти за 1, 2 или 3 «прохода»
//   по 5 утверждений. Pass=1 — берём первое утверждение из каждого блока,
//   pass=2 — второе, pass=3 — третье.
//
// state.skills хранится плоско по skillId. ID навыков БЭ имеют префикс
// `fi-` для глобальной уникальности.

import type { Survey } from '@/types/script'
import { parseSurveys } from './parseSurveys'
import fiSurveysMd from './fi-surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, SKILL_TO_ARCHETYPE_FOR_PARSER,
  SKILL_BY_RUS_NAME, ALL_SKILL_IDS, getSkillsForArchetype,
  calcArchetypeAvg as calcArchetypeAvgFromTree
} from './fi-tree'
import type { FiArchetypeKey } from './fi-tree'
import type { SkillStateEntry, SurveyStatement } from './index'
// Названия блоков (5 штук) и ключи — общие для всех аспектов.
import { BLOCK_RUS_TO_KEY, SURVEY_BLOCK_KEYS, SURVEY_BLOCKS } from './tree'

const FI_SURVEYS: Record<string, Survey> = parseSurveys(fiSurveysMd, {
  skillByRusName: SKILL_BY_RUS_NAME,
  skillToArchetype: SKILL_TO_ARCHETYPE_FOR_PARSER,
  blockRusToKey: BLOCK_RUS_TO_KEY,
  surveyBlockKeys: SURVEY_BLOCK_KEYS,
})

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, ALL_SKILL_IDS, getSkillsForArchetype,
  SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  FI_SURVEYS,
}

export function getFiSurvey(skillId: string): Survey | null {
  return FI_SURVEYS[skillId] ?? null
}

// Среднее по 5 имеющимся блокам: avg по блоку = среднее по
// фактически имеющимся ответам, avg по навыку = среднее блоков.
// answers — { [blockKey]: number[] } (1..3 значения в каждом блоке).
export function calcFiSurveyResult(answers: Record<string, number[]> | undefined): {
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

// Сколько проходов уже сделано по навыку (БС-стиль, 0..3).
export function getFiCompletedPasses(skillEntry: SkillStateEntry | undefined): number {
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

export function getFiNextPass(skillEntry: SkillStateEntry | undefined): number {
  const done = getFiCompletedPasses(skillEntry)
  return done >= 3 ? 0 : done + 1
}

// Возвращает 5 утверждений для конкретного прохода — по одному из каждого
// блока. statementIndex = pass - 1.
export function getFiStatementsForPass(survey: Survey | null | undefined, pass: number): SurveyStatement[] {
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

export function getFiStatementsForFullRange(
  survey: Survey | null | undefined,
  startPass: number,
  endPass = 3
): SurveyStatement[] {
  if (!survey) return []
  const out: SurveyStatement[] = []
  for (let p = startPass; p <= endPass; p++) {
    out.push(...getFiStatementsForPass(survey, p))
  }
  return out
}

export function buildFiSurveyStatements(
  survey: Survey | null | undefined,
  mode: 'short' | 'full',
  startPass: number
): SurveyStatement[] {
  if (mode === 'full') return getFiStatementsForFullRange(survey, startPass, 3)
  return getFiStatementsForPass(survey, startPass)
}

// Среднее по архетипу: 2 общих + специфичные. Используется в Колесе БЭ.
export function calcFiArchetypeAvg(
  skills: Record<string, SkillStateEntry> | undefined,
  archetypeKey: FiArchetypeKey
): number | null {
  return calcArchetypeAvgFromTree(skills, archetypeKey)
}

// Общая оценка БЭ: среднее по архетипам, в которых есть хоть одна анкета.
// Используется JourneyView для записи scores['Fi'] после анкеты.
export function calcFiScoreFromSkills(skills: Record<string, SkillStateEntry> | undefined): number | null {
  const archeAvgs = ARCHETYPE_KEYS
    .map(k => calcFiArchetypeAvg(skills, k))
    .filter((v): v is number => v != null)
  if (archeAvgs.length === 0) return null
  return archeAvgs.reduce((s, n) => s + n, 0) / archeAvgs.length
}

// Сколько навыков БЭ оценено всего (из 58).
export function getFiSkillProgress(skills: Record<string, SkillStateEntry> | undefined): {
  completed: number
  total: number
  remaining: number
} {
  const completed = ALL_SKILL_IDS.filter(id =>
    Number.isFinite(skills?.[id]?.result)
  ).length
  return { completed, total: ALL_SKILL_IDS.length, remaining: ALL_SKILL_IDS.length - completed }
}
