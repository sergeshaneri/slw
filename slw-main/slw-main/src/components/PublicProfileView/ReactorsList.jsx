import { useEffect, useState } from 'react'
import { ASPECT_COLORS } from '../../data/aspects'
import { fetchInsightReactions } from '../../api/client'
import styles from './PublicProfileView.module.css'

const REACTION_EMOJI = {
  heart: '♥',
  thanks: '🙏',
  aha: '💡',
  fire: '🔥',
}

/**
 * Inline-список юзеров, поставивших реакции на инсайт.
 * Раскрывается из родителя через open=true.
 *
 * Главная задача — давать «коннект»: клик по имени переводит на
 * публичный профиль реактора (через onOpenProfile).
 */
export default function ReactorsList({ insightId, open, onOpenProfile }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || data) return
    setBusy(true)
    fetchInsightReactions(insightId)
      .then(setData)
      .catch(e => setError(e.message ?? 'Не удалось загрузить'))
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
                {(r.focus_aspects ?? []).slice(0, 2).map(a => (
                  <span
                    key={a}
                    className={styles.reactorAspect}
                    style={{ color: ASPECT_COLORS[a], borderColor: `${ASPECT_COLORS[a]}55` }}
                  >
                    {a}
                  </span>
                ))}
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
