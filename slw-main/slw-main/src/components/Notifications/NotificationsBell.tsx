import { useEffect, useRef, useState } from 'react'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsRead,
} from '../../api/client'
import type { AspectKey } from '@/types/aspect'
import styles from './NotificationsBell.module.css'

const POLL_MS = 30_000

// Тип уведомления. Бэкенд хранит type как строку + payload как JSON. Поле
// payload разное для каждого type — внутри describe() мы разбираем его как
// частичный object с известными ключами.
// TODO(ts): tighten when backend adds OpenAPI response_model for /api/notifications.
type NotificationType = 'reaction' | 'follow' | 'dm' | 'hall_reply' | 'achievement'

type NotificationPayload = {
  actor_id?: number
  actor_name?: string
  sender_id?: number
  sender_name?: string
  reaction?: string
  preview?: string
  aspect?: AspectKey | string
  title?: string
  code?: string
}

type NotificationItem = {
  id: number
  type: NotificationType | string
  payload?: NotificationPayload
  is_read: boolean
  created_at: string
}

type UnreadCountResp = { unread_count: number }

const TYPE_LABEL: Record<string, string> = {
  reaction: '♥ реакция',
  follow:   '+ подписчик',
  dm:       '💬 сообщение',
  hall_reply: '✦ в холле',
  achievement: '🏆 достижение',
}

type Props = {
  onOpenProfile?: (userId: number) => void
  onOpenDM?: (userId: number) => void
  onOpenHall?: (aspect: AspectKey | string) => void
}

/**
 * Колокольчик уведомлений в Header.
 * Раз в 30 секунд пуллит unread_count; клик — открывает выпадающую ленту,
 * автоматически помечает все прочитанными.
 *
 * onOpenProfile / onOpenDM — callbacks из App.jsx для перехода по клику
 * на конкретное уведомление.
 */
export default function NotificationsBell({ onOpenProfile, onOpenDM, onOpenHall }: Props) {
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const refreshCount = async () => {
    try {
      const data = (await fetchUnreadCount()) as UnreadCountResp
      setUnread(data?.unread_count ?? 0)
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
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleToggle = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    setBusy(true)
    try {
      const list = ((await fetchNotifications(30)) as NotificationItem[]) ?? []
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

  const handleClick = (n: NotificationItem) => {
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

function describe(n: NotificationItem): string {
  const p = n.payload || {}
  switch (n.type) {
    case 'reaction':
      return `${p.actor_name ?? 'Кто-то'} отреагировал ${reactionEmoji(p.reaction)} на твой инсайт${p.preview ? `: «${trim(p.preview, 60)}»` : ''}`
    case 'follow':
      return `${p.actor_name ?? 'Кто-то'} подписался на тебя`
    case 'dm':
      return `${p.sender_name ?? 'Кто-то'}: «${trim(p.preview ?? '', 80)}»`
    case 'hall_reply':
      return `${p.actor_name ?? 'Кто-то'} в холле ${p.aspect ?? ''}: «${trim(p.preview ?? '', 80)}»`
    case 'achievement':
      return `Разблокировано: ${p.title ?? p.code ?? '—'}`
    default:
      return JSON.stringify(p).slice(0, 100)
  }
}

function reactionEmoji(r: string | undefined): string {
  if (!r) return '♥'
  return ({ heart: '♥', thanks: '🙏', aha: '💡', fire: '🔥' } as Record<string, string>)[r] ?? '♥'
}

function trim(t: string, n: number): string {
  if (!t) return ''
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
