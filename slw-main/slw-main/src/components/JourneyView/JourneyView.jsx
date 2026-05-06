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
import { resolveSurvey, isNeSkill } from '../../data/journey/skills/resolve'
import {
  ALL_SKILL_IDS as CHE_SKILL_IDS,
  SURVEYS_CHE,
  calcCheScoreFromSkills
} from '../../data/journey/che-skills'
import Onboarding from './Onboarding'
import Chat from './Chat'
import LevelComplete from './LevelComplete'
import JourneyProfile from './JourneyProfile'
import TasksScreen from './TasksScreen'
import SurveyScreen from './SurveyScreen'
import SurveyChoice from './SurveyChoice'
import SurveyInsight from './SurveyInsight'
import SkillTree from './SkillTree'
import NeSkillTree from './NeSkillTree'
import CheSkillTree from './CheSkillTree'
import SkillDetail from './SkillDetail'
import PlanetMap from './PlanetMap'
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
// 8 — per-aspect рефакторинг state. Раньше currentLevel/messages/
//     currentScriptIndex/currentScriptId/awaitingInput/completedScripts/
//     pendingTasks были глобальными — теперь живут в state.aspects[aspect].
//     Это позволяет одному юзеру параллельно идти по БС и БЛ (и далее)
//     без коллизий. XP/streak/skills/stardust остаются глобальными.
//     При миграции с v<8 старые «плоские» поля помещаются в активный
//     аспект; чат сбрасывается (как при любом бампе CONTENT_VERSION).
// 9 — ревизия дерева навыков БС: 33 → 47 (7 слияний + 21 новый
//     навык). Слияния: scan→interoception, relax→balance,
//     aging→pain, env-quality→quality, env-design→ergonomics,
//     load→pause, library→pleasure. Старые id в state.skills
//     мигрируем через SKILL_ID_MIGRATION в migrateSkills (если
//     у юзера уже есть результат для нового id — старый
//     отбрасывается; иначе старый копируется под новым id).
//     Удалено 7 SURV-* шагов из bs-l0-surveys.md, добавлен 21 новый
//     SURV-34..54. Нумерация старых SURV-* оставлена с пропусками,
//     чтобы completedScripts существующих юзеров не сломались.
// 10 — добавлен аспект ЧЭ (Чёрная Этика, планета Passio Ignis):
//     L0 (15 шагов), L1 (25), L2 (40), L3 (стартовый — 20).
//     Регистрация в registry.js, новый файл aspects/che.js.
//     Контент в `che-l*.md`. Дерево навыков ЧЭ и анкеты пока не
//     интегрированы — будут добавлены отдельно. Существующие юзеры
//     получат сброс чат-истории по другим аспектам, но прогресс
//     XP/streak/skills сохранится.
// 11 — в L0 БС добавлены 3 универсальные анкеты (signals,
//     interoception, honesty) с подготовительным сообщением.
//     Эти 3 навыка вынесены в COMMON_BASE_SKILLS — они входят в
//     средний по каждому из 4 архетипов БС-колеса доп.слагаемыми.
//     Survey-карточки снова рендерятся в чат-ленте (Chat.jsx).
//     Старые архивные SURV из v6 не показываются благодаря бампу
//     (messages сбрасываются).
// 12 — добавлено колесо ЧЭ (CheSkillTree): 34 навыка по 4 архетипам
//     (Заводила, Оратор, Артист, Мастер Атмосферы) + 3 ядерных
//     общих (Эмо-осознанность, Выразительность, Конгруэнтность).
//     Новые файлы: che-skills/{tree,parseSurveys,index}.js, surveys.md
//     (510 утверждений, по 15 на навык). CSURV-1..3 для трёх ядерных
//     встроены инлайн в che-l0.md как часть L0-чата. getSurvey()
//     в skills/index.js теперь fallback-ит в ЧЭ-анкеты. JourneyView
//     dispatch-ит CheSkillTree для currentAspect === 'ЧЭ'. Skill ID
//     у ЧЭ имеют префикс `che-` для глобальной уникальности.
// 13 — UX-исправления для смены аспектов: handleStartSkillSurvey теперь
//     aspect-aware (определяет БС/ЧЭ по префиксу skill id + ищет
//     survey-шаг и в core, и в surveys). Кнопка «🪐 Планеты» добавлена
//     в шапку SkillTree/CheSkillTree/NeSkillTree — выход на PlanetMap
//     из колеса любого аспекта. AdminPanel получил блок «Планета» с
//     кнопками быстрого переключения между доступными аспектами.
export const CONTENT_VERSION = 13

// Миграция id навыков после ревизии дерева (v9). Старый id → новый.
// Если у юзера уже есть запись по новому id, старая отбрасывается
// (приоритет — у новой записи). Если только старая — копируем под
// новым id.
const SKILL_ID_MIGRATION = {
  'scan': 'interoception',
  'relax': 'balance',
  'aging': 'pain',
  'env-quality': 'quality',
  'env-design': 'ergonomics',
  'load': 'pause',
  'library': 'pleasure',
}

// Дефолтные значения per-aspect папки.
export const DEFAULT_ASPECT_STATE = {
  currentLevel: 0,
  currentScriptIndex: 0,
  currentScriptId: null,
  awaitingInput: null,
  messages: [],
  completedScripts: [],
  pendingTasks: [],   // { id, scriptId, aspect, addedAt, status: 'taken' | 'deferred' }
}

// Безопасное чтение активной папки. Если её нет — отдаёт дефолт
// (чтобы старые места state.currentLevel и т.п. не падали).
export function aspectOf(s) {
  return s.aspects?.[s.currentAspect] ?? DEFAULT_ASPECT_STATE
}

// Иммутабельный апдейт активной папки. patch может быть объектом
// (мерджится поверх) или функцией (cur) => next.
export function updateAspect(s, patch) {
  const cur = s.aspects?.[s.currentAspect] ?? DEFAULT_ASPECT_STATE
  const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch }
  return {
    ...s,
    aspects: { ...(s.aspects ?? {}), [s.currentAspect]: next },
  }
}

export const DEFAULT_JOURNEY = {
  screen: 'onboarding',
  onboardingStep: 0,
  currentAspect: 'БС',
  // Per-aspect «папки». Лениво создаются при первом обращении.
  aspects: {
    БС: { ...DEFAULT_ASPECT_STATE },
  },
  // Результаты анкет навыков (плоско по skillId — навыки уникальны в рамках всех аспектов).
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
    // v9: переименование id после ревизии дерева. Если у юзера уже
    // есть запись по новому id — старая отбрасывается.
    const targetId = SKILL_ID_MIGRATION[id] ?? id
    if (targetId !== id && skills[targetId]) continue
    // passes уже есть — оставляем как есть.
    if (Number.isFinite(entry.passes)) {
      out[targetId] = { ...entry, insights: entry.insights ?? [] }
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
    out[targetId] = { ...entry, passes, insights: entry.insights ?? [] }
  }
  return out
}

// Нормализует одну per-aspect папку — заполняет недостающие ключи
// дефолтами. Используется и для актуальной версии (внутри aspects),
// и для старого «плоского» state при миграции.
function normalizeAspect(folder) {
  return {
    ...DEFAULT_ASPECT_STATE,
    ...(folder ?? {}),
    messages: folder?.messages ?? [],
    completedScripts: folder?.completedScripts ?? [],
    pendingTasks: folder?.pendingTasks ?? [],
  }
}

// Миграция при загрузке. Семантика та же, что была:
//   • контент-версия совпала → пропускаем state почти как есть (с safety
//     defaults для пропавших ключей в aspects);
//   • контент-версия не совпала → сбрасываем чат / completedScripts /
//     pendingTasks (и заодно currentLevel — как и до v8), сохраняем
//     XP/streak/stardust/totalCompleted/lastActiveDate/skills/activeSurvey.
//
// Тут же поддерживаем входной «плоский» state (v<8 либо bot-sync override
// из App.jsx, который в legacy-формате может прислать flat currentLevel
// и т.п.) — флэты складываем в aspects[currentAspect].
//
// Старое поле `mode` ('core'|'pool') v5 удаляется при чтении.
function migrateState(stored) {
  if (!stored) return DEFAULT_JOURNEY

  const currentAspect = stored.currentAspect ?? 'БС'

  // Собираем aspects: если уже есть — нормализуем каждую папку; плоские
  // legacy-поля (currentLevel/messages/...) поглощаются в активный аспект.
  const incomingAspects = stored.aspects ?? {}
  const flatLegacy = {
    currentLevel: stored.currentLevel,
    currentScriptIndex: stored.currentScriptIndex,
    currentScriptId: stored.currentScriptId,
    awaitingInput: stored.awaitingInput,
    messages: stored.messages,
    completedScripts: stored.completedScripts,
    pendingTasks: stored.pendingTasks,
  }
  const hasFlatLegacy = Object.values(flatLegacy).some(v => v !== undefined)

  if (stored.contentVersion === CONTENT_VERSION) {
    const aspects = {}
    for (const [k, v] of Object.entries(incomingAspects)) {
      aspects[k] = normalizeAspect(v)
    }
    if (hasFlatLegacy) {
      // Bot-sync override может прийти с плоскими полями — поглощаем их
      // в активный аспект, не затирая то, что уже есть.
      const cur = aspects[currentAspect] ?? { ...DEFAULT_ASPECT_STATE }
      aspects[currentAspect] = normalizeAspect({
        ...cur,
        ...Object.fromEntries(
          Object.entries(flatLegacy).filter(([, v]) => v !== undefined)
        ),
      })
    }
    if (!aspects[currentAspect]) {
      aspects[currentAspect] = { ...DEFAULT_ASPECT_STATE }
    }
    // Сбрасываем legacy-плоские поля наверх, чтобы не плодить мусор в
    // сохранённом state (теперь они живут только в aspects).
    // eslint-disable-next-line no-unused-vars
    const {
      currentLevel: _l, currentScriptIndex: _i, currentScriptId: _id,
      awaitingInput: _ai, messages: _m, completedScripts: _cs, pendingTasks: _pt,
      mode: _mode,
      ...rest
    } = stored
    return {
      ...DEFAULT_JOURNEY,
      ...rest,
      aspects,
      currentAspect,
      skills: migrateSkills(stored.skills),
      activeSurvey: stored.activeSurvey ?? null,
    }
  }

  // Контент-версия не совпала — сбрасываем папки аспектов до дефолтов
  // (как делал старый код: messages/completedScripts/pendingTasks/
  // currentLevel обнулялись). Глобальные поля (XP/streak/skills/etc) —
  // сохраняем.
  return {
    ...DEFAULT_JOURNEY,
    currentAspect,
    aspects: { [currentAspect]: { ...DEFAULT_ASPECT_STATE } },
    onboardingStep: stored.onboardingStep ?? 0,
    screen: stored.screen ?? DEFAULT_JOURNEY.screen,
    xp: stored.xp ?? 0,
    stardust: stored.stardust ?? 0,
    streak: stored.streak ?? 0,
    totalCompleted: stored.totalCompleted ?? 0,
    lastActiveDate: stored.lastActiveDate ?? null,
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

  // Активная per-aspect папка. Все per-aspect чтения идут через `a`,
  // все per-aspect записи — через updateAspect(s, ...).
  const a = aspectOf(state)

  const currentJourney = getJourney(state.currentAspect)
  const currentLevel = currentJourney?.levels?.[a.currentLevel]
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
    const lvl = level ?? a.currentLevel
    const lvlData = currentJourney?.levels?.[lvl]
    const inCore = lvlData?.core?.find(s => s.id === scriptId)
    if (inCore) return inCore
    const inSurveys = lvlData?.surveys?.find(s => s.id === scriptId)
    if (inSurveys) return inSurveys
    return scripts.find(s => s.id === scriptId) ?? null
  }, [currentJourney, scripts, a.currentLevel])

  const nextLevel = currentJourney?.levels?.[a.currentLevel + 1] ?? null

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
  }, [a.messages, isTyping, state.screen, a.awaitingInput])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const addBotMessage = useCallback((text, delay = 400) => new Promise((resolve) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setState(s => updateAspect(s, cur => ({
        ...cur,
        messages: [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', text }]
      })))
      resolve()
    }, delay)
  }), [setState])

  const addUserMessage = useCallback((text) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      messages: [...cur.messages, { id: Date.now() + Math.random(), role: 'user', text }]
    })))
  }, [setState])

  const awardXP = useCallback((xp, stardust = 0, scriptId = null) => {
    if (xp <= 0 && stardust <= 0) return
    setState(s => {
      // Глобальные счётчики (XP/streak/...).
      const globals = {
        ...s,
        xp: s.xp + xp,
        stardust: s.stardust + stardust,
        streak: calcStreak(s),
        totalCompleted: s.totalCompleted + 1,
        lastActiveDate: todayStr(),
      }
      // Per-aspect: completedScripts.
      return updateAspect(globals, cur => ({
        ...cur,
        completedScripts: scriptId
          ? [...cur.completedScripts, scriptId]
          : (cur.currentScriptId ? [...cur.completedScripts, cur.currentScriptId] : cur.completedScripts)
      }))
    })
    const parts = []
    if (xp > 0) parts.push(`+${xp} XP`)
    if (stardust > 0) parts.push(`+${stardust} ✦`)
    showToast(parts.join('   '))
  }, [setState, showToast])

  const deliverScript = useCallback((index) => {
    const script = scripts[index]
    if (!script) {
      setState(s => updateAspect({ ...s, screen: 'levelcomplete' }, cur => ({ ...cur, awaitingInput: null })))
      return
    }
    setState(s => updateAspect(s, cur => ({
      ...cur,
      currentScriptIndex: index,
      currentScriptId: script.id,
      awaitingInput: null,
      // Архивируем скрипт в историю чата с level — чтобы lookup всегда
      // находил правильный текст, даже если ID совпадают между уровнями.
      messages: [
        ...cur.messages,
        { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: script.id, level: cur.currentLevel }
      ]
    })))
  }, [scripts, setState])

  // ─── Онбординг ───────────────────────────────────────────────
  // Шаги 0–3: общее интро, не привязанное к аспекту.
  // После шага 3 → Карта Планет, юзер сам выбирает с какой планеты
  // начать. Дальше handleSwitchAspect сам инжектит aspectIntro и
  // первый скрипт L0 выбранного аспекта.
  const handleOnboardingNext = useCallback(async () => {
    const step = state.onboardingStep
    addUserMessage(ONBOARDING[Math.min(step, 3)]?.button || 'Далее')
    if (step < 3) {
      await addBotMessage(ONBOARDING[step + 1].text, 700)
      setState(s => ({ ...s, onboardingStep: step + 1 }))
    } else if (step === 3) {
      // Завершаем общую часть онбординга — рассказываем про карту планет.
      // Юзер сам жмёт кнопку «Открыть Карту Планет» (шаг 4), чтобы перейти.
      await addBotMessage(
        'Готово. Сейчас покажу Карту Планет — выбери, с какого аспекта хочешь начать.',
        900
      )
      setState(s => ({ ...s, onboardingStep: 4 }))
    } else if (step === 4) {
      // Юзер нажал «Открыть Карту Планет». onboardingStep оставляем 4 —
      // handleSwitchAspect потом дотянет его до 6 при выборе планеты.
      setState(s => ({ ...s, screen: 'planets' }))
    }
  }, [state.onboardingStep, addBotMessage, addUserMessage, setState])

  // Помещаем задание в очередь активных (без дублей по scriptId).
  const enqueueTask = useCallback((script, status) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      pendingTasks: [
        ...(cur.pendingTasks ?? []).filter(t => t.scriptId !== script.id),
        {
          id: `${script.id}-${Date.now()}`,
          scriptId: script.id,
          aspect: s.currentAspect,
          addedAt: Date.now(),
          status
        }
      ]
    })))
  }, [])

  const removePending = useCallback((scriptId) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      pendingTasks: (cur.pendingTasks ?? []).filter(t => t.scriptId !== scriptId)
    })))
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

      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 600)
    } else if (action === 'answer_number') {
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'number' })))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'answer_text') {
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'text' })))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'complete_exercise') {
      // Открываем поле для обязательного комментария. XP и переход к
      // следующему скрипту произойдут после ввода в handleSend
      // (ветка awaitingInput === 'exercise_note').
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'exercise_note' })))
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
  }, [scripts, a.currentScriptIndex, state.skills, addBotMessage, addUserMessage, awardXP, deliverScript, enqueueTask, removePending])

  // ─── Ввод текста / числа ─────────────────────────────────────
  const handleSend = useCallback(async () => {
    const val = inputVal.trim()
    if (!val) return
    const script = scripts[a.currentScriptIndex]
    if (a.awaitingInput === 'number') {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 1 || num > 10) {
        await addBotMessage('Пожалуйста, введи число от 1 до 10.', 400)
        return
      }
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      if (script?.followUp) await addBotMessage(script.followUp(val), 700)
      else await addBotMessage(`Записал: ${val}/10.`, 500)
      // Сайд-эффект: оценка вопроса → score аспекта
      onScoresChange({ ...scores, [state.currentAspect]: num })
      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 10, 0, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    } else if (a.awaitingInput === 'text') {
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
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
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    } else if (a.awaitingInput === 'exercise_note') {
      // Завершение упражнения с обязательным комментарием.
      // Пустая строка отсекается общим guard'ом в начале handleSend.
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
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
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    }
  }, [inputVal, a.awaitingInput, a.currentScriptIndex, state.currentAspect, scripts, scores, diary, addBotMessage, addUserMessage, awardXP, deliverScript, onDiaryChange, onScoresChange, removePending])

  const handleReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [])

  // Переход на следующий уровень. Сохраняет всю историю сообщений
  // (с level=прошлый), добавляет первый скрипт нового уровня.
  const handleNextLevel = useCallback(() => {
    const next = currentJourney?.levels?.[a.currentLevel + 1]
    if (!next) return
    const firstScript = (next.core ?? next.scripts ?? [])[0]
    setState(s => updateAspect(
      { ...s, screen: 'chat' },
      cur => ({
        ...cur,
        currentLevel: cur.currentLevel + 1,
        currentScriptIndex: 0,
        currentScriptId: firstScript?.id ?? null,
        awaitingInput: null,
        messages: firstScript
          ? [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: firstScript.id, level: cur.currentLevel + 1 }]
          : cur.messages
      })
    ))
  }, [currentJourney, a.currentLevel])

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
  const handleSurveyAnswer = useCallback((value, insightText) => {
    // Если юзер записал инсайт по конкретному утверждению — кладём в дневник
    // отдельной записью с привязкой к навыку и тексту утверждения.
    const trimmedInsight = (insightText ?? '').trim()
    if (trimmedInsight) {
      const active = state.activeSurvey
      const survey = active ? resolveSurvey(active.skillId) : null
      const stmts = survey
        ? buildSurveyStatements(survey, active.mode ?? 'short', active.startPass ?? 1)
        : []
      const current = stmts[active?.stepIndex ?? 0]
      const statementText = current?.statement ?? ''
      const skillName = survey?.name ?? active?.skillId ?? ''
      onDiaryChange([
        {
          id: Date.now() + Math.random(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: trimmedInsight,
          source: 'journey-survey-statement',
          prompt: statementText,
          promptTitle: skillName,
          skillId: active?.skillId,
        },
        ...diary,
      ])
    }

    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const survey = resolveSurvey(active.skillId)
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
  }, [setState, state.activeSurvey, state.currentAspect, diary, onDiaryChange])

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
    const survey = resolveSurvey(active.skillId)
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

    // Если анкета была запущена из чат-скрипта (например, SURV-* в L0)
    // — возвращаем юзера в чат и продвигаем на следующий шаг.
    // Если из дерева навыков — открываем экран деталей навыка.
    const fromChatScript = scripts.some(sc => sc.id === active.scriptId)

    setState(s => ({
      ...s,
      skills: newSkills,
      activeSurvey: null,
      skillDetailId: fromChatScript ? null : active.skillId,
      screen: fromChatScript ? 'chat' : 'skill-detail',
    }))

    if (fromChatScript) {
      const nextIdx = (aspectOf(state).currentScriptIndex ?? 0) + 1
      setTimeout(() => deliverScript(nextIdx), 100)
    }

    // Пересчёт средних: и БС, и ЧЭ. Каждый calc смотрит только в свои id,
    // так что один newSkills корректно обновляет оба score одновременно.
    const bsScore = calcBSScoreFromSkills(newSkills)
    const cheScore = calcCheScoreFromSkills(newSkills)
    const nextScores = { ...scores }
    if (Number.isFinite(bsScore))  nextScores['БС'] = Math.round(bsScore)
    if (Number.isFinite(cheScore)) nextScores['ЧЭ'] = Math.round(cheScore)
    onScoresChange(nextScores)

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
  }, [state, scripts, scores, diary, onDiaryChange, onScoresChange, awardXP, removePending, setState, deliverScript])

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
    const skillEntry = state.skills?.[skillId]
    const draft = skillEntry?.draft

    // ЧИ — анкеты живут отдельно (NE_SURVEYS из ne-skills.js), не как
    // journey-скрипты. Используем синтетический scriptId. Аспект в
    // state остаётся 'ЧИ' (юзер пришёл из Колеса ЧИ).
    if (isNeSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'ЧИ',
          screen: 'survey',
          activeSurvey: {
            scriptId: `ne-survey-${skillId}`,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        }))
        return
      }
      if (getNextPass(skillEntry) === 0) return
      setState(s => ({
        ...s,
        currentAspect: 'ЧИ',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `ne-survey-${skillId}`, skillId },
      }))
      return
    }

    // Определяем аспект по skill ID. У ЧЭ-навыков id с префиксом `che-`,
    // их анкеты живут инлайн в core (CSURV-1..3 в che-l0.md), у БС —
    // в отдельном пуле levels[0].surveys.
    const aspect = skillId.startsWith('che-') ? 'ЧЭ' : 'БС'
    const journeyData = getJourney(aspect)

    // Ищем survey-шаг и в core, и в surveys-pool — для ЧЭ они лежат в core,
    // для БС — в surveys.
    const allSteps = [
      ...(journeyData?.levels?.[0]?.surveys ?? []),
      ...(journeyData?.levels?.[0]?.core ?? [])
    ]
    const target = allSteps.find(s => s.type === 'survey' && s.skill === skillId)
    if (!target) return

    if (draft) {
      // Продолжаем как было — без выбора. currentScriptId не трогаем:
      // он нужен для chat-flow (core-шагов), а survey-id в нём только
      // путает resolveScript при возврате в чат.
      // Аспект переключаем на нужный (БС или ЧЭ), сбрасываем awaitingInput.
      setState(s => updateAspect(
        {
          ...s,
          currentAspect: aspect,
          screen: 'survey',
          activeSurvey: {
            scriptId: target.id,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        },
        cur => ({ ...cur, awaitingInput: null })
      ))
      return
    }

    if (getNextPass(skillEntry) === 0) return  // всё пройдено

    // Открываем экран выбора. activeSurvey временно хранит skillId/scriptId,
    // mode выберется на следующем шаге.
    setState(s => updateAspect(
      {
        ...s,
        currentAspect: aspect,
        screen: 'survey-choice',
        activeSurvey: { scriptId: target.id, skillId },  // mode появится после choose
      },
      cur => ({ ...cur, awaitingInput: null })
    ))
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

  // Вспомогательное: если открыта анкета — сохраняем её черновик в
  // state.skills[id].draft и закрываем модалку. Возвращает state с
  // обнулёнными activeSurvey/skillDetailId. Используется при свободном
  // переключении планеты, чтобы не терять заполненную часть.
  const dismissActiveSurveyToDraft = useCallback((s) => {
    if (!s.activeSurvey) return { ...s, skillDetailId: null }
    const { skillId, mode, startPass, stepIndex, answers } = s.activeSurvey
    const skillEntry = s.skills?.[skillId] ?? {}
    return {
      ...s,
      activeSurvey: null,
      skillDetailId: null,
      skills: {
        ...s.skills,
        [skillId]: {
          ...skillEntry,
          draft: { mode, startPass, stepIndex, answers: answers ?? {} },
        },
      },
    }
  }, [])

  // Открыть Карту Планет. Если открыта анкета — сохраняем её draft.
  const handleOpenPlanetMap = useCallback(() => {
    setState(s => ({ ...dismissActiveSurveyToDraft(s), screen: 'planets' }))
  }, [setState, dismissActiveSurveyToDraft])

  // Переключение на другой аспект. Сохраняет анкету (если открыта) в
  // draft, ставит currentAspect, переводит экран в 'chat'.
  // Если у нового аспекта папки ещё нет (первый заход) — инжектим intro
  // нового аспекта + первый скрипт L0, чтобы юзер сразу попал в чат.
  // Иначе — возвращаемся к сохранённому состоянию.
  const handleSwitchAspect = useCallback((aspectKey) => {
    if (!aspectKey) return
    setState(s => {
      const cleaned = dismissActiveSurveyToDraft(s)
      const existing = cleaned.aspects?.[aspectKey]
      const isFresh = !existing || (
        !existing.messages?.length && !existing.currentScriptId
      )

      let folder = existing ?? { ...DEFAULT_ASPECT_STATE }
      if (isFresh) {
        const j = getJourney(aspectKey)
        const intro = j?.intro ?? []
        const firstScript = (j?.levels?.[0]?.core ?? j?.levels?.[0]?.scripts ?? [])[0]
        const msgs = []
        let idCounter = Date.now()
        for (let i = 0; i < intro.length; i++) {
          const e = intro[i]
          // intro[i>0] обычно содержит button — рисуем «псевдо-клик» юзера
          // перед ответным текстом бота, чтобы интро читалось как диалог.
          if (i > 0 && e.button) {
            msgs.push({ id: idCounter++, role: 'user', text: e.button })
          }
          if (e.text) {
            msgs.push({ id: idCounter++, role: 'bot', text: e.text })
          }
        }
        if (firstScript) {
          msgs.push({
            id: idCounter++,
            role: 'bot',
            kind: 'script',
            scriptId: firstScript.id,
            level: 0,
          })
        }
        folder = {
          ...DEFAULT_ASPECT_STATE,
          currentScriptId: firstScript?.id ?? null,
          currentScriptIndex: 0,
          messages: msgs,
        }
      }

      return {
        ...cleaned,
        currentAspect: aspectKey,
        screen: 'chat',
        // Переключение на любую планету закрывает общий онбординг.
        onboardingStep: Math.max(cleaned.onboardingStep ?? 0, 6),
        aspects: { ...(cleaned.aspects ?? {}), [aspectKey]: folder },
      }
    })
  }, [setState, dismissActiveSurveyToDraft])

  // ─── Админ-действия (видимы только при isAdmin) ──────────────
  // Все хендлеры обходят геймификацию: XP не выдаём, в дневник
  // не пишем, через addBotMessage не отвечаем.

  // 1. Пропустить текущий шаг в чате — просто двигаем currentScriptIndex.
  const handleAdminSkipStep = useCallback(() => {
    setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
    setTimeout(() => deliverScript(a.currentScriptIndex + 1), 50)
  }, [deliverScript, a.currentScriptIndex])

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

  // 3. Заполнить все навыки БС и ЧЭ по 7/10 (полностью все 3 прохода).
  //    Сразу пересчитываем средние по обоим аспектам.
  //    ЧИ-навыки сейчас не заполняем — для них admin-функция пока не нужна.
  const handleAdminFillAllSkills = useCallback(() => {
    const completedAt = Date.now()
    const newSkills = {}
    const fillFromSurveys = (skillIds, surveysMap) => {
      for (const skillId of skillIds) {
        const survey = surveysMap[skillId]
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
    }
    fillFromSurveys(ALL_SKILL_IDS, SURVEYS)
    fillFromSurveys(CHE_SKILL_IDS, SURVEYS_CHE)

    setState(s => ({ ...s, skills: newSkills }))

    const bs = calcBSScoreFromSkills(newSkills)
    const che = calcCheScoreFromSkills(newSkills)
    const next = { ...scores }
    if (Number.isFinite(bs))  next['БС'] = Math.round(bs)
    if (Number.isFinite(che)) next['ЧЭ'] = Math.round(che)
    onScoresChange(next)
  }, [scores, onScoresChange, setState])

  // 4. Прыжок на конкретный уровень. Сбрасываем core-индекс, подаём
  //    первый скрипт в чат. Если уровня нет — no-op.
  const handleAdminJumpLevel = useCallback((targetLevel) => {
    const lvlData = currentJourney?.levels?.[targetLevel]
    if (!lvlData) return
    const first = (lvlData.core ?? lvlData.scripts ?? [])[0]
    setState(s => updateAspect(
      { ...s, screen: 'chat', activeSurvey: null },
      cur => ({
        ...cur,
        currentLevel: targetLevel,
        currentScriptIndex: 0,
        currentScriptId: first?.id ?? null,
        awaitingInput: null,
        messages: first
          ? [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: first.id, level: targetLevel }]
          : cur.messages
      })
    ))
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
    const che = calcCheScoreFromSkills(newSkills)
    const next = { ...scores }
    if (Number.isFinite(bs))  next['БС'] = Math.round(bs)
    if (Number.isFinite(che)) next['ЧЭ'] = Math.round(che)
    onScoresChange(next)
  }, [state.skills, scores, onScoresChange, setState])

  const currentScript = scripts[a.currentScriptIndex]
  const progressPct = scripts.length > 0
    ? Math.round((a.currentScriptIndex / scripts.length) * 100)
    : 0

  // «Плоский» вид state для совместимости с детьми, которые читают
  // state.currentLevel / state.messages / state.awaitingInput / ... напрямую.
  // После рефакторинга эти поля живут в state.aspects[currentAspect],
  // но мерджим их сверху, чтобы не править все child-компоненты.
  const stateForChildren = { ...state, ...a }

  return (
    <div className={styles.shell} style={{ '--accent': accent }}>
      <div className={styles.stars} />

      {state.screen === 'onboarding' && (
        <Onboarding
          state={stateForChildren}
          accent={accent}
          isTyping={isTyping}
          chatRef={chatRef}
          onNext={handleOnboardingNext}
          aspectIntro={aspectIntro}
        />
      )}

      {state.screen === 'chat' && (
        <Chat
          state={stateForChildren}
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
          onOpenPlanetMap={handleOpenPlanetMap}
          // Пилюля «Оценить навыки» появляется только после L0 (или для админа).
          surveyRemaining={
            (isAdmin || (a.currentLevel ?? 0) >= 1)
              ? getSkillProgress(state.skills ?? {}).remaining
              : 0
          }
          pendingCount={a.pendingTasks?.length ?? 0}
          aspectName={currentJourney
            ? `Уровень ${a.currentLevel} · ${currentLevel?.title}`
            : 'Путешествие'}
          planet={currentJourney?.planet}
        />
      )}

      {state.screen === 'levelcomplete' && (() => {
        // На L0 после прохождения core — primary CTA «Открыть Колесо аспекта»
        // (skill-tree). Для БС — если у уровня есть анкеты (surveys).
        // Для ЧИ — всегда (read-only дерево; анкеты пока не реализованы).
        const isNe = state.currentAspect === 'ЧИ'
        const hasSurveys = (currentLevel?.surveys?.length ?? 0) > 0
        const showWheel = a.currentLevel === 0 && (hasSurveys || isNe)
        const wheelLabel = isNe ? 'Открыть Колесо ЧИ' : 'Открыть Колесо БС'
        return (
          <LevelComplete
            state={stateForChildren}
            accent={accent}
            completeText={currentLevel?.complete?.text ?? ''}
            levelTitle={currentLevel?.title}
            planetName={currentJourney?.planet}
            wheelLabel={wheelLabel}
            onProfile={() => goToScreen('profile')}
            nextLevelTitle={nextLevel?.title}
            onNextLevel={nextLevel ? handleNextLevel : null}
            onOpenWheel={showWheel ? handleOpenSkillTree : null}
          />
        )
      })()}

      {state.screen === 'profile' && (
        <JourneyProfile
          state={stateForChildren}
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
              const cur = aspectOf(s)
              return updateAspect(
                {
                  ...s,
                  skills: nextSkills,
                  activeSurvey: null,
                  screen: cur.currentScriptIndex >= scripts.length ? 'levelcomplete' : 'chat',
                },
                folder => ({ ...folder, awaitingInput: null })
              )
            })
          }}
          onReset={handleReset}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'ЧИ' && (
        <NeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'ЧЭ' && (
        <CheSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect !== 'ЧИ' && state.currentAspect !== 'ЧЭ' && (
        <SkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-detail' && state.skillDetailId && (
        <SkillDetail
          skillId={state.skillDetailId}
          currentLevel={a.currentLevel ?? 0}
          passes={getCompletedPasses(state.skills?.[state.skillDetailId])}
          accent={accent}
          onClose={() => goToScreen('skill-tree')}
        />
      )}

      {state.screen === 'survey-choice' && state.activeSurvey && (() => {
        // Найдём имя навыка для заголовка — сначала через resolveSurvey (универсально для всех аспектов),
        // потом через БС-дерево как фолбэк для случая, когда анкета ещё не загружена.
        let name = state.activeSurvey.skillId
        const survey = resolveSurvey(state.activeSurvey.skillId)
        if (survey?.name) {
          name = survey.name
        } else {
          for (const arche of ARCHETYPE_KEYS) {
            const found = (SKILL_TREE[arche] ?? []).find(s => s.id === state.activeSurvey.skillId)
            if (found) { name = found.name; break }
          }
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

      {state.screen === 'planets' && (
        <PlanetMap
          state={state}
          onSwitch={handleSwitchAspect}
          onClose={() => goToScreen('chat')}
          onLockedTap={() => showToast('Эта планета пока закрыта')}
        />
      )}

      {state.screen === 'tasks' && (
        <TasksScreen
          tasks={a.pendingTasks ?? []}
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
          state={stateForChildren}
          aspect={state.currentAspect}
          onSkipStep={handleAdminSkipStep}
          onFillSurvey={handleAdminFillSurvey}
          onFillAllSkills={handleAdminFillAllSkills}
          onOpenSkillsEditor={handleOpenSkillsEditor}
          onJumpLevel={handleAdminJumpLevel}
          onReset={handleAdminReset}
          onSwitchAspect={handleSwitchAspect}
        />
      )}
    </div>
  )
}
