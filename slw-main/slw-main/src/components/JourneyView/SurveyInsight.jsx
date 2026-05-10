import { useState } from 'react'
import { calcSurveyResult, SURVEY_BLOCKS } from '../../data/journey/skills'
import { resolveSurvey } from '../../data/journey/skills/resolve'
import { getSkillContent, getUnlockedSkillLevel } from '../../data/skills'
import styles from './JourneyView.module.css'

/**
 * SurveyInsight — обязательный экран после каждого прохода анкеты.
 * Юзер пишет рефлексию о навыке. Без текста кнопка «Сохранить» disabled.
 *
 * Если у навыка есть развёрнутый контент (data/skills) и после сохранения
 * пользователь может прочитать L1 «Как развить», текст кнопки меняется
 * на «Сохранить и узнать, как развить →» — handleSurveyInsight в
 * JourneyView потом редиректит в SkillDetail.
 *
 * Если контент есть, навык ядерный (archetype: 'common') и L1 ещё не
 * откроется (cl<1), показывается плашка-анонс: «✓ Сохранено. На следующем
 * уровне здесь откроется...».
 *
 * Props:
 *   activeSurvey: { skillId, pass, answers, ... }
 *   accent: цвет
 *   currentLevel: уровень путешествия по аспекту (0..3)
 *   onSave: (text) => void
 *   onCancel: () => void  — закроет, ответы сохранятся как draft
 */
export default function SurveyInsight({ activeSurvey, accent, currentLevel, onSave, onCancel }) {
  const [text, setText] = useState('')
  const survey = resolveSurvey(activeSurvey.skillId)
  const pass = activeSurvey.pass ?? 1

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

  // Вычисляем actualPasses на основе текущих answers (то же, что и в
  // handleSurveyInsight). Нужно для текста кнопки и плашки.
  const blockKeys = SURVEY_BLOCKS.map(b => b.id)
  let actualPasses = 0
  for (const k of blockKeys) {
    const arr = activeSurvey.answers?.[k] ?? []
    const len = arr.filter(n => Number.isFinite(n)).length
    if (len > actualPasses) actualPasses = len
  }
  actualPasses = Math.min(3, actualPasses)

  const cl = currentLevel ?? 0
  const skillContent = getSkillContent(activeSurvey.skillId)
  const willOpenDetail = !!skillContent && getUnlockedSkillLevel(cl, actualPasses) >= 1
  const isCore = skillContent?.archetype === 'common' || skillContent?.role === 'core'
  const showCoreAnnounce = !!skillContent && isCore && !willOpenDetail

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

        {showCoreAnnounce && (
          <div className={styles.surveyAnnounce}>
            <span className={styles.surveyAnnounceCheck}>✓</span>
            Твой инсайт пойдёт в копилку. На следующем уровне путешествия здесь откроется
            развёрнутый материал — <strong>как развивать «{survey.name}»</strong> и
            какие <strong>психологические черты</strong> этот навык формирует.
          </div>
        )}

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
            {willOpenDetail ? 'Сохранить и узнать, как развить →' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
