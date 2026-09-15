import { expect, test, type Page } from '@playwright/test'
import { installNetworkAudit, type NetworkAudit } from './fixtures/network'

const KEY = 'slw_lite_v1_state'
const HALL_COUNTS = {
  Ne: { quotes: 80, figures: 20, arts: 102, archetypes: 4, interestingFacts: 90 },
  Si: { quotes: 54, figures: 20, arts: 80, archetypes: 4, interestingFacts: 61 },
  Fi: { quotes: 15, figures: 18, arts: 37, archetypes: 4, interestingFacts: 0 },
  Ti: { quotes: 100, figures: 28, arts: 101, archetypes: 4, interestingFacts: 85 },
  Ni: { quotes: 70, figures: 20, arts: 89, archetypes: 4, interestingFacts: 90 },
  Se: { quotes: 80, figures: 22, arts: 115, archetypes: 4, interestingFacts: 91 },
  Fe: { quotes: 50, figures: 20, arts: 80, archetypes: 4, interestingFacts: 60 },
  Te: { quotes: 80, figures: 20, arts: 80, archetypes: 4, interestingFacts: 72 },
} as const

function expectNoNetwork(audit: NetworkAudit): void {
  expect(audit.apiAttempts).toEqual([])
  expect(audit.sdkAttempts).toEqual([])
  expect(audit.backendWebSockets).toEqual([])
}

async function expectUnavailable(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Временно недоступно в локальной версии' })).toBeVisible()
  await expect(page.getByText('Локально работают учебные материалы, путешествие, анкеты, дневник и сохранение в этом браузере.')).toBeVisible()
}

test('desktop home exposes local routes and every server menu direction uses one inert stub', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Продолжить путешествие' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Каталог Все существующие материалы и уровни без изменения прогресса' })).toBeVisible()
  await expect(page.getByText('Войти', { exact: true })).toHaveCount(0)
  await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0)
  const before = await page.evaluate(key => localStorage.getItem(key), KEY)

  const serverItems = [
    ['Сообщество', 'community'], ['ИИ-коуч', 'coach'], ['Сообщения', 'messages'], ['Профиль', 'profile'],
    ['Реакции', 'likes'], ['Подписки', 'follows'], ['Чат холла', 'hall-chat'], ['Вопросы и ответы холла', 'hall-qa'],
    ['Публикации холла', 'hall-publications'], ['Трекер привычек', 'habit-tracker'], ['Эмоции дневника', 'diary-emotions'],
    ['Тренировки дневника', 'diary-trainings'], ['Аналитические отчёты', 'analytics-reports'], ['Vault Sync', 'vault-sync'],
    ['Защита серии', 'streak-protection'], ['Бонус слова дня', 'word-bonus'], ['Рейтинг и достижения', 'leaderboard'],
    ['Уведомления', 'notifications'], ['Поиск по серверу', 'server-search'], ['Администрирование', 'admin'],
    ['Поддержка', 'support'], ['Вход и аккаунт', 'account'],
  ] as const
  for (const [label, feature] of serverItems) {
    await page.locator('summary').filter({ hasText: 'Серверные функции' }).click()
    await page.locator('details').getByRole('button', { name: label, exact: true }).click()
    await expectUnavailable(page)
    await expect(page.locator('[data-unavailable-feature]')).toHaveAttribute('data-unavailable-feature', feature)
    await page.getByRole('button', { name: 'К локальным материалам' }).click()
    await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  }
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(before)
  expectNoNetwork(audit)
})

test('mobile keeps back and settings reachable; keyboard and browser back restore local routes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const audit = await installNetworkAudit(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Настройки и перенос' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()

  await page.getByRole('button', { name: 'Каталог', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Каталог учебных материалов' })).toBeVisible()
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await page.getByRole('button', { name: 'Аспекты', exact: true }).click()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('region', { name: 'Аспекты', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  expectNoNetwork(audit)
})

test('auth, public profile, admin and old unknown deeplinks never mount online screens', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.addInitScript(() => {
    localStorage.setItem('slw_token', 'legacy-token')
    localStorage.setItem('slw_dev_admin', '1')
    const calls = { ready: 0, expand: 0, backShow: 0 }
    Object.defineProperty(window, '__liteTmaCalls', { value: calls })
    Object.defineProperty(window, 'Telegram', { configurable: true, value: { WebApp: { initData: 'fake', initDataUnsafe: { start_param: 'admin' }, ready: () => { calls.ready += 1 }, expand: () => { calls.expand += 1 }, BackButton: { show: () => { calls.backShow += 1 }, hide: () => {}, onClick: () => {}, offClick: () => {} } } } })
  })
  await page.goto('./?keep=1&token=x&reset_token=reset&auth=login#section&tgAuthResult=e30%3D')
  await expectUnavailable(page)
  await expect(page).toHaveURL(/\?keep=1#section$/)
  await page.getByRole('button', { name: 'К локальным материалам' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await expect(page.locator('[data-unavailable-feature="account"]')).toHaveCount(0)

  for (const path of ['./?u=42', './?view=admin', './?view=community']) {
    await page.goto(path)
    await expectUnavailable(page)
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.locator('[data-runtime="lite"]')).not.toContainText(/Admin Panel|Загрузка профиля|Загрузка сообщества/)
  }
  await page.goto('./?view=admin')
  await expectUnavailable(page)
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await page.goto('./?view=old-removed-route')
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await expect(page.getByText('Маршрут «old-removed-route» отсутствует в локальной версии. Открыта главная.')).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { __liteTmaCalls: Record<string, number> }).__liteTmaCalls)).toEqual({ ready: 0, expand: 0, backShow: 0 })
  expect(await page.evaluate(() => localStorage.getItem('slw_dev_admin'))).toBe('1')
  expectNoNetwork(audit)
})

test('the local hall reader renders every static HALL_CONTENT item for all eight aspects', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Аспекты', exact: true }).click()
  await page.getByRole('button').filter({ hasText: 'БС' }).first().click()
  await page.getByRole('button', { name: /Известные личности/ }).click()
  await page.getByRole('button', { name: /Открыть в Холле/ }).click()
  await expect(page.locator('[data-hall-aspect="Si"]')).toBeVisible()
  await expect.poll(async () => (await page.locator('#lite-hall-figures').boundingBox())?.y ?? 1000).toBeLessThan(250)

  for (const [aspect, sections] of Object.entries(HALL_COUNTS)) {
    await page.goto(`./?view=hall&aspect=${aspect}#reader-state`)
    await expect(page.locator(`[data-hall-aspect="${aspect}"]`)).toBeVisible()
    const hashBeforeSectionJump = await page.evaluate(() => location.hash)
    await page.getByRole('navigation', { name: 'Разделы статической коллекции' }).getByRole('button').first().click()
    expect(await page.evaluate(() => location.hash)).toBe(hashBeforeSectionJump)
    for (const [section, count] of Object.entries(sections)) {
      const block = page.locator(`[data-hall-section="${section}"]`)
      await expect(block).toHaveAttribute('data-item-count', String(count))
      await expect(block.locator('li')).toHaveCount(count)
    }
    const snapshot = JSON.parse(await page.evaluate(key => localStorage.getItem(key) as string, KEY))
    expect(snapshot.data.journey.xp).toBe(0)
    expect(snapshot.data.journey.stardust).toBe(0)
    const beforeStub = await page.evaluate(key => localStorage.getItem(key), KEY)
    const hallActions = aspect === 'Ne'
      ? [['Чат холла', 'hall-chat'], ['Вопросы и ответы', 'hall-qa'], ['Пользовательские публикации', 'hall-publications']] as const
      : [['Чат холла', 'hall-chat']] as const
    for (const [action, feature] of hallActions) {
      await page.getByRole('button', { name: action, exact: true }).click()
      await expectUnavailable(page)
      await expect(page.locator('[data-unavailable-feature]')).toHaveAttribute('data-unavailable-feature', feature)
      expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(beforeStub)
      if (action !== hallActions.at(-1)?.[0]) {
        await page.getByRole('button', { name: 'Вернуться назад' }).click()
        await expect(page.locator(`[data-hall-aspect="${aspect}"]`)).toBeVisible()
      }
    }
  }
  expectNoNetwork(audit)
})
