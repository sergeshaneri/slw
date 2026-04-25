import styles from './JourneyView.module.css'

export default function ScriptButtons({ script, onAction }) {
  const act = (a) => onAction(a, script.id)
  switch (script.type) {
    case 'theory':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act('next')}>Далее</button>
        </div>
      )
    case 'question':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('answer_number')}>Ответить (1–10)</button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => act('next')}>Напомнить позже</button>
        </div>
      )
    case 'exercise':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('complete_exercise')}>Выполнил сейчас</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act('done')}>Взял задание</button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => act('next')}>Позже</button>
        </div>
      )
    case 'word':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act('next')}>Подумал об этом</button>
        </div>
      )
    case 'reflection':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('answer_text')}>Ответить</button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => act('skip')}>Пропустить</button>
        </div>
      )
    default:
      return null
  }
}
