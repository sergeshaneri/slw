import { useEffect, useRef, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { AspectKey } from '@/types/aspect'
import type {
  JourneyState, AspectState, AwaitingInput, ChatMessage, PendingTask,
  SkillState, ActiveSurvey
} from '@/types/journey'
import type { Script } from '@/types/script'
import type { DiaryEntry } from '@/types/diary'
import { postStepCompleted, chooseHabit } from '../../api/client'
import { tmaHaptic } from '../../tma/hooks'
import { ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import { ONBOARDING } from '../../data/journey/onboarding'
import { getJourney } from '../../data/journey/registry'
import {
  calcSurveyResult, calcSiScoreFromSkills, getSkillProgress,
  findFirstUnansweredSurveyIndex, ALL_SKILL_IDS, SURVEY_BLOCK_KEYS, SURVEYS,
  getNextPass, getStatementsForPass, getStatementsForFullRange,
  buildSurveyStatements, getCompletedPasses,
  ARCHETYPE_KEYS, SKILL_TREE
} from '../../data/journey/skills'
import { resolveSurvey, isNeSkill, isNiSkill, isTeSkill, isTiSkill, isFiSkill, isSeSkill } from '../../data/journey/skills/resolve'
import {
  calcNeScoreFromSkills, getNeSkillProgress,
  ALL_SKILL_IDS as NE_SKILL_IDS,
} from '../../data/journey/skills/ne-skills'
import {
  calcNiScoreFromSkills, getNiSkillProgress,
  ALL_SKILL_IDS as NI_SKILL_IDS,
} from '../../data/journey/skills/ni-skills'
import {
  calcTeScoreFromSkills, getTeSkillProgress,
  ALL_SKILL_IDS as TE_SKILL_IDS,
} from '../../data/journey/skills/te-skills'
import {
  calcTiScoreFromSkills, getTiSkillProgress,
  ALL_SKILL_IDS as TI_SKILL_IDS,
} from '../../data/journey/skills/ti-skills'
import {
  calcFiScoreFromSkills, getFiSkillProgress,
  ALL_SKILL_IDS as FI_SKILL_IDS,
} from '../../data/journey/skills/fi-skills'
import {
  calcSeScoreFromSkills, getSeSkillProgress,
  ALL_SKILL_IDS as SE_SKILL_IDS,
} from '../../data/journey/skills/se-skills'
import {
  ALL_SKILL_IDS as FE_SKILL_IDS,
  SURVEYS_FE,
  calcFeScoreFromSkills,
  getSkillProgress as getFeSkillProgress
} from '../../data/journey/fe-skills'
import Onboarding from './Onboarding'
import Chat from './Chat'
import GuestSaveNudge from './GuestSaveNudge'
import LevelComplete from './LevelComplete'
import JourneyProfile from './JourneyProfile'
import TasksScreen from './TasksScreen'
import SurveyScreen from './SurveyScreen'
import SurveyChoice from './SurveyChoice'
import SurveyInsight from './SurveyInsight'
import SkillTree from './SkillTree'
import NeSkillTree from './NeSkillTree'
import NiSkillTree from './NiSkillTree'
import FeSkillTree from './FeSkillTree'
import TeSkillTree from './TeSkillTree'
import TiSkillTree from './TiSkillTree'
import FiSkillTree from './FiSkillTree'
import SeSkillTree from './SeSkillTree'
import SkillDetail from './SkillDetail'
import SkillTraits from './SkillTraits'
import FeCoreOverview from './FeCoreOverview'
import { getSkillContent, getUnlockedSkillLevel } from '../../data/skills'
import PlanetMap from './PlanetMap'
import AdminPanel from './AdminPanel'
import AdminSkillsEditor from './AdminSkillsEditor'
import type { SkillEdits } from './AdminSkillsEditor'
import Hint from '../Onboarding/Hint'
import styles from './JourneyView.module.css'

// suppress unused-import warnings without changing call surface: эти
// идентификаторы используются для будущих хоков, но в рантайме они
// не нужны напрямую в JourneyView. Оставлены чтобы не ломать импорт-API
// (legacy imports видны из соседних веток миграции). Они подтянулись из
// .jsx — оставляем как есть.
void findFirstUnansweredSurveyIndex
void getStatementsForPass
void getStatementsForFullRange
void SURVEYS
void SURVEYS_FE

// NOTE(ts): ScreenName already includes 'tasks' and 'fe-core-overview' in
// types/journey.ts; this comment used to flag the gap before P3 widened
// the union.

// Маленькая обёртка-хинт для skill-tree экранов (8 типов деревьев — не хочется
// внедряться в каждый отдельно). Хинт показывается ОДИН раз на любом дереве.
type SkillTreeIntroHintProps = {
  user?: unknown
}

function SkillTreeIntroHint({ user }: SkillTreeIntroHintProps) {
  return (
    <div style={{ padding: '12px 16px 0' }}>
      <Hint id="skill-tree-intro" user={user}>
        Анкета 5 вопросов × 3 прохода. Можно идти по поверхности или углубляться. Колесо растёт по мере прокачки.
      </Hint>
    </div>
  )
}

// Версия контента уровня. При несовпадении с сохранённой в state
// чат-история сбрасывается, чтобы юзер увидел новые тексты с начала
// (статистика — XP/streak/totalCompleted — сохраняется).
// История версий — см. оригинал в JourneyView.jsx до v27.
export const CONTENT_VERSION = 27

// Миграция id навыков после ревизии дерева (v9). Старый id → новый.
// Если у юзера уже есть запись по новому id, старая отбрасывается
// (приоритет — у новой записи). Если только старая — копируем под
// новым id.
const SKILL_ID_MIGRATION: Record<string, string> = {
  'scan': 'interoception',
  'relax': 'balance',
  'aging': 'pain',
  'env-quality': 'quality',
  'env-design': 'ergonomics',
  'load': 'pause',
  'library': 'pleasure',
}

// Дефолтные значения per-aspect папки.
export const DEFAULT_ASPECT_STATE: AspectState = {
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
export function aspectOf(s: JourneyState): AspectState {
  return s.aspects?.[s.currentAspect] ?? DEFAULT_ASPECT_STATE
}

type AspectPatch = Partial<AspectState> | ((cur: AspectState) => AspectState)

// Иммутабельный апдейт активной папки. patch может быть объектом
// (мерджится поверх) или функцией (cur) => next.
export function updateAspect(s: JourneyState, patch: AspectPatch): JourneyState {
  const cur = s.aspects?.[s.currentAspect] ?? DEFAULT_ASPECT_STATE
  const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch }
  return {
    ...s,
    aspects: { ...(s.aspects ?? {}), [s.currentAspect]: next },
  }
}

export const DEFAULT_JOURNEY: JourneyState = {
  screen: 'onboarding',
  onboardingStep: 0,
  currentAspect: 'Si',
  // Per-aspect «папки». Лениво создаются при первом обращении.
  aspects: {
    Si: { ...DEFAULT_ASPECT_STATE },
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

// Префикс ID навыков ЧЭ переименован с `che-` (русский транслит) на `fe-`
// (стандартная соционическая нотация). Применяется до общего SKILL_ID_MIGRATION.
function renameChePrefix(id: string): string {
  return id.startsWith('che-') ? 'fe-' + id.slice(4) : id
}

// Старые insights в state.skills могут не иметь поля source — добавляем
// 'survey' (это все уже сохранённые до v21 инсайты, они приходили из SurveyInsight).
type InsightLike = { source?: string; [key: string]: unknown }

function upgradeInsights(insights: unknown): InsightLike[] {
  if (!Array.isArray(insights) || insights.length === 0) return (insights as InsightLike[] | undefined) ?? []
  return insights.map((ins: unknown) => {
    if (!ins || typeof ins !== 'object') return ins as InsightLike
    const item = ins as InsightLike
    if (item.source) return item
    return { source: 'survey', ...item }
  })
}

// state.skills entry shape с учётом legacy-полей миграции.
// Используем структурный тип ('any-shaped'-record) — миграция не знает
// точного состава старых записей.
type StoredSkillEntry = SkillState & {
  passes?: number
  answers?: Record<string, Array<number | null | undefined>>
  result?: number
  insights?: unknown
}

function migrateSkills(skills: unknown): Record<string, StoredSkillEntry> {
  if (!skills || typeof skills !== 'object') return {}
  const src = skills as Record<string, StoredSkillEntry | null | undefined>
  const out: Record<string, StoredSkillEntry> = {}
  for (const [id, entry] of Object.entries(src)) {
    if (!entry) continue
    // Префикс che- → fe- для навыков ЧЭ + v9-переименования БС-навыков.
    const renamed = renameChePrefix(id)
    const targetId = SKILL_ID_MIGRATION[renamed] ?? renamed
    if (targetId !== id && src[targetId]) continue
    // passes уже есть — оставляем как есть.
    if (typeof entry.passes === 'number' && Number.isFinite(entry.passes)) {
      out[targetId] = { ...entry, insights: upgradeInsights(entry.insights) }
      continue
    }
    // Вычисляем passes по answers (max длина массива).
    let passes = 0
    if (entry.answers) {
      for (const k of SURVEY_BLOCK_KEYS) {
        const arr = entry.answers[k] ?? []
        const len = arr.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).length
        if (len > passes) passes = len
      }
    } else if (typeof entry.result === 'number' && Number.isFinite(entry.result)) {
      // У старых записей нет answers, но есть result — считаем как полную (3).
      passes = 3
    }
    out[targetId] = { ...entry, passes, insights: upgradeInsights(entry.insights) }
  }
  return out
}

// Нормализует одну per-aspect папку — заполняет недостающие ключи
// дефолтами. Используется и для актуальной версии (внутри aspects),
// и для старого «плоского» state при миграции.
function normalizeAspect(folder: Partial<AspectState> | null | undefined): AspectState {
  return {
    ...DEFAULT_ASPECT_STATE,
    ...(folder ?? {}),
    messages: folder?.messages ?? [],
    completedScripts: folder?.completedScripts ?? [],
    pendingTasks: folder?.pendingTasks ?? [],
  }
}

// Кириллица → латиница для ключей аспектов (v14). Применяется до проверки
// contentVersion — поэтому v13 юзеры получают плавный rename без сброса чата.
const CYR_TO_LAT_ASPECT: Record<string, AspectKey> = {
  'БС': 'Si', 'ЧС': 'Se', 'БЛ': 'Ti', 'ЧЛ': 'Te',
  'БЭ': 'Fi', 'ЧЭ': 'Fe', 'БИ': 'Ni', 'ЧИ': 'Ne',
}

// Перепишем stored.currentAspect и ключи stored.aspects в латиницу.
// Если у юзера каким-то образом уже есть и кир. и лат. ключ — латинская
// версия имеет приоритет (кириллический ключ отбрасывается).
type StoredJourneyShape = Partial<JourneyState> & {
  currentAspect?: string
  aspects?: Record<string, Partial<AspectState> | null | undefined>
  // Плоские legacy-поля
  currentLevel?: AspectState['currentLevel']
  currentScriptIndex?: number
  currentScriptId?: string | null
  awaitingInput?: AwaitingInput
  messages?: ChatMessage[]
  completedScripts?: string[]
  pendingTasks?: PendingTask[]
  mode?: unknown
  contentVersion?: number
  skills?: unknown
  activeSurvey?: unknown
}

function migrateCyrAspectKeys(stored: StoredJourneyShape | null | undefined): StoredJourneyShape | null | undefined {
  if (!stored || typeof stored !== 'object') return stored
  let changed = false
  let next: StoredJourneyShape = stored

  if (typeof stored.currentAspect === 'string' && CYR_TO_LAT_ASPECT[stored.currentAspect]) {
    next = { ...next, currentAspect: CYR_TO_LAT_ASPECT[stored.currentAspect] }
    changed = true
  }

  if (stored.aspects && typeof stored.aspects === 'object') {
    const newAspects: Record<string, Partial<AspectState> | null | undefined> = {}
    let aspectsChanged = false
    for (const [k, v] of Object.entries(stored.aspects)) {
      const target = CYR_TO_LAT_ASPECT[k] ?? k
      if (target !== k) aspectsChanged = true
      // Латинский ключ уже есть — кириллический отбрасываем.
      if (newAspects[target]) continue
      newAspects[target] = v
    }
    if (aspectsChanged) {
      next = { ...next, aspects: newAspects }
      changed = true
    }
  }

  return changed ? next : stored
}

// Миграция при загрузке. Семантика та же, что была:
//   • контент-версия совпала → пропускаем state почти как есть (с safety
//     defaults для пропавших ключей в aspects);
//   • контент-версия не совпала → сбрасываем чат / completedScripts /
//     pendingTasks (и заодно currentLevel — как и до v8), сохраняем
//     XP/streak/stardust/totalCompleted/lastActiveDate/skills/activeSurvey.
function migrateState(stored: StoredJourneyShape | null | undefined): JourneyState {
  if (!stored) return DEFAULT_JOURNEY

  // v14: переименуем кириллические ключи в латиницу ДО проверки версии.
  stored = migrateCyrAspectKeys(stored)
  if (!stored) return DEFAULT_JOURNEY
  const isV13Rename = stored.contentVersion === 13
  // v20 → v21: только структурное расширение (добавлены опциональные поля
  // source/level в insights[]).
  const isV20Insights = stored.contentVersion === 20

  const currentAspect: AspectKey = (stored.currentAspect as AspectKey | undefined) ?? 'Si'

  // Собираем aspects: если уже есть — нормализуем каждую папку; плоские
  // legacy-поля (currentLevel/messages/...) поглощаются в активный аспект.
  const incomingAspects = stored.aspects ?? {}
  const flatLegacy: Partial<AspectState> = {
    currentLevel: stored.currentLevel,
    currentScriptIndex: stored.currentScriptIndex,
    currentScriptId: stored.currentScriptId,
    awaitingInput: stored.awaitingInput,
    messages: stored.messages,
    completedScripts: stored.completedScripts,
    pendingTasks: stored.pendingTasks,
  }
  const hasFlatLegacy = Object.values(flatLegacy).some(v => v !== undefined)

  if (stored.contentVersion === CONTENT_VERSION || isV13Rename || isV20Insights) {
    const aspects: Partial<Record<AspectKey, AspectState>> = {}
    for (const [k, v] of Object.entries(incomingAspects)) {
      // NOTE(ts): stored aspect keys могут быть любым string в legacy-state;
      // мы доверяем источнику (migrateCyrAspectKeys уже отнормировал).
      aspects[k as AspectKey] = normalizeAspect(v)
    }
    if (hasFlatLegacy) {
      // Bot-sync override может прийти с плоскими полями — поглощаем их
      // в активный аспект, не затирая то, что уже есть.
      const cur = aspects[currentAspect] ?? { ...DEFAULT_ASPECT_STATE }
      const legacyOverride = Object.fromEntries(
        Object.entries(flatLegacy).filter(([, v]) => v !== undefined)
      ) as Partial<AspectState>
      aspects[currentAspect] = normalizeAspect({ ...cur, ...legacyOverride })
    }
    if (!aspects[currentAspect]) {
      aspects[currentAspect] = { ...DEFAULT_ASPECT_STATE }
    }
    // Сбрасываем legacy-плоские поля наверх, чтобы не плодить мусор в
    // сохранённом state (теперь они живут только в aspects).
    const {
      currentLevel: _l, currentScriptIndex: _i, currentScriptId: _id,
      awaitingInput: _ai, messages: _m, completedScripts: _cs, pendingTasks: _pt,
      mode: _mode,
      ...rest
    } = stored
    // Глушим неиспользованные deconstructed-поля для линтера.
    void _l; void _i; void _id; void _ai; void _m; void _cs; void _pt; void _mode
    return {
      ...DEFAULT_JOURNEY,
      ...rest,
      aspects,
      currentAspect,
      skills: migrateSkills(stored.skills),
      activeSurvey: (stored.activeSurvey as ActiveSurvey | null | undefined) ?? null,
      // Бампим версию (важно для ветки isV13Rename — иначе при следующей
      // загрузке снова попадём в эту же ветку).
      contentVersion: CONTENT_VERSION,
    }
  }

  // Контент-версия не совпала. С v26 миграция полностью data-preserving:
  // сохраняем ВСЕ поля каждого аспекта.
  const aspects: Partial<Record<AspectKey, AspectState>> = {}
  for (const [k, v] of Object.entries(incomingAspects)) {
    aspects[k as AspectKey] = normalizeAspect(v)
  }
  if (hasFlatLegacy) {
    const cur = aspects[currentAspect] ?? { ...DEFAULT_ASPECT_STATE }
    const legacyOverride = Object.fromEntries(
      Object.entries(flatLegacy).filter(([, v]) => v !== undefined)
    ) as Partial<AspectState>
    aspects[currentAspect] = normalizeAspect({ ...cur, ...legacyOverride })
  }
  if (!aspects[currentAspect]) {
    aspects[currentAspect] = { ...DEFAULT_ASPECT_STATE }
  }
  const {
    currentLevel: _l, currentScriptIndex: _i, currentScriptId: _id,
    awaitingInput: _ai, messages: _m, completedScripts: _cs, pendingTasks: _pt,
    mode: _mode,
    ...rest
  } = stored
  void _l; void _i; void _id; void _ai; void _m; void _cs; void _pt; void _mode
  return {
    ...DEFAULT_JOURNEY,
    ...rest,
    aspects,
    currentAspect,
    skills: migrateSkills(stored.skills),
    activeSurvey: (stored.activeSurvey as ActiveSurvey | null | undefined) ?? null,
    contentVersion: CONTENT_VERSION,
  }
}

const todayStr = (): string => new Date().toISOString().slice(0, 10)

function calcStreak(s: JourneyState): number {
  const t = todayStr()
  if (!s.lastActiveDate) return 1
  if (s.lastActiveDate === t) return s.streak
  const diff = Math.round((new Date(t).getTime() - new Date(s.lastActiveDate).getTime()) / 86400000)
  return diff === 1 ? s.streak + 1 : 1
}

// Diary entry shape is the canonical one from @/types/diary — see App.tsx
// for the full record produced by the API normalization pass.

// Шкала -accent через CSS custom property.
type AccentVarStyle = CSSProperties & { '--accent'?: string }

type Props = {
  journey: StoredJourneyShape | null | undefined
  onJourneyChange: (next: JourneyState) => void
  scores: Record<string, number>
  onScoresChange: (next: Record<string, number>) => void
  diary: DiaryEntry[] | null | undefined
  onDiaryChange: (next: DiaryEntry[]) => void
  // NOTE(ts): unused at runtime — JourneyView reads texts inline. The prop
  // exists for parity with the .jsx call surface (App passes `ru` locale).
  t?: unknown
  isAdmin?: boolean
  user?: unknown
  // Открыть AuthModal — нужен GuestSaveNudge'у. App.tsx прокидывает
  // callback с выбором стартовой вкладки ('login' / 'register').
  // Гость может проигнорить плашку.
  onRequestAuth?: (mode?: 'login' | 'register') => void
}

export default function JourneyView({
  journey: extJourney, onJourneyChange, scores, onScoresChange, diary, onDiaryChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  t: _t,
  isAdmin = false, user, onRequestAuth
}: Props) {
  // Локальный стейт — единственный source of truth.
  // Наружу синхронизируется через useEffect (ниже), чтобы persist-callback
  // не ломал серийные setState в одном хэндлере.
  // migrateState учитывает разные версии контента и пропавшие поля.
  const [state, setState] = useState<JourneyState>(() => migrateState(extJourney))

  // Стабильная ссылка на текущий persist-callback (он пересоздаётся
  // каждый рендер родителя — через ref эффект-зависимость остаётся чистой).
  const persistRef = useRef<Props['onJourneyChange']>(onJourneyChange)
  useEffect(() => { persistRef.current = onJourneyChange }, [onJourneyChange])

  // Сохраняем стейт наружу при каждом изменении, кроме первого рендера.
  const isFirstRender = useRef<boolean>(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    persistRef.current?.(state)
  }, [state])

  const [inputVal, setInputVal] = useState<string>('')
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [toast, setToast] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  // Guard от double-click race condition. handleScriptAction и handleSend
  // делают await addBotMessage (700ms typing анимация) — пока бот «печатает»,
  // юзер может тыкнуть «Далее» ещё раз. Без этого guard'а: +2 XP, прогресс
  // уезжает на 2 шага, инсайт записывается дважды. ref (не state) чтобы не
  // вызывать re-render, и checked synchronously в самом начале handler'а.
  const isProcessingRef = useRef<boolean>(false)

  // Активная per-aspect папка. Все per-aspect чтения идут через `a`,
  // все per-aspect записи — через updateAspect(s, ...).
  const a = aspectOf(state)

  const currentJourney = getJourney(state.currentAspect)
  // levels индексируются числовыми ключами (0..3). Сохраняем структуру
  // от registry.Journey, но допускаем lookup с произвольным числом.
  const levelsMap = currentJourney?.levels as Record<number, { core?: Script[]; scripts?: Script[]; surveys?: Script[]; title?: string; complete?: { text?: string } } | undefined> | undefined
  const currentLevel = levelsMap?.[a.currentLevel]
  // Linear core-маршрут уровня. Анкеты (currentLevel.surveys) живут
  // отдельно, доступны только через дерево навыков, не из chat-ленты.
  const scripts: Script[] = currentLevel?.core ?? currentLevel?.scripts ?? []
  const aspectIntro = currentJourney?.intro ?? []
  const accent = ASPECT_COLORS[state.currentAspect] ?? '#4cc9f0'

  // Лукап скрипта по {scriptId, level} — нужен в чате для архивных
  // сообщений: T-1 в L0 ≠ T-1 в L1, ID может повторяться между
  // уровнями. Дополнительный fallback в surveys целевого уровня —
  // на случай чтения старых state с архивными SURV-сообщениями (v5).
  const resolveScript = useCallback((scriptId: string, level?: number): Script | null => {
    const lvl = level ?? a.currentLevel
    const lvlData = levelsMap?.[lvl]
    const inCore = lvlData?.core?.find(s => s.id === scriptId)
    if (inCore) return inCore
    const inSurveys = lvlData?.surveys?.find(s => s.id === scriptId)
    if (inSurveys) return inSurveys
    return scripts.find(s => s.id === scriptId) ?? null
  }, [levelsMap, scripts, a.currentLevel])

  const nextLevel = levelsMap?.[a.currentLevel + 1] ?? null

  // Первый скрол после mount/смены экрана — мгновенный, чтобы юзер
  // сразу видел последние сообщения. Дальше — плавный.
  const isFirstScroll = useRef<boolean>(true)
  useEffect(() => {
    if (chatRef.current) {
      const el = chatRef.current
      const behavior: ScrollBehavior = isFirstScroll.current ? 'auto' : 'smooth'
      const id = setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior })
        isFirstScroll.current = false
      }, 50)
      return () => clearTimeout(id)
    }
  }, [a.messages, isTyping, state.screen, a.awaitingInput])

  // Авто-открытие ползунка для question со шкалой (1-10).
  // Покрывает все кейсы появления такого вопроса: deliverScript на следующий
  // шаг, handleSwitchAspect → инжект первого скрипта, перезагрузка state.
  // Юзер видит сразу ползунок и кнопку «Ответить · X/10», без лишнего тыка.
  useEffect(() => {
    if (state.screen !== 'chat') return
    if (a.awaitingInput) return
    const sc = scripts[a.currentScriptIndex]
    if (!sc || sc.type !== 'question') return
    const hasScale = !!sc.followUp || !!sc.scale
    if (!hasScale) return
    setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'number' })))
  }, [state.screen, a.currentScriptIndex, a.awaitingInput, scripts, setState])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const addBotMessage = useCallback((text: string, delay: number = 400): Promise<void> => new Promise<void>((resolve) => {
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

  const addUserMessage = useCallback((text: string) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      messages: [...cur.messages, { id: Date.now() + Math.random(), role: 'user', text }]
    })))
  }, [setState])

  const awardXP = useCallback((xp: number, stardust: number = 0, scriptId: string | null = null) => {
    if (xp <= 0 && stardust <= 0) return
    tmaHaptic('medium')  // вибро в TG при завершении шага (вне TMA — no-op)

    // Захватываем текущий state ДО setState — чтобы знать какой шаг
    // только что завершён (для append-only журнала событий).
    let completedSnapshot: { aspect: AspectKey; level: number; short_id: string | null } | null = null
    setState(s => {
      // Запоминаем что закрылось — отправим в журнал после setState.
      const folder = aspectOf(s)
      completedSnapshot = {
        aspect: s.currentAspect,
        level: folder.currentLevel ?? 0,
        short_id: scriptId || folder.currentScriptId,
      }

      // Глобальные счётчики (XP/streak/...).
      const globals: JourneyState = {
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

    // Append-only журнал: страховка от потери completedScripts при сбросах
    // state. Best-effort, ошибки игнорируем — идемпотентно на бэке.
    // ВНЕ setState чтобы не вызывать side-effect в React 18 strict mode.
    if (completedSnapshot && (completedSnapshot as { short_id: string | null }).short_id && (completedSnapshot as { aspect: AspectKey }).aspect) {
      const snap = completedSnapshot as { aspect: AspectKey; level: number; short_id: string }
      postStepCompleted(snap)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          console.warn('event log failed:', msg)
        })
    }

    const parts: string[] = []
    if (xp > 0) parts.push(`+${xp} XP`)
    if (stardust > 0) parts.push(`+${stardust} ✦`)
    showToast(parts.join('   '))
  }, [setState, showToast])

  const deliverScript = useCallback((index: number) => {
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
  const handleOnboardingNext = useCallback(async () => {
    const step = state.onboardingStep
    addUserMessage(ONBOARDING[Math.min(step, 3)]?.button || 'Далее')
    if (step < 3) {
      await addBotMessage(ONBOARDING[step + 1].text, 700)
      setState(s => ({ ...s, onboardingStep: step + 1 }))
    } else if (step === 3) {
      await addBotMessage(
        'Готово. Сейчас покажу Карту Планет — выбери, с какого аспекта хочешь начать.',
        900
      )
      setState(s => ({ ...s, onboardingStep: 4 }))
    } else if (step === 4) {
      setState(s => ({ ...s, screen: 'planets' }))
    }
  }, [state.onboardingStep, addBotMessage, addUserMessage, setState])

  // Помещаем задание в очередь активных (без дублей по scriptId).
  const enqueueTask = useCallback((script: Script, status: PendingTask['status']) => {
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

  const removePending = useCallback((scriptId: string) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      pendingTasks: (cur.pendingTasks ?? []).filter(t => t.scriptId !== scriptId)
    })))
  }, [])

  // ─── Действия в чате ─────────────────────────────────────────
  const handleScriptAction = useCallback(async (action: string, scriptId: string) => {
    // Race-guard: если предыдущий клик ещё обрабатывается (await
    // addBotMessage идёт, или setState только что отправлен) — игнорируем
    // повторный клик. Без этого спам по «Далее» = +2 XP, +2 шага, дубль
    // инсайта. isTyping CSS-disable'ит кнопку, но event-handler всё равно
    // срабатывает в окне между click и render.
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    try {
    // ── intro-next: специальное действие, не привязано к script ──
    // Появляется при первом заходе на планету. Раскрывает intro-сообщения
    // по одному, потом инжектит первый скрипт уровня L0.
    if (action === 'intro-next') {
      // Читаем свежий state через identity-updater (state.aspects не в
      // deps useCallback, прямое чтение из closure будет stale).
      let decision:
        | { kind: 'next-intro'; text: string; clickedLabel: string }
        | { kind: 'first-script'; scriptId: string; clickedLabel: string }
        | { kind: 'no-script'; clickedLabel: string }
        | null = null
      setState(s => {
        const aspectKey = s.currentAspect as AspectKey
        const folder = s.aspects?.[aspectKey]
        const j = getJourney(aspectKey)
        const intros = j?.intro ?? []
        const introsShown = (folder?.messages ?? []).filter(
          m => m.role === 'bot' && !m.kind
        ).length
        if (introsShown < intros.length) {
          decision = {
            kind: 'next-intro',
            text: intros[introsShown].text,
            clickedLabel: intros[introsShown - 1]?.button || 'Далее',
          }
        } else {
          const level0 = j?.levels?.[0] as { core?: Script[]; scripts?: Script[] } | undefined
          const firstScript = (level0?.core ?? level0?.scripts ?? [])[0]
          const clickedLabel = intros[intros.length - 1]?.button || 'Далее'
          decision = firstScript
            ? { kind: 'first-script', scriptId: firstScript.id, clickedLabel }
            : { kind: 'no-script', clickedLabel }
        }
        return s // identity — никаких записей в этом updater'е
      })

      const d = decision as null
        | { kind: 'next-intro'; text: string; clickedLabel: string }
        | { kind: 'first-script'; scriptId: string; clickedLabel: string }
        | { kind: 'no-script'; clickedLabel: string }
      if (!d) return

      addUserMessage(d.clickedLabel)
      if (d.kind === 'next-intro') {
        await addBotMessage(d.text, 700)
      } else if (d.kind === 'first-script') {
        const sid = d.scriptId
        setState(s => updateAspect(s, cur => ({
          ...cur,
          currentScriptId: sid,
          currentScriptIndex: 0,
          awaitingInput: null,
          messages: [...cur.messages, {
            id: Date.now() + Math.random(),
            role: 'bot',
            kind: 'script',
            scriptId: sid,
            level: 0,
          }],
        })))
      } else {
        setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      }
      return
    }

    const script = scripts.find(s => s.id === scriptId)
    if (!script) return

    // Postponable types add to pendingTasks.
    const isDeferrable = script.type === 'exercise' || script.type === 'question'

    if (action === 'next' || action === 'done' || action === 'skip') {
      if (action === 'skip') addUserMessage('Пропустить')
      else if (action === 'done') {
        // Для exercise — «взять в ежедневные практики» (привычка аспекта).
        // Для question (B) — просто «взял задание» в активные.
        if (script.type === 'exercise') {
          addUserMessage('Беру в ежедневные практики')
          await addBotMessage(
            `Упражнение «${script.title}» теперь твоя ежедневная практика для этого аспекта. Открой дашборд, чтобы ставить галочку каждый день.`,
            500
          )
          // Best-effort: пишем в user_habits, чтобы упражнение появилось
          // в блоке «Сегодня» на дашборде. Ошибки игнорируем — фронт
          // пока всё равно хранит в pendingTasks (enqueueTask ниже).
          chooseHabit({
            aspect: state.currentAspect,
            title: script.title,
            exerciseId: script.id,
          }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn('chooseHabit failed:', msg)
          })
        } else {
          addUserMessage('Взял задание')
          await addBotMessage('Задание добавлено в активные. Открой раздел «Активные задания», когда выполнишь.', 500)
        }
      } else {
        // action === 'next'
        // На exercise/question (deferrable) «Далее» = отложить → пишем «Позже».
        // На theory/word/reflection (non-deferrable) «Далее» = идём дальше → пишем «Далее».
        addUserMessage(isDeferrable ? 'Позже' : 'Далее')
      }

      if (isDeferrable && (action === 'done' || action === 'next')) {
        // Задание уехало в активные — XP даётся только при реальном выполнении
        // (через TasksScreen или через answer_number / complete_exercise).
        enqueueTask(script, action === 'done' ? 'taken' : 'deferred')
        setTimeout(() => deliverScript(a.currentScriptIndex + 1), 600)
      } else if (
        (script.type === 'theory' || script.type === 'word' || script.type === 'reflection')
        && action === 'next'
      ) {
        // Обязательный insight: открываем поле для записи в дневник.
        // XP/diary/advance произойдёт в handleSend для awaitingInput='step-insight'.
        setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'step-insight' })))
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        // Прочие случаи (например skip на reflection без insight) — без XP, advance.
        setTimeout(() => deliverScript(a.currentScriptIndex + 1), 600)
      }
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
      const skillKey = script.skill ?? ''
      const draftEntry = state.skills?.[skillKey] as (StoredSkillEntry & { draft?: Record<string, unknown> }) | undefined
      const draft = draftEntry?.draft
      setState(s => ({
        ...s,
        screen: 'survey',
        activeSurvey: draft
          ? { scriptId: script.id, skillId: skillKey, ...draft }
          : { scriptId: script.id, skillId: skillKey, blockIndex: 0, statementIndex: 0, answers: {} }
      }))
    }
    } finally {
      // Освобождаем guard. Даже если внутри был return-early (например
      // null script), мы пришли сюда и можем принять следующий клик.
      isProcessingRef.current = false
    }
  }, [scripts, a.currentScriptIndex, state.skills, state.currentAspect, addBotMessage, addUserMessage, deliverScript, enqueueTask, setState])

  // ─── Ввод текста / числа ─────────────────────────────────────
  // override — опциональный аргумент с уже известным значением (используется
  // в Chat для слайдера, чтобы обойти race condition с setInputVal).
  const handleSend = useCallback(async (override?: string) => {
    // Тот же guard что в handleScriptAction — спам по «Ответить · X/10» или
    // «Сохранить и продолжить» создавал гонку: первый клик начинал
    // await addBotMessage, второй кликал по «той же» (ещё не размонти-
    // рованной) кнопке и снова шёл по handleSend → дубль diary entry
    // + XP + advance.
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    try {
    const raw = typeof override === 'string' ? override : inputVal
    const val = raw.trim()
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

      // Если у скрипта есть skill+block — пишем ответ в state.skills как
      // statementIndex=0 (соответствует pass=1) и пересчитываем score
      // аспекта через calc*ScoreFromSkills.
      if (script?.skill && script?.block) {
        const aspect = state.currentAspect
        const prevSkills = state.skills ?? {}
        const prevEntry = (prevSkills[script.skill] as StoredSkillEntry | undefined) ?? { id: script.skill, answers: {}, blocks: {}, insights: [], passes: 0 }
        const prevAnswers = (prevEntry.answers as Record<string, number[]> | undefined) ?? {}
        const blockArr = [...(prevAnswers[script.block] ?? [])]
        blockArr[0] = num
        const newAnswers: Record<string, number[]> = { ...prevAnswers, [script.block]: blockArr }
        const result = calcSurveyResult(newAnswers)
        let passes = 0
        for (const k of SURVEY_BLOCK_KEYS) {
          const arr = newAnswers[k] ?? []
          const len = arr.filter(n => Number.isFinite(n)).length
          if (len > passes) passes = len
        }
        const newEntry: StoredSkillEntry = {
          ...prevEntry,
          answers: newAnswers,
          blocks: result.blocks as Record<string, number>,
          result: (typeof result.skill === 'number' && Number.isFinite(result.skill)) ? result.skill : prevEntry.result,
          passes: Math.min(3, passes),
          completedAt: Date.now(),
        }
        const newSkills: Record<string, SkillState> = { ...prevSkills, [script.skill]: newEntry }
        setState(s => ({ ...s, skills: newSkills }))

        const calcByAspect: Record<AspectKey, (sk: Record<string, SkillState>) => number | null> = {
          Si: calcSiScoreFromSkills, Se: calcSeScoreFromSkills,
          Ti: calcTiScoreFromSkills, Te: calcTeScoreFromSkills,
          Fi: calcFiScoreFromSkills, Fe: calcFeScoreFromSkills,
          Ne: calcNeScoreFromSkills, Ni: calcNiScoreFromSkills,
        }
        const calcFn = calcByAspect[aspect]
        const aspScore = calcFn?.(newSkills)
        if (typeof aspScore === 'number' && Number.isFinite(aspScore)) {
          onScoresChange({ ...scores, [aspect]: Math.round(aspScore) })
        }
      } else {
        // Старый путь: запись напрямую в scores[aspect]
        onScoresChange({ ...scores, [state.currentAspect]: num })
      }

      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 10, 0, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    } else if (a.awaitingInput === 'text') {
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      // Нейтральная реплика без похвалы за факт ответа (см. §3.6).
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
      const stardust = script?.type === 'word' ? (script?.stardust ?? 0) : 0
      awardXP(script?.xp ?? 10, stardust, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    } else if (a.awaitingInput === 'exercise_note') {
      // Завершение упражнения с обязательным комментарием.
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
    } else if (a.awaitingInput === 'step-insight') {
      // Обязательный инсайт после T/S/R.
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      await addBotMessage('Записано в дневник.', 400)
      onDiaryChange([
        {
          id: Date.now(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: val,
          source: 'journey-step-insight',
          scriptId: script?.id ?? null,
          promptTitle: script?.title ?? null,
          prompt: script?.text ?? null,
        },
        ...(diary ?? [])
      ])
      // XP/stardust по типу скрипта. Word даёт stardust как и раньше.
      const stardust = script?.type === 'word' ? (script?.stardust ?? 0) : (script?.stardust ?? 0)
      awardXP(script?.xp ?? 10, stardust, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 600)
    }
    } finally {
      isProcessingRef.current = false
    }
  }, [inputVal, a.awaitingInput, a.currentScriptIndex, state.currentAspect, state.skills, scripts, scores, diary, addBotMessage, addUserMessage, awardXP, deliverScript, onDiaryChange, onScoresChange, removePending])

  const handleReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [])

  // Переход на следующий уровень. Сохраняет всю историю сообщений
  // (с level=прошлый), добавляет первый скрипт нового уровня.
  const handleNextLevel = useCallback(() => {
    const next = levelsMap?.[a.currentLevel + 1]
    if (!next) return
    const firstScript = (next.core ?? next.scripts ?? [])[0]
    setState(s => updateAspect(
      { ...s, screen: 'chat' },
      cur => {
        const newLevel = (cur.currentLevel + 1) as AspectState['currentLevel']
        return {
          ...cur,
          currentLevel: newLevel,
          currentScriptIndex: 0,
          currentScriptId: firstScript?.id ?? null,
          awaitingInput: null,
          messages: firstScript
            ? [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: firstScript.id, level: newLevel }]
            : cur.messages
        }
      }
    ))
  }, [levelsMap, a.currentLevel])

  // ─── Анкета навыков (survey) ─────────────────────────────────
  const handleSurveyAnswer = useCallback((value: number, insightText: string) => {
    // Если юзер записал инсайт по конкретному утверждению — кладём в дневник
    // отдельной записью с привязкой к навыку и тексту утверждения.
    const trimmedInsight = (insightText ?? '').trim()
    if (trimmedInsight) {
      const active = state.activeSurvey
      const survey = active ? resolveSurvey(active.skillId) : null
      const stmts = survey
        ? buildSurveyStatements(survey, active?.mode ?? 'short', active?.startPass ?? 1)
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
        ...(diary ?? []),
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

      const prevAnswers = (active.answers as Record<string, number[]>)[current.blockKey] ?? []
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
  // обязательного инсайта.
  const handleSurveyComplete = useCallback(() => {
    setState(s => ({ ...s, screen: 'survey-insight' }))
  }, [setState])

  // Открыть детальный разбор навыка.
  const handleOpenSkillDetail = useCallback((skillId: string) => {
    setState(s => ({ ...s, skillDetailId: skillId, screen: 'skill-detail' }))
  }, [setState])

  // Юзер написал инсайт и нажал «Сохранить».
  const handleSurveyInsight = useCallback((insightText: string) => {
    const active = state.activeSurvey
    if (!active) return
    const survey = resolveSurvey(active.skillId)
    if (!survey) return

    const cleanedAnswers: Record<string, number[]> = {}
    for (const [k, v] of Object.entries(active.answers ?? {})) {
      cleanedAnswers[k] = (v as Array<number | null | undefined>).filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    }
    const result = calcSurveyResult(cleanedAnswers)
    const completedAt = Date.now()

    // Фактическое число проходов = max длина массивов ответов по блокам.
    let actualPasses = 0
    for (const k of SURVEY_BLOCK_KEYS) {
      const arr = (active.answers as Record<string, Array<number | null | undefined>>)[k] ?? []
      const len = arr.filter(n => typeof n === 'number' && Number.isFinite(n)).length
      if (len > actualPasses) actualPasses = len
    }
    actualPasses = Math.min(3, actualPasses)

    const prev = (state.skills?.[active.skillId] as StoredSkillEntry | undefined) ?? { id: active.skillId }
    const wasPasses = prev.passes ?? 0
    const newSkillEntry: StoredSkillEntry = {
      ...prev,
      result: result.skill ?? undefined,
      blocks: result.blocks as Record<string, number>,
      answers: active.answers as Record<string, number[]>,
      passes: actualPasses,
      completedAt,
      insights: [
        ...(((prev.insights as InsightLike[] | undefined) ?? [])),
        { text: insightText, completedAt, mode: active.mode, pass: actualPasses }
      ],
    }
    // draft удаляем — анкета закрыта.
    delete (newSkillEntry as { draft?: unknown }).draft

    const newSkills: Record<string, SkillState> = { ...state.skills, [active.skillId]: newSkillEntry }

    // Если анкета была запущена из чат-скрипта — возвращаем в чат и продвигаем.
    // Если из дерева навыков — открываем экран деталей навыка, но только
    // если для него есть развёрнутый контент И L1 уже открыт.
    const fromChatScript = scripts.some(sc => sc.id === active.scriptId)
    const cl = aspectOf(state).currentLevel ?? 0
    const skillContent = getSkillContent(active.skillId)
    const willOpenDetail = !!skillContent && getUnlockedSkillLevel(cl, actualPasses) >= 1

    setState(s => ({
      ...s,
      skills: newSkills,
      activeSurvey: null,
      skillDetailId: (fromChatScript || !willOpenDetail) ? null : active.skillId,
      screen: fromChatScript ? 'chat' : (willOpenDetail ? 'skill-detail' : 'skill-tree'),
    }))

    if (fromChatScript) {
      const nextIdx = (aspectOf(state).currentScriptIndex ?? 0) + 1
      setTimeout(() => deliverScript(nextIdx), 100)
    }

    // Пересчёт средних по всем 8 аспектам с tree.
    const siScore = calcSiScoreFromSkills(newSkills)
    const feScore = calcFeScoreFromSkills(newSkills)
    const neScore = calcNeScoreFromSkills(newSkills)
    const niScore = calcNiScoreFromSkills(newSkills)
    const teScore = calcTeScoreFromSkills(newSkills)
    const tiScore = calcTiScoreFromSkills(newSkills)
    const fiScore = calcFiScoreFromSkills(newSkills)
    const seScore = calcSeScoreFromSkills(newSkills)
    const nextScores: Record<string, number> = { ...scores }
    if (typeof siScore === 'number' && Number.isFinite(siScore))  nextScores['Si'] = Math.round(siScore)
    if (typeof feScore === 'number' && Number.isFinite(feScore))  nextScores['Fe'] = Math.round(feScore)
    if (typeof neScore === 'number' && Number.isFinite(neScore))  nextScores['Ne'] = Math.round(neScore)
    if (typeof niScore === 'number' && Number.isFinite(niScore))  nextScores['Ni'] = Math.round(niScore)
    if (typeof teScore === 'number' && Number.isFinite(teScore))  nextScores['Te'] = Math.round(teScore)
    if (typeof tiScore === 'number' && Number.isFinite(tiScore))  nextScores['Ti'] = Math.round(tiScore)
    if (typeof fiScore === 'number' && Number.isFinite(fiScore))  nextScores['Fi'] = Math.round(fiScore)
    if (typeof seScore === 'number' && Number.isFinite(seScore))  nextScores['Se'] = Math.round(seScore)
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

    // XP: 10 за каждый закрытый проход.
    const wentToFinal = wasPasses < 3 && actualPasses === 3
    const xp = (actualPasses - wasPasses) * 10
    if (script) removePending(script.id)
    awardXP(xp, wentToFinal ? (script?.stardust ?? 0) : 0, script?.id ?? null)
  }, [state, scripts, scores, diary, onDiaryChange, onScoresChange, awardXP, removePending, setState, deliverScript])

  // Сохранить inline-инсайт с карточки уровня (SkillDetail / SkillTraits).
  const handleSaveSkillInsight = useCallback((skillId: string, level: number, source: string, text: string) => {
    if (!skillId || !text) return
    const completedAt = Date.now()

    setState(s => {
      const skillEntry = (s.skills?.[skillId] as StoredSkillEntry | undefined) ?? { id: skillId }
      const insights = [
        ...(((skillEntry.insights as InsightLike[] | undefined) ?? [])),
        { text, completedAt, source, level }
      ]
      return {
        ...s,
        skills: { ...s.skills, [skillId]: { ...skillEntry, insights } }
      }
    })

    // Имя навыка для записи в дневник.
    let skillName = skillId
    const survey = resolveSurvey(skillId)
    if (survey?.name) skillName = survey.name
    else {
      const c = getSkillContent(skillId) as { name?: string } | null | undefined
      if (c?.name) skillName = c.name
    }

    const sourceLabel = source === 'detail' ? 'как развить' : source === 'traits' ? 'черты' : source
    onDiaryChange([
      {
        id: completedAt,
        date: new Date().toLocaleDateString('ru-RU'),
        ts: completedAt,
        aspect: state.currentAspect,
        text: `${skillName} · L${level} · ${sourceLabel}: ${text}`,
        source: 'journey-skill-insight',
        skillId,
        level,
        insightSource: source
      },
      ...(diary ?? [])
    ])
  }, [setState, onDiaryChange, diary, state.currentAspect])

  // Отмена анкеты или инсайта — сохраняем текущий прогресс как draft.
  const handleSurveyCancel = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return { ...s, screen: 'skill-tree' }
      const hasAnyAnswer = Object.values(active.answers ?? {}).some((arr: unknown) =>
        Array.isArray(arr) && arr.some(n => typeof n === 'number' && Number.isFinite(n))
      )
      if (!hasAnyAnswer) {
        return { ...s, activeSurvey: null, screen: 'skill-tree' }
      }
      const prevSkill = (s.skills?.[active.skillId] as StoredSkillEntry | undefined) ?? { id: active.skillId }
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

  // Открыть меню «Дерево навыков». Дерево есть у Si/Fe/Ne/Ni/Te/Ti/Fi/Se.
  const ASPECTS_WITH_SKILL_TREE: AspectKey[] = ['Si', 'Fe', 'Ne', 'Ni', 'Te', 'Ti', 'Fi', 'Se']
  const handleOpenSkillTree = useCallback(() => {
    if (!ASPECTS_WITH_SKILL_TREE.includes(state.currentAspect)) {
      showToast('У этой планеты пока нет колеса навыков')
      return
    }
    setState(s => ({ ...s, screen: 'skill-tree' }))
  }, [state.currentAspect, setState, showToast])

  // Тык на навык в дереве.
  const handleStartSkillSurvey = useCallback((skillId: string) => {
    const skillEntry = state.skills?.[skillId] as (StoredSkillEntry & { draft?: { mode?: 'short' | 'full'; startPass?: number; stepIndex?: number; answers?: Record<string, unknown> } }) | undefined
    const draft = skillEntry?.draft

    // ЧИ (Ne)
    if (isNeSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Ne',
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
        currentAspect: 'Ne',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `ne-survey-${skillId}`, skillId },
      }))
      return
    }

    // БИ (Ni)
    if (isNiSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Ni',
          screen: 'survey',
          activeSurvey: {
            scriptId: `ni-survey-${skillId}`,
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
        currentAspect: 'Ni',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `ni-survey-${skillId}`, skillId },
      }))
      return
    }

    // ЧЛ (Te)
    if (isTeSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Te',
          screen: 'survey',
          activeSurvey: {
            scriptId: `te-survey-${skillId}`,
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
        currentAspect: 'Te',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `te-survey-${skillId}`, skillId },
      }))
      return
    }

    // БЛ (Ti)
    if (isTiSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Ti',
          screen: 'survey',
          activeSurvey: {
            scriptId: `ti-survey-${skillId}`,
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
        currentAspect: 'Ti',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `ti-survey-${skillId}`, skillId },
      }))
      return
    }

    // БЭ (Fi)
    if (isFiSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Fi',
          screen: 'survey',
          activeSurvey: {
            scriptId: `fi-survey-${skillId}`,
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
        currentAspect: 'Fi',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `fi-survey-${skillId}`, skillId },
      }))
      return
    }

    // ЧС (Se)
    if (isSeSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Se',
          screen: 'survey',
          activeSurvey: {
            scriptId: `se-survey-${skillId}`,
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
        currentAspect: 'Se',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `se-survey-${skillId}`, skillId },
      }))
      return
    }

    // По умолчанию: БС или ЧЭ.
    const aspect: AspectKey = skillId.startsWith('fe-') ? 'Fe' : 'Si'
    const journeyData = getJourney(aspect) as { levels?: Record<number, { core?: Script[]; surveys?: Script[] } | undefined> } | null | undefined

    const allSteps: Script[] = [
      ...(journeyData?.levels?.[0]?.surveys ?? []),
      ...(journeyData?.levels?.[0]?.core ?? [])
    ]
    const target = allSteps.find(s => s.type === 'survey' && s.skill === skillId)
    if (!target) return

    if (draft) {
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

    if (getNextPass(skillEntry) === 0) return

    setState(s => updateAspect(
      {
        ...s,
        currentAspect: aspect,
        screen: 'survey-choice',
        activeSurvey: { scriptId: target.id, skillId },
      },
      cur => ({ ...cur, awaitingInput: null })
    ))
  }, [state.skills, setState])

  // Юзер выбрал режим в SurveyChoice. Стартуем активную анкету.
  const handleChooseSurveyMode = useCallback((mode: 'short' | 'full') => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const skillEntry = s.skills?.[active.skillId] as StoredSkillEntry | undefined
      const startPass = getNextPass(skillEntry) || 1
      return {
        ...s,
        screen: 'survey',
        activeSurvey: {
          ...active,
          mode,
          startPass,
          stepIndex: 0,
          // Накопленные ответы предыдущих проходов сохраняем.
          answers: ((skillEntry as { answers?: Record<string, Array<number | null | undefined>> } | undefined)?.answers) ?? {},
        },
      }
    })
  }, [setState])

  const goToScreen = useCallback((screen: JourneyState['screen']) => {
    setState(s => ({ ...s, screen }))
  }, [setState])

  // Вспомогательное: если открыта анкета — сохраняем её черновик в
  // state.skills[id].draft и закрываем модалку.
  const dismissActiveSurveyToDraft = useCallback((s: JourneyState): JourneyState => {
    const active = s.activeSurvey
    if (!active) return { ...s, skillDetailId: null }
    const { skillId, mode, startPass, stepIndex, answers } = active
    const skillEntry = (s.skills?.[skillId] as StoredSkillEntry | undefined) ?? { id: skillId }
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

  // Переключение на другой аспект.
  // При ПЕРВОМ заходе на планету показывается ТОЛЬКО первое intro-сообщение
  // + кнопка «Далее» (awaitingInput='intro-next'). Остальные intro и первый
  // скрипт инжектятся по клику в handleScriptAction → 'intro-next'.
  // Раньше вся пачка валилась сразу, юзер не успевал прочитать.
  const handleSwitchAspect = useCallback(async (aspectKey: AspectKey) => {
    if (!aspectKey) return

    let isFresh = false
    let firstIntroText: string | undefined

    setState(s => {
      const cleaned = dismissActiveSurveyToDraft(s)
      const existing = cleaned.aspects?.[aspectKey]
      // «Свежий» = планета ещё не начата (нет скрипта) И не идёт intro-цикл.
      // messages может содержать сообщения общего онбординга (по умолчанию
      // он пишет в aspects[Si].messages) — это НЕ настоящий прогресс,
      // нужно затереть. Но если awaitingInput='intro-next' — юзер уже
      // в середине intro, не сбрасываем.
      isFresh = !existing || (
        !existing.currentScriptId && existing.awaitingInput !== 'intro-next'
      )

      if (isFresh) {
        const j = getJourney(aspectKey)
        firstIntroText = j?.intro?.[0]?.text
      }

      const folder: AspectState = isFresh
        ? { ...DEFAULT_ASPECT_STATE, messages: [], awaitingInput: 'intro-next' }
        : (existing ?? { ...DEFAULT_ASPECT_STATE })

      return {
        ...cleaned,
        currentAspect: aspectKey,
        screen: 'chat',
        // Переключение на любую планету закрывает общий онбординг.
        onboardingStep: Math.max(cleaned.onboardingStep ?? 0, 6),
        aspects: { ...(cleaned.aspects ?? {}), [aspectKey]: folder },
      }
    })

    if (!isFresh || !firstIntroText) return

    // Дать React применить state (currentAspect=aspectKey) до addBotMessage.
    await new Promise(r => setTimeout(r, 50))
    await addBotMessage(firstIntroText, 700)
  }, [setState, dismissActiveSurveyToDraft, addBotMessage])

  // ─── Админ-действия (видимы только при isAdmin) ──────────────

  // 1. Пропустить текущий шаг в чате.
  const handleAdminSkipStep = useCallback(() => {
    setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
    setTimeout(() => deliverScript(a.currentScriptIndex + 1), 50)
  }, [deliverScript, a.currentScriptIndex])

  // 2. Заполнить активную анкету. Все утверждения текущей сессии = 7.
  const handleAdminFillSurvey = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const survey = resolveSurvey(active.skillId)
      if (!survey) return s
      const mode = active.mode ?? 'short'
      const startPass = active.startPass ?? 1
      const stmts = buildSurveyStatements(survey, mode, startPass)
      const answers: Record<string, number[]> = { ...((active.answers as Record<string, number[]>) ?? {}) }
      for (const stm of stmts) {
        const arr = answers[stm.blockKey] ? [...answers[stm.blockKey]] : []
        arr[stm.statementIndex] = 7
        answers[stm.blockKey] = arr
      }
      return {
        ...s,
        activeSurvey: {
          ...active,
          answers,
          stepIndex: stmts.length,
        },
      }
    })
  }, [setState])

  // 3. Заполнить все навыки 7/10 (полностью все 3 прохода).
  const handleAdminFillAllSkills = useCallback(() => {
    const completedAt = Date.now()
    const newSkills: Record<string, SkillState> = {}
    const fillFromIds = (skillIds: string[]) => {
      for (const skillId of skillIds) {
        const survey = resolveSurvey(skillId)
        const blocks: Record<string, number> = {}
        const answers: Record<string, number[]> = {}
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
          id: skillId,
          result: 7,
          blocks,
          completedAt,
          answers,
          passes: 3,
          insights: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as unknown as SkillState & { _admin: boolean }
        ;(newSkills[skillId] as unknown as { _admin: boolean })._admin = true
      }
    }
    fillFromIds(ALL_SKILL_IDS)     // Si
    fillFromIds(FE_SKILL_IDS)      // Fe
    fillFromIds(NE_SKILL_IDS)      // Ne
    fillFromIds(NI_SKILL_IDS)      // Ni
    fillFromIds(TE_SKILL_IDS)      // Te
    fillFromIds(TI_SKILL_IDS)      // Ti
    fillFromIds(FI_SKILL_IDS)      // Fi
    fillFromIds(SE_SKILL_IDS)      // Se

    setState(s => ({ ...s, skills: newSkills }))

    const next: Record<string, number> = { ...scores }
    const si = calcSiScoreFromSkills(newSkills)
    const fe = calcFeScoreFromSkills(newSkills)
    const ne = calcNeScoreFromSkills(newSkills)
    const ni = calcNiScoreFromSkills(newSkills)
    const te = calcTeScoreFromSkills(newSkills)
    const ti = calcTiScoreFromSkills(newSkills)
    const fi = calcFiScoreFromSkills(newSkills)
    const se = calcSeScoreFromSkills(newSkills)
    if (typeof si === 'number' && Number.isFinite(si)) next['Si'] = Math.round(si)
    if (typeof fe === 'number' && Number.isFinite(fe)) next['Fe'] = Math.round(fe)
    if (typeof ne === 'number' && Number.isFinite(ne)) next['Ne'] = Math.round(ne)
    if (typeof ni === 'number' && Number.isFinite(ni)) next['Ni'] = Math.round(ni)
    if (typeof te === 'number' && Number.isFinite(te)) next['Te'] = Math.round(te)
    if (typeof ti === 'number' && Number.isFinite(ti)) next['Ti'] = Math.round(ti)
    if (typeof fi === 'number' && Number.isFinite(fi)) next['Fi'] = Math.round(fi)
    if (typeof se === 'number' && Number.isFinite(se)) next['Se'] = Math.round(se)
    onScoresChange(next)
  }, [scores, onScoresChange, setState])

  // 4. Прыжок на конкретный уровень.
  const handleAdminJumpLevel = useCallback((targetLevel: number) => {
    const lvlData = levelsMap?.[targetLevel]
    if (!lvlData) return
    const first = (lvlData.core ?? lvlData.scripts ?? [])[0]
    setState(s => updateAspect(
      { ...s, screen: 'chat', activeSurvey: null },
      cur => ({
        ...cur,
        currentLevel: targetLevel as AspectState['currentLevel'],
        currentScriptIndex: 0,
        currentScriptId: first?.id ?? null,
        awaitingInput: null,
        messages: first
          ? [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: first.id, level: targetLevel }]
          : cur.messages
      })
    ))
  }, [levelsMap, setState])

  // 5. Полный сброс journey-state. Без подтверждения.
  const handleAdminReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [setState])

  // 6. Открыть гранулярный редактор навыков.
  const handleOpenSkillsEditor = useCallback(() => {
    setState(s => ({ ...s, screen: 'admin-skills' }))
  }, [setState])

  // 7. Применить правки из редактора.
  const handleAdminApplyEdits = useCallback((edits: SkillEdits) => {
    const completedAt = Date.now()
    const newSkills: Record<string, SkillState> = { ...(state.skills ?? {}) }
    for (const [id, e] of Object.entries(edits ?? {})) {
      if (!e?.enabled) {
        // Disabled — удаляем navыk если был.
        if (newSkills[id]) delete newSkills[id]
        continue
      }
      const survey = resolveSurvey(id)
      const blocks: Record<string, number> = {}
      const answers: Record<string, number[]> = {}
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
      const entry: SkillState & { _admin?: boolean } = {
        id,
        result: e.value,
        blocks,
        answers,
        passes: e.passes,
        insights: [],
        completedAt,
        _admin: true,
      }
      newSkills[id] = entry
    }
    setState(s => ({ ...s, skills: newSkills, screen: 'skill-tree' }))
    const bs = calcSiScoreFromSkills(newSkills)
    const che = calcFeScoreFromSkills(newSkills)
    const ne = calcNeScoreFromSkills(newSkills)
    const ni = calcNiScoreFromSkills(newSkills)
    const te = calcTeScoreFromSkills(newSkills)
    const ti = calcTiScoreFromSkills(newSkills)
    const fi = calcFiScoreFromSkills(newSkills)
    const se = calcSeScoreFromSkills(newSkills)
    const next: Record<string, number> = { ...scores }
    if (typeof bs === 'number' && Number.isFinite(bs))   next['Si'] = Math.round(bs)
    if (typeof che === 'number' && Number.isFinite(che)) next['Fe'] = Math.round(che)
    if (typeof ne === 'number' && Number.isFinite(ne))   next['Ne'] = Math.round(ne)
    if (typeof ni === 'number' && Number.isFinite(ni))   next['Ni'] = Math.round(ni)
    if (typeof te === 'number' && Number.isFinite(te))   next['Te'] = Math.round(te)
    if (typeof ti === 'number' && Number.isFinite(ti))   next['Ti'] = Math.round(ti)
    if (typeof fi === 'number' && Number.isFinite(fi))   next['Fi'] = Math.round(fi)
    if (typeof se === 'number' && Number.isFinite(se))   next['Se'] = Math.round(se)
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
  const stateForChildren = { ...state, ...a } as JourneyState & AspectState

  const shellStyle: AccentVarStyle = { '--accent': accent }

  // aspectIntro здесь не используется — но передаётся в Onboarding для
  // обратной совместимости с .jsx-сигнатурой.
  void aspectIntro

  // Soft-nudge для гостя: показываем после ≥2 пройденных шагов в любом
  // аспекте. Не блокирует — закрывается × и прячется на неделю.
  // Не показываем во время survey/level-complete (чтобы не перекрывать важный UX).
  const showGuestNudge =
    !user &&
    !isAdmin &&
    !!onRequestAuth &&
    (state.totalCompleted ?? 0) >= 2 &&
    state.screen !== 'survey' &&
    state.screen !== 'survey-choice' &&
    state.screen !== 'survey-insight' &&
    state.screen !== 'levelcomplete'

  return (
    <div className={styles.shell} style={shellStyle}>
      <div className={styles.stars} />

      {showGuestNudge && (
        <GuestSaveNudge onSignUp={() => onRequestAuth?.('register')} />
      )}

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
          onOpenTasks={() => goToScreen('tasks' as JourneyState['screen'])}
          onGoToSurveys={handleOpenSkillTree}
          onOpenPlanetMap={handleOpenPlanetMap}
          // Пилюля «Оценить навыки» появляется только после L0 (или для админа).
          // Прогресс считается по skill-tree активного аспекта.
          surveyRemaining={(() => {
            if (!isAdmin && (a.currentLevel ?? 0) < 1) return 0
            const sk = state.skills ?? {}
            switch (state.currentAspect) {
              case 'Si': return getSkillProgress(sk).remaining
              case 'Fe': return getFeSkillProgress(sk).remaining
              case 'Ne': return getNeSkillProgress(sk).remaining
              case 'Ni': return getNiSkillProgress(sk).remaining
              case 'Te': return getTeSkillProgress(sk).remaining
              case 'Ti': return getTiSkillProgress(sk).remaining
              case 'Fi': return getFiSkillProgress(sk).remaining
              case 'Se': return getSeSkillProgress(sk).remaining
              default:   return 0
            }
          })()}
          pendingCount={a.pendingTasks?.length ?? 0}
          aspectName={currentJourney
            ? `Уровень ${a.currentLevel} · ${currentLevel?.title ?? ''}`
            : 'Путешествие'}
          planet={currentJourney?.planet}
          user={user}
        />
      )}

      {state.screen === 'levelcomplete' && (() => {
        // На L0 после прохождения core — primary CTA «Открыть Колесо аспекта».
        // wheelLabel строим из ASPECT_DISPLAY_KEY[currentAspect] чтобы не плодить
        // условия per аспект — каждый получает свою корректную кириллицу
        // (Si→БС, Te→ЧЛ, Ti→БЛ, и т.д.). Раньше fallback был хардкоден «БС»
        // и Ti/Se юзеры видели «Открыть Колесо БС» на своём аспекте.
        const isNe = state.currentAspect === 'Ne'
        const isNi = state.currentAspect === 'Ni'
        const isTe = state.currentAspect === 'Te'
        const isFi = state.currentAspect === 'Fi'
        const isFe = state.currentAspect === 'Fe'
        const hasSurveys = (currentLevel?.surveys?.length ?? 0) > 0
        const showWheel = a.currentLevel === 0 && (hasSurveys || isNe || isNi || isTe || isFi || isFe)
        const displayCode = ASPECT_DISPLAY_KEY[state.currentAspect] ?? state.currentAspect
        const wheelLabel = `Открыть Колесо ${displayCode}`
        const showCoreOverview = isFe && a.currentLevel === 0
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
            onNextLevel={nextLevel ? handleNextLevel : undefined}
            onOpenWheel={showWheel ? handleOpenSkillTree : undefined}
            onOpenCoreOverview={showCoreOverview ? () => goToScreen('fe-core-overview' as JourneyState['screen']) : undefined}
            coreOverviewLabel="Изучить универсальные навыки"
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
          aspectName={ASPECT_DATA[state.currentAspect]?.name ?? 'Путешествие'}
          onContinue={() => {
            setState(s => {
              let nextSkills = s.skills
              const active = s.activeSurvey
              if (active) {
                const hasAnyAnswer = Object.values(active.answers ?? {}).some((arr: unknown) =>
                  Array.isArray(arr) && arr.some(n => typeof n === 'number' && Number.isFinite(n))
                )
                if (hasAnyAnswer) {
                  const prevSkill = (s.skills?.[active.skillId] as StoredSkillEntry | undefined) ?? { id: active.skillId }
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
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && (
        <SkillTreeIntroHint user={user} />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Ne' && (
        <NeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Ni' && (
        <NiSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Fe' && (
        <FeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Si' && (
        <SkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Te' && (
        <TeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Ti' && (
        <TiSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Fi' && (
        <FiSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Se' && (
        <SeSkillTree
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
          passes={getCompletedPasses(state.skills?.[state.skillDetailId] as StoredSkillEntry | undefined)}
          accent={accent}
          onClose={() => goToScreen('skill-tree')}
          onOpenTraits={(id: string) => setState(s => ({ ...s, skillDetailId: id, screen: 'skill-traits' }))}
          onSaveInsight={handleSaveSkillInsight}
        />
      )}

      {state.screen === 'skill-traits' && state.skillDetailId && (
        <SkillTraits
          skillId={state.skillDetailId}
          currentLevel={a.currentLevel ?? 0}
          passes={getCompletedPasses(state.skills?.[state.skillDetailId] as StoredSkillEntry | undefined)}
          accent={accent}
          onSaveInsight={handleSaveSkillInsight}
          onClose={() => goToScreen('skill-detail')}
        />
      )}

      {state.screen === ('fe-core-overview' as JourneyState['screen']) && (
        <FeCoreOverview
          accent={accent}
          onOpenSkill={(id: string) => setState(s => ({ ...s, skillDetailId: id, screen: 'skill-detail' }))}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'levelcomplete')}
        />
      )}

      {state.screen === 'survey-choice' && state.activeSurvey && (() => {
        let name: string = state.activeSurvey.skillId
        const survey = resolveSurvey(state.activeSurvey.skillId)
        if (survey?.name) {
          name = survey.name
        } else {
          for (const arche of ARCHETYPE_KEYS) {
            const found = (SKILL_TREE[arche] ?? []).find(s => s.id === state.activeSurvey?.skillId)
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
          currentLevel={a.currentLevel ?? 0}
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
          user={user}
          onSwitch={handleSwitchAspect}
          onClose={() => goToScreen('chat')}
          onLockedTap={() => showToast('Эта планета пока закрыта')}
        />
      )}

      {state.screen === ('tasks' as JourneyState['screen']) && (
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
          onDelete={(scriptId: string) => removePending(scriptId)}
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
