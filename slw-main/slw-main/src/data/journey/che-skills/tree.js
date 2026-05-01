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
  { id: 'che-awareness',     name: 'Эмоциональная осознанность',  isCommon: true },
  { id: 'che-expressiveness', name: 'Выразительность',             isCommon: true },
  { id: 'che-congruence',    name: 'Конгруэнтность',               isCommon: true },
]

export const COMMON_BASE_SKILL_IDS = new Set(COMMON_BASE_SKILLS.map(s => s.id))

// Раскладка 31 архетипного навыка по 4 веткам.
// В UI к каждой ветке добавляются 3 ядерных сверху.
export const SKILL_TREE = {
  zavodila: [
    // Дополнительные навыки для Заводилы
    { id: 'che-pause',           name: 'Пауза перед реакцией' },
    { id: 'che-emo-hygiene',     name: 'Эмо-гигиена' },
    { id: 'che-group-pulse',     name: 'Считывание группового импульса' },
    { id: 'che-open-emotion',    name: 'Открытое проявление эмоций' },
    // Архетипные навыки Заводилы
    { id: 'che-warm-up',         name: 'Разогрев собственного тонуса' },
    { id: 'che-state-spread',    name: 'Заражение состоянием' },
    { id: 'che-play-humor',      name: 'Игра и юмор' },
    { id: 'che-hold-peak',       name: 'Удержание пика' },
    { id: 'che-discharge',       name: 'Эмо-разрядка' }
  ],
  orator: [
    // Дополнительные навыки для Оратора
    { id: 'che-breath',          name: 'Дыхательная регуляция' },
    { id: 'che-self-honesty',    name: 'Эмо-честность с собой' },
    { id: 'che-targeted-delivery', name: 'Адресная подача' },
    { id: 'che-artistry',        name: 'Артистичность' },
    // Архетипные навыки Оратора
    { id: 'che-imagery',         name: 'Образное слово' },
    { id: 'che-call-action',     name: 'Призыв к действию' }
  ],
  artist: [
    // Дополнительные навыки для Артиста
    { id: 'che-shades',          name: 'Различение оттенков' },
    { id: 'che-triggers',        name: 'Распознавание собственных триггеров' },
    { id: 'che-read-others',     name: 'Считывание чужих эмоций' },
    { id: 'che-empathy',         name: 'Эмпатия' },
    // Архетипные навыки Артиста
    { id: 'che-body-instrument', name: 'Тело-инструмент' },
    { id: 'che-improv',          name: 'Импровизация' },
    { id: 'che-storytelling',    name: 'Storytelling' },
    { id: 'che-stage-fear',      name: 'Управление страхом перед сценой' }
  ],
  master_atmo: [
    // Дополнительные навыки для Мастера Атмосферы
    { id: 'che-containment',     name: 'Контейнирование' },
    { id: 'che-emo-borders',     name: 'Эмо-границы' },
    { id: 'che-room-atmo',       name: 'Считывание атмосферы помещения' },
    // Архетипные навыки Мастера Атмосферы
    { id: 'che-set-tone',        name: 'Задавание тона встречи' },
    { id: 'che-include-people',  name: 'Включение людей в общий разговор' },
    { id: 'che-protect-quiet',   name: 'Защита тихого участника от давления' },
    { id: 'che-rituals',         name: 'Ритуалы группы' },
    { id: 'che-group-history',   name: 'Удержание истории группы' }
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
  'Эмоциональная осознанность': 'che-awareness',
  'Выразительность': 'che-expressiveness',
  'Конгруэнтность': 'che-congruence',

  // Заводила (доп. + арх.)
  'Пауза перед реакцией': 'che-pause',
  'Эмо-гигиена': 'che-emo-hygiene',
  'Считывание группового импульса': 'che-group-pulse',
  'Открытое проявление эмоций': 'che-open-emotion',
  'Разогрев собственного тонуса': 'che-warm-up',
  'Заражение состоянием': 'che-state-spread',
  'Игра и юмор': 'che-play-humor',
  'Удержание пика': 'che-hold-peak',
  'Эмо-разрядка': 'che-discharge',

  // Оратор (доп. + арх.)
  'Дыхательная регуляция': 'che-breath',
  'Эмо-честность с собой': 'che-self-honesty',
  'Адресная подача': 'che-targeted-delivery',
  'Артистичность': 'che-artistry',
  'Образное слово': 'che-imagery',
  'Призыв к действию': 'che-call-action',

  // Артист (доп. + арх.)
  'Различение оттенков': 'che-shades',
  'Распознавание собственных триггеров': 'che-triggers',
  'Считывание чужих эмоций': 'che-read-others',
  'Эмпатия': 'che-empathy',
  'Тело-инструмент': 'che-body-instrument',
  'Импровизация': 'che-improv',
  'Storytelling': 'che-storytelling',
  'Управление страхом перед сценой': 'che-stage-fear',

  // Мастер Атмосферы (доп. + арх.)
  'Контейнирование': 'che-containment',
  'Эмо-границы': 'che-emo-borders',
  'Считывание атмосферы помещения': 'che-room-atmo',
  'Задавание тона встречи': 'che-set-tone',
  'Включение людей в общий разговор': 'che-include-people',
  'Защита тихого участника от давления': 'che-protect-quiet',
  'Ритуалы группы': 'che-rituals',
  'Удержание истории группы': 'che-group-history'
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
export function calcCheScoreFromSkills(skills) {
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
