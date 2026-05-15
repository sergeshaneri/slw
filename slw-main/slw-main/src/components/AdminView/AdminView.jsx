import { useCallback, useEffect, useState } from 'react'
import {
  adminImpersonate,
  adminListUsers,
  adminPromote,
  adminRestoreFromDiary,
  adminRollbackRestore,
  adminUserDiagnostic,
  setToken,
} from '../../api/client'
import styles from './AdminView.module.css'

const SORT_OPTIONS = [
  { id: 'recent',  label: 'Последняя активность' },
  { id: 'xp',      label: 'По XP' },
  { id: 'created', label: 'Новые' },
]

/**
 * Admin Panel — экран для работы с пользователями.
 * Виден только юзерам с is_admin=true.
 *
 * Возможности:
 *   • Список юзеров с метриками (XP, completedScripts, drift).
 *   • Поиск по email/имени/TG.
 *   • Диагностика конкретного юзера (recommendation + сигналы).
 *   • Restore-from-diary (preview → apply).
 *   • Promote / demote админа.
 *   • Impersonate (войти от имени).
 *   • Rollback последнего restore.
 */
export default function AdminView({ onBack, onImpersonateApply }) {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [selectedUser, setSelectedUser] = useState(null)
  const [diagnostic, setDiagnostic] = useState(null)
  const [restorePreview, setRestorePreview] = useState(null)
  const [actionLog, setActionLog] = useState([])

  const pushLog = useCallback(msg => {
    setActionLog(prev => [{ ts: Date.now(), msg }, ...prev].slice(0, 12))
  }, [])

  const loadUsers = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await adminListUsers({ limit: 50, offset: 0, search, sort })
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e.message ?? 'Ошибка загрузки')
    } finally {
      setBusy(false)
    }
  }, [search, sort])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => { if (!cancelled) loadUsers() }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [loadUsers])

  const openUser = async user => {
    setSelectedUser(user)
    setDiagnostic(null)
    setRestorePreview(null)
    try {
      const d = await adminUserDiagnostic({ user_id: user.id })
      setDiagnostic(d)
    } catch (e) {
      pushLog(`Diag error: ${e.message}`)
    }
  }

  const closeUser = () => {
    setSelectedUser(null)
    setDiagnostic(null)
    setRestorePreview(null)
  }

  const previewRestore = async () => {
    if (!selectedUser) return
    try {
      const d = await adminRestoreFromDiary({
        user_id: selectedUser.id, dry_run: true, bump_levels: true,
      })
      setRestorePreview(d)
      pushLog(`Preview: ${d.any_changes ? 'есть изменения' : 'без изменений'}`)
    } catch (e) {
      pushLog(`Preview error: ${e.message}`)
    }
  }

  const applyRestore = async () => {
    if (!selectedUser) return
    if (!confirm(`Применить restore для ${selectedUser.email || selectedUser.id}? Бэкап старого journey сохранится в _backup_before_restore.`)) return
    try {
      const d = await adminRestoreFromDiary({
        user_id: selectedUser.id, dry_run: false, bump_levels: true,
      })
      setRestorePreview(d)
      pushLog(`Restore applied: ${d.applied ? '✓' : '✗'}`)
      await loadUsers()
    } catch (e) {
      pushLog(`Restore error: ${e.message}`)
    }
  }

  const promote = async makeAdmin => {
    if (!selectedUser) return
    const verb = makeAdmin ? 'дать админа' : 'забрать админа'
    if (!confirm(`${verb} у ${selectedUser.email || selectedUser.id}?`)) return
    try {
      const d = await adminPromote({ user_id: selectedUser.id, is_admin: makeAdmin })
      pushLog(`Promote: ${d.is_admin_before} → ${d.is_admin_after}`)
      // Обновим в локальном списке
      setSelectedUser(u => u ? { ...u, is_admin: d.is_admin_after } : u)
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, is_admin: d.is_admin_after } : u
      ))
    } catch (e) {
      pushLog(`Promote error: ${e.message}`)
    }
  }

  const impersonate = async () => {
    if (!selectedUser) return
    if (!confirm(`Войти от имени ${selectedUser.email || selectedUser.id}? Текущий админский токен будет заменён. Чтобы вернуться, нужно будет перелогиниться.`)) return
    try {
      const d = await adminImpersonate({ user_id: selectedUser.id })
      // Сохраняем новый токен. Приложение перезагрузится в контексте юзера.
      setToken(d.token)
      pushLog(`Impersonating: ${d.user.email || d.user.id}`)
      if (onImpersonateApply) onImpersonateApply(d.token, d.user)
      else window.location.reload()
    } catch (e) {
      pushLog(`Impersonate error: ${e.message}`)
    }
  }

  const rollbackRestore = async () => {
    if (!selectedUser) return
    if (!confirm(`Откатить последний restore для ${selectedUser.email || selectedUser.id}?`)) return
    try {
      const d = await adminRollbackRestore({ user_id: selectedUser.id })
      pushLog(`Rollback: до ${d.rolled_back_to}`)
      setRestorePreview(null)
      if (diagnostic) {
        const fresh = await adminUserDiagnostic({ user_id: selectedUser.id })
        setDiagnostic(fresh)
      }
      await loadUsers()
    } catch (e) {
      pushLog(`Rollback error: ${e.message}`)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Admin</span>
        <h1 className={styles.title}>🛡 Admin Panel</h1>
        <div className={styles.subline}>Диагностика, restore-from-diary, promote, impersonate.</div>
        {onBack && (
          <button type="button" className={styles.backBtn} onClick={onBack}>
            ← Назад
          </button>
        )}
      </div>

      <div className={styles.controls}>
        <input
          type="text"
          className={styles.input}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по email / имени / TG username"
        />
        <select
          className={styles.sortSelect}
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.meta}>
        Всего: <strong>{total}</strong>{busy && ' · загрузка…'}
        {error && <span className={styles.error}> · {error}</span>}
      </div>

      <div className={styles.layout}>
        <div className={styles.userList}>
          {users.map(u => (
            <UserCard
              key={u.id}
              user={u}
              selected={selectedUser?.id === u.id}
              onClick={() => openUser(u)}
            />
          ))}
          {users.length === 0 && !busy && (
            <div className={styles.empty}>Пусто</div>
          )}
        </div>

        <div className={styles.detail}>
          {selectedUser ? (
            <UserDetail
              user={selectedUser}
              diagnostic={diagnostic}
              restorePreview={restorePreview}
              onClose={closeUser}
              onPreviewRestore={previewRestore}
              onApplyRestore={applyRestore}
              onPromote={promote}
              onImpersonate={impersonate}
              onRollbackRestore={rollbackRestore}
            />
          ) : (
            <div className={styles.emptyDetail}>
              Выбери юзера слева, чтобы посмотреть диагностику и действия.
            </div>
          )}
        </div>
      </div>

      {actionLog.length > 0 && (
        <div className={styles.logPanel}>
          <div className={styles.logTitle}>Лог действий</div>
          {actionLog.map(entry => (
            <div key={entry.ts} className={styles.logRow}>
              <span className={styles.logTs}>
                {new Date(entry.ts).toLocaleTimeString()}
              </span>
              {entry.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UserCard({ user, selected, onClick }) {
  const drift = (user.totalCompleted ?? 0) - (user.sum_completedScripts ?? 0)
  const isDrift = drift > 10
  const initial = (user.display_name || user.email || user.telegram_username || '?').slice(0, 1).toUpperCase()
  return (
    <button
      type="button"
      className={`${styles.userCard} ${selected ? styles.userCardSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.userAvatar}>{initial}</div>
      <div className={styles.userMain}>
        <div className={styles.userName}>
          {user.display_name || user.email || user.telegram_username || `#${user.id}`}
          {user.is_admin && <span className={styles.adminBadge}>admin</span>}
        </div>
        <div className={styles.userMeta}>
          {user.email && <span>{user.email}</span>}
          {user.telegram_username && <span>@{user.telegram_username}</span>}
          {user.telegram_id != null && <span>tg:{user.telegram_id}</span>}
        </div>
        <div className={styles.userStats}>
          <span title="XP">⚡ {user.xp || 0}</span>
          <span title="Сумма completedScripts">🪐 {user.sum_completedScripts ?? 0}</span>
          <span title="totalCompleted">∑ {user.totalCompleted ?? 0}</span>
          {isDrift && (
            <span className={styles.driftFlag} title={`Drift: totalCompleted превышает на ${drift}`}>
              ⚠ drift {drift}
            </span>
          )}
          {user.currentAspect && (
            <span title="currentAspect">{user.currentAspect}</span>
          )}
          {user.lastActiveDate && (
            <span title="lastActiveDate">{user.lastActiveDate}</span>
          )}
        </div>
      </div>
    </button>
  )
}

function UserDetail({
  user, diagnostic, restorePreview,
  onClose, onPreviewRestore, onApplyRestore,
  onPromote, onImpersonate, onRollbackRestore,
}) {
  return (
    <div>
      <div className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>
          {user.display_name || user.email || `#${user.id}`}
        </h2>
        <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.detailMetaRow}>
        <span>id: <strong>{user.id}</strong></span>
        {user.email && <span>email: <strong>{user.email}</strong></span>}
        {user.telegram_id != null && (
          <span>tg: <strong>{user.telegram_username || user.telegram_id}</strong></span>
        )}
        <span>created: <strong>{user.created_at?.slice(0, 10) ?? '—'}</strong></span>
      </div>

      {diagnostic && (
        <>
          <Section title="Диагностика">
            <RecommendationCard rec={diagnostic.recommendation} />
            <div className={styles.aspectGrid}>
              {Object.entries(diagnostic.web_state?.aspects || {}).map(([key, folder]) => (
                <div key={key} className={styles.aspectCell}>
                  <div className={styles.aspectKey}>{key}</div>
                  <div className={styles.aspectStats}>
                    L{folder.currentLevel ?? 0} · {folder.completedScripts ?? 0} done
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.subStats}>
              XP <strong>{diagnostic.web_state?.xp ?? 0}</strong> ·
              {' '}Skills <strong>{diagnostic.web_state?.skillsCount ?? 0}</strong> ·
              {' '}Streak <strong>{diagnostic.web_state?.streak ?? 0}</strong> ·
              {' '}TotalCompleted <strong>{diagnostic.web_state?.totalCompleted ?? 0}</strong> ·
              {' '}CV <strong>{diagnostic.web_state?.contentVersion ?? '—'}</strong>
            </div>
            <div className={styles.subStats}>
              Events: <strong>{diagnostic.events?.count ?? 0}</strong> ·
              {' '}Diary entries: <strong>{diagnostic.diary?.count ?? 0}</strong> ·
              {' '}Diary scriptId refs: <strong>{(diagnostic.diary?.with_script_refs_last_50 || []).length}</strong>
            </div>
          </Section>

          <Section title="Действия">
            <div className={styles.actionGrid}>
              <button type="button" className={styles.action} onClick={onPreviewRestore}>
                🔍 Restore: preview
              </button>
              <button type="button" className={styles.actionWarn} onClick={onApplyRestore}>
                💾 Restore: apply
              </button>
              <button
                type="button"
                className={styles.action}
                onClick={() => onPromote(!user.is_admin)}
              >
                {user.is_admin ? '↓ Demote admin' : '↑ Promote admin'}
              </button>
              <button type="button" className={styles.actionWarn} onClick={onImpersonate}>
                👤 Impersonate
              </button>
              <button type="button" className={styles.action} onClick={onRollbackRestore}>
                ↶ Rollback last restore
              </button>
            </div>
          </Section>

          {restorePreview && (
            <Section title={`Restore ${restorePreview.applied ? '✓ применён' : '(preview)'}`}>
              <div className={styles.subStats}>
                bump_levels: <strong>{String(restorePreview.bump_levels)}</strong> ·
                {' '}any_changes: <strong>{String(restorePreview.any_changes)}</strong> ·
                {' '}applied: <strong>{String(restorePreview.applied)}</strong>
              </div>
              <table className={styles.diffTable}>
                <thead>
                  <tr>
                    <th>Аспект</th>
                    <th>L before</th>
                    <th>L after</th>
                    <th>+ scripts</th>
                  </tr>
                </thead>
                <tbody>
                  {(restorePreview.diff_by_aspect || []).map(d => (
                    <tr key={d.aspect}>
                      <td><strong>{d.aspect}</strong></td>
                      <td>{d.currentLevel_before}</td>
                      <td>{d.currentLevel_after !== d.currentLevel_before
                        ? <strong style={{ color: '#a8d97b' }}>{d.currentLevel_after}</strong>
                        : d.currentLevel_after}</td>
                      <td className={styles.diffAddedCell}>
                        {d.completedScripts_added.length > 0
                          ? d.completedScripts_added.join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(restorePreview.unmapped_diary_aspects || []).length > 0 && (
                <div className={styles.warnLine}>
                  Не смогли смаппить аспекты: {restorePreview.unmapped_diary_aspects.join(', ')}
                </div>
              )}
            </Section>
          )}

          <Section title="Дневник (последние записи с scriptId)">
            <div className={styles.diaryList}>
              {(diagnostic.diary?.with_script_refs_last_50 || []).slice(0, 10).map(d => (
                <div key={d.diary_id} className={styles.diaryItem}>
                  <span className={styles.diaryAspect}>{d.aspect}</span>
                  <span className={styles.diaryScript}>{d.scriptId}</span>
                  <span className={styles.diaryTitle}>{d.promptTitle}</span>
                  <span className={styles.diaryDate}>
                    {d.created_at?.slice(0, 10)}
                  </span>
                </div>
              ))}
              {(diagnostic.diary?.with_script_refs_last_50 || []).length === 0 && (
                <div className={styles.empty}>Записей с scriptId нет</div>
              )}
            </div>
          </Section>

          <Section title="Сырой JSON диагностики">
            <pre className={styles.jsonDump}>
              {JSON.stringify(diagnostic, null, 2)}
            </pre>
          </Section>
        </>
      )}

      {!diagnostic && (
        <div className={styles.empty}>Загружаю диагностику…</div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  )
}

function RecommendationCard({ rec }) {
  if (!rec) return null
  const colorByScenario = {
    all_synced: '#a8d97b',
    data_drift_recoverable: '#e6c158',
    data_drift_partial: '#e6c158',
    events_present_but_not_merged: '#8975dd',
    bot_progress_no_events: '#8975dd',
    diary_only_recovery: '#cc7152',
    data_lost: '#e57373',
    ghost_progress: '#e57373',
    unclear: '#c8cad1',
  }
  const color = colorByScenario[rec.scenario] || '#c8cad1'
  return (
    <div className={styles.recCard} style={{ borderColor: color }}>
      <div className={styles.recScenario} style={{ color }}>{rec.scenario}</div>
      <div className={styles.recAction}>{rec.action}</div>
    </div>
  )
}
