import { useState } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  getSkillsForArchetype, ALL_SKILL_IDS,
  calcFiArchetypeAvg, getFiSkillProgress
} from '../../data/journey/skills/fi-skills'
import { getCompletedPasses } from '../../data/journey/skills'
import styles from './JourneyView.module.css'

// Колесо БЭ — интерактивное дерево 58 навыков по 4 архетипам
// (Дипломат, Духовник, Хранитель Рода, Друг).
//
// 2 общих базовых корневых навыка (Установление Доверия,
// Внутренняя Сверка с Ценностями) не вынесены в отдельную ветку —
// они отображаются в каждом архетипе сверху, помеченные «общий»,
// и входят в средний подсчёт каждого архетипа.
//
// Анкеты: 58 анкет (2 корневых + 56 архетипных) — те же 5 блоков × 3
// утверждения, что у БС/ЧИ. Прогрессивная: 5 / 10 / 15 утверждений.
// Источник — `fi-surveys.md` (копия `Fi/матрица навыков БЭ.md`).

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

export default function FiSkillTree({ accent, skills, onClose, onStartSkill, onOpenPlanetMap }) {
  const progress = getFiSkillProgress(skills ?? {})

  // По умолчанию все ветки свёрнуты — 58 навыков сразу пугают.
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
          <div className={styles.treeHeaderTitle}>Навыки БЭ</div>
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
        В каждом архетипе два общих корневых сверху —{' '}
        {COMMON_BASE_SKILLS.map(s => s.name).join(', ')}.
        Они входят в средний подсчёт каждого архетипа.
      </div>

      <div className={styles.treeBody}>
        {ARCHETYPE_KEYS.map(key => {
          const arche = ARCHETYPES[key]
          const allSkillsInBranch = getSkillsForArchetype(key)
          const specificCount = (SKILL_TREE[key] ?? []).length
          const branchAvg = calcFiArchetypeAvg(skills ?? {}, key)
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
                      2 общих + {specificCount} специфичных
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
                      return (
                        <li key={skill.id} className={styles.treeSkillRow}>
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
