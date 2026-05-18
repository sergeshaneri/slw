// Shared diary entry shape used by DiaryView, DailyReview, App.tsx (saveDiary
// passes these to postDiaryEntry), and JourneyView (writes entries when user
// records insights). Backend persists in `web_diary_entries` and `diary_entries`.
//
// NOTE(ts): pending backend response_model for /api/diary. The list of
// `source` strings is intentionally open via the trailing `string` — different
// chat-flow contexts mint their own source tag (e.g. 'journey-step-insight').

import type { AspectKey } from './aspect'

export type DiarySource =
  | 'manual'
  | 'web'
  | 'daily-review'
  | 'journey'
  | 'journey-question'
  | 'journey-survey'
  | 'journey-survey-statement'
  | 'journey-step-insight'
  | 'journey-skill-insight'
  | 'aspect'
  | 'aspect-item'
  | 'coach'
  | 'vault'
  | string

// Per-block survey detail captured when a skill survey lands in the diary.
// `answers`/`blockAvgs`/`skillAvg` are widened to accept nullable values —
// in-flight surveys can skip statements, so calcSurveyResult and ActiveSurvey
// both produce null/undefined in places. `name`/`archetype`/`pass`/`mode`
// capture the survey-identity snapshot at completion time.
export type SurveyDetailsData = {
  name?: string
  archetype?: string
  blocks?: Record<string, string[]>
  answers?: Record<string, Array<number | null | undefined>>
  blockAvgs?: Record<string, number | null>
  skillAvg?: number | null
  pass?: number
  mode?: 'short' | 'full'
}

// Canonical diary-entry record on the frontend. `aspect: 'general'` represents
// an entry not bound to any aspect (used in the manual-add form).
//
// Backend rows from /api/diary are mapped to this shape in App.tsx's
// loadFromApi by flattening `extra` into top-level fields. CoachView mints
// string ids like `coach-<id>-<ts>` for purely-local entries, so id is the
// union of both shapes.
export type DiaryEntry = {
  id: number | string
  date: string
  ts: number
  aspect: AspectKey | 'general'
  text: string
  source?: DiarySource
  promptTitle?: string | null
  prompt?: string | null
  survey?: SurveyDetailsData
  scriptId?: string | null
  skillId?: string | null
  level?: number
} & Record<string, unknown>
