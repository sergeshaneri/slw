import { useState } from 'react'
import styles from './JourneyView.module.css'

/**
 * InsightInput — общий компонент «✎ Записать инсайт».
 * До раскрытия — кнопка-плашка. После клика — textarea + Сохранить/Отмена.
 *
 * Используется на карточках уровней SkillDetail и SkillTraits.
 *
 * Props:
 *   onSave: (text) => void
 *   placeholder?: string  — подсказка в textarea
 *   accent?: string       — цвет акцента (передаётся как --accent CSS-var)
 */
export default function InsightInput({ onSave, placeholder = 'Что заметил, что хочешь сохранить?', accent }) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const canSave = text.trim().length > 0

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.insightInputBtn}
        onClick={() => setExpanded(true)}
        style={accent ? { '--accent': accent } : undefined}
      >
        ✎ Записать инсайт
      </button>
    )
  }

  return (
    <div className={styles.insightInputBox} style={accent ? { '--accent': accent } : undefined}>
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
