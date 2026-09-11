import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

export function LiteApp() {
  return (
    <main
      data-runtime="lite"
      style={{
        boxSizing: 'border-box',
        minHeight: '100vh',
        padding: 'clamp(2rem, 8vw, 6rem)',
        background: '#0a0a1a',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <p style={{ color: '#9aa3b2', margin: 0 }}>Локальная временная версия</p>
      <h1 style={{ marginBlock: '0.5rem 1rem' }}>Соционика — Колесо Баланса</h1>
      <p style={{ maxWidth: '42rem', lineHeight: 1.6 }}>
        Локальная оболочка подготовлена. Путешествие, материалы и сохранение будут подключены на следующих этапах.
      </p>
    </main>
  )
}

export function mountLiteApp(): void {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Root element #root not found in index.html')
  createRoot(rootEl).render(
    <StrictMode>
      <LiteApp />
    </StrictMode>,
  )
}
