import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

// ConfirmDialog — общий модал подтверждения для деструктивных действий
// (удалить, сбросить, заплатить).
//
// Используется не напрямую, а через хук useConfirm() из ConfirmProvider —
// тот возвращает Promise<boolean>. См. ConfirmProvider.tsx.
//
// Особенности:
//   • ESC закрывает (cancel).
//   • Клик по backdrop закрывает (cancel).
//   • autoFocus на confirm-кнопку (или на typed-input, если задан).
//   • Если typedConfirmation задан — кнопка confirm disabled до совпадения.
//   • role="dialog" + aria-modal + aria-labelledby для скринридеров.
//   • safe-area-inset-* на overlay — модалка не залезает под вырез/home-индикатор.

export type ConfirmDialogProps = {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /**
   * Если задано — рядом с подсказкой появится input, и кнопка «Подтвердить»
   * будет disabled пока введённый текст не совпадёт (case-insensitive trimmed).
   * Используем для самых деструктивных операций: сброс всего прогресса,
   * удаление аккаунта.
   */
  typedConfirmation?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  typedConfirmation,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState<string>('')
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)
  const typedInputRef = useRef<HTMLInputElement | null>(null)

  // Сбрасываем typed при каждом новом открытии — иначе остаток от прошлой
  // confirm-сессии будет «висеть».
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  // Фокус: на typed-input если есть, иначе на confirm-кнопку. Делаем после
  // открытия в setTimeout, чтобы анимация slideUp не съела фокус.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (typedConfirmation) typedInputRef.current?.focus()
      else confirmBtnRef.current?.focus()
    }, 60)
    return () => clearTimeout(t)
  }, [open, typedConfirmation])

  // ESC = cancel. Только когда модал открыт, чтобы не глушить другие хоткеи.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const canConfirm = !typedConfirmation
    || typed.trim().toLowerCase() === typedConfirmation.trim().toLowerCase()

  const titleId = 'confirm-dialog-title'

  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className={`${styles.modal} ${danger ? styles.modalDanger : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Клик внутри модала не должен пробрасываться на overlay (cancel).
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>{title}</h2>

        {body && (
          <div className={styles.body}>{body}</div>
        )}

        {typedConfirmation && (
          <>
            <div className={styles.typedLabel}>
              Чтобы подтвердить, введи слово <code>{typedConfirmation}</code>
            </div>
            <input
              ref={typedInputRef}
              type="text"
              className={`${styles.typedInput} ${danger ? styles.typedInputDanger : ''}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) {
                  e.preventDefault()
                  onConfirm()
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnCancel}`}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`${styles.btn} ${danger ? styles.btnConfirmDanger : styles.btnConfirm}`}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
