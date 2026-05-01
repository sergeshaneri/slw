// Дерево навыков ЧИ — 33 архетипных навыка по 4 архетипам
// + 3 общих базовых навыка, которые входят в средний подсчёт
// каждого архетипа (не отдельной веткой).
//
// Архетипы соответствуют четырём «полным образам» ЧИ из соционики:
// Мудрец, Первооткрыватель, Катализатор, Визионер.
//
// Общие базовые (Внимание к сути, Метапознание, Mindfulness) —
// фундамент, единый для всех архетипов. Они отображаются в каждой
// ветке UI, помеченные как «общий» (и считаются в среднем по
// каждому архетипу).
//
// Источник истины — `Ne/список навыков ЧИ.md` и подробные файлы по
// каждому архетипу в той же папке.
//
// id навыка — короткий латинский ключ. Используется как ключ в state и
// (потенциально) как имя секции в surveys-md, когда они появятся.

export const ARCHETYPES = {
  sage: {
    id: 'sage',
    name: 'Мудрец',
    subtitle: 'хранитель сути',
    blurb: 'Видеть программу, паттерн, скрытый замысел. Глаза ЧИ.',
    glyph: '🦉'
  },
  pioneer: {
    id: 'pioneer',
    name: 'Первооткрыватель',
    subtitle: 'пионер неизведанного',
    blurb: 'Открывать варианты, нащупывать новое, сплавлять разнородное. Крылья ЧИ.',
    glyph: '🧭'
  },
  catalyst: {
    id: 'catalyst',
    name: 'Катализатор',
    subtitle: 'вдохновляющий других',
    blurb: 'Зажигать в других их потенциал, не передавая готовых ответов. Пламя ЧИ.',
    glyph: '🔥'
  },
  visionary: {
    id: 'visionary',
    name: 'Визионер',
    subtitle: 'архитектор возможного будущего',
    blurb: 'Видеть горизонт, строить путь, удерживать большую картину. Горизонт ЧИ.',
    glyph: '🌅'
  }
}

export const ARCHETYPE_KEYS = ['sage', 'pioneer', 'catalyst', 'visionary']

// Три общих базовых навыка. Входят в каждый архетип при подсчёте
// среднего и отображаются в каждой ветке UI с пометкой «общий».
export const COMMON_BASE_SKILLS = [
  { id: 'attention-essence', name: 'Внимание к сути',                          isCommon: true },
  { id: 'metacognition',     name: 'Осознанность за вниманием (метапознание)', isCommon: true },
  { id: 'mindfulness',       name: 'Зазор между стимулом и реакцией (mindfulness)', isCommon: true }
]

// Раскладка 33 архетипных навыков по 4 веткам.
// Порядок внутри каждой ветки — от базовых к продвинутым.
// В UI к каждой ветке добавляются 3 общих базовых сверху.
export const SKILL_TREE = {
  sage: [
    { id: 'read-program',       name: 'Чтение программы объекта' },
    { id: 'patterns',           name: 'Распознавание паттернов' },
    { id: 'universal-in-part',  name: 'Видение универсального в частном' },
    { id: 'sense-making',       name: 'Смыслообразование (sense-making)' },
    { id: 'paradox',            name: 'Схлопывание парадоксов' },
    { id: 'mental-models',      name: 'Построение ментальных моделей' },
    { id: 'read-unsaid',        name: 'Чтение невысказанного' }
  ],
  pioneer: [
    { id: 'variants',            name: 'Открывание вариантов' },
    { id: 'thought-experiments', name: 'Мысленные эксперименты («а что, если…»)' },
    { id: 'synthesis',           name: 'Соединение и сплав разнородного' },
    { id: 'discovery',           name: 'Совершать открытия' },
    { id: 'play',                name: 'Игра в неизведанном' },
    { id: 'serendipity',         name: 'Серендипность и продуктивное «незнание»' },
    { id: 'info-flow',           name: 'Работа с информационным потоком' }
  ],
  catalyst: [
    { id: 'socratic',         name: 'Сильные вопросы и сократический диалог' },
    { id: 'holding-pause',    name: 'Удержание паузы для прорыва другого' },
    { id: 'strengths',        name: 'Видение и зажигание сильных сторон' },
    { id: 'unpacking',        name: 'Распаковка чужого замысла' },
    { id: 'vision-launch',    name: 'Запуск движения через видение' },
    { id: 'field',            name: 'Создание поля для проявления других' },
    { id: 'translation',      name: 'Искусство переводить и упрощать' },
    { id: 'read-others',      name: 'Чтение чужого материала' },
    { id: 'reframing',        name: 'Позитивный рефрейминг' },
    { id: 'self-experiment',  name: 'Эксперимент на себе (как метод запуска изменений)' }
  ],
  visionary: [
    { id: 'meta-position',  name: 'Метапозиция и наблюдающее Я' },
    { id: 'big-picture',    name: 'Удержание картины и управление масштабом' },
    { id: 'futures',        name: 'Работа с возможным будущим' },
    { id: 'holding-vision', name: 'Удержание видения во времени' },
    { id: 'potential',      name: 'Видение потенциала и новых возможностей' },
    { id: 'inner-call',     name: 'Следование за интересом (внутренний зов)' },
    { id: 'affordance',     name: 'Чувствование лучшего шага сейчас (аффорданс)' },
    { id: 'flow-incubation', name: 'Управление состоянием для рождения идей' },
    { id: 'ripening',       name: 'Различение «ещё не созревшего»' }
  ]
}

// Возвращает полный список навыков, отображаемых под архетипом
// в UI: 3 общих базовых сверху + специфичные навыки архетипа.
// Используется и для отображения, и для расчёта среднего.
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

// Все уникальные skill id одним массивом (3 общих + 33 архетипных = 36).
// 3 общих + 7 + 7 + 10 + 9 = 36.
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
