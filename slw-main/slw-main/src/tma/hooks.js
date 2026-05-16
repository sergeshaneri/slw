/**
 * React-хуки для нативных элементов Telegram Mini App.
 *
 * Вне TMA все хуки — no-op: useEffect с проверкой isTMA в начале возвращается
 * сразу. Компонент рендерится одинаково в обоих режимах.
 *
 * MainButton удалён по решению юзера (нативная синяя плашка TG не вписывается
 * в премиум-дизайн с цветами аспектов). Веб-кнопки используются везде.
 * BackButton + Haptic оставлены — не визуальные элементы.
 */
import { useEffect, useRef } from 'react'
import { tma, isTMA } from './index'

// ── Координация владения BackButton между компонентами ─────────────────────
// Аналогично MainButton (теперь удалён): при unmount шедулим hide через 50мс,
// при mount cancel. Это избегает race-condition на iOS Telegram между
// последовательными hide() + show() в одном кадре.
let pendingBackHide = null
function scheduleBackHide() {
  if (pendingBackHide) return
  pendingBackHide = setTimeout(() => {
    pendingBackHide = null
    try { tma?.BackButton?.hide() } catch { /* */ }
  }, 50)
}
function cancelBackHide() {
  if (pendingBackHide) { clearTimeout(pendingBackHide); pendingBackHide = null }
}

/**
 * Telegram BackButton — стрелка ← в шапке TG.
 * Если onClick null/undefined — кнопка скрыта.
 */
export function useBackButton(onClick) {
  const handlerRef = useRef(onClick)
  useEffect(() => { handlerRef.current = onClick }, [onClick])

  // Регистрация click handler — один раз.
  useEffect(() => {
    if (!isTMA) return
    const btn = tma.BackButton
    if (!btn) return
    const trampoline = () => handlerRef.current?.()
    btn.onClick(trampoline)
    return () => { btn.offClick(trampoline) }
  }, [])

  // Управление видимостью — на смену onClick (null/функция).
  useEffect(() => {
    if (!isTMA) return
    const btn = tma.BackButton
    if (!btn) return
    if (onClick) {
      cancelBackHide()
      btn.show()
    } else {
      cancelBackHide()
      btn.hide()
    }
  }, [!!onClick])

  // Hide on unmount — с задержкой.
  useEffect(() => {
    if (!isTMA) return
    return () => { scheduleBackHide() }
  }, [])
}

/**
 * Haptic feedback. Безопасно вызывать вне TMA — будет no-op.
 *
 * @param {('light'|'medium'|'heavy'|'rigid'|'soft')} [kind='light'] — для impactOccurred
 */
export function tmaHaptic(kind = 'light') {
  try {
    tma?.HapticFeedback?.impactOccurred?.(kind)
  } catch { /* старый клиент без HapticFeedback */ }
}

/**
 * Haptic для уведомлений (успех/ошибка/предупреждение). Сильнее обычного impact.
 *
 * @param {('success'|'error'|'warning')} kind
 */
export function tmaNotify(kind) {
  try {
    tma?.HapticFeedback?.notificationOccurred?.(kind)
  } catch { /* старый клиент */ }
}

/**
 * Синхронизирует themeParams Telegram → CSS-переменные на body.
 * Вызвать один раз при старте (например, из main.jsx).
 *
 * Использовать в CSS как `var(--tg-bg)`, `var(--tg-text)`, `var(--tg-button)`.
 * Аспект-цвета (ASPECT_COLORS) не трогаем — у них своя семантика.
 */
export function applyTmaTheme() {
  if (!isTMA) return
  const t = tma?.themeParams
  if (!t) return
  const root = document.documentElement
  const set = (name, value, fallback) => {
    root.style.setProperty(name, value || fallback)
  }
  set('--tg-bg', t.bg_color, '#0a0a1a')
  set('--tg-text', t.text_color, '#FFFFFF')
  set('--tg-hint', t.hint_color, '#9aa3b2')
  set('--tg-link', t.link_color, '#4cc9f0')
  set('--tg-button', t.button_color, '#4cc9f0')
  set('--tg-button-text', t.button_text_color, '#0a0a1a')
  set('--tg-secondary-bg', t.secondary_bg_color, '#15161c')
  document.body.classList.toggle('tg-dark', tma.colorScheme === 'dark')
  document.body.classList.toggle('tg-light', tma.colorScheme === 'light')
}

/**
 * Подписаться на themeChanged. Вызвать один раз при старте.
 * Возвращает unsubscribe (если потребуется).
 */
export function listenTmaTheme() {
  if (!isTMA) return () => {}
  const handler = () => applyTmaTheme()
  tma.onEvent?.('themeChanged', handler)
  return () => tma.offEvent?.('themeChanged', handler)
}
