import { useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import { SURVEY_BLOCKS } from '../../data/journey/skills'
import SearchView from '../SearchView/SearchView'
import DailyReview from './DailyReview'
import Hint from '../Onboarding/Hint'
import EmotionsTab from './EmotionsTab'
import TrainingsTab from './TrainingsTab'
import AnalyticsTab from './AnalyticsTab'
import VaultSyncTab from './VaultSyncTab'
import styles from './DiaryView.module.css'

const SOURCE_LABEL = {
  journey: 'из путешествия',
  'journey-question': 'вопрос путешествия',
  'journey-survey': 'анкета навыка',
  aspect: 'из аспекта',
  'aspect-item': 'к фрагменту',
  coach: 'от ИИ-коуча',
}

export default function DiaryView({ diary, onDiaryChange, t, onOpenProfile, user }) {
  const [text, setText] = useState('')
  const [aspect, setAspect] = useState('general')
  const [filter, setFilter] = useState('all')
  // Вкладки внутри страницы: «entries» (записи) / «search» (поиск).
  // Поиск работает только для залогиненных юзеров (запрос идёт на бэк).
  const [mode, setMode] = useState('entries')

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
        {user && (
          <div className={styles.tabRow}>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'entries' ? styles.tabBtnActive : ''}`}
              onClick={() => setMode('entries')}
            >
              Записи
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'today' ? styles.tabBtnActive : ''}`}
              onClick={() => setMode('today')}
            >
              📅 Сегодня
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'search' ? styles.tabBtnActive : ''}`}
              onClick={() => setMode('search')}
            >
              🔍 Поиск
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'emotions' ? styles.tabBtnActive : ''}`}
              onClick={() => setMode('emotions')}
            >
              💗 Эмоции
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'trainings' ? styles.tabBtnActive : ''}`}
              onClick={() => setMode('trainings')}
            >
              💪 Тренировки
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'analytics' ? styles.tabBtnActive : ''}`}
              onClick={() => setMode('analytics')}
            >
              📊 Отчёты
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'sync' ? styles.tabBtnActive : ''}`}
              onClick={() => setMode('sync')}
            >
              🔗 Sync
            </button>
          </div>
        )}
      </div>

      {mode === 'emotions' && user && <EmotionsTab />}
      {mode === 'trainings' && user && <TrainingsTab />}
      {mode === 'analytics' && user && <AnalyticsTab />}
      {mode === 'sync' && user && <VaultSyncTab />}

      {mode === 'today' && user && (
        <>
          <Hint id="daily-review-intro" user={user}>
            Один экран — весь день. Все блоки опциональны. Привычки в самом низу.
          </Hint>
          <DailyReview diary={diary} onDiaryChange={onDiaryChange} />
        </>
      )}

      {mode === 'search' && user && (
        <SearchView onOpenProfile={onOpenProfile} />
      )}

      {mode === 'entries' && (
      <>
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
      </>
      )}
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
              entry.source === 'journey' || entry.source === 'journey-question' || entry.source === 'journey-survey'
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

      {entry.survey && <SurveyDetails survey={entry.survey} />}
    </div>
  )
}

// Раскрывающийся блок с подробной разбивкой ответов на анкету.
// Показывает все 15 утверждений со средней по каждому блоку и общей.
function SurveyDetails({ survey }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.surveyDetails}>
      <button
        type="button"
        className={styles.surveyDetailsToggle}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        {open ? '▲ свернуть ответы' : `▼ показать все 15 ответов`}
      </button>
      {open && (
        <div className={styles.surveyDetailsBody}>
          {SURVEY_BLOCKS.filter(b => (survey.blocks?.[b.id] ?? []).length > 0).map(block => {
            const statements = survey.blocks[block.id] ?? []
            const answers = survey.answers?.[block.id] ?? []
            const blockAvg = survey.blockAvgs?.[block.id]
            return (
              <div key={block.id} className={styles.surveyDetailsBlock}>
                <div className={styles.surveyDetailsBlockHead}>
                  <span className={styles.surveyDetailsBlockName}>{block.name}</span>
                  {blockAvg != null && (
                    <span className={styles.surveyDetailsBlockAvg}>
                      ср. {blockAvg.toFixed(1)}
                    </span>
                  )}
                </div>
                <ol className={styles.surveyDetailsList}>
                  {statements.map((stmt, i) => (
                    <li key={i}>
                      <span className={styles.surveyDetailsStatement}>{stmt}</span>
                      <span className={styles.surveyDetailsAnswer}>
                        {Number.isFinite(answers[i]) ? `${answers[i]}/10` : '—'}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
          {Number.isFinite(survey.skillAvg) && (
            <div className={styles.surveyDetailsTotal}>
              Средняя по навыку: <strong>{survey.skillAvg.toFixed(1)}/10</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
