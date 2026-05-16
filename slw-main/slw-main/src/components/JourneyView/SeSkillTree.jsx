import { useState } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  getSkillsForArchetype,
  calcSeArchetypeAvg, getSeSkillProgress
} from '../../data/journey/skills/se-skills'
import { getCompletedPasses } from '../../data/journey/skills'
import styles from './JourneyView.module.css'

// Колесо ЧС — интерактивное дерево 47 навыков по 4 архетипам
// (Защитник, Правитель, Строитель, Герой).
//
// 4 общих базовых навыка (Физическая Заземлённость, Реалистичная Оценка
// Сил, Принятие Решения, Сила Воли) не вынесены в отдельную ветку —
// они отображаются в каждом архетипе сверху, помеченные «общий», и
// входят в средний подсчёт каждого архетипа.
//
// Радикальное Принятие — синергическая вершина зрелой ЧС, помещена в
// архетип Hero как 12-й навык.
//
// Анкеты: 47 анкет (4 общих + 43 специфичных) — те же 5 блоков × 3
// утверждения, что у БС/ЧИ/ЧЛ. Прогрессивная: 5 / 10 / 15 утверждений.
// Источник — `se-surveys.md`.

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

export default function SeSkillTree({ accent, skills, onClose, onStartSkill, onOpenSkillDetail, onOpenPlanetMap }) {
  const progress = getSeSkillProgress(skills ?? {})

  // По умолчанию все ветки свёрнуты — 47 навыков сразу пугают.
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
          <div className={styles.treeHeaderTitle}>Навыки ЧС</div>
          <div className={styles.treeHeaderSub}>
            {progress.completed} / {progress.total} оценено · 4 архетипа
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
        В каждом архетипе четыре общих базовых сверху —{' '}
        {COMMON_BASE_SKILLS.map(s => s.name.replace(/\s*\(.*\)/, '')).join(', ')}.
        Они входят в средний подсчёт каждого архетипа.
      </div>

      <div className={styles.treeBody}>
        {ARCHETYPE_KEYS.map(key => {
          const arche = ARCHETYPES[key]
          const allSkillsInBranch = getSkillsForArchetype(key)
          const specificCount = (SKILL_TREE[key] ?? []).length
          const branchAvg = calcSeArchetypeAvg(skills ?? {}, key)
          const completedInBranch = allSkillsInBranch.filter(
            s => Number.isFinite(skills?.[s.id]?.result)
          ).length
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
                  <span className={styles.treeBranchCount}>
                    {completedInBranch} / {allSkillsInBranch.length}
                  </span>
                  <span className={styles.treeBranchChevron} aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                  </span>
                </div>
                <div className={styles.treeBranchSubRow}>
                  <span className={styles.treeBranchSub}>{arche.subtitle}</span>
                  {Number.isFinite(branchAvg) ? (
                    <span className={styles.treeBranchAvg}>ср. {branchAvg.toFixed(1)}</span>
                  ) : (
                    <span className={styles.treeBranchAvg}>
                      4 общих + {specificCount} специфичных
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <>
                  <div className={styles.treeBranchBlurb}>{arche.blurb}</div>
                  <ul className={styles.treeSkillList}>
                    {allSkillsInBranch.map(skill => {
                      const st = statusFor(skills?.[skill.id])
                      const cls =
                        st.kind === 'full'   ? styles.treeSkillDone :
                        st.kind === 'medium' ? styles.treeSkillMedium :
                        st.kind === 'light'  ? styles.treeSkillLight :
                        st.kind === 'draft'  ? styles.treeSkillDraft :
                        ''
                      const hasPasses = st.kind === 'light' || st.kind === 'medium' || st.kind === 'full'
                      return (
                        <li key={`${key}-${skill.id}`} className={styles.treeSkillRow}>
                          <button
                            type="button"
                            className={`${styles.treeSkill} ${cls}`}
                            onClick={() => onStartSkill?.(skill.id)}
                            disabled={!onStartSkill}
                          >
                            <span className={styles.treeSkillName}>
                              {skill.name}
                              {skill.isCommon && (
                                <span className={styles.treeSkillTag}> · общий</span>
                              )}
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
