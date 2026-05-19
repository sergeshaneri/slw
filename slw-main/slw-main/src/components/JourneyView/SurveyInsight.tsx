import { useState } from 'react'
import type { CSSProperties } from 'react'
import { calcSurveyResult, SURVEY_BLOCKS } from '../../data/journey/skills'
import { resolveSurvey } from '../../data/journey/skills/resolve'
import { getSkillContent, getUnlockedSkillLevel } from '../../data/skills'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
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
 */

// Activator shape passed in via state.activeSurvey. Реальный shape в
// JourneyView шире, чем ActiveSurvey из types/journey — содержит pass,
// answers, scriptId, ещё. NOTE(ts): tightened in P3 after JourneyView lands.
type ActiveSurveyLike = {
  skillId: string
  pass?: number
  answers?: Record<string, Array<number | null | undefined>>
}

// NOTE(ts): tightened in P3 after data/skills/ TS conversion.
type SkillContentLike = {
  name?: string
  archetype?: string
  role?: string
}

type AccentStyle = CSSProperties & { '--accent'?: string }

type Props = {
  activeSurvey: ActiveSurveyLike
  accent?: string
  currentLevel?: number | null
  onSave: (text: string) => void
  onCancel: () => void
}

export default function SurveyInsight({ activeSurvey, accent, currentLevel, onSave, onCancel }: Props) {
  const [text, setText] = useState<string>('')
  const [sendKeyMode] = useSendKeyMode()
  const survey = resolveSurvey(activeSurvey.skillId)
  const pass = activeSurvey.pass ?? 1

  // calcSurveyResult expects Record<string, number[]>, наш активный буфер
  // может содержать undefined-ячейки в массиве — отфильтровываем.
  const cleanedAnswers: Record<string, number[]> = {}
  if (activeSurvey.answers) {
    for (const [k, v] of Object.entries(activeSurvey.answers)) {
      cleanedAnswers[k] = (v ?? []).filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    }
  }
  const result = calcSurveyResult(cleanedAnswers)
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
    const len = arr.filter(n => typeof n === 'number' && Number.isFinite(n)).length
    if (len > actualPasses) actualPasses = len
  }
  actualPasses = Math.min(3, actualPasses)

  const cl = currentLevel ?? 0
  const skillContent = getSkillContent(activeSurvey.skillId) as SkillContentLike | null | undefined
  const willOpenDetail = !!skillContent && getUnlockedSkillLevel(cl, actualPasses) >= 1
  const isCore = skillContent?.archetype === 'common' || skillContent?.role === 'core'
  const showCoreAnnounce = !!skillContent && isCore && !willOpenDetail

  const canSave = text.trim().length > 0
  const passLabel = pass === 1 ? '1/3' : pass === 2 ? '2/3' : '3/3'

  const shellStyle: AccentStyle = { '--accent': accent }

  return (
    <div className={styles.surveyShell} style={shellStyle}>
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
            {skillAvg != null && Number.isFinite(skillAvg) ? skillAvg.toFixed(1) : '—'}<span className={styles.insightAvgTotal}>/10</span>
          </div>
        </div>

        <div className={styles.insightBlocks}>
          {SURVEY_BLOCKS.map(b => {
            const v = result.blocks?.[b.id]
            return (
              <div key={b.id} className={styles.insightBlockRow}>
                <span className={styles.insightBlockName}>{b.name}</span>
                <span className={styles.insightBlockVal}>
                  {v != null && Number.isFinite(v) ? v.toFixed(1) : '—'}
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
          onKeyDown={e => {
            if (shouldSendOnKeyDown(e, sendKeyMode) && canSave) {
              e.preventDefault()
              onSave(text.trim())
            }
          }}
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
