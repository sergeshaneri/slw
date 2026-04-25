import { useEffect, useRef, useState, useCallback } from 'react'
import { ASPECT_COLORS } from '../../data/aspects'
import { ONBOARDING } from '../../data/journey/onboarding'
import { getJourney } from '../../data/journey/registry'
import Onboarding from './Onboarding'
import Chat from './Chat'
import LevelComplete from './LevelComplete'
import JourneyProfile from './JourneyProfile'
import TasksScreen from './TasksScreen'
import styles from './JourneyView.module.css'

export const DEFAULT_JOURNEY = {
  screen: 'onboarding',
  onboardingStep: 0,
  currentAspect: 'БС',
  currentLevel: 0,
  messages: [],
  currentScriptIndex: 0,
  currentScriptId: null,
  awaitingInput: null,
  completedScripts: [],
  pendingTasks: [],   // { id, scriptId, aspect, addedAt, status: 'taken' | 'deferred' }
  xp: 0,
  stardust: 0,
  streak: 0,
  totalCompleted: 0,
  lastActiveDate: null
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function calcStreak(s) {
  const t = todayStr()
  if (!s.lastActiveDate) return 1
  if (s.lastActiveDate === t) return s.streak
  const diff = Math.round((new Date(t) - new Date(s.lastActiveDate)) / 86400000)
  return diff === 1 ? s.streak + 1 : 1
}

export default function JourneyView({ journey: extJourney, onJourneyChange, scores, onScoresChange, diary, onDiaryChange, t }) {
  // Локальный стейт — единственный source of truth.
  // Наружу синхронизируется через useEffect (ниже), чтобы persist-callback
  // не ломал серийные setState в одном хэндлере.
  // Мердж с DEFAULT_JOURNEY гарантирует, что у старых юзеров в storage
  // присутствуют все поля (например, pendingTasks мог быть добавлен позже).
  const [state, setState] = useState(() => ({
    ...DEFAULT_JOURNEY,
    ...(extJourney ?? {}),
    messages: extJourney?.messages ?? [],
    completedScripts: extJourney?.completedScripts ?? [],
    pendingTasks: extJourney?.pendingTasks ?? []
  }))

  // Стабильная ссылка на текущий persist-callback (он пересоздаётся
  // каждый рендер родителя — через ref эффект-зависимость остаётся чистой).
  const persistRef = useRef(onJourneyChange)
  useEffect(() => { persistRef.current = onJourneyChange }, [onJourneyChange])

  // Сохраняем стейт наружу при каждом изменении, кроме первого рендера.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    persistRef.current?.(state)
  }, [state])

  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [toast, setToast] = useState(null)
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  const currentJourney = getJourney(state.currentAspect)
  const currentLevel = currentJourney?.levels?.[state.currentLevel]
  const scripts = currentLevel?.scripts ?? []
  const aspectIntro = currentJourney?.intro ?? []
  const accent = ASPECT_COLORS[state.currentAspect] ?? '#4cc9f0'

  useEffect(() => {
    if (chatRef.current) {
      const el = chatRef.current
      const id = setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 80)
      return () => clearTimeout(id)
    }
  }, [state.messages, isTyping, state.screen, state.awaitingInput])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const addBotMessage = useCallback((text, delay = 400) => new Promise((resolve) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setState(s => ({
        ...s,
        messages: [...s.messages, { id: Date.now() + Math.random(), role: 'bot', text }]
      }))
      resolve()
    }, delay)
  }), [setState])

  const addUserMessage = useCallback((text) => {
    setState(s => ({
      ...s,
      messages: [...s.messages, { id: Date.now() + Math.random(), role: 'user', text }]
    }))
  }, [setState])

  const awardXP = useCallback((xp, stardust = 0, scriptId = null) => {
    if (xp <= 0 && stardust <= 0) return
    setState(s => ({
      ...s,
      xp: s.xp + xp,
      stardust: s.stardust + stardust,
      streak: calcStreak(s),
      totalCompleted: s.totalCompleted + 1,
      lastActiveDate: todayStr(),
      completedScripts: scriptId
        ? [...s.completedScripts, scriptId]
        : (s.currentScriptId ? [...s.completedScripts, s.currentScriptId] : s.completedScripts)
    }))
    const parts = []
    if (xp > 0) parts.push(`+${xp} XP`)
    if (stardust > 0) parts.push(`+${stardust} ✦`)
    showToast(parts.join('   '))
  }, [setState, showToast])

  const deliverScript = useCallback((index) => {
    const script = scripts[index]
    if (!script) {
      setState(s => ({ ...s, screen: 'levelcomplete', awaitingInput: null }))
      return
    }
    setState(s => ({
      ...s,
      currentScriptIndex: index,
      currentScriptId: script.id,
      awaitingInput: null,
      // Архивируем скрипт в историю чата — чтобы при пролистывании
      // вверх юзер видел все пройденные карточки.
      messages: [
        ...s.messages,
        { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: script.id }
      ]
    }))
  }, [scripts, setState])

  // ─── Онбординг ───────────────────────────────────────────────
  const handleOnboardingNext = useCallback(async () => {
    const step = state.onboardingStep
    addUserMessage(ONBOARDING[Math.min(step, 3)]?.button || 'Далее')
    if (step < 3) {
      await addBotMessage(ONBOARDING[step + 1].text, 700)
      setState(s => ({ ...s, onboardingStep: step + 1 }))
    } else if (step === 3) {
      await addBotMessage(
        'Доступна планета:\n\nБелая Сенсорика — Terra Harmonia\nМир баланса ощущений: тело, комфорт, уют, здоровье.\n\nНажми, чтобы начать путешествие.',
        900
      )
      setState(s => ({ ...s, onboardingStep: 4 }))
    } else if (step === 4) {
      addUserMessage('Белая Сенсорика — Terra Harmonia')
      await addBotMessage(aspectIntro[0]?.text ?? '...', 900)
      setState(s => ({ ...s, onboardingStep: 5 }))
    } else if (step === 5) {
      addUserMessage(aspectIntro[1]?.button || 'Далее')
      await addBotMessage(aspectIntro[1]?.text ?? '...', 700)
      awardXP(aspectIntro[1]?.xp ?? 10, 0, 'aspect-intro')
      setState(s => ({
        ...s,
        screen: 'chat',
        onboardingStep: 6,
        currentScriptIndex: 0,
        currentScriptId: scripts[0]?.id ?? null,
        messages: scripts[0]
          ? [...s.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: scripts[0].id }]
          : s.messages
      }))
    }
  }, [state.onboardingStep, aspectIntro, scripts, addBotMessage, addUserMessage, awardXP, setState])

  // Помещаем задание в очередь активных (без дублей по scriptId).
  const enqueueTask = useCallback((script, status) => {
    setState(s => ({
      ...s,
      pendingTasks: [
        ...(s.pendingTasks ?? []).filter(t => t.scriptId !== script.id),
        {
          id: `${script.id}-${Date.now()}`,
          scriptId: script.id,
          aspect: state.currentAspect,
          addedAt: Date.now(),
          status
        }
      ]
    }))
  }, [state.currentAspect])

  const removePending = useCallback((scriptId) => {
    setState(s => ({ ...s, pendingTasks: (s.pendingTasks ?? []).filter(t => t.scriptId !== scriptId) }))
  }, [])

  // ─── Действия в чате ─────────────────────────────────────────
  const handleScriptAction = useCallback(async (action, scriptId) => {
    const script = scripts.find(s => s.id === scriptId)
    if (!script) return

    // Postponable types add to pendingTasks.
    const isDeferrable = script.type === 'exercise' || script.type === 'question'

    if (action === 'next' || action === 'done' || action === 'skip') {
      if (action === 'skip') addUserMessage('Пропустить')
      else if (action === 'done') {
        addUserMessage('Взял задание')
        await addBotMessage('Задание добавлено в активные. Открой раздел «Активные задания», когда выполнишь.', 500)
      } else addUserMessage('Позже')

      if (isDeferrable && (action === 'done' || action === 'next')) {
        enqueueTask(script, action === 'done' ? 'taken' : 'deferred')
      }

      awardXP(script.xp, script.stardust ?? 0, script.id)
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 600)
    } else if (action === 'answer_number') {
      setState(s => ({ ...s, awaitingInput: 'number' }))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'answer_text') {
      setState(s => ({ ...s, awaitingInput: 'text' }))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'complete_exercise') {
      addUserMessage('Выполнил')
      await addBotMessage('Отлично. Каждое маленькое действие — это шаг к большим переменам.', 500)
      removePending(script.id)
      awardXP(script.xp, script.stardust ?? 0, script.id)
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 600)
    }
  }, [scripts, state.currentScriptIndex, addBotMessage, addUserMessage, awardXP, deliverScript, enqueueTask, removePending])

  // ─── Ввод текста / числа ─────────────────────────────────────
  const handleSend = useCallback(async () => {
    const val = inputVal.trim()
    if (!val) return
    const script = scripts[state.currentScriptIndex]
    if (state.awaitingInput === 'number') {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 1 || num > 10) {
        await addBotMessage('Пожалуйста, введи число от 1 до 10.', 400)
        return
      }
      addUserMessage(val)
      setInputVal('')
      setState(s => ({ ...s, awaitingInput: null }))
      if (script?.followUp) await addBotMessage(script.followUp(val), 700)
      else await addBotMessage(`Записал: ${val}/10.`, 500)
      // Сайд-эффект: оценка вопроса → score аспекта
      onScoresChange({ ...scores, [state.currentAspect]: num })
      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 10, 0, script?.id ?? null)
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 700)
    } else if (state.awaitingInput === 'text') {
      addUserMessage(val)
      setInputVal('')
      setState(s => ({ ...s, awaitingInput: null }))
      await addBotMessage('Спасибо за честный ответ. Это важная работа.', 600)
      // Сайд-эффект: рефлексия → запись в дневник
      onDiaryChange([
        ...diary,
        {
          id: Date.now(),
          date: new Date().toLocaleDateString('ru-RU'),
          aspect: state.currentAspect,
          text: val,
          source: 'journey',
          scriptId: script?.id ?? null
        }
      ])
      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 10, 0, script?.id ?? null)
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 700)
    }
  }, [inputVal, state.awaitingInput, state.currentScriptIndex, state.currentAspect, scripts, scores, diary, addBotMessage, addUserMessage, awardXP, deliverScript, onDiaryChange, onScoresChange, removePending])

  const handleReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [])

  const goToScreen = useCallback((screen) => {
    setState(s => ({ ...s, screen }))
  }, [setState])

  const currentScript = scripts[state.currentScriptIndex]
  const progressPct = scripts.length > 0
    ? Math.round((state.currentScriptIndex / scripts.length) * 100)
    : 0

  return (
    <div className={styles.shell} style={{ '--accent': accent }}>
      <div className={styles.stars} />

      {state.screen === 'onboarding' && (
        <Onboarding
          state={state}
          accent={accent}
          isTyping={isTyping}
          chatRef={chatRef}
          onNext={handleOnboardingNext}
          aspectIntro={aspectIntro}
        />
      )}

      {state.screen === 'chat' && (
        <Chat
          state={state}
          accent={accent}
          chatRef={chatRef}
          inputRef={inputRef}
          isTyping={isTyping}
          inputVal={inputVal}
          setInputVal={setInputVal}
          currentScript={currentScript}
          scripts={scripts}
          onAction={handleScriptAction}
          onSend={handleSend}
          onOpenProfile={() => goToScreen('profile')}
          onOpenTasks={() => goToScreen('tasks')}
          pendingCount={state.pendingTasks?.length ?? 0}
          aspectName={currentJourney ? `Уровень ${state.currentLevel} · ${currentLevel?.title}` : 'Путешествие'}
          planet={currentJourney?.planet}
        />
      )}

      {state.screen === 'levelcomplete' && (
        <LevelComplete
          state={state}
          accent={accent}
          completeText={currentLevel?.complete?.text ?? ''}
          onProfile={() => goToScreen('profile')}
        />
      )}

      {state.screen === 'profile' && (
        <JourneyProfile
          state={state}
          accent={accent}
          totalSteps={scripts.length}
          progressPct={progressPct}
          levelTitle={currentLevel?.title}
          planet={currentJourney?.planet}
          onContinue={() => goToScreen(state.currentScriptIndex >= scripts.length ? 'levelcomplete' : 'chat')}
          onReset={handleReset}
        />
      )}

      {state.screen === 'tasks' && (
        <TasksScreen
          tasks={state.pendingTasks ?? []}
          scripts={scripts}
          accent={accent}
          onBack={() => goToScreen('chat')}
          onComplete={(script) => {
            removePending(script.id)
            awardXP(script.xp ?? 0, script.stardust ?? 0, script.id)
          }}
          onDelete={(scriptId) => removePending(scriptId)}
        />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
