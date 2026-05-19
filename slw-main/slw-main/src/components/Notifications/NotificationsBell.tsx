import { useEffect, useRef, useState } from 'react'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsRead,
} from '../../api/client'
import { ASPECT_DISPLAY_KEY } from '../../data/aspects'
import type { AspectKey } from '@/types/aspect'
import styles from './NotificationsBell.module.css'

const POLL_MS = 30_000

// Тип уведомления. Бэкенд хранит type как строку + payload как JSON. Поле
// payload разное для каждого type — внутри describe() мы разбираем его как
// частичный object с известными ключами.
// NOTE(ts): pending backend response_model for /api/notifications.
type NotificationType = 'reaction' | 'follow' | 'dm' | 'hall_reply' | 'achievement' | 'insight_comment'

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
  insight_comment: '✎ комментарий',
}

type Props = {
  onOpenProfile?: (userId: number) => void
  onOpenDM?: (userId: number) => void
  onOpenHall?: (aspect: AspectKey | string) => void
}

/**
 * Колокольчик уведомлений в Header.
 * Раз в 30 секунд пуллит unread_count; клик — открывает выпадающую ленту.
 *
 * Mark-as-read (с 2026-05): пометка прочитанным происходит ТОЛЬКО когда юзер:
 *   • кликнул на конкретное уведомление (handleClick — закрывает дропдаун
 *     и помечает только этот item, бэйдж декрементируется)
 *   • кликнул «Прочитать всё» внизу списка
 *
 * Раньше открытие дропдауна авто-помечало все. Юзер случайно тапнул мимо →
 * дропдаун открылся-закрылся → потерял возможность вернуться к unread.
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
      // НЕ помечаем автоматически. Юзер решает: либо тапает конкретное
      // уведомление (handleClick), либо «Прочитать всё» (markAllRead).
    } catch {
      // молча
    } finally {
      setBusy(false)
    }
  }

  // Локально помечаем item как прочитанный (visually) и декрементируем бэйдж.
  // Бэк-пометка происходит на конкретный id (markNotificationsRead([id]))
  // через тот же endpoint, что и markAll.
  const markOneLocal = (id: number) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, is_read: true } : it))
    setUnread(u => Math.max(0, u - 1))
  }

  const handleClick = (n: NotificationItem) => {
    setOpen(false)
    // Если был unread — помечаем как прочитанное (и локально, и на бэке).
    if (!n.is_read) {
      markOneLocal(n.id)
      // markNotificationsRead принимает массив id или null=все. Шлём конкретный.
      markNotificationsRead([n.id]).catch(() => {})
    }
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

  const markAllRead = async () => {
    // Локальное обновление UI до сетевого запроса — мгновенный отклик.
    setItems(prev => prev.map(it => ({ ...it, is_read: true })))
    setUnread(0)
    try { await markNotificationsRead(null) } catch { /* молча */ }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bell}
        onClick={handleToggle}
        title="Уведомления"
        aria-label={unread > 0 ? `Уведомления (${unread} непрочитанных)` : 'Уведомления'}
        aria-haspopup="true"
        aria-expanded={open}
      >
        🔔
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} role="dialog" aria-label="Уведомления">
          <div className={styles.dropdownHead}>
            <span>Уведомления</span>
            {items.some(n => !n.is_read) && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={markAllRead}
              >
                Прочитать всё
              </button>
            )}
          </div>
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
    case 'hall_reply': {
      const aspKey = p.aspect as keyof typeof ASPECT_DISPLAY_KEY | undefined
      const aspLabel = aspKey ? (ASPECT_DISPLAY_KEY[aspKey] ?? String(aspKey)) : ''
      return `${p.actor_name ?? 'Кто-то'} в холле ${aspLabel}: «${trim(p.preview ?? '', 80)}»`
    }
    case 'achievement':
      return `Разблокировано: ${p.title ?? p.code ?? '—'}`
    case 'insight_comment':
      return `${p.actor_name ?? 'Кто-то'} прокомментировал твой инсайт${p.preview ? `: «${trim(p.preview, 60)}»` : ''}`
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
