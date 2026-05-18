import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { SkillState } from '@/types/journey'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE,
  getCompletedPasses
} from '../../data/journey/skills'
import styles from './AdminSkillsEditor.module.css'

/**
 * Гранулярный редактор навыков для admin/dev.
 * Список всех 33 навыков с per-skill контролями: включить/выключить, значение,
 * глубина проходов. Применить — пишет всё в state.skills одним setState.
 */

export type SkillEdit = {
  enabled: boolean
  value: number
  passes: number
}

export type SkillEdits = Record<string, SkillEdit>

type Props = {
  skills: Record<string, SkillState> | undefined
  onApply: (edits: SkillEdits) => void
  onClose: () => void
}

// CSS custom property `--val` для слайдера-«ползунка»-ranger.
type RangeStyle = CSSProperties & { '--val'?: number }

export default function AdminSkillsEditor({ skills, onApply, onClose }: Props) {
  const [edits, setEdits] = useState<SkillEdits>(() => {
    const init: SkillEdits = {}
    for (const arche of ARCHETYPE_KEYS) {
      for (const s of SKILL_TREE[arche] ?? []) {
        const cur = skills?.[s.id]
        const passes = getCompletedPasses(cur)
        init[s.id] = {
          enabled: passes > 0,
          value: typeof cur?.result === 'number' && Number.isFinite(cur.result) ? Math.round(cur.result) : 7,
          passes: passes > 0 ? passes : 3,
        }
      }
    }
    return init
  })

  // Какие архетипы раскрыты. По умолчанию все, чтобы видеть всё сразу.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>(ARCHETYPE_KEYS))
  const toggleBranch = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const update = (id: string, patch: Partial<SkillEdit>) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const setAllEnabled = (en: boolean) => {
    setEdits(prev => {
      const next: SkillEdits = { ...prev }
      for (const id in next) next[id] = { ...next[id], enabled: en }
      return next
    })
  }

  const setAllValue = (v: number) => {
    setEdits(prev => {
      const next: SkillEdits = { ...prev }
      for (const id in next) next[id] = { ...next[id], value: v, enabled: true }
      return next
    })
  }

  const setBranchEnabled = (archeKey: string, en: boolean) => {
    setEdits(prev => {
      const next: SkillEdits = { ...prev }
      for (const s of SKILL_TREE[archeKey as keyof typeof SKILL_TREE] ?? []) {
        next[s.id] = { ...next[s.id], enabled: en }
      }
      return next
    })
  }

  const enabledCount = Object.values(edits).filter(e => e.enabled).length

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={onClose}
          className={styles.close}
          aria-label="Закрыть"
        >✕</button>
        <div className={styles.titleBlock}>
          <div className={styles.title}>Редактор навыков</div>
          <div className={styles.subtitle}>{enabledCount} из 33 включено</div>
        </div>
      </header>

      <div className={styles.batch}>
        <button type="button" onClick={() => setAllEnabled(true)}>Все ВКЛ</button>
        <button type="button" onClick={() => setAllEnabled(false)}>Все ВЫКЛ</button>
        <div className={styles.batchSep} />
        <span className={styles.batchLabel}>Все на:</span>
        {[3, 5, 7, 9].map(v => (
          <button key={v} type="button" onClick={() => setAllValue(v)}>{v}</button>
        ))}
      </div>

      <div className={styles.body}>
        {ARCHETYPE_KEYS.map(archeKey => {
          const arche = ARCHETYPES[archeKey]
          const branch = SKILL_TREE[archeKey] ?? []
          const isOpen = expanded.has(archeKey)
          const enabledInBranch = branch.filter(s => edits[s.id]?.enabled).length

          return (
            <section key={archeKey} className={styles.branch}>
              <button
                type="button"
                className={styles.branchHead}
                onClick={() => toggleBranch(archeKey)}
              >
                <span className={styles.branchGlyph}>{arche.glyph}</span>
                <span className={styles.branchName}>{arche.name}</span>
                <span className={styles.branchCount}>{enabledInBranch}/{branch.length}</span>
                <span className={styles.branchChevron}>{isOpen ? '▴' : '▾'}</span>
              </button>

              {isOpen && (
                <>
                  <div className={styles.branchBatch}>
                    <button type="button" onClick={() => setBranchEnabled(archeKey, true)}>
                      Ветку ВКЛ
                    </button>
                    <button type="button" onClick={() => setBranchEnabled(archeKey, false)}>
                      Ветку ВЫКЛ
                    </button>
                  </div>
                  <ul className={styles.skillList}>
                    {branch.map(skill => {
                      const e = edits[skill.id]
                      if (!e) return null
                      const rangeStyle: RangeStyle = { '--val': ((e.value - 1) / 9) * 100 }
                      return (
                        <li key={skill.id} className={`${styles.skill} ${e.enabled ? styles.skillOn : ''}`}>
                          <label className={styles.skillToggleLabel}>
                            <input
                              type="checkbox"
                              checked={e.enabled}
                              onChange={ev => update(skill.id, { enabled: ev.target.checked })}
                              className={styles.checkbox}
                            />
                            <span className={styles.skillName}>{skill.name}</span>
                          </label>
                          {e.enabled && (
                            <div className={styles.controls}>
                              <div className={styles.valueRow}>
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  step="1"
                                  value={e.value}
                                  onChange={ev => update(skill.id, { value: parseInt(ev.target.value, 10) })}
                                  className={styles.range}
                                  style={rangeStyle}
                                />
                                <span className={styles.valueNum}>{e.value}/10</span>
                              </div>
                              <div className={styles.passes}>
                                {[1, 2, 3].map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    className={`${styles.passBtn} ${e.passes === p ? styles.passBtnActive : ''}`}
                                    onClick={() => update(skill.id, { passes: p })}
                                    title={p === 1 ? 'light' : p === 2 ? 'medium' : 'full'}
                                  >
                                    P{p}
                                  </button>
                                ))}
                              </div>
                            </div>
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

      <footer className={styles.footer}>
        <button type="button" onClick={onClose} className={styles.btnGhost}>Отмена</button>
        <button
          type="button"
          onClick={() => onApply(edits)}
          className={styles.btnApply}
        >
          Применить · {enabledCount}
        </button>
      </footer>
    </div>
  )
}
