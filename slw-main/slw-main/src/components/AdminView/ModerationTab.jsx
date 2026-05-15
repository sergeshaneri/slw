import { useCallback, useEffect, useState } from 'react'
import {
  adminDeleteInsight,
  adminListInsights,
  adminPatchInsight,
} from '../../api/client'
import styles from './AdminView.module.css'

const ASPECT_FILTERS = [
  { id: '',     label: 'Все' },
  { id: 'БС',   label: 'БС' },
  { id: 'ЧС',   label: 'ЧС' },
  { id: 'БЛ',   label: 'БЛ' },
  { id: 'ЧЛ',   label: 'ЧЛ' },
  { id: 'БЭ',   label: 'БЭ' },
  { id: 'ЧЭ',   label: 'ЧЭ' },
  { id: 'БИ',   label: 'БИ' },
  { id: 'ЧИ',   label: 'ЧИ' },
]

export default function ModerationTab() {
  const [insights, setInsights] = useState([])
  const [total, setTotal] = useState(0)
  const [aspect, setAspect] = useState('')
  const [onlyPublic, setOnlyPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const d = await adminListInsights({
        limit: 100,
        aspect: aspect || null,
        only_public: onlyPublic,
      })
      setInsights(d.insights ?? [])
      setTotal(d.total ?? 0)
    } catch (e) {
      setError(e.message ?? 'Ошибка')
    } finally {
      setBusy(false)
    }
  }, [aspect, onlyPublic])

  useEffect(() => { load() }, [load])

  const togglePublic = async (insight) => {
    try {
      const r = await adminPatchInsight(insight.id, { is_public: !insight.is_public })
      setInsights(prev => prev.map(i =>
        i.id === insight.id ? { ...i, is_public: r.is_public } : i
      ))
    } catch (e) {
      setError(e.message)
    }
  }

  const deleteInsight = async insight => {
    if (!confirm(`Удалить инсайт #${insight.id} от ${insight.user_email || insight.user_id}? Действие необратимо.`)) return
    try {
      await adminDeleteInsight(insight.id)
      setInsights(prev => prev.filter(i => i.id !== insight.id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Модерация инсайтов</div>
        <div className={styles.subStats}>
          Всего: <strong>{total}</strong>{busy && ' · загрузка…'}
          {error && <span className={styles.error}> · {error}</span>}
        </div>

        <div className={styles.controls} style={{ marginTop: 8 }}>
          <select
            className={styles.sortSelect}
            value={aspect}
            onChange={e => setAspect(e.target.value)}
          >
            {ASPECT_FILTERS.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <label className={styles.bulkField} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={onlyPublic}
              onChange={e => setOnlyPublic(e.target.checked)}
            />
            <span>только публичные</span>
          </label>
          <button type="button" className={styles.action} onClick={load} disabled={busy}>
            ↻ Обновить
          </button>
        </div>
      </div>

      <div className={styles.section}>
        {insights.map(insight => (
          <div key={insight.id} className={styles.insightCard}>
            <div className={styles.insightHeader}>
              <span className={styles.diaryAspect}>{insight.aspect}</span>
              <span className={styles.diaryScript}>{insight.kind}</span>
              <span className={styles.insightUser}>
                {insight.user_display_name || insight.user_email || `#${insight.user_id}`}
                {insight.user_telegram_username && ` · @${insight.user_telegram_username}`}
              </span>
              <span className={styles.diaryDate}>
                {insight.created_at?.slice(0, 10)}
              </span>
              {!insight.is_public && (
                <span className={styles.hiddenBadge}>скрыт</span>
              )}
            </div>
            <div className={styles.insightText}>{insight.text}</div>
            <div className={styles.insightActions}>
              <button
                type="button"
                className={styles.action}
                onClick={() => togglePublic(insight)}
              >
                {insight.is_public ? '👁 Скрыть' : '👁 Показать'}
              </button>
              <button
                type="button"
                className={styles.actionWarn}
                onClick={() => deleteInsight(insight)}
              >
                🗑 Удалить
              </button>
            </div>
          </div>
        ))}
        {insights.length === 0 && !busy && (
          <div className={styles.empty}>Нет инсайтов под фильтр.</div>
        )}
      </div>
    </div>
  )
}
