import { useMemo, useState } from 'react'
import type { AspectKey } from '@/types/aspect'
import type { DiaryEntry } from '@/types/diary'
import type { JourneyState } from '@/types/journey'
import { CONTENT_CATALOG, type CatalogEntry, type CatalogKind } from './contentCatalog'
import { MaterialView } from './MaterialView'
import styles from './CatalogView.module.css'

type Props = {
  journey: JourneyState
  scores: Partial<Record<AspectKey, number>>
  diary: DiaryEntry[]
  onDiaryChange: (next: DiaryEntry[]) => void
}

const KIND_LABELS: Record<CatalogKind, string> = {
  'journey-intro': 'Введение в путешествие',
  'journey-core': 'Шаги путешествия',
  'journey-survey': 'Анкеты путешествия',
  'journey-complete': 'Завершение уровней',
  'skill-intro': 'Описания навыков',
  'skill-level': 'Развитие навыков',
  'aspect-block': 'Материалы аспекта',
}

export function CatalogView({ journey, scores, diary, onDiaryChange }: Props) {
  const [aspect, setAspect] = useState<AspectKey>(CONTENT_CATALOG[0].aspect)
  const [kind, setKind] = useState<CatalogKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const group = CONTENT_CATALOG.find(item => item.aspect === aspect) ?? CONTENT_CATALOG[0]
  const entries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru-RU')
    return group.entries.filter(entry => {
      if (kind !== 'all' && entry.kind !== kind) return false
      return !needle || entry.title.toLocaleLowerCase('ru-RU').includes(needle) || entry.sourceId.toLocaleLowerCase('ru-RU').includes(needle)
    })
  }, [group, kind, query])
  const selected = selectedId ? group.entries.find(entry => entry.id === selectedId) ?? null : null

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

  const grouped = entries.reduce<Partial<Record<CatalogKind, CatalogEntry[]>>>((acc, entry) => {
    ;(acc[entry.kind] ??= []).push(entry)
    return acc
  }, {})

  return (
    <div className={styles.catalog} data-testid="content-catalog">
      <header className={styles.heading}>
        <div>
          <p className={styles.kicker}>Свободное чтение</p>
          <h2>Каталог учебных материалов</h2>
          <p>Просмотр материалов не начисляет XP и не изменяет прохождение.</p>
        </div>
        <span className={styles.total}>{group.entries.length} материалов</span>
      </header>

      <nav className={styles.aspects} aria-label="Аспекты каталога">
        {CONTENT_CATALOG.map(item => (
          <button
            key={item.aspect}
            type="button"
            aria-pressed={aspect === item.aspect}
            onClick={() => { setAspect(item.aspect); setSelectedId(null) }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.filters}>
        <label>
          <span>Класс материала</span>
          <select value={kind} onChange={event => setKind(event.target.value as CatalogKind | 'all')}>
            <option value="all">Все классы</option>
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Поиск</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название или ID" />
        </label>
      </div>

      <p className={styles.resultCount} role="status">Найдено: {entries.length}</p>
      {entries.length === 0 && <p className={styles.empty}>Материалов по заданному фильтру нет.</p>}
      {Object.entries(grouped).map(([entryKind, kindEntries]) => (
        <section key={entryKind} className={styles.group} data-material-kind={entryKind}>
          <h3>{KIND_LABELS[entryKind as CatalogKind]} <span>{kindEntries?.length ?? 0}</span></h3>
          <ul>
            {(kindEntries ?? []).map(entry => (
              <li key={entry.id}>
                <button type="button" onClick={() => setSelectedId(entry.id)} data-material-id={entry.id}>
                  <span>{entry.title}</span>
                  <small>{entry.level == null ? 'общий материал' : `уровень ${entry.level}`} · {entry.sourceId}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
