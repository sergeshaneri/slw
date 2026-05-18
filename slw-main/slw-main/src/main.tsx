import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { bootstrapTMA, isTMA } from './tma'
import { applyTmaTheme, listenTmaTheme } from './tma/hooks'
import './index.css'

// Wrapper around localStorage used by some host environments that bridge
// async storage APIs into window.storage. Keeps the same Promise shape as
// before the TS migration — value is returned wrapped in `{ value }` to
// match the existing contract that consumers (if any) rely on.
type StorageBridge = {
  get: (key: string) => Promise<{ value: string } | null>
  set: (key: string, value: string) => Promise<void>
}

declare global {
  interface Window {
    storage?: StorageBridge
  }
}

// Initialize localStorage wrapper
window.storage = {
  get: async (key: string) => {
    try {
      const value = localStorage.getItem(key)
      return value ? { value } : null
    } catch (e) {
      console.error('Storage get error:', e)
      return null
    }
  },
  set: async (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.error('Storage set error:', e)
    }
  },
}

function mount(): void {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Root element #root not found in index.html')
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Внутри Telegram Mini App: сначала обмениваем initData на JWT, потом мaунтим.
// useAuth дальше увидит токен в localStorage и пройдёт fetchMe() при mount.
// Вне Telegram bootstrapTMA() — no-op (вернёт null сразу), маунтим как обычно.
if (isTMA) {
  // Помечаем body для возможных CSS-стилей (например, скрыть header-меню).
  document.body.classList.add('tma')
  // Синхронизируем тему TG → CSS vars (--tg-bg, --tg-text, --tg-button, ...).
  applyTmaTheme()
  listenTmaTheme()
  bootstrapTMA().finally(mount)
} else {
  mount()
}
