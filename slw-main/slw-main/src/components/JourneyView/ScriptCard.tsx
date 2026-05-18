import type { Script, ScriptType } from '@/types/script'
import styles from './JourneyView.module.css'
import MarkdownLite from './MarkdownLite'

type TypeConfigEntry = { label: string; glyph: string }

const TYPE_CONFIG: Record<ScriptType, TypeConfigEntry> = {
  theory:     { label: 'Теория',     glyph: '◇' },
  question:   { label: 'Вопрос',     glyph: '?' },
  exercise:   { label: 'Упражнение', glyph: '△' },
  word:       { label: 'Слово дня',  glyph: '✦' },
  reflection: { label: 'Рефлексия',  glyph: '◯' },
  survey:     { label: 'Анкета',     glyph: '⌛' }
}

type Props = {
  script: Script
}

export default function ScriptCard({ script }: Props) {
  const cfg = (TYPE_CONFIG as Record<string, TypeConfigEntry>)[script.type] ?? { label: 'Шаг', glyph: '·' }
  const typeClass = (styles as Record<string, string>)[`scriptType_${script.type}`] ?? ''
  return (
    <div className={`${styles.scriptCard} ${typeClass}`}>
      <div className={styles.scriptHeader}>
        <span className={styles.scriptGlyph}>{cfg.glyph}</span>
        <span className={styles.scriptLabel}>{cfg.label}</span>

      </div>
      <div className={styles.scriptTitle}>{script.title}</div>
      <div className={styles.scriptBody}>
        <MarkdownLite text={script.text} />
      </div>
      <div className={styles.scriptMeta}>
        <span>+{script.xp} XP</span>
        {script.stardust !== undefined && script.stardust > 0 && <span>+{script.stardust} ✦</span>}
      </div>
    </div>
  )
}
