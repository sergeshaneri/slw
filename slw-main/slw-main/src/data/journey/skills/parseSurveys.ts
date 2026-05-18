// Парсер анкет навыков. Используется для БС (`surveys.md`) и
// ЧИ (`ne-surveys.md`).
//
// Формат:
//   # Домен N <название>     ← игнорируем, домены не используем (у нас архетипы)
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
// Маппинги skillByRusName / skillToArchetype / blockRusToKey / surveyBlockKeys
// должны прийти параметром — они аспект-специфичные. Для обратной
// совместимости со старым однопараметрическим вызовом (БС), если
// маппинги не переданы, импортируем дефолтные из ./tree.

import type { Survey, SurveyBlockKey } from '@/types/script'
import type { ArchetypeId } from '@/types/skill'
import {
  SKILL_BY_RUS_NAME as SI_SKILL_BY_RUS_NAME,
  SKILL_TO_ARCHETYPE as SI_SKILL_TO_ARCHETYPE,
  BLOCK_RUS_TO_KEY as SI_BLOCK_RUS_TO_KEY,
  SURVEY_BLOCK_KEYS as SI_SURVEY_BLOCK_KEYS
} from './tree'

export type ParseSurveysMappings = {
  skillByRusName?: Record<string, string>
  skillToArchetype?: Record<string, string>
  blockRusToKey?: Record<string, string>
  surveyBlockKeys?: string[]
}

// Парсит весь md и возвращает мапу skillId → survey-объект.
// mappings — { skillByRusName, skillToArchetype, blockRusToKey, surveyBlockKeys }.
// Если не передан — берём БС-маппинги (обратная совместимость).
export function parseSurveys(
  md: string,
  mappings?: ParseSurveysMappings
): Record<string, Survey> {
  const skillByRusName = mappings?.skillByRusName ?? SI_SKILL_BY_RUS_NAME
  const skillToArchetype = mappings?.skillToArchetype ?? SI_SKILL_TO_ARCHETYPE
  const blockRusToKey = mappings?.blockRusToKey ?? SI_BLOCK_RUS_TO_KEY
  const surveyBlockKeys = mappings?.surveyBlockKeys ?? SI_SURVEY_BLOCK_KEYS

  const out: Record<string, Survey> = {}

  // Разбиваем по `### Навык:` — каждый кусок начинается с одного навыка.
  const skillRegex = /^###\s*Навык:\s*(.+?)\s*$/gm
  const matches = [...md.matchAll(skillRegex)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const rusName = match[1].trim()
    const id = skillByRusName[rusName]
    if (!id) {
      // eslint-disable-next-line no-console
      console.warn(`[parseSurveys] Навык не найден в маппинге: "${rusName}"`)
      continue
    }
    // Общие базовые (signals/interoception/honesty у БС, attention-essence/
    // metacognition/mindfulness у ЧИ и т.п.) не имеют конкретного архетипа —
    // они входят в каждый архетип сквозным слоем. Помечаем их как 'common'.
    // TODO(ts): tighten archetype source typing — skillToArchetype может
    // отдать ключ, которого нет в ArchetypeId; парсер сам по себе не знает
    // про union, поэтому касается значения как ArchetypeId.
    const archetype = (skillToArchetype[id] ?? 'common') as ArchetypeId

    const matchIndex = match.index ?? 0
    const start = matchIndex + match[0].length
    const nextMatch = matches[i + 1]
    const end = nextMatch ? (nextMatch.index ?? md.length) : md.length
    const body = md.slice(start, end)

    const blocks = parseBlocks(body, blockRusToKey, surveyBlockKeys)

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
// Блок начинается со строки `**<Русское имя блока>**`, утверждения —
// строки вида `<число>. <текст>` до следующего `**` или конца.
function parseBlocks(
  body: string,
  blockRusToKey: Record<string, string>,
  surveyBlockKeys: string[]
): Record<SurveyBlockKey, string[]> {
  const blocks: Record<string, string[]> = {}
  // Initialize each known block with empty array — guarantees stable shape.
  for (const key of surveyBlockKeys) blocks[key] = []

  const blockRegex = /^\*\*\s*([^*\n]+?)\s*\*\*\s*$/gm
  const matches = [...body.matchAll(blockRegex)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const rusBlockName = match[1].trim()
    const blockKey = blockRusToKey[rusBlockName]
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

// Из тела блока (текст между двумя `**заголовок**`) вытаскивает
// нумерованные утверждения. Берём строки вида `<digits>. <text>`.
function parseStatements(blockBody: string): string[] {
  const lines = blockBody.split('\n')
  const statements: string[] = []
  for (const raw of lines) {
    const m = raw.match(/^\s*\d+\.\s+(.+?)\s*$/)
    if (m) statements.push(m[1])
  }
  return statements
}
