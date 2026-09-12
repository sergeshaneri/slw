import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ASPECT_KEYS, type AspectScores } from '@/types/aspect'
import type { DiaryEntry } from '@/types/diary'
import type { JourneyState } from '@/types/journey'
import type { LiteData, LitePreferences, LiteSnapshot } from '@/types/storage'
import { DEFAULT_JOURNEY } from '@/domain/journey/state'
import {
  expectationFromLoad,
  LITE_STORAGE_KEY,
  loadLiteSnapshot,
  replaceCorruptLiteSnapshot,
  saveLiteSnapshot,
  type LiteLoadResult,
  type LiteStorageExpectation,
  type LiteStorageLike,
} from '@/utils/liteStorage'
import { createLiteSnapshot } from '@/utils/liteTransfer'

export type LiteSessionStatus = 'durable' | 'volatile' | 'conflict'
export type LiteUpdater<T> = T | ((current: T) => T)

type SessionIssue =
  | { kind: 'corrupt'; raw: string; message: string }
  | { kind: 'storage'; message: string }
  | null

type SessionInitial = {
  data: LiteData
  status: LiteSessionStatus
  storage: LiteStorageLike | null
  expectation: LiteStorageExpectation | null
  issue: SessionIssue
}

export type LiteSession = {
  data: LiteData
  status: LiteSessionStatus
  sessionEpoch: number
  issue: SessionIssue
  externalStatus: LiteLoadResult['status'] | null
  updateJourney: (next: LiteUpdater<JourneyState>) => void
  updateScores: (next: LiteUpdater<AspectScores>) => void
  updateDiary: (next: LiteUpdater<DiaryEntry[]>) => void
  updatePreferences: (next: LiteUpdater<LitePreferences>) => void
  replaceData: (next: LiteData) => { ok: true } | { ok: false; message: string }
  resetData: () => { ok: true } | { ok: false; message: string }
  acceptExternal: () => void
  exportSnapshot: () => LiteSnapshot
  corruptRaw: string | null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createDefaultLiteData(): LiteData {
  return {
    journey: clone(DEFAULT_JOURNEY),
    scores: Object.fromEntries(ASPECT_KEYS.map((aspect) => [aspect, 5])) as AspectScores,
    diary: [],
    history: [],
    preferences: {},
  }
}

function storageMessage(reason?: string): string {
  if (reason === 'quota') return 'Локальное хранилище переполнено. Изменения сохранены только в памяти.'
  if (reason === 'security') return 'Браузер запретил доступ к локальному хранилищу. Изменения сохранены только в памяти.'
  return 'Локальное хранилище недоступно. Изменения сохранены только в памяти.'
}

function initialize(): SessionInitial {
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    return { data: createDefaultLiteData(), status: 'volatile', storage: null, expectation: null, issue: { kind: 'storage', message: storageMessage('security') } }
  }
  const loaded = loadLiteSnapshot(storage)
  if (loaded.status === 'durable') {
    return { data: clone(loaded.snapshot.data), status: 'durable', storage, expectation: expectationFromLoad(loaded), issue: null }
  }
  if (loaded.status === 'missing') {
    return { data: createDefaultLiteData(), status: 'volatile', storage, expectation: expectationFromLoad(loaded), issue: null }
  }
  if (loaded.status === 'corrupt') {
    return { data: createDefaultLiteData(), status: 'volatile', storage, expectation: null, issue: { kind: 'corrupt', raw: loaded.raw, message: 'Локальная запись повреждена. Она сохранена без изменений.' } }
  }
  return { data: createDefaultLiteData(), status: 'volatile', storage, expectation: null, issue: { kind: 'storage', message: storageMessage() } }
}

export function useLiteSession(): LiteSession {
  const [initial] = useState(initialize)
  const [data, setData] = useState(initial.data)
  const [status, setStatus] = useState<LiteSessionStatus>(initial.status)
  const [issue, setIssue] = useState<SessionIssue>(initial.issue)
  const [external, setExternal] = useState<LiteLoadResult | null>(null)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const dataRef = useRef(initial.data)
  const statusRef = useRef(initial.status)
  const epochRef = useRef(0)
  const expectationRef = useRef(initial.expectation)
  const storageRef = useRef(initial.storage)
  const corruptRawRef = useRef(initial.issue?.kind === 'corrupt' ? initial.issue.raw : null)
  const initialSaveAttemptedRef = useRef(false)

  const publishStatus = useCallback((next: LiteSessionStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const recordSave = useCallback((nextData: LiteData) => {
    const storage = storageRef.current
    const expected = expectationRef.current
    if (!storage || !expected || statusRef.current === 'conflict') return false
    let result
    try {
      result = saveLiteSnapshot(storage, nextData, expected)
    } catch {
      setIssue({ kind: 'storage', message: 'Текущие данные не прошли проверку и сохранены только в памяти.' })
      publishStatus('volatile')
      return false
    }
    if (result.status === 'saved') {
      expectationRef.current = { revision: result.snapshot.revision, raw: result.raw }
      setIssue(null)
      publishStatus('durable')
      return true
    }
    if (result.status === 'conflict' || result.status === 'corrupt') {
      setExternal(result.status === 'conflict' ? result.current : result)
      if (result.status === 'corrupt') {
        corruptRawRef.current = result.raw
        setIssue({ kind: 'corrupt', raw: result.raw, message: 'Локальная запись была повреждена вне этой вкладки.' })
      }
      publishStatus('conflict')
      return false
    }
    setIssue({ kind: 'storage', message: storageMessage(result.reason) })
    publishStatus('volatile')
    return false
  }, [publishStatus])

  useEffect(() => {
    if (initialSaveAttemptedRef.current) return
    initialSaveAttemptedRef.current = true
    if (initial.status === 'volatile' && initial.expectation) recordSave(dataRef.current)
  }, [initial, recordSave])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if ((event.key !== null && event.key !== LITE_STORAGE_KEY) || event.storageArea !== storageRef.current) return
      if (event.newValue === expectationRef.current?.raw) return
      const storage = storageRef.current
      if (!storage) return
      setExternal(loadLiteSnapshot(storage))
      publishStatus('conflict')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [publishStatus])

  const updateSection = useCallback(<K extends 'journey' | 'scores' | 'diary' | 'preferences'>(
    capturedEpoch: number,
    key: K,
    next: LiteUpdater<LiteData[K]>,
  ) => {
    if (capturedEpoch !== epochRef.current) return
    const current = dataRef.current
    const value = typeof next === 'function'
      ? (next as (value: LiteData[K]) => LiteData[K])(current[key])
      : next
    const merged = { ...current, [key]: value }
    dataRef.current = merged
    setData(merged)
    recordSave(merged)
  }, [recordSave])

  const callbacks = useMemo(() => {
    const capturedEpoch = sessionEpoch
    return {
      updateJourney: (next: LiteUpdater<JourneyState>) => updateSection(capturedEpoch, 'journey', next),
      updateScores: (next: LiteUpdater<AspectScores>) => updateSection(capturedEpoch, 'scores', next),
      updateDiary: (next: LiteUpdater<DiaryEntry[]>) => updateSection(capturedEpoch, 'diary', next),
      updatePreferences: (next: LiteUpdater<LitePreferences>) => updateSection(capturedEpoch, 'preferences', next),
    }
  }, [sessionEpoch, updateSection])

  const installReplacement = useCallback((next: LiteData) => {
    const cloned = clone(next)
    dataRef.current = cloned
    setData(cloned)
    setExternal(null)
    corruptRawRef.current = null
    setIssue(null)
    const nextEpoch = epochRef.current + 1
    epochRef.current = nextEpoch
    setSessionEpoch(nextEpoch)
    publishStatus('durable')
  }, [publishStatus])

  const replaceData = useCallback((next: LiteData) => {
    const storage = storageRef.current
    if (!storage) return { ok: false as const, message: storageMessage() }
    const corruptRaw = corruptRawRef.current
    let result
    try {
      result = corruptRaw !== null
        ? replaceCorruptLiteSnapshot(storage, next, corruptRaw)
        : expectationRef.current
          ? saveLiteSnapshot(storage, next, expectationRef.current)
          : null
    } catch {
      return { ok: false as const, message: 'Новые данные не прошли проверку. Активные данные оставлены без изменений.' }
    }
    if (!result) return { ok: false as const, message: 'Сначала разрешите конфликт локальных данных.' }
    if (result.status === 'saved') {
      expectationRef.current = { revision: result.snapshot.revision, raw: result.raw }
      installReplacement(result.snapshot.data)
      return { ok: true as const }
    }
    if (result.status === 'conflict' || result.status === 'corrupt') {
      setExternal(result.status === 'conflict' ? result.current : result)
      publishStatus('conflict')
      return { ok: false as const, message: 'Локальные данные изменились в другой вкладке. Сначала разрешите конфликт.' }
    }
    setIssue({ kind: 'storage', message: storageMessage(result.reason) })
    publishStatus('volatile')
    return { ok: false as const, message: 'Запись не выполнена. Активные данные оставлены без изменений.' }
  }, [installReplacement, publishStatus])

  const acceptExternal = useCallback(() => {
    const storage = storageRef.current
    if (!storage) return
    const loaded = loadLiteSnapshot(storage)
    if (loaded.status === 'durable') {
      expectationRef.current = { revision: loaded.snapshot.revision, raw: loaded.raw }
      installReplacement(loaded.snapshot.data)
      return
    }
    if (loaded.status === 'missing') {
      expectationRef.current = { revision: null, raw: null }
      corruptRawRef.current = null
      const defaults = createDefaultLiteData()
      dataRef.current = defaults
      setData(defaults)
      setExternal(null)
      setIssue(null)
      const nextEpoch = epochRef.current + 1
      epochRef.current = nextEpoch
      setSessionEpoch(nextEpoch)
      publishStatus('volatile')
      recordSave(defaults)
      return
    }
    if (loaded.status === 'corrupt') {
      corruptRawRef.current = loaded.raw
      setIssue({ kind: 'corrupt', raw: loaded.raw, message: 'Внешняя локальная запись повреждена.' })
      setExternal(loaded)
    } else {
      setIssue({ kind: 'storage', message: storageMessage() })
    }
    publishStatus('conflict')
  }, [installReplacement, publishStatus, recordSave])

  const exportSnapshot = useCallback(() => createLiteSnapshot(
    clone(dataRef.current),
    expectationRef.current?.revision ?? 0,
  ), [])

  return {
    data,
    status,
    sessionEpoch,
    issue,
    externalStatus: external?.status ?? null,
    ...callbacks,
    replaceData,
    resetData: () => replaceData(createDefaultLiteData()),
    acceptExternal,
    exportSnapshot,
    corruptRaw: corruptRawRef.current,
  }
}
