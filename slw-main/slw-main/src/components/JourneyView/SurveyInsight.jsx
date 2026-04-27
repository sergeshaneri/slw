import { useState } from 'react'
import { getSurvey, calcSurveyResult, SURVEY_BLOCKS } from '../../data/journey/skills'
import styles from './JourneyView.module.css'

/**
 * SurveyInsight — обязательный экран после каждого прохода анкеты.
 * Юзер пишет рефлексию о навыке. Без текста кнопка «Сохранить» disabled.
 *
 * Props:
 *   activeSurvey: { skillId, pass, answers, ... }
 *   accent: цвет
 *   onSave: (text) => void
 *   onCancel: () => void  — закроет, ответы сохранятся как draft
 */
export default function SurveyInsight({ activeSurvey, accent, onSave, onCancel }) {
  const [text, setText] = useState('')
  const survey = getSurvey(activeSurvey.skillId)
  const pass = activeSurvey.pass ?? 1

  // Считаем итоги прохода (из всех накопленных ответов, не только текущего pass).
  const result = calcSurveyResult(activeSurvey.answers ?? {})
  const skillAvg = result.skill

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

  const canSave = text.trim().length > 0
  const passLabel = pass === 1 ? '1/3' : pass === 2 ? '2/3' : '3/3'

  return (
    <div className={styles.surveyShell} style={{ '--accent': accent }}>
      <div className={styles.surveyHeader}>
        <button type="button" className={styles.surveyClose} onClick={onCancel} aria-label="Прервать">✕</button>
        <div className={styles.surveyTitleBlock}>
          <div className={styles.surveyTitle}>{survey.name}</div>
          <div className={styles.surveySub}>Проход {passLabel} · твоя оценка</div>
        </div>
      </div>

      <div className={styles.insightBody}>
        <div className={styles.insightAvgRow}>
          <div className={styles.insightAvgLabel}>Средняя по навыку</div>
          <div className={styles.insightAvgVal}>
            {Number.isFinite(skillAvg) ? skillAvg.toFixed(1) : '—'}<span className={styles.insightAvgTotal}>/10</span>
          </div>
        </div>

        <div className={styles.insightBlocks}>
          {SURVEY_BLOCKS.map(b => {
            const v = result.blocks?.[b.id]
            return (
              <div key={b.id} className={styles.insightBlockRow}>
                <span className={styles.insightBlockName}>{b.name}</span>
                <span className={styles.insightBlockVal}>
                  {Number.isFinite(v) ? v.toFixed(1) : '—'}
                </span>
              </div>
            )
          })}
        </div>

        <div className={styles.insightPrompt}>
          Что думаешь об этом навыке? Запиши для себя на будущее.
        </div>

        <textarea
          className={styles.insightTextarea}
          placeholder="Любая мысль — что заметил, какие ассоциации, что хочешь поменять…"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />

        <div className={styles.surveyActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onCancel}
          >
            Отложить
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => canSave && onSave(text.trim())}
            disabled={!canSave}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
