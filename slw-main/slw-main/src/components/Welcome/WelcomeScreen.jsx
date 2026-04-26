import AuthModal from '../Auth/AuthModal'
import { useState } from 'react'
import styles from './WelcomeScreen.module.css'

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

export default function WelcomeScreen({ onAuthSuccess, onContinueAsGuest }) {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <div className={styles.root}>
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

      {/* Нижняя CTA уводит сразу в Путешествие. Если юзер не залогинен —
          App покажет AuthModal на handleViewChange (путешествие гейтится). */}
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
