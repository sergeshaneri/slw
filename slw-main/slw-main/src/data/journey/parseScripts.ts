// Парсер контента путешествия из markdown.
// Источник истины — `aspects/<aspect>-l<level>.md`. Vite импортирует его
// как сырой текст (`?raw`), этот модуль превращает текст в массив объектов
// для рантайма JourneyView.
//
// Формат md (см. bs-l0.md):
//
//   ## intro · 1
//   button: Далее
//
//   текст…
//
//   ## T-1 · theory · Внутренний сканер
//   xp: 5
//
//   текст…
//
//   ## B-1 · question · Качество сна
//   xp: 10
//
//   текст вопроса…
//
//   ### followUp 1-3
//
//   {ans}/10 — реакция бота
//
//   ### followUp 4-5
//
//   …
//
//   ## complete
//
//   Финальный текст уровня.

import type { Script, ScriptType, SurveyBlockKey } from '@/types/script'

const SECTION_RE = /^##\s+(.+)$/gm
const FOLLOWUP_RE = /^###\s+followUp\s+(.+)$/gm

// Intro-секции и complete-блок не покрыты типом Script. Описываем их
// локально — потребители (registry, aspects/<Latin>/index) видят эти shape.
export type IntroEntry = {
  id: string
  text: string
  button: string
  xp?: number
}

export type CompleteEntry = {
  text: string
}

export type JourneyParseResult = {
  intro: IntroEntry[]
  scripts: Script[]
  complete: CompleteEntry | null
}

// Внутренние формы парсера. Заголовок и тело секции до классификации.
type RawSection = { header: string; body: string }

// Раскрученные `### followUp X-Y` подсекции внутри тела одного скрипта.
type FollowUp = { min: number; max: number; text: string }

// Метаданные `key: value` в самом начале тела секции. Все значения —
// строки до парсинга в числа/булы. Ключи — узкий whitelist того, что
// парсер действительно потребляет ниже.
type ScriptMetadataRaw = {
  xp?: string
  stardust?: string
  pool?: string
  skill?: string
  block?: string
  scale?: string
  button?: string
}

export function parseJourneyMd(md: string): JourneyParseResult {
  const intro: IntroEntry[] = []
  const scripts: Script[] = []
  let complete: CompleteEntry | null = null

  // Разбиваем по `## ` секциям, сохраняя заголовки.
  const sections = splitSections(md, SECTION_RE)

  for (const { header, body } of sections) {
    const trimmedHeader = header.trim()

    if (trimmedHeader === 'complete' || trimmedHeader.startsWith('complete ')) {
      const { body: completeBody } = splitMetaAndBody(body)
      complete = { text: completeBody }
      continue
    }

    if (trimmedHeader.startsWith('intro')) {
      const m = trimmedHeader.match(/intro\s*·\s*(\d+)/)
      const index = m ? parseInt(m[1], 10) : intro.length + 1
      const { metadata, body: introBody } = splitMetaAndBody(body)
      const entry: IntroEntry = {
        id: `intro-${index}`,
        text: introBody,
        button: metadata.button || 'Далее'
      }
      if (metadata.xp) entry.xp = parseInt(metadata.xp, 10)
      intro.push(entry)
      continue
    }

    // Скрипт: "T-1 · theory · Внутренний сканер"
    const m = trimmedHeader.match(/^([A-Z]+-\d+)\s*·\s*([a-z_]+)\s*·\s*(.+)$/)
    if (!m) continue
    const [, id, typeStr, title] = m

    // Вытаскиваем followUp подсекции (если есть)
    const { mainBody, followUps } = extractFollowUps(body)
    const { metadata, body: scriptBody } = splitMetaAndBody(mainBody)

    const script: Script = {
      id,
      type: typeStr as ScriptType,
      order: scripts.length + 1,
      title: title.trim(),
      text: scriptBody,
      xp: metadata.xp ? parseInt(metadata.xp, 10) : 0
    }
    if (metadata.stardust) script.stardust = parseInt(metadata.stardust, 10)
    // pool: true — шаг идёт в опциональный пул уровня (см. SCRIPT_GUIDELINES §8).
    // Любое значение, кроме строго "false", считаем за true.
    if (metadata.pool && metadata.pool.toLowerCase() !== 'false') script.pool = true
    // skill: <id> — для type='survey' указывает на анкету в SURVEYS.
    // Текст утверждений берётся из SURVEYS[skill]; тело шага в md можно
    // оставлять пустым или давать короткое описание навыка.
    // Также используется в type='question' (B-вопросы со scale): если есть
    // skill+block, ответ юзера пишется в state.skills[skill].answers[block][0]
    // (соответствует pass=1, statementIndex=0). После 5 таких ответов из 5
    // разных блоков навык получает result, и колесо аспекта обновляется
    // через calc*ScoreFromSkills. Это синхронизирует L0-чат с деревом
    // навыков: SURV-карточка в дереве потом предложит «продолжить с pass 2».
    if (metadata.skill) script.skill = metadata.skill
    // block: knowledge | practice | awareness | priority | confidence —
    // ключ блока для записи ответа в state.skills (см. SURVEY_BLOCK_KEYS).
    if (metadata.block) script.block = metadata.block as SurveyBlockKey
    // scale: 1-10 (или просто truthy) — пометка, что этот вопрос —
    // самооценка по шкале 1–10. UI будет показывать ползунок вместо
    // текстового ввода. Срабатывает даже без followUp-блоков.
    if (metadata.scale) script.scale = true

    if (followUps.length > 0) {
      script.followUp = (ans: string | number) => {
        const n = parseInt(String(ans), 10)
        for (const fu of followUps) {
          if (Number.isFinite(n) && n >= fu.min && n <= fu.max) {
            return fu.text.replace(/\{ans\}/g, String(ans))
          }
        }
        return followUps[followUps.length - 1].text.replace(/\{ans\}/g, String(ans))
      }
    }

    scripts.push(script)
  }

  return { intro, scripts, complete }
}

// Разбивает текст на секции по регулярке, возвращая [{header, body}, …].
function splitSections(text: string, headerRe: RegExp): RawSection[] {
  const matches = [...text.matchAll(headerRe)]
  const sections: RawSection[] = []
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const header = match[1]
    const matchIndex = match.index ?? 0
    const start = matchIndex + match[0].length
    const nextMatch = matches[i + 1]
    const end = nextMatch ? (nextMatch.index ?? text.length) : text.length
    sections.push({ header, body: text.slice(start, end).trim() })
  }
  return sections
}

// Из тела секции вырезает все `### followUp X-Y` подсекции,
// возвращая { mainBody (без них), followUps: [{min, max, text}] }.
function extractFollowUps(body: string): { mainBody: string; followUps: FollowUp[] } {
  const matches = [...body.matchAll(FOLLOWUP_RE)]
  if (matches.length === 0) return { mainBody: body, followUps: [] }

  const firstIndex = matches[0].index ?? 0
  const mainBody = body.slice(0, firstIndex).trim()
  const followUps: FollowUp[] = []
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const rangeStr = match[1].trim()
    const matchIndex = match.index ?? 0
    const start = matchIndex + match[0].length
    const nextMatch = matches[i + 1]
    const end = nextMatch ? (nextMatch.index ?? body.length) : body.length
    const text = body.slice(start, end).trim()
    const range = rangeStr.match(/^(\d+)\s*-\s*(\d+)$/)
    if (!range) continue
    followUps.push({
      min: parseInt(range[1], 10),
      max: parseInt(range[2], 10),
      text
    })
  }
  return { mainBody, followUps }
}

// Метаданные — строки `key: value` в самом начале до первой пустой строки.
// Тело — всё остальное.
function splitMetaAndBody(text: string): { metadata: ScriptMetadataRaw; body: string } {
  const lines = text.split('\n')
  const metadata: Record<string, string> = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(/^([a-z]+):\s*(.+)$/)
    if (m) {
      metadata[m[1]] = m[2].trim()
      i++
      continue
    }
    if (line.trim() === '') {
      i++
      break
    }
    break
  }
  return { metadata: metadata as ScriptMetadataRaw, body: lines.slice(i).join('\n').trim() }
}
