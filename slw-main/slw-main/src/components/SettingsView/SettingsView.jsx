import { useState } from 'react'
import {
  updateProfile,
  changePassword,
  removeEmail,
  unlinkTelegram,
  deleteAccount,
  exportData,
} from '../../api/client'
import styles from './SettingsView.module.css'

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
export default function SettingsView({ user, onUserUpdate, onAccountDeleted, onLogout }) {
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
      <SecuritySection user={user} onUserUpdate={onUserUpdate} />
      <DataSection user={user} />
      <DangerSection
        user={user}
        onAccountDeleted={onAccountDeleted ?? onLogout}
      />
    </div>
  )
}

// ─── Профиль ───────────────────────────────────────────────────────────────

function ProfileSection({ user, onUserUpdate }) {
  const [name, setName] = useState(user.display_name || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

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
      setErr(e.message)
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

// ─── Безопасность ──────────────────────────────────────────────────────────

function SecuritySection({ user, onUserUpdate }) {
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
  const [open, setOpen] = useState(false)
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function submit(e) {
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
      setErr(e.message)
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

function DataSection({ user }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

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
      setErr(e.message)
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

function DangerSection({ user, onAccountDeleted }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const expected = (user.email || 'удалить').toLowerCase()

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await deleteAccount(confirm.trim())
      onAccountDeleted?.()
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  return (
    <section className={`${styles.section} ${styles.danger}`}>
      <h2 className={styles.sectionTitle}>Опасная зона</h2>

      {!open && (
        <Field label="Удалить аккаунт">
          <div className={styles.hint}>
            Удалит scores, journey, дневник и сам аккаунт. Бот-данные (если ты пользовался ботом) останутся.
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

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  )
}

function RiskAction({ label, desc, confirmText, onConfirm, disabled }) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
      setVal('')
    } catch (e) {
      setErr(e.message)
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
