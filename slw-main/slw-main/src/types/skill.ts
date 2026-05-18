// Skill content types. Source files: src/data/skills/<Aspect>/<archetype>.js
// One Skill = { id, name, archetype, role, intro, levels: { 1, 2, 3 } }.
// L1/L2 levels have actions/practices/criteria/pitfalls. L3 also has
// precaution + dilemma.
//
// Archetype IDs are global short Latin keys (one per role, not per aspect).
// `common` is reserved for cross-archetype universal skills that live in
// COMMON_BASE_SKILLS for an aspect (e.g. body-listening for Si). The
// remaining 32 names below are taken from the actual literal values found
// across src/data/skills/**/*.js.

export type SkillRole = 'core' | 'aux' | 'archetypal' | 'common' | 'synergistic'

export type ArchetypeId =
  // common cross-aspect bucket (e.g. body-listening / details for Si)
  | 'common'
  // Si — Белая Сенсорика
  | 'healer'
  | 'aesthete'
  | 'hedonist'
  | 'keeper'
  // Se — Чёрная Сенсорика
  | 'hero'
  | 'ruler'
  | 'defender'
  | 'builder'
  // Ne — Чёрная Интуиция
  | 'pioneer'
  | 'visionary'
  | 'sage'
  | 'catalyst'
  // Ni — Белая Интуиция
  | 'seer'
  | 'mythmaker'
  | 'shaman'
  | 'debunker'
  // Te — Чёрная Логика
  | 'organizer'
  | 'technologist'
  | 'engineer'
  | 'virtuoso'
  // Ti — Белая Логика
  | 'analyst'
  | 'architect'
  | 'guardian'
  | 'encyclopedist'
  // Fe — Чёрная Этика
  | 'artist'
  | 'orator'
  | 'master_atmo'
  | 'zavodila'
  // Fi — Белая Этика
  | 'confessor'
  | 'diplomat'
  | 'friend'
  | 'ancestor'

export type SkillPractice = {
  name: string
  desc: string
  xp: number
}

// Gift/shadow are the same shape; declared once for reuse.
export type SkillTrait = {
  title: string
  desc: string
}

// L3-only dilemma block.
export type SkillDilemma = {
  name: string
  desc: string
}

// One level inside Skill.levels[1|2|3].
export type SkillLevel = {
  typage: string
  essence: string
  gift: SkillTrait
  shadow: SkillTrait
  actions: string[]
  practices: SkillPractice[]
  criteria: string[]
  pitfalls: string[]
  // L3-only:
  precaution?: string
  dilemma?: SkillDilemma
}

export type Skill = {
  id: string
  name: string
  archetype: ArchetypeId
  role: SkillRole
  intro: string
  levels: {
    1: SkillLevel
    2: SkillLevel
    3: SkillLevel
  }
}
