import type { SendKeyMode } from '../hooks/useSendKeyMode'
import type { AspectScores } from './aspect'
import type { DiaryEntry } from './diary'
import type { JourneyState } from './journey'

// Known localStorage keys. The trailing `string` keeps this open for
// dynamic per-id keys like `hint_${id}` while documenting the known set.
export type LocalStorageKey =
  | 'slw_token'
  | 'slw_dev_admin'
  | 'survey_insight_hint_dismissed'
  | 'welcome_seen'
  | 'slw_intro_seen'
  | 'hint_nav-aspects-cta'
  | 'hint_journey-chat-intro'
  | string

export type LitePreferences = {
  sendKeyMode?: SendKeyMode
  hintsSeen?: Record<string, boolean>
}

export type LiteData = {
  journey: JourneyState
  scores: AspectScores
  diary: DiaryEntry[]
  history: unknown[]
  preferences: LitePreferences
}

export type LiteSnapshot = {
  format: 'slw-lite'
  schemaVersion: 1
  revision: number
  updatedAt: string
  data: LiteData
}
