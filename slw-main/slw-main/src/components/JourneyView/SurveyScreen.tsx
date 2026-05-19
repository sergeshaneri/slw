import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { buildSurveyStatements, SURVEY_BLOCKS } from '../../data/journey/skills'
import { resolveSurvey } from '../../data/journey/skills/resolve'
import Slider from './Slider'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import styles from './JourneyView.module.css'

const INSIGHT_HINT_KEY = 'survey_insight_hint_dismissed'

// Поэтапная анкета навыка.
//
// activeSurvey:
//   { skillId, scriptId, mode: 'short'|'full', startPass: 1..3,
//     stepIndex: 0..N-1, answers: {block: [n1, n2?, n3?]} }
//
// Список утверждений вычисляется через buildSurveyStatements:
//   short → 5 утверждений (только startPass)
//   full  → все утверждения от startPass до 3 (5/10/15)

// NOTE(ts): tightened in P3 after JourneyView lands.
type ActiveSurveyLike = {
  skillId: string
  scriptId?: string
  mode?: 'short' | 'full'
  startPass?: number
  stepIndex?: number
  answers?: Record<string, Array<number | null | undefined>>
}

type AccentStyle = CSSProperties & { '--accent'?: string }

type Props = {
  activeSurvey: ActiveSurveyLike
  accent?: string
  onAnswer: (value: number, insightText: string) => void
  onBack: () => void
  onComplete: () => void
  onCancel: () => void
}

export default function SurveyScreen({ activeSurvey, accent, onAnswer, onBack, onComplete, onCancel }: Props) {
  const survey = resolveSurvey(activeSurvey.skillId)
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
  const initialValue: number = typeof prevAnswer === 'number' && Number.isFinite(prevAnswer) ? prevAnswer : 5
  const [value, setValue] = useState<number>(initialValue)
  // Инсайт по конкретному утверждению. Раньше сбрасывался на каждом
  // переключении idx — юзер написал инсайт, нажал «← Назад» свериться,
  // вернулся → пусто. Сейчас храним per-statementIndex в Map, восстанавливаем
  // при возврате. (Persistence только in-memory: на reload теряется, но при
  // активной сессии анкеты — сохраняется.)
  const [insightsByIdx, setInsightsByIdx] = useState<Map<number, string>>(() => new Map())
  const [insightOpen, setInsightOpen] = useState<boolean>(false)
  const insightText = insightsByIdx.get(idx) ?? ''
  const setInsightText = (next: string) => {
    setInsightsByIdx(prev => {
      const m = new Map(prev)
      m.set(idx, next)
      return m
    })
  }
  const [sendKeyMode] = useSendKeyMode()
  // Подсказка-тултип: показывается на стартовых вопросах, закрывается крестиком
  // (запоминается в localStorage), и поднимается на ховер через 3 сек.
  const [hintVisible, setHintVisible] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem(INSIGHT_HINT_KEY) !== '1'
  )
  const [hintHover, setHintHover] = useState<boolean>(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(initialValue)
    // insightOpen: если для этого idx уже есть сохранённый инсайт — открываем
    // textarea заново (он не пустой). Иначе закрыто, ждём явного клика.
    setInsightOpen((insightsByIdx.get(idx) ?? '').length > 0)
    setHintHover(false)
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const dismissHint = () => {
    setHintVisible(false)
    try { localStorage.setItem(INSIGHT_HINT_KEY, '1') } catch { /* ignore */ }
  }

  const startHoverTimer = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setHintHover(true), 3000)
  }

  const stopHoverTimer = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setHintHover(false)
  }

  const handleAnswer = () => {
    onAnswer(value, insightText)
  }

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

  const shellStyle: AccentStyle = { '--accent': accent }

  return (
    <div className={styles.surveyShell} style={shellStyle}>
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

        {/* Необязательный инсайт по этому утверждению. Кнопка «✎ Инсайт» —
           маленькая, ghost. Клик раскрывает textarea. Текст сохраняется
           в дневник при «Дальше». */}
        <div className={styles.surveyInsightRow}>
          <button
            type="button"
            className={styles.surveyInsightBtn}
            onClick={() => setInsightOpen(v => !v)}
            onMouseEnter={startHoverTimer}
            onMouseLeave={stopHoverTimer}
            aria-expanded={insightOpen}
          >
            <span aria-hidden="true">✎</span>
            <span>{insightOpen ? 'Скрыть инсайт' : 'Записать инсайт'}</span>
            {insightText.trim() && !insightOpen && (
              <span className={styles.surveyInsightDot} aria-label="есть текст">●</span>
            )}
          </button>

          {(hintVisible || hintHover) && !insightOpen && (
            <div className={styles.surveyInsightHint} role="tooltip">
              <span>Можешь записать мысль по этому вопросу — попадёт в дневник. Необязательно.</span>
              {hintVisible && (
                <button
                  type="button"
                  className={styles.surveyInsightHintClose}
                  onClick={(e) => { e.stopPropagation(); dismissHint() }}
                  aria-label="Больше не показывать"
                  title="Больше не показывать"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {insightOpen && (
          <textarea
            className={styles.surveyInsightInput}
            value={insightText}
            onChange={e => setInsightText(e.target.value)}
            onKeyDown={e => {
              if (shouldSendOnKeyDown(e, sendKeyMode)) {
                e.preventDefault()
                handleAnswer()
              }
            }}
            placeholder="Что приходит в голову по этому утверждению?"
            rows={3}
            maxLength={1000}
            autoFocus
          />
        )}

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
            onClick={handleAnswer}
          >
            Дальше →
          </button>
        </div>
      </div>
    </div>
  )
}
