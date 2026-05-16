import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { bootstrapTMA, isTMA } from './tma'
import { applyTmaTheme, listenTmaTheme } from './tma/hooks'
import './index.css'

// Initialize localStorage wrapper
window.storage = {
  get: async (key) => {
    try {
      const value = localStorage.getItem(key)
      return value ? { value } : null
    } catch (e) {
      console.error('Storage get error:', e)
      return null
    }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.error('Storage set error:', e)
    }
  }
}

function mount() {
  createRoot(document.getElementById('root')).render(
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
