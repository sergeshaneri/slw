import { useMemo, useState, type ReactNode } from 'react'
import type { AspectKey } from '@/types/aspect'
import type { DiaryEntry } from '@/types/diary'
import type { JourneyState } from '@/types/journey'
import type { ScriptType } from '@/types/script'
import type { ArchetypeId } from '@/types/skill'
import { CONTENT_CATALOG, type CatalogEntry } from './contentCatalog'
import { MaterialView } from './MaterialView'
import styles from './CatalogView.module.css'

type Props = {
  journey: JourneyState
  scores: Partial<Record<AspectKey, number>>
  diary: DiaryEntry[]
  onDiaryChange: (next: DiaryEntry[]) => void
}

type SkillCluster = {
  id: string
  title: string
  archetype: ArchetypeId
  description: CatalogEntry[]
  questions: CatalogEntry[]
}

const ARCHETYPE_LABELS: Record<ArchetypeId, string> = {
  common: 'Общие навыки',
  healer: 'Целитель',
  aesthete: 'Эстет',
  hedonist: 'Гедонист',
  keeper: 'Хранитель',
  hero: 'Герой',
  ruler: 'Правитель',
  defender: 'Защитник',
  builder: 'Строитель',
  pioneer: 'Первооткрыватель',
  visionary: 'Визионер',
  sage: 'Мудрец',
  catalyst: 'Катализатор',
  seer: 'Провидец',
  mythmaker: 'Мифотворец',
  shaman: 'Шаман',
  debunker: 'Разоблачитель',
  organizer: 'Организатор',
  technologist: 'Технолог',
  engineer: 'Инженер',
  virtuoso: 'Виртуоз',
  analyst: 'Аналитик',
  architect: 'Архитектор',
  guardian: 'Хранитель порядка',
  encyclopedist: 'Энциклопедист',
  artist: 'Артист',
  orator: 'Оратор',
  master_atmo: 'Мастер атмосферы',
  zavodila: 'Заводила',
  confessor: 'Духовник',
  diplomat: 'Дипломат',
  friend: 'Друг',
  ancestor: 'Хранитель рода',
}

const MATERIAL_LABELS: Partial<Record<CatalogEntry['kind'], string>> = {
  'journey-intro': 'Введение',
  'journey-complete': 'Итоги уровня',
  'skill-intro': 'О навыке',
  'skill-level': 'Развитие навыка',
  'aspect-block': 'Теория',
}

const SCRIPT_LABELS: Record<ScriptType, string> = {
  theory: 'Теория',
  word: 'Понятие',
  reflection: 'Размышление',
  exercise: 'Практика',
  question: 'Вопрос',
  survey: 'Самооценка',
}

function amount(value: number, forms: [string, string, string]) {
  const mod100 = value % 100
  const mod10 = value % 10
  const form = mod100 >= 11 && mod100 <= 14
    ? forms[2]
    : mod10 === 1
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4
        ? forms[1]
        : forms[2]
  return value + ' ' + form
}

function entryMeta(entry: CatalogEntry) {
  const label = entry.kind === 'journey-core' || entry.kind === 'journey-survey'
    ? SCRIPT_LABELS[entry.source.type]
    : MATERIAL_LABELS[entry.kind]
  return entry.level == null ? label : label + ' · уровень ' + entry.level
}

function LazyDetails({
  title,
  meta,
  className,
  children,
  dataCluster,
  dataSkillId,
  dataArchetypeId,
}: {
  title: string
  meta: string
  className: string
  children: ReactNode
  dataCluster?: string
  dataSkillId?: string
  dataArchetypeId?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className={className}
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
      data-catalog-cluster={dataCluster}
      data-skill-id={dataSkillId}
      data-archetype-id={dataArchetypeId}
    >
      <summary>
        <span>{title}</span>
        <small>{meta}</small>
      </summary>
      {open ? children : null}
    </details>
  )
}

function MaterialList({ entries, onSelect }: { entries: CatalogEntry[]; onSelect: (id: string) => void }) {
  return (
    <ul className={styles.materialList}>
      {entries.map(entry => (
        <li key={entry.id} data-material-kind={entry.kind}>
          <button type="button" data-material-id={entry.id} onClick={() => onSelect(entry.id)}>
            <span>{entry.title}</span>
            <small>{entryMeta(entry)}</small>
          </button>
        </li>
      ))}
    </ul>
  )
}

function buildSkillClusters(entries: readonly CatalogEntry[]) {
  const skills = entries.filter((entry): entry is Extract<CatalogEntry, { kind: 'skill-intro' }> => entry.kind === 'skill-intro')
  return skills.map<SkillCluster>(skill => ({
    id: skill.sourceId,
    title: skill.source.name,
    archetype: skill.source.archetype,
    description: entries.filter(entry =>
      (entry.kind === 'skill-intro' || entry.kind === 'skill-level') && entry.sourceId === skill.sourceId,
    ),
    questions: entries.filter(entry =>
      entry.kind === 'journey-survey' && entry.source.skill === skill.sourceId,
    ),
  }))
}

function LevelGroup({ level, entries, onSelect }: { level: number; entries: CatalogEntry[]; onSelect: (id: string) => void }) {
  return (
    <LazyDetails
      title={'Уровень ' + level}
      meta={amount(entries.length, ['материал', 'материала', 'материалов'])}
      className={styles.level}
    >
      <MaterialList entries={entries} onSelect={onSelect} />
    </LazyDetails>
  )
}

export function CatalogView({ journey, scores, diary, onDiaryChange }: Props) {
  const [aspect, setAspect] = useState<AspectKey>(CONTENT_CATALOG[0].aspect)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const group = CONTENT_CATALOG.find(item => item.aspect === aspect) ?? CONTENT_CATALOG[0]
  const selected = selectedId ? group.entries.find(entry => entry.id === selectedId) ?? null : null
  const skillClusters = useMemo(() => buildSkillClusters(group.entries), [group])
  const matchedSurveyIds = useMemo(
    () => new Set(skillClusters.flatMap(skill => skill.questions.map(entry => entry.id))),
    [skillClusters],
  )
  const journeyEntries = useMemo(() => group.entries.filter(entry =>
    entry.kind === 'journey-intro' ||
    entry.kind === 'journey-core' ||
    entry.kind === 'journey-complete' ||
    (entry.kind === 'journey-survey' && !matchedSurveyIds.has(entry.id)),
  ), [group, matchedSurveyIds])
  const aspectEntries = useMemo(() => group.entries.filter(entry => entry.kind === 'aspect-block'), [group])
  const searchResults = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru-RU')
    if (!needle) return []
    return group.entries.filter(entry =>
      entry.title.toLocaleLowerCase('ru-RU').includes(needle) ||
      entry.sourceId.toLocaleLowerCase('ru-RU').includes(needle),
    )
  }, [group, query])

  if (selected) {
    return (
      <MaterialView
        key={selected.id}
        entry={selected}
        journey={journey}
        scores={scores}
        diary={diary}
        onDiaryChange={onDiaryChange}
        onBack={() => setSelectedId(null)}
        onNavigateAspectBlock={(blockId) => {
          const next = group.entries.find(entry => entry.kind === 'aspect-block' && entry.sourceId === blockId)
          if (next) setSelectedId(next.id)
        }}
      />
    )
  }

  const skillEntryCount = skillClusters.reduce((sum, skill) => sum + skill.description.length + skill.questions.length, 0)
  const skillGroups = [...new Set(skillClusters.map(skill => skill.archetype))].map(archetype => ({
    archetype,
    title: ARCHETYPE_LABELS[archetype],
    skills: skillClusters.filter(skill => skill.archetype === archetype),
  }))
  const journeyLevels = [0, 1, 2, 3].map(level => ({ level, entries: journeyEntries.filter(entry => entry.level === level) }))
  const aspectLevels = [0, 1, 2, 3].map(level => ({ level, entries: aspectEntries.filter(entry => entry.level === level) }))
  const introEntries = journeyEntries.filter(entry => entry.level == null)
  const visibleResults = searchResults.slice(0, 80)

  return (
    <div className={styles.catalog} data-testid="content-catalog" data-entry-count={group.entries.length}>
      <header className={styles.heading}>
        <div>
          <h2>Каталог материалов</h2>
          <p>Выберите аспект, затем тему или навык.</p>
        </div>
        <span className={styles.total}>{amount(group.entries.length, ['материал', 'материала', 'материалов'])}</span>
      </header>

      <nav className={styles.aspects} aria-label="Аспекты каталога">
        {CONTENT_CATALOG.map(item => (
          <button
            key={item.aspect}
            type="button"
            aria-pressed={aspect === item.aspect}
            onClick={() => { setAspect(item.aspect); setQuery(''); setSelectedId(null) }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <label className={styles.search}>
        <span>Поиск по названию</span>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Например: управление временем"
        />
      </label>

      {query.trim() ? (
        <section className={styles.searchResults} aria-labelledby="catalog-search-title">
          <div className={styles.sectionHeading}>
            <h3 id="catalog-search-title">Результаты поиска</h3>
            <p role="status">{amount(searchResults.length, ['результат', 'результата', 'результатов'])}</p>
          </div>
          {visibleResults.length > 0
            ? <MaterialList entries={visibleResults} onSelect={setSelectedId} />
            : <p className={styles.empty}>Материалы с таким названием не найдены.</p>}
          {searchResults.length > visibleResults.length && (
            <p className={styles.limit}>Показаны первые 80 результатов. Уточните запрос.</p>
          )}
        </section>
      ) : (
        <div className={styles.clusters}>
          <LazyDetails
            key={aspect + '-skills'}
            title="Навыки и вопросы"
            meta={amount(skillClusters.length, ['навык', 'навыка', 'навыков']) + ' · ' + amount(skillEntryCount, ['материал', 'материала', 'материалов'])}
            className={styles.cluster}
            dataCluster="skills"
          >
            <div className={styles.clusterBody}>
              <p className={styles.clusterLead}>Выберите архетип, затем навык. Внутри доступны описание, уровни развития и вопросы для самооценки.</p>
              <div className={styles.archetypeGrid}>
                {skillGroups.map(group => (
                  <LazyDetails
                    key={group.archetype}
                    title={group.title}
                    meta={amount(group.skills.length, ['навык', 'навыка', 'навыков'])}
                    className={styles.archetype}
                    dataArchetypeId={group.archetype}
                  >
                    <div className={styles.skillGrid}>
                      {group.skills.map(skill => (
                        <LazyDetails
                          key={skill.id}
                          title={skill.title}
                          meta={skill.questions.length > 0
                            ? amount(skill.questions.length, ['набор вопросов', 'набора вопросов', 'наборов вопросов'])
                            : 'Описание и уровни'}
                          className={styles.skill}
                          dataSkillId={skill.id}
                        >
                          <div className={styles.skillBody}>
                            <section>
                              <h4>Описание и развитие</h4>
                              <MaterialList entries={skill.description} onSelect={setSelectedId} />
                            </section>
                            {skill.questions.length > 0 && (
                              <section>
                                <h4>Вопросы для самооценки</h4>
                                <MaterialList entries={skill.questions} onSelect={setSelectedId} />
                              </section>
                            )}
                          </div>
                        </LazyDetails>
                      ))}
                    </div>
                  </LazyDetails>
                ))}
              </div>
            </div>
          </LazyDetails>

          <LazyDetails
            key={aspect + '-journey'}
            title="Путешествие по аспекту"
            meta={amount(journeyEntries.length, ['материал', 'материала', 'материалов'])}
            className={styles.cluster}
            dataCluster="journey"
          >
            <div className={styles.clusterBody}>
              {introEntries.length > 0 && <MaterialList entries={introEntries} onSelect={setSelectedId} />}
              <div className={styles.levelGrid}>
                {journeyLevels.filter(item => item.entries.length > 0).map(item => (
                  <LevelGroup key={item.level} level={item.level} entries={item.entries} onSelect={setSelectedId} />
                ))}
              </div>
            </div>
          </LazyDetails>

          <LazyDetails
            key={aspect + '-theory'}
            title="Теория аспекта"
            meta={amount(aspectEntries.length, ['материал', 'материала', 'материалов'])}
            className={styles.cluster}
            dataCluster="theory"
          >
            <div className={styles.clusterBody}>
              <div className={styles.levelGrid}>
                {aspectLevels.filter(item => item.entries.length > 0).map(item => (
                  <LevelGroup key={item.level} level={item.level} entries={item.entries} onSelect={setSelectedId} />
                ))}
              </div>
            </div>
          </LazyDetails>
        </div>
      )}
    </div>
  )
}
