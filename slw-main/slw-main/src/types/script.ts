// Script types — output of data/journey/parseScripts.js.
// `intro` entries and `complete` block also produced by the parser are not
// modelled here yet; add when Phase 2 components need them.

import type { ArchetypeId } from './skill'

// Distinct values found under `## <SHORT>-N · <type> · ...` headers across
// src/data/journey/aspects/**/*.md. See parseScripts.js for the regex.
export type ScriptType =
  | 'theory'
  | 'word'
  | 'reflection'
  | 'exercise'
  | 'question'
  | 'survey'

// Block keys used by skill surveys (knowledge/practice/...).
// They mirror SURVEY_BLOCK_KEYS in data/journey/skills/tree.js.
// Kept as `string` here to avoid coupling to one aspect — Phase 1 will
// import the exact union from the per-aspect tree if needed.
export type SurveyBlockKey = string

// `metadata` is the key:value preamble before the body of a `## ` section
// (see splitMetaAndBody). Values come as strings from the parser before
// numeric coercion.
export type ScriptMetadata = {
  xp?: string
  stardust?: string
  pool?: string
  skill?: string
  block?: SurveyBlockKey
  scale?: string
  button?: string
}

// One parsed step from a level markdown file. See parseScripts.js: every
// matched section yields this shape (with `xp` defaulting to 0).
// followUp is a function that maps a 1-10 answer to bot reaction text.
// NOTE(ts): followUp is invoked by Chat.tsx with the slider value as string;
// keeping the param as `string | number` matches the observed runtime sites.
export type Script = {
  id: string
  type: ScriptType
  order: number
  title: string
  text: string
  xp: number
  stardust?: number
  pool?: boolean
  skill?: string
  block?: SurveyBlockKey
  scale?: boolean
  followUp?: (ans: string | number) => string
}

// Output of parseSurveys.js: skill survey content keyed by skill id.
export type Survey = {
  id: string
  name: string
  archetype: ArchetypeId
  blocks: Record<SurveyBlockKey, string[]>
}
