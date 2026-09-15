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

async function expectUnavailable(page: Page, feature?: string, title?: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Сейчас недоступно', exact: true })).toBeVisible()
  if (feature) await expect(page.locator('[data-unavailable-feature]')).toHaveAttribute('data-unavailable-feature', feature)
  if (title) await expect(page.getByRole('heading', { level: 3, name: title, exact: true })).toBeVisible()
  await expect(page.getByText('Без аккаунта доступны материалы, путешествие, анкеты, дневник и сохранение данных в этом браузере.')).toBeVisible()
}

test('desktop home exposes local routes and every server menu direction uses one inert stub', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Продолжить путешествие' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Каталог Теория, навыки и вопросы по восьми аспектам' })).toBeVisible()
  await expect(page.getByText('Войти', { exact: true })).toHaveCount(0)
  await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0)
  const before = await page.evaluate(key => localStorage.getItem(key), KEY)

  const serverItems = [
    ['Сообщество', 'community', 'Сообщество'], ['ИИ-коуч', 'coach', 'ИИ-коуч'], ['Сообщения', 'messages', 'Личные сообщения'], ['Профиль', 'profile', 'Публичный профиль'],
    ['Реакции', 'likes', 'Реакции и отметки'], ['Подписки', 'follows', 'Подписки'], ['Чат холла', 'hall-chat', 'Чат холла'], ['Вопросы и ответы холла', 'hall-qa', 'Вопросы и ответы холла'],
    ['Публикации холла', 'hall-publications', 'Публикации холла'], ['Трекер привычек', 'habit-tracker', 'Трекер привычек'], ['Эмоции дневника', 'diary-emotions', 'Эмоции дневника'],
    ['Тренировки дневника', 'diary-trainings', 'Тренировки дневника'], ['Аналитические отчёты', 'analytics-reports', 'Аналитические отчёты'], ['Синхронизация данных', 'vault-sync', 'Синхронизация данных'],
    ['Защита серии', 'streak-protection', 'Защита серии'], ['Бонус слова дня', 'word-bonus', 'Бонус слова дня'], ['Рейтинг и достижения', 'leaderboard', 'Рейтинг и достижения'],
    ['Уведомления', 'notifications', 'Уведомления'], ['Поиск людей и публикаций', 'server-search', 'Поиск людей и публикаций'], ['Администрирование', 'admin', 'Администрирование'],
    ['Поддержка', 'support', 'Обращение в поддержку'], ['Вход и аккаунт', 'account', 'Аккаунт и авторизация'],
  ] as const
  for (const [label, feature, title] of serverItems) {
    await page.locator('summary').filter({ hasText: 'Ещё' }).click()
    await page.locator('details').getByRole('button', { name: label, exact: true }).click()
    await expectUnavailable(page, feature, title)
    await page.getByRole('button', { name: 'К материалам' }).click()
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
  await expect(page.getByRole('heading', { name: 'Настройки и данные' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()

  await page.getByRole('button', { name: 'Каталог', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Каталог материалов' })).toBeVisible()
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
  await expectUnavailable(page, 'account', 'Аккаунт и авторизация')
  await expect(page).toHaveURL(/\?keep=1#section$/)
  await page.getByRole('button', { name: 'К материалам' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await expect(page.locator('[data-unavailable-feature="account"]')).toHaveCount(0)

  for (const [path, feature, title] of [
    ['./?u=42', 'profile', 'Публичный профиль'],
    ['./?view=admin', 'admin', 'Администрирование'],
    ['./?view=community', 'community', 'Сообщество'],
  ] as const) {
    await page.goto(path)
    await expectUnavailable(page, feature, title)
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.locator('[data-runtime="lite"]')).not.toContainText(/Admin Panel|Загрузка профиля|Загрузка сообщества/)
  }
  await page.goto('./?view=admin')
  await expectUnavailable(page, 'admin', 'Администрирование')
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await page.goto('./?view=old-removed-route')
  await expect(page.getByRole('heading', { name: 'Соционика: Колесо Баланса' })).toBeVisible()
  await expect(page.getByText('Страница «old-removed-route» не найдена. Открыта главная.')).toBeVisible()
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
      ? [['Чат холла', 'hall-chat', 'Чат холла'], ['Вопросы и ответы', 'hall-qa', 'Вопросы и ответы холла'], ['Пользовательские публикации', 'hall-publications', 'Публикации холла']] as const
      : [['Чат холла', 'hall-chat', 'Чат холла']] as const
    for (const [action, feature, title] of hallActions) {
      await page.getByRole('button', { name: action, exact: true }).click()
      await expectUnavailable(page, feature, title)
      expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(beforeStub)
      if (action !== hallActions.at(-1)?.[0]) {
        await page.getByRole('button', { name: 'Вернуться назад' }).click()
        await expect(page.locator(`[data-hall-aspect="${aspect}"]`)).toBeVisible()
      }
    }
  }
  expectNoNetwork(audit)
})
