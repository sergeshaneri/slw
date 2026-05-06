// Дерево навыков БИ — 40 архетипных навыков по 4 архетипам
// + 3 общих базовых навыка, которые входят в средний подсчёт
// каждого архетипа (не отдельной веткой).
//
// Архетипы соответствуют четырём «полным образам» БИ из соционики:
// Мифотворец, Провидец, Разоблачитель, Шаман.
//
// Общие базовые (Сонастройка, Слушание Подсознания, Внутренняя Тишина) —
// фундамент, единый для всех архетипов. Они отображаются в каждой
// ветке UI, помеченные как «общий» (и считаются в среднем по
// каждому архетипу).
//
// Источник истины — `Ni/список навыков БИ.md` и подробные файлы по
// каждому архетипу в той же папке.
//
// id навыка — короткий латинский ключ. Используется как ключ в state и
// как имя секции в ni-surveys.md.

export const ARCHETYPES = {
  mythmaker: {
    id: 'mythmaker',
    name: 'Мифотворец',
    subtitle: 'хранитель сюжета',
    blurb: 'Видеть нить, которая держит твою жизнь, и сюжет, в котором ты находишься. Память БИ.',
    glyph: '📖'
  },
  seer: {
    id: 'seer',
    name: 'Провидец',
    subtitle: 'чующий тенденции',
    blurb: 'Чувствовать, в какую сторону разворачивается процесс. Окно БИ в будущее.',
    glyph: '🔮'
  },
  debunker: {
    id: 'debunker',
    name: 'Разоблачитель',
    subtitle: 'различающий реальное',
    blurb: 'Отделять чутьё от тревоги, видеть сквозь иллюзии и фасады. Чистота БИ.',
    glyph: '🪞'
  },
  shaman: {
    id: 'shaman',
    name: 'Шаман',
    subtitle: 'настраивающий состояния',
    blurb: 'Считывать тонкие состояния, входить в глубинный канал, удерживать резонанс. Глубина БИ.',
    glyph: '🌀'
  }
}

export const ARCHETYPE_KEYS = ['mythmaker', 'seer', 'debunker', 'shaman']

// Три общих базовых навыка БИ. Входят в каждый архетип при подсчёте
// среднего и отображаются в каждой ветке UI с пометкой «общий».
//
// Эти же 3 анкеты включены в L0-чат БИ как первая оценка БИ, до того,
// как открывается полное дерево навыков.
export const COMMON_BASE_SKILLS = [
  { id: 'attunement',             name: 'Сонастройка',          isCommon: true },
  { id: 'subconscious-listening', name: 'Слушание Подсознания', isCommon: true },
  { id: 'inner-silence',          name: 'Внутренняя Тишина',    isCommon: true }
]

// Раскладка 40 архетипных навыков по 4 веткам (по 10 в каждом).
// Внутри каждой ветки: 5 ядерных + 5 расширяющих.
// В UI к каждой ветке добавляются 3 общих базовых сверху.
export const SKILL_TREE = {
  mythmaker: [
    // Ядерные
    { id: 'meaning-making',       name: 'Смыслообразование' },
    { id: 'plot-assembly',        name: 'Сюжетная Сборка' },
    { id: 'own-plot-reading',     name: 'Чтение Своего Сюжета' },
    { id: 'ancestral-flow',       name: 'Связь с Родовым Потоком' },
    { id: 'destiny-acceptance',   name: 'Принятие Своей Судьбы' },
    // Расширяющие
    { id: 'historical-perspective', name: 'Историческая Перспектива' },
    { id: 'life-seasons',           name: 'Понимание Сезонов Жизни' },
    { id: 'zeitgeist',              name: 'Чувство Атмосферы Времени (Zeitgeist)' },
    { id: 'retro-assembly',         name: 'Ретроспективная Сборка' },
    { id: 'cycle-closing',          name: 'Завершение Циклов' }
  ],
  seer: [
    // Ядерные
    { id: 'trend-foresight',     name: 'Предвидение Тенденций' },
    { id: 'time-sense',          name: 'Чувство Времени' },
    { id: 'sign-trust',          name: 'Доверие Знакам и Синхронизмам' },
    { id: 'long-perspective',    name: 'Долгосрочная Перспектива' },
    { id: 'pivot-recognition',   name: 'Распознавание Поворотных Моментов' },
    // Расширяющие
    { id: 'subtle-listening',    name: 'Тонкое Слушание Сигналов' },
    { id: 'nonverbal-reception', name: 'Приём Не-Словесного Ответа' },
    { id: 'inner-radar',         name: 'Внутренний Радар' },
    { id: 'biorhythm',           name: 'Биоритмическая Чувствительность' },
    { id: 'spontaneous-decision', name: 'Спонтанное Решение' }
  ],
  debunker: [
    // Ядерные
    { id: 'intuition-vs-anxiety',   name: 'Различение Интуиции и Тревоги' },
    { id: 'intuition-calibration',  name: 'Калибровка Интуиции' },
    { id: 'illusion-recognition',   name: 'Распознавание Иллюзий и Самообмана' },
    { id: 'decatastrophizing',      name: 'Декатастрофизация' },
    { id: 'uncertainty-acceptance', name: 'Принятие Неопределённости' },
    // Расширяющие
    { id: 'self-deception',         name: 'Развенчание Самообмана' },
    { id: 'inner-skeptic',          name: 'Внутренний Скептик' },
    { id: 'hope-vs-illusion',       name: 'Различение Подлинной Надежды и Розовой Иллюзии' },
    { id: 'manipulation-detection', name: 'Распознавание Внешних Манипуляций' },
    { id: 'threat-vs-projection',   name: 'Различение Реальной Угрозы и Параноидальной Проекции' }
  ],
  shaman: [
    // Ядерные
    { id: 'resonance-reading',    name: 'Резонансное Считывание' },
    { id: 'soul-strings',         name: 'Игра на Струнах Души' },
    { id: 'atmosphere-creation',  name: 'Создание Атмосферы' },
    { id: 'subconscious-question', name: 'Постановка Вопроса Подсознанию' },
    { id: 'soul-connection',      name: 'Связь с Душой и Высшими Планами' },
    // Расширяющие
    { id: 'deep-states',          name: 'Погружение в Глубинные Состояния' },
    { id: 'supernatural-tools',   name: 'Работа со Сверхъестественными Инструментами' },
    { id: 'subtext-reading',      name: 'Чтение Подтекста' },
    { id: 'ritualization',        name: 'Ритуализация' },
    { id: 'art-perception',       name: 'Глубокое Восприятие Искусства' }
  ]
}

// Возвращает полный список навыков, отображаемых под архетипом
// в UI: 3 общих базовых сверху + специфичные навыки архетипа.
export function getSkillsForArchetype(archetypeKey) {
  const specific = SKILL_TREE[archetypeKey] ?? []
  return [...COMMON_BASE_SKILLS, ...specific]
}

// Обратный индекс по специфичным навыкам: skillId → archetypeKey.
// Общие базовые в этот индекс НЕ попадают (они принадлежат всем
// четырём архетипам сразу). Использовать с проверкой на isCommon.
export const SKILL_TO_ARCHETYPE = Object.fromEntries(
  Object.entries(SKILL_TREE).flatMap(([arche, skills]) =>
    skills.map(s => [s.id, arche])
  )
)

// Множество id общих базовых — для быстрой проверки.
export const COMMON_BASE_SKILL_IDS = new Set(COMMON_BASE_SKILLS.map(s => s.id))

// Все уникальные skill id одним массивом (3 общих + 40 архетипных = 43).
// 3 общих + 10 + 10 + 10 + 10 = 43.
export const ALL_SKILL_IDS = [
  ...COMMON_BASE_SKILLS.map(s => s.id),
  ...ARCHETYPE_KEYS.flatMap(k => SKILL_TREE[k].map(s => s.id))
]

// Среднее по архетипу: общие базовые + специфичные навыки архетипа.
// skills — { [skillId]: { result: number, ... } }.
// Возвращает null, если ни одного валидного результата.
export function calcArchetypeAvg(skills, archetypeKey) {
  const ids = getSkillsForArchetype(archetypeKey).map(s => s.id)
  const values = ids
    .map(id => skills?.[id]?.result)
    .filter(v => Number.isFinite(v))
  if (values.length === 0) return null
  return values.reduce((s, n) => s + n, 0) / values.length
}

// Маппинг полного русского названия навыка (как в `## Навык: ...` в
// `ni-surveys.md`) → skill id. Используется парсером `parseSurveys.js`.
//
// ВАЖНО: текст должен совпадать с исходником в `ni-surveys.md` точно
// (включая скобки и кавычки), иначе навык не будет распознан.
export const SKILL_BY_RUS_NAME = {
  // Common base
  'Сонастройка': 'attunement',
  'Слушание Подсознания': 'subconscious-listening',
  'Внутренняя Тишина': 'inner-silence',

  // Mythmaker (10)
  'Смыслообразование': 'meaning-making',
  'Сюжетная Сборка': 'plot-assembly',
  'Чтение Своего Сюжета': 'own-plot-reading',
  'Связь с Родовым Потоком': 'ancestral-flow',
  'Принятие Своей Судьбы': 'destiny-acceptance',
  'Историческая Перспектива': 'historical-perspective',
  'Понимание Сезонов Жизни': 'life-seasons',
  'Чувство Атмосферы Времени (Zeitgeist)': 'zeitgeist',
  'Ретроспективная Сборка': 'retro-assembly',
  'Завершение Циклов': 'cycle-closing',

  // Seer (10)
  'Предвидение Тенденций': 'trend-foresight',
  'Чувство Времени': 'time-sense',
  'Доверие Знакам и Синхронизмам': 'sign-trust',
  'Долгосрочная Перспектива': 'long-perspective',
  'Распознавание Поворотных Моментов': 'pivot-recognition',
  'Тонкое Слушание Сигналов': 'subtle-listening',
  'Приём Не-Словесного Ответа': 'nonverbal-reception',
  'Внутренний Радар': 'inner-radar',
  'Биоритмическая Чувствительность': 'biorhythm',
  'Спонтанное Решение': 'spontaneous-decision',

  // Debunker (10)
  'Различение Интуиции и Тревоги': 'intuition-vs-anxiety',
  'Калибровка Интуиции': 'intuition-calibration',
  'Распознавание Иллюзий и Самообмана': 'illusion-recognition',
  'Декатастрофизация': 'decatastrophizing',
  'Принятие Неопределённости': 'uncertainty-acceptance',
  'Развенчание Самообмана': 'self-deception',
  'Внутренний Скептик': 'inner-skeptic',
  'Различение Подлинной Надежды и Розовой Иллюзии': 'hope-vs-illusion',
  'Распознавание Внешних Манипуляций': 'manipulation-detection',
  'Различение Реальной Угрозы и Параноидальной Проекции': 'threat-vs-projection',

  // Shaman (10)
  'Резонансное Считывание': 'resonance-reading',
  'Игра на Струнах Души': 'soul-strings',
  'Создание Атмосферы': 'atmosphere-creation',
  'Постановка Вопроса Подсознанию': 'subconscious-question',
  'Связь с Душой и Высшими Планами': 'soul-connection',
  'Погружение в Глубинные Состояния': 'deep-states',
  'Работа со Сверхъестественными Инструментами': 'supernatural-tools',
  'Чтение Подтекста': 'subtext-reading',
  'Ритуализация': 'ritualization',
  'Глубокое Восприятие Искусства': 'art-perception',
}

// SKILL_TO_ARCHETYPE для парсера: отдельный маппинг, в котором общие
// базовые получают «virtual» архетип 'common'. Парсер по этому индексу
// находит, к какому ведру отнести навык. В UI общие отображаются
// в каждом из 4 архетипов, а 'common' остаётся внутренним маркером.
export const SKILL_TO_ARCHETYPE_FOR_PARSER = {
  ...SKILL_TO_ARCHETYPE,
  'attunement': 'common',
  'subconscious-listening': 'common',
  'inner-silence': 'common',
}
