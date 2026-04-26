import { useEffect, useMemo, useState } from 'react'
import { getSurvey, SURVEY_BLOCKS, SURVEY_BLOCK_KEYS } from '../../data/journey/skills'
import styles from './JourneyView.module.css'

// Поэтапная анкета навыка. Один шаг = одно утверждение со шкалой 1–10.
//
// Жизненный цикл:
//   1. JourneyView устанавливает screen='survey' + activeSurvey.
//   2. SurveyScreen рендерит текущее утверждение (blockIndex, statementIndex).
//   3. onAnswer(value) — записывает ответ, двигает индексы.
//   4. Когда blockIndex выходит за границы blockKeys — состояние «закончено»,
//      useEffect вызывает onComplete (в JourneyView запись в state.skills,
//      diary, XP, переход в чат).
export default function SurveyScreen({ activeSurvey, accent, onAnswer, onBack, onComplete, onCancel }) {
  const survey = getSurvey(activeSurvey.skillId)

  // Подсчёты текущей позиции и общего числа утверждений.
  const { isFinished, statement, blockKey, blockName, total, passed } = useMemo(() => {
    if (!survey) {
      return { isFinished: true, statement: '', blockKey: null, blockName: '', total: 0, passed: 0 }
    }
    // Считаем только блоки, для которых анкета содержит утверждения.
    const orderedKeys = SURVEY_BLOCK_KEYS.filter(k => (survey.blocks[k] ?? []).length > 0)
    const finished = activeSurvey.blockIndex >= orderedKeys.length
    if (finished) {
      const sum = orderedKeys.reduce((s, k) => s + survey.blocks[k].length, 0)
      return { isFinished: true, statement: '', blockKey: null, blockName: '', total: sum, passed: sum }
    }
    const bk = orderedKeys[activeSurvey.blockIndex]
    const blockArr = survey.blocks[bk] ?? []
    const stmt = blockArr[activeSurvey.statementIndex] ?? ''
    const blockMeta = SURVEY_BLOCKS.find(b => b.id === bk)
    const passedCount = orderedKeys
      .slice(0, activeSurvey.blockIndex)
      .reduce((s, k) => s + (survey.blocks[k]?.length ?? 0), 0) + activeSurvey.statementIndex
    const totalCount = orderedKeys.reduce((s, k) => s + (survey.blocks[k]?.length ?? 0), 0)
    return {
      isFinished: false,
      statement: stmt,
      blockKey: bk,
      blockName: blockMeta?.name ?? '',
      total: totalCount,
      passed: passedCount
    }
  }, [survey, activeSurvey.blockIndex, activeSurvey.statementIndex])

  // Когда анкета пройдена — отдаём наверх. JourneyView сделает setState,
  // SurveyScreen размонтируется (screen перейдёт в 'chat').
  useEffect(() => {
    if (isFinished && survey) {
      onComplete()
    }
  }, [isFinished, survey, onComplete])

  // Локальный стейт ползунка — сбрасывается при смене утверждения.
  // Если пользователь возвращается назад к уже отвеченному — показываем
  // его прежний ответ; иначе стартовое значение 5 (нейтральная середина).
  const prevAnswer = blockKey
    ? activeSurvey.answers?.[blockKey]?.[activeSurvey.statementIndex]
    : null
  const initialValue = Number.isFinite(prevAnswer) ? prevAnswer : 5
  const [value, setValue] = useState(initialValue)
  useEffect(() => {
    setValue(initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSurvey.blockIndex, activeSurvey.statementIndex])

  if (!survey) {
    // Теоретически возможно, если в md указан skill, которого нет в SURVEYS.
    return (
      <div className={styles.surveyShell}>
        <div className={styles.surveyHeader}>
          <button type="button" className={styles.surveyClose} onClick={onCancel} aria-label="Закрыть">✕</button>
          <div className={styles.surveyTitle}>Ошибка анкеты</div>
        </div>
        <div className={styles.surveyBody}>
          <p>Не удалось загрузить анкету для навыка <code>{activeSurvey.skillId}</code>.</p>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onCancel}>Назад в чат</button>
        </div>
      </div>
    )
  }

  if (isFinished) return null  // ждём, пока useEffect завершит анкету

  return (
    <div className={styles.surveyShell} style={{ '--accent': accent }}>
      <div className={styles.surveyHeader}>
        <button type="button" className={styles.surveyClose} onClick={onCancel} aria-label="Прервать">✕</button>
        <div className={styles.surveyTitleBlock}>
          <div className={styles.surveyTitle}>{survey.name}</div>
          <div className={styles.surveySub}>{blockName} · {passed + 1} из {total}</div>
        </div>
      </div>

      <div className={styles.surveyProgress}>
        <div
          className={styles.surveyProgressFill}
          style={{ width: `${total > 0 ? Math.round(((passed + 1) / total) * 100) : 0}%` }}
        />
      </div>

      <div className={styles.surveyBody}>
        <div className={styles.surveyStatement}>{statement}</div>

        <div className={styles.surveyHint}>Оцени по шкале от 1 (совсем не про меня) до 10 (полностью про меня)</div>

        <div className={styles.surveyValue}>
          <span className={styles.surveyValueNum}>{value}</span>
          <span className={styles.surveyValueTotal}>/10</span>
        </div>

        <div className={styles.surveySliderWrap}>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={value}
            onChange={e => setValue(parseInt(e.target.value, 10))}
            className={styles.surveySlider}
            // --val 0..100 — для градиентной заливки трека до бегунка.
            style={{ '--val': ((value - 1) / 9) * 100 }}
            aria-label="Оценка"
          />
          <div className={styles.surveySliderEnds}>
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        <div className={styles.surveyActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onBack}
            disabled={passed === 0}
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
