import { useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import styles from './DiaryView.module.css'

const SOURCE_LABEL = {
  journey: 'из путешествия',
  'journey-question': 'вопрос путешествия',
  aspect: 'из аспекта',
  'aspect-item': 'к фрагменту'
}

export default function DiaryView({ diary, onDiaryChange, t }) {
  const [text, setText] = useState('')
  const [aspect, setAspect] = useState('general')
  const [filter, setFilter] = useState('all')

  const handleAdd = () => {
    if (!text.trim()) return
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('ru-RU'),
      ts: Date.now(),
      aspect,
      text: text.trim(),
      source: 'manual'
    }
    onDiaryChange([entry, ...diary])
    setText('')
  }

  const handleDelete = (id) => {
    onDiaryChange(diary.filter(e => e.id !== id))
  }

  const filteredDiary = diary.filter(e => filter === 'all' || e.aspect === filter)

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Дневник</span>
        <h1 className={styles.title}>{t.diary.title}</h1>
      </div>

      <div className={styles.newEntry}>
        <div className={styles.entryHeader}>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            className={styles.select}
          >
            <option value="general">{t.diary.general}</option>
            {ASPECT_KEYS.map(key => (
              <option key={key} value={key}>{key} · {ASPECT_DATA[key].name}</option>
            ))}
          </select>
          <div className={styles.date}>{new Date().toLocaleDateString('ru-RU')}</div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.diary.placeholder}
          className={styles.textarea}
        />

        <div className={styles.actions}>
          <button type="button" onClick={handleAdd} className={styles.saveButton}>
            {t.diary.save}
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        {[['all', t.diary.filterAll], ['general', t.diary.general], ...ASPECT_KEYS.map(k => [k, k])].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`${styles.filterButton} ${filter === value ? styles.active : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.entries}>
        {filteredDiary.map(entry => (
          <DiaryEntry key={entry.id} entry={entry} onDelete={() => handleDelete(entry.id)} />
        ))}

        {filteredDiary.length === 0 && (
          <div className={styles.noEntries}>{t.diary.noEntries}</div>
        )}
      </div>
    </div>
  )
}

function DiaryEntry({ entry, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasPrompt = !!(entry.promptTitle || entry.prompt)
  // Раскрываем, если в исходнике больше ~140 символов или несколько строк.
  const longPrompt = (entry.prompt?.length ?? 0) > 140 || (entry.prompt?.split('\n').length ?? 0) > 3

  return (
    <div
      className={styles.entry}
      style={{
        borderColor: entry.aspect === 'general' ? undefined : `${ASPECT_COLORS[entry.aspect]}33`
      }}
    >
      <div className={styles.entryTop}>
        <div className={styles.entryInfo}>
          {entry.aspect !== 'general' && (
            <span
              className={styles.entryAspect}
              style={{ color: ASPECT_COLORS[entry.aspect] }}
            >
              {entry.aspect}
            </span>
          )}
          {entry.source && entry.source !== 'manual' && (
            <span className={`${styles.entrySource} ${
              entry.source === 'journey' || entry.source === 'journey-question'
                ? styles.entrySourceJourney
                : styles.entrySourceAspect
            }`}>
              {SOURCE_LABEL[entry.source] ?? entry.source}
            </span>
          )}
          <span className={styles.entryDate}>{entry.date}</span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className={styles.deleteButton}
          aria-label="Удалить"
        >
          ×
        </button>
      </div>

      {hasPrompt && (
        <div className={`${styles.entryPrompt} ${expanded ? styles.entryPromptOpen : ''}`}>
          {entry.promptTitle && (
            <div className={styles.entryPromptTitle}>{entry.promptTitle}</div>
          )}
          {entry.prompt && (
            <div className={styles.entryPromptText}>{entry.prompt}</div>
          )}
          {longPrompt && (
            <button
              type="button"
              className={styles.entryPromptToggle}
              onClick={() => setExpanded(v => !v)}
              aria-expanded={expanded}
            >
              {expanded ? '▲ свернуть' : '▼ показать целиком'}
            </button>
          )}
        </div>
      )}

      <div className={styles.entryText}>{entry.text}</div>
    </div>
  )
}
