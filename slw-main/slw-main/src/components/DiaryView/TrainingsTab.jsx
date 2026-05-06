import { useEffect, useMemo, useState } from 'react'
import { fetchTrainings } from '../../api/client'
import styles from './TrainingsTab.module.css'

/**
 * Тренировки из дневника. Группируем по дате — на каждый день
 * показываем список упражнений со sets/reps/weight.
 *
 * Также суммарный счётчик упражнений и «личные рекорды» по упражнению
 * (макс. вес × мин. подходы), для базовых паттернов прогресса.
 */
export default function TrainingsTab() {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setBusy(true)
    fetchTrainings()
      .then(setItems)
      .catch(e => setError(e.message ?? 'Не удалось загрузить тренировки'))
      .finally(() => setBusy(false))
  }, [])

  const byDate = useMemo(() => {
    const map = {}
    for (const t of items) {
      const k = t.date || 'undated'
      if (!map[k]) map[k] = []
      map[k].push(t)
    }
    return map
  }, [items])

  // Топ упражнений по числу повторений (как часто делается).
  const exerciseFrequency = useMemo(() => {
    const map = {}
    for (const t of items) {
      const k = (t.exercise || '').trim()
      if (!k) continue
      map[k] = (map[k] || 0) + 1
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5)
  }, [items])

  // Рекорды по весу.
  const records = useMemo(() => {
    const map = {}
    for (const t of items) {
      if (!t.exercise || t.weight_kg == null) continue
      const k = t.exercise.trim()
      if (!map[k] || t.weight_kg > map[k].weight_kg) {
        map[k] = { ...t }
      }
    }
    return Object.values(map).sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0)).slice(0, 5)
  }, [items])

  if (busy) return <div className={styles.muted}>Загружаем тренировки…</div>
  if (error) return <div className={styles.error}>{error}</div>

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>Тренировок пока нет</h3>
        <p className={styles.muted}>
          Тренировки парсятся из секции «Тренировки» дневника. Формат строки:
          <code className={styles.code}>- присед 3×10×60</code>
          (упражнение, подходы×повторы×вес).
        </p>
        <p className={styles.muted}>
          Запусти на компе:
          <code className={styles.code}>python tools/vault_sync.py import</code>
        </p>
      </div>
    )
  }

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className={styles.container}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{items.length}</div>
          <div className={styles.statLabel}>всего</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{dates.length}</div>
          <div className={styles.statLabel}>дней</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{exerciseFrequency.length}</div>
          <div className={styles.statLabel}>упражнений</div>
        </div>
      </div>

      {(exerciseFrequency.length > 0 || records.length > 0) && (
        <div className={styles.sideRow}>
          {exerciseFrequency.length > 0 && (
            <section className={styles.sideSection}>
              <div className={styles.sectionLabel}>Топ-5 частых</div>
              <ul className={styles.sideList}>
                {exerciseFrequency.map(([name, count]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <strong>×{count}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {records.length > 0 && (
            <section className={styles.sideSection}>
              <div className={styles.sectionLabel}>Рекорды веса</div>
              <ul className={styles.sideList}>
                {records.map(r => (
                  <li key={r.id}>
                    <span>{r.exercise}</span>
                    <strong>{r.weight_kg} кг</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className={styles.dayList}>
        {dates.map(date => (
          <div key={date} className={styles.day}>
            <div className={styles.dayHead}>{date}</div>
            <ul className={styles.exerciseList}>
              {byDate[date].map(t => (
                <li key={t.id} className={styles.exercise}>
                  <span className={styles.exerciseName}>{t.exercise}</span>
                  {(t.sets != null || t.reps != null) && (
                    <span className={styles.exerciseLoad}>
                      {t.sets ?? '—'}×{t.reps ?? '—'}
                      {t.weight_kg != null && ` × ${t.weight_kg} кг`}
                    </span>
                  )}
                  {t.notes && <span className={styles.exerciseNotes}>· {t.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
