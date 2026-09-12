import { ASPECT_KEYS, type AspectKey } from '@/types/aspect'
import type { LiteData, LiteSnapshot } from '@/types/storage'

const ASPECT_SET = new Set<string>(ASPECT_KEYS)
const FORBIDDEN_MAP_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const SCREEN_NAMES = new Set([
  'chat', 'planets', 'survey', 'survey-choice', 'survey-insight', 'skill-tree',
  'skill-detail', 'skill-traits', 'profile', 'onboarding', 'levelcomplete',
  'tasks', 'fe-core-overview',
])
const AWAITING_INPUTS = new Set([
  'number', 'text', 'choice', 'step-insight', 'exercise_note', 'intro-next',
])
const DIARY_SOURCES = new Set([
  'manual', 'daily-review', 'aspect', 'aspect-item', 'journey',
  'journey-step-insight', 'journey-survey-statement', 'journey-survey',
  'journey-skill-insight',
])

export class LiteValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'LiteValidationError'
  }
}

function fail(path: string, message: string): never {
  throw new LiteValidationError(path, message)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'ожидался объект')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(path, 'недопустимый прототип объекта')
  return value as Record<string, unknown>
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'ожидался массив')
  if (Object.getPrototypeOf(value) !== Array.prototype) fail(path, 'недопустимый прототип массива')
  for (const key of Object.keys(value)) {
    const index = Number(key)
    if (!Number.isSafeInteger(index) || index < 0 || index >= value.length || String(index) !== key) {
      fail(`${path}.${key}`, 'неизвестное поле массива')
    }
  }
  return value
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[], path: string): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(`${path}.${key}`, 'неизвестное поле')
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${path}.${key}`, 'обязательное поле отсутствует')
  }
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'ожидалась строка')
  return value
}

function nonEmptyString(value: unknown, path: string): string {
  const result = stringValue(value, path)
  if (result.length === 0) fail(path, 'строка не должна быть пустой')
  return result
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'ожидалось конечное число')
  return value
}

function integer(value: unknown, path: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
  const result = finiteNumber(value, path)
  if (!Number.isSafeInteger(result) || result < min || result > max) fail(path, `ожидалось целое число от ${min} до ${max}`)
  return result
}

function boundedNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path)
  if (result < 1 || result > 10) fail(path, 'ожидалось число от 1 до 10')
  return result
}

function answer(value: unknown, path: string): number {
  return integer(value, path, 1, 10)
}

function optionalString(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'string') fail(path, 'ожидалась строка')
}

function nullableString(value: unknown, path: string): void {
  if (value !== null && typeof value !== 'string') fail(path, 'ожидалась строка или null')
}

function idValue(value: unknown, path: string): void {
  if (typeof value === 'string') {
    nonEmptyString(value, path)
    return
  }
  finiteNumber(value, path)
}

function safeMapKey(key: string, path: string): void {
  if (key.length === 0 || FORBIDDEN_MAP_KEYS.has(key)) fail(path, 'недопустимый ключ')
}

function stringArray(value: unknown, path: string): void {
  array(value, path).forEach((item, index) => nonEmptyString(item, `${path}[${index}]`))
}

function validateAnswerMap(value: unknown, path: string): void {
  const obj = record(value, path)
  for (const [key, answers] of Object.entries(obj)) {
    safeMapKey(key, `${path}.${key}`)
    const items = array(answers, `${path}.${key}`)
    if (items.length > 3) fail(`${path}.${key}`, 'допустимо не более трёх ответов')
    items.forEach((item, index) => {
      if (item !== null) answer(item, `${path}.${key}[${index}]`)
    })
  }
}

function validateInsight(value: unknown, path: string): void {
  const obj = record(value, path)
  const source = obj.source
  if (source === 'detail' || source === 'traits') {
    exactKeys(obj, ['text', 'completedAt', 'source', 'level'], ['text', 'completedAt', 'source', 'level'], path)
    nonEmptyString(obj.text, `${path}.text`)
    integer(obj.completedAt, `${path}.completedAt`, 0)
    integer(obj.level, `${path}.level`, 0, 3)
    return
  }
  if (source !== undefined && source !== 'survey') fail(`${path}.source`, 'неизвестный источник инсайта')
  exactKeys(obj, ['text', 'completedAt', 'mode', 'pass', 'source'], ['text', 'completedAt', 'pass'], path)
  nonEmptyString(obj.text, `${path}.text`)
  integer(obj.completedAt, `${path}.completedAt`, 0)
  integer(obj.pass, `${path}.pass`, 0, 3)
  if (obj.mode !== undefined && obj.mode !== 'short' && obj.mode !== 'full') fail(`${path}.mode`, 'неизвестный режим анкеты')
}

function validateSurveyProgress(value: unknown, path: string, draft: boolean): void {
  const obj = record(value, path)
  const allowed = draft
    ? ['mode', 'startPass', 'stepIndex', 'pass', 'blockIndex', 'answers']
    : ['scriptId', 'skillId', 'mode', 'startPass', 'stepIndex', 'answers', 'blockIndex', 'statementIndex']
  exactKeys(obj, allowed, draft ? [] : ['skillId'], path)
  if (!draft) nonEmptyString(obj.skillId, `${path}.skillId`)
  optionalString(obj.scriptId, `${path}.scriptId`)
  if (obj.mode !== undefined && obj.mode !== 'short' && obj.mode !== 'full') fail(`${path}.mode`, 'неизвестный режим анкеты')
  if (obj.startPass !== undefined) integer(obj.startPass, `${path}.startPass`, 1, 3)
  if (obj.stepIndex !== undefined) integer(obj.stepIndex, `${path}.stepIndex`, 0)
  if (obj.pass !== undefined) integer(obj.pass, `${path}.pass`, 0, 3)
  if (obj.blockIndex !== undefined) integer(obj.blockIndex, `${path}.blockIndex`, 0)
  if (obj.statementIndex !== undefined) integer(obj.statementIndex, `${path}.statementIndex`, 0)
  if (obj.answers !== undefined) validateAnswerMap(obj.answers, `${path}.answers`)
}

function validateMessage(value: unknown, path: string): void {
  const obj = record(value, path)
  exactKeys(obj, ['id', 'role', 'text', 'kind', 'scriptId', 'level', 'timestamp'], ['id', 'role'], path)
  idValue(obj.id, `${path}.id`)
  if (obj.role !== 'bot' && obj.role !== 'user') fail(`${path}.role`, 'неизвестная роль')
  optionalString(obj.text, `${path}.text`)
  if (obj.kind !== undefined && obj.kind !== 'script') fail(`${path}.kind`, 'неизвестный вид сообщения')
  optionalString(obj.scriptId, `${path}.scriptId`)
  if (obj.kind === 'script' && typeof obj.scriptId !== 'string') fail(`${path}.scriptId`, 'обязателен для script-сообщения')
  if (obj.level !== undefined) integer(obj.level, `${path}.level`, 0, 3)
  if (obj.timestamp !== undefined) finiteNumber(obj.timestamp, `${path}.timestamp`)
}

function validatePendingTask(value: unknown, path: string): void {
  const obj = record(value, path)
  exactKeys(obj, ['id', 'scriptId', 'aspect', 'title', 'addedAt', 'createdAt', 'status'], ['id', 'scriptId', 'status'], path)
  idValue(obj.id, `${path}.id`)
  nonEmptyString(obj.scriptId, `${path}.scriptId`)
  if (obj.aspect !== undefined && !ASPECT_SET.has(stringValue(obj.aspect, `${path}.aspect`))) fail(`${path}.aspect`, 'неизвестный аспект')
  optionalString(obj.title, `${path}.title`)
  if (obj.addedAt !== undefined) finiteNumber(obj.addedAt, `${path}.addedAt`)
  if (obj.createdAt !== undefined) finiteNumber(obj.createdAt, `${path}.createdAt`)
  if (obj.status !== 'taken' && obj.status !== 'deferred') fail(`${path}.status`, 'неизвестный статус задания')
}

function validateAspectState(value: unknown, path: string): void {
  const obj = record(value, path)
  const fields = ['currentLevel', 'currentScriptIndex', 'currentScriptId', 'awaitingInput', 'messages', 'completedScripts', 'pendingTasks']
  exactKeys(obj, fields, fields, path)
  integer(obj.currentLevel, `${path}.currentLevel`, 0, 3)
  integer(obj.currentScriptIndex, `${path}.currentScriptIndex`, 0)
  nullableString(obj.currentScriptId, `${path}.currentScriptId`)
  if (obj.awaitingInput !== null && !AWAITING_INPUTS.has(stringValue(obj.awaitingInput, `${path}.awaitingInput`))) fail(`${path}.awaitingInput`, 'неизвестный режим ввода')
  array(obj.messages, `${path}.messages`).forEach((item, index) => validateMessage(item, `${path}.messages[${index}]`))
  stringArray(obj.completedScripts, `${path}.completedScripts`)
  array(obj.pendingTasks, `${path}.pendingTasks`).forEach((item, index) => validatePendingTask(item, `${path}.pendingTasks[${index}]`))
}

function validateSkill(value: unknown, path: string): void {
  const obj = record(value, path)
  exactKeys(obj, ['id', 'answers', 'blocks', 'passes', 'result', 'draft', 'insights', 'completedAt', 'lastUpdated'], ['id'], path)
  nonEmptyString(obj.id, `${path}.id`)
  if (obj.answers !== undefined) validateAnswerMap(obj.answers, `${path}.answers`)
  if (obj.blocks !== undefined) {
    const blocks = record(obj.blocks, `${path}.blocks`)
    for (const [blockKey, blockValue] of Object.entries(blocks)) {
      safeMapKey(blockKey, `${path}.blocks.${blockKey}`)
      if (blockValue !== null) boundedNumber(blockValue, `${path}.blocks.${blockKey}`)
    }
  }
  if (obj.passes !== undefined) integer(obj.passes, `${path}.passes`, 0, 3)
  if (obj.result !== undefined) boundedNumber(obj.result, `${path}.result`)
  if (obj.draft !== undefined && obj.draft !== null) validateSurveyProgress(obj.draft, `${path}.draft`, true)
  if (obj.insights !== undefined) array(obj.insights, `${path}.insights`).forEach((item, index) => validateInsight(item, `${path}.insights[${index}]`))
  if (obj.completedAt !== undefined) integer(obj.completedAt, `${path}.completedAt`, 0)
  if (obj.lastUpdated !== undefined) integer(obj.lastUpdated, `${path}.lastUpdated`, 0)
}

function validateJourney(value: unknown, path: string): void {
  const obj = record(value, path)
  const required = [
    'currentAspect', 'aspects', 'skills', 'activeSurvey', 'skillDetailId', 'xp',
    'streak', 'stardust', 'totalCompleted', 'lastActiveDate', 'screen',
    'onboardingStep', 'contentVersion',
  ]
  exactKeys(obj, [...required, 'completedScripts'], required, path)
  if (!ASPECT_SET.has(stringValue(obj.currentAspect, `${path}.currentAspect`))) fail(`${path}.currentAspect`, 'неизвестный аспект')
  const aspects = record(obj.aspects, `${path}.aspects`)
  for (const [aspect, state] of Object.entries(aspects)) {
    if (!ASPECT_SET.has(aspect)) fail(`${path}.aspects.${aspect}`, 'неизвестный аспект')
    validateAspectState(state, `${path}.aspects.${aspect}`)
  }
  const skills = record(obj.skills, `${path}.skills`)
  for (const [skillId, skill] of Object.entries(skills)) {
    safeMapKey(skillId, `${path}.skills.${skillId}`)
    if (skillId === '_admin') fail(`${path}.skills.${skillId}`, 'служебный навык недоступен в lite')
    validateSkill(skill, `${path}.skills.${skillId}`)
  }
  if (obj.activeSurvey !== null) validateSurveyProgress(obj.activeSurvey, `${path}.activeSurvey`, false)
  nullableString(obj.skillDetailId, `${path}.skillDetailId`)
  for (const field of ['xp', 'streak', 'stardust', 'totalCompleted'] as const) integer(obj[field], `${path}.${field}`, 0)
  nullableString(obj.lastActiveDate, `${path}.lastActiveDate`)
  if (!SCREEN_NAMES.has(stringValue(obj.screen, `${path}.screen`))) fail(`${path}.screen`, 'экран недоступен в lite')
  integer(obj.onboardingStep, `${path}.onboardingStep`, 0, 6)
  integer(obj.contentVersion, `${path}.contentVersion`, 0)
  if (obj.completedScripts !== undefined) stringArray(obj.completedScripts, `${path}.completedScripts`)
}

function validateScores(value: unknown, path: string): void {
  const obj = record(value, path)
  for (const [aspect, value] of Object.entries(obj)) {
    if (!ASPECT_SET.has(aspect)) fail(`${path}.${aspect}`, 'неизвестный аспект')
    integer(value, `${path}.${aspect}`, 1, 10)
  }
}

function validateSurveyDetails(value: unknown, path: string): void {
  const obj = record(value, path)
  exactKeys(obj, ['name', 'archetype', 'blocks', 'answers', 'blockAvgs', 'skillAvg', 'pass', 'mode'], [], path)
  optionalString(obj.name, `${path}.name`)
  optionalString(obj.archetype, `${path}.archetype`)
  if (obj.blocks !== undefined) {
    const blocks = record(obj.blocks, `${path}.blocks`)
    for (const [key, statements] of Object.entries(blocks)) {
      safeMapKey(key, `${path}.blocks.${key}`)
      stringArray(statements, `${path}.blocks.${key}`)
    }
  }
  if (obj.answers !== undefined) validateAnswerMap(obj.answers, `${path}.answers`)
  if (obj.blockAvgs !== undefined) {
    const averages = record(obj.blockAvgs, `${path}.blockAvgs`)
    for (const [key, value] of Object.entries(averages)) {
      safeMapKey(key, `${path}.blockAvgs.${key}`)
      if (value !== null) boundedNumber(value, `${path}.blockAvgs.${key}`)
    }
  }
  if (obj.skillAvg !== undefined && obj.skillAvg !== null) boundedNumber(obj.skillAvg, `${path}.skillAvg`)
  if (obj.pass !== undefined) integer(obj.pass, `${path}.pass`, 0, 3)
  if (obj.mode !== undefined && obj.mode !== 'short' && obj.mode !== 'full') fail(`${path}.mode`, 'неизвестный режим анкеты')
}

function validateDiaryEntry(value: unknown, path: string): void {
  const obj = record(value, path)
  exactKeys(obj, [
    'id', 'date', 'ts', 'aspect', 'text', 'source', 'promptTitle', 'prompt',
    'survey', 'scriptId', 'skillId', 'level', 'blockId', 'blockTitle', 'itemId',
    'insight', 'insightSource',
  ], ['id', 'date', 'ts', 'aspect', 'text'], path)
  idValue(obj.id, `${path}.id`)
  nonEmptyString(obj.date, `${path}.date`)
  finiteNumber(obj.ts, `${path}.ts`)
  const aspect = stringValue(obj.aspect, `${path}.aspect`)
  if (aspect !== 'general' && !ASPECT_SET.has(aspect)) fail(`${path}.aspect`, 'неизвестный аспект')
  stringValue(obj.text, `${path}.text`)
  if (obj.source !== undefined && !DIARY_SOURCES.has(stringValue(obj.source, `${path}.source`))) fail(`${path}.source`, 'источник недоступен в lite')
  for (const field of ['promptTitle', 'prompt', 'scriptId', 'skillId', 'itemId'] as const) {
    if (obj[field] !== undefined) nullableString(obj[field], `${path}.${field}`)
  }
  for (const field of ['blockId', 'blockTitle', 'insight'] as const) {
    if (obj[field] !== undefined) stringValue(obj[field], `${path}.${field}`)
  }
  if (obj.level !== undefined) integer(obj.level, `${path}.level`, 0, 3)
  if (obj.insightSource !== undefined && obj.insightSource !== 'detail' && obj.insightSource !== 'traits') fail(`${path}.insightSource`, 'неизвестный источник инсайта')
  if (obj.survey !== undefined) validateSurveyDetails(obj.survey, `${path}.survey`)
}

function validatePreferences(value: unknown, path: string): void {
  const obj = record(value, path)
  exactKeys(obj, ['sendKeyMode', 'hintsSeen'], [], path)
  if (obj.sendKeyMode !== undefined && obj.sendKeyMode !== 'enter' && obj.sendKeyMode !== 'ctrl+enter') fail(`${path}.sendKeyMode`, 'неизвестный режим отправки')
  if (obj.hintsSeen !== undefined) {
    const hints = record(obj.hintsSeen, `${path}.hintsSeen`)
    for (const [key, seen] of Object.entries(hints)) {
      safeMapKey(key, `${path}.hintsSeen.${key}`)
      if (typeof seen !== 'boolean') fail(`${path}.hintsSeen.${key}`, 'ожидалось логическое значение')
    }
  }
}

function validateData(value: unknown, path: string): void {
  const obj = record(value, path)
  exactKeys(obj, ['journey', 'scores', 'diary', 'history', 'preferences'], ['journey', 'scores', 'diary', 'history', 'preferences'], path)
  validateJourney(obj.journey, `${path}.journey`)
  validateScores(obj.scores, `${path}.scores`)
  array(obj.diary, `${path}.diary`).forEach((item, index) => validateDiaryEntry(item, `${path}.diary[${index}]`))
  const history = array(obj.history, `${path}.history`)
  if (history.length !== 0) fail(`${path}.history`, 'непустая история пока не поддерживается')
  validatePreferences(obj.preferences, `${path}.preferences`)
}

function validateSnapshotShape(value: unknown): asserts value is LiteSnapshot {
  const obj = record(value, '$')
  exactKeys(obj, ['format', 'schemaVersion', 'revision', 'updatedAt', 'data'], ['format', 'schemaVersion', 'revision', 'updatedAt', 'data'], '$')
  if (obj.format !== 'slw-lite') fail('$.format', 'неизвестный формат')
  if (obj.schemaVersion !== 1) fail('$.schemaVersion', 'неподдерживаемая версия схемы')
  integer(obj.revision, '$.revision', 0)
  const updatedAt = nonEmptyString(obj.updatedAt, '$.updatedAt')
  if (Number.isNaN(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) fail('$.updatedAt', 'ожидалась каноническая дата ISO 8601 UTC')
  validateData(obj.data, '$.data')
}

export function cloneLiteSnapshot(value: unknown): LiteSnapshot {
  validateSnapshotShape(value)
  let raw: string
  try {
    raw = JSON.stringify(value)
  } catch {
    fail('$', 'значение не сериализуется в JSON')
  }
  const clone: unknown = JSON.parse(raw)
  validateSnapshotShape(clone)
  return clone
}

export function parseLiteSnapshot(raw: string): LiteSnapshot {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    fail('$', 'невалидный JSON')
  }
  validateSnapshotShape(value)
  return value
}

export function createLiteSnapshot(data: LiteData, revision: number, updatedAt = new Date().toISOString()): LiteSnapshot {
  return cloneLiteSnapshot({ format: 'slw-lite', schemaVersion: 1, revision, updatedAt, data })
}

export function serializeLiteSnapshot(value: unknown): string {
  validateSnapshotShape(value)
  let raw: string
  try {
    raw = JSON.stringify(value)
  } catch {
    fail('$', 'значение не сериализуется в JSON')
  }
  parseLiteSnapshot(raw)
  return raw
}

export function validateLiteSnapshot(value: unknown): LiteSnapshot {
  return cloneLiteSnapshot(value)
}

export type { AspectKey }
