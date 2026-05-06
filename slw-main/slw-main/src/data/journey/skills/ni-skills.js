// Сборка всего, что относится к навыкам БИ.
//
// Источники:
//   - `ni-tree.js` — структура архетипов (4) + 3 общих базовых сквозным слоем.
//   - `ni-surveys.md` (копия `Ni/вопросы для оценки навыков БИ.md`) —
//     текст 43 анкет (3 общих + 10 + 10 + 10 + 10 = 43).
//   - `parseSurveys.js` — общий парсер (БС/ЧИ/БИ).
//
// Прогрессивная анкета (как у БС/ЧИ):
//   В каждом блоке 3 утверждения. Юзер может пройти за 1, 2 или 3 «прохода»
//   по 5 утверждений. Pass=1 — берём первое утверждение из каждого блока
//   (эти же 15 уже идут в L0 для 3 общих базовых), pass=2 — второе, pass=3 — третье.
//
// state.skills хранится плоско по skillId. ID навыков БИ не пересекаются
// с БС/ЧИ/ЧЭ.

import { parseSurveys } from './parseSurveys'
import niSurveysMd from './ni-surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, SKILL_TO_ARCHETYPE_FOR_PARSER,
  SKILL_BY_RUS_NAME, ALL_SKILL_IDS, getSkillsForArchetype,
  calcArchetypeAvg as calcArchetypeAvgFromTree
} from './ni-tree'
// Названия блоков (5 штук) и ключи — общие для БС/ЧИ/БИ.
import { BLOCK_RUS_TO_KEY, SURVEY_BLOCK_KEYS, SURVEY_BLOCKS } from './tree'

const NI_SURVEYS = parseSurveys(niSurveysMd, {
  skillByRusName: SKILL_BY_RUS_NAME,
  skillToArchetype: SKILL_TO_ARCHETYPE_FOR_PARSER,
  blockRusToKey: BLOCK_RUS_TO_KEY,
  surveyBlockKeys: SURVEY_BLOCK_KEYS,
})

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, ALL_SKILL_IDS, getSkillsForArchetype,
  SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  NI_SURVEYS,
}

export function getNiSurvey(skillId) {
  return NI_SURVEYS[skillId] ?? null
}

// Среднее по 5 имеющимся блокам: avg по блоку = среднее по
// фактически имеющимся ответам, avg по навыку = среднее блоков.
// answers — { [blockKey]: number[] } (1..3 значения в каждом блоке).
export function calcNiSurveyResult(answers) {
  const blocks = {}
  const blockAvgs = []
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
export function getNiCompletedPasses(skillEntry) {
  if (!skillEntry) return 0
  if (Number.isFinite(skillEntry.passes)) return skillEntry.passes
  const answers = skillEntry.answers ?? {}
  let max = 0
  for (const key of SURVEY_BLOCK_KEYS) {
    const arr = answers[key] ?? []
    const len = arr.filter(n => Number.isFinite(n)).length
    if (len > max) max = len
  }
  return max
}

export function getNiNextPass(skillEntry) {
  const done = getNiCompletedPasses(skillEntry)
  return done >= 3 ? 0 : done + 1
}

// Возвращает 5 утверждений для конкретного прохода — по одному из каждого
// блока. statementIndex = pass - 1.
export function getNiStatementsForPass(survey, pass) {
  if (!survey || !pass) return []
  const stmtIndex = Math.max(0, Math.min(2, pass - 1))
  const out = []
  for (const blockKey of SURVEY_BLOCK_KEYS) {
    const arr = survey.blocks?.[blockKey] ?? []
    if (arr.length === 0) continue
    const idx = Math.min(stmtIndex, arr.length - 1)
    out.push({ blockKey, statement: arr[idx], statementIndex: idx, pass })
  }
  return out
}

export function getNiStatementsForFullRange(survey, startPass, endPass = 3) {
  if (!survey) return []
  const out = []
  for (let p = startPass; p <= endPass; p++) {
    out.push(...getNiStatementsForPass(survey, p))
  }
  return out
}

export function buildNiSurveyStatements(survey, mode, startPass) {
  if (mode === 'full') return getNiStatementsForFullRange(survey, startPass, 3)
  return getNiStatementsForPass(survey, startPass)
}

// Среднее по архетипу: 3 общих + специфичные. Используется в Колесе БИ.
export function calcNiArchetypeAvg(skills, archetypeKey) {
  return calcArchetypeAvgFromTree(skills, archetypeKey)
}

// Общая оценка БИ: среднее по архетипам, в которых есть хоть одна анкета.
// Используется в NiWheel (на странице аспекта БИ) для центрального счёта.
export function calcNiScoreFromSkills(skills) {
  const archeAvgs = ARCHETYPE_KEYS
    .map(k => calcNiArchetypeAvg(skills, k))
    .filter(v => v != null)
  if (archeAvgs.length === 0) return null
  return archeAvgs.reduce((s, n) => s + n, 0) / archeAvgs.length
}

// Сколько навыков БИ оценено всего (из 43).
export function getNiSkillProgress(skills) {
  const completed = ALL_SKILL_IDS.filter(id =>
    Number.isFinite(skills?.[id]?.result)
  ).length
  return { completed, total: ALL_SKILL_IDS.length, remaining: ALL_SKILL_IDS.length - completed }
}
