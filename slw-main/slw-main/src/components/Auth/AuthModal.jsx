import { useEffect, useRef, useState } from 'react'
import { login, register, telegramAuth, linkTelegram } from '../../api/client'
import styles from './AuthModal.module.css'

/**
 * AuthModal — shown when user is not authenticated.
 *
 * Props:
 *   onSuccess(userData)  — called after successful auth
 *   user                 — if provided (logged in via email), shows "Link Telegram" option
 */
export default function AuthModal({ onSuccess, onClose, user = null }) {
  const [tab, setTab] = useState('login')      // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const tgRef = useRef(null)

  // Inject Telegram Login Widget into the container div
  useEffect(() => {
    if (!tgRef.current) return
    tgRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'skb_coach_bot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-onauth', '__slwTgAuth(user)')
    script.async = true
    tgRef.current.appendChild(script)

    // Global callback that Telegram widget calls
    window.__slwTgAuth = async (tgUser) => {
      setError('')
      setLoading(true)
      try {
        const action = user ? linkTelegram : telegramAuth
        const data = await action(tgUser)
        onSuccess(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    return () => { delete window.__slwTgAuth }
  }, [user, onSuccess])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const action = tab === 'login' ? login : register
      const data = await action(email, password, name)
      onSuccess(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const title = user
    ? 'Подключить Telegram'
    : tab === 'login' ? 'Вход' : 'Регистрация'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
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
        <div className={styles.logo}>🌀</div>
        <h1 className={styles.title}>Соционика</h1>
        <p className={styles.subtitle}>Колесо Баланса</p>
        {!user && (
          <p className={styles.guestHint}>
            Без аккаунта можно смотреть приложение, но Путешествие требует входа — данные привязываются к профилю.
          </p>
        )}

        {!user && (
          <div className={styles.tabs}>
            <button
              className={tab === 'login' ? styles.tabActive : styles.tab}
              onClick={() => { setTab('login'); setError('') }}
            >Войти</button>
            <button
              className={tab === 'register' ? styles.tabActive : styles.tab}
              onClick={() => { setTab('register'); setError('') }}
            >Регистрация</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {tab === 'register' && !user && (
            <input
              className={styles.input}
              placeholder="Имя (необязательно)"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          )}
          {!user && (
            <>
              <input
                className={styles.input}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                className={styles.input}
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? '...' : title}
              </button>
            </>
          )}
        </form>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.divider}>
          <span>{user ? 'Авторизуйтесь через Telegram' : 'или'}</span>
        </div>

        <div ref={tgRef} className={styles.tgWidget} />

        {loading && <p className={styles.hint}>Подождите...</p>}
      </div>
    </div>
  )
}
