import { useState } from 'react'
import { ARCHETYPES, SKILL_TO_ARCHETYPE, SKILL_TREE } from '../../data/journey/skills'
import { getSkillContent, getUnlockedSkillLevel } from '../../data/skills/skillsContent'
import styles from './JourneyView.module.css'

// SkillDetail — экран подробного разбора одного навыка.
//
// Показывает три уровня (1, 2, 3). На каждом уровне:
//   — Что развиваешь: формирующаяся черта-Дар (название + раскрытие)
//   — От чего уходишь: устраняемая черта-Тень
//   — Как развить: раскрывающийся блок с практиками и действиями
//
// Уровни выше state.currentLevel показываются «приглушённо» с подписью
// «откроется на уровне N» — это сигнал юзеру вернуться позже.
//
// Props:
//   skillId       — id навыка из tree.js
//   currentLevel  — state.currentLevel (0..3)
//   accent        — цвет аспекта
//   onClose       — назад в дерево навыков
export default function SkillDetail({ skillId, currentLevel, accent, onClose }) {
  const content = getSkillContent(skillId)
  const unlockedLevel = getUnlockedSkillLevel(currentLevel)

  // Найдём базовое имя из tree.js (даже если детального контента ещё нет).
  const archeKey = SKILL_TO_ARCHETYPE[skillId]
  const treeSkill = (SKILL_TREE[archeKey] ?? []).find(s => s.id === skillId)
  const skillName = content?.name ?? treeSkill?.name ?? skillId
  const archeName = ARCHETYPES[archeKey]?.name

  return (
    <div className={styles.treeShell} style={{ '--accent': accent }}>
      <div className={styles.treeHeader}>
        <button
          type="button"
          className={styles.treeBackBtn}
          onClick={onClose}
          aria-label="Назад к навыкам"
        >
          <span aria-hidden="true">←</span>
          <span>Навыки</span>
        </button>
        <div className={styles.treeHeaderTitleBlock}>
          <div className={styles.treeHeaderTitle}>{skillName}</div>
          <div className={styles.treeHeaderSub}>
            {content?.domain && `${content.domain} · `}
            {archeName}
          </div>
        </div>
      </div>

      <div className={styles.treeBody}>
        {!content && (
          <div className={styles.skillDetailEmpty}>
            <div className={styles.skillDetailEmptyTitle}>Подробный разбор скоро будет</div>
            <p className={styles.skillDetailEmptyText}>
              Сейчас этот навык доступен для оценки через анкету.
              Расширенные материалы (черты, практики, действия) появятся в
              следующих обновлениях. Пока — пройди анкету: твоя оценка уже
              работает в колесе.
            </p>
          </div>
        )}

        {content && (
          <>
            {content.intro && (
              <p className={styles.skillDetailIntro}>{content.intro}</p>
            )}

            {[1, 2, 3].map(lvl => {
              const lvlData = content.levels?.[lvl]
              const isUnlocked = unlockedLevel >= lvl
              return (
                <SkillLevelCard
                  key={lvl}
                  level={lvl}
                  data={lvlData}
                  unlocked={isUnlocked}
                />
              )
            })}

            {unlockedLevel < 3 && (
              <div className={styles.skillDetailReturn}>
                <span aria-hidden="true">↩</span>
                <span>
                  Возвращайся, когда пройдёшь {' '}
                  {unlockedLevel < 1
                    ? 'Уровень 1 путешествия'
                    : unlockedLevel < 2
                    ? 'Уровень 2 путешествия'
                    : 'Уровень 3 путешествия'}
                  {' '}— откроются новые слои этого навыка.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Карточка одного уровня с гейтингом.
function SkillLevelCard({ level, data, unlocked }) {
  const [showHow, setShowHow] = useState(false)

  if (!unlocked) {
    return (
      <section className={`${styles.skillLevelCard} ${styles.skillLevelLocked}`}>
        <div className={styles.skillLevelHead}>
          <span className={styles.skillLevelBadge}>Уровень {level}</span>
          <span className={styles.skillLevelLockedTag}>закрыт</span>
        </div>
        <p className={styles.skillLevelLockedText}>
          Откроется, когда пройдёшь Уровень {level} путешествия по аспекту.
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
      </div>

      {data.essence && (
        <p className={styles.skillLevelEssence}>{data.essence}</p>
      )}

      <div className={styles.skillTraits}>
        <div className={`${styles.skillTrait} ${styles.skillTraitGift}`}>
          <div className={styles.skillTraitLabel}>Что развиваешь</div>
          <div className={styles.skillTraitTitle}>{data.gift.title}</div>
          <p className={styles.skillTraitDesc}>{data.gift.desc}</p>
        </div>
        <div className={`${styles.skillTrait} ${styles.skillTraitShadow}`}>
          <div className={styles.skillTraitLabel}>От чего уходишь</div>
          <div className={styles.skillTraitTitle}>{data.shadow.title}</div>
          <p className={styles.skillTraitDesc}>{data.shadow.desc}</p>
        </div>
      </div>

      <button
        type="button"
        className={styles.skillHowBtn}
        onClick={() => setShowHow(v => !v)}
        aria-expanded={showHow}
      >
        <span>Как развить</span>
        <span className={styles.skillHowChevron} aria-hidden="true">
          {showHow ? '▴' : '▾'}
        </span>
      </button>

      {showHow && (
        <div className={styles.skillHow}>
          {data.actions?.length > 0 && (
            <div className={styles.skillHowSection}>
              <div className={styles.skillHowSectionTitle}>Что делает ученик</div>
              <ul className={styles.skillHowList}>
                {data.actions.map((a, i) => (
                  <li key={i} className={styles.skillHowItem}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {data.practices?.length > 0 && (
            <div className={styles.skillHowSection}>
              <div className={styles.skillHowSectionTitle}>Практики</div>
              <ol className={styles.skillHowPractices}>
                {data.practices.map((p, i) => (
                  <li key={i} className={styles.skillHowPractice}>
                    <div className={styles.skillHowPracticeName}>{p.name}</div>
                    <div className={styles.skillHowPracticeDesc}>{p.desc}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {data.criteria?.length > 0 && (
            <div className={styles.skillHowSection}>
              <div className={styles.skillHowSectionTitle}>Критерии освоения</div>
              <ul className={styles.skillHowList}>
                {data.criteria.map((c, i) => (
                  <li key={i} className={styles.skillHowItem}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {data.pitfalls?.length > 0 && (
            <div className={styles.skillHowSection}>
              <div className={styles.skillHowSectionTitle}>Типичные ошибки</div>
              <ul className={styles.skillHowList}>
                {data.pitfalls.map((p, i) => (
                  <li key={i} className={styles.skillHowItem}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
