import { useEffect, useState } from 'react'
import { ASPECT_COLORS, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import { fetchLeaderboard } from '../../api/client'
import styles from './LeaderboardView.module.css'

export default function LeaderboardView({ currentUserId, onOpenPublicProfile }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchLeaderboard(20)
      .then(setRows)
      .catch(e => setError(e.message ?? 'Не удалось загрузить топ'))
      .finally(() => setBusy(false))
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Сообщество</span>
        <h1 className={styles.title}>Топ игроков</h1>
        <div className={styles.subline}>
          XP считается по завершённым шагам путешествия и заданиям.
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {busy && <div className={styles.muted}>Загрузка…</div>}

      {!busy && rows.length === 0 && (
        <div className={styles.empty}>
          Пока никто не закончил ни одного шага. Будь первым в топе!
        </div>
      )}

      <ol className={styles.list}>
        {rows.map(row => {
          const isMe = row.user_id === currentUserId
          const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null
          return (
            <li key={row.user_id} className={`${styles.row} ${isMe ? styles.rowMe : ''}`}>
              <div className={styles.rank}>
                {medal ?? `#${row.rank}`}
              </div>
              <button
                type="button"
                className={styles.name}
                onClick={() => onOpenPublicProfile?.(row.user_id)}
              >
                {row.display_name}
                {isMe && <span className={styles.youBadge}>ты</span>}
              </button>
              <div className={styles.focus}>
                {(row.focus_aspects ?? []).map(a => (
                  <span
                    key={a}
                    className={styles.aspectChip}
                    style={{ color: ASPECT_COLORS[a], borderColor: `${ASPECT_COLORS[a]}55` }}
                  >
                    {ASPECT_DISPLAY_KEY[a] ?? a}
                  </span>
                ))}
              </div>
              <div className={styles.xp}>{row.xp} XP</div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
