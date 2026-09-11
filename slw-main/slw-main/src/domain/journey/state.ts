import type { AspectKey } from '@/types/aspect'
import type {
  JourneyState, AspectState, AwaitingInput, ChatMessage, PendingTask,
  SkillState, ActiveSurvey
} from '@/types/journey'
import { SURVEY_BLOCK_KEYS } from '../../data/journey/skills/tree'

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
export type InsightLike = { source?: string; [key: string]: unknown }

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
export type StoredSkillEntry = SkillState & {
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
export type StoredJourneyShape = Partial<JourneyState> & {
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
export function migrateState(stored: StoredJourneyShape | null | undefined): JourneyState {
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
