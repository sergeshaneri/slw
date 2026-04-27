import { useEffect, useMemo, useState } from 'react'
import { getSurvey, buildSurveyStatements, SURVEY_BLOCKS } from '../../data/journey/skills'
import Slider from './Slider'
import styles from './JourneyView.module.css'

// Поэтапная анкета навыка.
//
// activeSurvey:
//   { skillId, scriptId, mode: 'short'|'full', startPass: 1..3,
//     stepIndex: 0..N-1, answers: {block: [n1, n2?, n3?]} }
//
// Список утверждений вычисляется через buildSurveyStatements:
//   short → 5 утверждений (только startPass)
//   full  → все утверждения от startPass до 3 (5/10/15)
export default function SurveyScreen({ activeSurvey, accent, onAnswer, onBack, onComplete, onCancel }) {
  const survey = getSurvey(activeSurvey.skillId)
  const mode = activeSurvey.mode ?? 'short'
  const startPass = activeSurvey.startPass ?? 1

  const stmts = useMemo(
    () => survey ? buildSurveyStatements(survey, mode, startPass) : [],
    [survey, mode, startPass]
  )

  const total = stmts.length
  const idx = activeSurvey.stepIndex ?? 0
  const isFinished = idx >= total

  const current = stmts[idx]
  const blockKey = current?.blockKey ?? null
  const statement = current?.statement ?? ''
  const statementIndex = current?.statementIndex ?? 0
  const currentPass = current?.pass ?? startPass
  const blockName = SURVEY_BLOCKS.find(b => b.id === blockKey)?.name ?? ''

  useEffect(() => {
    if (isFinished && survey) onComplete()
  }, [isFinished, survey, onComplete])

  const prevAnswer = blockKey
    ? activeSurvey.answers?.[blockKey]?.[statementIndex]
    : null
  const initialValue = Number.isFinite(prevAnswer) ? prevAnswer : 5
  const [value, setValue] = useState(initialValue)
  useEffect(() => {
    setValue(initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  if (!survey) {
    return (
      <div className={styles.surveyShell}>
        <div className={styles.surveyHeader}>
          <button type="button" className={styles.surveyClose} onClick={onCancel} aria-label="Закрыть">✕</button>
          <div className={styles.surveyTitle}>Ошибка анкеты</div>
        </div>
        <div className={styles.surveyBody}>
          <p>Не удалось загрузить анкету для навыка <code>{activeSurvey.skillId}</code>.</p>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onCancel}>Назад</button>
        </div>
      </div>
    )
  }

  if (isFinished) return null

  const sessionLabel =
    mode === 'full'
      ? `Полный · проход ${currentPass}/3`
      : `Короткий · проход ${currentPass}/3`

  return (
    <div className={styles.surveyShell} style={{ '--accent': accent }}>
      <div className={styles.surveyHeader}>
        <button type="button" className={styles.surveyClose} onClick={onCancel} aria-label="Прервать">✕</button>
        <div className={styles.surveyTitleBlock}>
          <div className={styles.surveyTitle}>{survey.name}</div>
          <div className={styles.surveySub}>{sessionLabel} · {blockName} · {idx + 1} из {total}</div>
        </div>
      </div>

      <div className={styles.surveyProgress}>
        <div
          className={styles.surveyProgressFill}
          style={{ width: `${total > 0 ? Math.round(((idx + 1) / total) * 100) : 0}%` }}
        />
      </div>

      <div className={styles.surveyBody}>
        <div className={styles.surveyStatement}>{statement}</div>

        <div className={styles.surveyHint}>Оцени по шкале от 1 (совсем не про меня) до 10 (полностью про меня)</div>

        <Slider value={value} onChange={setValue} />

        <div className={styles.surveyActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onBack}
            disabled={idx === 0}
          >
            ← Назад
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => onAnswer(value)}
          >
            Дальше →
          </button>
        </div>
      </div>
    </div>
  )
}
