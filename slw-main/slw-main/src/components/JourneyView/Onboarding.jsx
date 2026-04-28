import { ONBOARDING } from '../../data/journey/onboarding'
import styles from './JourneyView.module.css'

export default function Onboarding({ state, accent, isTyping, chatRef, onNext, aspectIntro }) {
  const buttonLabel = (() => {
    if (state.onboardingStep === 4) return 'Открыть Карту Планет →'
    if (state.onboardingStep === 3) return 'Доставай сферы жизни'
    return ONBOARDING[Math.min(state.onboardingStep, 3)]?.button ?? 'Далее'
  })()

  const buttonModifier = state.onboardingStep === 4 ? styles.btnAccent : styles.btnPrimary

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
        {state.messages.map(m => (
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
