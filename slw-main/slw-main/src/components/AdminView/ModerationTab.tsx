import { useCallback, useEffect, useState } from 'react'
import {
  adminDeleteInsight,
  adminListInsights,
  adminPatchInsight,
} from '../../api/client'
import { useConfirm } from '../Confirm/ConfirmProvider'
import styles from './AdminView.module.css'

// Backend stores aspect as Cyrillic code (e.g. 'БС'); admin-list returns it
// as-is. UsersTab/ModerationTab pass it back to the backend through filters,
// so we keep the Cyrillic literal type here. Latin frontend keys would have
// to be translated by adminListInsights — not the case today.
type CyrAspectFilter = '' | 'БС' | 'ЧС' | 'БЛ' | 'ЧЛ' | 'БЭ' | 'ЧЭ' | 'БИ' | 'ЧИ'

const ASPECT_FILTERS: ReadonlyArray<{ id: CyrAspectFilter; label: string }> = [
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

// Insight shape returned by /api/admin/insights. Backend has no
// response_model — fields mirror what JSX reads.
// NOTE(ts): pending backend response_model for admin/insights.
type AdminInsight = {
  id: number | string
  aspect: string
  kind: string
  text: string
  is_public: boolean
  created_at?: string | null
  user_id: number | string
  user_email?: string | null
  user_display_name?: string | null
  user_telegram_username?: string | null
}

type AdminInsightsResponse = {
  insights: AdminInsight[]
  total: number
}

export default function ModerationTab() {
  const [insights, setInsights] = useState<AdminInsight[]>([])
  const [total, setTotal] = useState<number>(0)
  const [aspect, setAspect] = useState<CyrAspectFilter>('')
  const [onlyPublic, setOnlyPublic] = useState<boolean>(false)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const d = await adminListInsights({
        limit: 100,
        aspect: aspect || null,
        only_public: onlyPublic,
      }) as AdminInsightsResponse
      setInsights(d.insights ?? [])
      setTotal(d.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }, [aspect, onlyPublic])

  useEffect(() => { load() }, [load])

  const togglePublic = async (insight: AdminInsight) => {
    try {
      const r = await adminPatchInsight(insight.id, { is_public: !insight.is_public }) as { is_public: boolean }
      setInsights(prev => prev.map(i =>
        i.id === insight.id ? { ...i, is_public: r.is_public } : i
      ))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const deleteInsight = async (insight: AdminInsight) => {
    const preview = (insight.text || '').slice(0, 120)
    const ok = await confirm({
      title: 'Удалить инсайт?',
      body: (
        <>
          Инсайт #<strong>{insight.id}</strong> от{' '}
          <strong>{insight.user_email || `#${insight.user_id}`}</strong>.
          {preview && (
            <em style={{ display: 'block', marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}>
              «{preview}{(insight.text?.length ?? 0) > 120 ? '…' : ''}»
            </em>
          )}
          <br />
          <strong>Действие необратимо.</strong> Лайки и закладки тоже пропадут.
          Если хочешь просто скрыть от других — поставь is_public=false (кнопка «👁 скрыть»).
        </>
      ),
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!ok) return
    try {
      await adminDeleteInsight(insight.id)
      setInsights(prev => prev.filter(i => i.id !== insight.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
            onChange={e => setAspect(e.target.value as CyrAspectFilter)}
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
