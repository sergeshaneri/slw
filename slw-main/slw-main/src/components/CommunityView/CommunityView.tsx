import { useEffect, useState } from 'react'
import DMView from '../DMView/DMView'
import LeaderboardView from '../LeaderboardView/LeaderboardView'
import { ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY, ASPECT_KEYS } from '../../data/aspects'
import {
  fetchSubscribedAspects,
  fetchCommunityFeed,
  reactToInsightWithComment,
} from '../../api/client'
import type { AspectKey } from '@/types/aspect'
import type { User } from '@/types/user'
import styles from './CommunityView.module.css'

export type CommunityTab = 'halls' | 'dm' | 'top' | 'feed'

type Props = {
  user: User | null
  currentUserId: number | string | null | undefined
  initialTab?: CommunityTab
  onEnterHall: (aspect: AspectKey) => void
  onOpenProfile: (userId: number | string) => void
  onOpenDM: (partnerId?: number | string | null) => void
  onRequestAuth: () => void
}

type FeedItem = {
  kind: 'insight' | 'qa'
  id: number
  aspect: string
  text: string
  user_id: number
  display_name: string
  avatar?: string | null
  created_at: string
  source: 'follow-user' | 'follow-aspect'
  likes?: number
}

const TABS: { id: CommunityTab; label: string }[] = [
  { id: 'halls', label: '☷ Холлы' },
  { id: 'dm', label: '✉ Чаты' },
  { id: 'top', label: '⚜ Топ' },
  { id: 'feed', label: '◐ Лента' },
]

export default function CommunityView({
  user,
  currentUserId,
  initialTab = 'halls',
  onEnterHall,
  onOpenProfile,
  onOpenDM,
  onRequestAuth,
}: Props) {
  const [tab, setTab] = useState<CommunityTab>(initialTab)
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set())

  // Подписанные аспекты — подсвечиваем в Холлах. Гость → пустой set, ОК.
  useEffect(() => {
    if (!user) { setSubscribed(new Set()); return }
    let cancelled = false
    fetchSubscribedAspects()
      .then(list => {
        if (cancelled) return
        setSubscribed(new Set(list))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])

  const requireAuth = !user && (tab === 'dm' || tab === 'feed')

  return (
    <div className={styles.container}>
      <div className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {requireAuth ? (
        <div className={styles.authGate}>
          <div className={styles.authTitle}>Нужен аккаунт</div>
          <div className={styles.authText}>
            {tab === 'dm' && 'Личные сообщения требуют входа. Войди или зарегистрируйся.'}
            {tab === 'feed' && 'Лента подписок доступна залогиненным.'}
          </div>
          <button type="button" className={styles.authBtn} onClick={onRequestAuth}>
            Войти
          </button>
        </div>
      ) : (
        <div className={styles.body}>
          {tab === 'halls' && (
            <HallsTab onEnterHall={onEnterHall} subscribed={subscribed} />
          )}
          {tab === 'dm' && user && (
            <DMView
              initialPartnerId={null}
              currentUserId={currentUserId ?? 0}
              onOpenProfile={onOpenProfile}
            />
          )}
          {tab === 'top' && (
            <LeaderboardView
              currentUserId={currentUserId}
              onOpenPublicProfile={onOpenProfile}
            />
          )}
          {tab === 'feed' && user && (
            <FeedTab
              onOpenProfile={onOpenProfile}
              onEnterHall={onEnterHall}
              onOpenDM={onOpenDM}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Halls tab ────────────────────────────────────────────────────────────────

function HallsTab({
  onEnterHall,
  subscribed,
}: {
  onEnterHall: (aspect: AspectKey) => void
  subscribed: Set<string>
}) {
  return (
    <div>
      <h2 className={styles.sectionTitle}>Холлы аспектов</h2>
      <p className={styles.sectionSub}>
        Каждый аспект — свой холл с чатом, инсайтами и Q&amp;A.
      </p>
      <div className={styles.hallGrid}>
        {ASPECT_KEYS.map((aspect) => {
          const info = ASPECT_DATA[aspect]
          const color = ASPECT_COLORS[aspect] ?? '#888'
          const isSubbed = subscribed.has(aspect)
          return (
            <button
              key={aspect}
              type="button"
              className={styles.hallCard}
              onClick={() => onEnterHall(aspect)}
              style={{
                borderColor: isSubbed ? color : 'var(--line, rgba(255,255,255,0.08))',
                boxShadow: isSubbed ? `0 0 0 1px ${color}55 inset` : undefined,
              }}
            >
              <div className={styles.hallCode} style={{ color }}>
                {ASPECT_DISPLAY_KEY[aspect]}
              </div>
              <div className={styles.hallName}>{info?.name ?? aspect}</div>
              {info?.sub && <div className={styles.hallSub}>{info.sub}</div>}
              {isSubbed && <div className={styles.hallSub} style={{ color }}>✓ подписан</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Feed tab ─────────────────────────────────────────────────────────────────

function FeedTab({
  onOpenProfile,
  onEnterHall,
  onOpenDM: _onOpenDM,
}: {
  onOpenProfile: (userId: number | string) => void
  onEnterHall: (aspect: AspectKey) => void
  onOpenDM: (partnerId?: number | string | null) => void
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    fetchCommunityFeed(0)
      .then(rows => {
        if (cancelled) return
        setItems(rows as FeedItem[])
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить ленту')
      })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [])

  if (busy) return <div className={styles.empty}>Загружаем ленту…</div>
  if (error) return <div className={styles.empty}>{error}</div>
  if (!items || items.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>Лента пуста</div>
        <div className={styles.emptyText}>
          Подпишись на людей в Топе или на аспект в Холле — здесь будут новые инсайты и обсуждения.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.feedList}>
      {items.map((it) => {
        const aspectKey = it.aspect as AspectKey
        const color = ASPECT_COLORS[aspectKey] ?? '#888'
        return (
          <article key={`${it.kind}-${it.id}`} className={styles.feedCard}>
            <header className={styles.feedHead}>
              <button
                type="button"
                className={styles.feedAuthor}
                onClick={() => onOpenProfile(it.user_id)}
              >
                <span className={styles.feedAvatar}>{it.avatar || '🧑'}</span>
                <span className={styles.feedName}>{it.display_name}</span>
              </button>
              <button
                type="button"
                className={styles.feedAspect}
                style={{ color, borderColor: `${color}55` }}
                onClick={() => onEnterHall(aspectKey)}
                title={`Перейти в холл ${ASPECT_DATA[aspectKey]?.name ?? it.aspect}`}
              >
                {ASPECT_DISPLAY_KEY[aspectKey] ?? it.aspect}
              </button>
            </header>
            <p className={styles.feedText}>{it.text}</p>
            <footer className={styles.feedMeta}>
              <span>{it.kind === 'qa' ? '✦ лучший ответ' : 'инсайт'}</span>
              <span>·</span>
              <span>{it.source === 'follow-user' ? 'от подписки' : 'из подписанного аспекта'}</span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}

// Подтягиваем reactToInsightWithComment для будущего расширения карточек ленты
// (реакции/комменты в Фазе 4). Сейчас не используется — игнорируем unused warn.
void reactToInsightWithComment
