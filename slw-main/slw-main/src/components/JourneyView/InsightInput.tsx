import { useState } from 'react'
import type { CSSProperties } from 'react'
import styles from './JourneyView.module.css'

/**
 * InsightInput — общий компонент «✎ Записать инсайт».
 * До раскрытия — кнопка-плашка. После клика — textarea + Сохранить/Отмена.
 *
 * Используется на карточках уровней SkillDetail и SkillTraits.
 */

type Props = {
  onSave: (text: string) => void
  placeholder?: string
  accent?: string
}

// CSS custom property `--accent` used inline for theming.
type AccentStyle = CSSProperties & { '--accent'?: string }

export default function InsightInput({ onSave, placeholder = 'Что заметил, что хочешь сохранить?', accent }: Props) {
  const [expanded, setExpanded] = useState<boolean>(false)
  const [text, setText] = useState<string>('')
  const canSave = text.trim().length > 0

  const accentStyle: AccentStyle | undefined = accent ? { '--accent': accent } : undefined

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.insightInputBtn}
        onClick={() => setExpanded(true)}
        style={accentStyle}
      >
        ✎ Записать инсайт
      </button>
    )
  }

  return (
    <div className={styles.insightInputBox} style={accentStyle}>
      <textarea
        className={styles.insightInputTextarea}
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
      />
      <div className={styles.insightInputActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={() => { setExpanded(false); setText('') }}
        >
          Отмена
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return
            onSave(text.trim())
            setText('')
            setExpanded(false)
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  )
}
