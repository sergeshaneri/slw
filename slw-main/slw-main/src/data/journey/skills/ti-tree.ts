// Дерево навыков БЛ — 3 универсальных базовых + 38 архетипных = 41 навык.
//
// Архетипы соответствуют четырём «полным образам» БЛ из матрицы
// психчерт: Аналитик (Хранитель ясности), Архитектор (Создатель
// систем), Хранитель Порядка (Опекун целостности), Энциклопедист
// (Зрелый эрудит).
//
// Универсальные базовые — три сквозных навыка (structural-thinking,
// modality-distinction, mental-discipline), которые проходят через
// все четыре архетипа. В UI отображаются в каждой ветке с пометкой
// «общий», в среднем по архетипу учитываются как доп. слагаемые.
// Эти 3 анкеты — первая оценка БЛ при достижении L1.
//
// id навыка — короткий латинский ключ. Используется как имя анкеты
// в `ti-surveys.md` (ищется по `### Навык: <русское имя>`).

import type { SkillStateEntry } from './index'
import type { SkillTreeNode } from './tree'

export type TiArchetypeKey = 'analyst' | 'architect' | 'guardian' | 'encyclopedist'

export type TiArchetypeInfo = {
  id: TiArchetypeKey
  name: string
  subtitle: string
  blurb: string
  glyph: string
}

export const ARCHETYPES: Record<TiArchetypeKey, TiArchetypeInfo> = {
  analyst: {
    id: 'analyst',
    name: 'Аналитик',
    subtitle: 'хранитель ясности',
    blurb: 'Разбирает информацию на части, ищет первопричины, отделяет истину от мнения.',
    glyph: '🔬'
  },
  architect: {
    id: 'architect',
    name: 'Архитектор',
    subtitle: 'создатель систем',
    blurb: 'Превращает хаос в порядок: создаёт системы, правила и структуры, которые служат людям.',
    glyph: '🏛'
  },
  guardian: {
    id: 'guardian',
    name: 'Хранитель Порядка',
    subtitle: 'опекун целостности',
    blurb: 'Поддерживает живое состояние уже построенных систем, различает букву и дух правила.',
    glyph: '🛡'
  },
  encyclopedist: {
    id: 'encyclopedist',
    name: 'Энциклопедист',
    subtitle: 'зрелый эрудит',
    blurb: 'Накапливает знание системно и передаёт его другим — превращает чужое в собственное мышление.',
    glyph: '📚'
  }
}

export const ARCHETYPE_KEYS: TiArchetypeKey[] = ['analyst', 'architect', 'guardian', 'encyclopedist']

// Три универсальных базовых навыка БЛ — сквозные качества мышления,
// проходящие через все четыре архетипа. Входят в каждый архетип
// при подсчёте среднего и отображаются в каждой ветке UI с пометкой
// «общий».
//
// Логика тройки:
//   structural-thinking    — двусторонняя операция «разобрать ↔ собрать»
//   modality-distinction   — различать факт / мнение / предположение / чувство
//   mental-discipline      — удерживать качество мышления под нагрузкой
//
// Эти 3 анкеты доступны после прохождения L0 — параллельно через
// дерево навыков (`screen: 'skill-tree'`).
export const COMMON_BASE_SKILLS: SkillTreeNode[] = [
  { id: 'structural-thinking',  name: 'Структурное мышление', isCommon: true },
  { id: 'modality-distinction', name: 'Различение модальностей высказывания', isCommon: true },
  { id: 'mental-discipline',    name: 'Дисциплина Ума', isCommon: true }
]

export const COMMON_BASE_SKILL_IDS: Set<string> = new Set(COMMON_BASE_SKILLS.map(s => s.id))

// Раскладка 38 архетипных навыков по 4 веткам.
// Порядок внутри каждой ветки — от ядерных навыков (★) к расширяющим.
// В UI к каждой ветке добавляются 3 общих базовых сверху.
export const SKILL_TREE: Record<TiArchetypeKey, SkillTreeNode[]> = {
  analyst: [
    // Ядерные ★
    { id: 'critical-analysis',       name: 'Критический Анализ' },
    { id: 'root-cause',              name: 'Поиск Первопричины' },
    { id: 'hidden-assumptions',      name: 'Выявление невысказанных допущений' },
    { id: 'cognitive-biases',        name: 'Распознавание когнитивных искажений' },
    { id: 'belief-revision',         name: 'Активная ревизия убеждений' },
    // Расширяющие
    { id: 'steel-manning',           name: 'Steel-manning (Стальные Аргументы Оппонента)' },
    { id: 'scaling',                 name: 'Шкалирование' },
    { id: 'manipulation-detection',  name: 'Распознавание манипулятивных приёмов' }
  ],
  architect: [
    // Ядерные ★
    { id: 'structural-planning',     name: 'Структурное Планирование («Создание Чертежа»)' },
    { id: 'rule-establishment',      name: 'Установление Правил и Принципов' },
    { id: 'argument-construction',   name: 'Построение Аргументации' },
    { id: 'consistency-check',       name: 'Проверка на внутреннюю непротиворечивость' },
    { id: 'algorithm-design',        name: 'Дизайн алгоритма и рабочего процесса (нотка ЧЛ)' },
    // Расширяющие
    { id: 'structuring-speech',      name: 'Структурирование речи / письма' },
    { id: 'good-enough',             name: 'Принцип «достаточно хорошего»' }
  ],
  guardian: [
    // Ядерные ★
    { id: 'model-calibration',       name: 'Калибровка модели по обратной связи' },
    { id: 'standard-control',        name: 'Контроль соответствия эталону' },
    { id: 'evaluation-criteria',     name: 'Конструирование критериев оценки' },
    { id: 'rule-drift',              name: 'Распознавание дрейфа правил' },
    { id: 'no-convenient-exceptions',name: 'Отказ от удобных исключений' },
    // Расширяющие
    { id: 'objective-introspection', name: 'Объективный Самоанализ' },
    { id: 'falsifiability',          name: 'Тест на фальсифицируемость' },
    { id: 'info-hygiene',            name: 'Информационная гигиена' },
    { id: 'intellectual-humility',   name: 'Практика интеллектуального смирения' },
    { id: 'critique-distinction',    name: 'Различение конструктивной и защитной критики' },
    { id: 'formalize-agreements',    name: 'Перевод устной договорённости в письменный документ' }
  ],
  encyclopedist: [
    // Ядерные ★
    { id: 'self-learning',           name: 'Самостоятельное Обучение' },
    { id: 'active-reading',          name: 'Многорежимное активное чтение' },
    { id: 'knowledge-system',        name: 'Создание и ведение системы знаний' },
    { id: 'explaining',              name: 'Объяснение сложного' },
    { id: 'linguistic-precision',    name: 'Языковая точность' },
    // Расширяющие
    { id: 'jargon-decoding',         name: 'Дешифровка профессионального жаргона' },
    { id: 'spaced-repetition',       name: 'Spaced Repetition (Интервальное повторение)' },
    { id: 'summarization',           name: 'Реферирование' },
    { id: 'source-comparison',       name: 'Сопоставление источников' },
    { id: 'audience-calibration',    name: 'Подбор уровня объяснения под аудиторию' },
    { id: 'weekly-digest',           name: 'Дайджест / Еженедельный обзор' },
    { id: 'bibliography',            name: 'Построение собственной библиографии области' }
  ]
}

// Обратный индекс: skillId → archetypeKey. Только для архетип-специфичных
// навыков. Общие базовые в этот индекс НЕ попадают (они принадлежат
// всем 4 архетипам сразу). Использовать с проверкой на COMMON_BASE_SKILL_IDS.
export const SKILL_TO_ARCHETYPE: Record<string, TiArchetypeKey> = Object.fromEntries(
  Object.entries(SKILL_TREE).flatMap(([arche, skills]) =>
    skills.map(s => [s.id, arche as TiArchetypeKey])
  )
)

// Возвращает полный список навыков, отображаемых под архетипом в UI:
// 3 общих базовых сверху + специфичные навыки архетипа.
// Используется для отображения и для расчёта среднего.
export function getSkillsForArchetype(archetypeKey: TiArchetypeKey): SkillTreeNode[] {
  const specific = SKILL_TREE[archetypeKey] ?? []
  return [...COMMON_BASE_SKILLS, ...specific]
}

// Среднее по архетипу: общие базовые + специфичные навыки архетипа.
// skills — { [skillId]: { result: number, ... } }.
// Возвращает null, если ни одного валидного результата.
export function calcArchetypeAvg(
  skills: Record<string, SkillStateEntry> | undefined,
  archetypeKey: TiArchetypeKey
): number | null {
  const ids = getSkillsForArchetype(archetypeKey).map(s => s.id)
  const values = ids
    .map(id => skills?.[id]?.result)
    .filter((v): v is number => Number.isFinite(v))
  if (values.length === 0) return null
  return values.reduce((s, n) => s + n, 0) / values.length
}

// SKILL_TO_ARCHETYPE для парсера: расширение SKILL_TO_ARCHETYPE, в котором
// общие базовые получают «virtual» архетип 'common'.
export const SKILL_TO_ARCHETYPE_FOR_PARSER: Record<string, string> = {
  ...SKILL_TO_ARCHETYPE,
  'structural-thinking': 'common',
  'modality-distinction': 'common',
  'mental-discipline': 'common',
}

// Все skill id одним массивом, в порядке отображения.
// 3 общих + 8 + 7 + 11 + 12 = 41.
export const ALL_SKILL_IDS: string[] = [
  ...COMMON_BASE_SKILLS.map(s => s.id),
  ...ARCHETYPE_KEYS.flatMap(k => SKILL_TREE[k].map(s => s.id))
]

// Маппинг полного русского названия навыка (как в `### Навык: ...`)
// → skill id. Используется парсером `parseSurveys.js`.
//
// ВАЖНО: текст должен совпадать с исходником в `ti-surveys.md` точно
// (включая скобки и кавычки), иначе навык не будет распознан.
export const SKILL_BY_RUS_NAME: Record<string, string> = {
  // Common base — 3 шт.
  'Структурное мышление': 'structural-thinking',
  'Различение модальностей высказывания': 'modality-distinction',
  'Дисциплина Ума': 'mental-discipline',

  // Analyst — 8 шт.
  'Критический Анализ': 'critical-analysis',
  'Поиск Первопричины': 'root-cause',
  'Выявление невысказанных допущений': 'hidden-assumptions',
  'Распознавание когнитивных искажений': 'cognitive-biases',
  'Активная ревизия убеждений': 'belief-revision',
  'Steel-manning (Стальные Аргументы Оппонента)': 'steel-manning',
  'Шкалирование': 'scaling',
  'Распознавание манипулятивных приёмов': 'manipulation-detection',

  // Architect — 7 шт.
  'Структурное Планирование («Создание Чертежа»)': 'structural-planning',
  'Установление Правил и Принципов': 'rule-establishment',
  'Построение Аргументации': 'argument-construction',
  'Проверка на внутреннюю непротиворечивость': 'consistency-check',
  'Дизайн алгоритма и рабочего процесса (нотка ЧЛ)': 'algorithm-design',
  'Структурирование речи / письма': 'structuring-speech',
  'Принцип «достаточно хорошего»': 'good-enough',

  // Guardian — 11 шт.
  'Калибровка модели по обратной связи': 'model-calibration',
  'Контроль соответствия эталону': 'standard-control',
  'Конструирование критериев оценки': 'evaluation-criteria',
  'Распознавание дрейфа правил': 'rule-drift',
  'Отказ от удобных исключений': 'no-convenient-exceptions',
  'Объективный Самоанализ': 'objective-introspection',
  'Тест на фальсифицируемость': 'falsifiability',
  'Информационная гигиена': 'info-hygiene',
  'Практика интеллектуального смирения': 'intellectual-humility',
  'Различение конструктивной и защитной критики': 'critique-distinction',
  'Перевод устной договорённости в письменный документ': 'formalize-agreements',

  // Encyclopedist — 12 шт.
  'Самостоятельное Обучение': 'self-learning',
  'Многорежимное активное чтение': 'active-reading',
  'Создание и ведение системы знаний': 'knowledge-system',
  'Объяснение сложного': 'explaining',
  'Языковая точность': 'linguistic-precision',
  'Дешифровка профессионального жаргона': 'jargon-decoding',
  'Spaced Repetition (Интервальное повторение)': 'spaced-repetition',
  'Реферирование': 'summarization',
  'Сопоставление источников': 'source-comparison',
  'Подбор уровня объяснения под аудиторию': 'audience-calibration',
  'Дайджест / Еженедельный обзор': 'weekly-digest',
  'Построение собственной библиографии области': 'bibliography'
}
