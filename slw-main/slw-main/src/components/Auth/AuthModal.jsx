import { useEffect, useRef, useState } from 'react'
import { login, register, linkTelegram, addEmail } from '../../api/client'
import styles from './AuthModal.module.css'

/**
 * AuthModal — три режима в зависимости от user-prop:
 *
 *   user = null                         → гостевой логин/регистрация
 *                                         (форма email+пароль + TG-виджет)
 *
 *   user.email && !user.telegram_id     → "Подключить Telegram"
 *                                         (только TG-виджет в callback-режиме)
 *
 *   !user.email && user.telegram_id     → "Добавить email и пароль"
 *                                         (только форма email+пароль, без виджета)
 */
export default function AuthModal({ onSuccess, onClose, user = null }) {
  const isAddingEmail = !!(user && !user.email && user.telegram_id)
  const isLinkingTelegram = !!(user && user.email && !user.telegram_id)

  const [tab, setTab] = useState('login')      // 'login' | 'register' (только для гостя)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const tgRef = useRef(null)

  // TG-виджет нужен только для линка email→TG (пользователь уже залогинен).
  // Для гостевого логина используем прямую ссылку (без виджета и popup).
  useEffect(() => {
    if (!tgRef.current) return
    tgRef.current.innerHTML = ''
    if (!isLinkingTelegram) return  // виджет только для link-режима

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

    window.__slwTgLink = async (tgUser) => {
      setError('')
      setLoading(true)
      try {
        const data = await linkTelegram(tgUser)
        onSuccess(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    return () => { delete window.__slwTgLink }
  }, [isLinkingTelegram, onSuccess])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let data
      if (isAddingEmail) {
        data = await addEmail(email, password)
      } else {
        const action = tab === 'login' ? login : register
        data = await action(email, password, name)
      }
      onSuccess(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const title = isAddingEmail
    ? 'Добавить email'
    : isLinkingTelegram
      ? 'Подключить Telegram'
      : tab === 'login' ? 'Вход' : 'Регистрация'

  // Форму email/пароль показываем гостю и при добавлении email к TG-аккаунту.
  const showForm = !user || isAddingEmail
  // TG-секцию (виджет + разделитель) скрываем, если юзер уже привязан к TG.
  const showTgSection = !isAddingEmail

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
        {isAddingEmail && (
          <p className={styles.guestHint}>
            Сейчас аккаунт привязан только к Telegram. Добавь email и пароль —
            сможешь входить любым из двух способов.
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

        {showForm && (
          <form onSubmit={handleSubmit} className={styles.form}>
            {tab === 'register' && !user && (
              <input
                className={styles.input}
                placeholder="Имя (необязательно)"
                value={name}
                onChange={e => setName(e.target.value)}
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
            <input
              className={styles.input}
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={tab === 'login' && !isAddingEmail ? 'current-password' : 'new-password'}
            />
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? '...' : title}
            </button>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}

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
