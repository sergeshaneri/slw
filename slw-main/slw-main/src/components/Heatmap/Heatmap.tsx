import { useEffect, useMemo, useState } from 'react'
import { fetchHeatmap } from '../../api/client'
import styles from './Heatmap.module.css'

// Shape of one day-cell coming back from GET /api/profile/{user_id}/heatmap.
// Backend returns `{ data: [{date, count}], total_active_days, ... }` —
// FastAPI has no response_model, so we ship a local type.
// NOTE(ts): pending backend response_model for /api/profile/{id}/heatmap.
type HeatmapDay = {
  date: string
  count: number
}

type HeatmapResponse = {
  data: HeatmapDay[]
}

type HeatmapCell = HeatmapDay & { dow: number }

type Props = {
  userId: number | string | null | undefined
  days?: number
}

/**
 * GitHub-style heatmap активности за последние N дней.
 * Источники (на бэке): journey_events.step_completed, web_diary_entries,
 * aspect_insights. Сетка: 7 строк × ~26 колонок (для 180 дней).
 *
 * Цвет ячейки: чем активнее день, тем насыщеннее. Hover — title с датой
 * и счётчиком.
 */
export default function Heatmap({ userId, days = 180 }: Props) {
  const [data, setData] = useState<HeatmapResponse | null>(null)
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setBusy(true)
    fetchHeatmap(userId, days)
      .then((d) => setData(d as HeatmapResponse))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить heatmap'))
      .finally(() => setBusy(false))
  }, [userId, days])

  const weeks = useMemo<Array<Array<HeatmapCell | null>>>(() => {
    if (!data) return []
    const counts = new Map<string, number>(data.data.map(d => [d.date, d.count]))
    // Строим массив всех дней от today-N до today.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const allDays: HeatmapCell[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ymd = d.toISOString().slice(0, 10)
      allDays.push({ date: ymd, count: counts.get(ymd) ?? 0, dow: d.getDay() })
    }
    // Группируем по неделям (вс=0 → начало недели). Дополняем стартовые
    // пустые ячейки чтобы первый столбец начинался с воскресенья.
    const cells: Array<HeatmapCell | null> = []
    if (allDays.length > 0) {
      const firstDow = allDays[0]!.dow
      for (let i = 0; i < firstDow; i++) cells.push(null)
    }
    cells.push(...allDays)
    const w: Array<Array<HeatmapCell | null>> = []
    for (let i = 0; i < cells.length; i += 7) {
      w.push(cells.slice(i, i + 7))
    }
    return w
  }, [data, days])

  const totalActiveDays = data?.data.length ?? 0
  const totalEvents = (data?.data ?? []).reduce((acc, d) => acc + d.count, 0)

  if (busy) return <div className={styles.loading}>Загружаем активность…</div>
  if (error) return <div className={styles.error}>{error}</div>
  if (!data) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span>
          {totalActiveDays} активных дней · {totalEvents} событий за {days} дне
          <DevAdminEggLetter />
        </span>
      </div>
      <div className={styles.grid}>
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.week}>
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = week[di]
              if (!cell) return <div key={di} className={styles.empty} />
              return (
                <div
                  key={di}
                  className={styles.cell}
                  data-level={levelFor(cell.count)}
                  title={`${cell.date} · ${cell.count} событий`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className={styles.legend}>
        <span>меньше</span>
        {[0, 1, 2, 3, 4].map(lvl => (
          <div key={lvl} className={styles.cell} data-level={lvl} />
        ))}
        <span>больше</span>
      </div>
    </div>
  )
}

function levelFor(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

// Пасхалка: 5 кликов по букве «й» в конце фразы «… дней» → toggle dev-admin.
// Триггер для админ-режима без бэка. Хранится в localStorage.
function DevAdminEggLetter() {
  const [count, setCount] = useState<number>(0)
  const handleTap = (): void => {
    const next = count + 1
    if (next >= 5) {
      const cur = localStorage.getItem('slw_dev_admin') === '1'
      if (cur) localStorage.removeItem('slw_dev_admin')
      else localStorage.setItem('slw_dev_admin', '1')
      window.location.reload()
    } else {
      setCount(next)
    }
  }
  return (
    <span
      onClick={handleTap}
      style={{ cursor: 'default', userSelect: 'none' }}
      aria-hidden="true"
    >
      й
    </span>
  )
}
