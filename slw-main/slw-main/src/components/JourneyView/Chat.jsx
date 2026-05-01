import { useEffect, useState } from 'react'
import ScriptCard from './ScriptCard'
import ScriptButtons from './ScriptButtons'
import Slider from './Slider'
import styles from './JourneyView.module.css'

export default function Chat({
  state, accent, chatRef, inputRef, isTyping,
  inputVal, setInputVal, currentScript, scripts, resolveScript, onAction, onSend,
  onOpenProfile, onOpenTasks, pendingCount = 0,
  onGoToSurveys, surveyRemaining = 0,
  onOpenPlanetMap,
  aspectName, planet
}) {
  // Резолвер из props учитывает level, fallback на текущие scripts.
  const lookup = (m) => {
    if (resolveScript) return resolveScript(m.scriptId, m.level)
    return scripts?.find(s => s.id === m.scriptId) ?? null
  }

  // Локальный стейт ползунка для awaitingInput='number'. Сбрасывается на 5
  // каждый раз, когда новый шаг просит число.
  const [sliderVal, setSliderVal] = useState(5)
  useEffect(() => {
    if (state.awaitingInput === 'number') setSliderVal(5)
  }, [state.awaitingInput, currentScript?.id])

  const handleSendNumber = () => {
    // Передаём через inputVal — handleSend в JourneyView парсит inputVal.
    setInputVal(String(sliderVal))
    // Микро-задержка чтобы setInputVal успел применить значение в стейт.
    setTimeout(onSend, 0)
  }

  const isNumber = state.awaitingInput === 'number'
  const isText = state.awaitingInput === 'text' || state.awaitingInput === 'exercise_note'

  return (
    <>
      <div className={styles.topbar}>
        <button type="button" className={styles.avatar} onClick={onOpenProfile} aria-label="Профиль">
          <span className={styles.avatarGlyph}>◐</span>
        </button>
        {onOpenPlanetMap ? (
          <button
            type="button"
            className={`${styles.topbarInfo} ${styles.topbarInfoBtn}`}
            onClick={onOpenPlanetMap}
            aria-label="Сменить планету"
            title="Карта планет"
          >
            <div className={styles.topbarTitle}>
              {planet ?? 'Путешествие'} <span className={styles.topbarChevron} aria-hidden="true">▾</span>
            </div>
            <div className={styles.topbarSub}>{aspectName}</div>
          </button>
        ) : (
          <div className={styles.topbarInfo}>
            <div className={styles.topbarTitle}>{planet ?? 'Путешествие'}</div>
            <div className={styles.topbarSub}>{aspectName}</div>
          </div>
        )}
        <div className={styles.topbarStats}>
          {surveyRemaining > 0 && onGoToSurveys && (
            <button
              type="button"
              className={styles.skillsBtn}
              onClick={onGoToSurveys}
              aria-label="Оценить навыки"
              title={`Непройденных навыков: ${surveyRemaining}`}
            >
              <span>Оценить навыки</span>
              <span className={styles.skillsBtnCount}>{surveyRemaining}</span>
            </button>
          )}
          <button
            type="button"
            className={`${styles.tasksToggle} ${pendingCount > 0 ? styles.tasksToggleActive : ''}`}
            onClick={onOpenTasks}
            aria-label="Активные задания"
            title={pendingCount > 0 ? `Активных: ${pendingCount}` : 'Активные задания'}
          >
            <span className={styles.tasksBulb} aria-hidden="true">●</span>
            {pendingCount > 0 && <span className={styles.tasksCount}>{pendingCount}</span>}
          </button>
          <span className={styles.xpBadge}>{state.xp} XP</span>
        </div>
      </div>

      <div className={styles.chatScroll} ref={chatRef}>
        {state.messages.map(m => {
          if (m.kind === 'script') {
            const sc = lookup(m)
            if (!sc) return null
            return <ScriptCard key={m.id} script={sc} />
          }
          return (
            <div key={m.id} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : ''}`}>
              {m.role === 'bot' && <div className={styles.msgAvatar}>◐</div>}
              <div className={`${styles.msgBubble} ${m.role === 'user' ? styles.msgBubbleUser : styles.msgBot}`}>{m.text}</div>
            </div>
          )
        })}

        {isTyping && (
          <div className={styles.typing}>
            <div className={styles.msgAvatar}>◐</div>
            <div className={styles.typingDots}>
              <div className={styles.dot} />
              <div className={styles.dot} />
              <div className={styles.dot} />
            </div>
          </div>
        )}

        {!isTyping && currentScript && !state.awaitingInput && (
          <ScriptButtons script={currentScript} onAction={onAction} />
        )}

        {state.awaitingInput && (
          <div className={styles.msg}>
            <div className={styles.msgAvatar}>◐</div>
            <div className={`${styles.msgBubble} ${styles.msgHint}`}>
              {isNumber && 'Поставь оценку от 1 до 10'}
              {state.awaitingInput === 'exercise_note' && 'Кратко опиши, как прошло упражнение'}
              {state.awaitingInput === 'text' && 'Напиши свой ответ'}
            </div>
          </div>
        )}
      </div>

      {/* Числовой ввод — слайдер вместо textarea */}
      {isNumber && (
        <div className={styles.numberInputArea}>
          <Slider value={sliderVal} onChange={setSliderVal} />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
            onClick={handleSendNumber}
          >
            Ответить · {sliderVal}/10
          </button>
        </div>
      )}

      {/* Текстовый ввод — старый textarea */}
      {isText && (
        <div className={styles.inputArea}>
          <textarea
            ref={inputRef}
            className={styles.inputField}
            placeholder={
              state.awaitingInput === 'exercise_note'
                ? 'Что вышло…'
                : 'Твой ответ…'
            }
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            rows={1}
          />
          <button type="button" className={styles.sendBtn} onClick={onSend} disabled={!inputVal.trim()}>
            ↑
          </button>
        </div>
      )}
    </>
  )
}
