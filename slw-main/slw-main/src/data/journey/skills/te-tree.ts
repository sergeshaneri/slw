// Дерево навыков ЧЛ — 4 общих базовых + 58 архетипных = 62 навыка.
//
// Архетипы соответствуют четырём «полным образам» ЧЛ из матрицы
// психчерт: Виртуоз (Мастер своего ремесла), Технолог (Создатель
// повторяемых методов), Организатор (Координатор людей и ресурсов),
// Инженер (Проектировщик надёжных систем).
//
// Общие базовые — четыре сквозных навыка (work-vs-busyness,
// goal-holding, cost-benefit-vision, technological-thinking),
// которые проходят через все четыре архетипа: вход (различать
// работу от суеты) → понимание (удерживать цель в действии) →
// баланс (видеть затраты и отдачу) + базовое качество (мыслить
// процессом, а не вспышкой). В UI отображаются в каждой ветке с
// пометкой «общий», в среднем по архетипу учитываются как доп.
// слагаемые. Эти 4 анкеты — первая оценка ЧЛ в L0-чате (SURV-100..103).
//
// Три универсальных навыка из матрицы психчерт ЧЛ
// («Прагматическое мышление», «Тайм-менеджмент», «Доведение до
// конца») распределены по архетипам:
//   - pragmatic-thinking → virtuoso (центральный для ремесленного действия)
//   - completion → virtuoso (мастер закрывает то, что начал)
//   - time-management → organizer (часть управления ресурсами)
//
// id навыка — короткий латинский ключ. Используется как имя файла md
// (или как ключ в один md-файле через парсер) и как id анкеты.

import type { SkillStateEntry } from './index'
import type { SkillTreeNode, SurveyBlock } from './tree'

export type TeArchetypeKey = 'virtuoso' | 'technologist' | 'organizer' | 'engineer'

export type TeArchetypeInfo = {
  id: TeArchetypeKey
  name: string
  subtitle: string
  blurb: string
  glyph: string
}

export const ARCHETYPES: Record<TeArchetypeKey, TeArchetypeInfo> = {
  virtuoso: {
    id: 'virtuoso',
    name: 'Виртуоз',
    subtitle: 'мастер своего ремесла',
    blurb: 'Отточенность ремесла, рука срослась с инструментом, воспроизводимое качество.',
    glyph: '✦'
  },
  technologist: {
    id: 'technologist',
    name: 'Технолог',
    subtitle: 'создатель повторяемых методов',
    blurb: 'Превращать разовый успех в воспроизводимый процесс — SOP, оптимизация, узкие места.',
    glyph: '⚙'
  },
  organizer: {
    id: 'organizer',
    name: 'Организатор',
    subtitle: 'координатор людей и ресурсов',
    blurb: 'Собирать чужую работу в общий результат — делегирование, ритм, бюджет.',
    glyph: '⊞'
  },
  engineer: {
    id: 'engineer',
    name: 'Инженер',
    subtitle: 'проектировщик надёжных систем',
    blurb: 'Видеть дело как живой механизм — обратные связи, риски, отказоустойчивость.',
    glyph: '⌬'
  }
}

export const ARCHETYPE_KEYS: TeArchetypeKey[] = ['virtuoso', 'technologist', 'organizer', 'engineer']

// Четыре общих базовых навыка ЧЛ — сквозные качества деятельности и
// КПД-чутья, проходящие через все четыре архетипа. Входят в каждый
// архетип при подсчёте среднего и отображаются в каждой ветке UI с
// пометкой «общий».
//
// Логика цепочки:
//   work-vs-busyness        — вход (различать работу от суеты)
//   goal-holding            — понимание (удерживать цель посреди процесса)
//   cost-benefit-vision     — баланс (видеть затраты и отдачу)
//   technological-thinking  — базовое качество тонкости (мыслить
//                             процессом, а не вспышкой)
//
// Эти 4 анкеты включены в L0-чат ЧЛ как первая оценка ЧЛ
// (SURV-100..103 в `Te/l0.md`).
export const COMMON_BASE_SKILLS: SkillTreeNode[] = [
  { id: 'work-vs-busyness',       name: 'Различение работы и суеты', isCommon: true },
  { id: 'goal-holding',           name: 'Удержание цели в действии', isCommon: true },
  { id: 'cost-benefit-vision',    name: 'Видение затрат и отдачи', isCommon: true },
  { id: 'technological-thinking', name: 'Технологичность мышления', isCommon: true }
]

export const COMMON_BASE_SKILL_IDS: Set<string> = new Set(COMMON_BASE_SKILLS.map(s => s.id))

// Раскладка 58 архетипных навыков по 4 веткам.
// Порядок внутри каждой ветки — от ядерных навыков к расширяющим
// (см. матрицу психчерт ЧЛ для разделения на ★-ядерные).
// В UI к каждой ветке добавляются 4 общих базовых сверху.
export const SKILL_TREE: Record<TeArchetypeKey, SkillTreeNode[]> = {
  virtuoso: [
    // Универсальные из матрицы психчерт, распределённые в virtuoso
    { id: 'pragmatic-thinking',   name: 'Прагматическое мышление' },
    { id: 'completion',           name: 'Доведение до конца' },
    // Ядерные ★
    { id: 'deliberate-practice',  name: 'Намеренная практика (deliberate practice)' },
    { id: 'quality-reproducibility', name: 'Воспроизводимость качества' },
    { id: 'tools',                name: 'Обращение с инструментами' },
    { id: 'self-audit',           name: 'Самоаудит работы' },
    { id: 'specialization',       name: 'Углубление специализации' },
    // Расширяющие
    { id: 'anti-bug',             name: 'Анти-баг привычки' },
    { id: 'quality-checklists',   name: 'Чек-листы качества с измеримыми критериями' },
    { id: 'deep-focus',           name: 'Концентрация в условиях шума' },
    { id: 'refactoring',          name: 'Рефакторинг собственной работы' },
    { id: 'competency-map',       name: 'Карта собственных компетенций' },
    { id: 'sprint',               name: 'Спринт (Помодоро)' },
    { id: 'follow-instructions',  name: 'Следование инструкциям' }
  ],
  technologist: [
    // Ядерные ★
    { id: 'decomposition',        name: 'Декомпозиция до «следующего физического действия»' },
    { id: 'sop',                  name: 'Создание SOP, шаблонов и техкарт' },
    { id: 'documentation',        name: 'Документирование процессов' },
    { id: 'optimization',         name: 'Оптимизация' },
    { id: 'bottleneck',           name: 'Анализ узких мест (bottleneck analysis)' },
    // Расширяющие
    { id: 'efficiency-audit',     name: 'Аудит эффективности' },
    { id: 'automation',           name: 'Автоматизация рутины' },
    { id: 'solutions-search',     name: 'Поиск типовых решений' },
    { id: 'process-mapping',      name: 'Картирование процесса (process mapping)' },
    { id: 'reverse-engineering',  name: 'Reverse engineering' },
    { id: 'versioning',           name: 'Версионирование собственных процессов' },
    { id: 'ab-testing',           name: 'A/B сравнение методов' },
    { id: 'tacit-articulation',   name: 'Артикуляция скрытого знания' },
    { id: 'task-dependencies',    name: 'Управление зависимостями задач' }
  ],
  organizer: [
    // Универсальный из матрицы психчерт, распределённый в organizer
    { id: 'time-management',      name: 'Тайм-менеджмент' },
    // Ядерные ★
    { id: 'delegation',           name: 'Делегирование' },
    { id: 'clear-spec',           name: 'Постановка чёткого ТЗ' },
    { id: 'project-management',   name: 'Управление проектами' },
    { id: 'team-matching',        name: 'Подбор исполнителей под задачи' },
    { id: 'rhythm-of-business',   name: 'Создание ритма работы (rhythm of business)' },
    // Расширяющие
    { id: 'deadline-no-rush',     name: 'Удержание дедлайнов без авралов' },
    { id: 'result-negotiation',   name: 'Переговоры с фокусом на результат' },
    { id: 'financial-literacy',   name: 'Финансовая грамотность' },
    { id: 'budget-management',    name: 'Управление бюджетом' },
    { id: 'money-tracking',       name: 'Учёт денег' },
    { id: 'monetization',         name: 'Монетизация' },
    { id: 'load-balancing',       name: 'Распределение нагрузки в команде' },
    { id: 'stakeholder-mgmt',     name: 'Стейкхолдер-менеджмент' },
    { id: 'meeting-facilitation', name: 'Фасилитация совещаний' },
    { id: 'status-reporting',     name: 'Регулярная отчётность по статусу' },
    { id: 'critical-path',        name: 'Critical Path Planning' },
    { id: 'long-term-planning',   name: 'Долгосрочное планирование (3–5 лет, со сценарными вариантами)' },
    { id: 'handover-docs',        name: 'Передача дел через документацию' }
  ],
  engineer: [
    // Ядерные ★
    { id: 'systems-thinking',     name: 'Системное мышление в деле' },
    { id: 'risk-management',      name: 'Управление рисками проекта' },
    { id: 'prototyping',          name: 'Прототипирование / быстрое тестирование гипотез' },
    { id: 'feedback-loop',        name: 'Цикл обратной связи: сбор и внедрение улучшений' },
    { id: 'cost-benefit-eval',    name: 'Оценка «затраты-выгода»' },
    // Расширяющие
    { id: 'mvp-thinking',         name: 'MVP-мышление' },
    { id: 'roi-calc',             name: 'Расчёт ROI (Return on Investment)' },
    { id: 'data-driven',          name: 'Работа с фактами и данными' },
    { id: 'pre-mortem',           name: 'Pre-mortem' },
    { id: 'fault-tolerance',      name: 'Проектирование на отказ (fault tolerance)' },
    { id: 'workspace-ergonomics', name: 'Эргономика рабочего пространства' }
  ]
}

// Обратный индекс: skillId → archetypeKey. Только для архетип-специфичных
// навыков. Общие базовые в этот индекс НЕ попадают (они принадлежат
// всем 4 архетипам сразу). Использовать с проверкой на COMMON_BASE_SKILL_IDS.
export const SKILL_TO_ARCHETYPE: Record<string, TeArchetypeKey> = Object.fromEntries(
  Object.entries(SKILL_TREE).flatMap(([arche, skills]) =>
    skills.map(s => [s.id, arche as TeArchetypeKey])
  )
)

// Возвращает полный список навыков, отображаемых под архетипом в UI:
// 4 общих базовых сверху + специфичные навыки архетипа.
// Используется для отображения и для расчёта среднего.
export function getSkillsForArchetype(archetypeKey: TeArchetypeKey): SkillTreeNode[] {
  const specific = SKILL_TREE[archetypeKey] ?? []
  return [...COMMON_BASE_SKILLS, ...specific]
}

// Среднее по архетипу: общие базовые + специфичные навыки архетипа.
// skills — { [skillId]: { result: number, ... } }.
// Возвращает null, если ни одного валидного результата.
export function calcArchetypeAvg(
  skills: Record<string, SkillStateEntry> | undefined,
  archetypeKey: TeArchetypeKey
): number | null {
  const ids = getSkillsForArchetype(archetypeKey).map(s => s.id)
  const values = ids
    .map(id => skills?.[id]?.result)
    .filter((v): v is number => Number.isFinite(v))
  if (values.length === 0) return null
  return values.reduce((s, n) => s + n, 0) / values.length
}

// SKILL_TO_ARCHETYPE для парсера: расширение SKILL_TO_ARCHETYPE, в котором
// общие базовые получают «virtual» архетип 'common'. Парсер по этому индексу
// находит, к какому ведру отнести навык. В UI общие отображаются в каждом
// из 4 архетипов, а 'common' остаётся внутренним маркером.
export const SKILL_TO_ARCHETYPE_FOR_PARSER: Record<string, string> = {
  ...SKILL_TO_ARCHETYPE,
  'work-vs-busyness': 'common',
  'goal-holding': 'common',
  'cost-benefit-vision': 'common',
  'technological-thinking': 'common',
}

// Все skill id одним массивом, в порядке отображения.
// 4 общих + 14 + 14 + 19 + 11 = 62.
export const ALL_SKILL_IDS: string[] = [
  ...COMMON_BASE_SKILLS.map(s => s.id),
  ...ARCHETYPE_KEYS.flatMap(k => SKILL_TREE[k].map(s => s.id))
]

// Имена 5 блоков анкеты — общие для всех навыков ЧЛ (та же схема, что в БС).
export const SURVEY_BLOCKS: SurveyBlock[] = [
  { id: 'knowledge',   name: 'Теоретическое знание' },
  { id: 'practice',    name: 'Практическое умение' },
  { id: 'awareness',   name: 'Осознанность выполнения' },
  { id: 'priority',    name: 'Ценность и приоритет' },
  { id: 'confidence',  name: 'Уверенность и помощь другим' }
]

export const SURVEY_BLOCK_KEYS: string[] = SURVEY_BLOCKS.map(b => b.id)

// Маппинг русского заголовка блока (как в исходном md) → ключ блока.
export const BLOCK_RUS_TO_KEY: Record<string, string> = Object.fromEntries(
  SURVEY_BLOCKS.map(b => [b.name, b.id])
)

// Маппинг полного русского названия навыка (как в `### Навык: ...`)
// → skill id. Используется парсером `parseSurveys.js`.
//
// ВАЖНО: текст должен совпадать с исходником в `surveys.md` точно
// (включая скобки и кавычки), иначе навык не будет распознан.
export const SKILL_BY_RUS_NAME: Record<string, string> = {
  // Common base (универсальные сквозные навыки) — 4 шт.
  'Различение работы и суеты': 'work-vs-busyness',
  'Удержание цели в действии': 'goal-holding',
  'Видение затрат и отдачи': 'cost-benefit-vision',
  'Технологичность мышления': 'technological-thinking',

  // Virtuoso
  'Прагматическое мышление': 'pragmatic-thinking',
  'Доведение до конца': 'completion',
  'Намеренная практика (deliberate practice)': 'deliberate-practice',
  'Воспроизводимость качества': 'quality-reproducibility',
  'Обращение с инструментами': 'tools',
  'Самоаудит работы': 'self-audit',
  'Углубление специализации': 'specialization',
  'Анти-баг привычки': 'anti-bug',
  'Чек-листы качества с измеримыми критериями': 'quality-checklists',
  'Концентрация в условиях шума': 'deep-focus',
  'Рефакторинг собственной работы': 'refactoring',
  'Карта собственных компетенций': 'competency-map',
  'Спринт (Помодоро)': 'sprint',
  'Следование инструкциям': 'follow-instructions',

  // Technologist
  'Декомпозиция до «следующего физического действия»': 'decomposition',
  'Создание SOP, шаблонов и техкарт': 'sop',
  'Документирование процессов': 'documentation',
  'Оптимизация': 'optimization',
  'Анализ узких мест (bottleneck analysis)': 'bottleneck',
  'Аудит эффективности': 'efficiency-audit',
  'Автоматизация рутины': 'automation',
  'Поиск типовых решений': 'solutions-search',
  'Картирование процесса (process mapping)': 'process-mapping',
  'Reverse engineering': 'reverse-engineering',
  'Версионирование собственных процессов': 'versioning',
  'A/B сравнение методов': 'ab-testing',
  'Артикуляция скрытого знания': 'tacit-articulation',
  'Управление зависимостями задач': 'task-dependencies',

  // Organizer
  'Тайм-менеджмент': 'time-management',
  'Делегирование': 'delegation',
  'Постановка чёткого ТЗ': 'clear-spec',
  'Управление проектами': 'project-management',
  'Подбор исполнителей под задачи': 'team-matching',
  'Создание ритма работы (rhythm of business)': 'rhythm-of-business',
  'Удержание дедлайнов без авралов': 'deadline-no-rush',
  'Переговоры с фокусом на результат': 'result-negotiation',
  'Финансовая грамотность': 'financial-literacy',
  'Управление бюджетом': 'budget-management',
  'Учёт денег': 'money-tracking',
  'Монетизация': 'monetization',
  'Распределение нагрузки в команде': 'load-balancing',
  'Стейкхолдер-менеджмент': 'stakeholder-mgmt',
  'Фасилитация совещаний': 'meeting-facilitation',
  'Регулярная отчётность по статусу': 'status-reporting',
  'Critical Path Planning': 'critical-path',
  'Долгосрочное планирование (3–5 лет, со сценарными вариантами)': 'long-term-planning',
  'Передача дел через документацию': 'handover-docs',

  // Engineer
  'Системное мышление в деле': 'systems-thinking',
  'Управление рисками проекта': 'risk-management',
  'Прототипирование / быстрое тестирование гипотез': 'prototyping',
  'Цикл обратной связи: сбор и внедрение улучшений': 'feedback-loop',
  'Оценка «затраты-выгода»': 'cost-benefit-eval',
  'MVP-мышление': 'mvp-thinking',
  'Расчёт ROI (Return on Investment)': 'roi-calc',
  'Работа с фактами и данными': 'data-driven',
  'Pre-mortem': 'pre-mortem',
  'Проектирование на отказ (fault tolerance)': 'fault-tolerance',
  'Эргономика рабочего пространства': 'workspace-ergonomics'
}
