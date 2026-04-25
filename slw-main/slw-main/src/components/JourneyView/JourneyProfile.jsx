import styles from './JourneyView.module.css'

const ACHIEVEMENTS = [
  { code: 'first_step',  name: 'Первый шаг',         desc: 'Начал путешествие',                  test: s => s.xp > 0 },
  { code: 'theorist',    name: 'Теоретик',           desc: 'Прочитал первую теорию',             test: s => s.completedScripts.includes('T-1') },
  { code: 'honest',      name: 'Честный взгляд',     desc: 'Ответил на вопрос самооценки',       test: s => s.completedScripts.includes('B-1') },
  { code: 'practitioner',name: 'Практик',            desc: 'Выполнил первое упражнение',         test: s => s.completedScripts.includes('U-1') },
  { code: 'collector',   name: 'Коллекционер слов',  desc: 'Собрал 3 слова дня',                 test: s => s.stardust >= 3 },
  { code: 'on_fire',     name: 'На огне',            desc: 'Streak 3 дня подряд',                test: s => s.streak >= 3 },
  { code: 'master_l0',   name: 'Первый Мастер',      desc: 'Завершил Уровень 0',                 test: (s, n) => n != null && s.currentScriptIndex >= n }
]

export default function JourneyProfile({ state, accent, totalSteps, progressPct, levelTitle, planet, onContinue, onReset }) {
  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.avatar}><span className={styles.avatarGlyph}>◐</span></div>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>Мой профиль</div>
          <div className={styles.topbarSub}>Исследователь</div>
        </div>
      </div>

      <div className={styles.profileScroll}>
        <div className={styles.profileHero}>
          <div className={styles.profilePlanet}>◐</div>
          <div className={styles.profileTitle}>Белая Сенсорика</div>
          <div className={styles.profileSubtitle}>{planet} · Уровень {state.currentLevel}</div>
        </div>

        <div className={styles.statsGrid}>
          <Stat val={state.xp} lbl="Опыт XP" accent={accent} />
          <Stat val={state.streak} lbl="Streak дней" accent={accent} />
          <Stat val={state.totalCompleted} lbl="Заданий" accent={accent} />
          <Stat val={state.stardust} lbl="Stardust" accent={accent} />
        </div>

        <div className={styles.progressBox}>
          <div className={styles.progressTitle}>
            <span>Прогресс уровня · {levelTitle ?? '—'}</span>
            <span className={styles.progressCount}>{state.currentScriptIndex}/{totalSteps}</span>
          </div>
          <div className={styles.progressBarWrap}>
            <div
              className={styles.progressBar}
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
            />
          </div>
        </div>

        <div className={styles.achievementsBox}>
          <div className={styles.achievementsTitle}>Достижения</div>
          {ACHIEVEMENTS.map(a => {
            const done = a.test(state, totalSteps)
            return (
              <div key={a.code} className={`${styles.achievement} ${done ? '' : styles.achievementLocked}`}>
                <div className={styles.achievementName}>{a.name}</div>
                <div className={styles.achievementDesc}>{a.desc}</div>
                {done && <span className={styles.achievementCheck} style={{ color: accent }}>✓</span>}
              </div>
            )
          })}
        </div>

        {state.currentScriptIndex < totalSteps && (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} onClick={onContinue}>
            Продолжить путешествие
          </button>
        )}

        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`} onClick={onReset}>
          Начать заново
        </button>
      </div>
    </>
  )
}

function Stat({ val, lbl, accent }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statVal} style={{ color: accent }}>{val}</div>
      <div className={styles.statLbl}>{lbl}</div>
    </div>
  )
}
