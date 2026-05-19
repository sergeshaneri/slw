import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import {
  updateProfile,
  updateNotifications,
  changePassword,
  removeEmail,
  unlinkTelegram,
  deleteAccount,
  exportData,
  fetchMyProfile,
  updateMyProfile,
} from '../../api/client'
import { useSendKeyMode } from '../../hooks/useSendKeyMode'
import styles from './SettingsView.module.css'

// Backend has no response_model for /api/auth/me yet — the user shape we
// actually read is captured here.
// NOTE(ts): pending backend response_model for /api/auth/me.
type SettingsUser = {
  email?: string | null
  display_name?: string | null
  telegram_id?: number | string | null
  telegram_first_name?: string | null
  telegram_username?: string | null
  notifications_enabled?: boolean
  [key: string]: unknown
}

type Props = {
  user: SettingsUser | null | false
  onUserUpdate?: (user: unknown) => void
  onAccountDeleted?: () => void
  onLogout?: () => void
}

/**
 * SettingsView — единственная страница настроек.
 *
 * Разделы:
 *   1. Профиль        — отображаемое имя
 *   2. Безопасность   — смена пароля, удаление email, отвязка TG
 *   3. Данные         — экспорт JSON
 *   4. Опасная зона   — удаление аккаунта
 *
 * После успешного действия дёргает onUserUpdate(updatedUser) или
 * onAccountDeleted() — App обновляет user-стейт.
 */
export default function SettingsView({ user, onUserUpdate, onAccountDeleted, onLogout }: Props) {
  if (!user) {
    return (
      <div className={styles.empty}>
        Войди в аккаунт, чтобы посмотреть настройки.
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>Настройки</h1>

      <ProfileSection user={user} onUserUpdate={onUserUpdate} />
      <PrivacySection />
      {user.telegram_id && (
        <NotificationsSection user={user} onUserUpdate={onUserUpdate} />
      )}
      <SendKeySection />
      <SecuritySection user={user} onUserUpdate={onUserUpdate} />
      <DataSection />
      <DangerSection
        user={user}
        onAccountDeleted={onAccountDeleted ?? onLogout}
      />
    </div>
  )
}

// ─── Профиль ───────────────────────────────────────────────────────────────

type SectionProps = { user: SettingsUser; onUserUpdate?: (user: unknown) => void }

function ProfileSection({ user, onUserUpdate }: SectionProps) {
  const [name, setName] = useState<string>(user.display_name || '')
  const [saving, setSaving] = useState<boolean>(false)
  const [msg, setMsg] = useState<string>('')
  const [err, setErr] = useState<string>('')

  const dirty = name.trim() !== (user.display_name || '')

  async function handleSave() {
    setErr('')
    setMsg('')
    setSaving(true)
    try {
      const updated = await updateProfile({ display_name: name.trim() || null })
      onUserUpdate?.(updated)
      setMsg('Сохранено')
      setTimeout(() => setMsg(''), 1800)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const fallback = user.telegram_first_name || user.email?.split('@')[0] || 'Профиль'

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Профиль</h2>

      <Field label="Отображаемое имя">
        <input
          className={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={fallback}
          maxLength={64}
        />
        <div className={styles.hint}>
          Если оставить пусто — будет показано «{fallback}».
        </div>
      </Field>

      <Field label="Email">
        <div className={styles.readonly}>{user.email ?? '— не привязан —'}</div>
      </Field>

      <Field label="Telegram">
        <div className={styles.readonly}>
          {user.telegram_id
            ? `${user.telegram_first_name || '—'} ${user.telegram_username ? '@' + user.telegram_username : ''}`
            : '— не привязан —'}
        </div>
      </Field>

      <div className={styles.actionsRow}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        {msg && <span className={styles.successMsg}>{msg}</span>}
        {err && <span className={styles.errorMsg}>{err}</span>}
      </div>
    </section>
  )
}

// ─── Приватность публичного профиля ───────────────────────────────────────

function PrivacySection() {
  const [isPublic, setIsPublic] = useState<boolean | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    fetchMyProfile()
      .then(p => {
        const prof = p as { is_public?: boolean } | null | undefined
        setIsPublic(prof?.is_public !== false)
      })
      .catch(e => setErr(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked
    setIsPublic(next)
    setSaving(true)
    setErr('')
    try {
      await updateMyProfile({ is_public: next })
    } catch (e) {
      setIsPublic(!next)
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Публичный профиль</h2>
      {loading ? (
        <div className={styles.hint}>Загрузка…</div>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              <input
                type="checkbox"
                checked={!!isPublic}
                onChange={handleToggle}
                disabled={saving}
                style={{ marginRight: 8 }}
              />
              Показывать мой профиль другим
            </span>
            <span className={styles.hint}>
              Если выключено — твой профиль не появляется в топе и недоступен по ссылке.
              Лайки и инсайты других юзеров остаются как были.
            </span>
          </label>
          {err && <div className={styles.errorMsg}>{err}</div>}
        </>
      )}
    </section>
  )
}

// ─── TG-нотификации ────────────────────────────────────────────────────────

function NotificationsSection({ user, onUserUpdate }: SectionProps) {
  const [enabled, setEnabled] = useState<boolean>(user.notifications_enabled !== false)
  const [saving, setSaving] = useState<boolean>(false)
  const [err, setErr] = useState<string>('')

  const handleToggle = async (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked
    setEnabled(next)
    setSaving(true)
    setErr('')
    try {
      const updated = await updateNotifications(next)
      onUserUpdate?.(updated)
    } catch (e) {
      setEnabled(!next)
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Уведомления в Telegram</h2>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            disabled={saving}
            style={{ marginRight: 8 }}
          />
          Получать ежедневные напоминания в Telegram
        </span>
        <span className={styles.hint}>
          Один раз в день вечером, если есть что-то конкретное:
          взятое упражнение, забытая практика или давно не заходил.
          Можно выключить — не будем беспокоить.
        </span>
        {err && <span className={styles.err}>{err}</span>}
      </label>
    </section>
  )
}

// ─── Ввод в чатах: Enter vs Ctrl+Enter ────────────────────────────────────

function SendKeySection() {
  const [mode, setMode] = useSendKeyMode()
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Ввод в чатах</h2>
      <label className={styles.field} style={{ cursor: 'pointer' }}>
        <span className={styles.fieldLabel}>
          <input
            type="radio"
            name="slw-send-key"
            checked={mode === 'enter'}
            onChange={() => setMode('enter')}
            style={{ marginRight: 8 }}
          />
          Enter — отправить, Shift+Enter — перенос строки
        </span>
        <span className={styles.hint}>
          Привычное поведение: как в Telegram, Discord, Slack.
        </span>
      </label>
      <label className={styles.field} style={{ cursor: 'pointer' }}>
        <span className={styles.fieldLabel}>
          <input
            type="radio"
            name="slw-send-key"
            checked={mode === 'ctrl+enter'}
            onChange={() => setMode('ctrl+enter')}
            style={{ marginRight: 8 }}
          />
          Ctrl+Enter — отправить, Enter — перенос строки
        </span>
        <span className={styles.hint}>
          Безопаснее: меньше шанс случайно отправить недописанное сообщение.
          На Mac работает также Cmd+Enter.
        </span>
      </label>
    </section>
  )
}

// ─── Безопасность ──────────────────────────────────────────────────────────

function SecuritySection({ user, onUserUpdate }: SectionProps) {
  const hasEmail = !!user.email
  const hasTg = !!user.telegram_id

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Безопасность</h2>

      {hasEmail && <ChangePasswordBlock />}

      {hasEmail && (
        <RiskAction
          label="Удалить email и пароль"
          desc={
            hasTg
              ? 'Останется только вход через Telegram.'
              : 'Сначала привяжи Telegram, иначе потеряешь доступ.'
          }
          confirmText="удалить email"
          disabled={!hasTg}
          onConfirm={async () => {
            const updated = await removeEmail()
            onUserUpdate?.(updated)
          }}
        />
      )}

      {hasTg && (
        <RiskAction
          label="Отвязать Telegram"
          desc={
            hasEmail
              ? 'Останется только вход по email и паролю.'
              : 'Сначала добавь email и пароль, иначе потеряешь доступ.'
          }
          confirmText="отвязать"
          disabled={!hasEmail}
          onConfirm={async () => {
            const updated = await unlinkTelegram()
            onUserUpdate?.(updated)
          }}
        />
      )}
    </section>
  )
}

function ChangePasswordBlock() {
  const [open, setOpen] = useState<boolean>(false)
  const [oldP, setOldP] = useState<string>('')
  const [newP, setNewP] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [msg, setMsg] = useState<string>('')
  const [err, setErr] = useState<string>('')

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      await changePassword(oldP, newP)
      setOldP('')
      setNewP('')
      setMsg('Пароль изменён')
      setTimeout(() => { setMsg(''); setOpen(false) }, 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Field label="Пароль">
        <button className={styles.btnSecondary} onClick={() => setOpen(true)}>
          Сменить пароль
        </button>
      </Field>
    )
  }

  return (
    <Field label="Сменить пароль">
      <form onSubmit={submit} className={styles.form}>
        <input
          className={styles.input}
          type="password"
          placeholder="Текущий пароль"
          value={oldP}
          onChange={e => setOldP(e.target.value)}
          required
          autoComplete="current-password"
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Новый пароль"
          value={newP}
          onChange={e => setNewP(e.target.value)}
          required
          autoComplete="new-password"
        />
        <div className={styles.actionsRow}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={busy}>
            {busy ? '…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => { setOpen(false); setErr(''); setOldP(''); setNewP('') }}
          >
            Отмена
          </button>
          {msg && <span className={styles.successMsg}>{msg}</span>}
          {err && <span className={styles.errorMsg}>{err}</span>}
        </div>
      </form>
    </Field>
  )
}

// ─── Данные ────────────────────────────────────────────────────────────────

function DataSection() {
  const [busy, setBusy] = useState<boolean>(false)
  const [err, setErr] = useState<string>('')

  async function handleExport() {
    setErr('')
    setBusy(true)
    try {
      const data = await exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().slice(0, 10)
      a.download = `slw-export-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Данные</h2>
      <Field label="Экспорт">
        <div className={styles.hint}>
          Скачать всё, что хранится у тебя на сервере: scores, journey, дневник.
        </div>
        <div className={styles.actionsRow}>
          <button className={styles.btnSecondary} onClick={handleExport} disabled={busy}>
            {busy ? 'Готовлю…' : 'Скачать JSON'}
          </button>
          {err && <span className={styles.errorMsg}>{err}</span>}
        </div>
      </Field>
    </section>
  )
}

// ─── Опасная зона ──────────────────────────────────────────────────────────

type DangerProps = {
  user: SettingsUser
  onAccountDeleted?: () => void
}

function DangerSection({ user, onAccountDeleted }: DangerProps) {
  const [open, setOpen] = useState<boolean>(false)
  const [confirm, setConfirm] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [err, setErr] = useState<string>('')

  const expected = (user.email || 'удалить').toLowerCase()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await deleteAccount(confirm.trim())
      onAccountDeleted?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <section className={`${styles.section} ${styles.danger}`}>
      <h2 className={styles.sectionTitle}>Опасная зона</h2>

      {!open && (
        <Field label="Удалить аккаунт">
          <div className={styles.hint}>
            Удалит scores, journey, дневник и сам аккаунт. <strong>Восстановить нельзя.</strong>
            {' '}Бот-данные в TG (если ты пользовался ботом) останутся отдельно.
          </div>
          <div className={styles.actionsRow}>
            <button className={styles.btnDanger} onClick={() => setOpen(true)}>
              Удалить аккаунт…
            </button>
          </div>
        </Field>
      )}

      {open && (
        <Field label="Подтвердить удаление">
          <div className={styles.hint}>
            Это необратимо. Введи <code>{expected}</code> и нажми «Удалить».
          </div>
          <form onSubmit={submit} className={styles.form}>
            <input
              className={styles.input}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={expected}
              autoFocus
            />
            <div className={styles.actionsRow}>
              <button
                className={styles.btnDanger}
                type="submit"
                disabled={busy || confirm.trim().toLowerCase() !== expected}
              >
                {busy ? 'Удаляю…' : 'Удалить'}
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { setOpen(false); setConfirm(''); setErr('') }}
              >
                Отмена
              </button>
              {err && <span className={styles.errorMsg}>{err}</span>}
            </div>
          </form>
        </Field>
      )}
    </section>
  )
}

// ─── Универсальные блоки ───────────────────────────────────────────────────

type FieldProps = { label: string; children: ReactNode }

function Field({ label, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  )
}

type RiskActionProps = {
  label: string
  desc: string
  confirmText: string
  onConfirm: () => Promise<void>
  disabled?: boolean
}

function RiskAction({ label, desc, confirmText, onConfirm, disabled }: RiskActionProps) {
  const [open, setOpen] = useState<boolean>(false)
  const [val, setVal] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [err, setErr] = useState<string>('')

  async function submit() {
    setErr('')
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
      setVal('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Field label={label}>
        <div className={styles.hint}>{desc}</div>
        <div className={styles.actionsRow}>
          <button className={styles.btnSecondary} onClick={() => setOpen(true)} disabled={disabled}>
            {label}…
          </button>
        </div>
      </Field>
    )
  }

  return (
    <Field label={label}>
      <div className={styles.hint}>
        Введи <code>{confirmText}</code> для подтверждения.
      </div>
      <input
        className={styles.input}
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={confirmText}
        autoFocus
      />
      <div className={styles.actionsRow}>
        <button
          className={styles.btnDanger}
          onClick={submit}
          disabled={busy || val.trim().toLowerCase() !== confirmText.toLowerCase()}
        >
          {busy ? '…' : 'Подтвердить'}
        </button>
        <button
          className={styles.btnSecondary}
          onClick={() => { setOpen(false); setVal(''); setErr('') }}
        >
          Отмена
        </button>
        {err && <span className={styles.errorMsg}>{err}</span>}
      </div>
    </Field>
  )
}
