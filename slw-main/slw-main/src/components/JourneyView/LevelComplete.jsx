import styles from './JourneyView.module.css'

export default function LevelComplete({
  state, accent,
  completeText,
  levelTitle,
  planetName,
  wheelLabel,
  onProfile,
  nextLevelTitle, onNextLevel,
  onOpenWheel,
  onOpenCoreOverview,
  coreOverviewLabel
}) {
  const levelNum = state.currentLevel ?? 0
  const planet = planetName ?? 'Terra Harmonia'
  const wheelBtnLabel = wheelLabel ?? 'Открыть Колесо БС'

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.avatar}><span className={styles.avatarGlyph}>◐</span></div>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>{planet}</div>
          <div className={styles.topbarSub}>Уровень завершён</div>
        </div>
      </div>

      <div className={styles.lcScreen}>
        <div className={styles.lcGlow} aria-hidden="true">★</div>
        <div className={styles.lcTitle}>{`Уровень ${levelNum} пройден`}</div>
        <div className={styles.lcSubtitle}>{levelNum === 0 ? 'Первый контакт установлен' : (levelTitle ?? '')}</div>

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

        {/* Primary CTA на L0 — открыть Колесо аспекта (дерево навыков).
            Анкеты — параллельный путь, не блокируют переход на L1. */}
        {onOpenWheel && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
            onClick={onOpenWheel}
          >
            {wheelBtnLabel}
          </button>
        )}

        {onNextLevel && (
          <button
            type="button"
            className={`${styles.btn} ${onOpenWheel ? styles.btnGhost : styles.btnPrimary} ${styles.btnFull}`}
            onClick={onNextLevel}
          >
            Перейти на «{nextLevelTitle ?? 'следующий уровень'}»
          </button>
        )}

        {/* Опциональная третья кнопка — «Изучить универсальные навыки»
            (для Fe на L0). Открывает FeCoreOverview с 3 ядерными карточками. */}
        {onOpenCoreOverview && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`}
            onClick={onOpenCoreOverview}
          >
            {coreOverviewLabel ?? 'Изучить универсальные навыки'}
          </button>
        )}

        <button
          type="button"
          className={`${styles.btn} ${(onNextLevel || onOpenWheel || onOpenCoreOverview) ? styles.btnGhost : styles.btnPrimary} ${styles.btnFull}`}
          onClick={onProfile}
        >
          Посмотреть профиль
        </button>
      </div>
    </>
  )
}
