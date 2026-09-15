import { defineConfig } from '@playwright/test'

const externalLiteURL = process.env.LITE_TEST_BASE_URL?.trim()
const liteURL = externalLiteURL || 'http://127.0.0.1:4174/slw/'

export default defineConfig({
  testDir: './tests/lite',
  testMatch: '**/*.spec.ts',
  use: {
    baseURL: liteURL,
  },
  webServer: externalLiteURL ? undefined : {
    command: 'npm.cmd run build && npm.cmd run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: liteURL,
    reuseExistingServer: false,
  },
})
