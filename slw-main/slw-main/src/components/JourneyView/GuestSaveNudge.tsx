import { useState } from 'react'
import styles from './GuestSaveNudge.module.css'

/**
 * Ненавязчивая плашка для гостя: «Зарегистрируйся, чтобы сохранить
 * прогресс». Показывается в JourneyView, когда пользователь не залогинен
 * и уже прошёл хотя бы пару шагов (порог задаёт JourneyView).
 *
 * Кнопка открывает AuthModal сразу в режиме register (через onSignUp).
 * После dismiss прячется на неделю (localStorage timestamp).
 * НЕ упоминаем TG/email явно — пусть юзер выберет в модалке.
 */

const LS_KEY = 'slw_save_nudge_dismissed_until'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function isSaveNudgeDismissed(): boolean {
  try {
    const until = localStorage.getItem(LS_KEY)
    if (!until) return false
    return Date.now() < Number(until)
  } catch {
    return false
  }
}

type Props = {
  onSignUp: () => void
}

export default function GuestSaveNudge({ onSignUp }: Props) {
  const [hidden, setHidden] = useState<boolean>(() => isSaveNudgeDismissed())
  if (hidden) return null

  const handleDismiss = () => {
    try {
      localStorage.setItem(LS_KEY, String(Date.now() + WEEK_MS))
    } catch { /* private mode */ }
    setHidden(true)
  }

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.icon} aria-hidden="true">☁</span>
      <span className={styles.text}>
        Зарегистрируйся, чтобы сохранить прогресс — путешествие подхватится на любом устройстве.
      </span>
      <button type="button" className={styles.btnSignIn} onClick={onSignUp}>
        Зарегистрироваться
      </button>
      <button
        type="button"
        className={styles.btnDismiss}
        onClick={handleDismiss}
        aria-label="Скрыть на неделю"
      >
        ×
      </button>
    </div>
  )
}
