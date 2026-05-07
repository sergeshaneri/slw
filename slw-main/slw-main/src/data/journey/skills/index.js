// Сборка всего, что относится к навыкам БС.
//
// Источники:
//   - `tree.js` — структура архетипов и распределение навыков.
//   - `surveys.md` (копия Si-исходника) — текст 33 анкет.
//   - `parseSurveys.js` — парсер.
//
// Прогрессивная анкета:
//   В каждом блоке 3 утверждения. Юзер может пройти за 1, 2 или 3 «прохода»
//   по 5 утверждений. Pass=1 — берём первое утверждение из каждого блока,
//   pass=2 — второе, pass=3 — третье. После N проходов средние пересчитываются
//   по фактически имеющимся ответам (не по нулевым).
//
// `skills` — объект из state journey:
//   { [skillId]: {
//       result: number,
//       blocks: { [blockKey]: number },
//       answers: { [blockKey]: [n1, n2?, n3?] },  // длина 1..3
//       passes: 1 | 2 | 3,
//       insights: [{ text, completedAt, pass }],
//       completedAt: number
//   } }

import { parseSurveys } from './parseSurveys'
import surveysMd from './surveys.md?raw'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILLS, COMMON_BASE_SKILL_IDS, getSkillsForArchetype,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS
} from './tree'
import { SURVEYS_FE } from '../fe-skills'

const SURVEYS = parseSurveys(surveysMd)

export {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILLS, COMMON_BASE_SKILL_IDS, getSkillsForArchetype,
  ALL_SKILL_IDS, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS,
  SURVEYS
}

// Универсальный getSurvey — пробует Si, потом Fe.
// Skill id у Fe имеют префикс `fe-`, у Si — без префикса; коллизий нет.
export function getSurvey(skillId) {
  if (SURVEYS[skillId]) return SURVEYS[skillId]
  if (SURVEYS_FE[skillId]) return SURVEYS_FE[skillId]
  return null
}

// Считает средние блоков и общую среднюю по навыку.
// answers — { [blockKey]: number[] } (1..3 числа в каждом блоке, шкала 1-10).
// Возвращает { blocks: { [blockKey]: avg }, skill: avg }.
// avg по блоку — среднее имеющихся утверждений (1, 2 или 3).
// avg по навыку — среднее 5 средних блоков (каждый блок весит одинаково).
// Если в блоке нет ответов — он не учитывается в skill avg.
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

// Сколько проходов уже сделано по навыку.
// passes = max длина массива ответов по всем блокам (если есть answers),
// иначе stored passes (для обратной совместимости).
export function getCompletedPasses(skillEntry) {
  if (!skillEntry) return 0
  if (Number.isFinite(skillEntry.passes)) return skillEntry.passes
  // Fallback: вычисляем по answers (на случай миграции старых записей).
  const answers = skillEntry.answers ?? {}
  let max = 0
  for (const key of SURVEY_BLOCK_KEYS) {
    const arr = answers[key] ?? []
    const len = arr.filter(n => Number.isFinite(n)).length
    if (len > max) max = len
  }
  return max
}

// Какой будет следующий проход (1, 2 или 3). Возвращает 0 если все 3 пройдены
// (для UI «больше нечего проходить»).
export function getNextPass(skillEntry) {
  const done = getCompletedPasses(skillEntry)
  return done >= 3 ? 0 : done + 1
}

// Глубина навыка для UI. 'idle' = ничего не пройдено, 'light' = 1 проход,
// 'medium' = 2 прохода, 'full' = 3. Используется в SkillTree, SiWheel.
export function getSkillDepth(skillEntry) {
  const passes = getCompletedPasses(skillEntry)
  if (passes === 0) return 'idle'
  if (passes === 1) return 'light'
  if (passes === 2) return 'medium'
  return 'full'
}

// Возвращает 5 утверждений для конкретного прохода — по одному из каждого
// блока, индекс утверждения = pass - 1.
// Возвращает [{blockKey, statement, statementIndex, pass}], всегда 5 элементов
// (если в блоке меньше 3 утверждений — возьмём последнее существующее).
export function getStatementsForPass(survey, pass) {
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

// Возвращает все утверждения от startPass до endPass включительно — для
// «полного» режима. На startPass=1, endPass=3 → 15 утверждений.
// Сначала идут все 5 утверждений pass-1, потом pass-2, потом pass-3.
export function getStatementsForFullRange(survey, startPass, endPass = 3) {
  if (!survey) return []
  const out = []
  for (let p = startPass; p <= endPass; p++) {
    out.push(...getStatementsForPass(survey, p))
  }
  return out
}

// Универсальный билдер: вернёт нужный список утверждений по mode/startPass.
// mode: 'short' = только startPass; 'full' = от startPass до 3.
export function buildSurveyStatements(survey, mode, startPass) {
  if (mode === 'full') return getStatementsForFullRange(survey, startPass, 3)
  return getStatementsForPass(survey, startPass)
}

// Среднее по архетипу. skills — мапа state.skills.
// Включает 3 общих базовых навыка + специфичные для ветки. Только те,
// у которых уже есть валидный result. Если ни одного — null.
export function calcArchetypeAvg(skills, archetypeKey) {
  const ids = getSkillsForArchetype(archetypeKey).map(s => s.id)
  const values = ids
    .map(id => skills?.[id]?.result)
    .filter(v => Number.isFinite(v))
  if (values.length === 0) return null
  return values.reduce((s, n) => s + n, 0) / values.length
}

// Общая оценка БС: среднее по архетипам, в которых есть хоть одна анкета.
// Если ни одной анкеты не пройдено — возвращает null (вызывающий сам
// решает, использовать fallback или нет).
export function calcSiScoreFromSkills(skills) {
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
