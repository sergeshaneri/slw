import type { JourneyState, AspectState } from '@/types/journey'
import { ONBOARDING } from '../../data/journey/onboarding'
import styles from './JourneyView.module.css'

/**
 * Онбординг чата — 4 авторских шага + кнопка «Открыть Карту Планет».
 * Тексты в onboarding.md, не переписывать без явной просьбы пользователя.
 * Полноэкранный IntroTour отдельно — открывается кнопкой «🎓 Пройти
 * обучение» в дашборде, но автоматически не вызывается.
 */

// JourneyView передаёт детям «плоский» state: глобальные поля + поля
// активной папки аспекта (см. stateForChildren в JourneyView.jsx).
// Этот тип отражает оба источника одновременно.
type FlatJourneyState = JourneyState & Partial<AspectState>

type Props = {
  state: FlatJourneyState
  accent?: string
  isTyping: boolean
  chatRef: React.RefObject<HTMLDivElement>
  onNext: () => void
  aspectIntro?: unknown
}

export default function Onboarding({ state, isTyping, chatRef, onNext }: Props) {
  const step = state.onboardingStep
  const buttonLabel = (() => {
    if (step === 4) return 'Открыть Карту Планет →'
    if (step === 3) return 'Доставай сферы жизни'
    return ONBOARDING[Math.min(step, 3)]?.button ?? 'Далее'
  })()

  const buttonModifier = step === 4 ? styles.btnAccent : styles.btnPrimary

  // Контекстная плашка: чтобы юзер понимал, где он в потоке.
  // Шаги 0..3 — 4 сообщения короткого введения. Шаг 4 — кнопка-выход
  // на Карту Планет, считаем это переходным состоянием («готово»).
  const progressLabel = step >= 4
    ? 'Готово · дальше — выбор планеты'
    : `Введение · шаг ${step + 1} из 4`

  const messages = state.messages ?? []

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.avatar}>
          <span className={styles.avatarGlyph}>◐</span>
        </div>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>Знакомство с игрой</div>
          <div className={styles.topbarSub}>После введения — выбор сферы жизни</div>
        </div>
      </div>

      <div className={styles.onbBanner} role="status" aria-live="polite">
        <span className={styles.onbBannerDot} aria-hidden="true">●</span>
        <span className={styles.onbBannerText}>{progressLabel}</span>
      </div>

      <div className={styles.chatScroll} ref={chatRef}>
        <div className={styles.msg}>
          <div className={styles.msgAvatar}>◐</div>
          <div className={`${styles.msgBubble} ${styles.msgBot}`}>{ONBOARDING[0].text}</div>
        </div>
        {messages.map(m => (
          <div key={m.id} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : ''}`}>
            {m.role === 'bot' && <div className={styles.msgAvatar}>◐</div>}
            <div className={`${styles.msgBubble} ${m.role === 'user' ? styles.msgBubbleUser : styles.msgBot}`}>{m.text}</div>
          </div>
        ))}
        {isTyping && (
          <div className={styles.typing}>
            <div className={styles.msgAvatar}>◐</div>
            <div className={styles.typingDots}>
              <div className={styles.dot} />
              <div className={styles.dot} />
              <div className={styles.dot} />
            </div>
          </div>
        )}
      </div>

      {!isTyping && (
        <div className={styles.bottomActions}>
          <button type="button" className={`${styles.btn} ${buttonModifier}`} onClick={onNext}>
            {buttonLabel}
          </button>
          <div className={styles.onbProgress} aria-label={progressLabel}>
            <div className={styles.dots} aria-hidden="true">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={`${styles.dotsItem} ${step === i ? styles.dotsItemActive : ''} ${i < step ? styles.dotsItemDone : ''}`} />
              ))}
            </div>
            <span className={styles.onbProgressNum}>
              {step >= 4 ? '✓' : `${step + 1}/4`}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
