// Дерево навыков ЧЭ — 3 ядерных + 31 архетипный = 34 навыка.
//
// Архетипы соответствуют четырём «полным образам» ЧЭ из соционики:
// Заводила, Оратор, Артист, Мастер Атмосферы.
//
// 3 ядерных навыка (Эмоциональная осознанность, Выразительность,
// Конгруэнтность) — фундамент, единый для всех четырёх архетипов.
// В UI отображаются в каждой ветке с пометкой «общий», в среднем по
// архетипу учитываются как доп. слагаемые.
//
// id навыка — короткий латинский ключ. Используется как ключ в state
// и как имя секции в surveys.md.
//
// order внутри архетипа — порядок отображения в дереве (от базовых
// к продвинутым).

export const ARCHETYPES = {
  zavodila: {
    id: 'zavodila',
    name: 'Заводила',
    subtitle: 'мастер желания',
    blurb: 'Поднимать собственный и групповой тонус, зажигать поле живой энергией.',
    glyph: '🔥'
  },
  orator: {
    id: 'orator',
    name: 'Оратор',
    subtitle: 'мастер слова',
    blurb: 'Доносить эмоцию до группы через точное живое слово, мобилизовать речью.',
    glyph: '🎙️'
  },
  artist: {
    id: 'artist',
    name: 'Артист',
    subtitle: 'мастер сцены',
    blurb: 'Передавать эмоцию через тело, голос, историю; присутствовать на сцене.',
    glyph: '🎭'
  },
  master_atmo: {
    id: 'master_atmo',
    name: 'Мастер Атмосферы',
    subtitle: 'хозяин поля',
    blurb: 'Создавать и удерживать тёплое устойчивое поле в группе на длинной дистанции.',
    glyph: '🏠'
  }
}

export const ARCHETYPE_KEYS = ['zavodila', 'orator', 'artist', 'master_atmo']

// Три ядерных навыка ЧЭ — фундамент, общий для всех четырёх архетипов.
// Триада: вход → выход → совпадение.
//
// Эти же 3 анкеты включаются в L0-чат ЧЭ как первая оценка ЧЭ, до того,
// как открывается полное колесо навыков.
export const COMMON_BASE_SKILLS = [
  { id: 'fe-awareness',     name: 'Эмоциональная осознанность',  isCommon: true },
  { id: 'fe-expressiveness', name: 'Выразительность',             isCommon: true },
  { id: 'fe-congruence',    name: 'Конгруэнтность',               isCommon: true },
]

export const COMMON_BASE_SKILL_IDS = new Set(COMMON_BASE_SKILLS.map(s => s.id))

// Раскладка 31 архетипного навыка по 4 веткам.
// В UI к каждой ветке добавляются 3 ядерных сверху.
export const SKILL_TREE = {
  zavodila: [
    // Дополнительные навыки для Заводилы
    { id: 'fe-pause',           name: 'Пауза перед реакцией' },
    { id: 'fe-emo-hygiene',     name: 'Эмо-гигиена' },
    { id: 'fe-group-pulse',     name: 'Считывание группового импульса' },
    { id: 'fe-open-emotion',    name: 'Открытое проявление эмоций' },
    // Архетипные навыки Заводилы
    { id: 'fe-warm-up',         name: 'Разогрев собственного тонуса' },
    { id: 'fe-state-spread',    name: 'Заражение состоянием' },
    { id: 'fe-play-humor',      name: 'Игра и юмор' },
    { id: 'fe-hold-peak',       name: 'Удержание пика' },
    { id: 'fe-discharge',       name: 'Эмо-разрядка' }
  ],
  orator: [
    // Дополнительные навыки для Оратора
    { id: 'fe-breath',          name: 'Дыхательная регуляция' },
    { id: 'fe-self-honesty',    name: 'Эмо-честность с собой' },
    { id: 'fe-targeted-delivery', name: 'Адресная подача' },
    { id: 'fe-artistry',        name: 'Артистичность' },
    // Архетипные навыки Оратора
    { id: 'fe-imagery',         name: 'Образное слово' },
    { id: 'fe-call-action',     name: 'Призыв к действию' }
  ],
  artist: [
    // Дополнительные навыки для Артиста
    { id: 'fe-shades',          name: 'Различение оттенков' },
    { id: 'fe-triggers',        name: 'Распознавание собственных триггеров' },
    { id: 'fe-read-others',     name: 'Считывание чужих эмоций' },
    { id: 'fe-empathy',         name: 'Эмпатия' },
    // Архетипные навыки Артиста
    { id: 'fe-body-instrument', name: 'Тело-инструмент' },
    { id: 'fe-improv',          name: 'Импровизация' },
    { id: 'fe-storytelling',    name: 'Storytelling' },
    { id: 'fe-stage-fear',      name: 'Управление страхом перед сценой' }
  ],
  master_atmo: [
    // Дополнительные навыки для Мастера Атмосферы
    { id: 'fe-containment',     name: 'Контейнирование' },
    { id: 'fe-emo-borders',     name: 'Эмо-границы' },
    { id: 'fe-room-atmo',       name: 'Считывание атмосферы помещения' },
    // Архетипные навыки Мастера Атмосферы
    { id: 'fe-set-tone',        name: 'Задавание тона встречи' },
    { id: 'fe-include-people',  name: 'Включение людей в общий разговор' },
    { id: 'fe-protect-quiet',   name: 'Защита тихого участника от давления' },
    { id: 'fe-rituals',         name: 'Ритуалы группы' },
    { id: 'fe-group-history',   name: 'Удержание истории группы' }
  ]
}

// Обратный индекс: skillId → archetypeKey. Только для архетип-специфичных
// навыков. Ядерные в этот индекс НЕ попадают (они принадлежат всем 4
// архетипам сразу). Использовать с проверкой на COMMON_BASE_SKILL_IDS.
export const SKILL_TO_ARCHETYPE = Object.fromEntries(
  Object.entries(SKILL_TREE).flatMap(([arche, skills]) =>
    skills.map(s => [s.id, arche])
  )
)

// Возвращает полный список навыков, отображаемых под архетипом в UI:
// 3 ядерных сверху + специфичные навыки архетипа.
export function getSkillsForArchetype(archetypeKey) {
  const specific = SKILL_TREE[archetypeKey] ?? []
  return [...COMMON_BASE_SKILLS, ...specific]
}

// Все skill id одним массивом, в порядке отображения.
// 3 ядерных + 9 (Заводила) + 6 (Оратор) + 8 (Артист) + 8 (МА) = 34.
export const ALL_SKILL_IDS = [
  ...COMMON_BASE_SKILLS.map(s => s.id),
  ...ARCHETYPE_KEYS.flatMap(k => SKILL_TREE[k].map(s => s.id))
]

// Имена 5 блоков анкеты — те же, что и у БС.
export const SURVEY_BLOCKS = [
  { id: 'knowledge',   name: 'Теоретическое знание' },
  { id: 'practice',    name: 'Практическое умение' },
  { id: 'awareness',   name: 'Осознанность выполнения' },
  { id: 'priority',    name: 'Ценность и приоритет' },
  { id: 'confidence',  name: 'Уверенность и помощь другим' }
]

export const SURVEY_BLOCK_KEYS = SURVEY_BLOCKS.map(b => b.id)

// Маппинг русского заголовка блока → ключ блока.
export const BLOCK_RUS_TO_KEY = Object.fromEntries(
  SURVEY_BLOCKS.map(b => [b.name, b.id])
)

// Маппинг полного русского названия навыка → skill id.
// Используется парсером `parseSurveys.js`.
//
// ВАЖНО: текст должен совпадать с заголовком в `surveys.md` точно.
export const SKILL_BY_RUS_NAME = {
  // Ядерные
  'Эмоциональная осознанность': 'fe-awareness',
  'Выразительность': 'fe-expressiveness',
  'Конгруэнтность': 'fe-congruence',

  // Заводила (доп. + арх.)
  'Пауза перед реакцией': 'fe-pause',
  'Эмо-гигиена': 'fe-emo-hygiene',
  'Считывание группового импульса': 'fe-group-pulse',
  'Открытое проявление эмоций': 'fe-open-emotion',
  'Разогрев собственного тонуса': 'fe-warm-up',
  'Заражение состоянием': 'fe-state-spread',
  'Игра и юмор': 'fe-play-humor',
  'Удержание пика': 'fe-hold-peak',
  'Эмо-разрядка': 'fe-discharge',

  // Оратор (доп. + арх.)
  'Дыхательная регуляция': 'fe-breath',
  'Эмо-честность с собой': 'fe-self-honesty',
  'Адресная подача': 'fe-targeted-delivery',
  'Артистичность': 'fe-artistry',
  'Образное слово': 'fe-imagery',
  'Призыв к действию': 'fe-call-action',

  // Артист (доп. + арх.)
  'Различение оттенков': 'fe-shades',
  'Распознавание собственных триггеров': 'fe-triggers',
  'Считывание чужих эмоций': 'fe-read-others',
  'Эмпатия': 'fe-empathy',
  'Тело-инструмент': 'fe-body-instrument',
  'Импровизация': 'fe-improv',
  'Storytelling': 'fe-storytelling',
  'Управление страхом перед сценой': 'fe-stage-fear',

  // Мастер Атмосферы (доп. + арх.)
  'Контейнирование': 'fe-containment',
  'Эмо-границы': 'fe-emo-borders',
  'Считывание атмосферы помещения': 'fe-room-atmo',
  'Задавание тона встречи': 'fe-set-tone',
  'Включение людей в общий разговор': 'fe-include-people',
  'Защита тихого участника от давления': 'fe-protect-quiet',
  'Ритуалы группы': 'fe-rituals',
  'Удержание истории группы': 'fe-group-history'
}

// Среднее по архетипу: ядерные + специфичные навыки архетипа.
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

// Общая оценка ЧЭ: среднее по архетипам, в которых есть хоть одна анкета.
export function calcFeScoreFromSkills(skills) {
  const archeAvgs = ARCHETYPE_KEYS
    .map(k => calcArchetypeAvg(skills, k))
    .filter(v => v != null)
  if (archeAvgs.length === 0) return null
  return archeAvgs.reduce((s, n) => s + n, 0) / archeAvgs.length
}

// Сколько анкет пройдено всего и сколько ещё осталось.
export function getSkillProgress(skills) {
  const completed = ALL_SKILL_IDS.filter(id => Number.isFinite(skills?.[id]?.result)).length
  return { completed, total: ALL_SKILL_IDS.length, remaining: ALL_SKILL_IDS.length - completed }
}
