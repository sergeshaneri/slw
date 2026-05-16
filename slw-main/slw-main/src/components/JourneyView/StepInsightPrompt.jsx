import { useState } from 'react'
import { isTMA } from '../../tma'
import { useMainButton } from '../../tma/hooks'
import styles from './JourneyView.module.css'

/**
 * Обязательный insight после T/S/R-шага. Юзер не может двинуться дальше
 * пока не запишет хоть какую-то рефлексию. Это гарантирует «след» по
 * каждому пройденному шагу в дневнике.
 *
 * Props:
 *   - kind: 'theory' | 'word' | 'reflection'
 *   - onSubmit(text) — сохранить инсайт и идти дальше
 *   - minLength=10 — минимум символов для разблокировки кнопки
 */
const KIND_HINT = {
  theory:     'Что задело? Что узнал нового? С чем согласен или нет?',
  word:       'Где сегодня встречалось это слово? Какие свои примеры?',
  reflection: 'Запиши итог дня одной-двумя фразами.',
  exercise:   'Как прошло упражнение? Что заметил?',
}

const KIND_LABEL = {
  theory:     '✎ Запиши свой инсайт по теории',
  word:       '✎ Запиши свой контекст слова дня',
  reflection: '✎ Запиши итог',
  exercise:   '✎ Запиши результат упражнения',
}

export default function StepInsightPrompt({ kind, onSubmit, minLength = 10 }) {
  const [text, setText] = useState('')
  const canSubmit = text.trim().length >= minLength

  // Telegram MainButton: заменяет «Сохранить и дальше →» в TMA.
  useMainButton({
    text: 'Сохранить и дальше →',
    onClick: () => canSubmit && onSubmit(text.trim()),
    disabled: !canSubmit,
  })

  return (
    <div className={styles.stepInsightArea}>
      <div className={styles.stepInsightLabel}>
        {KIND_LABEL[kind] || '✎ Запиши свой инсайт'}
      </div>
      <textarea
        className={styles.stepInsightInput}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={KIND_HINT[kind] || 'Твоя мысль…'}
        rows={3}
        autoFocus
      />
      <div className={styles.stepInsightHint}>
        Минимум {minLength} символов · сейчас {text.trim().length}
      </div>
      {!isTMA && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
          disabled={!canSubmit}
          onClick={() => onSubmit(text.trim())}
        >
          Сохранить и дальше →
        </button>
      )}
    </div>
  )
}
