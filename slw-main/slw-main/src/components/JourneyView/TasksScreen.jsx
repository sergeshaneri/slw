import { useState } from 'react'
import styles from './JourneyView.module.css'

const TYPE_LABEL = {
  exercise: 'Упражнение',
  question: 'Вопрос',
  theory: 'Теория',
  word: 'Слово дня',
  reflection: 'Рефлексия'
}

export default function TasksScreen({ tasks, scripts, accent, onCompleteWithNote, onDelete, onBack }) {
  const items = tasks
    .map(t => ({ task: t, script: scripts.find(s => s.id === t.scriptId) }))
    .filter(x => x.script)

  return (
    <>
      <div className={styles.topbar}>
        <button type="button" className={styles.avatar} onClick={onBack} aria-label="Назад">
          <span className={styles.avatarGlyph}>←</span>
        </button>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>Активные задания</div>
          <div className={styles.topbarSub}>{items.length === 0 ? 'Список пуст' : `${items.length} в работе`}</div>
        </div>
      </div>

      <div className={styles.profileScroll}>
        {items.length === 0 ? (
          <div className={styles.tasksEmpty}>
            <p>Сейчас активных заданий нет.</p>
            <p className={styles.tasksEmptyHint}>Когда возьмёшь задание или отложишь вопрос — оно появится здесь.</p>
          </div>
        ) : (
          <ul className={styles.tasksList}>
            {items.map(({ task, script }) => (
              <TaskItem
                key={task.id}
                task={task}
                script={script}
                accent={accent}
                onCompleteWithNote={onCompleteWithNote}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function TaskItem({ task, script, accent, onCompleteWithNote, onDelete }) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')

  const handleSaveWithNote = () => {
    if (!noteText.trim()) return
    onCompleteWithNote(script, noteText.trim())
    setNoteText('')
    setNoteOpen(false)
  }

  return (
    <li className={styles.taskItem}>
      <div className={styles.taskHead}>
        <span className={styles.taskKind}>{TYPE_LABEL[script.type] ?? 'Шаг'}</span>
        <span className={`${styles.taskStatus} ${task.status === 'taken' ? styles.taskStatusTaken : styles.taskStatusDeferred}`}>
          {task.status === 'taken' ? 'взято' : 'отложено'}
        </span>
      </div>
      <div className={styles.taskTitle}>{script.title}</div>
      <div className={styles.taskBody}>{script.text}</div>

      {!noteOpen ? (
        <div className={styles.taskActions}>
          {/* Запись комментария обязательна — кнопка открывает форму
              с textarea, без записи закрыть нельзя (кроме «Отмена»). */}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => setNoteOpen(true)}
            style={{ '--accent': accent }}
          >
            Выполнить + записать
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => onDelete(script.id)}
          >
            Удалить
          </button>
        </div>
      ) : (
        <div className={styles.taskNoteForm}>
          <textarea
            className={styles.taskNoteTextarea}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Что заметил во время выполнения, какие ощущения, инсайты…"
            autoFocus
          />
          <div className={styles.taskNoteActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSaveWithNote}
              disabled={!noteText.trim()}
              style={{ '--accent': accent }}
            >
              Сохранить и закрыть
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => { setNoteOpen(false); setNoteText('') }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
