// Дерево навыков БЭ — 56 архетипных навыков по 4 архетипам
// + 2 общих базовых (корневых) навыка, которые входят в средний подсчёт
// каждого архетипа сквозным слоем.
//
// Архетипы соответствуют четырём «полным образам» БЭ из соционики:
// Дипломат, Духовник, Хранитель Рода, Друг.
//
// Общие базовые корневые (Установление Доверия, Внутренняя Сверка с
// Ценностями) — фундамент, единый для всех архетипов. Они отображаются
// в каждой ветке UI, помеченные как «общий» (и считаются в среднем по
// каждому архетипу).
//
// Источник истины — `Fi/матрица навыков БЭ.md` и подробные файлы по
// каждому архетипу в той же папке: `Навыки БЭ — Корневые.md`,
// `Навыки БЭ — Дипломат.md`, `Навыки БЭ — Духовник.md`,
// `Навыки БЭ — Хранитель Рода.md`, `Навыки БЭ — Друг.md`.
//
// id навыка — короткий латинский ключ. Префикс `fi-` для глобальной
// уникальности (state.skills плоский по skillId, ключи разных аспектов
// не должны пересекаться).

export const ARCHETYPES = {
  diplomat: {
    id: 'diplomat',
    name: 'Дипломат',
    subtitle: 'мост между сторонами и средами',
    blurb: 'Соединяет людей, медиирует конфликты, удерживает связь там, где она норовит порваться.',
    glyph: '🌉'
  },
  confessor: {
    id: 'confessor',
    name: 'Духовник',
    subtitle: 'принимающий чужое сокровенное',
    blurb: 'Слушает без приговора. Рядом с ним другой впервые слышит сам себя.',
    glyph: '🕊'
  },
  ancestor: {
    id: 'ancestor',
    name: 'Хранитель Рода',
    subtitle: 'носитель связи поколений',
    blurb: 'Передаёт семейную историю, поддерживает ритуалы, помнит ушедших, отпускает отжившее.',
    glyph: '🏛'
  },
  friend: {
    id: 'friend',
    name: 'Друг',
    subtitle: 'равная преданность',
    blurb: 'Близость без потери себя, длительная любовь, присутствие без условий.',
    glyph: '🤝'
  }
}

export const ARCHETYPE_KEYS = ['diplomat', 'confessor', 'ancestor', 'friend']

// Два общих базовых корневых навыка. Входят в каждый архетип при подсчёте
// среднего и отображаются в каждой ветке UI с пометкой «общий».
export const COMMON_BASE_SKILLS = [
  { id: 'fi-trust',           name: 'Установление Доверия',            isCommon: true },
  { id: 'fi-values-check',    name: 'Внутренняя Сверка с Ценностями',  isCommon: true }
]

// Раскладка 56 архетипных навыков по 4 веткам.
// Порядок внутри каждой ветки — от ядерных (1-5/6) к поддерживающим.
// В UI к каждой ветке добавляются 2 общих базовых сверху.
export const SKILL_TREE = {
  diplomat: [
    // Ядерные (5)
    { id: 'fi-mediation',         name: 'Медиация' },
    { id: 'fi-tact',              name: 'Тактичная Искренность' },
    { id: 'fi-i-message',         name: 'Я-Сообщения и Ответственность за Свои Чувства' },
    { id: 'fi-connecting',        name: 'Соединение Людей' },
    { id: 'fi-belonging',         name: 'Стать Своим' },
    // Поддерживающие (12)
    { id: 'fi-repair',            name: 'Ремонт Отношений' },
    { id: 'fi-apology',           name: 'Глубокое Извинение' },
    { id: 'fi-anger-contact',     name: 'Удержание Контакта в Гневе' },
    { id: 'fi-listen-active',     name: 'Активное Слушание' },
    { id: 'fi-feelings-check',    name: 'Сверка Чувств' },
    { id: 'fi-unspoken',          name: 'Произнесение Невыраженного' },
    { id: 'fi-ambivalence',       name: 'Принятие Двойственности' },
    { id: 'fi-warm-distance',     name: 'Тёплая Дистанция' },
    { id: 'fi-defend-absent',     name: 'Защита Отсутствующего' },
    { id: 'fi-act-vs-person',     name: 'Отделение Поступка от Личности' },
    { id: 'fi-naming',            name: 'Навык Имени' },
    { id: 'fi-network-vision',    name: 'Видение Сети Отношений' }
  ],
  confessor: [
    // Ядерные (6)
    { id: 'fi-presence',          name: 'Безоценочное Присутствие' },
    { id: 'fi-listen-values',     name: 'Глубокое Слушание Ценностей' },
    { id: 'fi-witness-pain',      name: 'Свидетельство Чужой Боли' },
    { id: 'fi-ethical-doubt',     name: 'Этическая Рефлексия и Сомнение' },
    { id: 'fi-feelings-distinct', name: 'Различение Чувств' },
    { id: 'fi-self-compassion',   name: 'Самосострадание' },
    // Поддерживающие (8)
    { id: 'fi-crisis-coping',     name: 'Кризисное Совладание' },
    { id: 'fi-deep-vision',       name: 'Глубокое Видение Другого' },
    { id: 'fi-dark-feelings',     name: 'Принятие Своих Тёмных Чувств' },
    { id: 'fi-pity-vs-compassion', name: 'Различение Жалости и Сострадания' },
    { id: 'fi-sacrifice-vs-gift', name: 'Различение Жертвы и Дара' },
    { id: 'fi-duty-vs-fear',      name: 'Различение Долга по Совести и по Страху' },
    { id: 'fi-inner-parent',      name: 'Извлечение Голоса Внутреннего Родителя' },
    { id: 'fi-keep-secret',       name: 'Хранение Чужой Тайны' }
  ],
  ancestor: [
    // Ядерные (5)
    { id: 'fi-family-history',    name: 'Передача Семейной Истории' },
    { id: 'fi-rituals',           name: 'Создание Семейных Ритуалов' },
    { id: 'fi-memorial',          name: 'Поминовение Ушедших' },
    { id: 'fi-shared-history',    name: 'Создание Общей Истории' },
    { id: 'fi-letting-go',        name: 'Отпускание' },
    // Поддерживающие (4)
    { id: 'fi-family-script',     name: 'Трансформация Семейного Сценария' },
    { id: 'fi-old-age-presence',  name: 'Безусловное Присутствие в Старости и Смерти' },
    { id: 'fi-value-after-loss',  name: 'Сохранение Ценности при Утрате' },
    { id: 'fi-trust-circle',      name: 'Построение Круга Доверия' }
  ],
  friend: [
    // Ядерные (5)
    { id: 'fi-closeness-self',    name: 'Близость без Потери Себя' },
    { id: 'fi-choose-love',       name: 'Выбор Любить' },
    { id: 'fi-recognize-own',     name: 'Узнавание Своих' },
    { id: 'fi-keep-bonds',        name: 'Поддержание Связей' },
    { id: 'fi-long-faith',        name: 'Длительная Вера в Путь Другого' },
    // Поддерживающие (11)
    { id: 'fi-forgive',           name: 'Прощение' },
    { id: 'fi-gratitude',         name: 'Благодарность' },
    { id: 'fi-imperfection',      name: 'Принятие Несовершенства' },
    { id: 'fi-vulnerability',     name: 'Уязвимость и Просьба о Помощи' },
    { id: 'fi-shared-silence',    name: 'Совместное Молчание' },
    { id: 'fi-supporting-presence', name: 'Поддерживающее Присутствие' },
    { id: 'fi-side-with-own',     name: 'Поддержка Своих' },
    { id: 'fi-joy-for-other',     name: 'Радость за Другого' },
    { id: 'fi-mature-ending',     name: 'Зрелое Завершение Отношений' },
    { id: 'fi-visible-care',      name: 'Зримая Забота' },
    { id: 'fi-receive-love',      name: 'Принятие Чужой Любви' }
  ]
}

// Возвращает полный список навыков, отображаемых под архетипом
// в UI: 2 общих базовых сверху + специфичные навыки архетипа.
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

// Все уникальные skill id одним массивом (2 общих + 56 архетипных = 58).
// 2 общих + 17 + 14 + 9 + 16 = 58.
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

// Маппинг полного русского названия навыка (как в `### Навык: ...` в
// `fi-surveys.md`) → skill id. Используется парсером `parseSurveys.js`.
//
// ВАЖНО: текст должен совпадать с исходником в `fi-surveys.md` точно
// (включая скобки и кавычки), иначе навык не будет распознан.
export const SKILL_BY_RUS_NAME = {
  // Common base (корневые)
  'Установление Доверия': 'fi-trust',
  'Внутренняя Сверка с Ценностями': 'fi-values-check',

  // Diplomat (Дипломат) — 17
  'Медиация': 'fi-mediation',
  'Тактичная Искренность': 'fi-tact',
  'Я-Сообщения и Ответственность за Свои Чувства': 'fi-i-message',
  'Соединение Людей': 'fi-connecting',
  'Стать Своим': 'fi-belonging',
  'Ремонт Отношений': 'fi-repair',
  'Глубокое Извинение': 'fi-apology',
  'Удержание Контакта в Гневе': 'fi-anger-contact',
  'Активное Слушание': 'fi-listen-active',
  'Сверка Чувств': 'fi-feelings-check',
  'Произнесение Невыраженного': 'fi-unspoken',
  'Принятие Двойственности': 'fi-ambivalence',
  'Тёплая Дистанция': 'fi-warm-distance',
  'Защита Отсутствующего': 'fi-defend-absent',
  'Отделение Поступка от Личности': 'fi-act-vs-person',
  'Навык Имени': 'fi-naming',
  'Видение Сети Отношений': 'fi-network-vision',

  // Confessor (Духовник) — 14
  'Безоценочное Присутствие': 'fi-presence',
  'Глубокое Слушание Ценностей': 'fi-listen-values',
  'Свидетельство Чужой Боли': 'fi-witness-pain',
  'Этическая Рефлексия и Сомнение': 'fi-ethical-doubt',
  'Различение Чувств': 'fi-feelings-distinct',
  'Самосострадание': 'fi-self-compassion',
  'Кризисное Совладание': 'fi-crisis-coping',
  'Глубокое Видение Другого': 'fi-deep-vision',
  'Принятие Своих Тёмных Чувств': 'fi-dark-feelings',
  'Различение Жалости и Сострадания': 'fi-pity-vs-compassion',
  'Различение Жертвы и Дара': 'fi-sacrifice-vs-gift',
  'Различение Долга по Совести и по Страху': 'fi-duty-vs-fear',
  'Извлечение Голоса Внутреннего Родителя': 'fi-inner-parent',
  'Хранение Чужой Тайны': 'fi-keep-secret',

  // Ancestor (Хранитель Рода) — 9
  'Передача Семейной Истории': 'fi-family-history',
  'Создание Семейных Ритуалов': 'fi-rituals',
  'Поминовение Ушедших': 'fi-memorial',
  'Создание Общей Истории': 'fi-shared-history',
  'Отпускание': 'fi-letting-go',
  'Трансформация Семейного Сценария': 'fi-family-script',
  'Безусловное Присутствие в Старости и Смерти': 'fi-old-age-presence',
  'Сохранение Ценности при Утрате': 'fi-value-after-loss',
  'Построение Круга Доверия': 'fi-trust-circle',

  // Friend (Друг) — 16
  'Близость без Потери Себя': 'fi-closeness-self',
  'Выбор Любить': 'fi-choose-love',
  'Узнавание Своих': 'fi-recognize-own',
  'Поддержание Связей': 'fi-keep-bonds',
  'Длительная Вера в Путь Другого': 'fi-long-faith',
  'Прощение': 'fi-forgive',
  'Благодарность': 'fi-gratitude',
  'Принятие Несовершенства': 'fi-imperfection',
  'Уязвимость и Просьба о Помощи': 'fi-vulnerability',
  'Совместное Молчание': 'fi-shared-silence',
  'Поддерживающее Присутствие': 'fi-supporting-presence',
  'Поддержка Своих': 'fi-side-with-own',
  'Радость за Другого': 'fi-joy-for-other',
  'Зрелое Завершение Отношений': 'fi-mature-ending',
  'Зримая Забота': 'fi-visible-care',
  'Принятие Чужой Любви': 'fi-receive-love',
}

// SKILL_TO_ARCHETYPE для парсера: отдельный маппинг, в котором общие
// базовые получают «virtual» архетип 'common'. Парсер по этому индексу
// находит, к какому ведру отнести навык. В UI общие отображаются
// в каждом из 4 архетипов, а 'common' остаётся внутренним маркером.
export const SKILL_TO_ARCHETYPE_FOR_PARSER = {
  ...SKILL_TO_ARCHETYPE,
  'fi-trust': 'common',
  'fi-values-check': 'common',
}
