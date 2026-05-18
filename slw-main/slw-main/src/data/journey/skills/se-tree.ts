// Дерево навыков ЧС — 4 общих базовых + 43 архетипных = 47 навыков.
//
// Архетипы соответствуют четырём «полным образам» ЧС из матрицы
// психчерт: Защитник (Хранитель Своего), Правитель (Хранитель Порядка),
// Строитель (Возводящий Долгое), Герой (Идущий На Передний Край).
//
// Общие базовые — четыре сквозных навыка (groundedness, forces-assessment,
// decision-making, willpower), которые проходят через все четыре архетипа:
// тело-восприятие-выбор-исполнение. Это квартет, без которого ни один
// архетип ЧС не работает в полную силу. В UI отображаются в каждой ветке
// с пометкой «общий», в среднем по архетипу учитываются как доп.
// слагаемые. Эти 4 анкеты — первая оценка ЧС в L0-чате (SURV-100..103).
//
// Радикальное Принятие — синергическая вершина зрелой ЧС, помещена в
// архетип Hero как 12-й навык (тематически ближе всего: герой сжигает
// сомнения, зрелый герой принимает то, что не побеждается силой).
//
// id навыка — короткий латинский ключ. Используется как имя файла md
// (или как ключ в один md-файле через парсер) и как id анкеты.

import type { SkillStateEntry } from './index'
import type { SkillTreeNode, SurveyBlock } from './tree'

export type SeArchetypeKey = 'defender' | 'ruler' | 'builder' | 'hero'

export type SeArchetypeInfo = {
  id: SeArchetypeKey
  name: string
  subtitle: string
  blurb: string
  glyph: string
}

export const ARCHETYPES: Record<SeArchetypeKey, SeArchetypeInfo> = {
  defender: {
    id: 'defender',
    name: 'Защитник',
    subtitle: 'хранитель своего',
    blurb: 'Видеть свою границу и держать её спокойно — без агрессии, без оправданий, без мольбы. Моё, не отдам.',
    glyph: '🛡'
  },
  ruler: {
    id: 'ruler',
    name: 'Правитель',
    subtitle: 'хранитель порядка',
    blurb: 'Брать ответственность за порядок на своей территории — кто за что отвечает, как разрешаются конфликты, что происходит при нарушении.',
    glyph: '👑'
  },
  builder: {
    id: 'builder',
    name: 'Строитель',
    subtitle: 'возводящий долгое',
    blurb: 'Превращать волю в материю, которая стоит. Закладывать фундамент того, что переживёт тебя и будет работать без тебя.',
    glyph: '🏗'
  },
  hero: {
    id: 'hero',
    name: 'Герой',
    subtitle: 'идущий на передний край',
    blurb: 'Брать на себя то, что другие взять не могут — потому что в данный момент ты готов. Поступок и возвращение в обычную жизнь.',
    glyph: '⚔'
  }
}

export const ARCHETYPE_KEYS: SeArchetypeKey[] = ['defender', 'ruler', 'builder', 'hero']

// Четыре общих базовых навыка ЧС — сквозной квартет тело-восприятие-выбор-
// исполнение, проходящий через все четыре архетипа. Входят в каждый
// архетип при подсчёте среднего и отображаются в каждой ветке UI с
// пометкой «общий».
//
// Логика цепочки:
//   groundedness        — тело (присутствие тела как платформы для действия)
//   forces-assessment   — восприятие (реалистичная оценка своей и чужой силы)
//   decision-making     — выбор (способность выбрать в неопределённости)
//   willpower           — исполнение (направить силу на материализацию выбора)
//
// Эти 4 анкеты включены в L0-чат ЧС как первая оценка ЧС
// (SURV-100..103 в `Se/l0.md`).
export const COMMON_BASE_SKILLS: SkillTreeNode[] = [
  { id: 'groundedness',       name: 'Физическая Заземлённость', isCommon: true },
  { id: 'forces-assessment',  name: 'Реалистичная Оценка Сил (Своих и Чужих)', isCommon: true },
  { id: 'decision-making',    name: 'Принятие Решения', isCommon: true },
  { id: 'willpower',          name: 'Сила Воли', isCommon: true }
]

export const COMMON_BASE_SKILL_IDS: Set<string> = new Set(COMMON_BASE_SKILLS.map(s => s.id))

// Раскладка 43 архетипных навыков по 4 веткам.
// Порядок внутри каждой ветки совпадает с исходником
// `Se/вопросы для оценки навыков ЧС.md`.
// В UI к каждой ветке добавляются 4 общих базовых сверху.
export const SKILL_TREE: Record<SeArchetypeKey, SkillTreeNode[]> = {
  defender: [
    { id: 'boundary-setting',         name: 'Постановка Границ' },
    { id: 'constructive-confrontation', name: 'Конструктивное Противостояние' },
    { id: 'protecting-own',           name: 'Защита «Своих»' },
    { id: 'strategic-retreat',        name: 'Стратегическое Отступление' },
    { id: 'early-threat-detection',   name: 'Раннее Распознавание Угрозы' },
    { id: 'preventive-rules',         name: 'Превентивное Установление Правил' },
    { id: 'response-calibration',     name: 'Калибровка Силы Ответа' },
    { id: 'inner-circle-filter',      name: 'Фильтрация Ближнего Круга' },
    { id: 'rear-holding',             name: 'Удержание Тыла' },
    { id: 'boundary-restoration',     name: 'Восстановление Границ После Нарушения' },
    { id: 'protective-silence',       name: 'Защитное Молчание' },
    { id: 'forgiveness-after-victory', name: 'Прощение После Победы' }
  ],
  ruler: [
    { id: 'leader-presence',          name: 'Лидерское Присутствие' },
    { id: 'status-signals',           name: 'Чтение и Использование Статусных Сигналов' },
    { id: 'cool-under-pressure',      name: 'Сохранение Хладнокровия под Давлением' },
    { id: 'delegation-without-control', name: 'Делегирование Без Контроля' },
    { id: 'regulation-setting',       name: 'Установление Регламента' },
    { id: 'unpopular-decision',       name: 'Несение Непопулярного Решения' },
    { id: 'responsibility-distribution', name: 'Распределение Ответственности' },
    { id: 'feedback-without-destruction', name: 'Обратная Связь Без Разрушения' },
    { id: 'power-transfer',           name: 'Передача Власти' }
  ],
  builder: [
    { id: 'first-step',               name: 'Первый Шаг' },
    { id: 'goal-visualization',       name: 'Визуализация Цели' },
    { id: 'load-assessment',          name: 'Оценка Нагрузки' },
    { id: 'completion',               name: 'Завершение' },
    { id: 'resource-accumulation',    name: 'Накопление Ресурса' },
    { id: 'tempo-protection',         name: 'Защита Темпа' },
    { id: 'celebrating-done',         name: 'Празднование Готового' },
    { id: 'long-commitment',          name: 'Долгосрочное Обязательство' },
    { id: 'construction-vs-execution', name: 'Различение Стройки и Реализации' },
    { id: 'experience-capitalization', name: 'Капитализация Опыта' }
  ],
  hero: [
    { id: 'failure-self-support',     name: 'Самоподдержка при Неудаче' },
    { id: 'stress-mobilization',      name: 'Мобилизация в Стрессе' },
    { id: 'obstacle-encounter',       name: 'Встреча Препятствия' },
    { id: 'grit',                     name: 'Стойкость и Упорство (Grit)' },
    { id: 'constructive-competition', name: 'Конструктивная Конкуренция' },
    { id: 'refuse-audience',          name: 'Отказ от Зрителей' },
    { id: 'accepting-help',           name: 'Принятие Помощи' },
    { id: 'exit-hero-role',           name: 'Выход из Роли Героя' },
    { id: 'action-without-guarantees', name: 'Действие Без Гарантий' },
    { id: 'unpopular-truth',          name: 'Высказывание Непопулярной Правды' },
    { id: 'protect-weaker',           name: 'Защита Слабее Себя' },
    // Синергическая вершина
    { id: 'radical-acceptance',       name: 'Радикальное Принятие' }
  ]
}

// Обратный индекс: skillId → archetypeKey. Только для архетип-специфичных
// навыков. Общие базовые в этот индекс НЕ попадают (они принадлежат
// всем 4 архетипам сразу). Использовать с проверкой на COMMON_BASE_SKILL_IDS.
export const SKILL_TO_ARCHETYPE: Record<string, SeArchetypeKey> = Object.fromEntries(
  Object.entries(SKILL_TREE).flatMap(([arche, skills]) =>
    skills.map(s => [s.id, arche as SeArchetypeKey])
  )
)

// Возвращает полный список навыков, отображаемых под архетипом в UI:
// 4 общих базовых сверху + специфичные навыки архетипа.
// Используется для отображения и для расчёта среднего.
export function getSkillsForArchetype(archetypeKey: SeArchetypeKey): SkillTreeNode[] {
  const specific = SKILL_TREE[archetypeKey] ?? []
  return [...COMMON_BASE_SKILLS, ...specific]
}

// Среднее по архетипу: общие базовые + специфичные навыки архетипа.
// skills — { [skillId]: { result: number, ... } }.
// Возвращает null, если ни одного валидного результата.
export function calcArchetypeAvg(
  skills: Record<string, SkillStateEntry> | undefined,
  archetypeKey: SeArchetypeKey
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
  'groundedness': 'common',
  'forces-assessment': 'common',
  'decision-making': 'common',
  'willpower': 'common',
}

// Все skill id одним массивом, в порядке отображения.
// 4 общих + 12 + 9 + 10 + 12 = 47.
export const ALL_SKILL_IDS: string[] = [
  ...COMMON_BASE_SKILLS.map(s => s.id),
  ...ARCHETYPE_KEYS.flatMap(k => SKILL_TREE[k].map(s => s.id))
]

// Имена 5 блоков анкеты — общие для всех навыков ЧС (та же схема, что в БС/ЧЛ).
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
// ВАЖНО: текст должен совпадать с исходником в `se-surveys.md` точно
// (включая скобки и кавычки), иначе навык не будет распознан.
export const SKILL_BY_RUS_NAME: Record<string, string> = {
  // Common base (универсальные сквозные навыки) — 4 шт.
  'Физическая Заземлённость': 'groundedness',
  'Реалистичная Оценка Сил (Своих и Чужих)': 'forces-assessment',
  'Принятие Решения': 'decision-making',
  'Сила Воли': 'willpower',

  // Defender
  'Постановка Границ': 'boundary-setting',
  'Конструктивное Противостояние': 'constructive-confrontation',
  'Защита «Своих»': 'protecting-own',
  'Стратегическое Отступление': 'strategic-retreat',
  'Раннее Распознавание Угрозы': 'early-threat-detection',
  'Превентивное Установление Правил': 'preventive-rules',
  'Калибровка Силы Ответа': 'response-calibration',
  'Фильтрация Ближнего Круга': 'inner-circle-filter',
  'Удержание Тыла': 'rear-holding',
  'Восстановление Границ После Нарушения': 'boundary-restoration',
  'Защитное Молчание': 'protective-silence',
  'Прощение После Победы': 'forgiveness-after-victory',

  // Ruler
  'Лидерское Присутствие': 'leader-presence',
  'Чтение и Использование Статусных Сигналов': 'status-signals',
  'Сохранение Хладнокровия под Давлением': 'cool-under-pressure',
  'Делегирование Без Контроля': 'delegation-without-control',
  'Установление Регламента': 'regulation-setting',
  'Несение Непопулярного Решения': 'unpopular-decision',
  'Распределение Ответственности': 'responsibility-distribution',
  'Обратная Связь Без Разрушения': 'feedback-without-destruction',
  'Передача Власти': 'power-transfer',

  // Builder
  'Первый Шаг': 'first-step',
  'Визуализация Цели': 'goal-visualization',
  'Оценка Нагрузки': 'load-assessment',
  'Завершение': 'completion',
  'Накопление Ресурса': 'resource-accumulation',
  'Защита Темпа': 'tempo-protection',
  'Празднование Готового': 'celebrating-done',
  'Долгосрочное Обязательство': 'long-commitment',
  'Различение Стройки и Реализации': 'construction-vs-execution',
  'Капитализация Опыта': 'experience-capitalization',

  // Hero
  'Самоподдержка при Неудаче': 'failure-self-support',
  'Мобилизация в Стрессе': 'stress-mobilization',
  'Встреча Препятствия': 'obstacle-encounter',
  'Стойкость и Упорство (Grit)': 'grit',
  'Конструктивная Конкуренция': 'constructive-competition',
  'Отказ от Зрителей': 'refuse-audience',
  'Принятие Помощи': 'accepting-help',
  'Выход из Роли Героя': 'exit-hero-role',
  'Действие Без Гарантий': 'action-without-guarantees',
  'Высказывание Непопулярной Правды': 'unpopular-truth',
  'Защита Слабее Себя': 'protect-weaker',
  'Радикальное Принятие': 'radical-acceptance',
}
