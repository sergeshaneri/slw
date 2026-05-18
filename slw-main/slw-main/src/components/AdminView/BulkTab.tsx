import { useState } from 'react'
import { adminBulkRestore } from '../../api/client'
import styles from './AdminView.module.css'

// Backend has no response_model for /api/admin/bulk-restore — shape mirrors
// what the JSX actually reads.
// TODO(ts): tighten when backend adds bulk-restore response model.
type BumpAspect = {
  aspect: string
  from: number
  to: number
}

type BulkResultRow = {
  user_id: number | string
  email?: string | null
  drift: number
  added_scripts_total?: number
  bumped_aspects?: BumpAspect[]
  applied: boolean
  any_changes?: boolean
  reason?: string | null
}

type BulkResult = {
  dry_run: boolean
  candidates_count: number
  summary: {
    users_affected: number
    total_scripts_added: number
    users_applied: number
  }
  results: BulkResultRow[]
}

export default function BulkTab() {
  const [threshold, setThreshold] = useState<number | string>(10)
  const [limit, setLimit] = useState<number | string>(50)
  const [bumpLevels, setBumpLevels] = useState<boolean>(true)
  const [result, setResult] = useState<BulkResult | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (dryRun: boolean) => {
    if (!dryRun && !confirm(`Применить bulk-restore для всех юзеров с drift > ${threshold} (до ${limit} штук)?`)) return
    setBusy(true)
    setError(null)
    try {
      const r = await adminBulkRestore({
        threshold: Number(threshold),
        dry_run: dryRun,
        bump_levels: bumpLevels,
        limit: Number(limit),
      }) as BulkResult
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Bulk Restore — массовое восстановление из дневника</div>
        <div className={styles.subStats}>
          Для всех юзеров у которых <code>totalCompleted</code> превышает сумму
          <code> completedScripts</code> больше чем на указанный порог —
          подтянет недостающие <code>scriptId</code> из дневника. Юзеры без
          ссылок на scriptId пропускаются.
        </div>

        <div className={styles.bulkForm}>
          <label className={styles.bulkField}>
            <span>Threshold (мин. drift)</span>
            <input
              type="number"
              className={styles.input}
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              min={1}
              max={1000}
            />
          </label>
          <label className={styles.bulkField}>
            <span>Limit (макс. юзеров)</span>
            <input
              type="number"
              className={styles.input}
              value={limit}
              onChange={e => setLimit(e.target.value)}
              min={1}
              max={500}
            />
          </label>
          <label className={styles.bulkField} style={{ alignItems: 'flex-start' }}>
            <span>Поднимать уровень</span>
            <input
              type="checkbox"
              checked={bumpLevels}
              onChange={e => setBumpLevels(e.target.checked)}
            />
          </label>
        </div>

        <div className={styles.actionGrid} style={{ marginTop: 12 }}>
          <button
            type="button"
            className={styles.action}
            onClick={() => run(true)}
            disabled={busy}
          >
            🔍 Preview (dry-run)
          </button>
          <button
            type="button"
            className={styles.actionWarn}
            onClick={() => run(false)}
            disabled={busy}
          >
            💾 Применить ко всем
          </button>
        </div>

        {busy && <div className={styles.empty}>Идёт обработка…</div>}
        {error && <div className={styles.warnLine}>{error}</div>}
      </div>

      {result && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Результат {result.dry_run ? '(dry-run)' : '✓ применено'}
          </div>
          <div className={styles.subStats}>
            Кандидатов: <strong>{result.candidates_count}</strong> ·
            {' '}Изменилось: <strong>{result.summary.users_affected}</strong> ·
            {' '}Добавлено скриптов всего: <strong>{result.summary.total_scripts_added}</strong> ·
            {' '}Применено к: <strong>{result.summary.users_applied}</strong>
          </div>

          <table className={styles.diffTable} style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Юзер</th>
                <th>Drift</th>
                <th>+scripts</th>
                <th>Bumped</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map(r => (
                <tr key={r.user_id}>
                  <td>{r.user_id}</td>
                  <td>{r.email || `#${r.user_id}`}</td>
                  <td className={styles.driftFlag}>{r.drift}</td>
                  <td>{r.added_scripts_total ?? 0}</td>
                  <td className={styles.diffAddedCell}>
                    {(r.bumped_aspects || []).map(b =>
                      `${b.aspect}: L${b.from}→L${b.to}`
                    ).join(', ') || '—'}
                  </td>
                  <td>
                    {r.applied ? '✓' : r.any_changes ? '○' : '—'}
                    {r.reason && <span className={styles.bulkReason}> {r.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
