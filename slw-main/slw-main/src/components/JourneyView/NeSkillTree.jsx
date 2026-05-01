import { useState } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE, COMMON_BASE_SKILLS,
  getSkillsForArchetype, ALL_SKILL_IDS
} from '../../data/journey/skills/ne-tree'
import styles from './JourneyView.module.css'

// Колесо ЧИ — read-only дерево 36 навыков по 4 архетипам
// (Мудрец, Первооткрыватель, Катализатор, Визионер).
//
// 3 общих базовых навыка (Внимание к сути, Метапознание, Mindfulness)
// не вынесены в отдельную ветку — они отображаются в каждом архетипе
// сверху, помеченные «общий», и входят в средний подсчёт каждого
// архетипа.
//
// Анкеты по навыкам ЧИ пока не реализованы — это задел на будущее.
// Пользователь видит структуру и может изучить состав, но не может
// проходить анкеты как у БС. Когда анкеты появятся, компонент можно
// будет расширить (или объединить с SkillTree через aspect-prop).

export default function NeSkillTree({ accent, onClose, onOpenPlanetMap }) {
  // По умолчанию все ветки свёрнуты — 36 навыков сразу пугают.
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
          <div className={styles.treeHeaderTitle}>Навыки ЧИ</div>
          <div className={styles.treeHeaderSub}>
            {ALL_SKILL_IDS.length} навыков · 4 архетипа
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

      <div className={styles.treeNote}>
        В каждом архетипе три общих базовых сверху —{' '}
        {COMMON_BASE_SKILLS.map(s => s.name.replace(/\s*\(.*\)/, '')).join(', ')}.
        Они входят в средний подсчёт каждого архетипа.
      </div>

      <div className={styles.treeBody}>
        {ARCHETYPE_KEYS.map(key => {
          const arche = ARCHETYPES[key]
          const allSkillsInBranch = getSkillsForArchetype(key)
          const specificCount = (SKILL_TREE[key] ?? []).length
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
                  <span className={styles.treeBranchCount}>{allSkillsInBranch.length}</span>
                  <span className={styles.treeBranchChevron} aria-hidden="true">
                    {isOpen ? '▴' : '▾'}
                  </span>
                </div>
                <div className={styles.treeBranchSubRow}>
                  <span className={styles.treeBranchSub}>{arche.subtitle}</span>
                  <span className={styles.treeBranchAvg}>
                    3 общих + {specificCount} специфичных
                  </span>
                </div>
              </button>

              {isOpen && (
                <>
                  <div className={styles.treeBranchBlurb}>{arche.blurb}</div>
                  <ul className={styles.treeSkillList}>
                    {allSkillsInBranch.map(skill => (
                      <li key={skill.id} className={styles.treeSkillRow}>
                        <div className={`${styles.treeSkill} ${styles.treeSkillReadOnly}`}>
                          <span className={styles.treeSkillName}>
                            {skill.name}
                            {skill.isCommon && (
                              <span className={styles.treeSkillTag}> · общий</span>
                            )}
                          </span>
                          <span className={styles.treeSkillStatus}>скоро · оценка</span>
                        </div>
                      </li>
                    ))}
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
