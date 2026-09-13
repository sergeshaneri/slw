import { defineConfig } from '@playwright/test'

const liteURL = 'http://127.0.0.1:4174/slw/'

export default defineConfig({
  testDir: './tests/lite',
  testMatch: '**/*.spec.ts',
  use: {
    baseURL: liteURL,
  },
  webServer: {
    command: 'npm.cmd run build && npm.cmd run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: liteURL,
    reuseExistingServer: false,
  },
})
