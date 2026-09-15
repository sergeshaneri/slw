import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { installNetworkAudit, type NetworkAudit } from './fixtures/network'
import { makeSnapshot } from './fixtures/storage'

const KEY = 'slw_lite_v1_state'
const legacyBytes = {
  whl_scores: '{"БС":13}',
  whl_diary: '[{"text":"legacy"}]',
  whl_journey: '{"revision":"0007"}',
  slw_token: 'legacy.jwt.bytes==',
  slw_dev_admin: '1',
  'hint_journey-chat-intro': '1',
  slw_send_key_mode: 'ctrl+enter',
} as const

function snapshotRaw(revision = 1, mode: 'enter' | 'ctrl+enter' = 'enter'): string {
  const snapshot = makeSnapshot(revision)
  snapshot.data.preferences.sendKeyMode = mode
  return JSON.stringify(snapshot)
}

async function seed(page: Page, raw: string): Promise<void> {
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
  }, { key: KEY, value: raw })
}

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Настройки', exact: true })).toBeVisible()
}

function expectNoNetwork(audit: NetworkAudit): void {
  expect(audit.apiAttempts).toEqual([])
  expect(audit.sdkAttempts).toEqual([])
  expect(audit.backendWebSockets).toEqual([])
}

async function downloadedJson(page: Page): Promise<{ format: string; data: Record<string, unknown> }> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Экспортировать текущие данные' }).click()
  const download = await downloadPromise
  return JSON.parse(await readFile(await download.path() as string, 'utf8')) as { format: string; data: Record<string, unknown> }
}

test.describe.configure({ mode: 'serial' })

test('clean start writes only the lite snapshot and reloads preferences', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.goto('./')
  await openSettings(page)
  await expect(page.locator('[data-session-status="durable"]')).toBeVisible()

  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([KEY])
  const initial = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) as string, KEY))
  expect(initial.revision).toBe(1)
  expect(initial.data.scores).toEqual({ Te: 5, Ti: 5, Fe: 5, Fi: 5, Se: 5, Si: 5, Ne: 5, Ni: 5 })

  await page.getByLabel('Ctrl/Cmd + Enter').check()
  const saved = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) as string, KEY))
  expect(saved.revision).toBe(2)
  expect(saved.data.preferences.sendKeyMode).toBe('ctrl+enter')

  await page.reload()
  await openSettings(page)
  await expect(page.getByLabel('Ctrl/Cmd + Enter')).toBeChecked()
  await expect(page.locator('[data-session-epoch="0"]')).toBeVisible()
  expectNoNetwork(audit)
})

test('real upload previews, cancel preserves bytes, confirm imports and reload retains full data', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  const original = snapshotRaw(4, 'enter')
  const imported = makeSnapshot(30)
  imported.data.preferences.sendKeyMode = 'ctrl+enter'
  await seed(page, original)
  await page.goto('./')
  await openSettings(page)

  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  await expect(page.getByRole('region', { name: 'Подтвердить импорт' })).toContainText('полностью заменит')
  await page.getByRole('button', { name: 'Отмена' }).click()
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(original)
  await expect(page.getByLabel('Enter', { exact: true })).toBeChecked()

  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await expect(page.getByRole('status')).toContainText('Импорт завершён')
  await expect(page.locator('[data-session-epoch="1"]')).toBeVisible()

  await page.reload()
  await openSettings(page)
  await expect(page.getByLabel('Ctrl/Cmd + Enter')).toBeChecked()
  const exported = await downloadedJson(page)
  expect(exported.format).toBe('slw-lite')
  expect(exported.data).toEqual(imported.data)
  expect(JSON.stringify(exported)).not.toContain('slw_token')
  expectNoNetwork(audit)
})

test('invalid and quota-failed imports preserve active memory and durable bytes', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  const original = snapshotRaw(7, 'enter')
  const imported = makeSnapshot(8)
  imported.data.preferences.sendKeyMode = 'ctrl+enter'
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    const originalSet = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, next: string) {
      if (name === key) throw new DOMException('full', 'QuotaExceededError')
      return originalSet.call(this, name, next)
    }
  }, { key: KEY, value: original })
  await page.goto('./')
  await openSettings(page)

  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"wrong"}'),
  })
  await expect(page.getByRole('status')).toContainText('Импорт отклонён')
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(original)

  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await expect(page.getByRole('status')).toContainText('Активные данные оставлены')
  await expect(page.getByLabel('Enter', { exact: true })).toBeChecked()
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(original)
  const exported = await downloadedJson(page)
  expect((exported.data.preferences as { sendKeyMode: string }).sendKeyMode).toBe('enter')
  expectNoNetwork(audit)
})


test('security-failed import preserves active memory and durable bytes', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  const original = snapshotRaw(11, 'enter')
  const imported = makeSnapshot(12)
  imported.data.preferences.sendKeyMode = 'ctrl+enter'
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    const originalSet = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, next: string) {
      if (name === key) throw new DOMException('denied', 'SecurityError')
      return originalSet.call(this, name, next)
    }
  }, { key: KEY, value: original })
  await page.goto('./')
  await openSettings(page)
  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'security.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await expect(page.getByRole('status')).toContainText('Активные данные оставлены')
  await expect(page.getByLabel('Enter', { exact: true })).toBeChecked()
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(original)
  expectNoNetwork(audit)
})

test('localStorage SecurityError leaves an explicit volatile session', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('denied', 'SecurityError') },
    })
  })
  await page.goto('./')
  await openSettings(page)
  await expect(page.locator('[data-session-status="volatile"]')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('запретил доступ')
  await page.getByLabel('Ctrl/Cmd + Enter').check()
  await expect(page.getByLabel('Ctrl/Cmd + Enter')).toBeChecked()
  const exported = await downloadedJson(page)
  expect((exported.data.preferences as { sendKeyMode: string }).sendKeyMode).toBe('ctrl+enter')
  expectNoNetwork(audit)
})

test('empty corrupt raw is preserved, separately downloadable, and replaced only after confirmed reset', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  const corrupt = ''
  await seed(page, corrupt)
  await page.goto('./')
  await openSettings(page)
  await expect(page.getByRole('alert')).toContainText('повреждена')
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(corrupt)

  const rawDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать повреждённую запись' }).click()
  const rawFile = await rawDownload
  expect(await readFile(await rawFile.path() as string, 'utf8')).toBe(corrupt)

  await page.getByRole('button', { name: 'Сбросить локальные данные' }).click()
  await page.getByRole('button', { name: 'Отмена' }).click()
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(corrupt)

  await page.getByRole('button', { name: 'Сбросить локальные данные' }).click()
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await expect(page.locator('[data-session-epoch="1"]')).toBeVisible()
  const reset = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) as string, KEY))
  expect(reset.revision).toBe(1)
  expect(reset.data.diary).toEqual([])
  expect(reset.data.preferences).toEqual({})
  expectNoNetwork(audit)
})

test('storage event exposes conflict, keeps own export, and accepts external state', async ({ context }) => {
  const raw = snapshotRaw(2, 'enter')
  const first = await context.newPage()
  const second = await context.newPage()
  const firstAudit = await installNetworkAudit(first)
  const secondAudit = await installNetworkAudit(second)
  await seed(first, raw)
  await first.goto('./')
  await second.goto('./')
  await openSettings(first)
  await openSettings(second)
  await second.getByLabel('Ctrl/Cmd + Enter').check()

  await expect(first.locator('[data-session-status="conflict"]')).toBeVisible()
  const ownExport = await downloadedJson(first)
  expect((ownExport.data.preferences as { sendKeyMode: string }).sendKeyMode).toBe('enter')
  await first.getByRole('button', { name: 'Принять внешние данные' }).click()
  await expect(first.getByLabel('Ctrl/Cmd + Enter')).toBeChecked()
  await expect(first.locator('[data-session-epoch="1"]')).toBeVisible()
  expectNoNetwork(firstAudit)
  expectNoNetwork(secondAudit)
})

test('read-before-save detects a changed revision without a storage event', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page, snapshotRaw(3, 'enter'))
  await page.goto('./')
  await openSettings(page)
  await expect(page.locator('[data-send-key-mode="enter"]')).toBeVisible()
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: KEY, raw: snapshotRaw(9, 'ctrl+enter') })
  await page.getByLabel('Ctrl/Cmd + Enter').click()
  await expect(page.locator('[data-send-key-mode="ctrl+enter"]')).toBeVisible()
  await expect(page.locator('[data-session-status="conflict"]')).toBeVisible()
  const stored = JSON.parse(await page.evaluate((key) => localStorage.getItem(key) as string, KEY))
  expect(stored.revision).toBe(9)
  expectNoNetwork(audit)
})

test('serialization failure makes the session volatile and blocks export', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  const original = snapshotRaw(5, 'enter')
  await seed(page, original)
  await page.goto('./')
  await openSettings(page)
  await expect(page.locator('[data-session-status="durable"]')).toBeVisible()
  await page.evaluate(() => {
    JSON.stringify = () => { throw new TypeError('serialization failed') }
  })
  await expect(page.locator('[data-send-key-mode="enter"]')).toBeVisible()
  await page.getByLabel('Ctrl/Cmd + Enter').click()
  await expect(page.locator('[data-send-key-mode="ctrl+enter"]')).toBeVisible()
  await expect(page.locator('[data-session-status="volatile"]')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('не прошли проверку')
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(original)
  await page.getByRole('button', { name: 'Экспортировать текущие данные' }).click()
  await expect(page.getByRole('status')).toContainText('Экспорт не выполнен')
  expectNoNetwork(audit)
})

test('clear in another page is surfaced as a storage conflict', async ({ context }) => {
  const first = await context.newPage()
  const second = await context.newPage()
  const firstAudit = await installNetworkAudit(first)
  const secondAudit = await installNetworkAudit(second)
  await seed(first, '')
  await first.goto('./')
  await second.goto('./')
  await openSettings(first)
  await openSettings(second)
  await expect(first.getByRole('alert')).toContainText('повреждена')
  await first.waitForTimeout(100)
  await second.evaluate(() => localStorage.clear())
  await expect(first.locator('[data-session-status="conflict"]')).toBeVisible()
  await first.getByRole('button', { name: 'Принять внешние данные' }).click()
  await expect(first.locator('[data-session-status="durable"]')).toBeVisible()
  await first.getByLabel('Файл импорта').setInputFiles({
    name: 'after-clear.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSnapshot(3))),
  })
  await first.getByRole('button', { name: 'Подтвердить замену' }).click()
  await expect(first.getByRole('status')).toContainText('Импорт завершён')
  expectNoNetwork(firstAudit)
  expectNoNetwork(secondAudit)
})
test('preferences, import, and reset leave all legacy keys byte-identical', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.addInitScript(({ key, raw, legacy }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw)
    for (const [name, value] of Object.entries(legacy)) localStorage.setItem(name, value)
  }, { key: KEY, raw: snapshotRaw(2, 'enter'), legacy: legacyBytes })
  await page.goto('./')
  await openSettings(page)

  const assertLegacy = async () => {
    expect(await page.evaluate((legacy) =>
      Object.fromEntries(Object.keys(legacy).map((key) => [key, localStorage.getItem(key)])),
    legacyBytes)).toEqual(legacyBytes)
  }

  await page.getByLabel('Ctrl/Cmd + Enter').check()
  await assertLegacy()

  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(makeSnapshot(10))),
  })
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await assertLegacy()

  await page.getByRole('button', { name: 'Сбросить локальные данные' }).click()
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await assertLegacy()
  expectNoNetwork(audit)
})
