import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  login, register, linkTelegram, addEmail,
  requestPasswordReset, confirmPasswordReset, sendSupportMessage,
} from '../../api/client'
import type { PasswordResetChannel } from '../../api/client'
import styles from './AuthModal.module.css'

// Все режимы AuthModal:
//   login/register   — гостевая авторизация
//   link             — гость авторизован через email, привязывает TG
//   add-email        — гость авторизован через TG, добавляет email+пароль
//   reset-request    — забыл пароль, ввод email
//   reset-confirm    — ввод нового пароля (открыто из ссылки ?reset_token=...)
//   support          — написать в поддержку
type AuthMode =
  | 'login' | 'register'
  | 'reset-request' | 'reset-confirm'
  | 'support'

// Backend /api/auth/me has no response_model yet, so user is a permissive
// shape with the fields we actually read here.
// NOTE(ts): pending backend response_model for /api/auth/me.
type AuthUser = {
  email?: string | null
  telegram_id?: number | string | null
  [key: string]: unknown
}

type Props = {
  onSuccess: (data: unknown) => void
  onClose?: () => void
  user?: AuthUser | null
  /** Стартовая вкладка. Для guest: 'login'/'register'/'reset-request'/'support'.
      'reset-confirm' автоматом включается если задан resetToken. */
  initialMode?: AuthMode
  /** Токен из URL ?reset_token=... — открывает форму смены пароля. */
  resetToken?: string | null
}

// Telegram-Login-Widget posts back via `window.__slwTgLink(user)`. We type
// the global slot as `unknown` callback — the widget passes a TG user object
// which we forward to linkTelegram() as-is.
declare global {
  interface Window {
    __slwTgLink?: (tgUser: unknown) => void
  }
}

/**
 * AuthModal с расширенным набором режимов (login / register / reset / support).
 *
 *   user = null                         → гостевой логин/регистрация
 *                                         + ссылки «Забыл пароль» и «Поддержка»
 *
 *   user.email && !user.telegram_id     → "Подключить Telegram"
 *                                         (только TG-виджет в callback-режиме)
 *
 *   !user.email && user.telegram_id     → "Добавить email и пароль"
 *                                         (только форма email+пароль, без виджета)
 *
 *   resetToken задан                    → форма смены пароля (reset-confirm).
 *                                         Срабатывает поверх любого initialMode.
 */
export default function AuthModal({ onSuccess, onClose, user = null, initialMode = 'login', resetToken = null }: Props) {
  const isAddingEmail = !!(user && !user.email && user.telegram_id)
  const isLinkingTelegram = !!(user && user.email && !user.telegram_id)

  // Если токен пришёл в URL — сразу режим reset-confirm.
  const [mode, setMode] = useState<AuthMode>(
    resetToken ? 'reset-confirm' : initialMode
  )

  // Login/register/add-email
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [name, setName] = useState<string>('')

  // Reset-confirm
  const [newPassword, setNewPassword] = useState<string>('')

  // Toggle «показать пароль» — стандарт UX, особенно на мобиле где
  // клавиатура не предлагает повторный ввод. Один toggle на все
  // password-поля в модале (в одной сессии всё либо видимое либо нет).
  const [showPassword, setShowPassword] = useState<boolean>(false)

  // Support
  const [supportMessage, setSupportMessage] = useState<string>('')
  const [supportContact, setSupportContact] = useState<string>('')

  const [error, setError] = useState<string>('')
  const [info, setInfo] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const tgRef = useRef<HTMLDivElement | null>(null)
  // Race-guard для всех submit-handler'ов (login/register/reset/support).
  // setLoading(true) ниже асинхронен, в окне между click и render с disabled
  // юзер может тыкнуть «Войти» дважды → дубль логина, дубль register'а на
  // бэке с unique-email constraint, или просто двойной запрос. Ref-проверка
  // synchronous, режется в начале handler'а.
  const submitingRef = useRef<boolean>(false)

  // ESC закрывает модал (стандарт UX). onClose дополнительно вызывается
  // кликом по backdrop'у и крестику ×. Listener живёт только пока модал
  // открыт (компонент примонтирован), на unmount cleanup.
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // TG-виджет нужен только для линка email→TG (пользователь уже залогинен).
  useEffect(() => {
    if (!tgRef.current) return
    tgRef.current.innerHTML = ''
    if (!isLinkingTelegram) return

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'skb_coach_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-onauth', '__slwTgLink(user)')
    script.async = true
    tgRef.current.appendChild(script)

    window.__slwTgLink = async (tgUser: unknown) => {
      setError('')
      setLoading(true)
      try {
        const data = await linkTelegram(tgUser)
        onSuccess(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }

    return () => { delete window.__slwTgLink }
  }, [isLinkingTelegram, onSuccess])

  // Сбрасываем info/error при смене режима — не показываем сообщение из
  // предыдущего экрана. На отдельных полях очистка не нужна, можем
  // сохранить ввод между переключениями (например юзер кликнул «Забыл
  // пароль» уже введя email — оставляем).
  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError('')
    setInfo('')
  }

  // ── handlers ──────────────────────────────────────────────────────────

  async function handleAuthSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitingRef.current) return
    setError(''); setInfo('')
    submitingRef.current = true
    setLoading(true)
    try {
      let data: unknown
      if (isAddingEmail) {
        data = await addEmail(email, password)
      } else {
        const action = mode === 'login' ? login : register
        data = await action(email, password, name)
      }
      onSuccess(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      submitingRef.current = false
    }
  }

  async function handleResetRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitingRef.current) return
    setError(''); setInfo('')
    submitingRef.current = true
    setLoading(true)
    try {
      const resp = await requestPasswordReset(email)
      // Не палим существование email'а — даже если email не найден, бэк
      // вернёт channel='none' и мы покажем generic-успех. Только при
      // явных каналах email/telegram пишем где искать ссылку.
      const channelMsg: Record<PasswordResetChannel, string> = {
        email:    'Если этот email есть в системе — ссылка отправлена на почту. Проверь входящие (и «Спам»).',
        telegram: 'Email-сервис не настроен — ссылка отправлена в Telegram, через бота.',
        none:     'Если этот email есть в системе — ссылка отправлена. Если ничего не пришло за 10 минут, напиши в поддержку.',
      }
      setInfo(channelMsg[resp.channel])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      submitingRef.current = false
    }
  }

  async function handleResetConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitingRef.current) return
    setError(''); setInfo('')
    if (newPassword.length < 6) {
      setError('Пароль должен быть не короче 6 символов')
      return
    }
    if (!resetToken) {
      setError('Токен не передан. Открой ссылку из письма заново.')
      return
    }
    submitingRef.current = true
    setLoading(true)
    try {
      await confirmPasswordReset(resetToken, newPassword)
      setInfo('Пароль изменён. Войди с новым паролем.')
      // Через 1.5 сек переключаем на login, чтобы юзер мог войти.
      setTimeout(() => switchMode('login'), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      submitingRef.current = false
    }
  }

  async function handleSupportSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitingRef.current) return
    setError(''); setInfo('')
    if (supportMessage.trim().length < 10) {
      setError('Сообщение должно быть не короче 10 символов')
      return
    }
    if (!supportContact.trim()) {
      setError('Укажи как с тобой связаться (email или @telegram)')
      return
    }
    submitingRef.current = true
    setLoading(true)
    try {
      await sendSupportMessage(supportMessage.trim(), supportContact.trim())
      setInfo('Сообщение отправлено. Ответим на указанный контакт.')
      setSupportMessage('')
      // Не уводим автоматически — юзер сам решит закрыть или вернуться.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      submitingRef.current = false
    }
  }

  // ── title по режиму ──────────────────────────────────────────────────

  const title = isAddingEmail
    ? 'Добавить email'
    : isLinkingTelegram
      ? 'Подключить Telegram'
      : mode === 'login' ? 'Вход'
      : mode === 'register' ? 'Регистрация'
      : mode === 'reset-request' ? 'Восстановление пароля'
      : mode === 'reset-confirm' ? 'Новый пароль'
      : mode === 'support' ? 'Написать в поддержку'
      : 'Вход'

  // ── рендер ──────────────────────────────────────────────────────────

  // Login/register-форму показываем только в соответствующих режимах +
  // при добавлении email к TG-аккаунту.
  const showAuthForm = isAddingEmail || mode === 'login' || mode === 'register'
  // TG-секция (виджет + разделитель) — только для login/register гостя
  // и для linking-режима. На reset/support не показываем.
  const showTgSection = (!user && (mode === 'login' || mode === 'register')) || isLinkingTelegram
  // Tabs (Войти/Регистрация) — только для гостевого login/register
  const showTabs = !user && (mode === 'login' || mode === 'register')

  // ARIA: role="dialog" + aria-modal сообщает скринридерам что открылся
  // фокусированный диалог (NVDA/VoiceOver объявят «Диалог: Вход» вместо
  // молчания). aria-labelledby связывает с h1.title для прочтения заголовка.
  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {onClose && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        )}
        <div className={styles.logo} aria-hidden="true">🌀</div>
        <h1 id="auth-modal-title" className={styles.title}>{title}</h1>
        {!user && (mode === 'login' || mode === 'register') && (
          <p className={styles.subtitle}>Соционика · Колесо Баланса</p>
        )}

        {/* Контекстные подсказки */}
        {isAddingEmail && (
          <p className={styles.guestHint}>
            Сейчас аккаунт привязан только к Telegram. Добавь email и пароль —
            сможешь входить любым из двух способов.
          </p>
        )}
        {mode === 'reset-request' && (
          <p className={styles.guestHint}>
            Введи email от аккаунта — отправим ссылку на смену пароля.
            Если email не подключён, попробуем через Telegram-бота.
          </p>
        )}
        {mode === 'reset-confirm' && (
          <p className={styles.guestHint}>
            Придумай новый пароль (не короче 6 символов).
          </p>
        )}
        {mode === 'support' && (
          <p className={styles.guestHint}>
            Опиши проблему — сообщение попадёт админу в приложение
            и в Telegram-бот.
          </p>
        )}

        {showTabs && (
          <div className={styles.tabs}>
            <button
              type="button"
              className={mode === 'login' ? styles.tabActive : styles.tab}
              onClick={() => switchMode('login')}
            >Войти</button>
            <button
              type="button"
              className={mode === 'register' ? styles.tabActive : styles.tab}
              onClick={() => switchMode('register')}
            >Регистрация</button>
          </div>
        )}

        {/* Auth form (login / register / add-email) */}
        {showAuthForm && (
          <form onSubmit={handleAuthSubmit} className={styles.form}>
            {mode === 'register' && !user && (
              <input
                className={styles.input}
                placeholder="Имя (необязательно)"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="given-name"
              />
            )}
            <input
              className={styles.input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div className={styles.passwordRow}>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' && !isAddingEmail ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                title={showPassword ? 'Скрыть' : 'Показать'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? '...' : title}
            </button>
          </form>
        )}

        {/* Reset-request form (email → отправить ссылку) */}
        {mode === 'reset-request' && (
          <form onSubmit={handleResetRequest} className={styles.form}>
            <input
              className={styles.input}
              type="email"
              placeholder="Email от аккаунта"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            <button className={styles.btn} type="submit" disabled={loading || !email.trim()}>
              {loading ? '...' : 'Отправить ссылку'}
            </button>
          </form>
        )}

        {/* Reset-confirm form (new password) */}
        {mode === 'reset-confirm' && (
          <form onSubmit={handleResetConfirm} className={styles.form}>
            <div className={styles.passwordRow}>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Новый пароль (от 6 символов)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                autoFocus
                minLength={6}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                title={showPassword ? 'Скрыть' : 'Показать'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <button className={styles.btn} type="submit" disabled={loading || newPassword.length < 6}>
              {loading ? '...' : 'Сменить пароль'}
            </button>
          </form>
        )}

        {/* Support form */}
        {mode === 'support' && (
          <form onSubmit={handleSupportSubmit} className={styles.form}>
            <textarea
              className={`${styles.input} ${styles.supportTextarea}`}
              placeholder="Что случилось? Опиши подробнее…"
              value={supportMessage}
              onChange={e => setSupportMessage(e.target.value)}
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              autoFocus
            />
            <input
              className={styles.input}
              type="text"
              placeholder="Куда ответить: email или @telegram"
              value={supportContact}
              onChange={e => setSupportContact(e.target.value)}
              required
              autoComplete="email"
            />
            <button
              className={styles.btn}
              type="submit"
              disabled={loading || supportMessage.trim().length < 10 || !supportContact.trim()}
            >
              {loading ? '...' : 'Отправить'}
            </button>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {info && <p className={styles.infoMsg}>{info}</p>}

        {/* Ссылки внизу login/register — забыл пароль / поддержка. */}
        {(mode === 'login' || mode === 'register') && !user && (
          <div className={styles.footerLinks}>
            <button
              type="button"
              className={styles.footerLink}
              onClick={() => switchMode('reset-request')}
            >
              Забыл пароль
            </button>
            <span className={styles.footerSep} aria-hidden="true">·</span>
            <button
              type="button"
              className={styles.footerLink}
              onClick={() => switchMode('support')}
            >
              Написать в поддержку
            </button>
          </div>
        )}

        {/* В режимах reset/support — линк «← Назад ко входу». */}
        {(mode === 'reset-request' || mode === 'reset-confirm' || mode === 'support') && (
          <div className={styles.footerLinks}>
            <button
              type="button"
              className={styles.footerLink}
              onClick={() => switchMode('login')}
            >
              ← Назад ко входу
            </button>
          </div>
        )}

        {showTgSection && (
          <>
            <div className={styles.divider}>
              <span>{isLinkingTelegram ? 'Авторизуйтесь через Telegram' : 'или'}</span>
            </div>
            {isLinkingTelegram ? (
              <div ref={tgRef} className={styles.tgWidget} />
            ) : (
              <a
                href={`${import.meta.env.VITE_API_URL ?? ''}/api/auth/telegram-start`}
                className={styles.tgBtn}
              >
                Войти через Telegram
              </a>
            )}
          </>
        )}

        {loading && <p className={styles.hint}>Подождите...</p>}
      </div>
    </div>
  )
}
