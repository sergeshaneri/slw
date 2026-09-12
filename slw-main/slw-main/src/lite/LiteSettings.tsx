import { useRef, useState, type ChangeEvent } from 'react'
import type { LiteData, LiteSnapshot } from '@/types/storage'
import { parseLiteSnapshot, serializeLiteSnapshot, LiteValidationError } from '@/utils/liteTransfer'
import type { LiteSession } from './useLiteSession'
import styles from './LiteSettings.module.css'

type PendingAction =
  | { kind: 'import'; snapshot: LiteSnapshot }
  | { kind: 'reset' }
  | null

function download(name: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function importSummary(data: LiteData): string {
  const progressed = Object.values(data.journey.aspects).filter((aspect) =>
    aspect && (aspect.currentLevel > 0 || aspect.completedScripts.length > 0),
  ).length
  return `Аспектов с прогрессом: ${progressed}; записей дневника: ${data.diary.length}; результатов анкет: ${Object.keys(data.journey.skills).length}.`
}

export function LiteSettings({ session }: { session: LiteSession }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [message, setMessage] = useState<string | null>(null)
  const mode = session.data.preferences.sendKeyMode ?? 'enter'

  const chooseImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const snapshot = parseLiteSnapshot(await file.text())
      setPending({ kind: 'import', snapshot })
      setMessage(null)
    } catch (error) {
      const detail = error instanceof LiteValidationError ? error.message : 'Файл не удалось прочитать.'
      setPending(null)
      setMessage(`Импорт отклонён: ${detail}`)
    }
  }

  const exportCurrent = () => {
    try {
      download('slw-lite-export.json', serializeLiteSnapshot(session.exportSnapshot()))
      setMessage(null)
    } catch {
      setMessage('Экспорт не выполнен: текущие данные не прошли проверку.')
    }
  }

  const confirmPending = () => {
    if (!pending) return
    const result = pending.kind === 'import'
      ? session.replaceData(pending.snapshot.data)
      : session.resetData()
    if (result.ok) {
      setMessage(pending.kind === 'import' ? 'Импорт завершён и сохранён.' : 'Локальные данные сброшены.')
      setPending(null)
    } else {
      setMessage(result.message)
    }
  }

  const statusText = session.status === 'durable'
    ? 'Сохранено в этом браузере'
    : session.status === 'conflict'
      ? 'Обнаружен конфликт локальных данных'
      : 'Работа в памяти браузера'

  return (
    <section className={styles.panel} aria-labelledby="lite-settings-title" data-send-key-mode={mode}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Локальные данные</p>
          <h2 id="lite-settings-title">Настройки и перенос</h2>
        </div>
        <span className={styles.status} data-session-status={session.status}>{statusText}</span>
      </div>

      {session.issue && <p className={styles.notice} role="alert">{session.issue.message}</p>}
      {message && <p className={styles.notice} role="status">{message}</p>}

      {session.status === 'conflict' && (
        <div className={styles.conflict} role="alert">
          <p>Данные в хранилище изменились. Экспортируйте текущую память перед выбором внешней версии, если она нужна.</p>
          <button type="button" onClick={session.acceptExternal}>Принять внешние данные</button>
        </div>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Отправка сообщения</legend>
        <label>
          <input
            type="radio"
            name="send-key-mode"
            value="enter"
            checked={mode === 'enter'}
            onChange={() => session.updatePreferences((current) => ({ ...current, sendKeyMode: 'enter' }))}
          />
          Enter
        </label>
        <label>
          <input
            type="radio"
            name="send-key-mode"
            value="ctrl+enter"
            checked={mode === 'ctrl+enter'}
            onChange={() => session.updatePreferences((current) => ({ ...current, sendKeyMode: 'ctrl+enter' }))}
          />
          Ctrl/Cmd + Enter
        </label>
      </fieldset>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={exportCurrent}
        >
          Экспортировать текущие данные
        </button>
        <button type="button" onClick={() => inputRef.current?.click()}>Импортировать файл</button>
        <input
          ref={inputRef}
          className={styles.file}
          type="file"
          accept=".json,application/json"
          onChange={(event) => void chooseImport(event)}
          aria-label="Файл импорта"
        />
        <button type="button" className={styles.danger} onClick={() => { setPending({ kind: 'reset' }); setMessage(null) }}>
          Сбросить локальные данные
        </button>
        {session.corruptRaw !== null && (
          <button type="button" onClick={() => download('slw-lite-corrupt.txt', session.corruptRaw ?? '', 'text/plain')}>
            Скачать повреждённую запись
          </button>
        )}
      </div>

      {pending && (
        <div className={styles.confirm} role="region" aria-labelledby="lite-confirm-title">
          <h3 id="lite-confirm-title">{pending.kind === 'import' ? 'Подтвердить импорт' : 'Подтвердить сброс'}</h3>
          <p>
            {pending.kind === 'import'
              ? 'Файл полностью заменит текущие локальные данные. ' + importSummary(pending.snapshot.data)
              : 'Текущие путешествие, результаты, дневник и настройки будут заменены начальными значениями.'}
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={confirmPending}>Подтвердить замену</button>
            <button type="button" onClick={() => setPending(null)}>Отмена</button>
          </div>
        </div>
      )}
    </section>
  )
}
