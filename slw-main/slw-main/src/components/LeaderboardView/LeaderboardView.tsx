import { useEffect, useState } from 'react'
import { ASPECT_COLORS, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import { fetchLeaderboard } from '../../api/client'
import type { AspectKey } from '@/types/aspect'
import styles from './LeaderboardView.module.css'

// Backend returns rows from leaderboard.py (no response_model). Shape mirrors
// what AspectsView UI expects: per-user row with XP + focus aspects.
// NOTE(ts): pending backend response_model for /api/leaderboard.
type LeaderboardRow = {
  user_id: number
  rank: number
  display_name: string
  xp: number
  focus_aspects?: AspectKey[] | string[]
}

type Props = {
  currentUserId: number | string | null | undefined
  onOpenPublicProfile?: (userId: number | string) => void
}

export default function LeaderboardView({ currentUserId, onOpenPublicProfile }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard(20)
      .then((data) => setRows((data as LeaderboardRow[]) ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить топ'))
      .finally(() => setBusy(false))
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Сообщество</span>
        <h1 className={styles.title}>Топ игроков</h1>
        <div className={styles.subline}>
          XP начисляется за шаги, пройденные в путешествии.
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {busy && <div className={styles.muted}>Загрузка…</div>}

      {!busy && rows.length === 0 && (
        <div className={styles.empty}>
          Пока никто не прошёл ни одного шага. Пройди первый — появишься здесь.
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
                {(row.focus_aspects ?? []).map((a) => {
                  const key = a as AspectKey
                  return (
                    <span
                      key={a}
                      className={styles.aspectChip}
                      style={{ color: ASPECT_COLORS[key], borderColor: `${ASPECT_COLORS[key]}55` }}
                    >
                      {ASPECT_DISPLAY_KEY[key] ?? a}
                    </span>
                  )
                })}
              </div>
              <div className={styles.xp}>{row.xp} XP</div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
