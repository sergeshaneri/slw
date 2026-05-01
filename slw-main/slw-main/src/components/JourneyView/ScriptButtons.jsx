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
    case 'question': {
      // Формат A: шкала 1–10 → числовой ввод (ползунок).
      //   Триггерится либо followUp-блоками, либо явным `scale: 1-10`.
      // Формат B: open-ended (ни того, ни другого) → текстовый ввод.
      // См. SCRIPT_GUIDELINES §4.2.
      const hasScale = !!script.followUp || !!script.scale
      return (
        <div className={styles.btnRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => act(hasScale ? 'answer_number' : 'answer_text')}
          >
            {hasScale ? 'Ответить (1–10)' : 'Ответить'}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => act('next')}>Напомнить позже</button>
        </div>
      )
    }
    case 'exercise':
      return (
        <div className={styles.btnRow}>
          {/* «Выполнил + записать» — после нажатия откроется поле для
              обязательного комментария. См. handleScriptAction. */}
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('complete_exercise')}>Выполнил + записать</button>
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
    case 'survey':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('start_survey')}>Начать анкету</button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => act('next')}>Позже</button>
        </div>
      )
    default:
      return null
  }
}
