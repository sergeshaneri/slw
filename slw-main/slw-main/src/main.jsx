import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
