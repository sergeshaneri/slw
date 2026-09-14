import { expect, test, type Page } from '@playwright/test'
import { installNetworkAudit, type NetworkAudit } from './fixtures/network'
import { makeSnapshot } from './fixtures/storage'

const KEY = 'slw_lite_v1_state'

const catalogManifest = [
  { aspect: 'Te', label: 'ЧЛ · Черная Логика', total: 502, counts: [2, 161, 62, 4, 62, 186, 25] },
  { aspect: 'Ti', label: 'БЛ · Белая Логика', total: 388, counts: [2, 152, 41, 4, 41, 123, 25] },
  { aspect: 'Fe', label: 'ЧЭ · Черная Этика', total: 278, counts: [2, 112, 0, 4, 34, 102, 24] },
  { aspect: 'Fi', label: 'БЭ · Белая Этика', total: 370, counts: [2, 108, 0, 4, 58, 174, 24] },
  { aspect: 'Se', label: 'ЧС · Черная Сенсорика', total: 424, counts: [2, 161, 47, 4, 47, 141, 22] },
  { aspect: 'Si', label: 'БС · Белая Сенсорика', total: 406, counts: [2, 121, 51, 4, 51, 153, 24] },
  { aspect: 'Ne', label: 'ЧИ · Черная Интуиция', total: 286, counts: [2, 112, 0, 4, 36, 108, 24] },
  { aspect: 'Ni', label: 'БИ · Белая Интуиция', total: 314, counts: [2, 112, 0, 4, 43, 129, 24] },
] as const

const catalogKinds = [
  'journey-intro',
  'journey-core',
  'journey-survey',
  'journey-complete',
  'skill-intro',
  'skill-level',
  'aspect-block',
] as const

function zeroSnapshot() {
  const snapshot = makeSnapshot(1)
  snapshot.data.journey = {
    currentAspect: 'Si',
    aspects: {
      Si: {
        currentLevel: 0,
        currentScriptIndex: 0,
        currentScriptId: 'T-1',
        awaitingInput: null,
        messages: [{ id: 'card-T-1', role: 'bot', kind: 'script', scriptId: 'T-1', level: 0 }],
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
  snapshot.data.scores = { Te: 5, Ti: 5, Fe: 5, Fi: 5, Se: 5, Si: 5, Ne: 5, Ni: 5 }
  snapshot.data.diary = []
  snapshot.data.history = []
  snapshot.data.preferences = {
    sendKeyMode: 'enter',
    hintsSeen: {
      'journey-chat-intro': true,
      'journey-planets-btn': true,
      'skill-tree-intro': true,
      'aspects-grid-intro': true,
      survey_insight_hint_dismissed: true,
    },
  }
  return snapshot
}

function surveyDraftSnapshot() {
  const snapshot = zeroSnapshot()
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

async function seed(page: Page, snapshot = zeroSnapshot()) {
  await page.addInitScript(({ key, raw }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw)
  }, { key: KEY, raw: JSON.stringify(snapshot) })
}

async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) as string), KEY)
}

function expectNoNetwork(audit: NetworkAudit) {
  expect(audit.apiAttempts).toEqual([])
  expect(audit.sdkAttempts).toEqual([])
  expect(audit.backendWebSockets).toEqual([])
}

async function setSurveyScore(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'Оценка' })
  await slider.focus()
  await slider.press('Home')
  for (let current = 1; current < value; current += 1) await slider.press('ArrowRight')
  await expect(slider).toHaveValue(String(value))
}

async function openAspectTree(page: Page, aspectCard: RegExp, treeTitle: string) {
  await page.getByRole('button', { name: 'Аспекты' }).click()
  const backToAspects = page.getByRole('button', { name: /ко всем аспектам/ })
  if (await backToAspects.isVisible().catch(() => false)) await backToAspects.click()
  await page.getByRole('button', { name: aspectCard }).click()
  await page.getByRole('button', { name: 'Начать оценивать →' }).click()
  await expect(page.getByText(treeTitle, { exact: true })).toBeVisible({ timeout: 15_000 })
}

test.describe.configure({ mode: 'serial' })

test('catalog exposes the independent 2968-record manifest at zero progress', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Каталог' }).click()
  await expect(page.getByTestId('content-catalog')).toBeVisible({ timeout: 15_000 })

  expect(catalogManifest.reduce((sum, item) => sum + item.total, 0)).toBe(2968)
  const kindSelect = page.getByLabel('Класс материала')
  for (const item of catalogManifest) {
    await page.getByRole('button', { name: item.label, exact: true }).click()
    await expect(page.getByText(`${item.total} материалов`, { exact: true })).toBeVisible()

    for (const [index, kind] of catalogKinds.entries()) {
      await kindSelect.selectOption(kind)
      await expect(page.getByTestId('content-catalog').getByRole('status')).toHaveText(`Найдено: ${item.counts[index]}`)
      await expect(page.locator(`[data-material-kind="${kind}"] [data-material-id]`)).toHaveCount(item.counts[index])
    }

    await kindSelect.selectOption('journey-core')
    for (const level of [0, 1, 2, 3]) {
      await expect(page.locator(`[data-material-id="${item.aspect}:${level}:journey-core:T-1"]`)).toHaveCount(1)
    }
  }

  expectNoNetwork(audit)
})

test('catalog reading preserves progression and a note survives reload', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  const snapshot = zeroSnapshot()
  snapshot.data.journey.xp = 37
  snapshot.data.journey.stardust = 4
  snapshot.data.journey.skills.signals = {
    id: 'signals', answers: { knowledge: [6] }, blocks: { knowledge: 6 }, passes: 1, result: 6,
  }
  snapshot.data.journey.aspects.Si.completedScripts = ['T-0']
  snapshot.data.scores.Si = 6
  await seed(page, snapshot)
  await page.goto('./')
  const before = await stored(page)

  await page.getByRole('button', { name: 'Каталог' }).click()
  await page.getByRole('button', { name: 'БЛ · Белая Логика', exact: true }).click()
  await page.getByLabel('Класс материала').selectOption('skill-intro')
  await page.getByPlaceholder('Название или ID').fill('manipulation-detection')
  await page.locator('[data-material-id="Ti:all:skill-intro:manipulation-detection"]').click()
  await expect(page.getByRole('heading', { name: 'Распознавание манипулятивных приёмов' })).toBeVisible()
  await expect(page.getByText(/Архетип: Аналитик · роль: вспомогательный/)).toBeVisible()
  await expect(page.getByText(/archetype:|role:/i)).toHaveCount(0)

  const afterRead = await stored(page)
  expect(afterRead.data.journey).toEqual(before.data.journey)
  expect(afterRead.data.scores).toEqual(before.data.scores)
  expect(afterRead.data.diary).toEqual(before.data.diary)

  await page.getByPlaceholder('Запишите наблюдение к материалу').fill('Заметка к точному источнику БЛ')
  await page.getByRole('button', { name: 'Сохранить в дневник' }).click()
  await expect.poll(async () => (await stored(page)).data.diary.length).toBe(1)
  const afterNote = await stored(page)
  expect(afterNote.data.journey).toEqual(before.data.journey)
  expect(afterNote.data.scores).toEqual(before.data.scores)
  expect(afterNote.data.diary[0]).toMatchObject({
    aspect: 'Ti', source: 'manual', skillId: 'manipulation-detection', text: 'Заметка к точному источнику БЛ',
  })

  await page.reload()
  await page.getByRole('button', { name: 'Дневник' }).click()
  await expect(page.getByText('Заметка к точному источнику БЛ', { exact: true })).toBeVisible({ timeout: 15_000 })
  expectNoNetwork(audit)
})

test('catalog renders representatives of all seven kinds and keeps aspect-block identity', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Каталог' }).click()
  await expect(page.getByTestId('content-catalog')).toBeVisible({ timeout: 15_000 })

  const representatives = [
    { kind: 'journey-intro', id: 'Te:all:journey-intro:te-intro-1', title: 'Введение te-1', text: 'Это планета — Praxis Effectus' },
    { kind: 'journey-core', id: 'Te:0:journey-core:T-1', title: 'Внутренний Мастер', text: 'Соционика выделяет в психике 8 информационных функций' },
    { kind: 'journey-survey', id: 'Te:0:journey-survey:SURV-210', title: 'Прагматическое мышление', text: 'Анкета по навыку ЧЛ: 15 утверждений' },
    { kind: 'journey-complete', id: 'Te:0:journey-complete:complete', title: 'Завершение уровня 0', text: 'Уровень 0 пройден. Это была разведка' },
    { kind: 'skill-intro', id: 'Te:all:skill-intro:work-vs-busyness', title: 'Различение работы и суеты', text: 'Способность отличить реальный труд' },
    { kind: 'skill-level', id: 'Te:1:skill-level:work-vs-busyness', title: 'Различение работы и суеты · уровень 1', text: 'Ученик впервые отделяет в течение дня' },
  ] as const

  for (const representative of representatives) {
    await page.getByLabel('Класс материала').selectOption(representative.kind)
    await page.locator(`[data-material-id="${representative.id}"]`).click()
    await expect(page.getByRole('heading', { name: representative.title })).toBeVisible()
    await expect(page.getByText(representative.text, { exact: false }).first()).toBeVisible()
    if (representative.kind === 'skill-level') {
      await expect(page.getByRole('heading', { name: 'Что развиваешь' })).toBeVisible()
    }
    await page.getByRole('button', { name: '← К каталогу', exact: true }).click()
  }

  await page.getByLabel('Класс материала').selectOption('aspect-block')
  await page.locator('[data-material-id="Te:0:aspect-block:essence"]').click()
  await expect(page.locator('[data-material-id="Te:0:aspect-block:essence"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Суть аспекта' }).first()).toBeVisible()
  await expect(page.getByText('О чём этот аспект в одном абзаце.', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Запишите наблюдение к материалу')).toHaveCount(0)

  await page.getByRole('button', { name: /следующий.*Тени и дары/ }).click()
  await expect(page.locator('[data-material-id="Te:0:aspect-block:archetypes"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Тени и дары' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Защиты универсальных навыков', exact: true }).click()
  await expect(page.locator('[data-material-id="Te:0:aspect-block:teSkillBlocksCore"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Защиты универсальных навыков' }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Записать заметку' }).click()
  await page.getByPlaceholder('Что отзывается, что хочется попробовать, какие ассоциации…').fill('Заметка к текущему блоку ЧЛ')
  await page.getByRole('button', { name: 'В дневник' }).click()
  await expect.poll(async () => (await stored(page)).data.diary[0]).toMatchObject({
    aspect: 'Te',
    source: 'aspect',
    blockId: 'teSkillBlocksCore',
    blockTitle: 'Защиты универсальных навыков',
    promptTitle: 'Защиты универсальных навыков',
    text: 'Заметка к текущему блоку ЧЛ',
  })

  await page.getByRole('button', { name: /все блоки/ }).click()
  await page.getByRole('button', { name: /Путь становления архетипов/ }).click()
  await expect(page.locator('[data-material-id="Te:1:aspect-block:archetypePath"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Путь становления архетипов' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Записать заметку' }).click()
  await page.getByPlaceholder('Что отзывается, что хочется попробовать, какие ассоциации…').fill('Заметка после перехода через оглавление')
  await page.getByRole('button', { name: 'В дневник' }).click()
  await expect.poll(async () => (await stored(page)).data.diary[0]).toMatchObject({
    aspect: 'Te',
    source: 'aspect',
    blockId: 'archetypePath',
    blockTitle: 'Путь становления архетипов',
    promptTitle: 'Путь становления архетипов',
    text: 'Заметка после перехода через оглавление',
  })
  expectNoNetwork(audit)
})

test('catalog keeps its cursor and survey draft; wheel navigation preserves epoch', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page, surveyDraftSnapshot())
  await page.goto('./')
  const epoch = await page.locator('[data-runtime="lite"]').getAttribute('data-session-epoch')

  await page.getByRole('button', { name: 'Путешествие' }).click()
  await page.getByRole('button', { name: 'Записать инсайт' }).click()
  const insight = page.getByPlaceholder('Что приходит в голову по этому утверждению?')
  await insight.fill('Черновик остаётся при свободном чтении')
  await page.getByRole('button', { name: 'Каталог' }).click()
  await page.getByRole('button', { name: 'БЛ · Белая Логика', exact: true }).click()
  await page.getByLabel('Класс материала').selectOption('journey-core')
  await page.locator('[data-material-id="Ti:3:journey-core:T-1"]').click()
  await expect(page.getByRole('heading', { name: 'Тень БЛ' })).toBeVisible()
  expect((await stored(page)).data.journey.currentAspect).toBe('Si')

  await page.getByRole('button', { name: 'Путешествие' }).click()
  await expect(insight).toHaveValue('Черновик остаётся при свободном чтении')
  await page.getByRole('button', { name: 'Каталог' }).click()
  await expect(page.getByRole('heading', { name: 'Тень БЛ' })).toBeVisible()

  await openAspectTree(page, /БЛ.*Белая Логика/, 'Навыки БЛ')
  await expect.poll(async () => {
    const value = await stored(page)
    return {
      aspect: value.data.journey.currentAspect,
      activeSurvey: value.data.journey.activeSurvey,
      draft: value.data.journey.skills.signals?.draft,
    }
  }).toEqual({
    aspect: 'Ti',
    activeSurvey: null,
    draft: { mode: 'short', startPass: 1, stepIndex: 0, answers: {} },
  })
  await expect(page.locator(`[data-session-epoch="${epoch}"]`)).toBeVisible()
  expectNoNetwork(audit)
})

test('all eight aspect wheels dispatch the matching navigation request at zero progress', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()

  const wheels = [
    { aspect: 'Te', card: /ЧЛ.*Черная Логика/, title: 'Навыки ЧЛ' },
    { aspect: 'Ti', card: /БЛ.*Белая Логика/, title: 'Навыки БЛ' },
    { aspect: 'Fe', card: /ЧЭ.*Черная Этика/, title: 'Навыки ЧЭ' },
    { aspect: 'Fi', card: /БЭ.*Белая Этика/, title: 'Навыки БЭ' },
    { aspect: 'Se', card: /ЧС.*Черная Сенсорика/, title: 'Навыки ЧС' },
    { aspect: 'Si', card: /БС.*Белая Сенсорика/, title: 'Навыки БС' },
    { aspect: 'Ne', card: /ЧИ.*Черная Интуиция/, title: 'Навыки ЧИ' },
    { aspect: 'Ni', card: /БИ.*Белая Интуиция/, title: 'Навыки БИ' },
  ] as const

  for (const wheel of wheels) {
    await openAspectTree(page, wheel.card, wheel.title)
    await expect.poll(async () => (await stored(page)).data.journey.currentAspect).toBe(wheel.aspect)
  }

  const value = await stored(page)
  expect(value.data.journey.xp).toBe(0)
  expect(value.data.journey.skills).toEqual({})
  expect(value.data.scores).toEqual({ Te: 5, Ti: 5, Fe: 5, Fi: 5, Se: 5, Si: 5, Ne: 5, Ni: 5 })
  await expect(page.locator('[data-session-epoch="0"]')).toBeVisible()
  expectNoNetwork(audit)
})

test('an import remount ignores a navigation request from the previous session epoch', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()
  await openAspectTree(page, /БЛ.*Белая Логика/, 'Навыки БЛ')
  await expect.poll(async () => (await stored(page)).data.journey.currentAspect).toBe('Ti')

  const imported = zeroSnapshot()
  imported.revision = 40
  imported.updatedAt = '2026-09-14T18:00:00.000Z'
  imported.data.journey.currentAspect = 'Se'
  imported.data.journey.aspects.Se = {
    currentLevel: 0,
    currentScriptIndex: 0,
    currentScriptId: 'T-1',
    awaitingInput: null,
    messages: [{ id: 'se-card-T-1', role: 'bot', kind: 'script', scriptId: 'T-1', level: 0 }],
    completedScripts: [],
    pendingTasks: [],
  }

  await page.getByRole('button', { name: 'Настройки' }).click()
  await page.getByLabel('Файл импорта').setInputFiles({
    name: 'epoch-replacement.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })
  await page.getByRole('button', { name: 'Подтвердить замену' }).click()
  await expect(page.getByText('Импорт завершён и сохранён.', { exact: true })).toBeVisible()
  await expect(page.locator('[data-session-epoch="1"]')).toBeVisible()
  await expect(page.locator('[data-session-epoch="2"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Путешествие' }).click()
  await expect(page.getByRole('button', { name: 'Сменить планету' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Навыки БЛ', { exact: true })).toHaveCount(0)
  await new Promise(resolve => setTimeout(resolve, 500))
  const value = await stored(page)
  expect(value.data).toEqual(imported.data)
  expect(value.data.journey.currentAspect).toBe('Se')
  expect(value.data.journey.screen).toBe('chat')
  expectNoNetwork(audit)
})

test('zero-progress Ti detail, traits and real survey use the Ti collision source', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()
  await openAspectTree(page, /БЛ.*Белая Логика/, 'Навыки БЛ')
  await page.getByRole('button', { name: /Аналитик/ }).click()

  await page.getByRole('button', { name: 'Детальный разбор: Распознавание манипулятивных приёмов' }).click()
  await expect(page.getByText('Как развить: Распознавание манипулятивных приёмов', { exact: true })).toBeVisible()
  for (const level of [1, 2, 3]) await expect(page.getByText(`Уровень ${level}`, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('закрыт', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Какие психологические черты это развивает/ }).click()
  await expect(page.getByText('Психологические черты: Распознавание манипулятивных приёмов', { exact: true })).toBeVisible()
  await expect(page.getByText('Что развиваешь', { exact: true })).toHaveCount(3)

  await page.getByRole('button', { name: 'Назад к развитию навыка' }).click()
  await page.getByRole('button', { name: 'Назад к навыкам' }).click()
  await page.getByRole('button', { name: /Аналитик/ }).click()
  await page.getByRole('button', { name: /Распознавание манипулятивных приёмов.*оценить/ }).click()
  await expect(page.getByText('Распознавание манипулятивных приёмов', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Короткая анкета/ }).click()
  await expect(page.getByText('Я знаю 6 принципов влияния Чалдини (взаимность, обязательство, социальное доказательство, симпатия, авторитет, дефицит) и узнаю их работу в коммуникации.', { exact: true })).toBeVisible()
  expect((await stored(page)).data.journey.currentAspect).toBe('Ti')

  for (let index = 1; index <= 5; index += 1) {
    await expect(page.getByText(new RegExp(`${index} из 5`))).toBeVisible()
    await setSurveyScore(page, 7)
    await page.getByRole('button', { name: 'Дальше →' }).click()
  }
  const finalInsight = page.getByPlaceholder('Любая мысль — что заметил, какие ассоциации, что хочешь поменять…')
  await finalInsight.fill('Результат точной анкеты БЛ')
  await page.getByRole('button', { name: 'Сохранить и узнать, как развить →' }).click()
  await expect(page.getByText('Как развить: Распознавание манипулятивных приёмов', { exact: true })).toBeVisible()
  const completed = await stored(page)
  expect(completed.data.journey.currentAspect).toBe('Ti')
  expect(completed.data.journey.skills['manipulation-detection'].passes).toBe(1)
  expect(completed.data.scores.Ti).toBe(7)
  expectNoNetwork(audit)
})

test('zero-progress Se collision opens the Se title and first statement', async ({ page }) => {
  const audit = await installNetworkAudit(page)
  await seed(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Путешествие' }).click()
  await openAspectTree(page, /ЧС.*Черная Сенсорика/, 'Навыки ЧС')
  await page.getByRole('button', { name: /Строитель/ }).click()
  await page.getByRole('button', { name: /Завершение.*оценить/ }).click()
  await expect(page.getByText('Завершение', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Короткая анкета/ }).click()
  await expect(page.getByText('Я знаю, что завершение Строителя — это доведение до состояния, в котором результат стоит без меня, в отличие от ЧЛ-завершения работы (выполнить и закрыть задачу).', { exact: true })).toBeVisible()
  expect((await stored(page)).data.journey.currentAspect).toBe('Se')
  expectNoNetwork(audit)
})
