// Парсер анкет навыков ЧЭ.
// Источник — `surveys.md` (адаптация `Fe/вопросы для оценки навыков ЧЭ.md`).
//
// Формат:
//   ### Навык: <Полное русское название>
//
//   **Теоретическое знание**
//   1. <утверждение>
//   2. <утверждение>
//   3. <утверждение>
//
//   **Практическое умение**
//   ...
//
//   и так далее по 5 блоков × 3 утверждения = 15 утверждений на навык.
//
// Возвращает:
//   { [skillId]: { id, name, archetype, blocks: { knowledge: [3], practice: [3], ... } } }
//
// skillId и archetype определяются через маппинг SKILL_BY_RUS_NAME и
// SKILL_TO_ARCHETYPE из tree.js. Для ядерных навыков archetype = 'common'.

import type { Survey, SurveyBlockKey } from '@/types/script'
import type { ArchetypeId } from '@/types/skill'
import {
  SKILL_BY_RUS_NAME,
  SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILL_IDS,
  BLOCK_RUS_TO_KEY,
  SURVEY_BLOCK_KEYS
} from './tree'

// Парсит весь md и возвращает мапу skillId → survey-объект.
export function parseSurveys(md: string): Record<string, Survey> {
  const out: Record<string, Survey> = {}

  // Разбиваем по `### Навык:` (старый формат БС) или `### Навык N.` (формат Fe-файла,
  // где после номера может идти суффикс · ЯДЕРНЫЙ / · доп. для … — отбрасываем его).
  const skillRegex = /^###\s*Навык(?::|\s*\d+\.)\s*(.+?)\s*$/gm
  const matches = [...md.matchAll(skillRegex)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const fullName = match[1].trim()
    // Отрезаем суффикс после ` · ` (например "Эмоциональная осознанность · ЯДЕРНЫЙ").
    const rusName = fullName.split(/\s*·\s*/)[0].trim()
    const id = SKILL_BY_RUS_NAME[rusName]
    if (!id) {
      // eslint-disable-next-line no-console
      console.warn(`[parseSurveys ЧЭ] Навык не найден в маппинге: "${rusName}"`)
      continue
    }
    // Для ядерных архетип не определён — ставим 'common'.
    // NOTE(ts): SKILL_TO_ARCHETYPE returns a FeArchetypeKey-string; this
    // module doesn't know the global ArchetypeId union, so we cast at the
    // boundary — see parseSurveys.ts (Si) for the same pattern.
    const archetypeStr = COMMON_BASE_SKILL_IDS.has(id) ? 'common' : SKILL_TO_ARCHETYPE[id]
    if (!archetypeStr) {
      // eslint-disable-next-line no-console
      console.warn(`[parseSurveys ЧЭ] Архетип не найден для навыка: ${id}`)
      continue
    }
    const archetype = archetypeStr as ArchetypeId

    const matchIndex = match.index ?? 0
    const start = matchIndex + match[0].length
    const nextMatch = matches[i + 1]
    const end = nextMatch ? (nextMatch.index ?? md.length) : md.length
    const body = md.slice(start, end)

    const blocks = parseBlocks(body)

    out[id] = {
      id,
      name: rusName,
      archetype,
      blocks
    }
  }

  return out
}

// Из тела одного навыка вытаскивает 5 блоков и в каждом — 3 утверждения.
function parseBlocks(body: string): Record<SurveyBlockKey, string[]> {
  const blocks: Record<string, string[]> = {}
  for (const key of SURVEY_BLOCK_KEYS) blocks[key] = []

  const blockRegex = /^\*\*\s*([^*\n]+?)\s*\*\*\s*$/gm
  const matches = [...body.matchAll(blockRegex)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const rusBlockName = match[1].trim()
    const blockKey = BLOCK_RUS_TO_KEY[rusBlockName]
    if (!blockKey) continue

    const matchIndex = match.index ?? 0
    const start = matchIndex + match[0].length
    const nextMatch = matches[i + 1]
    const end = nextMatch ? (nextMatch.index ?? body.length) : body.length
    const blockBody = body.slice(start, end)

    blocks[blockKey] = parseStatements(blockBody)
  }

  return blocks
}

// Из тела блока вытаскивает нумерованные утверждения.
function parseStatements(blockBody: string): string[] {
  const lines = blockBody.split('\n')
  const statements: string[] = []
  for (const raw of lines) {
    const m = raw.match(/^\s*\d+\.\s+(.+?)\s*$/)
    if (m) statements.push(m[1])
  }
  return statements
}
