import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  adminAutoPositionFromDiary,
  adminImpersonate,
  adminListUsers,
  adminNormalizeCounters,
  adminNotifySendToUser,
  adminPatchUserState,
  adminPromote,
  adminResetAspectPosition,
  adminRestoreFromDiary,
  adminRollbackRestore,
  adminSetAspectPosition,
  adminUserDiagnostic,
  adminUserDiary,
  setToken,
} from '../../api/client'
import { ASPECT_KEYS, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import { getJourney } from '../../data/journey/registry'
import type { AspectKey } from '@/types/aspect'
import styles from './AdminView.module.css'

type SortOption = 'recent' | 'xp' | 'created'

const SORT_OPTIONS: ReadonlyArray<{ id: SortOption; label: string }> = [
  { id: 'recent',  label: 'Последняя активность' },
  { id: 'xp',      label: 'По XP' },
  { id: 'created', label: 'Новые' },
]

// Backend has no response_model for any admin endpoint — types below mirror
// the JSX reads. Most diagnostic endpoints return a JSON blob with optional
// fields; we model only the fields actually consumed here and let the rest
// flow through `unknown`/extra `[key: string]: unknown` index sigs.
// NOTE(ts): pending backend response_model for admin schemas.

type AdminUser = {
  id: number | string
  email?: string | null
  display_name?: string | null
  telegram_id?: number | string | null
  telegram_username?: string | null
  xp?: number
  totalCompleted?: number
  sum_completedScripts?: number
  currentAspect?: AspectKey | string | null
  lastActiveDate?: string | null
  is_admin?: boolean
  created_at?: string | null
}

type AdminUsersResponse = {
  users: AdminUser[]
  total: number
}

type DiagnosticAspectFolder = {
  currentLevel?: number
  currentScriptId?: string | null
  currentScriptIndex?: number
  completedScripts?: number
  messages_count?: number
}

type DiagnosticRecommendation = {
  scenario?: string
  action?: string
}

type DiaryEntry = {
  id: number | string
  aspect?: AspectKey | string | null
  source?: string | null
  text?: string | null
  created_at?: string | null
  extra?: {
    scriptId?: string | null
    promptTitle?: string | null
    [k: string]: unknown
  } | null
}

type DiaryScriptRef = {
  diary_id: number | string
  aspect: AspectKey | string
  scriptId: string
  promptTitle?: string | null
  created_at?: string | null
}

type Diagnostic = {
  recommendation?: DiagnosticRecommendation | null
  web_state?: {
    aspects?: Record<string, DiagnosticAspectFolder>
    xp?: number
    skillsCount?: number
    streak?: number
    totalCompleted?: number
    contentVersion?: number | string
    [key: string]: unknown
  } | null
  events?: { count?: number } | null
  diary?: {
    count?: number
    with_script_refs_last_50?: DiaryScriptRef[]
  } | null
  [key: string]: unknown
}

type RestoreDiffAspect = {
  aspect: string
  currentLevel_before: number
  currentLevel_after: number
  completedScripts_added: string[]
}

type RestorePreview = {
  bump_levels: boolean
  any_changes: boolean
  applied: boolean
  diff_by_aspect?: RestoreDiffAspect[]
  unmapped_diary_aspects?: string[]
}

type FullDiary = {
  total: number
  entries: DiaryEntry[]
}

type StateEditorState = {
  text: string
  error: string | null
}

type PositionEditorState = {
  aspect: AspectKey | string
  currentLevel: number | string
  currentScriptId: string
  resetMessages: boolean
}

type TgMessageState = { text: string }

type ActionLogEntry = { ts: number; msg: string }

type Props = {
  onImpersonateApply?: (token: string, user: unknown) => void
}

export default function UsersTab({ onImpersonateApply }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState<number>(0)
  const [search, setSearch] = useState<string>('')
  const [sort, setSort] = useState<SortOption>('recent')
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null)
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null)
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])

  const [fullDiary, setFullDiary] = useState<FullDiary | null>(null)
  const [stateEditor, setStateEditor] = useState<StateEditorState | null>(null)
  // Position-editor: { aspect, currentLevel, currentScriptId, resetMessages } | null
  const [positionEditor, setPositionEditor] = useState<PositionEditorState | null>(null)
  // Адресное TG-сообщение: { text } | null
  const [tgMessage, setTgMessage] = useState<TgMessageState | null>(null)

  const pushLog = useCallback((msg: string) => {
    setActionLog(prev => [{ ts: Date.now(), msg }, ...prev].slice(0, 12))
  }, [])

  const loadUsers = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await adminListUsers({ limit: 50, offset: 0, search, sort }) as AdminUsersResponse
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setBusy(false)
    }
  }, [search, sort])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => { if (!cancelled) loadUsers() }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [loadUsers])

  const openUser = async (user: AdminUser) => {
    setSelectedUser(user)
    setDiagnostic(null)
    setRestorePreview(null)
    setFullDiary(null)
    setStateEditor(null)
    try {
      const d = await adminUserDiagnostic({ user_id: user.id }) as Diagnostic
      setDiagnostic(d)
    } catch (e) {
      pushLog(`Diag error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const closeUser = () => {
    setSelectedUser(null)
    setDiagnostic(null)
    setRestorePreview(null)
    setFullDiary(null)
    setStateEditor(null)
  }

  const previewRestore = async () => {
    if (!selectedUser) return
    try {
      const d = await adminRestoreFromDiary({
        user_id: selectedUser.id, dry_run: true, bump_levels: true,
      }) as RestorePreview
      setRestorePreview(d)
      pushLog(`Preview: ${d.any_changes ? 'есть изменения' : 'без изменений'}`)
    } catch (e) {
      pushLog(`Preview error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const applyRestore = async () => {
    if (!selectedUser) return
    if (!confirm(`Применить restore для ${selectedUser.email || selectedUser.id}? Бэкап старого journey сохранится в _backup_before_restore.`)) return
    try {
      const d = await adminRestoreFromDiary({
        user_id: selectedUser.id, dry_run: false, bump_levels: true,
      }) as RestorePreview
      setRestorePreview(d)
      pushLog(`Restore applied: ${d.applied ? '✓' : '✗'}`)
      await loadUsers()
    } catch (e) {
      pushLog(`Restore error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const promote = async (makeAdmin: boolean) => {
    if (!selectedUser) return
    const verb = makeAdmin ? 'дать админа' : 'забрать админа'
    if (!confirm(`${verb} у ${selectedUser.email || selectedUser.id}?`)) return
    try {
      const d = await adminPromote({ user_id: selectedUser.id, is_admin: makeAdmin }) as {
        is_admin_before: boolean
        is_admin_after: boolean
      }
      pushLog(`Promote: ${d.is_admin_before} → ${d.is_admin_after}`)
      setSelectedUser(u => u ? { ...u, is_admin: d.is_admin_after } : u)
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, is_admin: d.is_admin_after } : u
      ))
    } catch (e) {
      pushLog(`Promote error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const impersonate = async () => {
    if (!selectedUser) return
    if (!confirm(`Войти от имени ${selectedUser.email || selectedUser.id}? Текущий админский токен будет заменён. Чтобы вернуться, нужно будет перелогиниться.`)) return
    try {
      const d = await adminImpersonate({ user_id: selectedUser.id }) as {
        token: string
        user: { id: number | string; email?: string | null }
      }
      setToken(d.token)
      pushLog(`Impersonating: ${d.user.email || d.user.id}`)
      if (onImpersonateApply) onImpersonateApply(d.token, d.user)
      else window.location.reload()
    } catch (e) {
      pushLog(`Impersonate error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const rollbackRestore = async () => {
    if (!selectedUser) return
    if (!confirm(`Откатить последний restore для ${selectedUser.email || selectedUser.id}?`)) return
    try {
      const d = await adminRollbackRestore({ user_id: selectedUser.id }) as { rolled_back_to?: string }
      pushLog(`Rollback: до ${d.rolled_back_to}`)
      setRestorePreview(null)
      if (diagnostic) {
        const fresh = await adminUserDiagnostic({ user_id: selectedUser.id }) as Diagnostic
        setDiagnostic(fresh)
      }
      await loadUsers()
    } catch (e) {
      pushLog(`Rollback error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const openFullDiary = async () => {
    if (!selectedUser) return
    try {
      const d = await adminUserDiary(selectedUser.id, { limit: 200 }) as FullDiary
      setFullDiary(d)
      pushLog(`Diary: ${d.total} entries`)
    } catch (e) {
      pushLog(`Diary error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── Position editing ───────────────────────────────────────────────────
  const refreshDiagnostic = async () => {
    if (!selectedUser) return
    try {
      const fresh = await adminUserDiagnostic({ user_id: selectedUser.id }) as Diagnostic
      setDiagnostic(fresh)
    } catch (e) {
      pushLog(`Diag refresh error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const openPositionEditor = () => {
    if (!diagnostic) return
    const aspects = diagnostic.web_state?.aspects || {}
    const firstAspect = (Object.keys(aspects)[0] || 'Fe') as AspectKey | string
    const folder = aspects[firstAspect] || {}
    setPositionEditor({
      aspect: firstAspect,
      currentLevel: folder.currentLevel ?? 0,
      currentScriptId: folder.currentScriptId ?? '',
      resetMessages: false,
    })
  }

  const applyPositionEdit = async () => {
    if (!selectedUser || !positionEditor) return
    if (!confirm(`Применить позицию для ${positionEditor.aspect}: L${positionEditor.currentLevel}, scriptId=${positionEditor.currentScriptId || '—'}?`)) return
    try {
      const r = await adminSetAspectPosition(selectedUser.id, {
        aspect: positionEditor.aspect,
        currentLevel: Number(positionEditor.currentLevel),
        currentScriptId: positionEditor.currentScriptId || null,
        resetMessages: positionEditor.resetMessages,
      }) as {
        before?: { currentLevel?: number; currentScriptId?: string | null }
        after?: { currentLevel?: number; currentScriptId?: string | null }
      }
      pushLog(`Position ${positionEditor.aspect}: L${r.before?.currentLevel}→L${r.after?.currentLevel}, sid=${r.before?.currentScriptId}→${r.after?.currentScriptId}`)
      setPositionEditor(null)
      await refreshDiagnostic()
    } catch (e) {
      pushLog(`Position error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const autoPositionFromDiary = async () => {
    if (!selectedUser) return
    if (!confirm('Авто-проставить позицию по последним записям дневника для всех аспектов?')) return
    try {
      const r = await adminAutoPositionFromDiary(selectedUser.id) as {
        applied?: boolean
        changes?: unknown[]
        reason?: string
      }
      if (r.applied) {
        pushLog(`Auto-position: ${(r.changes ?? []).length} аспектов обновлено`)
      } else {
        pushLog(`Auto-position: ${r.reason || 'no changes'}`)
      }
      await refreshDiagnostic()
    } catch (e) {
      pushLog(`Auto-position error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const resetAspectPosition = async (aspect: AspectKey | string) => {
    if (!selectedUser) return
    if (!confirm(`Сбросить позицию ${aspect} на начало текущего уровня? Чат-история сотрётся, completedScripts и currentLevel остаются.`)) return
    try {
      const r = await adminResetAspectPosition(selectedUser.id, aspect) as {
        before?: { messages_count?: number }
      }
      pushLog(`Reset ${aspect}: ${r.before?.messages_count} сообщений стёрто`)
      await refreshDiagnostic()
    } catch (e) {
      pushLog(`Reset error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const normalizeCounters = async () => {
    if (!selectedUser) return
    if (!confirm('Синхронизировать totalCompleted с фактической суммой completedScripts?')) return
    try {
      const r = await adminNormalizeCounters(selectedUser.id) as {
        totalCompleted_before?: number
        totalCompleted_after?: number
        applied?: boolean
      }
      pushLog(`Counters: ${r.totalCompleted_before}→${r.totalCompleted_after}${r.applied ? '' : ' (already synced)'}`)
      await refreshDiagnostic()
      await loadUsers()
    } catch (e) {
      pushLog(`Normalize error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const openTgMessage = () => {
    if (!selectedUser?.telegram_id) {
      pushLog('У юзера не залинкован TG — некуда слать')
      return
    }
    setTgMessage({ text: '' })
  }

  const sendTgMessage = async () => {
    if (!selectedUser || !tgMessage) return
    const text = (tgMessage.text || '').trim()
    if (!text) return
    if (!confirm(`Отправить юзеру ${selectedUser.email || selectedUser.id} это сообщение в TG?\n\n${text}`)) return
    try {
      const r = await adminNotifySendToUser({ user_id: selectedUser.id, text }) as { ok?: boolean; error?: string }
      if (r.ok) {
        pushLog(`TG → ${selectedUser.email || selectedUser.id}: отправлено ✓`)
        setTgMessage(null)
      } else {
        pushLog(`TG → ${selectedUser.email || selectedUser.id}: ${r.error || 'не удалось'}`)
      }
    } catch (e) {
      pushLog(`TG send error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const openStateEditor = () => {
    if (!diagnostic) return
    // Достаём актуальный journey через диагностику (web_state.aspects там
    // сжато — нужен ещё один запрос или просто текст из textarea писать
    // вручную). Покажем все известные поля как JSON для редактирования.
    const draft = JSON.stringify(diagnostic.web_state || {}, null, 2)
    setStateEditor({ text: draft, error: null })
  }

  const applyStateEditor = async () => {
    if (!selectedUser || !stateEditor) return
    let parsed: unknown
    try {
      parsed = JSON.parse(stateEditor.text)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStateEditor(s => s ? ({ ...s, error: `Невалидный JSON: ${msg}` }) : s)
      return
    }
    if (!confirm('Применить новый journey? Старый сохранится в _backup_before_state_edit.')) return
    try {
      // На бэке мы получаем сжатый web_state из diagnostic, не полный journey.
      // Если юзер хочет редактировать полный journey — он должен предварительно
      // взять его через сырой diagnostic JSON или через export-функцию.
      // Сейчас принимаем то, что в textarea, как journey-объект.
      const r = await adminPatchUserState(selectedUser.id, parsed) as { applied?: boolean }
      pushLog(`State patched: ${r.applied ? '✓' : '✗'}`)
      setStateEditor(null)
      const fresh = await adminUserDiagnostic({ user_id: selectedUser.id }) as Diagnostic
      setDiagnostic(fresh)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStateEditor(s => s ? ({ ...s, error: msg }) : s)
    }
  }

  return (
    <>
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
          onChange={e => setSort(e.target.value as SortOption)}
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
              fullDiary={fullDiary}
              stateEditor={stateEditor}
              positionEditor={positionEditor}
              tgMessage={tgMessage}
              onClose={closeUser}
              onPreviewRestore={previewRestore}
              onApplyRestore={applyRestore}
              onPromote={promote}
              onImpersonate={impersonate}
              onRollbackRestore={rollbackRestore}
              onOpenFullDiary={openFullDiary}
              onOpenStateEditor={openStateEditor}
              onChangeStateEditor={(text) => setStateEditor(s => s ? ({ ...s, text, error: null }) : { text, error: null })}
              onApplyStateEditor={applyStateEditor}
              onCloseStateEditor={() => setStateEditor(null)}
              onOpenPositionEditor={openPositionEditor}
              onChangePositionEditor={setPositionEditor}
              onApplyPositionEditor={applyPositionEdit}
              onClosePositionEditor={() => setPositionEditor(null)}
              onAutoPositionFromDiary={autoPositionFromDiary}
              onResetAspectPosition={resetAspectPosition}
              onNormalizeCounters={normalizeCounters}
              onOpenTgMessage={openTgMessage}
              onChangeTgMessage={(text) => setTgMessage(s => s ? ({ ...s, text }) : { text })}
              onSendTgMessage={sendTgMessage}
              onCloseTgMessage={() => setTgMessage(null)}
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
    </>
  )
}

type UserCardProps = {
  user: AdminUser
  selected: boolean
  onClick: () => void
}

function UserCard({ user, selected, onClick }: UserCardProps) {
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

type UserDetailProps = {
  user: AdminUser
  diagnostic: Diagnostic | null
  restorePreview: RestorePreview | null
  fullDiary: FullDiary | null
  stateEditor: StateEditorState | null
  positionEditor: PositionEditorState | null
  tgMessage: TgMessageState | null
  onClose: () => void
  onPreviewRestore: () => void
  onApplyRestore: () => void
  onPromote: (makeAdmin: boolean) => void
  onImpersonate: () => void
  onRollbackRestore: () => void
  onOpenFullDiary: () => void
  onOpenStateEditor: () => void
  onChangeStateEditor: (text: string) => void
  onApplyStateEditor: () => void
  onCloseStateEditor: () => void
  onOpenPositionEditor: () => void
  onChangePositionEditor: (next: PositionEditorState | null) => void
  onApplyPositionEditor: () => void
  onClosePositionEditor: () => void
  onAutoPositionFromDiary: () => void
  onResetAspectPosition: (aspect: AspectKey | string) => void
  onNormalizeCounters: () => void
  onOpenTgMessage: () => void
  onChangeTgMessage: (text: string) => void
  onSendTgMessage: () => void
  onCloseTgMessage: () => void
}

function UserDetail({
  user, diagnostic, restorePreview, fullDiary, stateEditor, positionEditor, tgMessage,
  onClose, onPreviewRestore, onApplyRestore,
  onPromote, onImpersonate, onRollbackRestore,
  onOpenFullDiary, onOpenStateEditor,
  onChangeStateEditor, onApplyStateEditor, onCloseStateEditor,
  onOpenPositionEditor, onChangePositionEditor, onApplyPositionEditor, onClosePositionEditor,
  onAutoPositionFromDiary, onResetAspectPosition, onNormalizeCounters,
  onOpenTgMessage, onChangeTgMessage, onSendTgMessage, onCloseTgMessage,
}: UserDetailProps) {
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
            <RecommendationCard rec={diagnostic.recommendation ?? null} />
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
              <button type="button" className={styles.action} onClick={onOpenFullDiary}>
                📔 Полный дневник
              </button>
              <button type="button" className={styles.action} onClick={onNormalizeCounters}>
                🔢 Синхронизировать счётчик
              </button>
              <button type="button" className={styles.action} onClick={onOpenPositionEditor}>
                📍 Править позицию аспекта
              </button>
              <button type="button" className={styles.action} onClick={onAutoPositionFromDiary}>
                ⚡ Авто-позиция по дневнику
              </button>
              {user.telegram_id && (
                <button type="button" className={styles.action} onClick={onOpenTgMessage}>
                  📨 Сообщение в TG
                </button>
              )}
              <button type="button" className={styles.actionWarn} onClick={onOpenStateEditor}>
                ✎ Править web_state (опасно)
              </button>
            </div>
          </Section>

          {tgMessage && (
            <Section title="📨 Отправить сообщение в Telegram">
              <div className={styles.subStats} style={{ marginBottom: 8 }}>
                Адресная отправка через бот. Идёт от лица «Терры Гармонии»
                с кнопкой «🎯 Открыть приложение». Игнорирует cool-down,
                но если юзер выключил уведомления — не отправится.
              </div>
              <textarea
                className={styles.stateEditor}
                value={tgMessage.text || ''}
                onChange={e => onChangeTgMessage(e.target.value)}
                placeholder="Текст сообщения. Можно эмодзи и переносы строк. Макс 4000 символов."
                rows={5}
              />
              <div className={styles.actionGrid} style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={styles.actionWarn}
                  onClick={onSendTgMessage}
                  disabled={!tgMessage.text?.trim()}
                >
                  📨 Отправить
                </button>
                <button type="button" className={styles.action} onClick={onCloseTgMessage}>
                  ✕ Закрыть
                </button>
              </div>
            </Section>
          )}

          {positionEditor && (
            <Section title={`📍 Позиция аспекта · ${positionEditor.aspect}`}>
              <div className={styles.subStats}>
                Установи где юзер реально остановился. Текущий чат не стирается,
                если не отметишь сброс. Скрипт-ID (например <code>S-2</code>) — поле
                в L0 чата аспекта. Если не знаешь — оставь пустым и поставь только уровень.
              </div>
              <div className={styles.bulkForm}>
                <label className={styles.bulkField}>
                  <span>Аспект</span>
                  <select
                    className={styles.sortSelect}
                    value={positionEditor.aspect}
                    onChange={e => {
                      const newAsp = e.target.value as AspectKey | string
                      const folder = (diagnostic.web_state?.aspects || {})[newAsp] || {}
                      onChangePositionEditor({
                        aspect: newAsp,
                        currentLevel: folder.currentLevel ?? 0,
                        currentScriptId: folder.currentScriptId ?? '',
                        resetMessages: false,
                      })
                    }}
                  >
                    {ASPECT_KEYS.map(k => (
                      <option key={k} value={k}>
                        {k} ({ASPECT_DISPLAY_KEY[k]})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.bulkField}>
                  <span>currentLevel</span>
                  <select
                    className={styles.sortSelect}
                    value={positionEditor.currentLevel}
                    onChange={e => onChangePositionEditor({
                      ...positionEditor, currentLevel: e.target.value,
                    })}
                  >
                    {[0, 1, 2, 3].map(l => <option key={l} value={l}>L{l}</option>)}
                  </select>
                </label>
                <label className={styles.bulkField} style={{ gridColumn: '1 / -1' }}>
                  <span>currentScriptId — скрипт уровня L{positionEditor.currentLevel}</span>
                  <ScriptSelect
                    aspect={positionEditor.aspect as AspectKey}
                    level={Number(positionEditor.currentLevel)}
                    value={positionEditor.currentScriptId}
                    onChange={value => onChangePositionEditor({
                      ...positionEditor, currentScriptId: value,
                    })}
                  />
                </label>
                <label className={styles.bulkField} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={positionEditor.resetMessages}
                    onChange={e => onChangePositionEditor({
                      ...positionEditor, resetMessages: e.target.checked,
                    })}
                  />
                  <span>стереть чат-историю</span>
                </label>
              </div>
              <div className={styles.actionGrid} style={{ marginTop: 12 }}>
                <button type="button" className={styles.actionWarn} onClick={onApplyPositionEditor}>
                  💾 Применить
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => onResetAspectPosition(positionEditor.aspect)}
                >
                  ↺ Сбросить позицию аспекта {positionEditor.aspect}
                </button>
                <button type="button" className={styles.action} onClick={onClosePositionEditor}>
                  ✕ Закрыть
                </button>
              </div>
            </Section>
          )}

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
                  Не смогли смаппить аспекты: {restorePreview.unmapped_diary_aspects!.join(', ')}
                </div>
              )}
            </Section>
          )}

          {fullDiary && (
            <Section title={`Полный дневник (${fullDiary.total} всего, показано ${fullDiary.entries.length})`}>
              <div className={styles.fullDiaryList}>
                {fullDiary.entries.map(e => (
                  <div key={e.id} className={styles.fullDiaryEntry}>
                    <div className={styles.fullDiaryMeta}>
                      <span className={styles.diaryAspect}>{e.aspect || '—'}</span>
                      <span className={styles.diaryScript}>{e.source}</span>
                      {e.extra?.scriptId && (
                        <span className={styles.diaryScript}>{e.extra.scriptId}</span>
                      )}
                      {e.extra?.promptTitle && (
                        <span className={styles.diaryTitle}>{e.extra.promptTitle}</span>
                      )}
                      <span className={styles.diaryDate}>
                        {e.created_at?.slice(0, 10)}
                      </span>
                    </div>
                    <div className={styles.fullDiaryText}>{e.text || <em>—пусто—</em>}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {stateEditor && (
            <Section title="✎ Редактор web_state (осторожно!)">
              <div className={styles.warnLine}>
                Введи валидный JSON. Применение сохранит старый journey в
                _backup_before_state_edit (откатить нельзя из UI, только SQL).
              </div>
              <textarea
                className={styles.stateEditor}
                value={stateEditor.text}
                onChange={e => onChangeStateEditor(e.target.value)}
                rows={16}
              />
              {stateEditor.error && (
                <div className={styles.warnLine} style={{ color: 'var(--danger)' }}>
                  {stateEditor.error}
                </div>
              )}
              <div className={styles.actionGrid} style={{ marginTop: 8 }}>
                <button type="button" className={styles.actionWarn} onClick={onApplyStateEditor}>
                  💾 Применить
                </button>
                <button type="button" className={styles.action} onClick={onCloseStateEditor}>
                  ✕ Отмена
                </button>
              </div>
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

type SectionProps = { title: string; children: ReactNode }

function Section({ title, children }: SectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  )
}

type ScriptSelectProps = {
  aspect: AspectKey
  level: number
  value: string
  onChange: (value: string) => void
}

// Dropdown скриптов уровня. Подтягивает структуру из data/journey/registry.
// Каждый option — "T-1 — Слово дня: Внимание". Если в текущем value нет
// в списке — option «(других уровней / неизвестный) …» сверху, чтобы
// текущее значение не терялось.
function ScriptSelect({ aspect, level, value, onChange }: ScriptSelectProps) {
  const journey = getJourney(aspect)
  // Journey.levels has keys 0|1|2|3; cast safely from numeric level.
  const levelData = level >= 0 && level <= 3
    ? journey?.levels?.[level as 0 | 1 | 2 | 3]
    : undefined
  const scripts = levelData?.core ?? levelData?.scripts ?? []
  const knownIds = new Set(scripts.map(s => s.id))
  const valueNotInList = value && !knownIds.has(value)

  return (
    <select
      className={styles.sortSelect}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">— (пусто, фронт сам выберет первый)</option>
      {valueNotInList && (
        <option value={value}>{value} — (вне L{level}, оставить как есть)</option>
      )}
      {scripts.map(s => (
        <option key={s.id} value={s.id}>
          {s.id} — {s.title || '(без заголовка)'}
        </option>
      ))}
      {scripts.length === 0 && (
        <option value="" disabled>L{level} не имеет скриптов (или ещё не реализован)</option>
      )}
    </select>
  )
}

function RecommendationCard({ rec }: { rec: DiagnosticRecommendation | null }) {
  if (!rec) return null
  const colorByScenario: Record<string, string> = {
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
  const color = (rec.scenario && colorByScenario[rec.scenario]) || '#c8cad1'
  return (
    <div className={styles.recCard} style={{ borderColor: color }}>
      <div className={styles.recScenario} style={{ color }}>{rec.scenario}</div>
      <div className={styles.recAction}>{rec.action}</div>
    </div>
  )
}
