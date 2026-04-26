import styles from './JourneyView.module.css'

export default function LevelComplete({
  state, accent,
  completeText,
  levelTitle,
  mode = 'core',
  onProfile,
  nextLevelTitle, onNextLevel,
  onStayPool, poolCount = 0
}) {
  const levelNum = state.currentLevel ?? 0
  const isPoolFinished = mode === 'pool'

  // Заголовки и подписи зависят от того, что юзер только что закончил.
  // Core: «Уровень N пройден» + «Первый контакт установлен» (или
  // оригинальный сабтайтл уровня).
  // Pool: «Дополнительные задания пройдены» — pool кончился.
  const title = isPoolFinished
    ? 'Дополнительные задания пройдены'
    : `Уровень ${levelNum} пройден`
  const subtitle = isPoolFinished
    ? `${levelTitle ?? 'Уровень'} — пул исчерпан`
    : (levelNum === 0 ? 'Первый контакт установлен' : (levelTitle ?? ''))

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.avatar}><span className={styles.avatarGlyph}>◐</span></div>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>Terra Harmonia</div>
          <div className={styles.topbarSub}>{isPoolFinished ? 'Пул пройден' : 'Уровень завершён'}</div>
        </div>
      </div>

      <div className={styles.lcScreen}>
        <div className={styles.lcGlow} aria-hidden="true">★</div>
        <div className={styles.lcTitle}>{title}</div>
        <div className={styles.lcSubtitle}>{subtitle}</div>

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

        {/* Главная кнопка — переход на следующий уровень, если он есть. */}
        {onNextLevel && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
            onClick={onNextLevel}
          >
            Перейти на «{nextLevelTitle ?? 'следующий уровень'}»
          </button>
        )}

        {/* Кнопка «копать здесь дальше» — даём только когда core
            пройден и в уровне есть непустой pool. */}
        {onStayPool && (
          <button
            type="button"
            className={`${styles.btn} ${onNextLevel ? styles.btnGhost : styles.btnPrimary} ${styles.btnFull}`}
            onClick={onStayPool}
          >
            Копать здесь дальше {poolCount > 0 ? `· ${poolCount} заданий` : ''}
          </button>
        )}

        <button
          type="button"
          className={`${styles.btn} ${(onNextLevel || onStayPool) ? styles.btnGhost : styles.btnPrimary} ${styles.btnFull}`}
          onClick={onProfile}
        >
          Посмотреть профиль
        </button>
      </div>
    </>
  )
}
