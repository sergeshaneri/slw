import { useEffect, useRef, useState } from 'react'
import {
  fetchDMThreads,
  fetchDMThread,
  sendDM,
  markDMThreadRead,
} from '../../api/client'
import styles from './DMView.module.css'

const POLL_MS = 5_000

// Backend: dm.py routes (no response_model). Local types mirror the fields
// the UI reads.
// NOTE(ts): pending backend response_model for /api/dm/*.
type DMMessage = {
  id: number
  text: string
  is_mine: boolean
  created_at: string
}

type DMThreadSummary = {
  partner_id: number
  display_name: string
  avatar?: string | null
  unread_from_partner: number
  last_message?: { text: string; is_mine: boolean; created_at?: string } | null
}

type DMPartner = {
  user_id: number
  display_name: string
  avatar?: string | null
}

type DMThread = {
  partner: DMPartner
  mutual: boolean
  messages: DMMessage[]
}

type Props = {
  initialPartnerId?: number | string | null
  currentUserId?: number | string | null
  onOpenProfile?: (userId: number | string) => void
}

/**
 * Личные сообщения. Левая колонка — список тредов, правая — активный диалог.
 * Доступно только при mutual follow (бэкенд проверяет в POST). Если оба не
 * подписаны — показывается заглушка с подсказкой.
 *
 * `initialPartnerId` — открыть конкретный тред сразу (когда переходим из
 * уведомления или с публичного профиля).
 */
export default function DMView({ initialPartnerId, onOpenProfile }: Props) {
  const [threads, setThreads] = useState<DMThreadSummary[]>([])
  // Internal id is coerced to number — backend partner_ids are numeric.
  const initialAsNumber = typeof initialPartnerId === 'string'
    ? Number(initialPartnerId)
    : (initialPartnerId ?? null)
  const [activeId, setActiveId] = useState<number | null>(
    Number.isFinite(initialAsNumber as number) ? (initialAsNumber as number) : null
  )
  const [thread, setThread] = useState<DMThread | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)

  // Список тредов.
  const loadThreads = async () => {
    try {
      const data = (await fetchDMThreads()) as DMThreadSummary[]
      setThreads(data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить переписки')
    }
  }

  useEffect(() => { loadThreads() }, [])
  // Polling списка тредов раз в N сек чтобы новые приходили.
  useEffect(() => {
    const id = setInterval(loadThreads, POLL_MS * 2)
    return () => clearInterval(id)
  }, [])

  // Загрузка активного треда.
  useEffect(() => {
    if (!activeId) { setThread(null); return }
    let cancelled = false
    fetchDMThread(activeId)
      .then((t) => {
        if (cancelled) return
        setThread(t as DMThread)
        markDMThreadRead(activeId).catch(() => {})
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить')
      })
    return () => { cancelled = true }
  }, [activeId])

  // Polling активного треда.
  useEffect(() => {
    if (!activeId) return
    const id = setInterval(async () => {
      try {
        const t = (await fetchDMThread(activeId)) as DMThread
        setThread(t)
      } catch {}
    }, POLL_MS)
    return () => clearInterval(id)
  }, [activeId])

  // Автоскролл вниз.
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [thread?.messages?.length])

  const handleSend = async () => {
    const t = text.trim()
    if (!t || !activeId || sending) return
    setSending(true)
    setError(null)
    try {
      const msg = (await sendDM(activeId, t)) as DMMessage
      setThread(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
      setText('')
      loadThreads()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Сообщения</span>
        <h1 className={styles.title}>Личные диалоги</h1>
        <div className={styles.subline}>
          Писать можно только при взаимной подписке.
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          {threads.length === 0 ? (
            <div className={styles.muted}>
              Пока нет переписок. Подпишись на кого-нибудь — если он подпишется в ответ, можно будет написать.
            </div>
          ) : (
            <ul className={styles.threadsList}>
              {threads.map(t => (
                <li
                  key={t.partner_id}
                  className={`${styles.threadItem} ${activeId === t.partner_id ? styles.threadItemActive : ''}`}
                >
                  <button
                    type="button"
                    className={styles.threadBtn}
                    onClick={() => setActiveId(t.partner_id)}
                  >
                    <span className={styles.threadAvatar}>{t.avatar || '🧑'}</span>
                    <div className={styles.threadBody}>
                      <div className={styles.threadName}>
                        {t.display_name}
                        {t.unread_from_partner > 0 && (
                          <span className={styles.threadBadge}>{t.unread_from_partner}</span>
                        )}
                      </div>
                      <div className={styles.threadPreview}>
                        {t.last_message?.is_mine && <span className={styles.muted}>ты: </span>}
                        {trim(t.last_message?.text ?? '', 60)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className={styles.thread}>
          {!activeId && (
            <div className={styles.empty}>Выбери диалог слева.</div>
          )}
          {activeId && thread && (
            <>
              <header className={styles.threadHeader}>
                <span className={styles.threadHeaderAvatar}>{thread.partner.avatar || '🧑'}</span>
                <button
                  type="button"
                  className={styles.threadHeaderName}
                  onClick={() => onOpenProfile?.(thread.partner.user_id)}
                >
                  {thread.partner.display_name}
                </button>
              </header>

              {!thread.mutual ? (
                <div className={styles.empty}>
                  Чтобы написать этому юзеру — подпишитесь друг на друга. Сейчас только один из вас подписан.
                </div>
              ) : (
                <>
                  <div className={styles.messages} ref={messagesRef}>
                    {thread.messages.length === 0 ? (
                      <div className={styles.muted}>Сообщений пока нет. Напиши первое.</div>
                    ) : (
                      thread.messages.map(m => (
                        <div
                          key={m.id}
                          className={`${styles.bubble} ${m.is_mine ? styles.bubbleMine : ''}`}
                        >
                          <div className={styles.bubbleText}>{m.text}</div>
                          <div className={styles.bubbleTime}>{formatTime(m.created_at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className={styles.inputRow}>
                    <textarea
                      className={styles.input}
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Сообщение… (Ctrl+Enter)"
                      maxLength={4000}
                      rows={2}
                    />
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={handleSend}
                      disabled={sending || !text.trim()}
                    >
                      Отправить
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function trim(t: string, n: number): string {
  if (!t) return ''
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
