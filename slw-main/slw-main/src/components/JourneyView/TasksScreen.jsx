import styles from './JourneyView.module.css'

const TYPE_LABEL = {
  exercise: 'Упражнение',
  question: 'Вопрос',
  theory: 'Теория',
  word: 'Слово дня',
  reflection: 'Рефлексия'
}

export default function TasksScreen({ tasks, scripts, accent, onComplete, onDelete, onBack }) {
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
              <li key={task.id} className={styles.taskItem}>
                <div className={styles.taskHead}>
                  <span className={styles.taskKind}>{TYPE_LABEL[script.type] ?? 'Шаг'}</span>
                  <span className={`${styles.taskStatus} ${task.status === 'taken' ? styles.taskStatusTaken : styles.taskStatusDeferred}`}>
                    {task.status === 'taken' ? 'взято' : 'отложено'}
                  </span>
                </div>
                <div className={styles.taskTitle}>{script.title}</div>
                <div className={styles.taskBody}>{script.text}</div>
                <div className={styles.taskActions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnAccent}`}
                    onClick={() => onComplete(script)}
                    style={{ '--accent': accent }}
                  >
                    Выполнено
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => onDelete(script.id)}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
