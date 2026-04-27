import { useState } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE,
  calcArchetypeAvg, calcBSScoreFromSkills, getSkillProgress,
  getCompletedPasses
} from '../../data/journey/skills'
import styles from './JourneyView.module.css'

// Меню веток талантов: 4 архетипа, под каждым — список навыков.
// Прогрессивная анкета: каждый навык можно пройти за 1, 2 или 3 прохода
// по 5 утверждений. Статус навыка:
//   passes=0      → «оценить» (idle)
//   passes=1      → «light · 1/3 · продолжить»
//   passes=2      → «medium · 2/3 · продолжить»
//   passes=3      → «full · {avg}/10» (done)
//   draft         → «продолжить с того же места»
//
// Клик по навыку запускает следующий проход (или продолжает draft).

function statusFor(skillState) {
  if (!skillState) return { kind: 'idle' }
  if (skillState.draft) {
    const d = skillState.draft
    return {
      kind: 'draft',
      mode: d.mode ?? 'short',
      startPass: d.startPass ?? d.pass ?? 1,
      stepIndex: d.stepIndex ?? d.blockIndex ?? 0,
    }
  }
  const passes = getCompletedPasses(skillState)
  if (passes === 0) return { kind: 'idle' }
  if (passes >= 3) return { kind: 'full', avg: skillState.result }
  if (passes === 2) return { kind: 'medium', avg: skillState.result }
  return { kind: 'light', avg: skillState.result }
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
          className={styles.treeBackBtn}
          onClick={onClose}
          aria-label="Назад в путешествие"
        >
          <span aria-hidden="true">←</span>
          <span>Путешествие</span>
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
                    const cls =
                      st.kind === 'full'   ? styles.treeSkillDone :
                      st.kind === 'medium' ? styles.treeSkillMedium :
                      st.kind === 'light'  ? styles.treeSkillLight :
                      st.kind === 'draft'  ? styles.treeSkillDraft :
                      ''
                    return (
                      <li key={skill.id}>
                        <button
                          type="button"
                          className={`${styles.treeSkill} ${cls}`}
                          onClick={() => onStartSkill(skill.id)}
                        >
                          <span className={styles.treeSkillName}>{skill.name}</span>
                          <span className={styles.treeSkillStatus}>
                            {st.kind === 'idle'   && 'оценить'}
                            {st.kind === 'light'  && `${st.avg.toFixed(1)}/10 · 1/3 · углубить`}
                            {st.kind === 'medium' && `${st.avg.toFixed(1)}/10 · 2/3 · углубить`}
                            {st.kind === 'full'   && `${st.avg.toFixed(1)}/10 · полная`}
                            {st.kind === 'draft'  && `${st.mode === 'full' ? 'полный' : 'короткий'} · продолжить`}
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
