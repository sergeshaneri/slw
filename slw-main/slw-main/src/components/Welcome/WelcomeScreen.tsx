import { useEffect, useState } from 'react'
import AuthModal from '../Auth/AuthModal'
import { getPendingReferralCode } from '../../utils/referral'
import { trackReferralCode } from '../../api/client'
import styles from './WelcomeScreen.module.css'

type ReferrerPreview = {
  name: string
  avatar: string | null
}

const FEATURES = [
  {
    icon: '🌀',
    title: 'Колесо баланса',
    text: 'Оцени 8 аспектов своей личности и увидь, где ты сейчас — наглядно и честно.',
  },
  {
    icon: '🚀',
    title: 'Путешествие',
    text: 'Пошаговый курс через чат-бот — в вебе и Telegram. Теория, вопросы, упражнения.',
  },
  {
    icon: '📓',
    title: 'Дневник',
    text: 'Фиксируй инсайты прямо в процессе. Записи синхронизируются между вебом и ботом.',
  },
]

type Props = {
  // AuthModal передаёт сюда auth-response (token + user). Точная shape
  // приходит из api/client, тут он только пробрасывается вверх.
  // NOTE(ts): AuthModal forwards the raw /auth response object — its
  // exact shape lives behind the same response_model gap as /auth/me.
  onAuthSuccess: (data: unknown) => void
  onContinueAsGuest: () => void
}

export default function WelcomeScreen({ onAuthSuccess, onContinueAsGuest }: Props) {
  const [showAuth, setShowAuth] = useState(false)
  const [referrer, setReferrer] = useState<ReferrerPreview | null>(null)

  // Если в localStorage сохранён ?ref=код — спрашиваем у бэка имя приглашающего
  // и показываем баннер «Тебя пригласил X». Валидный код = есть имя.
  useEffect(() => {
    const code = getPendingReferralCode()
    if (!code) return
    trackReferralCode(code)
      .then(r => {
        if (r.valid && r.referrer_name) {
          setReferrer({ name: r.referrer_name, avatar: r.referrer_avatar ?? null })
        }
      })
      .catch(() => {/* невалидный код — молча игнорируем */})
  }, [])

  return (
    <div className={styles.root}>
      {referrer && (
        <div className={styles.referrerBanner}>
          <span className={styles.referrerAvatar}>{referrer.avatar || '🧑'}</span>
          <div className={styles.referrerText}>
            <strong>{referrer.name}</strong> пригласил{' '}тебя в Колесо Баланса
            <div className={styles.referrerBonus}>
              При регистрации получишь <strong>+50&nbsp;⚡&nbsp;стардаст</strong> — это 2 бесплатных вызова ИИ-коуча
            </div>
          </div>
        </div>
      )}

      <div className={styles.hero}>
        <div className={styles.logo}>🌀</div>
        <h1 className={styles.title}>Соционика</h1>
        <p className={styles.subtitle}>Колесо Баланса</p>
        <p className={styles.tagline}>
          Познай себя через 8 аспектов личности.<br />
          Практический курс с чат-ботом.
        </p>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={onContinueAsGuest}>
            Начать бесплатно
          </button>
          <button className={styles.btnSecondary} onClick={() => setShowAuth(true)}>
            Войти
          </button>
        </div>
      </div>

      <div className={styles.features}>
        {FEATURES.map(f => (
          <div key={f.title} className={styles.card}>
            <div className={styles.cardIcon}>{f.icon}</div>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardText}>{f.text}</p>
          </div>
        ))}
      </div>

      {/* Нижняя CTA уводит сразу в Путешествие. С 2026-05 гостям открыто —
          App.handleContinueAsGuest сам выставит view='journey'. */}
      <button className={styles.bottomCta} onClick={onContinueAsGuest}>
        Начать путешествие →
      </button>

      {showAuth && (
        <AuthModal
          onSuccess={onAuthSuccess}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  )
}
