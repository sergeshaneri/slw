import type { AspectKey } from './aspect'

// Journey view screens. Reflects actual literals used in
// components/JourneyView/* (chat, planets, survey-*, skill-*, levelcomplete,
// onboarding, admin-skills).
export type ScreenName =
  | 'chat'
  | 'planets'
  | 'survey'
  | 'survey-choice'
  | 'survey-insight'
  | 'skill-tree'
  | 'skill-detail'
  | 'skill-traits'
  | 'profile'
  | 'onboarding'
  | 'levelcomplete'
  | 'admin-skills'
  | 'tasks'
  | 'fe-core-overview'

// Awaiting-input values produced by JourneyView/Chat handlers.
export type AwaitingInput = null | 'number' | 'text' | 'choice' | 'step-insight' | 'exercise_note'

// Single chat bubble. `kind: 'script'` is used for bot messages that render
// a script card (theory/word/exercise/etc.) by scriptId reference; plain
// text bubbles do not set `kind`.
export type ChatMessage = {
  id: number | string
  role: 'bot' | 'user'
  text?: string
  kind?: 'script'
  scriptId?: string
  level?: number
  timestamp?: number
}

// Postponed exercise (U-script) added to a per-aspect queue.
export type PendingTask = {
  id: number | string
  scriptId: string
  aspect?: AspectKey
  title?: string
  addedAt?: number
  createdAt?: number
  status: 'taken' | 'deferred'
}

// Per-aspect "folder" inside state.aspects[<AspectKey>].
// Mirrors DEFAULT_ASPECT_STATE in JourneyView.jsx.
export type AspectState = {
  currentLevel: 0 | 1 | 2 | 3
  currentScriptIndex: number
  currentScriptId: string | null
  awaitingInput: AwaitingInput
  messages: ChatMessage[]
  completedScripts: string[]
  pendingTasks: PendingTask[]
}

// Survey draft saved when user interrupts an in-flight survey. Mirrors the
// `active` snapshot trimmed down — JourneyView's dismissActiveSurveyToDraft
// writes exactly this shape into SkillState.draft, and SkillTree status code
// reads `mode`/`startPass`/`stepIndex` back off it.
export type SurveyDraft = {
  mode?: 'short' | 'full'
  startPass?: number
  stepIndex?: number
  // legacy field name from pre-refactor draft shape (read-only, kept for
  // backward compat with persisted states).
  pass?: number
  blockIndex?: number
  answers?: Record<string, Array<number | null | undefined>>
}

// Per-skill state inside state.skills[<skillId>]. The actual stored object
// in JourneyView.jsx is broader (passes, insights, blocks averages, etc.);
// we model the load-bearing fields here and allow extras via index signature
// in callers as needed.
export type SkillState = {
  id: string
  // Survey answers are stored as plain number arrays keyed by block name.
  answers?: Record<string, number[]>
  blocks?: Record<string, number>
  passes?: number
  result?: number
  draft?: SurveyDraft | null
  insights?: unknown[]
  completedAt?: number
  lastUpdated?: number
}

// Active survey progress (transient, lives only while screen='survey').
// Runtime shape — see JourneyView.handleStartSkillSurvey /
// handleChooseSurveyMode / handleSurveyAnswer. The pre-refactor
// `blockIndex`+`statementIndex` fields were replaced by `mode` +
// `startPass` + `stepIndex` (see SurveyScreen which is the single
// consumer); both legacy fields are kept optional for backward compat
// during the refactor window.
export type ActiveSurvey = {
  scriptId?: string
  skillId: string
  mode?: 'short' | 'full'
  startPass?: number
  stepIndex?: number
  answers?: Record<string, Array<number | null | undefined>>
  // Legacy fields from pre-refactor shape; not used by the current
  // SurveyScreen but harmless to retain in serialized state.
  blockIndex?: number
  statementIndex?: number
}

// Root journey state. Mirrors DEFAULT_JOURNEY in JourneyView.jsx.
export type JourneyState = {
  currentAspect: AspectKey
  aspects: Partial<Record<AspectKey, AspectState>>
  skills: Record<string, SkillState>
  activeSurvey: ActiveSurvey | null
  skillDetailId: string | null
  xp: number
  streak: number
  stardust: number
  totalCompleted: number
  lastActiveDate: string | null
  screen: ScreenName
  onboardingStep: number
  contentVersion: number
  // Legacy global completedScripts kept for migration. Per-aspect data lives
  // inside aspects[<key>].completedScripts.
  completedScripts?: string[]
}
