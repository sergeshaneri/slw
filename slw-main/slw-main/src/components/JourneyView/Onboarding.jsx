import { ONBOARDING } from '../../data/journey/onboarding'
import styles from './JourneyView.module.css'

/**
 * Упрощённый онбординг (2026-05): один вводный экран до Карты Планет.
 * Раньше было 4 шага чата + 5 страниц IntroTour. Теперь весь обзор
 * приложения — кнопка «🎓 Пройти обучение» в дашборде, а контекстные
 * подсказки появляются через <Hint/> по мере навигации.
 */
export default function Onboarding({ state, isTyping, chatRef, onNext }) {
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
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={onNext}>
            {ONBOARDING[0]?.button || 'Открыть карту →'}
          </button>
        </div>
      )}
    </>
  )
}
