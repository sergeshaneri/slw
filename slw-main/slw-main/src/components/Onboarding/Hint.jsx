import { useState } from 'react'
import { markHintSeen } from '../../api/client'
import styles from './Hint.module.css'

/**
 * Маленькая dismissable подсказка (Layer 2). Показывается один раз,
 * при первом визите на экран. После закрытия — больше не появится.
 *
 * Источник правды о том, видел ли юзер подсказку:
 *   • залогиненный — `user.hints_seen[id]` (с бэка через /me и /dashboard);
 *   • гость — localStorage[`hint_${id}`].
 *
 * Props:
 *   id          — ключ подсказки, строка. Например 'dashboard-intro'.
 *   user        — объект юзера (или null/undefined для гостей).
 *   onDismiss   — опциональный колбек после закрытия (id) → void.
 *   children    — содержимое тултипа.
 *   position    — 'top-right' (default) | 'top-left' | 'bottom-right' | 'bottom-left'.
 */
export default function Hint({
  id,
  user,
  children,
  onDismiss,
  position = 'top-right',
}) {
  const seenServer = !!(user?.hints_seen?.[id])
  const seenLocal = typeof window !== 'undefined' &&
    localStorage.getItem(`hint_${id}`) === '1'
  const [dismissed, setDismissed] = useState(false)

  if (seenServer || seenLocal || dismissed) return null

  const handleClose = async () => {
    setDismissed(true)
    if (user) {
      try { await markHintSeen(id) } catch { /* best-effort */ }
      onDismiss?.(id)
    } else {
      try { localStorage.setItem(`hint_${id}`, '1') } catch { /* ignore */ }
    }
  }

  return (
    <div className={`${styles.hint} ${styles[`pos_${position}`] ?? ''}`} role="note">
      <div className={styles.content}>{children}</div>
      <button
        type="button"
        className={styles.closeBtn}
        onClick={handleClose}
        aria-label="Закрыть подсказку"
      >
        ×
      </button>
    </div>
  )
}
