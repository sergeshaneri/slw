import { useEffect, useRef, useState, useCallback } from 'react'
import { ASPECT_COLORS } from '../../data/aspects'
import { ONBOARDING } from '../../data/journey/onboarding'
import { getJourney } from '../../data/journey/registry'
import {
  getSurvey, calcSurveyResult, calcBSScoreFromSkills, getSkillProgress,
  findFirstUnansweredSurveyIndex, ALL_SKILL_IDS, SURVEY_BLOCK_KEYS, SURVEYS,
  getNextPass, getStatementsForPass, getStatementsForFullRange,
  buildSurveyStatements, getCompletedPasses,
  ARCHETYPE_KEYS, SKILL_TREE
} from '../../data/journey/skills'
import Onboarding from './Onboarding'
import Chat from './Chat'
import LevelComplete from './LevelComplete'
import JourneyProfile from './JourneyProfile'
import TasksScreen from './TasksScreen'
import SurveyScreen from './SurveyScreen'
import SurveyChoice from './SurveyChoice'
import SurveyInsight from './SurveyInsight'
import SkillTree from './SkillTree'
import SkillDetail from './SkillDetail'
import AdminPanel from './AdminPanel'
import AdminSkillsEditor from './AdminSkillsEditor'
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
// 5 — прогрессивная анкета (5 вопросов × 3 прохода вместо 15 за
//     раз). state.skills[id] получил поля passes, insights[].
//     activeSurvey получил pass. Старые записи мигрируем в
//     migrateState (passes вычисляется по answers).
// 6 — анкеты вынесены из L0-чата (33 SURV-шага → отдельный
//     bs-l0-surveys.md, видны только через дерево навыков). B-1/2/3
//     перешли на open-text без слайдера, исчезли followUp-блоки.
//     Концепция `pool`/`mode` удалена. Старый state с mode='pool'
//     или индексом в pool — мигрируется со сбросом messages/
//     completedScripts/pendingTasks. state.skills сохраняется.
// 7 — добавлен L2 БС «Системы заботы»: 40 шагов core (8×5),
//     вопросы формата B (open-text). Также прошлись по L0/L1
//     и переименовали несколько шагов (Аудит комфорта → Что меня
//     окружает, и т.п.), убрали ID-метки из тела скриптов,
//     перевели «или проговорить» в обязательное «Запиши ответы».
export const CONTENT_VERSION = 7

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
  // Результаты анкет навыков БС.
  // skills[skillId] = { result: avg-навыка, blocks: { [blockKey]: avg }, completedAt }
  skills: {},
  // Активная анкета (если открыт screen='survey').
  // activeSurvey = { scriptId, skillId, blockIndex, statementIndex, answers: { [blockKey]: number[] } }
  activeSurvey: null,
  // Навык, открытый в детальном просмотре (screen='skill-detail').
  skillDetailId: null,
  xp: 0,
  stardust: 0,
  streak: 0,
  totalCompleted: 0,
  lastActiveDate: null,
  contentVersion: CONTENT_VERSION
}

// Миграция skills-записей со старого формата (без passes/insights) на новый.
// Старые записи: { result, blocks, completedAt, answers? }.
// Новые: + passes (вычисляется по answers), + insights: [].
function migrateSkills(skills) {
  if (!skills || typeof skills !== 'object') return {}
  const out = {}
  for (const [id, entry] of Object.entries(skills)) {
    if (!entry) continue
    // passes уже есть — оставляем как есть.
    if (Number.isFinite(entry.passes)) {
      out[id] = { ...entry, insights: entry.insights ?? [] }
      continue
    }
    // Вычисляем passes по answers (max длина массива).
    let passes = 0
    if (entry.answers) {
      for (const k of SURVEY_BLOCK_KEYS) {
        const arr = entry.answers[k] ?? []
        const len = arr.filter(n => Number.isFinite(n)).length
        if (len > passes) passes = len
      }
    } else if (Number.isFinite(entry.result)) {
      // У старых записей нет answers, но есть result — считаем как полную (3).
      passes = 3
    }
    out[id] = { ...entry, passes, insights: entry.insights ?? [] }
  }
  return out
}

// Миграция при загрузке: если у юзера сохранён старый контент,
// сбрасываем чат и счётчик скриптов, но сохраняем XP/streak/dust.
// state.skills сохраняем всегда — анкеты, уже пройденные юзером,
// потерять было бы нечестно.
//
// Старое поле `mode` ('core'|'pool') v5 удаляется из приходящего
// state — концепция pool ушла в v6, scripts теперь всегда core.
function migrateState(stored) {
  if (!stored) return DEFAULT_JOURNEY
  if (stored.contentVersion === CONTENT_VERSION) {
    // eslint-disable-next-line no-unused-vars
    const { mode, ...rest } = stored
    return {
      ...DEFAULT_JOURNEY,
      ...rest,
      messages: rest.messages ?? [],
      completedScripts: rest.completedScripts ?? [],
      pendingTasks: rest.pendingTasks ?? [],
      skills: migrateSkills(rest.skills),
      activeSurvey: rest.activeSurvey ?? null
    }
  }
  // Контент уровня обновился — сбрасываем сценарий, оставляем достижения и
  // skills (юзер их прошёл, нечестно сбрасывать). activeSurvey тоже
  // переносим — юзер с незавершённой анкетой продолжит с того же места.
  return {
    ...DEFAULT_JOURNEY,
    xp: stored.xp ?? 0,
    stardust: stored.stardust ?? 0,
    streak: stored.streak ?? 0,
    totalCompleted: stored.totalCompleted ?? 0,
    lastActiveDate: stored.lastActiveDate ?? null,
    completedScripts: [],
    pendingTasks: [],
    skills: migrateSkills(stored.skills),
    activeSurvey: stored.activeSurvey ?? null,
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

export default function JourneyView({ journey: extJourney, onJourneyChange, scores, onScoresChange, diary, onDiaryChange, t, isAdmin = false }) {
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
  // Linear core-маршрут уровня. Анкеты (currentLevel.surveys) живут
  // отдельно, доступны только через дерево навыков, не из chat-ленты.
  const scripts = currentLevel?.core ?? currentLevel?.scripts ?? []
  const aspectIntro = currentJourney?.intro ?? []
  const accent = ASPECT_COLORS[state.currentAspect] ?? '#4cc9f0'

  // Лукап скрипта по {scriptId, level} — нужен в чате для архивных
  // сообщений: T-1 в L0 ≠ T-1 в L1, ID может повторяться между
  // уровнями. Дополнительный fallback в surveys целевого уровня —
  // на случай чтения старых state с архивными SURV-сообщениями (v5).
  const resolveScript = useCallback((scriptId, level) => {
    const lvl = level ?? state.currentLevel
    const lvlData = currentJourney?.levels?.[lvl]
    const inCore = lvlData?.core?.find(s => s.id === scriptId)
    if (inCore) return inCore
    const inSurveys = lvlData?.surveys?.find(s => s.id === scriptId)
    if (inSurveys) return inSurveys
    return scripts.find(s => s.id === scriptId) ?? null
  }, [currentJourney, scripts, state.currentLevel])

  const nextLevel = currentJourney?.levels?.[state.currentLevel + 1] ?? null

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
  const handleNextLevel = useCallback(() => {
    const next = currentJourney?.levels?.[state.currentLevel + 1]
    if (!next) return
    const firstScript = (next.core ?? next.scripts ?? [])[0]
    setState(s => ({
      ...s,
      currentLevel: s.currentLevel + 1,
      currentScriptIndex: 0,
      currentScriptId: firstScript?.id ?? null,
      screen: 'chat',
      awaitingInput: null,
      messages: firstScript
        ? [...s.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: firstScript.id, level: s.currentLevel + 1 }]
        : s.messages
    }))
  }, [currentJourney, state.currentLevel])

  // ─── Анкета навыков (survey) ─────────────────────────────────
  // Режимы:
  //   mode='short' — 5 утверждений (один pass)
  //   mode='full'  — все оставшиеся утверждения (от startPass до 3)
  //
  // activeSurvey:
  //   { skillId, scriptId, mode, startPass, stepIndex, answers }
  //
  // Список утверждений вычисляется через buildSurveyStatements(survey, mode, startPass).
  // stepIndex итерирует по этому списку. Когда stepIndex >= statements.length —
  // конец сессии, переход на survey-insight.
  const handleSurveyAnswer = useCallback((value) => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const survey = getSurvey(active.skillId)
      if (!survey) return s
      const stmts = buildSurveyStatements(survey, active.mode ?? 'short', active.startPass ?? 1)
      const current = stmts[active.stepIndex ?? 0]
      if (!current) return s

      const prevAnswers = active.answers?.[current.blockKey] ?? []
      const nextBlockAnswers = [...prevAnswers]
      nextBlockAnswers[current.statementIndex] = value
      const nextAnswers = { ...active.answers, [current.blockKey]: nextBlockAnswers }

      return {
        ...s,
        activeSurvey: {
          ...active,
          answers: nextAnswers,
          stepIndex: (active.stepIndex ?? 0) + 1
        }
      }
    })
  }, [setState])

  // Назад на одно утверждение (внутри текущей сессии).
  const handleSurveyBack = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      return {
        ...s,
        activeSurvey: {
          ...active,
          stepIndex: Math.max(0, (active.stepIndex ?? 0) - 1)
        }
      }
    })
  }, [setState])

  // Конец прохода (5 утверждений отвечены): переключаемся на экран
  // обязательного инсайта. Здесь НЕ пишем в state.skills и не выдаём XP —
  // это делает handleSurveyInsight после ввода рефлексии.
  const handleSurveyComplete = useCallback(() => {
    setState(s => ({ ...s, screen: 'survey-insight' }))
  }, [setState])

  // Открыть детальный разбор навыка (черты + практики + действия).
  // Доступен из дерева навыков для пройденных навыков и автоматически —
  // сразу после прохождения анкеты (см. handleSurveyInsight).
  const handleOpenSkillDetail = useCallback((skillId) => {
    setState(s => ({ ...s, skillDetailId: skillId, screen: 'skill-detail' }))
  }, [setState])

  // Юзер написал инсайт и нажал «Сохранить».
  // Считаем средние по всем накопленным ответам, пишем skill, апдейтим
  // passes по фактической длине массивов в answers.
  const handleSurveyInsight = useCallback((insightText) => {
    const active = state.activeSurvey
    if (!active) return
    const survey = getSurvey(active.skillId)
    if (!survey) return

    const result = calcSurveyResult(active.answers)
    const completedAt = Date.now()

    // Фактическое число проходов = max длина массивов ответов по блокам.
    let actualPasses = 0
    for (const k of SURVEY_BLOCK_KEYS) {
      const arr = active.answers?.[k] ?? []
      const len = arr.filter(n => Number.isFinite(n)).length
      if (len > actualPasses) actualPasses = len
    }
    actualPasses = Math.min(3, actualPasses)

    const prev = state.skills?.[active.skillId] ?? {}
    const wasPasses = prev.passes ?? 0
    const newSkillEntry = {
      ...prev,
      result: result.skill,
      blocks: result.blocks,
      answers: active.answers,
      passes: actualPasses,
      completedAt,
      insights: [
        ...(prev.insights ?? []),
        { text: insightText, completedAt, mode: active.mode, pass: actualPasses }
      ],
      draft: undefined
    }
    delete newSkillEntry.draft

    const newSkills = { ...state.skills, [active.skillId]: newSkillEntry }

    setState(s => ({
      ...s,
      skills: newSkills,
      activeSurvey: null,
      skillDetailId: active.skillId,
      screen: 'skill-detail'
    }))

    const bsScore = calcBSScoreFromSkills(newSkills)
    if (Number.isFinite(bsScore)) {
      onScoresChange({ ...scores, БС: Math.round(bsScore) })
    }

    // Запись в дневник.
    const script = scripts.find(sc => sc.id === active.scriptId)
    const sessionLabel =
      active.mode === 'full'
        ? `полный проход с ${active.startPass} до 3 (${actualPasses}/3 после сессии)`
        : `проход ${actualPasses}/3 (короткий)`
    onDiaryChange([
      {
        id: completedAt,
        date: new Date().toLocaleDateString('ru-RU'),
        ts: completedAt,
        aspect: state.currentAspect,
        text: `Анкета: ${survey.name} · ${sessionLabel}. Средняя ${result.skill?.toFixed(1) ?? '—'}/10. Инсайт: ${insightText}`,
        source: 'journey-survey',
        scriptId: active.scriptId,
        skillId: active.skillId,
        promptTitle: script?.title ?? survey.name,
        prompt: script?.text ?? null,
        insight: insightText,
        survey: {
          name: survey.name,
          archetype: survey.archetype,
          blocks: survey.blocks,
          answers: active.answers,
          blockAvgs: result.blocks,
          skillAvg: result.skill,
          pass: actualPasses,
          mode: active.mode
        }
      },
      ...(diary ?? [])
    ])

    // XP: 10 за каждый закрытый проход. Большой опрос = 3 прохода = 30,
    // три мини-прохода по очереди = 10+10+10 = те же 30.
    // Stardust по-прежнему только на финальном проходе (passes=3).
    const wentToFinal = wasPasses < 3 && actualPasses === 3
    const xp = (actualPasses - wasPasses) * 10
    if (script) removePending(script.id)
    awardXP(xp, wentToFinal ? (script?.stardust ?? 0) : 0, script?.id ?? null)
  }, [state.activeSurvey, state.currentAspect, state.skills, scripts, scores, diary, onDiaryChange, onScoresChange, awardXP, removePending, setState])

  // Отмена анкеты или инсайта — сохраняем текущий прогресс как draft.
  const handleSurveyCancel = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return { ...s, screen: 'skill-tree' }
      const hasAnyAnswer = Object.values(active.answers ?? {}).some(arr =>
        Array.isArray(arr) && arr.some(n => Number.isFinite(n))
      )
      if (!hasAnyAnswer) {
        return { ...s, activeSurvey: null, screen: 'skill-tree' }
      }
      const prevSkill = s.skills?.[active.skillId] ?? {}
      return {
        ...s,
        activeSurvey: null,
        screen: 'skill-tree',
        skills: {
          ...s.skills,
          [active.skillId]: {
            ...prevSkill,
            draft: {
              mode: active.mode ?? 'short',
              startPass: active.startPass ?? 1,
              stepIndex: active.stepIndex ?? 0,
              answers: active.answers,
            }
          }
        }
      }
    })
  }, [setState])

  // Открыть меню «Дерево навыков» — выбор любого навыка для оценки
  // вручную, с видимым прогрессом по веткам. Доступно с момента, когда
  // юзер дошёл до экрана LevelComplete L0 («Открыть Колесо БС») —
  // gate здесь лояльный, фактическая блокировка на UI-уровне.
  const handleOpenSkillTree = useCallback(() => {
    setState(s => ({ ...s, screen: 'skill-tree' }))
  }, [setState])

  // Тык на навык в дереве:
  //   - Если passes=3 → ничего не делаем.
  //   - Если есть draft (юзер прерывал) → сразу продолжаем с того же места.
  //   - Иначе → открываем экран выбора режима (short / full).
  // Анкета лежит в currentLevel.surveys (отдельный массив, не в core-чате).
  const handleStartSkillSurvey = useCallback((skillId) => {
    const journeyData = getJourney('БС')
    const surveys = journeyData?.levels?.[0]?.surveys ?? []
    const idx = surveys.findIndex(s => s.type === 'survey' && s.skill === skillId)
    if (idx === -1) return
    const target = surveys[idx]
    const skillEntry = state.skills?.[skillId]
    const draft = skillEntry?.draft

    if (draft) {
      // Продолжаем как было — без выбора. currentScriptId не трогаем:
      // он нужен для chat-flow (core-шагов), а survey-id в нём только
      // путает resolveScript при возврате в чат.
      setState(s => ({
        ...s,
        currentAspect: 'БС',
        screen: 'survey',
        awaitingInput: null,
        activeSurvey: {
          scriptId: target.id,
          skillId,
          mode: draft.mode ?? 'short',
          startPass: draft.startPass ?? 1,
          stepIndex: draft.stepIndex ?? 0,
          answers: draft.answers ?? {},
        },
      }))
      return
    }

    if (getNextPass(skillEntry) === 0) return  // всё пройдено

    // Открываем экран выбора. activeSurvey временно хранит skillId/scriptId,
    // mode выберется на следующем шаге.
    setState(s => ({
      ...s,
      currentAspect: 'БС',
      screen: 'survey-choice',
      awaitingInput: null,
      activeSurvey: { scriptId: target.id, skillId },  // mode появится после choose
    }))
  }, [state.skills, setState])

  // Юзер выбрал режим в SurveyChoice. Стартуем активную анкету.
  const handleChooseSurveyMode = useCallback((mode) => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const skillEntry = s.skills?.[active.skillId]
      const startPass = getNextPass(skillEntry) || 1
      return {
        ...s,
        screen: 'survey',
        activeSurvey: {
          ...active,
          mode,
          startPass,
          stepIndex: 0,
          // Накопленные ответы предыдущих проходов сохраняем, чтобы в новых
          // слотах писать дальше.
          answers: skillEntry?.answers ?? {},
        },
      }
    })
  }, [setState])

  const goToScreen = useCallback((screen) => {
    setState(s => ({ ...s, screen }))
  }, [setState])

  // ─── Админ-действия (видимы только при isAdmin) ──────────────
  // Все хендлеры обходят геймификацию: XP не выдаём, в дневник
  // не пишем, через addBotMessage не отвечаем.

  // 1. Пропустить текущий шаг в чате — просто двигаем currentScriptIndex.
  const handleAdminSkipStep = useCallback(() => {
    setState(s => ({ ...s, awaitingInput: null }))
    setTimeout(() => deliverScript(state.currentScriptIndex + 1), 50)
  }, [deliverScript, state.currentScriptIndex])

  // 2. Заполнить активную анкету. Все утверждения текущей сессии = 7.
  //    Сдвигаем stepIndex за конец → SurveyScreen.useEffect → survey-insight.
  const handleAdminFillSurvey = useCallback(() => {
    setState(s => {
      if (!s.activeSurvey) return s
      const survey = SURVEYS[s.activeSurvey.skillId]
      if (!survey) return s
      const mode = s.activeSurvey.mode ?? 'short'
      const startPass = s.activeSurvey.startPass ?? 1
      const stmts = buildSurveyStatements(survey, mode, startPass)
      const answers = { ...(s.activeSurvey.answers ?? {}) }
      for (const stm of stmts) {
        const arr = answers[stm.blockKey] ? [...answers[stm.blockKey]] : []
        arr[stm.statementIndex] = 7
        answers[stm.blockKey] = arr
      }
      return {
        ...s,
        activeSurvey: {
          ...s.activeSurvey,
          answers,
          stepIndex: stmts.length,
        },
      }
    })
  }, [setState])

  // 3. Заполнить все 33 навыка по 7/10 (полностью все 3 прохода).
  //    Сразу пересчитываем БС.
  const handleAdminFillAllSkills = useCallback(() => {
    const completedAt = Date.now()
    const newSkills = {}
    for (const skillId of ALL_SKILL_IDS) {
      const survey = SURVEYS[skillId]
      const blocks = {}
      const answers = {}
      if (survey) {
        for (const key of SURVEY_BLOCK_KEYS) {
          const arr = survey.blocks[key] ?? []
          if (arr.length > 0) {
            blocks[key] = 7
            answers[key] = arr.map(() => 7)
          }
        }
      } else {
        for (const key of SURVEY_BLOCK_KEYS) blocks[key] = 7
      }
      newSkills[skillId] = {
        result: 7,
        blocks,
        completedAt,
        answers,
        passes: 3,
        insights: [],
        _admin: true
      }
    }
    setState(s => ({ ...s, skills: newSkills }))
    const bs = calcBSScoreFromSkills(newSkills)
    if (Number.isFinite(bs)) {
      onScoresChange({ ...scores, БС: Math.round(bs) })
    }
  }, [scores, onScoresChange, setState])

  // 4. Прыжок на конкретный уровень. Сбрасываем core-индекс, подаём
  //    первый скрипт в чат. Если уровня нет — no-op.
  const handleAdminJumpLevel = useCallback((targetLevel) => {
    const lvlData = currentJourney?.levels?.[targetLevel]
    if (!lvlData) return
    const first = (lvlData.core ?? lvlData.scripts ?? [])[0]
    setState(s => ({
      ...s,
      currentLevel: targetLevel,
      screen: 'chat',
      currentScriptIndex: 0,
      currentScriptId: first?.id ?? null,
      awaitingInput: null,
      activeSurvey: null,
      messages: first
        ? [...s.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: first.id, level: targetLevel }]
        : s.messages
    }))
  }, [currentJourney, setState])

  // 5. Полный сброс journey-state. Без подтверждения.
  const handleAdminReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [setState])

  // 6. Открыть гранулярный редактор навыков.
  const handleOpenSkillsEditor = useCallback(() => {
    setState(s => ({ ...s, screen: 'admin-skills' }))
  }, [setState])

  // 7. Применить правки из редактора. edits = { [skillId]: { enabled, value, passes } }
  //    enabled=true  → перезаписываем skillId на новые значения
  //    enabled=false → удаляем skillId из state.skills (если есть)
  const handleAdminApplyEdits = useCallback((edits) => {
    const completedAt = Date.now()
    const newSkills = { ...(state.skills ?? {}) }
    for (const [id, e] of Object.entries(edits ?? {})) {
      if (!e?.enabled) {
        // Disabled — удаляем navыk если был.
        if (newSkills[id]) delete newSkills[id]
        continue
      }
      const survey = SURVEYS[id]
      const blocks = {}
      const answers = {}
      if (survey) {
        for (const k of SURVEY_BLOCK_KEYS) {
          const arr = survey.blocks[k] ?? []
          if (arr.length > 0) {
            blocks[k] = e.value
            answers[k] = arr.slice(0, e.passes).map(() => e.value)
          }
        }
      } else {
        for (const k of SURVEY_BLOCK_KEYS) blocks[k] = e.value
      }
      newSkills[id] = {
        result: e.value,
        blocks,
        answers,
        passes: e.passes,
        insights: [],
        completedAt,
        _admin: true,
      }
    }
    setState(s => ({ ...s, skills: newSkills, screen: 'skill-tree' }))
    const bs = calcBSScoreFromSkills(newSkills)
    if (Number.isFinite(bs)) {
      onScoresChange({ ...scores, БС: Math.round(bs) })
    }
  }, [state.skills, scores, onScoresChange, setState])

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
          // Пилюля «Оценить навыки» появляется только после L0 (или для админа).
          surveyRemaining={
            (isAdmin || (state.currentLevel ?? 0) >= 1)
              ? getSkillProgress(state.skills ?? {}).remaining
              : 0
          }
          pendingCount={state.pendingTasks?.length ?? 0}
          aspectName={currentJourney
            ? `Уровень ${state.currentLevel} · ${currentLevel?.title}`
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
          onProfile={() => goToScreen('profile')}
          nextLevelTitle={nextLevel?.title}
          onNextLevel={nextLevel ? handleNextLevel : null}
          // На L0 после прохождения core — primary CTA «Открыть Колесо БС»
          // (skill-tree). На L1+ нет skill-tree → кнопка не показывается.
          onOpenWheel={
            state.currentLevel === 0 && (currentLevel?.surveys?.length ?? 0) > 0
              ? handleOpenSkillTree
              : null
          }
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
          // Возврат в чат должен очистить активную анкету: иначе её
          // SURV-script-карточка всплывает в chat-ленте через resolveScript
          // (который теперь fallback-ит в currentLevel.surveys), и юзер
          // вместо чата видит заглушку «Анкета по навыку БС…».
          // Прогресс анкеты сохраняем как draft в state.skills, чтобы юзер
          // мог продолжить с того же места из дерева навыков.
          onContinue={() => {
            setState(s => {
              let nextSkills = s.skills
              const active = s.activeSurvey
              if (active) {
                const hasAnyAnswer = Object.values(active.answers ?? {}).some(arr =>
                  Array.isArray(arr) && arr.some(n => Number.isFinite(n))
                )
                if (hasAnyAnswer) {
                  const prevSkill = s.skills?.[active.skillId] ?? {}
                  nextSkills = {
                    ...s.skills,
                    [active.skillId]: {
                      ...prevSkill,
                      draft: {
                        mode: active.mode ?? 'short',
                        startPass: active.startPass ?? 1,
                        stepIndex: active.stepIndex ?? 0,
                        answers: active.answers,
                      }
                    }
                  }
                }
              }
              return {
                ...s,
                skills: nextSkills,
                activeSurvey: null,
                awaitingInput: null,
                screen: s.currentScriptIndex >= scripts.length ? 'levelcomplete' : 'chat',
              }
            })
          }}
          onReset={handleReset}
        />
      )}

      {state.screen === 'skill-tree' && (
        <SkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
        />
      )}

      {state.screen === 'skill-detail' && state.skillDetailId && (
        <SkillDetail
          skillId={state.skillDetailId}
          currentLevel={state.currentLevel ?? 0}
          accent={accent}
          onClose={() => goToScreen('skill-tree')}
        />
      )}

      {state.screen === 'survey-choice' && state.activeSurvey && (() => {
        // Найдём имя навыка для заголовка.
        let name = state.activeSurvey.skillId
        for (const arche of ARCHETYPE_KEYS) {
          const found = (SKILL_TREE[arche] ?? []).find(s => s.id === state.activeSurvey.skillId)
          if (found) { name = found.name; break }
        }
        return (
          <SurveyChoice
            skillId={state.activeSurvey.skillId}
            skillName={name}
            skillEntry={state.skills?.[state.activeSurvey.skillId]}
            accent={accent}
            onChoose={handleChooseSurveyMode}
            onCancel={() => goToScreen('skill-tree')}
          />
        )
      })()}

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

      {state.screen === 'survey-insight' && state.activeSurvey && (
        <SurveyInsight
          activeSurvey={state.activeSurvey}
          accent={accent}
          onSave={handleSurveyInsight}
          onCancel={handleSurveyCancel}
        />
      )}

      {state.screen === 'admin-skills' && isAdmin && (
        <AdminSkillsEditor
          skills={state.skills ?? {}}
          onApply={handleAdminApplyEdits}
          onClose={() => goToScreen('skill-tree')}
        />
      )}

      {state.screen === 'tasks' && (
        <TasksScreen
          tasks={state.pendingTasks ?? []}
          // Лукап тасок ищет по scriptId — в задачах могут быть core-скрипты
          // и survey-шаги (отложенные анкеты).
          scripts={[...scripts, ...(currentLevel?.surveys ?? [])]}
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

      {isAdmin && (
        <AdminPanel
          state={state}
          aspect={state.currentAspect}
          onSkipStep={handleAdminSkipStep}
          onFillSurvey={handleAdminFillSurvey}
          onFillAllSkills={handleAdminFillAllSkills}
          onOpenSkillsEditor={handleOpenSkillsEditor}
          onJumpLevel={handleAdminJumpLevel}
          onReset={handleAdminReset}
        />
      )}
    </div>
  )
}
