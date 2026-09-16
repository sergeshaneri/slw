import { test, expect } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'
import path from 'node:path'
let server: ViteDevServer
let url: string
test.beforeAll(async () => {
  server = await createServer({ configFile: false, root: process.cwd(), resolve: { alias: { '@': path.resolve('src') } }, esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port: 0 }, appType: 'mpa' })
  await server.listen()
  const address = server.httpServer!.address() as { port: number }
  url = `http://127.0.0.1:${address.port}/tests/lite/fixtures/wheel.html`
})
test.afterAll(async () => { await server?.close() })
test('live session scores animate nodes, paths, labels and summary together; interruption and reduced motion', async ({ page }) => {
  await page.goto(url)
  await expect(page.locator('[data-score="0"]').first()).toHaveText('5,0')
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  const initial = await page.locator('[data-membrane="surface"]').getAttribute('d')
  await page.locator('#update').click()
  await page.clock.runFor(320)
  const y = Number(await page.locator('[data-node="0"]').first().getAttribute('cy'))
  expect(y).toBeGreaterThan(320 - 222 * .9)
  expect(y).toBeLessThan(320 - 222 * .5)
  const score = (320 - y) / 22.2
  expect(Number((await page.locator('[data-score="0"]').first().textContent())!.replace(',', '.'))).toBeCloseTo(score, 1)
  expect(Number((await page.locator('[data-average]').first().textContent())!.replace(',', '.'))).toBeCloseTo((score + 35) / 8, 1)
  expect(await page.locator('[data-membrane="surface"]').getAttribute('d')).not.toBe(initial)
  expect(await page.locator('[data-membrane="glow"]').getAttribute('d')).toBe(await page.locator('[data-membrane="surface"]').getAttribute('d'))
  expect(Number(await page.locator('[data-membrane="trail"]').evaluate(el => getComputedStyle(el).opacity))).toBeGreaterThan(0)
  await page.locator('[data-axis]').first().focus()
  await page.locator('#scores').fill('2,5,5,5,5,5,5,5')
  await page.locator('#update').click()
  expect(Number(await page.locator('[data-node="0"]').first().getAttribute('cy'))).toBeCloseTo(y, 5)
  await page.clock.runFor(800)
  await expect(page.locator('[data-score="0"]').first()).toHaveText('2,0')
  await expect(page.locator('[data-average]').first()).toHaveText('4,6')
  await expect(page.locator('[data-membrane="trail"]')).toHaveCSS('opacity', '0')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('#scores').fill('10,5,5,5,5,5,5,5')
  await page.locator('#update').click()
  await expect(page.locator('[data-score="0"]').first()).toHaveText('10,0')
  expect(Number(await page.locator('[data-orb="0"]').getAttribute('y')) + 9).toBe(98)
  await expect.poll(() => page.locator('foreignObject img').evaluate((el: HTMLImageElement) => el.currentSrc)).toContain('wheel-core-still')
  expect(Number(await page.locator('[data-node="0"]').first().getAttribute('cy'))).toBe(98)
  const stable = await page.locator('[data-membrane="surface"]').getAttribute('d')
  await page.clock.runFor(1000)
  expect(await page.locator('[data-membrane="surface"]').getAttribute('d')).toBe(stable)
})
for (const [width, height] of [[1920,600], [1920,720], [1680,942], [1440,900], [1280,800], [1024,768], [768,900], [390,844]]) {
  test(`layout ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    await page.goto('./')
    const chart = page.getByRole('img', { name: 'Колесо баланса по восьми аспектам' })
    await expect(chart).toBeVisible()
    const topLabel = (await page.locator('[data-axis]').first().boundingBox())!
    const header = (await page.locator('header').boundingBox())!
    expect(topLabel.y).toBeGreaterThanOrEqual(header.y + header.height)
    expect(topLabel.y + topLabel.height).toBeLessThanOrEqual(height)
    const a = (await chart.boundingBox())!, b = (await page.getByRole('complementary', { name: 'Сводка за сегодня' }).boundingBox())!
    expect(a.x + a.width <= b.x + 1 || a.y + a.height <= b.y + 1).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.locator('[data-axis]').first().focus()
    await expect(page.locator('[data-axis]').first()).toBeFocused()
    await page.screenshot({ path: info.outputPath(`wheel-${width}.png`), fullPage: true })
  })
}


test('all visual fixtures use session data for each node and both averages', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(url)
  const fixtures = { equal: [6,6,6,6,6,6,6,6], high: [9,3,3,3,3,3,3,3], low: [1,8,8,8,8,8,8,8], alternating: [10,1,10,1,10,1,10,1], random: [7.2,3.1,8.8,4.3,6.1,2.4,9.2,5.7] }
  for (const [name, scores] of Object.entries(fixtures)) {
    await page.locator('#scores').fill(scores.join(','))
    await page.locator('#update').click()
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 4
      const node = page.locator(`[data-node="${i}"]`).first()
      expect(Number(await node.getAttribute('cx'))).toBeCloseTo(320 + 22.2 * scores[i] * Math.cos(a), 7)
      expect(Number(await node.getAttribute('cy'))).toBeCloseTo(320 + 22.2 * scores[i] * Math.sin(a), 7)
    }
    for (const label of await page.locator('[data-average]').all()) {
      expect(await label.textContent()).toBe((scores.reduce((a,b) => a+b, 0) / 8).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
    }
    await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: true })
  }
})


test('reduced transparency keeps the summary opaque', async ({ page }) => {
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
  await page.goto('./')
  const summary = page.getByRole('complementary', { name: 'Сводка за сегодня' })
  await expect(summary).toHaveCSS('background-image', 'none')
  await expect(summary).toHaveCSS('background-color', 'rgb(23, 35, 62)')
  await expect(summary).toHaveCSS('backdrop-filter', 'none')
})
