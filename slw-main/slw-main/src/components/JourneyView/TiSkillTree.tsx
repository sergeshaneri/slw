import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  getSkillsForArchetype,
  calcTiArchetypeAvg, getTiSkillProgress
} from '../../data/journey/skills/ti-skills'
import { getCompletedPasses } from '../../data/journey/skills'
import type { SkillStateEntry } from '../../data/journey/skills'
import type { TiArchetypeKey } from '../../data/journey/skills/ti-tree'
import type { SkillTreeNode } from '../../data/journey/skills/tree'
import type { SkillState } from '@/types/journey'
import styles from './JourneyView.module.css'

// Колесо БЛ — интерактивное дерево 41 навыка по 4 архетипам
// (Аналитик, Архитектор, Хранитель Порядка, Энциклопедист).
//
// 3 общих базовых навыка (Структурное мышление, Различение модальностей,
// Дисциплина Ума) не вынесены в отдельную ветку — они отображаются в
// каждом архетипе сверху, помеченные «общий», и входят в средний
// подсчёт каждого архетипа.
//
// Анкеты: 41 анкета (3 общих + 8 + 7 + 11 + 12 = 41) — те же 5 блоков × 3
// утверждения, что у БС/ЧИ/ЧЛ. Прогрессивная: 5 / 10 / 15 утверждений.
// Источник — `ti-surveys.md`.

type SkillStatus =
  | { kind: 'idle' }
  | { kind: 'draft'; mode: string; startPass: number; stepIndex: number }
  | { kind: 'light'; avg: number | undefined }
  | { kind: 'medium'; avg: number | undefined }
  | { kind: 'full'; avg: number | undefined }

function statusFor(skillState: SkillState | undefined): SkillStatus {
  if (!skillState) return { kind: 'idle' }
  if (skillState.draft) {
    // TODO(ts): widen SkillState.draft from unknown to a structured type.
    const d = skillState.draft as {
      mode?: string
      startPass?: number
      pass?: number
      stepIndex?: number
      blockIndex?: number
    }
    return {
      kind: 'draft',
      mode: d.mode ?? 'short',
      startPass: d.startPass ?? d.pass ?? 1,
      stepIndex: d.stepIndex ?? d.blockIndex ?? 0,
    }
  }
  const passes = getCompletedPasses(skillState as SkillStateEntry)
  if (passes === 0) return { kind: 'idle' }
  if (passes >= 3) return { kind: 'full', avg: skillState.result }
  if (passes === 2) return { kind: 'medium', avg: skillState.result }
  return { kind: 'light', avg: skillState.result }
}

type Props = {
  accent: string
  skills: Record<string, SkillState> | undefined
  onClose: () => void
  onStartSkill?: (skillId: string) => void
  onOpenPlanetMap?: () => void
}

export default function TiSkillTree({ accent, skills, onClose, onStartSkill, onOpenPlanetMap }: Props) {
  const progress = getTiSkillProgress((skills ?? {}) as Record<string, SkillStateEntry>)

  // По умолчанию все ветки свёрнуты.
  const [expanded, setExpanded] = useState<Set<TiArchetypeKey>>(() => new Set())
  const toggleBranch = (key: TiArchetypeKey) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className={styles.treeShell} style={{ '--accent': accent } as CSSProperties}>
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
          <div className={styles.treeHeaderTitle}>Навыки БЛ</div>
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
        В каждом архетипе три общих базовых сверху —{' '}
        {COMMON_BASE_SKILLS.map((s: SkillTreeNode) => s.name.replace(/\s*\(.*\)/, '')).join(', ')}.
        Они входят в средний подсчёт каждого архетипа.
      </div>

      <div className={styles.treeBody}>
        {ARCHETYPE_KEYS.map((key: TiArchetypeKey) => {
          const arche = ARCHETYPES[key]
          const allSkillsInBranch = getSkillsForArchetype(key)
          const specificCount = (SKILL_TREE[key] ?? []).length
          const branchAvg = calcTiArchetypeAvg((skills ?? {}) as Record<string, SkillStateEntry>, key)
          const completedInBranch = allSkillsInBranch.filter(
            (s: SkillTreeNode) => Number.isFinite(skills?.[s.id]?.result)
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
                  {branchAvg != null && Number.isFinite(branchAvg) ? (
                    <span className={styles.treeBranchAvg}>ср. {branchAvg.toFixed(1)}</span>
                  ) : (
                    <span className={styles.treeBranchAvg}>
                      3 общих + {specificCount} специфичных
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <>
                  <div className={styles.treeBranchBlurb}>{arche.blurb}</div>
                  <ul className={styles.treeSkillList}>
                    {allSkillsInBranch.map((skill: SkillTreeNode) => {
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
                              {st.kind === 'light'  && `${(st.avg ?? 0).toFixed(1)}/10 · 1/3 · углубить`}
                              {st.kind === 'medium' && `${(st.avg ?? 0).toFixed(1)}/10 · 2/3 · углубить`}
                              {st.kind === 'full'   && `${(st.avg ?? 0).toFixed(1)}/10 · полная`}
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
