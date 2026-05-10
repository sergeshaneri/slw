import { useState } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE,
  COMMON_BASE_SKILL_IDS, getSkillsForArchetype,
  calcArchetypeAvg, calcFeScoreFromSkills, getSkillProgress
} from '../../data/journey/fe-skills'
import { getCompletedPasses } from '../../data/journey/skills'
import styles from './JourneyView.module.css'

// Колесо ЧЭ — 4 архетипа, под каждым — список навыков с 3 ядерными сверху.
// Прогрессивная анкета: каждый навык можно пройти за 1, 2 или 3 прохода
// по 5 утверждений. Состояние и UX совпадают с SkillTree.jsx (БС).
//
// Архетипы ЧЭ: Заводила (zavodila), Оратор (orator), Артист (artist),
// Мастер Атмосферы (master_atmo).

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

export default function FeSkillTree({ accent, skills, onClose, onStartSkill, onOpenSkillDetail, onOpenPlanetMap }) {
  const feScore = calcFeScoreFromSkills(skills)
  const progress = getSkillProgress(skills)

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
          <div className={styles.treeHeaderTitle}>Навыки ЧЭ</div>
          <div className={styles.treeHeaderSub}>
            {progress.completed} / {progress.total} оценено
            {Number.isFinite(feScore) && ` · ср. ${feScore.toFixed(1)}/10`}
          </div>
        </div>
        {onOpenPlanetMap && (
          <button
            type="button"
            className={styles.treePlanetsBtn}
            onClick={onOpenPlanetMap}
            aria-label="Карта планет"
            title="Сменить аспект"
          >
            <span aria-hidden="true">🪐</span>
            <span>Планеты</span>
          </button>
        )}
      </div>

      <div className={styles.treeProgress}>
        <div
          className={styles.treeProgressFill}
          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
        />
      </div>

      <div className={styles.treeNote}>
        В каждом архетипе три ядерных навыка сверху —
        Эмоциональная осознанность, Выразительность, Конгруэнтность.
        Они входят в средний подсчёт каждого архетипа.
      </div>

      <div className={styles.treeBody}>
        {ARCHETYPE_KEYS.map(key => {
          const arche = ARCHETYPES[key]
          // 3 ядерных сверху + специфичные навыки архетипа.
          const skillsInBranch = getSkillsForArchetype(key)
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
                <>
                  <div className={styles.treeBranchBlurb}>{arche.blurb}</div>
                  <ul className={styles.treeSkillList}>
                    {skillsInBranch.map(skill => {
                      const st = statusFor(skills?.[skill.id])
                      const cls =
                        st.kind === 'full'   ? styles.treeSkillDone :
                        st.kind === 'medium' ? styles.treeSkillMedium :
                        st.kind === 'light'  ? styles.treeSkillLight :
                        st.kind === 'draft'  ? styles.treeSkillDraft :
                        ''
                      const hasPasses = st.kind === 'light' || st.kind === 'medium' || st.kind === 'full'
                      const isCommon = skill.isCommon || COMMON_BASE_SKILL_IDS.has(skill.id)
                      return (
                        <li key={`${key}-${skill.id}`} className={styles.treeSkillRow}>
                          <button
                            type="button"
                            className={`${styles.treeSkill} ${cls}`}
                            onClick={() => onStartSkill(skill.id)}
                          >
                            <span className={styles.treeSkillName}>
                              {skill.name}
                              {isCommon && <span className={styles.treeSkillCommonTag}>ядерный</span>}
                            </span>
                            <span className={styles.treeSkillStatus}>
                              {st.kind === 'idle'   && 'оценить'}
                              {st.kind === 'light'  && `${st.avg.toFixed(1)}/10 · 1/3 · углубить`}
                              {st.kind === 'medium' && `${st.avg.toFixed(1)}/10 · 2/3 · углубить`}
                              {st.kind === 'full'   && `${st.avg.toFixed(1)}/10 · полная`}
                              {st.kind === 'draft'  && `${st.mode === 'full' ? 'полный' : 'короткий'} · продолжить`}
                            </span>
                          </button>
                          {hasPasses && onOpenSkillDetail && (
                            <button
                              type="button"
                              className={styles.treeSkillInfoBtn}
                              onClick={() => onOpenSkillDetail(skill.id)}
                              aria-label={`Детальный разбор: ${skill.name}`}
                              title="Что развиваешь и как"
                            >
                              ⓘ
                            </button>
                          )}
                          {hasPasses && onOpenSkillDetail && (
                            <button
                              type="button"
                              className={styles.treeSkillDevBtn}
                              onClick={() => onOpenSkillDetail(skill.id)}
                            >
                              Узнать, как развить →
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
