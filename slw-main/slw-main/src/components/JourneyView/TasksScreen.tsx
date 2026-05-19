import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Script, ScriptType } from '@/types/script'
import type { PendingTask } from '@/types/journey'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import styles from './JourneyView.module.css'
import MarkdownLite from './MarkdownLite'

const TYPE_LABEL: Partial<Record<ScriptType, string>> = {
  exercise: 'Упражнение',
  question: 'Вопрос',
  theory: 'Теория',
  word: 'Слово дня',
  reflection: 'Рефлексия'
}

type Props = {
  tasks: PendingTask[]
  scripts: Script[]
  accent?: string
  onCompleteWithNote: (script: Script, note: string) => void
  onDelete: (scriptId: string) => void
  onBack: () => void
}

type Pair = { task: PendingTask; script: Script }

export default function TasksScreen({ tasks, scripts, accent, onCompleteWithNote, onDelete, onBack }: Props) {
  const items: Pair[] = tasks
    .map(t => ({ task: t, script: scripts.find(s => s.id === t.scriptId) }))
    .filter((x): x is Pair => !!x.script)

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

type AccentStyle = CSSProperties & { '--accent'?: string }

type ItemProps = {
  task: PendingTask
  script: Script
  accent?: string
  onCompleteWithNote: (script: Script, note: string) => void
  onDelete: (scriptId: string) => void
}

function TaskItem({ task, script, accent, onCompleteWithNote, onDelete }: ItemProps) {
  const [sendKeyMode] = useSendKeyMode()
  const [noteOpen, setNoteOpen] = useState<boolean>(false)
  const [noteText, setNoteText] = useState<string>('')

  const handleSaveWithNote = () => {
    if (!noteText.trim()) return
    onCompleteWithNote(script, noteText.trim())
    setNoteText('')
    setNoteOpen(false)
  }

  const accentStyle: AccentStyle | undefined = accent ? { '--accent': accent } : undefined

  const isTaken = task.status === 'taken'
  return (
    <li className={`${styles.taskItem} ${isTaken ? styles.taskItemTaken : ''}`}>
      <div className={styles.taskHead}>
        {/* Quest-маркер: активный квест («взято») — accent-цвет аспекта с
            лёгким свечением; отложенное — приглушённый бейдж. */}
        <span
          className={`${styles.taskQuest} ${isTaken ? styles.taskQuestTaken : styles.taskQuestDeferred}`}
          aria-hidden="true"
        >
          !
        </span>
        <span className={styles.taskKind}>{TYPE_LABEL[script.type] ?? 'Шаг'}</span>
        <span className={`${styles.taskStatus} ${isTaken ? styles.taskStatusTaken : styles.taskStatusDeferred}`}>
          {isTaken ? 'взято' : 'отложено'}
        </span>
      </div>
      <div className={styles.taskTitle}>{script.title}</div>
      <div className={styles.taskBody}><MarkdownLite text={script.text} /></div>

      {!noteOpen ? (
        <div className={styles.taskActions}>
          {/* Запись комментария обязательна — кнопка открывает форму
              с textarea, без записи закрыть нельзя (кроме «Отмена»). */}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => setNoteOpen(true)}
            style={accentStyle}
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
            onKeyDown={e => {
              if (shouldSendOnKeyDown(e, sendKeyMode) && noteText.trim()) {
                e.preventDefault()
                handleSaveWithNote()
              }
            }}
            placeholder="Что заметил во время выполнения, какие ощущения, инсайты…"
            autoFocus
          />
          <div className={styles.taskNoteActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSaveWithNote}
              disabled={!noteText.trim()}
              style={accentStyle}
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
