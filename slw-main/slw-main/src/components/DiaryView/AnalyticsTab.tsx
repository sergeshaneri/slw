import { useEffect, useState } from 'react'
import { fetchAnalyticsList, fetchAnalyticsReport } from '../../api/client'
import styles from './AnalyticsTab.module.css'

// Shape сохраняемых отчётов в таблице `analytics_reports`. Backend
// возвращает массив без response_model, поэтому локальный тип.
// NOTE(ts): pending backend response_model for /api/diary/analytics.
type AnalyticsReportType = 'week' | 'month' | 'custom' | string

type AnalyticsReportSummary = {
  id: number | string
  type: AnalyticsReportType
  title?: string | null
  period_start?: string | null
  period_end?: string | null
}

type AnalyticsReportFull = AnalyticsReportSummary & {
  content_md?: string
}

const TYPE_LABEL: Record<string, string> = {
  week:   'Неделя',
  month:  'Месяц',
  custom: 'Произвольный',
}

/**
 * Список аналитических отчётов (`analytics_reports`). При клике —
 * раскрывается markdown-контент. Markdown рендерим простым white-space:
 * pre-wrap (без полноценного парсера — это user-генерируемый контент,
 * минимум форматирования и так читаем).
 */
export default function AnalyticsTab() {
  const [items, setItems] = useState<AnalyticsReportSummary[]>([])
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | string | null>(null)
  const [openContent, setOpenContent] = useState<AnalyticsReportFull | null>(null)
  const [contentBusy, setContentBusy] = useState<boolean>(false)

  useEffect(() => {
    setBusy(true)
    fetchAnalyticsList()
      .then((d) => setItems(d as AnalyticsReportSummary[]))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить отчёты'))
      .finally(() => setBusy(false))
  }, [])

  const handleOpen = async (id: number | string): Promise<void> => {
    if (openId === id) {
      setOpenId(null)
      setOpenContent(null)
      return
    }
    setOpenId(id)
    setOpenContent(null)
    setContentBusy(true)
    try {
      const data = await fetchAnalyticsReport(id)
      setOpenContent(data as AnalyticsReportFull)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить отчёт')
    } finally {
      setContentBusy(false)
    }
  }

  if (busy) return <div className={styles.muted}>Загружаем отчёты…</div>
  if (error) return <div className={styles.error}>{error}</div>

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>Отчётов пока нет</h3>
        <p className={styles.muted}>
          Аналитические отчёты импортируются из локального vault'а
          (папка <code className={styles.code}>analytics/</code>) — это
          недельные и месячные отчёты, которые ты собираешь через
          AI-агента в Claude Code.
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
      <div className={styles.list}>
        {items.map(r => {
          const isOpen = openId === r.id
          return (
            <div key={r.id} className={styles.row}>
              <button
                type="button"
                className={styles.head}
                onClick={() => handleOpen(r.id)}
              >
                <span className={styles.type}>{TYPE_LABEL[r.type] || r.type}</span>
                <span className={styles.title}>{r.title || `${r.period_start} – ${r.period_end}`}</span>
                <span className={styles.period}>{r.period_start} – {r.period_end}</span>
                <span className={styles.toggleArrow}>{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className={styles.body}>
                  {contentBusy && <div className={styles.muted}>Загружаем…</div>}
                  {openContent && (
                    <pre className={styles.content}>{openContent.content_md}</pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
