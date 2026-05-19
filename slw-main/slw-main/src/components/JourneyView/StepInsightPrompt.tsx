import { useEffect, useRef, useState } from 'react'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import styles from './JourneyView.module.css'

/**
 * Обязательный insight после T/S/R/U-шага. Юзер не может двинуться дальше
 * пока не запишет хоть какую-то рефлексию. Это гарантирует «след» по
 * каждому пройденному шагу в дневнике.
 *
 * Layout (после редизайна 2026-05):
 *   • Тонкий eyebrow сверху — даёт контекст «это идёт в дневник», 11px.
 *   • Textarea как у обычного чат-инпута (rounded, min-height 44px),
 *     auto-grow до 110px по мере ввода.
 *   • Круглая кнопка ↑ справа — единственный CTA, активируется когда
 *     набрано ≥minLength символов. Раньше была full-width «Сохранить и
 *     дальше →» занимавшая ~44px высоты + label + textarea + хинт-counter
 *     суммарно ~180px. Теперь весь блок ~60-110px в зависимости от ввода.
 *   • Counter «ещё N» появляется только когда уже что-то набрано, но
 *     меньше минимума. В idle и valid-состоянии не виден.
 */

type Kind = 'theory' | 'word' | 'reflection' | 'exercise'

// Eyebrow — короткий контекстный лейбл сверху, заменяет старую большую
// надпись + placeholder + counter. «· в дневник» намекает на необратимость
// без панических предупреждений.
const KIND_EYEBROW: Record<Kind, string> = {
  theory:     'Инсайт по теории · попадёт в дневник',
  word:       'Слово дня · попадёт в дневник',
  reflection: 'Итог рефлексии · попадёт в дневник',
  exercise:   'Результат упражнения · попадёт в дневник',
}

// Placeholder — «как у коуча», работает вместо отдельной строки KIND_LABEL.
const KIND_PLACEHOLDER: Record<Kind, string> = {
  theory:     'Что задело? С чем согласен или нет?',
  word:       'Где сегодня встречалось это слово?',
  reflection: 'Запиши итог одной-двумя фразами…',
  exercise:   'Как прошло упражнение? Что заметил?',
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const trimmedLen = text.trim().length
  const canSubmit = trimmedLen >= minLength
  // Counter показываем ТОЛЬКО когда юзер уже начал писать, но ещё не дошёл
  // до минимума. Idle (text === '') и valid (≥minLength) — счётчик скрыт.
  const showCounter = trimmedLen > 0 && !canSubmit
  const remaining = Math.max(0, minLength - trimmedLen)

  // При появлении prompt'а сразу триггерим onFocus — для свёртывания топбара
  // на время ввода. autoFocus на textarea не всегда даёт focus-event
  // синхронно (особенно если фокусится из non-user-gesture).
  useEffect(() => {
    if (onFocus) onFocus()
    return () => { if (onBlur) onBlur() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-grow textarea: начинаем с 1 строки (~44px), растёт до max-height
  // 110px по мере ввода. Без этого textarea с rows={3} занимает ~80px
  // даже пустой.
  const adjustHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`
  }

  useEffect(() => { adjustHeight(textareaRef.current) }, [text])

  const eyebrow = (KIND_EYEBROW as Record<string, string>)[kind] ?? 'Инсайт · попадёт в дневник'
  const placeholder = (KIND_PLACEHOLDER as Record<string, string>)[kind] ?? 'Твоя мысль…'

  const submit = () => {
    if (!canSubmit) return
    onSubmit(text.trim())
  }

  return (
    <div className={styles.stepInsightArea}>
      <div className={styles.stepInsightEyebrow}>{eyebrow}</div>
      <div className={styles.stepInsightRow}>
        <textarea
          ref={textareaRef}
          className={`${styles.stepInsightInput} ${canSubmit ? styles.stepInsightInputValid : ''}`}
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={e => {
            if (shouldSendOnKeyDown(e, sendKeyMode) && canSubmit) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          rows={1}
          autoFocus
        />
        <button
          type="button"
          className={styles.sendBtn}
          disabled={!canSubmit}
          onClick={submit}
          aria-label="Сохранить и продолжить"
          title={canSubmit ? 'Сохранить и продолжить' : `Минимум ${minLength} символов`}
        >
          ↑
        </button>
      </div>
      {showCounter && (
        <div className={styles.stepInsightCounter}>
          ещё {remaining} {remaining === 1 ? 'символ' : remaining < 5 ? 'символа' : 'символов'}
        </div>
      )}
    </div>
  )
}
