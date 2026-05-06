// Сборка всего, что относится к навыкам ЧИ.
//
// Источники:
//   - `ne-tree.js` — структура архетипов (4) + 3 общих базовых сквозным слоем.
//   - `ne-surveys.md` (копия `Ne/вопросы для оценки навыков ЧИ.md`) —
//     текст 36 анкет (3 общих + 7 + 7 + 10 + 9 = 36).
//   - `parseSurveys.js` — общий парсер (БС/ЧИ).
//
// Прогрессивная анкета (как у БС):
//   В каждом блоке 3 утверждения. Юзер может пройти за 1, 2 или 3 «прохода»
//   по 5 утверждений. Pass=1 — берём первое утверждение из каждого блока
//   (эти же 15 уже идут в L0), pass=2 — второе, pass=3 — третье.
//
// state.skills хранится плоско по skillId. ID навыков ЧИ не пересекаются
// с БС (короткие латинские ключи в разных намсспейсах: 'pause' у БС =
// «Сенсорная пауза» у Hedonist, у ЧИ нет такого ID; 'holding-pause' —
// у ЧИ Catalyst). Поэтому общий state.skills их не путает.

import { parseSurveys } from './parseSurveys'
import neSurveysMd from './ne-surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, SKILL_TO_ARCHETYPE_FOR_PARSER,
  SKILL_BY_RUS_NAME, ALL_SKILL_IDS, getSkillsForArchetype,
  calcArchetypeAvg as calcArchetypeAvgFromTree
} from './ne-tree'
// Названия блоков (5 штук) и ключи — общие для БС и ЧИ.
import { BLOCK_RUS_TO_KEY, SURVEY_BLOCK_KEYS, SURVEY_BLOCKS } from './tree'

const NE_SURVEYS = parseSurveys(neSurveysMd, {
  skillByRusName: SKILL_BY_RUS_NAME,
  skillToArchetype: SKILL_TO_ARCHETYPE_FOR_PARSER,
  blockRusToKey: BLOCK_RUS_TO_KEY,
  surveyBlockKeys: SURVEY_BLOCK_KEYS,
})

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  COMMON_BASE_SKILL_IDS, ALL_SKILL_IDS, getSkillsForArchetype,
  SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  NE_SURVEYS,
}

export function getNeSurvey(skillId) {
  return NE_SURVEYS[skillId] ?? null
}

// Среднее по 5 имеющимся блокам: avg по блоку = среднее по
// фактически имеющимся ответам, avg по навыку = среднее блоков.
// answers — { [blockKey]: number[] } (1..3 значения в каждом блоке).
export function calcNeSurveyResult(answers) {
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
export function getNeCompletedPasses(skillEntry) {
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

export function getNeNextPass(skillEntry) {
  const done = getNeCompletedPasses(skillEntry)
  return done >= 3 ? 0 : done + 1
}

// Возвращает 5 утверждений для конкретного прохода — по одному из каждого
// блока. statementIndex = pass - 1.
export function getNeStatementsForPass(survey, pass) {
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

export function getNeStatementsForFullRange(survey, startPass, endPass = 3) {
  if (!survey) return []
  const out = []
  for (let p = startPass; p <= endPass; p++) {
    out.push(...getNeStatementsForPass(survey, p))
  }
  return out
}

export function buildNeSurveyStatements(survey, mode, startPass) {
  if (mode === 'full') return getNeStatementsForFullRange(survey, startPass, 3)
  return getNeStatementsForPass(survey, startPass)
}

// Среднее по архетипу: 3 общих + специфичные. Используется в Колесе ЧИ.
export function calcNeArchetypeAvg(skills, archetypeKey) {
  return calcArchetypeAvgFromTree(skills, archetypeKey)
}

// Сколько навыков ЧИ оценено всего (из 36).
export function getNeSkillProgress(skills) {
  const completed = ALL_SKILL_IDS.filter(id =>
    Number.isFinite(skills?.[id]?.result)
  ).length
  return { completed, total: ALL_SKILL_IDS.length, remaining: ALL_SKILL_IDS.length - completed }
}
