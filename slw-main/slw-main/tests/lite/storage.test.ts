import { describe, expect, it } from 'vitest'
import type { LiteSnapshot } from '@/types/storage'
import {
  LITE_STORAGE_KEY,
  expectationFromLoad,
  loadLiteSnapshot,
  replaceCorruptLiteSnapshot,
  saveLiteSnapshot,
  type LiteStorageLike,
} from '@/utils/liteStorage'
import {
  LiteValidationError,
  parseLiteSnapshot,
  serializeLiteSnapshot,
  validateLiteSnapshot,
} from '@/utils/liteTransfer'
import { makeLiteData, makeSnapshot } from './fixtures/storage'

class MemoryStorage implements LiteStorageLike {
  readonly values = new Map<string, string>()
  getError: unknown = null
  setError: unknown = null
  getCalls = 0
  setCalls = 0
  readonly getKeys: string[] = []

  getItem(key: string): string | null {
    this.getCalls += 1
    this.getKeys.push(key)
    if (this.getError) throw this.getError
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.setCalls += 1
    if (this.setError) throw this.setError
    this.values.set(key, value)
  }

  seed(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function errorNamed(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

function invalidAt(mutator: (snapshot: Record<string, unknown>) => void): void {
  const snapshot = makeSnapshot() as unknown as Record<string, unknown>
  mutator(snapshot)
  expect(() => validateLiteSnapshot(snapshot)).toThrow(LiteValidationError)
}

describe('lite transfer', () => {
  it('roundtrips actual payloads and normalizes sparse answers to JSON null', () => {
    const snapshot = makeSnapshot(7)
    const raw = serializeLiteSnapshot(snapshot)
    const restored = parseLiteSnapshot(raw)

    expect(restored).toEqual(JSON.parse(JSON.stringify(snapshot)))
    const answers = restored.data.journey.activeSurvey?.answers?.knowledge
    expect(answers).toEqual([8, null, 6])
    expect(restored.data.diary[0]?.survey?.blockAvgs?.practice).toBeNull()
    expect(restored.data.diary[0]?.survey?.skillAvg).toBeNull()
  })

  it('accepts modern activeSurvey fields as well as legacy Si indices', () => {
    const legacy = makeSnapshot()
    expect(validateLiteSnapshot(legacy).data.journey.activeSurvey?.blockIndex).toBe(1)

    const modern = makeSnapshot()
    modern.data.journey.activeSurvey = {
      scriptId: 'survey-interoception',
      skillId: 'interoception',
      mode: 'short',
      startPass: 2,
      stepIndex: 4,
      answers: { knowledge: [8, null, 6] },
    }
    expect(validateLiteSnapshot(modern).data.journey.activeSurvey?.stepIndex).toBe(4)
  })

  it('rejects invalid JSON and unknown schema versions', () => {
    expect(() => parseLiteSnapshot('{broken')).toThrow(/невалидный JSON/)
    const snapshot = makeSnapshot() as unknown as { schemaVersion: number }
    snapshot.schemaVersion = 2
    expect(() => validateLiteSnapshot(snapshot)).toThrow(/неподдерживаемая версия/)
  })

  it('rejects unknown nested fields and unavailable admin state', () => {
    invalidAt(snapshot => {
      const data = snapshot.data as Record<string, unknown>
      const diary = (data.diary as Array<Record<string, unknown>>)[0]
      if (diary) diary.executable = 'payload'
    })
    invalidAt(snapshot => {
      const journey = (snapshot.data as Record<string, unknown>).journey as Record<string, unknown>
      journey.screen = 'admin-skills'
    })
    invalidAt(snapshot => {
      const journey = (snapshot.data as Record<string, unknown>).journey as Record<string, unknown>
      const skills = journey.skills as Record<string, unknown>
      skills._admin = { id: '_admin' }
    })
  })

  it('rejects unknown aspect/map keys and prototype keys', () => {
    invalidAt(snapshot => {
      const scores = (snapshot.data as Record<string, unknown>).scores as Record<string, unknown>
      scores.Che = 7
    })
    const raw = serializeLiteSnapshot(makeSnapshot()).replace(
      '"hintsSeen":{"journey-chat-intro":true}',
      '"hintsSeen":{"__proto__":true}',
    )
    expect(() => parseLiteSnapshot(raw)).toThrow(/недопустимый ключ/)
  })

  it('rejects fractional survey answers but permits finite fractional averages', () => {
    invalidAt(snapshot => {
      const journey = (snapshot.data as Record<string, unknown>).journey as Record<string, unknown>
      const active = journey.activeSurvey as Record<string, unknown>
      active.answers = { knowledge: [7.5] }
    })
    const snapshot = makeSnapshot()
    const skill = snapshot.data.journey.skills.interoception
    if (skill) skill.result = 7.5
    expect(validateLiteSnapshot(snapshot).data.journey.skills.interoception?.result).toBe(7.5)
  })

  it('rejects invalid score/counter/onboarding bounds and non-empty unknown history', () => {
    invalidAt(snapshot => {
      const data = snapshot.data as Record<string, unknown>
      data.scores = { Si: 7.5 }
    })
    invalidAt(snapshot => {
      const journey = (snapshot.data as Record<string, unknown>).journey as Record<string, unknown>
      journey.onboardingStep = 7
    })
    invalidAt(snapshot => {
      const journey = (snapshot.data as Record<string, unknown>).journey as Record<string, unknown>
      journey.xp = -1
    })
    invalidAt(snapshot => {
      const data = snapshot.data as Record<string, unknown>
      data.history = [{ kind: 'undefined-format' }]
    })
  })

  it('clones validated input instead of retaining mutable object references', () => {
    const source = makeSnapshot()
    const clone = validateLiteSnapshot(source)
    source.data.preferences.sendKeyMode = 'enter'
    expect(clone.data.preferences.sendKeyMode).toBe('ctrl+enter')
  })
})

describe('lite storage', () => {
  it('loads missing and durable snapshots and writes only the single lite key', () => {
    const storage = new MemoryStorage()
    const legacy = {
      whl_state: '{"legacy":true}',
      slw_token: 'token-bytes',
      slw_dev_admin: '1',
      slw_send_key_mode: 'enter',
      'hint_journey-chat-intro': '1',
    }
    for (const [key, value] of Object.entries(legacy)) storage.seed(key, value)

    const missing = loadLiteSnapshot(storage)
    expect(missing).toEqual({ status: 'missing', raw: null })
    const expected = expectationFromLoad(missing)
    expect(expected).not.toBeNull()
    const saved = saveLiteSnapshot(storage, makeLiteData(), expected!, '2026-09-11T12:00:00.000Z')

    expect(saved.status).toBe('saved')
    expect(storage.setCalls).toBe(1)
    expect(new Set(storage.getKeys)).toEqual(new Set([LITE_STORAGE_KEY]))
    expect([...storage.values.keys()].filter(key => key === LITE_STORAGE_KEY)).toEqual([LITE_STORAGE_KEY])
    for (const [key, value] of Object.entries(legacy)) expect(storage.values.get(key)).toBe(value)
    const loaded = loadLiteSnapshot(storage)
    expect(loaded.status).toBe('durable')
    if (loaded.status === 'durable') expect(loaded.snapshot.revision).toBe(1)
  })

  it('reports unavailable reads', () => {
    const storage = new MemoryStorage()
    storage.getError = errorNamed('SecurityError')
    const loaded = loadLiteSnapshot(storage)
    expect(loaded.status).toBe('unavailable')
  })

  it.each([
    ['QuotaExceededError', 'quota'],
    ['SecurityError', 'security'],
  ] as const)('preserves prior bytes when %s prevents setItem', (errorName, reason) => {
    const storage = new MemoryStorage()
    const previousRaw = serializeLiteSnapshot(makeSnapshot(4))
    storage.seed(LITE_STORAGE_KEY, previousRaw)
    const loaded = loadLiteSnapshot(storage)
    const expected = expectationFromLoad(loaded)
    expect(expected).not.toBeNull()
    storage.setError = errorNamed(errorName)

    const result = saveLiteSnapshot(storage, makeLiteData(), expected!, '2026-09-11T13:00:00.000Z')

    expect(result).toMatchObject({ status: 'failed', reason })
    expect(storage.values.get(LITE_STORAGE_KEY)).toBe(previousRaw)
  })

  it('blocks a known revision conflict without overwriting the newer snapshot', () => {
    const storage = new MemoryStorage()
    const first = saveLiteSnapshot(storage, makeLiteData(), { revision: null, raw: null }, '2026-09-11T12:00:00.000Z')
    expect(first.status).toBe('saved')
    if (first.status !== 'saved') return

    const second = saveLiteSnapshot(storage, makeLiteData(), { revision: first.snapshot.revision, raw: first.raw }, '2026-09-11T13:00:00.000Z')
    expect(second.status).toBe('saved')
    if (second.status !== 'saved') return

    const stale = saveLiteSnapshot(storage, makeLiteData(), { revision: first.snapshot.revision, raw: first.raw }, '2026-09-11T14:00:00.000Z')
    expect(stale.status).toBe('conflict')
    expect(storage.values.get(LITE_STORAGE_KEY)).toBe(second.raw)
    expect(storage.setCalls).toBe(2)
  })

  it('also detects changed raw bytes when the revision was reused', () => {
    const storage = new MemoryStorage()
    const originalRaw = serializeLiteSnapshot(makeSnapshot(3))
    storage.seed(LITE_STORAGE_KEY, originalRaw)
    const altered = makeSnapshot(3)
    altered.updatedAt = '2026-09-11T13:00:00.000Z'
    const alteredRaw = serializeLiteSnapshot(altered)
    storage.seed(LITE_STORAGE_KEY, alteredRaw)

    const result = saveLiteSnapshot(storage, makeLiteData(), { revision: 3, raw: originalRaw })
    expect(result.status).toBe('conflict')
    expect(storage.values.get(LITE_STORAGE_KEY)).toBe(alteredRaw)
    expect(storage.setCalls).toBe(0)
  })

  it('validates nested data before save or explicit corrupt replacement', () => {
    const storage = new MemoryStorage()
    const previousRaw = serializeLiteSnapshot(makeSnapshot(2))
    storage.seed(LITE_STORAGE_KEY, previousRaw)
    const loaded = loadLiteSnapshot(storage)
    const expected = expectationFromLoad(loaded)
    expect(expected).not.toBeNull()
    const invalid = makeLiteData() as unknown as Record<string, unknown>
    const preferences = invalid.preferences as Record<string, unknown>
    preferences.unknown = true

    expect(() => saveLiteSnapshot(storage, invalid as never, expected!)).toThrow(LiteValidationError)
    expect(storage.values.get(LITE_STORAGE_KEY)).toBe(previousRaw)
    expect(storage.setCalls).toBe(0)

    const corruptRaw = '{bad-json'
    storage.seed(LITE_STORAGE_KEY, corruptRaw)
    expect(() => replaceCorruptLiteSnapshot(storage, invalid as never, corruptRaw)).toThrow(LiteValidationError)
    expect(storage.values.get(LITE_STORAGE_KEY)).toBe(corruptRaw)
    expect(storage.setCalls).toBe(0)
  })
  it('does not rewrite corrupt raw during ordinary save', () => {
    const storage = new MemoryStorage()
    const corruptRaw = '{"format":"slw-lite","schemaVersion":1}'
    storage.seed(LITE_STORAGE_KEY, corruptRaw)

    const loaded = loadLiteSnapshot(storage)
    expect(loaded).toMatchObject({ status: 'corrupt', raw: corruptRaw })
    const result = saveLiteSnapshot(storage, makeLiteData(), { revision: null, raw: corruptRaw })

    expect(result.status).toBe('corrupt')
    expect(storage.values.get(LITE_STORAGE_KEY)).toBe(corruptRaw)
    expect(storage.setCalls).toBe(0)
  })

  it('replaces corrupt raw only through explicit byte-matched API', () => {
    const storage = new MemoryStorage()
    const corruptRaw = '{bad-json'
    storage.seed(LITE_STORAGE_KEY, corruptRaw)

    const stale = replaceCorruptLiteSnapshot(storage, makeLiteData(), '{older}', '2026-09-11T12:00:00.000Z')
    expect(stale.status).toBe('conflict')
    expect(storage.values.get(LITE_STORAGE_KEY)).toBe(corruptRaw)

    const replaced = replaceCorruptLiteSnapshot(storage, makeLiteData(), corruptRaw, '2026-09-11T12:00:00.000Z')
    expect(replaced.status).toBe('saved')
    expect(storage.setCalls).toBe(1)
    const loaded = loadLiteSnapshot(storage)
    expect(loaded.status).toBe('durable')
  })
})
