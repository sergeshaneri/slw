import { useEffect, useRef, useState } from 'react'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsRead,
} from '../../api/client'
import styles from './NotificationsBell.module.css'

const POLL_MS = 30_000

const TYPE_LABEL = {
  reaction: '♥ реакция',
  follow:   '+ подписчик',
  dm:       '💬 сообщение',
  hall_reply: '✦ в холле',
  achievement: '🏆 достижение',
}

/**
 * Колокольчик уведомлений в Header.
 * Раз в 30 секунд пуллит unread_count; клик — открывает выпадающую ленту,
 * автоматически помечает все прочитанными.
 *
 * onOpenProfile / onOpenDM — callbacks из App.jsx для перехода по клику
 * на конкретное уведомление.
 */
export default function NotificationsBell({ onOpenProfile, onOpenDM, onOpenHall }) {
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)

  const refreshCount = async () => {
    try {
      const { unread_count } = await fetchUnreadCount()
      setUnread(unread_count)
    } catch {
      // молча
    }
  }

  useEffect(() => {
    refreshCount()
    const id = setInterval(refreshCount, POLL_MS)
    return () => clearInterval(id)
  }, [])

  // Закрыть при клике вне.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleToggle = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    setBusy(true)
    try {
      const list = await fetchNotifications(30)
      setItems(list)
      // Помечаем как прочитанные.
      if (list.some(n => !n.is_read)) {
        await markNotificationsRead(null).catch(() => {})
      }
      setUnread(0)
    } catch {
      // молча
    } finally {
      setBusy(false)
    }
  }

  const handleClick = (n) => {
    setOpen(false)
    const p = n.payload || {}
    if (n.type === 'reaction' && p.actor_id && onOpenProfile) {
      onOpenProfile(p.actor_id)
    } else if (n.type === 'follow' && p.actor_id && onOpenProfile) {
      onOpenProfile(p.actor_id)
    } else if (n.type === 'dm' && p.sender_id && onOpenDM) {
      onOpenDM(p.sender_id)
    } else if (n.type === 'hall_reply' && p.aspect && onOpenHall) {
      onOpenHall(p.aspect)
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bell}
        onClick={handleToggle}
        title="Уведомления"
      >
        🔔
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHead}>Уведомления</div>
          {busy && <div className={styles.muted}>Загружаем…</div>}
          {!busy && items.length === 0 && (
            <div className={styles.muted}>Пока пусто.</div>
          )}
          {items.map(n => (
            <button
              key={n.id}
              type="button"
              className={`${styles.item} ${n.is_read ? '' : styles.itemUnread}`}
              onClick={() => handleClick(n)}
            >
              <span className={styles.itemKind}>{TYPE_LABEL[n.type] ?? n.type}</span>
              <span className={styles.itemBody}>{describe(n)}</span>
              <span className={styles.itemTime}>{formatTime(n.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function describe(n) {
  const p = n.payload || {}
  switch (n.type) {
    case 'reaction':
      return `${p.actor_name ?? 'Кто-то'} отреагировал ${reactionEmoji(p.reaction)} на твой инсайт${p.preview ? `: «${trim(p.preview, 60)}»` : ''}`
    case 'follow':
      return `${p.actor_name ?? 'Кто-то'} подписался на тебя`
    case 'dm':
      return `${p.sender_name ?? 'Кто-то'}: «${trim(p.preview ?? '', 80)}»`
    case 'hall_reply':
      return `${p.actor_name ?? 'Кто-то'} в холле ${p.aspect}: «${trim(p.preview ?? '', 80)}»`
    case 'achievement':
      return `Разблокировано: ${p.title ?? p.code ?? '—'}`
    default:
      return JSON.stringify(p).slice(0, 100)
  }
}

function reactionEmoji(r) {
  return ({ heart: '♥', thanks: '🙏', aha: '💡', fire: '🔥' })[r] ?? '♥'
}

function trim(t, n) {
  if (!t) return ''
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
