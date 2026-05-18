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
  const buttonLabel = (() => {
    if (state.onboardingStep === 4) return 'Открыть Карту Планет →'
    if (state.onboardingStep === 3) return 'Доставай сферы жизни'
    return ONBOARDING[Math.min(state.onboardingStep, 3)]?.button ?? 'Далее'
  })()

  const buttonModifier = state.onboardingStep === 4 ? styles.btnAccent : styles.btnPrimary

  const messages = state.messages ?? []

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.avatar}>
          <span className={styles.avatarGlyph}>◐</span>
        </div>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>Terra Harmonia</div>
          <div className={styles.topbarSub}>Коуч по балансу жизни</div>
        </div>
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
          <div className={styles.dots}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className={`${styles.dotsItem} ${state.onboardingStep === i ? styles.dotsItemActive : ''}`} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
