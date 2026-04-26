import { useEffect, useRef, useState, useCallback } from 'react'
import { ASPECT_COLORS } from '../../data/aspects'
import { ONBOARDING } from '../../data/journey/onboarding'
import { getJourney } from '../../data/journey/registry'
import { getSurvey, calcSurveyResult, calcBSScoreFromSkills, getSkillProgress, findFirstUnansweredSurveyIndex } from '../../data/journey/skills'
import Onboarding from './Onboarding'
import Chat from './Chat'
import LevelComplete from './LevelComplete'
import JourneyProfile from './JourneyProfile'
import TasksScreen from './TasksScreen'
import SurveyScreen from './SurveyScreen'
import SkillTree from './SkillTree'
import styles from './JourneyView.module.css'

// Версия контента уровня. При несовпадении с сохранённой в state
// чат-история сбрасывается, чтобы юзер увидел новые тексты с начала
// (статистика — XP/streak/totalCompleted — сохраняется).
//
// 3 — добавлен level в script-sообщения (для разрешения коллизий
//     ID между уровнями: T-1 в L0 ≠ T-1 в L1).
// 4 — переписан L1 «Карта и намерение» (25 шагов, 5×5, вопросы
//     формата B). Параллельно введён mode (core/pool), но он
//     совместим со старым state через спред DEFAULT_JOURNEY и
//     сам по себе бампа не требовал.
export const CONTENT_VERSION = 4

export const DEFAULT_JOURNEY = {
  screen: 'onboarding',
  onboardingStep: 0,
  currentAspect: 'БС',
  currentLevel: 0,
  mode: 'core',                 // 'core' | 'pool' — какой массив шагов сейчас в игре
  messages: [],
  currentScriptIndex: 0,
  currentScriptId: null,
  awaitingInput: null,
  completedScripts: [],
  pendingTasks: [],   // { id, scriptId, aspect, addedAt, status: 'taken' | 'deferred' }
  // Результаты анкет навыков БС.
  // skills[skillId] = { result: avg-навыка, blocks: { [blockKey]: avg }, completedAt }
  skills: {},
  // Активная анкета (если открыт screen='survey').
  // activeSurvey = { scriptId, skillId, blockIndex, statementIndex, answers: { [blockKey]: number[] } }
  activeSurvey: null,
  xp: 0,
  stardust: 0,
  streak: 0,
  totalCompleted: 0,
  lastActiveDate: null,
  contentVersion: CONTENT_VERSION
}

// Миграция при загрузке: если у юзера сохранён старый контент,
// сбрасываем чат и счётчик скриптов, но сохраняем XP/streak/dust
// и pendingTasks (их id всё ещё совпадают со скриптами).
function migrateState(stored) {
  if (!stored) return DEFAULT_JOURNEY
  if (stored.contentVersion === CONTENT_VERSION) {
    return {
      ...DEFAULT_JOURNEY,
      ...stored,
      messages: stored.messages ?? [],
      completedScripts: stored.completedScripts ?? [],
      pendingTasks: stored.pendingTasks ?? [],
      skills: stored.skills ?? {},
      activeSurvey: stored.activeSurvey ?? null
    }
  }
  // Контент уровня обновился — сбрасываем сценарий, оставляем достижения
  return {
    ...DEFAULT_JOURNEY,
    xp: stored.xp ?? 0,
    stardust: stored.stardust ?? 0,
    streak: stored.streak ?? 0,
    totalCompleted: stored.totalCompleted ?? 0,
    lastActiveDate: stored.lastActiveDate ?? null,
    completedScripts: [],
    pendingTasks: [],
    contentVersion: CONTENT_VERSION
  }
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
  // migrateState учитывает разные версии контента и пропавшие поля.
  const [state, setState] = useState(() => migrateState(extJourney))

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
  const coreScripts = currentLevel?.core ?? currentLevel?.scripts ?? []
  const poolScripts = currentLevel?.pool ?? []
  // В режиме pool отдаём pool-массив, в core — core. Активная
  // последовательность шагов крутится только по одному из них.
  const scripts = state.mode === 'pool' ? poolScripts : coreScripts
  const aspectIntro = currentJourney?.intro ?? []
  const accent = ASPECT_COLORS[state.currentAspect] ?? '#4cc9f0'

  // Лукап скрипта по {scriptId, level} — нужен в чате для архивных
  // сообщений: T-1 в L0 ≠ T-1 в L1, ID может повторяться между
  // уровнями. Без level сообщения из L0 после перехода на L1
  // показали бы L1-текст.
  // Ищем и в core, и в pool целевого уровня — pool-сообщения
  // тоже архивируются в общий messages.
  const resolveScript = useCallback((scriptId, level) => {
    const lvl = level ?? state.currentLevel
    const lvlData = currentJourney?.levels?.[lvl]
    const inCore = lvlData?.core?.find(s => s.id === scriptId)
    if (inCore) return inCore
    const inPool = lvlData?.pool?.find(s => s.id === scriptId)
    if (inPool) return inPool
    return scripts.find(s => s.id === scriptId) ?? null
  }, [currentJourney, scripts, state.currentLevel])

  const nextLevel = currentJourney?.levels?.[state.currentLevel + 1] ?? null
  const hasPool = poolScripts.length > 0

  // Первый скрол после mount/смены экрана — мгновенный, чтобы юзер
  // сразу видел последние сообщения. Дальше — плавный.
  const isFirstScroll = useRef(true)
  useEffect(() => {
    if (chatRef.current) {
      const el = chatRef.current
      const behavior = isFirstScroll.current ? 'auto' : 'smooth'
      const id = setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior })
        isFirstScroll.current = false
      }, 50)
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
      // Архивируем скрипт в историю чата с level — чтобы lookup всегда
      // находил правильный текст, даже если ID совпадают между уровнями.
      messages: [
        ...s.messages,
        { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: script.id, level: s.currentLevel }
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
          ? [...s.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: scripts[0].id, level: 0 }]
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
        // Задание уехало в активные — XP даётся только при реальном выполнении
        // (через TasksScreen или через answer_number / complete_exercise).
        enqueueTask(script, action === 'done' ? 'taken' : 'deferred')
      } else if ((script.type === 'theory' || script.type === 'word') && action === 'next') {
        // Чтение теории/слова дня — единственный «терминальный» вариант через next.
        awardXP(script.xp, script.stardust ?? 0, script.id)
      }
      // Для reflection skip и любого «next» на отложенных — XP не даём.

      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 600)
    } else if (action === 'answer_number') {
      setState(s => ({ ...s, awaitingInput: 'number' }))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'answer_text') {
      setState(s => ({ ...s, awaitingInput: 'text' }))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'complete_exercise') {
      // Открываем поле для обязательного комментария. XP и переход к
      // следующему скрипту произойдут после ввода в handleSend
      // (ветка awaitingInput === 'exercise_note').
      setState(s => ({ ...s, awaitingInput: 'exercise_note' }))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'start_survey') {
      // Запуск анкеты. Переходим на отдельный экран с поэтапным UI.
      // Если по этому навыку уже был сохранён черновик (юзер прервал
      // анкету раньше) — восстанавливаем прогресс. Иначе старт с нуля.
      const draft = state.skills?.[script.skill]?.draft
      setState(s => ({
        ...s,
        screen: 'survey',
        activeSurvey: draft
          ? { scriptId: script.id, skillId: script.skill, ...draft }
          : { scriptId: script.id, skillId: script.skill, blockIndex: 0, statementIndex: 0, answers: {} }
      }))
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
      // Нейтральная реплика без похвалы за факт ответа (см. §3.6).
      // Для open-ended вопросов целей и для рефлексий используем одну формулировку.
      const ack = script?.type === 'question' ? 'Записано в карту.' : 'Записано в дневник.'
      await addBotMessage(ack, 500)
      // Сайд-эффект: рефлексия → запись в дневник с подписью «на какой вопрос ответ».
      onDiaryChange([
        {
          id: Date.now(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: val,
          source: 'journey',
          scriptId: script?.id ?? null,
          promptTitle: script?.title ?? null,
          prompt: script?.text ?? null
        },
        ...(diary ?? [])
      ])
      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 10, 0, script?.id ?? null)
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 700)
    } else if (state.awaitingInput === 'exercise_note') {
      // Завершение упражнения с обязательным комментарием.
      // Пустая строка отсекается общим guard'ом в начале handleSend.
      addUserMessage(val)
      setInputVal('')
      setState(s => ({ ...s, awaitingInput: null }))
      await addBotMessage('Записано в дневник.', 500)
      onDiaryChange([
        {
          id: Date.now(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: val,
          source: 'journey',
          scriptId: script?.id ?? null,
          promptTitle: script?.title ?? null,
          prompt: script?.text ?? null
        },
        ...(diary ?? [])
      ])
      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 15, script?.stardust ?? 0, script?.id ?? null)
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 700)
    }
  }, [inputVal, state.awaitingInput, state.currentScriptIndex, state.currentAspect, scripts, scores, diary, addBotMessage, addUserMessage, awardXP, deliverScript, onDiaryChange, onScoresChange, removePending])

  const handleReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [])

  // Переход на следующий уровень. Сохраняет всю историю сообщений
  // (с level=прошлый), добавляет первый скрипт нового уровня.
  // Сбрасывает mode в 'core' — новый уровень всегда стартует с core.
  const handleNextLevel = useCallback(() => {
    const next = currentJourney?.levels?.[state.currentLevel + 1]
    if (!next) return
    const firstScript = (next.core ?? next.scripts ?? [])[0]
    setState(s => ({
      ...s,
      currentLevel: s.currentLevel + 1,
      mode: 'core',
      currentScriptIndex: 0,
      currentScriptId: firstScript?.id ?? null,
      screen: 'chat',
      awaitingInput: null,
      messages: firstScript
        ? [...s.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: firstScript.id, level: s.currentLevel + 1 }]
        : s.messages
    }))
  }, [currentJourney, state.currentLevel])

  // Войти в pool текущего уровня — после прохождения core пользователь
  // выбрал «копать здесь дальше». Сбрасывает индекс и доставляет первый
  // pool-скрипт. Переход на следующий уровень потом всё ещё доступен —
  // на levelcomplete после прохождения pool, либо из профиля.
  const handleStayPool = useCallback(() => {
    if (poolScripts.length === 0) return
    const first = poolScripts[0]
    setState(s => ({
      ...s,
      mode: 'pool',
      currentScriptIndex: 0,
      currentScriptId: first?.id ?? null,
      screen: 'chat',
      awaitingInput: null,
      messages: first
        ? [...s.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: first.id, level: s.currentLevel }]
        : s.messages
    }))
  }, [poolScripts, setState])

  // ─── Анкета навыков (survey) ─────────────────────────────────
  // Шаг анкеты. Принимает оценку (1-10) для текущего утверждения,
  // двигается дальше; на последнем — вызывает handleSurveyComplete.
  const handleSurveyAnswer = useCallback((value) => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const survey = getSurvey(active.skillId)
      if (!survey) return s
      const blockKeys = Object.keys(survey.blocks)
      const currentBlock = blockKeys[active.blockIndex]
      const currentBlockArr = survey.blocks[currentBlock] ?? []
      const prevAnswers = active.answers[currentBlock] ?? []
      const nextBlockAnswers = [...prevAnswers]
      nextBlockAnswers[active.statementIndex] = value
      const nextAnswers = { ...active.answers, [currentBlock]: nextBlockAnswers }

      // Двигаемся: дальше в блоке → следующий блок → финиш.
      let nextStatementIndex = active.statementIndex + 1
      let nextBlockIndex = active.blockIndex
      if (nextStatementIndex >= currentBlockArr.length) {
        nextStatementIndex = 0
        nextBlockIndex = active.blockIndex + 1
      }

      return {
        ...s,
        activeSurvey: {
          ...active,
          answers: nextAnswers,
          blockIndex: nextBlockIndex,
          statementIndex: nextStatementIndex
        }
      }
    })
  }, [setState])

  // Назад на одно утверждение (если пользователь хочет переоценить).
  const handleSurveyBack = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const survey = getSurvey(active.skillId)
      if (!survey) return s
      let prevStatement = active.statementIndex - 1
      let prevBlock = active.blockIndex
      if (prevStatement < 0) {
        prevBlock = Math.max(0, prevBlock - 1)
        const blockKeys = Object.keys(survey.blocks)
        const prevBlockKey = blockKeys[prevBlock]
        const prevBlockArr = survey.blocks[prevBlockKey] ?? []
        prevStatement = Math.max(0, prevBlockArr.length - 1)
      }
      return {
        ...s,
        activeSurvey: {
          ...active,
          blockIndex: prevBlock,
          statementIndex: prevStatement
        }
      }
    })
  }, [setState])

  // Завершение анкеты: считаем средние, кладём в state.skills,
  // пишем в дневник, выдаём XP, доставляем следующий pool-скрипт.
  const handleSurveyComplete = useCallback(async () => {
    const active = state.activeSurvey
    if (!active) return
    const survey = getSurvey(active.skillId)
    if (!survey) return

    const result = calcSurveyResult(active.answers)
    const completedAt = Date.now()

    // 1. Сохраняем в state.skills + закрываем активную анкету,
    //    возвращаемся в чат.
    const newSkills = {
      ...state.skills,
      [active.skillId]: {
        result: result.skill,
        blocks: result.blocks,
        completedAt,
        // Сохраняем сами ответы — для последующего отображения в дневнике.
        answers: active.answers
      }
    }
    setState(s => ({
      ...s,
      skills: newSkills,
      activeSurvey: null,
      screen: 'chat'
    }))

    // 1.5 Пересчитываем общую оценку БС в колесе баланса.
    // Многоступенчатое усреднение: блоки → навык → архетип → БС.
    const bsScore = calcBSScoreFromSkills(newSkills)
    if (Number.isFinite(bsScore)) {
      onScoresChange({ ...scores, БС: Math.round(bsScore) })
    }

    // 2. Запись в дневник со всеми 15 ответами одной записью.
    const script = scripts.find(sc => sc.id === active.scriptId)
    onDiaryChange([
      {
        id: completedAt,
        date: new Date().toLocaleDateString('ru-RU'),
        ts: completedAt,
        aspect: state.currentAspect,
        text: `Анкета: ${survey.name}. Средняя оценка ${result.skill?.toFixed(1) ?? '—'}/10.`,
        source: 'journey-survey',
        scriptId: active.scriptId,
        skillId: active.skillId,
        promptTitle: script?.title ?? survey.name,
        prompt: script?.text ?? null,
        // Полные данные для раскрытия в дневнике.
        survey: {
          name: survey.name,
          archetype: survey.archetype,
          blocks: survey.blocks,
          answers: active.answers,
          blockAvgs: result.blocks,
          skillAvg: result.skill
        }
      },
      ...(diary ?? [])
    ])

    // 3. XP + следующий pool-скрипт.
    if (script) {
      removePending(script.id)
      awardXP(script.xp ?? 30, script.stardust ?? 0, script.id)
    }
    setTimeout(() => deliverScript(state.currentScriptIndex + 1), 700)
  }, [state.activeSurvey, state.currentAspect, state.currentScriptIndex, state.skills, scripts, scores, diary, onDiaryChange, onScoresChange, awardXP, deliverScript, removePending, setState])

  // Отмена анкеты — сохраняем текущий прогресс как draft в state.skills,
  // чтобы при возврате к этому навыку пользователь продолжил с того же
  // места. Если ответов ещё нет — драфт не пишем (нечего сохранять).
  const handleSurveyCancel = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return { ...s, screen: 'chat' }
      const hasAnyAnswer = Object.values(active.answers ?? {}).some(arr =>
        Array.isArray(arr) && arr.some(n => Number.isFinite(n))
      )
      if (!hasAnyAnswer) {
        return { ...s, activeSurvey: null, screen: 'chat' }
      }
      const prevSkill = s.skills?.[active.skillId] ?? {}
      return {
        ...s,
        activeSurvey: null,
        screen: 'chat',
        skills: {
          ...s.skills,
          [active.skillId]: {
            ...prevSkill,
            draft: {
              answers: active.answers,
              blockIndex: active.blockIndex,
              statementIndex: active.statementIndex
            }
          }
        }
      }
    })
  }, [setState])

  // Открыть меню «Дерево навыков» — выбор любого навыка для оценки
  // вручную, с видимым прогрессом по веткам.
  const handleOpenSkillTree = useCallback(() => {
    setState(s => ({ ...s, screen: 'skill-tree' }))
  }, [setState])

  // Запустить анкету по конкретному skillId (из дерева). Если есть
  // draft (юзер прерывал ранее) — продолжаем с того же места.
  // Также синхронизируем journey-state с pool L0, чтобы handleSurveyComplete
  // потом мог перейти к следующему скрипту через deliverScript.
  const handleStartSkillSurvey = useCallback((skillId) => {
    const journeyData = getJourney('БС')
    const pool = journeyData?.levels?.[0]?.pool ?? []
    const idx = pool.findIndex(s => s.type === 'survey' && s.skill === skillId)
    if (idx === -1) return
    const target = pool[idx]
    const draft = state.skills?.[skillId]?.draft

    setState(s => ({
      ...s,
      currentAspect: 'БС',
      currentLevel: 0,
      mode: 'pool',
      currentScriptIndex: idx,
      currentScriptId: target.id,
      screen: 'survey',
      awaitingInput: null,
      activeSurvey: draft
        ? { scriptId: target.id, skillId, ...draft }
        : { scriptId: target.id, skillId, blockIndex: 0, statementIndex: 0, answers: {} }
    }))
  }, [state.skills, setState])

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
          resolveScript={resolveScript}
          onAction={handleScriptAction}
          onSend={handleSend}
          onOpenProfile={() => goToScreen('profile')}
          onOpenTasks={() => goToScreen('tasks')}
          onGoToSurveys={handleOpenSkillTree}
          surveyRemaining={getSkillProgress(state.skills ?? {}).remaining}
          pendingCount={state.pendingTasks?.length ?? 0}
          aspectName={currentJourney
            ? `Уровень ${state.currentLevel} · ${currentLevel?.title}${state.mode === 'pool' ? ' · доп. задания' : ''}`
            : 'Путешествие'}
          planet={currentJourney?.planet}
        />
      )}

      {state.screen === 'levelcomplete' && (
        <LevelComplete
          state={state}
          accent={accent}
          completeText={currentLevel?.complete?.text ?? ''}
          levelTitle={currentLevel?.title}
          mode={state.mode}
          onProfile={() => goToScreen('profile')}
          nextLevelTitle={nextLevel?.title}
          onNextLevel={nextLevel ? handleNextLevel : null}
          // На L0 pool — только анкеты навыков. Кнопка после core ведёт
          // в дерево навыков (выбор любого), а не на первый шаг pool в
          // чате. Логика handleStayPool остаётся для будущих уровней.
          onStayPool={
            state.mode === 'core' && hasPool
              ? (state.currentLevel === 0 ? handleOpenSkillTree : handleStayPool)
              : null
          }
          poolCount={poolScripts.length}
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

      {state.screen === 'skill-tree' && (
        <SkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen('chat')}
          onStartSkill={handleStartSkillSurvey}
        />
      )}

      {state.screen === 'survey' && state.activeSurvey && (
        <SurveyScreen
          activeSurvey={state.activeSurvey}
          accent={accent}
          onAnswer={handleSurveyAnswer}
          onBack={handleSurveyBack}
          onComplete={handleSurveyComplete}
          onCancel={handleSurveyCancel}
        />
      )}

      {state.screen === 'tasks' && (
        <TasksScreen
          tasks={state.pendingTasks ?? []}
          // Лукап тасок ищет по scriptId — в задачах могут быть и core,
          // и pool скрипты, поэтому отдаём объединённый массив.
          scripts={[...coreScripts, ...poolScripts]}
          accent={accent}
          onBack={() => goToScreen('chat')}
          onCompleteWithNote={(script, noteText) => {
            removePending(script.id)
            awardXP(script.xp ?? 0, script.stardust ?? 0, script.id)
            onDiaryChange([
              {
                id: Date.now(),
                date: new Date().toLocaleDateString('ru-RU'),
                ts: Date.now(),
                aspect: state.currentAspect,
                text: noteText,
                source: 'journey',
                scriptId: script.id,
                promptTitle: script.title,
                prompt: script.text
              },
              ...(diary ?? [])
            ])
          }}
          onDelete={(scriptId) => removePending(scriptId)}
        />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
