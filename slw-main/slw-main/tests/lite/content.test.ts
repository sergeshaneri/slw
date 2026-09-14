import { describe, expect, it } from 'vitest'
import { ASPECT_DATA, ASPECT_KEYS } from '@/data/aspects'
import { JOURNEYS } from '@/data/journey/registry'
import { BLOCKS } from '@/components/AspectsView/blocks'
import { getTiSurvey } from '@/data/journey/skills/ti-skills'
import { getSeSurvey } from '@/data/journey/skills/se-skills'
import { buildSurveyStatements } from '@/data/journey/skills'
import { SI_CONTENT } from '@/data/skills/Si'
import { FE_CONTENT } from '@/data/skills/Fe'
import { NE_CONTENT } from '@/data/skills/Ne'
import { NI_CONTENT } from '@/data/skills/Ni'
import { TE_CONTENT } from '@/data/skills/Te'
import { TI_CONTENT } from '@/data/skills/Ti'
import { FI_CONTENT } from '@/data/skills/Fi'
import { SE_CONTENT } from '@/data/skills/Se'
import {
  CONTENT_CATALOG_ENTRIES,
  type CatalogEntry,
  type CatalogKind,
} from '@/lite/contentCatalog'
import { ONLINE_CONTENT_ACCESS, canReadLevel, canReadSkillDetail, readableLevel } from '@/lite/contentAccess'
import { resolveSurveyForAspect } from '@/lite/contentSurvey'

type Expected = { source: unknown; kind: CatalogKind }

const EXPECTED_SKILL_CONTENT = {
  Si: SI_CONTENT,
  Fe: FE_CONTENT,
  Ne: NE_CONTENT,
  Ni: NI_CONTENT,
  Te: TE_CONTENT,
  Ti: TI_CONTENT,
  Fi: FI_CONTENT,
  Se: SE_CONTENT,
} as const

function expectedCatalog(): Map<string, Expected> {
  const expected = new Map<string, Expected>()
  const add = (aspect: string, level: number | null, kind: CatalogKind, sourceId: string, source: unknown) => {
    const id = `${aspect}:${level ?? 'all'}:${kind}:${sourceId}`
    expect(expected.has(id), `duplicate expected id ${id}`).toBe(false)
    expected.set(id, { source, kind })
  }

  for (const aspect of ASPECT_KEYS) {
    const journey = JOURNEYS[aspect]
    for (const intro of journey.intro) add(aspect, null, 'journey-intro', intro.id, intro)
    for (const level of [0, 1, 2, 3] as const) {
      const levelData = journey.levels[level]
      expect(levelData.core).toBe(levelData.scripts)
      for (const script of levelData.core) add(aspect, level, 'journey-core', script.id, script)
      for (const survey of levelData.surveys ?? []) add(aspect, level, 'journey-survey', survey.id, survey)
      add(aspect, level, 'journey-complete', 'complete', levelData.complete)
    }
    for (const [skillId, skill] of Object.entries(EXPECTED_SKILL_CONTENT[aspect])) {
      add(aspect, null, 'skill-intro', skillId, skill)
      for (const level of [1, 2, 3] as const) add(aspect, level, 'skill-level', skillId, skill.levels[level])
    }
    for (const block of BLOCKS) {
      if (block.kind !== 'hallStub' && block.has(ASPECT_DATA[aspect], aspect)) {
        add(aspect, block.level, 'aspect-block', block.id, block)
      }
    }
  }
  return expected
}

describe('P5 content catalog', () => {
  it('equals the independent registry-derived id and source set', () => {
    const expected = expectedCatalog()
    const actual = new Map(CONTENT_CATALOG_ENTRIES.map(entry => [entry.id, entry] as const))
    expect(CONTENT_CATALOG_ENTRIES).toHaveLength(2968)
    expect(actual.size).toBe(CONTENT_CATALOG_ENTRIES.length)
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort())
    for (const [id, item] of expected) expect(actual.get(id)?.source).toBe(item.source)
  })

  it('has the audited kind counts and no empty required source fields', () => {
    const counts = CONTENT_CATALOG_ENTRIES.reduce<Partial<Record<CatalogKind, number>>>((acc, entry) => {
      acc[entry.kind] = (acc[entry.kind] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({
      'journey-intro': 16,
      'journey-core': 1039,
      'journey-survey': 201,
      'journey-complete': 32,
      'skill-intro': 372,
      'skill-level': 1116,
      'aspect-block': 192,
    })
    for (const entry of CONTENT_CATALOG_ENTRIES) {
      expect(entry.title.trim(), entry.id).not.toBe('')
      if (entry.kind === 'journey-intro' || entry.kind === 'journey-core' || entry.kind === 'journey-survey' || entry.kind === 'journey-complete') {
        expect(entry.source.text.trim(), entry.id).not.toBe('')
      } else if (entry.kind === 'skill-intro') {
        expect(entry.source.intro.trim(), entry.id).not.toBe('')
      } else if (entry.kind === 'skill-level') {
        expect(entry.source.essence.trim(), entry.id).not.toBe('')
        expect(entry.source.gift.title.trim(), entry.id).not.toBe('')
        expect(entry.source.shadow.title.trim(), entry.id).not.toBe('')
      }
    }
  })

  it('keeps collision sources aspect-qualified', () => {
    const ti = CONTENT_CATALOG_ENTRIES.find(entry => entry.id === 'Ti:all:skill-intro:manipulation-detection') as CatalogEntry | undefined
    const se = CONTENT_CATALOG_ENTRIES.find(entry => entry.id === 'Se:all:skill-intro:completion') as CatalogEntry | undefined
    expect(ti?.source).toBe(TI_CONTENT['manipulation-detection'])
    expect(se?.source).toBe(SE_CONTENT.completion)
  })
})

describe('P5 aspect survey resolver', () => {
  it('selects Ti manipulation-detection and Se completion by current aspect', () => {
    const ti = resolveSurveyForAspect('Ti', 'manipulation-detection')
    const se = resolveSurveyForAspect('Se', 'completion')
    expect(ti).toBe(getTiSurvey('manipulation-detection'))
    expect(se).toBe(getSeSurvey('completion'))
    expect(buildSurveyStatements(ti!, 'short', 1)[0]?.statement).toBe(buildSurveyStatements(getTiSurvey('manipulation-detection')!, 'short', 1)[0]?.statement)
    expect(buildSurveyStatements(se!, 'short', 1)[0]?.statement).toBe(buildSurveyStatements(getSeSurvey('completion')!, 'short', 1)[0]?.statement)
  })
})

describe('P5 online defaults', () => {
  it('does not expand readable levels or detail access without explicit capability', () => {
    expect(ONLINE_CONTENT_ACCESS.fullContentAccess).toBe(false)
    expect(readableLevel(undefined, 1)).toBe(1)
    expect(canReadLevel(undefined, 2, 1)).toBe(false)
    expect(canReadSkillDetail(undefined, true, 0)).toBe(false)
    expect(canReadSkillDetail(undefined, true, 1)).toBe(true)
  })
})
