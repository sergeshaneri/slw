import { useEffect, useState } from 'react'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import styles from './JourneyView.module.css'

/**
 * Обязательный insight после T/S/R-шага. Юзер не может двинуться дальше
 * пока не запишет хоть какую-то рефлексию. Это гарантирует «след» по
 * каждому пройденному шагу в дневнике.
 */

type Kind = 'theory' | 'word' | 'reflection' | 'exercise'

const KIND_HINT: Record<Kind, string> = {
  theory:     'Что задело? Что узнал нового? С чем согласен или нет?',
  word:       'Где сегодня встречалось это слово? Какие свои примеры?',
  reflection: 'Запиши итог дня одной-двумя фразами.',
  exercise:   'Как прошло упражнение? Что заметил?',
}

const KIND_LABEL: Record<Kind, string> = {
  theory:     '✎ Запиши свой инсайт по теории',
  word:       '✎ Запиши свой контекст слова дня',
  reflection: '✎ Запиши итог',
  exercise:   '✎ Запиши результат упражнения',
}

type Props = {
  kind: Kind | string
  onSubmit: (text: string) => void
  minLength?: number
  onFocus?: () => void
  onBlur?: () => void
}

export default function StepInsightPrompt({ kind, onSubmit, minLength = 10, onFocus, onBlur }: Props) {
  const [text, setText] = useState<string>('')
  const [sendKeyMode] = useSendKeyMode()
  const canSubmit = text.trim().length >= minLength

  // При появлении prompt'а сразу триггерим onFocus (как-будто фокус на textarea).
  // autoFocus на textarea не всегда генерит focus-event синхронно — поэтому
  // делаем явный вызов через useEffect. Используется в Chat.jsx чтобы
  // свернуть топбар на время ввода инсайта.
  useEffect(() => {
    if (onFocus) onFocus()
    return () => { if (onBlur) onBlur() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kindLabel = (KIND_LABEL as Record<string, string>)[kind] ?? '✎ Запиши свой инсайт'
  const kindHint = (KIND_HINT as Record<string, string>)[kind] ?? 'Твоя мысль…'

  return (
    <div className={styles.stepInsightArea}>
      <div className={styles.stepInsightLabel}>
        {kindLabel}
      </div>
      <textarea
        className={styles.stepInsightInput}
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={e => {
          if (shouldSendOnKeyDown(e, sendKeyMode) && canSubmit) {
            e.preventDefault()
            onSubmit(text.trim())
          }
        }}
        placeholder={kindHint}
        rows={3}
        autoFocus
      />
      <div className={styles.stepInsightHint}>
        Минимум {minLength} символов · сейчас {text.trim().length}
      </div>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
        disabled={!canSubmit}
        onClick={() => onSubmit(text.trim())}
      >
        Сохранить и дальше →
      </button>
    </div>
  )
}
