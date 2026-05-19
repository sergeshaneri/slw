import { useEffect } from 'react'
import styles from './AchievementToast.module.css'

// Тип toast'а. App.jsx собирает их в очередь и шлёт сюда массивом.
// kind='achievement' рендерит заголовок «Достижение разблокировано!»,
// kind='xp' — «+N XP» с подписью события,
// остальные kind отображаются как обычные уведомления.
// stardust — необязательный бонус, который начисляется параллельно
// со снятием тоста (списание делает App.jsx, тут только отображение).
// xpAmount — для kind='xp' показывается рядом с подписью.
export type Toast = {
  id: string
  kind: 'info' | 'success' | 'error' | 'achievement' | 'xp'
  title: string
  desc?: string
  icon?: string
  stardust?: number
  xpAmount?: number
}

type Props = {
  items: Toast[]
  onDismiss?: (id: string) => void
}

/**
 * Очередь тостов для разблокированных достижений и других уведомлений.
 *
 * App.jsx накапливает события через push() (передаётся пропом enqueue),
 * а компонент по очереди показывает каждое 4 секунды.
 *
 * `items` — массив `{ id, icon, title, desc, stardust? }`.
 * onDismiss(id) — вызывается когда тост ушёл (по клику или таймеру).
 */
export default function AchievementToast({ items, onDismiss }: Props) {
  const current = items[0]

  useEffect(() => {
    if (!current) return
    // XP-тосты короче (2.5s) — менее «весомое» событие, не должны мешать.
    const ttl = current.kind === 'xp' ? 2500 : 4500
    const t = setTimeout(() => onDismiss?.(current.id), ttl)
    return () => clearTimeout(t)
  }, [current, onDismiss])

  if (!current) return null

  const isXp = current.kind === 'xp'
  const isAch = current.kind === 'achievement'
  const headerText = isAch
    ? 'Достижение разблокировано!'
    : isXp
      ? `+${current.xpAmount ?? 0} XP`
      : 'Уведомление'

  return (
    <div className={styles.toastWrap}>
      <div
        className={`${styles.toast} ${isXp ? styles.toastXp : ''}`}
        onClick={() => onDismiss?.(current.id)}
        role="button"
        tabIndex={0}
      >
        <span className={styles.icon}>{current.icon}</span>
        <div className={styles.body}>
          <div className={styles.title}>{headerText}</div>
          <div className={styles.subtitle}>{current.title}</div>
          {current.desc && <div className={styles.desc}>{current.desc}</div>}
          {current.stardust !== undefined && current.stardust > 0 && (
            <div className={styles.reward}>
              + ⚡{current.stardust} стардаст
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
