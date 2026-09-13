import { expect, test, type Page } from '@playwright/test'
import { installNetworkAudit, type NetworkAudit } from './fixtures/network'
import { makeSnapshot } from './fixtures/storage'

const KEY = 'slw_lite_v1_state'

function gameSnapshot(scriptId: string, index: number) {
  const snapshot = makeSnapshot(1)
  snapshot.data.journey = {
    currentAspect: 'Si',
    aspects: {
      Si: {
        currentLevel: 0,
        currentScriptIndex: index,
        currentScriptId: scriptId,
        awaitingInput: null,
        messages: [{ id: `card-${scriptId}`, role: 'bot', kind: 'script', scriptId, level: 0 }],
        completedScripts: [],
        pendingTasks: [],
      },
    },
    skills: {},
    activeSurvey: null,
    skillDetailId: null,
    xp: 0,
    stardust: 0,
    streak: 0,
    totalCompleted: 0,
    lastActiveDate: null,
    screen: 'chat',
    onboardingStep: 6,
    contentVersion: 27,
  }
  snapshot.data.diary = []
  snapshot.data.scores = { Te: 5, Ti: 5, Fe: 5, Fi: 5, Se: 5, Si: 5, Ne: 5, Ni: 5 }
  snapshot.data.preferences = { sendKeyMode: 'enter', hintsSeen: { 'journey-chat-intro': true } }
  return snapshot
}

async function seed(page: Page, snapshot: ReturnType<typeof gameSnapshot>) {
  await page.addInitScript(({ key, raw }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, raw) }, {
    key: KEY,
    raw: JSON.stringify(snapshot),
  })
}

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) as string), KEY)
}

function expectNoNetwork(audit: NetworkAudit) {
  expect(audit.apiAttempts).toEqual([])
  expect(audit.sdkAttempts).toEqual([])
  expect(audit.backendWebSockets).toEqual([])
}

test.describe.configure({ mode: 'serial' })

async function setSurveyScore(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'Оценка' })
  await slider.focus()
  await slider.press('Home')
  for (let current = 1; current < value; current += 1) await slider.press('ArrowRight')
  await expect(slider).toHaveValue(String(value))
}
test('theory insight and numeric answer persist once under real double-click and reload', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page, gameSnapshot('T-1', 0))
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()

  const next = page.getByRole('button', { name: 'Далее', exact: true })
  await expect(next).toBeVisible({ timeout: 15_000 })
  await next.dblclick()
  const insight = page.getByPlaceholder('Что задело? С чем согласен или нет?')
  await insight.fill('Первый проверяемый инсайт')
  await page.getByRole('button', { name: 'Сохранить и продолжить' }).dblclick()

  const answer = page.getByRole('button', { name: /Ответить · 5\/10/ })
  await expect(answer).toBeVisible()
  await answer.dblclick()

  await expect.poll(async () => {
    const value = await stored(page)
    return {
      xp: value.data.journey.xp,
      completed: value.data.journey.aspects.Si.completedScripts,
      answers: value.data.journey.skills['body-listening']?.answers?.knowledge,
      diarySources: value.data.diary.map((entry: { source: string }) => entry.source),
      current: value.data.journey.aspects.Si.currentScriptId,
    }
  }).toEqual({
    xp: 10,
    completed: ['T-1', 'B-1'],
    answers: [5],
    diarySources: ['journey-step-insight'],
    current: 'B-2',
  })

  await page.reload()
  await page.getByRole('button', { name: 'Путешествие' }).click()
  await expect(page.getByRole('button', { name: /Ответить · 5\/10/ })).toBeVisible({ timeout: 15_000 })
  const reloaded = await stored(page)
  expect(reloaded.data.journey.xp).toBe(10)
  expect(reloaded.data.journey.skills['body-listening'].answers.knowledge).toEqual([5])
  expect(reloaded.data.diary).toHaveLength(1)
  expectNoNetwork(audit)
})
test('exercise becomes one local task and completion awards once under double-click', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page, gameSnapshot('U-1', 6))
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()

  const take = page.getByRole('button', { name: '🪐 Взять в активные задания' })
  await expect(take).toBeVisible({ timeout: 15_000 })
  await take.dblclick()
  const tasks = page.getByRole('button', { name: 'Активные задания', exact: true })
  await expect(tasks).toBeVisible()
  await expect.poll(async () => (await stored(page)).data.journey.aspects.Si.pendingTasks.length).toBe(1)
  await tasks.click()

  await page.getByRole('button', { name: 'Выполнить + записать' }).click()
  await page.getByPlaceholder('Что заметил во время выполнения, какие ощущения, инсайты…').fill('Задание выполнено один раз')
  await page.getByRole('button', { name: 'Сохранить и закрыть' }).dblclick()

  await expect.poll(async () => {
    const value = await stored(page)
    return {
      xp: value.data.journey.xp,
      completed: value.data.journey.aspects.Si.completedScripts,
      pending: value.data.journey.aspects.Si.pendingTasks,
      diary: value.data.diary.map((entry: { source: string; scriptId?: string }) => ({ source: entry.source, scriptId: entry.scriptId })),
    }
  }).toEqual({
    xp: 15,
    completed: ['U-1'],
    pending: [],
    diary: [{ source: 'journey', scriptId: 'U-1' }],
  })

  await page.reload()
  const reloaded = await stored(page)
  expect(reloaded.data.journey.xp).toBe(15)
  expect(reloaded.data.diary).toHaveLength(1)
  expectNoNetwork(audit)
})
function surveySnapshot() {
  const snapshot = gameSnapshot('T-1', 0)
  snapshot.data.journey.screen = 'survey'
  snapshot.data.journey.activeSurvey = {
    scriptId: 'SURV-2',
    skillId: 'signals',
    mode: 'short',
    startPass: 1,
    stepIndex: 0,
    answers: {},
  }
  return snapshot
}

test('survey keeps draft across navigation, rejects dblclick skip, completes five answers and reloads', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  const legacy = { survey_insight_hint_dismissed: '1', slw_send_key_mode: 'ctrl+enter', slw_dev_admin: '1' }
  await page.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  }, legacy)
  await seed(page, surveySnapshot())
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()

  await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Больше не показывать' }).click()
  await page.getByRole('button', { name: 'Записать инсайт' }).click()
  const statementInsight = page.getByPlaceholder('Что приходит в голову по этому утверждению?')
  await statementInsight.fill('Черновик утверждения сохраняется')
  await page.getByRole('button', { name: 'Дневник' }).click()
  await expect(page.getByRole('heading', { name: 'Дневник' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Путешествие' }).click()
  await expect(statementInsight).toHaveValue('Черновик утверждения сохраняется')

  await setSurveyScore(page, 7)
  await page.getByRole('button', { name: 'Дальше →' }).dblclick()
  await expect.poll(async () => (await stored(page)).data.journey.activeSurvey.stepIndex).toBe(1)

  for (let index = 2; index <= 5; index += 1) {
    await expect(page.getByText(new RegExp(`${index} из 5`))).toBeVisible()
    await setSurveyScore(page, 7)
    await page.getByRole('button', { name: 'Дальше →' }).click()
  }

  const finalInsight = page.getByPlaceholder('Любая мысль — что заметил, какие ассоциации, что хочешь поменять…')
  await expect(finalInsight).toBeVisible()
  await finalInsight.fill('Итоговый инсайт анкеты')
  await page.getByRole('button', { name: /^Сохранить/ }).dblclick()

  await expect.poll(async () => {
    const value = await stored(page)
    const answers = value.data.journey.skills.signals?.answers ?? {}
    return {
      xp: value.data.journey.xp,
      score: value.data.scores.Si,
      passes: value.data.journey.skills.signals?.passes,
      answerCount: Object.values(answers).flat().length,
      diarySources: value.data.diary.map((entry: { source: string }) => entry.source).sort(),
      hint: value.data.preferences.hintsSeen?.survey_insight_hint_dismissed,
    }
  }).toEqual({
    xp: 10,
    score: 7,
    passes: 1,
    answerCount: 5,
    diarySources: ['journey-survey', 'journey-survey-statement'],
    hint: true,
  })

  expect(await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(legacy))).toEqual(legacy)
  await page.reload()
  const reloaded = await stored(page)
  expect(reloaded.data.journey.skills.signals.passes).toBe(1)
  expect(reloaded.data.scores.Si).toBe(7)
  expect(reloaded.data.diary).toHaveLength(2)
  expectNoNetwork(audit)
})
test('confirmed import remounts mounted journey once and cancels its delayed completion', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page, gameSnapshot('T-1', 0))
  const fixture = makeSnapshot(40)
  const imported = gameSnapshot('B-2', 2)
  imported.revision = fixture.revision
  imported.updatedAt = fixture.updatedAt
  imported.data.journey.xp = 120
  imported.data.journey.aspects.Si.awaitingInput = 'number'
  imported.data.diary = fixture.data.diary
  imported.data.preferences.hintsSeen = { 'journey-chat-intro': true }
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()

  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await page.getByPlaceholder('Что задело? С чем согласен или нет?').fill('Старый отложенный инсайт')
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
  expect((await stored(page)).data.journey.aspects.Si.completedScripts).toEqual([])
  await page.getByRole('button', { name: 'Настройки' }).click()

  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'mounted-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await expect(page.getByRole('status')).toContainText('Импорт завершён')
  await expect(page.locator('[data-session-epoch="1"]')).toBeVisible()
  await page.getByRole('button', { name: 'Путешествие' }).click()
  await expect(page.getByRole('button', { name: /Ответить · 5\/10/ })).toBeVisible()
  await page.clock.runFor(1_500)

  const value = await stored(page)
  expect(value.data).toEqual(imported.data)
  expect(value.data.journey.xp).toBe(120)
  expect(value.data.diary).toHaveLength(3)
  await expect(page.locator('[data-session-epoch="2"]')).toHaveCount(0)
  expectNoNetwork(audit)
})
test('navigation merges a concurrent diary entry and planet switch cancels old bot continuation', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page, gameSnapshot('T-1', 0))
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()

  await page.getByRole('button', { name: 'Далее', exact: true }).click()
  await page.getByPlaceholder('Что задело? С чем согласен или нет?').fill('Инсайт сохраняется параллельно')
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
  expect((await stored(page)).data.journey.aspects.Si.completedScripts).toEqual([])
  await page.getByRole('button', { name: 'Дневник' }).click()
  await page.getByPlaceholder('Запишите наблюдения, инсайты, прогресс, красные флаги, которые заметили...').fill('Параллельная ручная запись')
  await page.getByRole('button', { name: 'Записать', exact: true }).click()
  await page.clock.runFor(1_500)

  await expect.poll(async () => (await stored(page)).data.diary.map((entry: { source: string }) => entry.source).sort()).toEqual(['journey-step-insight', 'manual'])
  await page.getByRole('button', { name: 'Путешествие' }).click()
  const answer = page.getByRole('button', { name: /Ответить · 5\/10/ })
  await expect(answer).toBeVisible()
  await answer.click()
  expect((await stored(page)).data.journey.skills['body-listening']).toBeUndefined()
  await page.getByRole('button', { name: 'Сменить планету' }).click()
  await page.getByRole('button', { name: /БЛ.*Белая Логика/ }).click()

  await expect.poll(async () => (await stored(page)).data.journey.currentAspect).toBe('Ti')
  await page.clock.runFor(1_500)
  await expect(page.getByText(/Это вторая планета — Structura Mentalis/)).toBeVisible()
  const switched = await stored(page)
  expect(switched.data.journey.xp).toBe(5)
  expect(switched.data.journey.skills['body-listening']).toBeUndefined()
  await expect(page.getByRole('button', { name: 'Сменить планету' })).toBeVisible()
  await page.getByRole('button', { name: 'Сменить планету' }).click()
  await page.getByRole('button', { name: /БС.*Белая Сенсорика/ }).click()
  await expect.poll(async () => (await stored(page)).data.journey.currentAspect).toBe('Si')
  await expect(page.getByRole('button', { name: /Ответить · 5\/10/ })).toBeVisible()
  expectNoNetwork(audit)
})