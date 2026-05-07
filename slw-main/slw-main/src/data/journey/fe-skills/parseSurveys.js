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

import {
  SKILL_BY_RUS_NAME,
  SKILL_TO_ARCHETYPE,
  COMMON_BASE_SKILL_IDS,
  BLOCK_RUS_TO_KEY,
  SURVEY_BLOCK_KEYS
} from './tree'

// Парсит весь md и возвращает мапу skillId → survey-объект.
export function parseSurveys(md) {
  const out = {}

  // Разбиваем по `### Навык:` (старый формат БС) или `### Навык N.` (формат Fe-файла,
  // где после номера может идти суффикс · ЯДЕРНЫЙ / · доп. для … — отбрасываем его).
  const skillRegex = /^###\s*Навык(?::|\s*\d+\.)\s*(.+?)\s*$/gm
  const matches = [...md.matchAll(skillRegex)]

  for (let i = 0; i < matches.length; i++) {
    const fullName = matches[i][1].trim()
    // Отрезаем суффикс после ` · ` (например "Эмоциональная осознанность · ЯДЕРНЫЙ").
    const rusName = fullName.split(/\s*·\s*/)[0].trim()
    const id = SKILL_BY_RUS_NAME[rusName]
    if (!id) {
      // eslint-disable-next-line no-console
      console.warn(`[parseSurveys ЧЭ] Навык не найден в маппинге: "${rusName}"`)
      continue
    }
    // Для ядерных архетип не определён — ставим 'common'.
    const archetype = COMMON_BASE_SKILL_IDS.has(id) ? 'common' : SKILL_TO_ARCHETYPE[id]
    if (!archetype) {
      // eslint-disable-next-line no-console
      console.warn(`[parseSurveys ЧЭ] Архетип не найден для навыка: ${id}`)
      continue
    }

    const start = matches[i].index + matches[i][0].length
    const end = i + 1 < matches.length ? matches[i + 1].index : md.length
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
function parseBlocks(body) {
  const blocks = {}
  for (const key of SURVEY_BLOCK_KEYS) blocks[key] = []

  const blockRegex = /^\*\*\s*([^*\n]+?)\s*\*\*\s*$/gm
  const matches = [...body.matchAll(blockRegex)]

  for (let i = 0; i < matches.length; i++) {
    const rusBlockName = matches[i][1].trim()
    const blockKey = BLOCK_RUS_TO_KEY[rusBlockName]
    if (!blockKey) continue

    const start = matches[i].index + matches[i][0].length
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length
    const blockBody = body.slice(start, end)

    blocks[blockKey] = parseStatements(blockBody)
  }

  return blocks
}

// Из тела блока вытаскивает нумерованные утверждения.
function parseStatements(blockBody) {
  const lines = blockBody.split('\n')
  const statements = []
  for (const raw of lines) {
    const m = raw.match(/^\s*\d+\.\s+(.+?)\s*$/)
    if (m) statements.push(m[1])
  }
  return statements
}
