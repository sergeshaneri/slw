import { runtimeMode } from './config/runtime'
import './index.css'

const TELEGRAM_SDK_URL = 'https://telegram.org/js/telegram-web-app.js?56'

async function loadTelegramSdk(): Promise<void> {
  if (window.Telegram?.WebApp) return

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TELEGRAM_SDK_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Telegram WebApp SDK failed to load'))
    document.head.appendChild(script)
  })
}

async function start(): Promise<void> {
  if (runtimeMode === 'online') {
    try {
      await loadTelegramSdk()
    } catch (error) {
      console.warn('Telegram WebApp SDK unavailable:', error)
    }
    await import('./bootstrap/online')
    return
  }

  const { mountLiteApp } = await import('./lite/LiteApp')
  mountLiteApp()
}

void start()
