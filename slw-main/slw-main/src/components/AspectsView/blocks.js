// Блоки по каждому аспекту в порядке, соответствующем файлу "Колесо БС LP":
// Уровень 0 — Первый контакт · Уровень 1 — Эпоха племён · Уровень 2 — Эпоха цивилизаций · Уровень 3 — Эпоха алхимии
//
// Каждая запись описывает один «главу» для экрана чтения. Блок показывается
// в оглавлении, только если для аспекта есть соответствующие данные.

export const LEVEL_LABELS = {
  0: { code: 'I', name: 'Первый контакт', hint: 'Знакомство с аспектом' },
  1: { code: 'II', name: 'Эпоха племён', hint: 'Навыки, цели и первые ритуалы' },
  2: { code: 'III', name: 'Эпоха цивилизаций', hint: 'Суперспособности и взаимодействие' },
  3: { code: 'IV', name: 'Эпоха алхимии', hint: 'Тени, страхи, соматика, трансформация' }
}

export const BLOCKS = [
  // ── Уровень 0 ─────────────────────────────────────────────
  {
    id: 'essence',
    level: 0,
    title: 'Суть аспекта',
    lead: 'О чём этот аспект в одном абзаце.',
    kind: 'text',
    has: d => !!d.essence
  },
  {
    id: 'archetypes',
    level: 0,
    title: 'Тени и дары',
    lead: 'Два полюса — то, во что аспект соскальзывает в тени, и то, каким становится в даре.',
    kind: 'archetypes',
    has: d => !!d.archetypes
  },

  // ── Уровень 1 ─────────────────────────────────────────────
  {
    id: 'archetypePath',
    level: 1,
    title: 'Путь становления архетипов',
    lead: 'Предпосылки, главный урок и переход от тени к дару.',
    kind: 'archetypePath',
    has: d => d.archetypePath?.length > 0
  },
  {
    id: 'skills',
    level: 1,
    title: 'Психологические навыки',
    lead: 'Конкретные способности, через которые аспект проявляется в жизни.',
    kind: 'list',
    field: 'skills',
    has: d => d.skills?.length > 0
  },
  {
    id: 'coachTips',
    level: 1,
    title: 'Советы суперкоуча',
    lead: 'Короткие ориентиры от наставника, проходившего этот путь.',
    kind: 'numberedList',
    field: 'coachTips',
    has: d => d.coachTips?.length > 0
  },
  {
    id: 'goals',
    level: 1,
    title: 'Вопросы для желаний и целей',
    lead: 'Вопросы, которые помогают сформулировать, куда расти.',
    kind: 'numberedList',
    field: 'goals',
    has: d => d.goals?.length > 0
  },
  {
    id: 'assessment',
    level: 1,
    title: 'Самооценка по микрополям',
    lead: 'Вопросы для честного взгляда на себя. Ответы — в дневник.',
    kind: 'assessment',
    has: d => d.selfAssessment?.length > 0
  },

  // ── Уровень 2 ─────────────────────────────────────────────
  {
    id: 'superpower',
    level: 2,
    title: 'Суперспособность',
    lead: 'То, что даёт этот аспект, когда он в ресурсе.',
    kind: 'textItalic',
    has: d => !!d.superpower
  },
  {
    id: 'integration',
    level: 2,
    title: 'Интеграция с противоположностью',
    lead: 'Как развивать пару-противоположность, чтобы усилить себя.',
    kind: 'integration',
    has: d => !!d.integration
  },
  {
    id: 'synergy',
    level: 2,
    title: 'Взаимодействие с другими аспектами',
    lead: 'Что получается в союзе с другими аспектами.',
    kind: 'synergy',
    has: d => d.synergy?.length > 0
  },
  {
    id: 'polysemy',
    level: 2,
    title: 'Ложные друзья аспекта',
    lead: 'Слова, которые в разных контекстах означают разные аспекты.',
    kind: 'polysemy',
    has: d => d.polysemy?.length > 0
  },
  {
    id: 'resources',
    level: 2,
    title: 'Ресурсные действия',
    lead: 'Конкретные дела, которые наполняют этот аспект.',
    kind: 'list',
    field: 'resources',
    has: d => d.resources?.length > 0
  },
  {
    id: 'practices',
    level: 2,
    title: 'Практики и упражнения',
    lead: 'Пошаговые упражнения для регулярной работы.',
    kind: 'practices',
    has: d => d.practices?.length > 0
  },

  // ── Уровень 3 ─────────────────────────────────────────────
  {
    id: 'dilemmas',
    level: 3,
    title: 'Ключевые дилеммы',
    lead: 'Внутренние развилки, с которыми живёт этот аспект.',
    kind: 'dilemmas',
    has: d => d.dilemmas?.length > 0
  },
  {
    id: 'redFlags',
    level: 3,
    title: 'Красные флаги',
    lead: 'Сигналы, что аспект уходит в тень.',
    kind: 'list',
    field: 'redFlags',
    has: d => d.redFlags?.length > 0
  },
  {
    id: 'fears',
    level: 3,
    title: 'Страхи и защиты',
    lead: 'Глубинные страхи и типичные механизмы защиты.',
    kind: 'fears',
    has: d => !!d.fears || !!d.defenses
  },
  {
    id: 'somatic',
    level: 3,
    title: 'Соматические маркеры',
    lead: 'Как аспект живёт в теле — в тени и в даре.',
    kind: 'somatic',
    has: d => !!d.somatic
  }
]
