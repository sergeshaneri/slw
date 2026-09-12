import type { LiteData, LiteSnapshot } from '@/types/storage'

const sparseAnswers = [8, , 6] as number[]

export const realLiteData = {
  journey: {
    currentAspect: 'Si',
    aspects: {
      Si: {
        currentLevel: 2,
        currentScriptIndex: 4,
        currentScriptId: 'si-T-2',
        awaitingInput: 'step-insight',
        messages: [
          { id: 1700000000000, role: 'bot', text: 'Текст шага' },
          { id: 'script-card', role: 'bot', kind: 'script', scriptId: 'si-T-2', level: 2 },
        ],
        completedScripts: ['si-T-1'],
        pendingTasks: [{ id: 'task-1', scriptId: 'si-U-1', aspect: 'Si', title: 'Практика', addedAt: 1700000000001, status: 'deferred' }],
      },
    },
    skills: {
      interoception: {
        id: 'interoception',
        answers: { knowledge: sparseAnswers, practice: [7, 9] },
        blocks: { knowledge: 7, practice: null },
        passes: 2,
        result: 7.25,
        completedAt: 1700000000100,
        lastUpdated: 1700000000200,
        draft: { mode: 'full', startPass: 2, stepIndex: 3, answers: { knowledge: sparseAnswers } },
        insights: [
          { text: 'Результат анкеты', completedAt: 1700000000300, mode: 'full', pass: 2 },
          { text: 'Наблюдение из деталей', completedAt: 1700000000400, source: 'detail', level: 1 },
          { text: 'Наблюдение о чертах', completedAt: 1700000000500, source: 'traits', level: 2 },
        ],
      },
    },
    activeSurvey: {
      scriptId: 'si-survey-interoception',
      skillId: 'interoception',
      blockIndex: 1,
      statementIndex: 2,
      answers: { knowledge: sparseAnswers },
    },
    skillDetailId: 'interoception',
    xp: 120,
    streak: 4,
    stardust: 9,
    totalCompleted: 11,
    lastActiveDate: '2026-09-11',
    screen: 'survey',
    onboardingStep: 6,
    contentVersion: 27,
    completedScripts: ['legacy-global-step'],
  },
  scores: { Si: 7, Fe: 5 },
  diary: [
    {
      id: 1700000000600,
      date: '11.09.2026',
      ts: 1700000000600,
      aspect: 'Si',
      text: 'Анкета завершена',
      source: 'journey-survey',
      promptTitle: 'Интероцепция',
      prompt: null,
      scriptId: 'si-survey-interoception',
      skillId: 'interoception',
      insight: 'Результат анкеты',
      survey: {
        name: 'Интероцепция',
        archetype: 'Наблюдатель',
        blocks: { knowledge: ['Первое', 'Второе', 'Третье'] },
        answers: { knowledge: sparseAnswers },
        blockAvgs: { knowledge: 7, practice: null },
        skillAvg: null,
        pass: 2,
        mode: 'full',
      },
    },
    {
      id: 'aspect-note-1',
      date: '11.09.2026',
      ts: 1700000000700,
      aspect: 'Si',
      text: 'Заметка к материалу',
      source: 'aspect-item',
      blockId: 'body-signals',
      blockTitle: 'Сигналы тела',
      itemId: 'signal-1',
      promptTitle: 'Первый сигнал',
      prompt: 'Описание',
    },
    {
      id: 'inline-1',
      date: '11.09.2026',
      ts: 1700000000800,
      aspect: 'Si',
      text: 'Инсайт уровня',
      source: 'journey-skill-insight',
      skillId: 'interoception',
      level: 2,
      insightSource: 'traits',
    },
  ],
  history: [],
  preferences: {
    sendKeyMode: 'ctrl+enter',
    hintsSeen: { 'journey-chat-intro': true },
  },
} as unknown as LiteData

export function makeLiteData(): LiteData {
  return JSON.parse(JSON.stringify(realLiteData)) as LiteData
}

export function makeSnapshot(revision = 1): LiteSnapshot {
  return {
    format: 'slw-lite',
    schemaVersion: 1,
    revision,
    updatedAt: '2026-09-11T12:00:00.000Z',
    data: makeLiteData(),
  }
}
