import { getSurvey, getCompletedPasses } from '../../data/journey/skills'
import styles from './JourneyView.module.css'

/**
 * Выбор режима анкеты перед стартом: короткий проход (5 вопросов) или
 * полный (все оставшиеся утверждения за один присест).
 *
 * Показывается, когда юзер тыкнул на навык в дереве и нет draft.
 *
 * Props:
 *   skillId: string
 *   skillName: string
 *   skillEntry: state.skills[skillId] | undefined
 *   accent: string
 *   onChoose: (mode: 'short' | 'full') => void
 *   onCancel: () => void
 */
export default function SurveyChoice({ skillId, skillName, skillEntry, accent, onChoose, onCancel }) {
  const survey = getSurvey(skillId)
  const passesDone = getCompletedPasses(skillEntry)
  const nextPass = passesDone + 1
  const remainingPasses = 3 - passesDone   // 3, 2 или 1
  const shortQuestions = 5
  const fullQuestions = remainingPasses * 5
  const canShowFull = fullQuestions > shortQuestions  // если 5 == 5, не показываем full

  if (!survey) {
    return (
      <div className={styles.surveyShell}>
        <div className={styles.surveyHeader}>
          <button type="button" className={styles.surveyClose} onClick={onCancel} aria-label="Закрыть">✕</button>
          <div className={styles.surveyTitle}>Ошибка</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.surveyShell} style={{ '--accent': accent }}>
      <div className={styles.surveyHeader}>
        <button type="button" className={styles.surveyClose} onClick={onCancel} aria-label="Назад">←</button>
        <div className={styles.surveyTitleBlock}>
          <div className={styles.surveyTitle}>{skillName ?? survey.name}</div>
          <div className={styles.surveySub}>
            {passesDone === 0 && 'Анкета ещё не начата'}
            {passesDone === 1 && 'Пройден 1 короткий проход — есть оценка'}
            {passesDone === 2 && 'Пройдено 2 прохода — оценка точнее'}
          </div>
        </div>
      </div>

      <div className={styles.choiceBody}>
        <p className={styles.choicePrompt}>
          {passesDone === 0
            ? 'Как хочешь оценить этот навык?'
            : 'Хочешь добавить ещё один проход или сразу пройти всё, что осталось?'}
        </p>

        <div className={styles.choiceOptions}>
          <button
            type="button"
            className={styles.choiceOption}
            onClick={() => onChoose('short')}
          >
            <div className={styles.choiceOptionTitle}>
              {passesDone === 0 ? 'Короткая анкета' : `Ещё проход (${nextPass}/3)`}
            </div>
            <div className={styles.choiceOptionDesc}>
              {shortQuestions} вопросов · по одному из каждого блока
            </div>
            <div className={styles.choiceOptionMeta}>
              {passesDone === 0
                ? 'Быстрая первичная оценка. Сможешь углубить позже.'
                : 'Углубит оценку и добавит ещё одну звёздочку (если ещё не добавлено).'}
            </div>
          </button>

          {canShowFull && (
            <button
              type="button"
              className={`${styles.choiceOption} ${styles.choiceOptionFull}`}
              onClick={() => onChoose('full')}
            >
              <div className={styles.choiceOptionTitle}>
                {passesDone === 0 ? 'Полная анкета' : 'Дойти до полной'}
              </div>
              <div className={styles.choiceOptionDesc}>
                {fullQuestions} вопросов · все 5 блоков целиком
              </div>
              <div className={styles.choiceOptionMeta}>
                {passesDone === 0
                  ? 'Подробная оценка за один присест. Дольше, но точнее.'
                  : `Останется ${fullQuestions} вопросов. После — оценка финальная.`}
              </div>
            </button>
          )}
        </div>

        <div className={styles.surveyActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onCancel}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
