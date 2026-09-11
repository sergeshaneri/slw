import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const legacyValues = new Map<string, string>([
  ['slw_token', 'legacy-token'],
  ['slw_pending_ref', 'legacy-ref'],
])

function installStorageProbe() {
  const calls: string[] = []
  const storage = {
    getItem: vi.fn((key: string) => {
      calls.push('get:' + key)
      return legacyValues.get(key) ?? null
    }),
    setItem: vi.fn((key: string) => { calls.push('set:' + key) }),
    removeItem: vi.fn((key: string) => { calls.push('remove:' + key) }),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  return { calls, storage }
}

describe('runtime selection', () => {
  it('uses lite for default Vite modes and only online for the explicit mode', async () => {
    const { resolveRuntimeMode, runtimeMode, backendEnabled } = await import('@/config/runtime')

    expect(resolveRuntimeMode('development')).toBe('lite')
    expect(resolveRuntimeMode('production')).toBe('lite')
    expect(resolveRuntimeMode('test')).toBe('lite')
    expect(resolveRuntimeMode('online')).toBe('online')
    expect(runtimeMode).toBe('lite')
    expect(backendEnabled).toBe(false)
  })
})

describe('lite transport guards', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(globalThis, 'window')
    Reflect.deleteProperty(globalThis, 'localStorage')
    Reflect.deleteProperty(globalThis, 'fetch')
  })

  it('rejects request, ZIP, token and registration paths before storage or fetch', async () => {
    const { calls } = installStorageProbe()
    const fetchSpy = vi.fn()
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchSpy })

    const api = await import('@/api/client')
    const failures = [
      api.fetchMe(),
      api.downloadVaultZip(),
      api.register('test@example.invalid', 'password'),
    ]

    for (const failure of failures) {
      await expect(failure).rejects.toBeInstanceOf(api.BackendUnavailableError)
    }
    expect(() => api.getToken()).toThrow(api.BackendUnavailableError)
    expect(() => api.setToken('replacement')).toThrow(api.BackendUnavailableError)
    expect(() => api.logout()).toThrow(api.BackendUnavailableError)
    expect(calls).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('keeps TMA bootstrap inert before SDK, token and fetch effects', async () => {
    const { calls } = installStorageProbe()
    const fetchSpy = vi.fn()
    const ready = vi.fn()
    const expand = vi.fn()
    const disableVerticalSwipes = vi.fn()
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchSpy })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        Telegram: {
          WebApp: {
            platform: 'tdesktop',
            initData: 'signed-data',
            ready,
            expand,
            disableVerticalSwipes,
          },
        },
      },
    })

    const tma = await import('@/tma')
    expect(tma.isTMA).toBe(false)
    expect(tma.hasInitData).toBe(false)
    expect(tma.getStartParam()).toBeNull()
    await expect(tma.bootstrapTMA()).resolves.toBeNull()
    expect(calls).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(ready).not.toHaveBeenCalled()
    expect(expand).not.toHaveBeenCalled()
    expect(disableVerticalSwipes).not.toHaveBeenCalled()
  })
})
