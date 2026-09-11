import type { Page, Request } from '@playwright/test'

export type NetworkAudit = {
  apiAttempts: string[]
  sdkAttempts: string[]
  backendWebSockets: string[]
}

function isApiAttempt(request: Request): boolean {
  const url = new URL(request.url())
  return url.hostname === 'backend.invalid' || /\/api(?:\/|$)/.test(url.pathname)
}

export async function installNetworkAudit(page: Page): Promise<NetworkAudit> {
  const audit: NetworkAudit = {
    apiAttempts: [],
    sdkAttempts: [],
    backendWebSockets: [],
  }

  page.on('request', (request) => {
    if (isApiAttempt(request)) audit.apiAttempts.push(request.method() + ' ' + request.url())
    if (request.url().startsWith('https://telegram.org/js/telegram-web-app.js')) {
      audit.sdkAttempts.push(request.url())
    }
  })
  page.on('websocket', (socket) => {
    const url = new URL(socket.url())
    if (url.hostname === 'backend.invalid' || /\/api(?:\/|$)/.test(url.pathname)) {
      audit.backendWebSockets.push(socket.url())
    }
  })

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = request.url()
    if (
      isApiAttempt(request)
      || url.startsWith('https://telegram.org/js/telegram-web-app.js')
      || url.startsWith('https://fonts.googleapis.com/')
      || url.startsWith('https://fonts.gstatic.com/')
    ) {
      await route.abort()
      return
    }
    await route.continue()
  })

  return audit
}
