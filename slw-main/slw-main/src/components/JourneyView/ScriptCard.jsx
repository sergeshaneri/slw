import styles from './JourneyView.module.css'

const TYPE_CONFIG = {
  theory:     { label: 'Теория',     glyph: '◇' },
  question:   { label: 'Вопрос',     glyph: '?' },
  exercise:   { label: 'Упражнение', glyph: '△' },
  word:       { label: 'Слово дня',  glyph: '✦' },
  reflection: { label: 'Рефлексия',  glyph: '◯' },
  survey:     { label: 'Анкета',     glyph: '⌛' }
}

export default function ScriptCard({ script }) {
  const cfg = TYPE_CONFIG[script.type] ?? { label: 'Шаг', glyph: '·' }
  return (
    <div className={`${styles.scriptCard} ${styles[`scriptType_${script.type}`] ?? ''}`}>
      <div className={styles.scriptHeader}>
        <span className={styles.scriptGlyph}>{cfg.glyph}</span>
        <span className={styles.scriptLabel}>{cfg.label}</span>
        <span className={styles.scriptId}>{script.id}</span>
      </div>
      <div className={styles.scriptTitle}>{script.title}</div>
      <div className={styles.scriptBody}>{script.text}</div>
      <div className={styles.scriptMeta}>
        <span>+{script.xp} XP</span>
        {script.stardust > 0 && <span>+{script.stardust} ✦</span>}
      </div>
    </div>
  )
}
