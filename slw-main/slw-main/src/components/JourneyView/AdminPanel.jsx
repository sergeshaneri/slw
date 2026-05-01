import { useState } from 'react'
import { getJourney, getAllPlanets } from '../../data/journey/registry'
import styles from './AdminPanel.module.css'

// Dev-панель для админ-аккаунтов (user.is_admin === true).
// Видна только им, обычные пользователи её не видят.
//
// Функции:
//   1. Switch planet    — быстрое переключение между доступными аспектами.
//   2. Skip step        — пропустить текущий шаг в чате (без XP, без записи).
//   3. Auto-fill survey — заполнить активную анкету на 7/10 и завершить.
//   4. Fill all skills  — все БС-навыки = 7/10 (мгновенно открывает БС-колесо).
//   5. Jump to level    — выбор уровня L0/L1, mode='core'.
//   6. Reset            — полный сброс journey state (без подтверждения).
export default function AdminPanel({
  state,
  onSkipStep,
  onFillSurvey,
  onFillAllSkills,
  onOpenSkillsEditor,
  onJumpLevel,
  onReset,
  onSwitchAspect,
  aspect = 'БС'
}) {
  const [open, setOpen] = useState(false)

  const journey = getJourney(aspect)
  const levels = journey?.levels ?? {}
  const levelKeys = Object.keys(levels).map(n => parseInt(n, 10)).sort((a, b) => a - b)

  const planets = getAllPlanets().filter(p => p.available)

  const isChat = state.screen === 'chat'
  const isSurvey = state.screen === 'survey' && !!state.activeSurvey

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.toggle} ${open ? styles.toggleOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Dev panel"
        title="Admin / dev panel"
      >
        🛠
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Admin panel">
          <div className={styles.title}>Dev панель</div>

          {onSwitchAspect && planets.length > 1 && (
            <>
              <div className={styles.section}>Планета</div>
              <div className={styles.levelRow}>
                {planets.map(p => (
                  <button
                    key={p.aspect}
                    type="button"
                    className={`${styles.levelBtn} ${aspect === p.aspect ? styles.levelBtnActive : ''}`}
                    onClick={() => { onSwitchAspect(p.aspect); setOpen(false) }}
                    title={p.name}
                  >
                    {p.aspect}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            className={styles.btn}
            onClick={onSkipStep}
            disabled={!isChat}
            title={!isChat ? 'Доступно только в чате' : 'Пропустить текущий шаг (без XP)'}
          >
            ⤼ Skip step
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={onFillSurvey}
            disabled={!isSurvey}
            title={!isSurvey ? 'Доступно только в активной анкете' : 'Заполнить анкету = 7/10 и завершить'}
          >
            ▣ Auto-fill survey
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={onFillAllSkills}
            title="Все 33 навыка = 7/10 (открывает колесо БС)"
          >
            ✦ Fill all skills 7/10
          </button>

          {onOpenSkillsEditor && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => { onOpenSkillsEditor(); setOpen(false) }}
              title="Список навыков с per-skill контролем (значение, глубина)"
            >
              ⚙ Настроить навыки…
            </button>
          )}

          <div className={styles.section}>Уровень</div>
          <div className={styles.levelRow}>
            {levelKeys.map(n => (
              <button
                key={n}
                type="button"
                className={`${styles.levelBtn} ${state.currentLevel === n ? styles.levelBtnActive : ''}`}
                onClick={() => onJumpLevel(n)}
                title={levels[n]?.title ?? `L${n}`}
              >
                L{n}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={onReset}
            title="Сбросить весь прогресс journey"
          >
            ⟲ Reset journey
          </button>
        </div>
      )}
    </div>
  )
}
