import { useState } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE,
  calcArchetypeAvg, calcBSScoreFromSkills, getSkillProgress
} from '../../data/journey/skills'
import styles from './JourneyView.module.css'

// Меню веток талантов: 4 архетипа, под каждым — список навыков.
// Можно выбрать любой навык для оценки. Статус навыка:
//   completedAt → «пройден» + avg
//   draft       → «в процессе (X/15)»
//   ничего      → «не оценено»
//
// Клик по навыку запускает анкету (через onStartSkill). Если есть
// draft — анкета продолжится с прежнего места.

function answeredCountInDraft(draft, totalNeeded = 15) {
  if (!draft?.answers) return 0
  let count = 0
  for (const arr of Object.values(draft.answers)) {
    if (Array.isArray(arr)) {
      for (const v of arr) if (Number.isFinite(v)) count++
    }
  }
  return Math.min(count, totalNeeded)
}

function statusFor(skillState) {
  if (!skillState) return { kind: 'idle' }
  if (Number.isFinite(skillState.result)) {
    return { kind: 'done', avg: skillState.result }
  }
  if (skillState.draft) {
    return { kind: 'draft', answered: answeredCountInDraft(skillState.draft) }
  }
  return { kind: 'idle' }
}

export default function SkillTree({ accent, skills, onClose, onStartSkill }) {
  const bsScore = calcBSScoreFromSkills(skills)
  const progress = getSkillProgress(skills)

  // Multi-accordion: набор раскрытых архетипов. По умолчанию все свёрнуты —
  // 33 навыка сразу пугают, юзер видит только 4 шапки веток и сам решает,
  // куда копать. Toggle через клик на шапке.
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleBranch = (key) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className={styles.treeShell} style={{ '--accent': accent }}>
      <div className={styles.treeHeader}>
        <button
          type="button"
          className={styles.surveyClose}
          onClick={onClose}
          aria-label="Назад в чат"
        >
          ←
        </button>
        <div className={styles.treeHeaderTitleBlock}>
          <div className={styles.treeHeaderTitle}>Навыки БС</div>
          <div className={styles.treeHeaderSub}>
            {progress.completed} / {progress.total} оценено
            {Number.isFinite(bsScore) && ` · ср. ${bsScore.toFixed(1)}/10`}
          </div>
        </div>
      </div>

      <div className={styles.treeProgress}>
        <div
          className={styles.treeProgressFill}
          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
        />
      </div>

      <div className={styles.treeBody}>
        {ARCHETYPE_KEYS.map(key => {
          const arche = ARCHETYPES[key]
          const skillsInBranch = SKILL_TREE[key] ?? []
          const branchAvg = calcArchetypeAvg(skills, key)
          const completed = skillsInBranch.filter(s => Number.isFinite(skills?.[s.id]?.result)).length
          const isOpen = expanded.has(key)
          return (
            <section key={key} className={styles.treeBranch}>
              <button
                type="button"
                className={styles.treeBranchHead}
                onClick={() => toggleBranch(key)}
                aria-expanded={isOpen}
              >
                <div className={styles.treeBranchTitleRow}>
                  <span className={styles.treeBranchGlyph}>{arche.glyph}</span>
                  <span className={styles.treeBranchName}>{arche.name}</span>
                  <span className={styles.treeBranchCount}>{completed} / {skillsInBranch.length}</span>
                  <span className={styles.treeBranchChevron} aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                  </span>
                </div>
                <div className={styles.treeBranchSubRow}>
                  <span className={styles.treeBranchSub}>{arche.subtitle}</span>
                  {Number.isFinite(branchAvg) && (
                    <span className={styles.treeBranchAvg}>ср. {branchAvg.toFixed(1)}</span>
                  )}
                </div>
              </button>

              {isOpen && (
                <ul className={styles.treeSkillList}>
                  {skillsInBranch.map(skill => {
                    const st = statusFor(skills?.[skill.id])
                    return (
                      <li key={skill.id}>
                        <button
                          type="button"
                          className={`${styles.treeSkill} ${
                            st.kind === 'done' ? styles.treeSkillDone : ''
                          } ${st.kind === 'draft' ? styles.treeSkillDraft : ''}`}
                          onClick={() => onStartSkill(skill.id)}
                        >
                          <span className={styles.treeSkillName}>{skill.name}</span>
                          <span className={styles.treeSkillStatus}>
                            {st.kind === 'done' && `${st.avg.toFixed(1)}/10`}
                            {st.kind === 'draft' && `${st.answered}/15 · продолжить`}
                            {st.kind === 'idle' && 'оценить'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
