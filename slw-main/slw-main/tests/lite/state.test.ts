import { describe, expect, it } from 'vitest'
import currentV27 from './fixtures/current-v27.json'
import legacyCyrV13 from './fixtures/legacy-cyr-v13.json'
import oldV7 from './fixtures/old-v7.json'
import {
  CONTENT_VERSION,
  DEFAULT_ASPECT_STATE,
  DEFAULT_JOURNEY,
  migrateState,
} from '../../src/domain/journey/state'

const migrateFixture = (fixture: unknown) => migrateState(fixture as never)

describe('migrateState characterisation', () => {
  it('returns defaults for an absent snapshot', () => {
    expect(migrateState(null)).toBe(DEFAULT_JOURNEY)
  })

  it('preserves current state, survey, tasks, history, skills, and metrics', () => {
    const result = migrateFixture(currentV27)
    expect(result).toMatchObject({
      currentAspect: 'Fe', screen: 'survey', xp: 540, stardust: 37, streak: 9,
      totalCompleted: 18, lastActiveDate: '2026-09-10', contentVersion: CONTENT_VERSION,
      activeSurvey: currentV27.activeSurvey, skills: currentV27.skills,
    })
    expect(result.aspects.Fe).toEqual(currentV27.aspects.Fe)
    expect((result as unknown as { history: unknown[] }).history).toEqual(currentV27.history)
  })

  it('migrates Cyrillic aspect and che/legacy skill ids while preserving payloads', () => {
    const result = migrateFixture(legacyCyrV13)
    expect(result.currentAspect).toBe('Fe')
    expect(result.aspects.Si).toEqual(legacyCyrV13.aspects['БС'])
    expect(result.aspects.Fe).toEqual({
      ...DEFAULT_ASPECT_STATE,
      currentLevel: 3, currentScriptIndex: 8, currentScriptId: 'legacy-fe', awaitingInput: 'number',
      messages: legacyCyrV13.messages, completedScripts: legacyCyrV13.completedScripts,
      pendingTasks: legacyCyrV13.pendingTasks,
    })
    expect(result.skills['fe-empathy']).toMatchObject({
      id: 'che-empathy', passes: 2, result: 3.5,
      insights: [{ text: 'Старый инсайт', source: 'survey' }],
    })
    expect(result.skills.interoception).toMatchObject({ id: 'scan', passes: 3, result: 4 })
    expect(result.activeSurvey).toEqual(legacyCyrV13.activeSurvey)
    expect(result).toMatchObject({ xp: 321, stardust: 12, streak: 6, totalCompleted: 11 })
    expect((result as unknown as { history: unknown[] }).history).toEqual(legacyCyrV13.history)
  })

  it('preserves aspect progress for an unrelated old content version', () => {
    const result = migrateFixture(oldV7)
    expect(result.contentVersion).toBe(CONTENT_VERSION)
    expect(result.aspects.Ni).toEqual(oldV7.aspects.Ni)
    expect(result.activeSurvey).toEqual(oldV7.activeSurvey)
    expect(result.skills.forecast).toMatchObject({ passes: 1, result: 2.75 })
    expect(result).toMatchObject({ xp: 99, stardust: 8, streak: 3, totalCompleted: 7 })
    expect((result as unknown as { history: unknown[] }).history).toEqual(oldV7.history)
  })

  it('keeps the first key when Cyrillic and Latin aspect keys collide', () => {
    const cyrillicFirst = migrateFixture({
      contentVersion: 13, currentAspect: 'БС',
      aspects: {
        'БС': { ...DEFAULT_ASPECT_STATE, currentScriptId: 'cyrillic-first' },
        Si: { ...DEFAULT_ASPECT_STATE, currentScriptId: 'latin-second' },
      },
    })
    const latinFirst = migrateFixture({
      contentVersion: 13, currentAspect: 'БС',
      aspects: {
        Si: { ...DEFAULT_ASPECT_STATE, currentScriptId: 'latin-first' },
        'БС': { ...DEFAULT_ASPECT_STATE, currentScriptId: 'cyrillic-second' },
      },
    })
    expect(cyrillicFirst.aspects.Si?.currentScriptId).toBe('cyrillic-first')
    expect(latinFirst.aspects.Si?.currentScriptId).toBe('latin-first')
  })
})
