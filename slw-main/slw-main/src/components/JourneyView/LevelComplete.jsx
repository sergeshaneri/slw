import styles from './JourneyView.module.css'

export default function LevelComplete({ state, accent, completeText, onProfile }) {
  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.avatar}><span className={styles.avatarGlyph}>◐</span></div>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>Terra Harmonia</div>
          <div className={styles.topbarSub}>Уровень завершён</div>
        </div>
      </div>

      <div className={styles.lcScreen}>
        <div className={styles.lcGlow} aria-hidden="true">★</div>
        <div className={styles.lcTitle}>Уровень 0 пройден</div>
        <div className={styles.lcSubtitle}>Первый контакт установлен</div>

        <div className={styles.lcCard}>
          <div className={styles.lcText}>{completeText}</div>
        </div>

        <div className={styles.lcStats}>
          <div className={styles.lcStat}>
            <div className={styles.lcStatVal}>{state.xp}</div>
            <div className={styles.lcStatLbl}>XP</div>
          </div>
          <div className={styles.lcStat}>
            <div className={styles.lcStatVal}>{state.totalCompleted}</div>
            <div className={styles.lcStatLbl}>Заданий</div>
          </div>
          <div className={styles.lcStat}>
            <div className={styles.lcStatVal}>{state.stardust}</div>
            <div className={styles.lcStatLbl}>✦</div>
          </div>
        </div>

        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} onClick={onProfile}>
          Посмотреть профиль
        </button>
      </div>
    </>
  )
}
