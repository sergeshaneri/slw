import { useEffect, useState } from 'react'
import { ASPECT_COLORS } from '../../data/aspects'
import { fetchInsightReactions } from '../../api/client'
import type { AspectKey } from '@/types/aspect'
import styles from './PublicProfileView.module.css'

// Single reactor entry from /api/profile/insights/{id}/reactions. Backend has
// no response_model yet, so the shape here mirrors the actual JSON we read.
// TODO(ts): tighten when /api/profile/insights/{id}/reactions adds a model.
type Reactor = {
  user_id: number | string
  created_at: string
  avatar?: string | null
  display_name: string
  reaction: 'heart' | 'thanks' | 'aha' | 'fire' | string
  focus_aspects?: Array<AspectKey | string> | null
  comment?: string | null
}

type ReactionsResponse = {
  reactors: Reactor[]
  hidden_count: number
}

const REACTION_EMOJI: Record<string, string> = {
  heart: '♥',
  thanks: '🙏',
  aha: '💡',
  fire: '🔥',
}

type Props = {
  insightId: number | string
  open: boolean
  onOpenProfile?: (userId: number | string) => void
}

/**
 * Inline-список юзеров, поставивших реакции на инсайт.
 * Раскрывается из родителя через open=true.
 *
 * Главная задача — давать «коннект»: клик по имени переводит на
 * публичный профиль реактора (через onOpenProfile).
 */
export default function ReactorsList({ insightId, open, onOpenProfile }: Props) {
  const [data, setData] = useState<ReactionsResponse | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || data) return
    setBusy(true)
    fetchInsightReactions(insightId)
      .then(resp => setData(resp as ReactionsResponse))
      .catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => setBusy(false))
  }, [open, insightId, data])

  if (!open) return null

  return (
    <div className={styles.reactorsBlock}>
      {busy && <div className={styles.muted}>Загружаем…</div>}
      {error && <div className={styles.muted}>{error}</div>}
      {data && data.reactors.length === 0 && data.hidden_count === 0 && (
        <div className={styles.muted}>Реакций пока нет.</div>
      )}
      {data && data.reactors.length > 0 && (
        <ul className={styles.reactorsList}>
          {data.reactors.map(r => (
            <li key={`${r.user_id}-${r.created_at}`} className={styles.reactorItem}>
              <div className={styles.reactorTopRow}>
                <span className={styles.reactorAvatar}>{r.avatar || '🧑'}</span>
                <span className={styles.reactorEmoji}>
                  {REACTION_EMOJI[r.reaction] ?? '♥'}
                </span>
                <button
                  type="button"
                  className={styles.reactorName}
                  onClick={() => onOpenProfile?.(r.user_id)}
                >
                  {r.display_name}
                </button>
                {(r.focus_aspects ?? []).slice(0, 2).map(a => {
                  const color = (ASPECT_COLORS as Record<string, string>)[a as string]
                  return (
                    <span
                      key={a}
                      className={styles.reactorAspect}
                      style={{ color, borderColor: `${color}55` }}
                    >
                      {a}
                    </span>
                  )
                })}
              </div>
              {r.comment && (
                <div className={styles.reactorComment}>{r.comment}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && data.hidden_count > 0 && (
        <div className={styles.muted}>
          + ещё {data.hidden_count} {data.hidden_count === 1 ? 'юзер скрыл' : 'юзеров скрыли'} свой профиль
        </div>
      )}
    </div>
  )
}
