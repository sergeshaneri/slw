import type { AspectKey } from '@/types/aspect'
import type { Script } from '@/types/script'
import type { Skill, SkillLevel } from '@/types/skill'
import { ASPECT_DATA, ASPECT_DISPLAY_KEY, ASPECT_KEYS } from '@/data/aspects'
import { JOURNEYS } from '@/data/journey/registry'
import type { CompleteEntry, IntroEntry } from '@/data/journey/parseScripts'
import { SI_CONTENT } from '@/data/skills/Si'
import { FE_CONTENT } from '@/data/skills/Fe'
import { NE_CONTENT } from '@/data/skills/Ne'
import { NI_CONTENT } from '@/data/skills/Ni'
import { TE_CONTENT } from '@/data/skills/Te'
import { TI_CONTENT } from '@/data/skills/Ti'
import { FI_CONTENT } from '@/data/skills/Fi'
import { SE_CONTENT } from '@/data/skills/Se'
import { BLOCKS, type Block } from '@/components/AspectsView/blocks'

export type CatalogKind =
  | 'journey-intro'
  | 'journey-core'
  | 'journey-survey'
  | 'journey-complete'
  | 'skill-intro'
  | 'skill-level'
  | 'aspect-block'

type CatalogBase = {
  id: string
  aspect: AspectKey
  level: number | null
  kind: CatalogKind
  sourceId: string
  title: string
}

export type CatalogEntry =
  | (CatalogBase & { kind: 'journey-intro'; source: IntroEntry })
  | (CatalogBase & { kind: 'journey-core' | 'journey-survey'; source: Script })
  | (CatalogBase & { kind: 'journey-complete'; source: CompleteEntry })
  | (CatalogBase & { kind: 'skill-intro'; source: Skill })
  | (CatalogBase & { kind: 'skill-level'; source: SkillLevel; skill: Skill })
  | (CatalogBase & { kind: 'aspect-block'; source: Block })

export type CatalogAspect = {
  aspect: AspectKey
  label: string
  entries: CatalogEntry[]
}

export const SKILL_CONTENT_BY_ASPECT: Readonly<Record<AspectKey, Record<string, Skill>>> = Object.freeze({
  Si: SI_CONTENT,
  Fe: FE_CONTENT,
  Ne: NE_CONTENT,
  Ni: NI_CONTENT,
  Te: TE_CONTENT,
  Ti: TI_CONTENT,
  Fi: FI_CONTENT,
  Se: SE_CONTENT,
})

function catalogId(aspect: AspectKey, level: number | null, kind: CatalogKind, sourceId: string): string {
  return `${aspect}:${level ?? 'all'}:${kind}:${sourceId}`
}

function buildAspect(aspect: AspectKey): CatalogAspect {
  const entries: CatalogEntry[] = []
  const journey = JOURNEYS[aspect]

  for (const intro of journey.intro) {
    entries.push({ id: catalogId(aspect, null, 'journey-intro', intro.id), aspect, level: null, kind: 'journey-intro', sourceId: intro.id, title: `Введение ${intro.id.replace('intro-', '')}`, source: intro })
  }

  for (const level of [0, 1, 2, 3] as const) {
    const levelData = journey.levels[level]
    for (const script of levelData.core) {
      entries.push({ id: catalogId(aspect, level, 'journey-core', script.id), aspect, level, kind: 'journey-core', sourceId: script.id, title: script.title, source: script })
    }
    for (const script of levelData.surveys ?? []) {
      entries.push({ id: catalogId(aspect, level, 'journey-survey', script.id), aspect, level, kind: 'journey-survey', sourceId: script.id, title: script.title, source: script })
    }
    entries.push({ id: catalogId(aspect, level, 'journey-complete', 'complete'), aspect, level, kind: 'journey-complete', sourceId: 'complete', title: `Завершение уровня ${level}`, source: levelData.complete })
  }

  for (const [skillId, skill] of Object.entries(SKILL_CONTENT_BY_ASPECT[aspect])) {
    entries.push({ id: catalogId(aspect, null, 'skill-intro', skillId), aspect, level: null, kind: 'skill-intro', sourceId: skillId, title: skill.name, source: skill })
    for (const level of [1, 2, 3] as const) {
      entries.push({ id: catalogId(aspect, level, 'skill-level', skillId), aspect, level, kind: 'skill-level', sourceId: skillId, title: `${skill.name} · уровень ${level}`, source: skill.levels[level], skill })
    }
  }

  for (const block of BLOCKS) {
    if (block.kind === 'hallStub' || !block.has(ASPECT_DATA[aspect], aspect)) continue
    entries.push({ id: catalogId(aspect, block.level, 'aspect-block', block.id), aspect, level: block.level, kind: 'aspect-block', sourceId: block.id, title: block.title, source: block })
  }

  return { aspect, label: `${ASPECT_DISPLAY_KEY[aspect]} · ${ASPECT_DATA[aspect].name}`, entries }
}

export const CONTENT_CATALOG: readonly CatalogAspect[] = Object.freeze(ASPECT_KEYS.map(buildAspect))
export const CONTENT_CATALOG_ENTRIES: readonly CatalogEntry[] = Object.freeze(CONTENT_CATALOG.flatMap(group => group.entries))

export function getCatalogEntry(id: string): CatalogEntry | null {
  return CONTENT_CATALOG_ENTRIES.find(entry => entry.id === id) ?? null
}