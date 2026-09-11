import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../App'
import { bootstrapTMA, isTMA } from '../tma'
import { applyTmaTheme, listenTmaTheme } from '../tma/hooks'

type StorageBridge = {
  get: (key: string) => Promise<{ value: string } | null>
  set: (key: string, value: string) => Promise<void>
}

declare global {
  interface Window {
    storage?: StorageBridge
  }
}

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

if (isTMA) {
  document.body.classList.add('tma')
  applyTmaTheme()
  listenTmaTheme()
  bootstrapTMA().finally(mount)
} else {
  mount()
}
