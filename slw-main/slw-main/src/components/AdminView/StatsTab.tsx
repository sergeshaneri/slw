import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { adminStats } from '../../api/client'
import styles from './AdminView.module.css'

// Backend has no response_model for /api/admin/stats — fields mirror reads.
// TODO(ts): tighten when backend formalizes admin/stats response.
type StatsData = {
  registrations: {
    total: number
    last_24h: number
    last_7d: number
    last_30d: number
  }
  activity: {
    dau: number
    wau: number
    mau: number
  }
  content: {
    diary_total: number
    diary_last_7d: number
    insights_total: number
    insights_last_7d: number
  }
  system: {
    tg_linked: number
    admins: number
  }
  drift_users: Array<{
    user_id: number | string
    email?: string | null
    telegram_username?: string | null
    totalCompleted: number
    sum_completedScripts: number
    drift: number
  }>
  drift_users_count: number
}

export default function StatsTab() {
  const [data, setData] = useState<StatsData | null>(null)
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const d = await adminStats() as StatsData
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (busy && !data) return <div className={styles.empty}>Загрузка статистики…</div>
  if (error) return <div className={styles.warnLine}>{error}</div>
  if (!data) return null

  const { registrations, activity, content, system, drift_users, drift_users_count } = data

  return (
    <div>
      <div className={styles.statsActions}>
        <button type="button" className={styles.action} onClick={load} disabled={busy}>
          ↻ Обновить
        </button>
      </div>

      <div className={styles.statsGrid}>
        <StatBlock title="Регистрации">
          <BigNum label="Всего юзеров" value={registrations.total} />
          <SmallNum label="За 24 часа" value={registrations.last_24h} />
          <SmallNum label="За 7 дней" value={registrations.last_7d} />
          <SmallNum label="За 30 дней" value={registrations.last_30d} />
        </StatBlock>

        <StatBlock title="Активность">
          <BigNum label="DAU" value={activity.dau} hint="за последний день" />
          <SmallNum label="WAU" value={activity.wau} hint="за 7 дней" />
          <SmallNum label="MAU" value={activity.mau} hint="за 30 дней" />
        </StatBlock>

        <StatBlock title="Контент">
          <SmallNum label="Дневник всего" value={content.diary_total} />
          <SmallNum label="Дневник 7д" value={content.diary_last_7d} />
          <SmallNum label="Инсайтов всего" value={content.insights_total} />
          <SmallNum label="Инсайтов 7д" value={content.insights_last_7d} />
        </StatBlock>

        <StatBlock title="Система">
          <BigNum label="TG залинковано" value={system.tg_linked} />
          <SmallNum label="Админов" value={system.admins} />
        </StatBlock>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Drift-юзеры ({drift_users_count})
        </div>
        <div className={styles.subStats}>
          Юзеры у которых totalCompleted больше суммы completedScripts на 10+.
          Это сигнал «сбит прогресс», их можно восстановить через вкладку <strong>Массовые операции</strong>.
        </div>
        {drift_users.length === 0 ? (
          <div className={styles.empty}>Нет юзеров с drift &gt; 10. Хорошие новости 🎉</div>
        ) : (
          <table className={styles.diffTable}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Юзер</th>
                <th>TotalCompleted</th>
                <th>Sum completed</th>
                <th>Drift</th>
              </tr>
            </thead>
            <tbody>
              {drift_users.map(u => (
                <tr key={u.user_id}>
                  <td>{u.user_id}</td>
                  <td>{u.email || u.telegram_username || `#${u.user_id}`}</td>
                  <td>{u.totalCompleted}</td>
                  <td>{u.sum_completedScripts}</td>
                  <td className={styles.driftFlag}>{u.drift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

type StatBlockProps = { title: string; children: ReactNode }

function StatBlock({ title, children }: StatBlockProps) {
  return (
    <div className={styles.statBlock}>
      <div className={styles.statBlockTitle}>{title}</div>
      {children}
    </div>
  )
}

type NumProps = { label: string; value: number; hint?: string }

function BigNum({ label, value, hint }: NumProps) {
  return (
    <div className={styles.bigNum}>
      <div className={styles.bigNumValue}>{value}</div>
      <div className={styles.bigNumLabel}>{label}</div>
      {hint && <div className={styles.bigNumHint}>{hint}</div>}
    </div>
  )
}

function SmallNum({ label, value, hint }: NumProps) {
  return (
    <div className={styles.smallNum}>
      <span className={styles.smallNumLabel}>{label}</span>
      <span className={styles.smallNumValue}>{value}</span>
      {hint && <span className={styles.smallNumHint}>{hint}</span>}
    </div>
  )
}
