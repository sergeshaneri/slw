import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE,
  calcArchetypeAvg, calcBSScoreFromSkills, getSkillProgress
} from '../../data/journey/skills'
import styles from './BSWheel.module.css'

// Мини-колесо БС с разбивкой по 4 архетипам.
// Появляется на странице аспекта БС в Аспектах.
//
// Источник данных — journey.skills:
//   { [skillId]: { result, blocks, completedAt, answers } }
//
// Расчёт:
//   archetype_score = avg(skill.result для всех навыков ветки)
//   bs_score        = avg(archetype_score для веток с хоть одной анкетой)
//
// Если ни одной анкеты не пройдено — показываем заглушку с CTA.

export default function BSWheel({ skills, color, onContinueSurveys }) {
  const bsScore = calcBSScoreFromSkills(skills)
  const progress = getSkillProgress(skills)
  const isEmpty = progress.completed === 0
  const hasMore = progress.remaining > 0

  return (
    <section className={styles.wheel} style={{ '--accent': color }}>
      <header className={styles.wheelHeader}>
        <div className={styles.wheelTitleBlock}>
          <span className={styles.wheelEyebrow}>Колесо БС</span>
          <h2 className={styles.wheelTitle}>Самооценка по 4 архетипам</h2>
        </div>
        <div className={styles.wheelStat}>
          <div className={styles.wheelStatVal}>
            {Number.isFinite(bsScore) ? bsScore.toFixed(1) : '—'}
            <span className={styles.wheelStatTotal}>/10</span>
          </div>
          <div className={styles.wheelStatLbl}>общее БС</div>
        </div>
      </header>

      {isEmpty ? (
        <div className={styles.wheelEmpty}>
          <p>Колесо пока пустое. Пройди анкеты по 33 навыкам БС — каждая добавит точку самооценки. По мере прохождения колесо наполняется реальной разбивкой по архетипам.</p>
          {onContinueSurveys && (
            <button
              type="button"
              className={styles.wheelCta}
              onClick={onContinueSurveys}
            >
              Начать анкеты →
            </button>
          )}
          <p className={styles.wheelEmptyHint}>Всего {progress.total} анкет, 5 блоков × 3 утверждения в каждой.</p>
        </div>
      ) : (
        <>
          <div className={styles.wheelArches}>
            {ARCHETYPE_KEYS.map(key => {
              const arche = ARCHETYPES[key]
              const avg = calcArchetypeAvg(skills, key)
              const skillsInBranch = SKILL_TREE[key] ?? []
              const completed = skillsInBranch.filter(s => Number.isFinite(skills?.[s.id]?.result)).length
              const total = skillsInBranch.length
              const pct = Number.isFinite(avg) ? (avg / 10) * 100 : 0
              return (
                <div key={key} className={styles.arche}>
                  <div className={styles.archeHead}>
                    <div className={styles.archeTitleBlock}>
                      <span className={styles.archeGlyph}>{arche.glyph}</span>
                      <span className={styles.archeName}>{arche.name}</span>
                    </div>
                    <span className={styles.archeAvg}>
                      {Number.isFinite(avg) ? avg.toFixed(1) : '—'}
                      <span className={styles.archeAvgTotal}>/10</span>
                    </span>
                  </div>
                  <div className={styles.archeBar}>
                    <div className={styles.archeBarFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.archeFoot}>
                    <span className={styles.archeSub}>{arche.subtitle}</span>
                    <span className={styles.archeProgress}>{completed} / {total}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className={styles.wheelFoot}>
            Пройдено {progress.completed} из {progress.total} анкет.
            {progress.remaining > 0 && ` Осталось ${progress.remaining}.`}
          </div>

          {hasMore && onContinueSurveys && (
            <button
              type="button"
              className={styles.wheelCta}
              onClick={onContinueSurveys}
            >
              Продолжить анкеты · {progress.remaining} →
            </button>
          )}
        </>
      )}
    </section>
  )
}
