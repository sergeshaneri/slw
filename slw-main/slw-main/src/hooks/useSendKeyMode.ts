import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Режим отправки сообщений в чат-инпутах:
 *  - 'enter'      — Enter отправляет, Shift+Enter — перенос строки
 *                   (как в Telegram, Discord, Slack — дефолт)
 *  - 'ctrl+enter' — Ctrl/Cmd+Enter отправляет, Enter — перенос строки
 *                   (как было раньше; безопаснее от случайных отправок)
 *
 * В lite хранится в общем snapshot через UiPreferencesContext; online fallback
 * использует прежний device-local ключ и переживает logout.
 * Применяется в HallView, DMView, JourneyView/Chat, CoachView через
 * `shouldSendOnKeyDown(e, mode)`.
 */
export type SendKeyMode = 'enter' | 'ctrl+enter'

export type UiPreferencesContextValue = {
  sendKeyMode?: SendKeyMode
  hintsSeen?: Record<string, boolean>
  setSendKeyMode: (mode: SendKeyMode) => void
  markHintSeen: (id: string) => void
}

export const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null)

export function useUiPreferences(): UiPreferencesContextValue | null {
  return useContext(UiPreferencesContext)
}

const STORAGE_KEY = 'slw_send_key_mode'
const DEFAULT_MODE: SendKeyMode = 'enter'
const EVENT_NAME = 'slw:send-key-mode-changed'

function read(): SendKeyMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'enter' || v === 'ctrl+enter') return v
  } catch { /* private mode / SSR */ }
  return DEFAULT_MODE
}

function write(m: SendKeyMode): void {
  try { localStorage.setItem(STORAGE_KEY, m) } catch { /* ignore */ }
  // Сообщаем другим монтированным компонентам через CustomEvent — чтобы все
  // чат-инпуты синхронно переключились без перезагрузки страницы.
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function useSendKeyMode(): [SendKeyMode, (m: SendKeyMode) => void] {
  const preferences = useUiPreferences()
  const [legacyMode, setLegacyMode] = useState<SendKeyMode>(() => preferences ? DEFAULT_MODE : read())
  useEffect(() => {
    if (preferences) return
    const sync = (): void => setLegacyMode(read())
    window.addEventListener(EVENT_NAME, sync)
    // `storage` event срабатывает в других вкладках того же origin.
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT_NAME, sync)
      window.removeEventListener('storage', sync)
    }
  }, [preferences])
  if (preferences) {
    return [preferences.sendKeyMode ?? DEFAULT_MODE, preferences.setSendKeyMode]
  }
  return [legacyMode, (m: SendKeyMode) => {
    write(m)
    setLegacyMode(m)
  }]
}

/**
 * Хелпер для onKeyDown в чат-textarea. Возвращает true если pressed Enter
 * под текущим режимом должен быть обработан как «отправить».
 *
 * Shift+Enter — всегда перенос строки (поведение textarea по умолчанию).
 * Под 'enter' режим — только чистый Enter отправляет.
 * Под 'ctrl+enter' — только Ctrl+Enter или Cmd+Enter отправляет.
 */
export function shouldSendOnKeyDown(
  e: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  mode: SendKeyMode,
): boolean {
  if (e.key !== 'Enter') return false
  if (e.shiftKey) return false
  if (mode === 'enter') return !e.ctrlKey && !e.metaKey
  return e.ctrlKey || e.metaKey
}
