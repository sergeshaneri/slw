import { useEffect, useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import {
  fetchCoachQuota,
  summonCoach,
  fetchCoachHistory,
} from '../../api/client'
import styles from './CoachView.module.css'

const PROMPT_TEMPLATE =
  'Хороший запрос состоит из трёх частей:\n\n' +
  'Роль — кем ты хочешь, чтобы коуч сейчас был для тебя (наставник? собеседник? оппонент?).\n' +
  'Задача — что именно ты хочешь понять или решить.\n' +
  'Контекст — что происходит, какие важные детали.\n\n' +
  'Например:\n' +
  '«Будь моим наставником по белой сенсорике. Помоги понять, почему я откладываю заботу о своём теле. ' +
  'Контекст: уже месяц забиваю на сон, вчера снова не успел поужинать, и это начинает сказываться на работе.»'

export default function CoachView({ diary, onDiaryChange, journey, onJourneyChange }) {
  const [prompt, setPrompt] = useState('')
  const [focusAspect, setFocusAspect] = useState('')
  const [quota, setQuota] = useState(null)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [response, setResponse] = useState(null) // {call_id, text, focus_aspect}
  const [savedToDiary, setSavedToDiary] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const stardustCost = quota?.stardust_cost ?? 100
  const stardust = journey?.stardust ?? 0
  const remaining = quota?.remaining_today ?? 0
  const dailyLimit = quota?.daily_limit ?? 1
  const streakBonus = quota?.streak_bonus ?? 0
  const canCallFree = remaining > 0
  const canBuyWithStardust = !canCallFree && stardust >= stardustCost

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCoachQuota(), fetchCoachHistory(20)])
      .then(([q, h]) => {
        if (cancelled) return
        setQuota(q)
        setHistory(h)
      })
      .catch(e => {
        if (cancelled) return
        setError(e.message ?? 'Не удалось загрузить квоту')
      })
    return () => { cancelled = true }
  }, [])

  const refreshHistory = async () => {
    try {
      const h = await fetchCoachHistory(20)
      setHistory(h)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async (payWithStardust) => {
    const text = prompt.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    setSavedToDiary(false)

    try {
      // Списываем стардаст ДО вызова бэка — так бэк может верить флагу.
      // См. план фичи, секция «Что важно про стардаст-оплату».
      if (payWithStardust && onJourneyChange) {
        await onJourneyChange({ ...journey, stardust: stardust - stardustCost })
      }

      const data = await summonCoach({
        prompt: text,
        focusAspect: focusAspect || null,
        payWithStardust,
      })
      setResponse({
        call_id: data.call_id,
        text: data.response,
        focus_aspect: focusAspect || null,
        prompt: text,
      })
      setQuota(q => q ? {
        ...q,
        used_today: payWithStardust ? q.used_today : q.used_today + 1,
        remaining_today: data.remaining_today,
      } : q)
      refreshHistory()
    } catch (e) {
      setError(e.message ?? 'Ошибка вызова')
      // Откатываем списание стардаста, если бэк отбил.
      if (payWithStardust && onJourneyChange) {
        await onJourneyChange({ ...journey, stardust })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSaveToDiary = () => {
    if (!response || !onDiaryChange || savedToDiary) return
    const entry = {
      id: `coach-${response.call_id}-${Date.now()}`,
      date: new Date().toLocaleDateString('ru-RU'),
      ts: Date.now(),
      aspect: response.focus_aspect ?? 'general',
      text: response.text,
      source: 'coach',
      promptTitle: 'Вызов ИИ-коуча',
      prompt: response.prompt,
      coachCallId: response.call_id,
    }
    onDiaryChange([entry, ...(diary ?? [])])
    setSavedToDiary(true)
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Коуч</span>
        <h1 className={styles.title}>Вызов ИИ-коуча</h1>
      </div>

      <div className={styles.quotaRow}>
        <div className={styles.quotaBadge}>
          {quota
            ? `Сегодня: ${quota.used_today}/${dailyLimit}` + (streakBonus > 0 ? ` (стрик +${streakBonus})` : '')
            : 'Загружаем квоту…'}
        </div>
        <div className={styles.stardust}>
          ⚡ {stardust} стардаст
        </div>
      </div>

      <div className={styles.composer}>
        <div className={styles.hint}>{PROMPT_TEMPLATE}</div>

        <div className={styles.row}>
          <select
            value={focusAspect}
            onChange={e => setFocusAspect(e.target.value)}
            className={styles.select}
          >
            <option value="">Без фокус-аспекта</option>
            {ASPECT_KEYS.map(key => (
              <option key={key} value={key}>{ASPECT_DISPLAY_KEY[key]} · {ASPECT_DATA[key].name}</option>
            ))}
          </select>
        </div>

        <textarea
          className={styles.textarea}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Сформулируй запрос по шаблону Роль / Задача / Контекст…"
          disabled={busy}
          maxLength={4000}
        />

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={busy || !prompt.trim() || !canCallFree}
            className={styles.callButton}
          >
            {busy ? 'Зову…' : 'Позвать'}
          </button>
          {!canCallFree && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={busy || !prompt.trim() || !canBuyWithStardust}
              className={styles.stardustButton}
              title={canBuyWithStardust ? '' : `Нужно ${stardustCost} стардаста`}
            >
              ⚡ Использовать {stardustCost}
            </button>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </div>

      {response && (
        <div
          className={styles.response}
          style={{
            borderColor: response.focus_aspect
              ? `${ASPECT_COLORS[response.focus_aspect]}55`
              : undefined,
          }}
        >
          <div className={styles.responseHead}>
            <span className={styles.responseLabel}>
              Ответ коуча
              {response.focus_aspect && (
                <span
                  className={styles.responseAspect}
                  style={{ color: ASPECT_COLORS[response.focus_aspect] }}
                >
                  {' '}· {response.focus_aspect}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleSaveToDiary}
              disabled={savedToDiary}
              className={styles.saveButton}
            >
              {savedToDiary ? 'Сохранено ✓' : 'Сохранить в дневник'}
            </button>
          </div>
          <div className={styles.responseText}>{response.text}</div>
        </div>
      )}

      {history.length > 0 && (
        <div className={styles.historyBlock}>
          <button
            type="button"
            className={styles.historyToggle}
            onClick={() => setHistoryOpen(v => !v)}
            aria-expanded={historyOpen}
          >
            {historyOpen ? '▲ свернуть историю' : `▼ история вызовов (${history.length})`}
          </button>
          {historyOpen && (
            <div className={styles.historyList}>
              {history.map(call => (
                <HistoryItem key={call.id} call={call} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryItem({ call }) {
  const [open, setOpen] = useState(false)
  const date = new Date(call.created_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className={styles.historyItem}>
      <button
        type="button"
        className={styles.historyHead}
        onClick={() => setOpen(v => !v)}
      >
        <span className={styles.historyDate}>{date}</span>
        {call.focus_aspect && (
          <span
            className={styles.historyAspect}
            style={{ color: ASPECT_COLORS[call.focus_aspect] }}
          >
            {call.focus_aspect}
          </span>
        )}
        {call.paid_with_stardust && <span className={styles.historyPaid}>⚡</span>}
        {call.error && <span className={styles.historyError}>ошибка</span>}
        <span className={styles.historyPrompt}>{call.prompt}</span>
      </button>
      {open && (
        <div className={styles.historyBody}>
          <div className={styles.historyPromptFull}>
            <strong>Запрос:</strong> {call.prompt}
          </div>
          {call.response && (
            <div className={styles.historyResponse}>{call.response}</div>
          )}
          {call.error && (
            <div className={styles.historyErrorText}>{call.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
