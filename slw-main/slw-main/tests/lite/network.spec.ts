import { expect, test } from '@playwright/test'
import { installNetworkAudit } from './fixtures/network'

const legacyStorage = {
  whl_scores: '{"БС":13,"ЧИ":21}',
  whl_diary: '[{"text":"старое значение \\u0000 сохраняется"}]',
  whl_journey: '{"currentAspect":"БИ","revision":"0007"}',
  slw_token: 'legacy.jwt.bytes==',
  slw_dev_admin: '1',
  slw_pending_ref: 'REF-OLD',
  welcome_seen: '1',
  'hint_nav-aspects-cta': '1',
} as const

async function advancePastOnlinePolling(page: Parameters<typeof installNetworkAudit>[0]) {
  await page.clock.runFor(61_000)
  await new Promise((resolve) => setTimeout(resolve, 250))
}

test.describe.configure({ mode: 'serial' })

test('clean storage starts lite without API or Telegram SDK', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.clock.install({ time: new Date('2026-09-11T12:00:00Z') })

  await page.goto('./')
  await expect(page.locator('[data-runtime="lite"]')).toBeVisible()
  const absentLegacyValues = await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), Object.keys(legacyStorage))
  expect(absentLegacyValues).toEqual(Object.keys(legacyStorage).map(() => null))
  await advancePastOnlinePolling(page)

  expect(audit.apiAttempts).toEqual([])
  expect(audit.sdkAttempts).toEqual([])
  expect(audit.backendWebSockets).toEqual([])
})

test('legacy storage, auth URL and fake Telegram remain untouched in lite', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
    const calls = { ready: 0, expand: 0, disableVerticalSwipes: 0, backShow: 0 }
    Object.defineProperty(window, '__tmaCalls', { configurable: true, value: calls })
    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      value: {
        WebApp: {
          platform: 'tdesktop',
          initData: 'signed-test-data',
          initDataUnsafe: { start_param: 'server-deeplink' },
          ready: () => { calls.ready += 1 },
          expand: () => { calls.expand += 1 },
          disableVerticalSwipes: () => { calls.disableVerticalSwipes += 1 },
          BackButton: {
            show: () => { calls.backShow += 1 },
            hide: () => {},
            onClick: () => {},
            offClick: () => {},
          },
        },
      },
    })
  }, legacyStorage)
  await page.clock.install({ time: new Date('2026-09-11T12:00:00Z') })

  await page.goto('./?ref=REF-URL&token=URL-TOKEN&reset_token=reset-token-1234567890#tgAuthResult=e30%3D')
  await expect(page.locator('[data-runtime="lite"]')).toBeVisible()
  await advancePastOnlinePolling(page)

  const result = await page.evaluate((keys) => ({
    storage: Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    tmaCalls: (window as Window & { __tmaCalls: Record<string, number> }).__tmaCalls,
    hasStorageBridge: Object.prototype.hasOwnProperty.call(window, 'storage'),
    search: location.search,
    hash: location.hash,
  }), Object.keys(legacyStorage))

  expect(result.storage).toEqual(legacyStorage)
  expect(result.tmaCalls).toEqual({ ready: 0, expand: 0, disableVerticalSwipes: 0, backShow: 0 })
  expect(result.hasStorageBridge).toBe(false)
  expect(result.search).toBe('?ref=REF-URL&token=URL-TOKEN&reset_token=reset-token-1234567890')
  expect(result.hash).toBe('#tgAuthResult=e30%3D')
  expect(audit.apiAttempts).toEqual([])
  expect(audit.sdkAttempts).toEqual([])
  expect(audit.backendWebSockets).toEqual([])
})
