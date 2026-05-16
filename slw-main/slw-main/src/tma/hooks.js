/**
 * React-хуки для нативных элементов Telegram Mini App.
 *
 * Вне TMA все хуки — no-op: useEffect с проверкой isTMA в начале возвращается
 * сразу. Компонент рендерится одинаково в обоих режимах, никаких ifов в JSX
 * вызывающего кода не нужно (только продолжать показывать свою обычную
 * кнопку — на вебе она работает, в TMA её можно скрыть через `!isTMA`).
 */
import { useEffect, useRef } from 'react'
import { tma, isTMA } from './index'

/**
 * Telegram MainButton — большая синяя кнопка снизу экрана от TG.
 * Подменяет собой sticky submit-кнопки (Сохранить день, Спросить коуча, и т.п.)
 *
 * @param {object} opts
 * @param {string} opts.text — текст кнопки (если пуст, кнопка скрыта)
 * @param {Function} opts.onClick — обработчик
 * @param {boolean} [opts.loading=false] — показать progress-индикатор внутри кнопки
 * @param {boolean} [opts.disabled=false] — серая, не кликается
 * @param {string} [opts.color] — hex-цвет фона (по умолчанию — theme button_color)
 */
export function useMainButton({ text, onClick, loading = false, disabled = false, color }) {
  // Сохраняем onClick в ref, чтобы хук не пересоздавал TG-слушатель на каждый
  // ререндер. TG-API onClick регистрирует callback по ссылке; если мы будем
  // дёргать offClick/onClick на каждый рендер — будут утечки и двойные клики.
  const handlerRef = useRef(onClick)
  useEffect(() => { handlerRef.current = onClick }, [onClick])

  // ── Click handler: регистрируется ОДИН раз за жизнь компонента ──────────
  // Это важно: если регистрировать в том же useEffect что и .show(), и звать
  // .hide() в cleanup на каждое изменение text/disabled — на iOS Telegram
  // быстрая последовательность hide()+show() оставляет кнопку скрытой
  // (race с TG-анимацией). Раздельные эффекты решают эту проблему.
  useEffect(() => {
    if (!isTMA) return
    const btn = tma.MainButton
    if (!btn) return
    const trampoline = () => handlerRef.current?.()
    btn.onClick(trampoline)
    return () => { btn.offClick(trampoline) }
  }, [])

  // ── Visual state: обновляем параметры без hide()-в-cleanup ──────────────
  // На каждый ре-рендер просто перенастраиваем кнопку. Если text='' —
  // прячем (одиночный hide, не в паре с show). Иначе — show() с актуальными
  // params. Никакого мерцания.
  useEffect(() => {
    if (!isTMA) return
    const btn = tma.MainButton
    if (!btn) return

    if (!text) {
      btn.hide()
      return
    }

    btn.setText(text)
    if (color) {
      try { btn.setParams({ color }) } catch { /* старые клиенты */ }
    }
    if (loading) btn.showProgress()
    else btn.hideProgress()
    if (disabled) btn.disable()
    else btn.enable()
    btn.show()
  }, [text, loading, disabled, color])

  // ── Hide on unmount: единственное место где скрываем при уходе ──────────
  useEffect(() => {
    if (!isTMA) return
    return () => {
      const btn = tma.MainButton
      if (btn) {
        btn.hide()
        btn.hideProgress()
      }
    }
  }, [])
}

/**
 * Telegram BackButton — стрелка ← в шапке TG.
 * Если onClick null/undefined — кнопка скрыта.
 */
export function useBackButton(onClick) {
  const handlerRef = useRef(onClick)
  useEffect(() => { handlerRef.current = onClick }, [onClick])

  // Аналогично useMainButton — раздельные эффекты во избежание race-condition
  // hide+show на одних и тех же кадрах рендеринга.

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
    if (onClick) btn.show()
    else btn.hide()
  }, [!!onClick])

  // Hide on unmount.
  useEffect(() => {
    if (!isTMA) return
    return () => {
      const btn = tma.BackButton
      if (btn) btn.hide()
    }
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
