import { useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import styles from './DiaryView.module.css'

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
      text: text.trim()
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
      <div className={styles.title}>{t.diary.title}</div>
      
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
          <button onClick={handleAdd} className={styles.saveButton}>
            {t.diary.save}
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        {[['all', t.diary.filterAll], ['general', t.diary.general], ...ASPECT_KEYS.map(k => [k, k])].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`${styles.filterButton} ${filter === value ? styles.active : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.entries}>
        {filteredDiary.map(entry => (
          <div 
            key={entry.id} 
            className={styles.entry}
            style={{ 
              borderColor: entry.aspect === 'general' ? '#1a1a2e' : `${ASPECT_COLORS[entry.aspect]}33` 
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
                <span className={styles.entryDate}>{entry.date}</span>
              </div>
              <button 
                onClick={() => handleDelete(entry.id)}
                className={styles.deleteButton}
              >
                ×
              </button>
            </div>
            <div className={styles.entryText}>{entry.text}</div>
          </div>
        ))}
        
        {filteredDiary.length === 0 && (
          <div className={styles.noEntries}>{t.diary.noEntries}</div>
        )}
      </div>
    </div>
  )
}
