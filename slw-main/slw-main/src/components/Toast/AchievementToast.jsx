import { useEffect, useState } from 'react'
import styles from './AchievementToast.module.css'

/**
 * Очередь тостов для разблокированных достижений и других уведомлений.
 *
 * App.jsx накапливает события через push() (передаётся пропом enqueue),
 * а компонент по очереди показывает каждое 4 секунды.
 *
 * `items` — массив `{ id, icon, title, desc, stardust? }`.
 * onDismiss(id) — вызывается когда тост ушёл (по клику или таймеру).
 */
export default function AchievementToast({ items, onDismiss }) {
  const current = items[0]

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => onDismiss?.(current.id), 4500)
    return () => clearTimeout(t)
  }, [current, onDismiss])

  if (!current) return null

  return (
    <div className={styles.toastWrap}>
      <div
        className={styles.toast}
        onClick={() => onDismiss?.(current.id)}
        role="button"
        tabIndex={0}
      >
        <span className={styles.icon}>{current.icon}</span>
        <div className={styles.body}>
          <div className={styles.title}>
            {current.kind === 'achievement' ? 'Достижение разблокировано!' : 'Уведомление'}
          </div>
          <div className={styles.subtitle}>{current.title}</div>
          {current.desc && <div className={styles.desc}>{current.desc}</div>}
          {current.stardust > 0 && (
            <div className={styles.reward}>
              + ⚡{current.stardust} стардаст
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
