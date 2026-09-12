import type { LiteData, LiteSnapshot } from '@/types/storage'
import { parseLiteSnapshot, serializeLiteSnapshot, LiteValidationError } from './liteTransfer'

export const LITE_STORAGE_KEY = 'slw_lite_v1_state'

export type LiteStorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type LiteLoadResult =
  | { status: 'missing'; raw: null }
  | { status: 'durable'; raw: string; snapshot: LiteSnapshot }
  | { status: 'corrupt'; raw: string; error: LiteValidationError }
  | { status: 'unavailable'; raw: null; error: unknown }

export type LiteStorageExpectation = {
  revision: number | null
  raw: string | null
}

export type LiteSaveFailureReason = 'quota' | 'security' | 'unavailable'

export type LiteSaveResult =
  | { status: 'saved'; raw: string; snapshot: LiteSnapshot }
  | { status: 'conflict'; current: Exclude<LiteLoadResult, { status: 'unavailable' }> }
  | { status: 'corrupt'; raw: string; error: LiteValidationError }
  | { status: 'failed'; reason: LiteSaveFailureReason; error: unknown }

export function loadLiteSnapshot(storage: LiteStorageLike): LiteLoadResult {
  let raw: string | null
  try {
    raw = storage.getItem(LITE_STORAGE_KEY)
  } catch (error) {
    return { status: 'unavailable', raw: null, error }
  }
  if (raw === null) return { status: 'missing', raw: null }
  try {
    return { status: 'durable', raw, snapshot: parseLiteSnapshot(raw) }
  } catch (error) {
    if (error instanceof LiteValidationError) return { status: 'corrupt', raw, error }
    throw error
  }
}

export function expectationFromLoad(result: LiteLoadResult): LiteStorageExpectation | null {
  if (result.status === 'missing') return { revision: null, raw: null }
  if (result.status === 'durable') return { revision: result.snapshot.revision, raw: result.raw }
  return null
}

function writeFailureReason(error: unknown): LiteSaveFailureReason {
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : ''
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota'
  if (name === 'SecurityError') return 'security'
  return 'unavailable'
}

export function saveLiteSnapshot(
  storage: LiteStorageLike,
  data: LiteData,
  expected: LiteStorageExpectation,
  updatedAt = new Date().toISOString(),
): LiteSaveResult {
  const current = loadLiteSnapshot(storage)
  if (current.status === 'unavailable') {
    return { status: 'failed', reason: 'unavailable', error: current.error }
  }
  if (current.status === 'corrupt') return current

  const currentRevision = current.status === 'durable' ? current.snapshot.revision : null
  if (expected.raw !== current.raw || expected.revision !== currentRevision) {
    return { status: 'conflict', current }
  }

  const candidate: LiteSnapshot = {
    format: 'slw-lite',
    schemaVersion: 1,
    revision: (currentRevision ?? 0) + 1,
    updatedAt,
    data,
  }
  const raw = serializeLiteSnapshot(candidate)
  const snapshot = parseLiteSnapshot(raw)

  try {
    storage.setItem(LITE_STORAGE_KEY, raw)
  } catch (error) {
    return { status: 'failed', reason: writeFailureReason(error), error }
  }
  return { status: 'saved', raw, snapshot }
}
export function replaceCorruptLiteSnapshot(
  storage: LiteStorageLike,
  data: LiteData,
  expectedRaw: string,
  updatedAt = new Date().toISOString(),
): LiteSaveResult {
  const candidate: LiteSnapshot = {
    format: 'slw-lite',
    schemaVersion: 1,
    revision: 1,
    updatedAt,
    data,
  }
  const raw = serializeLiteSnapshot(candidate)
  const snapshot = parseLiteSnapshot(raw)
  const current = loadLiteSnapshot(storage)
  if (current.status === 'unavailable') {
    return { status: 'failed', reason: 'unavailable', error: current.error }
  }
  if (current.status !== 'corrupt' || current.raw !== expectedRaw) {
    return { status: 'conflict', current }
  }
  try {
    storage.setItem(LITE_STORAGE_KEY, raw)
  } catch (error) {
    return { status: 'failed', reason: writeFailureReason(error), error }
  }
  return { status: 'saved', raw, snapshot }
}
