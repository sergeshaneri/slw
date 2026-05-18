import type { CSSProperties } from 'react'
import {
  getSkillContent,
  getUnlockedSkillLevel,
  getSkillName,
  getArchetypeNameForSkill
} from '../../data/skills'
import InsightInput from './InsightInput'
import styles from './JourneyView.module.css'

/**
 * SkillTraits — экран «Какие психологические черты это развивает».
 *
 * Содержит для каждого из 3 уровней:
 *   - gift (формируемая черта)
 *   - shadow (устраняемая тень)
 *   - precaution (только L3, опционально)
 *   - dilemma (только L3, опционально)
 *   - InsightInput (для unlocked-уровней)
 *
 * Гейтинг открытия уровней совпадает с SkillDetail (cl≥N ∧ passes≥N).
 */

// NOTE(ts): tightened in P3 after data/skills/ TS conversion.
type SkillTraitData = { title: string; desc: string }
type SkillLevelData = {
  typage?: string
  gift?: SkillTraitData
  shadow?: SkillTraitData
  precaution?: string
  dilemma?: { name: string; desc: string }
}
type SkillContent = {
  name?: string
  intro?: string
  levels?: Partial<Record<1 | 2 | 3, SkillLevelData>>
}

type AccentStyle = CSSProperties & { '--accent'?: string }

type Props = {
  skillId: string
  currentLevel?: number | null
  passes?: number | null
  accent?: string
  onSaveInsight?: (skillId: string, level: number, source: string, text: string) => void
  onClose: () => void
}

export default function SkillTraits({ skillId, currentLevel, passes, accent, onSaveInsight, onClose }: Props) {
  const content = getSkillContent(skillId) as SkillContent | null | undefined
  const cl = currentLevel ?? 0
  const p = passes ?? 0
  const unlockedLevel = getUnlockedSkillLevel(cl, p)

  const skillName = getSkillName(skillId)
  const archeName = getArchetypeNameForSkill(skillId)

  const shellStyle: AccentStyle = { '--accent': accent }

  return (
    <div className={styles.treeShell} style={shellStyle}>
      <div className={styles.treeHeader}>
        <button
          type="button"
          className={styles.treeBackBtn}
          onClick={onClose}
          aria-label="Назад к развитию навыка"
        >
          <span aria-hidden="true">←</span>
          <span>Как развить</span>
        </button>
        <div className={styles.treeHeaderTitleBlock}>
          <div className={styles.treeHeaderTitle}>Психологические черты: {skillName}</div>
          <div className={styles.treeHeaderSub}>{archeName}</div>
        </div>
      </div>

      <div className={styles.treeBody}>
        {!content && (
          <div className={styles.skillDetailEmpty}>
            <div className={styles.skillDetailEmptyTitle}>Подробный разбор скоро будет</div>
            <p className={styles.skillDetailEmptyText}>
              Психологические черты по уровням этого навыка ещё не описаны.
            </p>
          </div>
        )}

        {content && (
          <>
            {([1, 2, 3] as const).map(lvl => {
              const lvlData = content.levels?.[lvl]
              const isUnlocked = lvl <= unlockedLevel
              return (
                <SkillTraitsCard
                  key={lvl}
                  level={lvl}
                  data={lvlData}
                  unlocked={isUnlocked}
                  skillId={skillId}
                  currentLevel={cl}
                  passes={p}
                  accent={accent}
                  onSaveInsight={onSaveInsight}
                />
              )
            })}

            {unlockedLevel < 3 && (
              <div className={styles.skillDetailReturn}>
                <span aria-hidden="true">↩</span>
                <span>Закрытые уровни откроются на следующих этапах путешествия.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function lockMessage(level: number, currentLevel?: number | null, passes?: number | null): string {
  const cl = currentLevel ?? 0
  const p = passes ?? 0
  const journeyOk = cl >= level
  const passesOk = p >= level

  const passNeed =
    level === 1 ? '1 короткую анкету по этому навыку'
    : level === 2 ? '2 коротких анкеты по этому навыку'
    : 'полную анкету (3 прохода) по этому навыку'

  const journeyNeed = `Уровень ${level} путешествия по аспекту`

  if (!journeyOk && !passesOk) {
    return `Откроется, когда пройдёшь ${journeyNeed} и сдашь ${passNeed}.`
  }
  if (!journeyOk) {
    return `Откроется, когда пройдёшь ${journeyNeed}. Анкета — готово ✓`
  }
  return `Откроется, когда сдашь ${passNeed}. Уровень путешествия — готово ✓`
}

type CardProps = {
  level: number
  data: SkillLevelData | undefined
  unlocked: boolean
  skillId: string
  currentLevel: number
  passes: number
  accent?: string
  onSaveInsight?: (skillId: string, level: number, source: string, text: string) => void
}

function SkillTraitsCard({ level, data, unlocked, skillId, currentLevel, passes, accent, onSaveInsight }: CardProps) {
  if (!unlocked) {
    return (
      <section className={`${styles.skillLevelCard} ${styles.skillLevelLocked}`}>
        <div className={styles.skillLevelHead}>
          <span className={styles.skillLevelBadge}>Уровень {level}</span>
          <span className={styles.skillLevelLockedTag}>закрыт</span>
        </div>
        <p className={styles.skillLevelLockedText}>
          {lockMessage(level, currentLevel, passes)}
        </p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className={styles.skillLevelCard}>
        <div className={styles.skillLevelHead}>
          <span className={styles.skillLevelBadge}>Уровень {level}</span>
        </div>
        <p className={styles.skillLevelLockedText}>
          Подробный материал по этому уровню скоро будет.
        </p>
      </section>
    )
  }

  return (
    <section className={styles.skillLevelCard}>
      <div className={styles.skillLevelHead}>
        <span className={styles.skillLevelBadge}>Уровень {level}</span>
        {data.typage && <span className={styles.skillLevelTypage}>{data.typage}</span>}
      </div>

      {data.gift && (
        <div className={styles.skillTraits}>
          <div className={`${styles.skillTrait} ${styles.skillTraitGift}`}>
            <div className={styles.skillTraitLabel}>Что развиваешь</div>
            <div className={styles.skillTraitTitle}>{data.gift.title}</div>
            <p className={styles.skillTraitDesc}>{data.gift.desc}</p>
          </div>
          {data.shadow && (
            <div className={`${styles.skillTrait} ${styles.skillTraitShadow}`}>
              <div className={styles.skillTraitLabel}>От чего уходишь</div>
              <div className={styles.skillTraitTitle}>{data.shadow.title}</div>
              <p className={styles.skillTraitDesc}>{data.shadow.desc}</p>
            </div>
          )}
        </div>
      )}

      {level === 3 && data.dilemma && (
        <div className={styles.skillDilemma}>
          <div className={styles.skillDilemmaLabel}>Глубинная дилемма</div>
          <div className={styles.skillDilemmaName}>{data.dilemma.name}</div>
          <p className={styles.skillDilemmaDesc}>{data.dilemma.desc}</p>
        </div>
      )}

      <InsightInput
        accent={accent}
        placeholder="Что эта черта означает для меня? Где я её вижу у себя?"
        onSave={(text) => onSaveInsight?.(skillId, level, 'traits', text)}
      />
    </section>
  )
}
