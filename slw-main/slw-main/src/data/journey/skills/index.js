// Сборка всего, что относится к навыкам БС.
//
// Источники:
//   - `tree.js` — структура архетипов и распределение навыков.
//   - `surveys.md` (копия Si-исходника) — текст 33 анкет.
//   - `parseSurveys.js` — парсер.
//
// Этот модуль экспортирует:
//   - SURVEYS — мапа skillId → survey-объект (id, name, archetype, blocks).
//   - getSurvey(skillId)
//   - calcSurveyResult(answers) — расчёт средних по 15 ответам:
//       block_avg → skill_avg.
//   - calcArchetypeAvg(skills, archetypeKey)
//   - calcBSScoreFromSkills(skills) — общая оценка БС из самооценок навыков.
//
// `skills` — объект из state journey:
//   { [skillId]: { result: number, blocks: { [blockKey]: number }, completedAt } }

import { parseSurveys } from './parseSurveys'
import surveysMd from './surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS
} from './tree'

const SURVEYS = parseSurveys(surveysMd)

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  SURVEYS
}

export function getSurvey(skillId) {
  return SURVEYS[skillId] ?? null
}

// Считает средние блоков и общую среднюю по навыку.
// answers — { [blockKey]: number[] } (3 числа в каждом блоке, шкала 1-10).
// Возвращает { blocks: { [blockKey]: avg }, skill: avg }.
// avg по блоку — среднее 3 утверждений.
// avg по навыку — среднее 5 средних блоков (НЕ среднее 15 утверждений
// напрямую, чтобы каждый блок весил одинаково — это и просил юзер).
export function calcSurveyResult(answers) {
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

// Среднее по архетипу. skills — мапа state.skills.
// Считаем avg только по тем навыкам ветки, которые имеют валидный result.
export function calcArchetypeAvg(skills, archetypeKey) {
  const ids = (SKILL_TREE[archetypeKey] ?? []).map(s => s.id)
  const values = ids
    .map(id => skills?.[id]?.result)
    .filter(v => Number.isFinite(v))
  if (values.length === 0) return null
  return values.reduce((s, n) => s + n, 0) / values.length
}

// Общая оценка БС: среднее по архетипам, в которых есть хоть одна анкета.
// Если ни одной анкеты не пройдено — возвращает null (вызывающий сам
// решает, использовать fallback или нет).
export function calcBSScoreFromSkills(skills) {
  const archeAvgs = ARCHETYPE_KEYS
    .map(k => calcArchetypeAvg(skills, k))
    .filter(v => v != null)
  if (archeAvgs.length === 0) return null
  return archeAvgs.reduce((s, n) => s + n, 0) / archeAvgs.length
}

// Сколько анкет пройдено всего и сколько ещё осталось.
export function getSkillProgress(skills) {
  const completed = ALL_SKILL_IDS.filter(id => Number.isFinite(skills?.[id]?.result)).length
  return { completed, total: ALL_SKILL_IDS.length, remaining: ALL_SKILL_IDS.length - completed }
}

// Найти индекс первого непройденного survey-шага в pool.
// Используется для перехода «Продолжить анкеты»: всегда стартуем с
// первой неотвеченной, не заставляя пользователя пробегать пройденные.
// Если все пройдены — возвращает 0 (пусть пройдёт levelcomplete pool).
export function findFirstUnansweredSurveyIndex(skills, poolScripts) {
  if (!Array.isArray(poolScripts)) return 0
  for (let i = 0; i < poolScripts.length; i++) {
    const s = poolScripts[i]
    if (s?.type !== 'survey') continue
    if (!s.skill) continue
    if (!Number.isFinite(skills?.[s.skill]?.result)) return i
  }
  return 0
}
