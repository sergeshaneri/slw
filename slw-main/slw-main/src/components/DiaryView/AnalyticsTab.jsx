import { useEffect, useState } from 'react'
import { fetchAnalyticsList, fetchAnalyticsReport } from '../../api/client'
import styles from './AnalyticsTab.module.css'

const TYPE_LABEL = {
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
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [openContent, setOpenContent] = useState(null)
  const [contentBusy, setContentBusy] = useState(false)

  useEffect(() => {
    setBusy(true)
    fetchAnalyticsList()
      .then(setItems)
      .catch(e => setError(e.message ?? 'Не удалось загрузить отчёты'))
      .finally(() => setBusy(false))
  }, [])

  const handleOpen = async (id) => {
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
      setOpenContent(data)
    } catch (e) {
      setError(e.message ?? 'Не удалось загрузить отчёт')
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
