import type { CSSProperties } from 'react'
import { COMMON_BASE_SKILLS } from '../../data/journey/fe-skills'
import { getSkillContent } from '../../data/skills'
import styles from './JourneyView.module.css'

/**
 * FeCoreOverview — экран «Изучить универсальные навыки» для аспекта Fe.
 *
 * Показывает 3 ядерных навыка ЧЭ (Эмо-осознанность, Выразительность,
 * Конгруэнтность) карточками. Клик по карточке открывает SkillDetail
 * соответствующего навыка; ← возвращается в этот же overview.
 *
 * Открывается из вилки после завершения уровня Fe-путешествия.
 */

// NOTE(ts): tightened in P3 after data/skills/ TS conversion.
type SkillContentLike = {
  name?: string
  intro?: string
}

type AccentStyle = CSSProperties & { '--accent'?: string }

type Props = {
  accent?: string
  onOpenSkill: (skillId: string) => void
  onClose: () => void
}

export default function FeCoreOverview({ accent, onOpenSkill, onClose }: Props) {
  const shellStyle: AccentStyle = { '--accent': accent }

  return (
    <div className={styles.coreOverviewShell} style={shellStyle}>
      <div className={styles.treeHeader}>
        <button
          type="button"
          className={styles.treeBackBtn}
          onClick={onClose}
          aria-label="Назад"
        >
          <span aria-hidden="true">←</span>
          <span>Назад</span>
        </button>
        <div className={styles.treeHeaderTitleBlock}>
          <div className={styles.treeHeaderTitle}>Универсальные навыки ЧЭ</div>
          <div className={styles.treeHeaderSub}>фундамент всех четырёх архетипов</div>
        </div>
      </div>

      <div className={styles.coreOverviewBody}>
        <p className={styles.coreOverviewIntro}>
          Эти три навыка проходят через все четыре архетипа ЧЭ как фундамент.
          Выбери, с какого начнёшь — открой материал «Как развить» и психологические черты.
        </p>

        {COMMON_BASE_SKILLS.map(skill => {
          const content = getSkillContent(skill.id) as SkillContentLike | null | undefined
          return (
            <button
              key={skill.id}
              type="button"
              className={styles.coreOverviewCard}
              onClick={() => onOpenSkill(skill.id)}
            >
              <div className={styles.coreOverviewCardName}>{content?.name ?? skill.name}</div>
              {content?.intro && (
                <div className={styles.coreOverviewCardIntro}>{content.intro}</div>
              )}
              <span className={styles.coreOverviewCardCta}>
                Узнать, как развить <span aria-hidden="true">→</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
