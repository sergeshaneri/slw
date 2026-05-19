import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import ConfirmDialog from './ConfirmDialog'
import type { ConfirmDialogProps } from './ConfirmDialog'

// ConfirmProvider + useConfirm — императивный API для модал-подтверждения.
//
// Использование в коде:
//
//   const confirm = useConfirm()
//   const ok = await confirm({
//     title: 'Удалить запись?',
//     body: 'Восстановить не получится.',
//     confirmLabel: 'Удалить',
//     danger: true,
//   })
//   if (!ok) return
//   // ... actuallyDelete()
//
// Под капотом — Promise. Провайдер хранит текущий request и резолвит его
// при клике на confirm/cancel. Параллельные вызовы не поддерживаются (новый
// confirm() поверх старого — старый отменится false).

type ConfirmOpts = Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'>
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

type Request = {
  opts: ConfirmOpts
  resolve: (v: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null)

  const confirm: ConfirmFn = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>(resolve => {
      // Если уже что-то висит — отменяем предыдущее (resolve(false)),
      // чтобы код, ждавший его, корректно завершился.
      setRequest(prev => {
        prev?.resolve(false)
        return { opts, resolve }
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setRequest(prev => {
      prev?.resolve(true)
      return null
    })
  }, [])

  const handleCancel = useCallback(() => {
    setRequest(prev => {
      prev?.resolve(false)
      return null
    })
  }, [])

  // Когда нет открытого confirm — пробрасываем нейтральные значения в Dialog
  // (он сам не отрендерится из-за open=false).
  const opts = request?.opts

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!request}
        title={opts?.title ?? ''}
        body={opts?.body}
        confirmLabel={opts?.confirmLabel}
        cancelLabel={opts?.cancelLabel}
        danger={opts?.danger}
        typedConfirmation={opts?.typedConfirmation}
        infoOnly={opts?.infoOnly}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}

/**
 * Получить функцию confirm() для запуска модала подтверждения.
 * Должно быть внутри <ConfirmProvider> (стоит в App.tsx).
 */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext)
  if (!fn) {
    throw new Error('useConfirm must be used within <ConfirmProvider>. Check App.tsx.')
  }
  return fn
}
