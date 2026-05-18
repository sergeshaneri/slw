import { useEffect, useState } from 'react'
import { fetchEmotions } from '../../api/client'
import styles from './EmotionsTab.module.css'

// Backend table `emotions` (vault-import). Все поля кроме id опциональны —
// vault может прислать частичную запись. API не имеет response_model,
// поэтому локальный тип.
// NOTE(ts): pending backend response_model for /api/diary/emotions.
type EmotionEntry = {
  id: number | string
  date?: string
  name?: string
  intensity?: number | null
  trigger?: string | null
  body_sensation?: string | null
  roots?: string | null
  lesson?: string | null
  action?: string | null
}

type FilterMode = 'all' | 'peaks'
type SortMode = 'date' | 'intensity'

/**
 * Таблица эмоций — показывает данные из таблицы `emotions`, которые
 * импортируются из vault'а через tools/vault_sync.py (PIPELINE.md §4 Поток A).
 *
 * Фильтры:
 *  - все / пики (≥8) — главные эмоциональные точки
 *  - сортировка по дате или интенсивности
 *
 * Если эмоций нет — показываем подсказку как импортировать.
 */
export default function EmotionsTab() {
  const [items, setItems] = useState<EmotionEntry[]>([])
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('date')
  const [expandedId, setExpandedId] = useState<number | string | null>(null)

  useEffect(() => {
    setBusy(true)
    fetchEmotions(filter === 'peaks' ? 8 : null)
      .then((d) => setItems(d as EmotionEntry[]))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить эмоции'))
      .finally(() => setBusy(false))
  }, [filter])

  const sorted = [...items].sort((a, b) => {
    if (sort === 'intensity') {
      return (b.intensity ?? 0) - (a.intensity ?? 0)
    }
    return (b.date || '').localeCompare(a.date || '')
  })

  // Частота по эмоциям — для блока «топ-5».
  const frequency = items.reduce<Record<string, number>>((acc, e) => {
    const key = (e.name || '').trim().toLowerCase()
    if (!key) return acc
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const topFrequent = Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  if (busy) return <div className={styles.muted}>Загружаем эмоции…</div>
  if (error) return <div className={styles.error}>{error}</div>

  if (items.length === 0 && filter === 'all') {
    return (
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>Эмоций пока нет</h3>
        <p className={styles.muted}>
          Эмоции импортируются из локального Obsidian-vault SLW-Mine — из
          таблиц дневника (Эмоция / Интенсивность / Триггер / Корни / Урок / …).
        </p>
        <p className={styles.muted}>
          Запусти на компе:
          <code className={styles.code}>python tools/vault_sync.py import</code>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${filter === 'all' ? styles.toggleBtnActive : ''}`}
            onClick={() => setFilter('all')}
          >
            Все ({items.length})
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${filter === 'peaks' ? styles.toggleBtnActive : ''}`}
            onClick={() => setFilter('peaks')}
          >
            Пики ≥ 8
          </button>
        </div>
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${sort === 'date' ? styles.toggleBtnActive : ''}`}
            onClick={() => setSort('date')}
          >
            по дате
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${sort === 'intensity' ? styles.toggleBtnActive : ''}`}
            onClick={() => setSort('intensity')}
          >
            по интенсивности
          </button>
        </div>
      </div>

      {topFrequent.length > 0 && filter === 'all' && (
        <div className={styles.frequencyBlock}>
          <div className={styles.sectionLabel}>Топ-5 повторяющихся</div>
          <div className={styles.frequencyList}>
            {topFrequent.map(([name, count]) => (
              <span key={name} className={styles.freqChip}>
                {name} <strong>×{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.list}>
        {sorted.map(e => {
          const isOpen = expandedId === e.id
          return (
            <button
              key={e.id}
              type="button"
              className={`${styles.row} ${(e.intensity ?? 0) >= 8 ? styles.rowPeak : ''}`}
              onClick={() => setExpandedId(isOpen ? null : e.id)}
            >
              <div className={styles.rowHead}>
                <span className={styles.date}>{e.date}</span>
                <span className={styles.name}>{e.name}</span>
                {e.intensity != null && (
                  <span
                    className={styles.intensity}
                    style={{ color: intensityColor(e.intensity) }}
                  >
                    {e.intensity}/10
                  </span>
                )}
                <span className={styles.toggleArrow}>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div className={styles.detail}>
                  {e.trigger && <Field label="Триггер" value={e.trigger} />}
                  {e.body_sensation && <Field label="Ощущение" value={e.body_sensation} />}
                  {e.roots && <Field label="Корни" value={e.roots} />}
                  {e.lesson && <Field label="Урок" value={e.lesson} />}
                  {e.action && <Field label="Что сделал" value={e.action} />}
                </div>
              )}
            </button>
          )
        })}
        {sorted.length === 0 && (
          <div className={styles.muted}>В текущем фильтре ничего нет.</div>
        )}
      </div>
    </div>
  )
}

type FieldProps = {
  label: string
  value: string
}

function Field({ label, value }: FieldProps) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}:</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  )
}

function intensityColor(n: number): string {
  if (n >= 9) return '#ff7d7d'
  if (n >= 7) return '#ffb066'
  if (n >= 5) return '#f0c674'
  if (n >= 3) return '#a5c8ff'
  return '#8f929c'
}
