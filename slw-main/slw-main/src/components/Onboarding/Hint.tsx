import { useState, type ReactNode } from 'react'
import { markHintSeen } from '../../api/client'
import type { User } from '@/types/user'
import styles from './Hint.module.css'

type HintPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

// Hint reads `hints_seen[id]` off the user object. We accept the canonical
// User (or null/undefined for guests) but keep `unknown` as a fallback for
// upstream sites still passing arbitrary shapes — runtime narrowing below
// covers both cases.
type HintUser = User | null | undefined | unknown

type Props = {
  id: string
  user: HintUser
  children: ReactNode
  onDismiss?: (id: string) => void
  position?: HintPosition
}

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
}: Props) {
  const hintsSeen = user && typeof user === 'object' ? (user as { hints_seen?: Record<string, boolean | undefined> }).hints_seen : undefined
  const seenServer = !!hintsSeen?.[id]
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
