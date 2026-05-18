import { useState } from 'react'
import { downloadVaultZip, getToken } from '../../api/client'
import styles from './VaultSyncTab.module.css'

const BACKEND_URL: string = import.meta.env.VITE_API_URL ?? ''

/**
 * Sync-вкладка: экспорт vault'а ZIP-архивом + инструкция по импорту через
 * локальный скрипт `tools/vault_sync.py`.
 *
 * Импорт делается с компа (Python), сюда приходят данные. Поэтому в UI:
 *  - кнопка скачать ZIP (это экспорт)
 *  - инструкция как настроить импорт (показ токена + конфиг)
 *  - ссылка на репо со скриптом
 */
export default function VaultSyncTab() {
  const [downloading, setDownloading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenVisible, setTokenVisible] = useState<boolean>(false)
  const [tokenCopied, setTokenCopied] = useState<boolean>(false)

  const token = getToken()

  const handleDownload = async (): Promise<void> => {
    setDownloading(true)
    setError(null)
    try {
      await downloadVaultZip()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось скачать архив')
    } finally {
      setDownloading(false)
    }
  }

  const handleCopyToken = async (): Promise<void> => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    } catch {
      // fallback prompt
      window.prompt('Скопируй токен:', token)
    }
  }

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <div className={styles.sectionLabel}>📥 Экспорт vault'а</div>
        <p className={styles.muted}>
          Скачай весь свой контент (дневник, цели, отчёты, шаблон и правила
          категоризации) в формате SLW-Mine vault'а.
        </p>
        <p className={styles.muted}>
          Структура архива:
          <code className={styles.code}>
            diary/YYYY-MM-DD.md · goals/{'{aspect}'}.md ·
            analytics/*.md · templates/template.md ·
            skills/skb-coach-skill/learnings.md
          </code>
        </p>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Готовлю архив…' : '↓ Скачать ZIP-архив'}
        </button>
        {error && <div className={styles.error}>{error}</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>📤 Импорт из локального vault'а</div>
        <p className={styles.muted}>
          Импорт делается через Python-скрипт на компе. Он сканирует
          vault, парсит дневник на эмоции/тренировки и шлёт в БД.
        </p>

        <ol className={styles.steps}>
          <li>
            <strong>Скачай скрипт</strong> из репозитория:{' '}
            <code className={styles.codeInline}>tools/vault_sync.py</code>{' '}
            (плюс <code className={styles.codeInline}>tools/README.md</code>{' '}
            с инструкцией).
          </li>
          <li>
            <strong>Установи зависимости</strong>:{' '}
            <code className={styles.codeInline}>pip install requests</code>
          </li>
          <li>
            <strong>Создай файл</strong>{' '}
            <code className={styles.codeInline}>tools/.env</code>:
            <pre className={styles.envBlock}>{`SLW_BACKEND=${BACKEND_URL || 'https://slw-production.up.railway.app'}
SLW_TOKEN=<твой токен — кнопка ниже>
SLW_VAULT=/абсолютный/путь/к/SLW-Mine
SLW_YEAR=${new Date().getFullYear()}`}</pre>
          </li>
          <li>
            <strong>Запусти</strong>:
            <pre className={styles.envBlock}>{`python tools/vault_sync.py status         # проверка
python tools/vault_sync.py import         # vault → веб
python tools/vault_sync.py export         # веб → vault (опц.)`}</pre>
          </li>
        </ol>

        <div className={styles.tokenBlock}>
          <div className={styles.tokenLabel}>Твой JWT-токен:</div>
          <div className={styles.tokenRow}>
            <code className={styles.tokenValue}>
              {token
                ? (tokenVisible ? token : `${token.slice(0, 24)}…${token.slice(-8)}`)
                : '(не залогинен)'}
            </code>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setTokenVisible(v => !v)}
              disabled={!token}
            >
              {tokenVisible ? '🙈 скрыть' : '👁 показать'}
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={handleCopyToken}
              disabled={!token}
            >
              {tokenCopied ? '✓ скопировано' : '📋 копировать'}
            </button>
          </div>
          <div className={styles.muted}>
            Токен живёт ~30 дней. Если истёк — обнови этот файл новым
            значением (просто перелогинься в вебе и снова скопируй).
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>⚠ Что важно знать</div>
        <ul className={styles.notes}>
          <li>
            <strong>Идемпотентность.</strong> Повторный <code>import</code>{' '}
            не дублирует — сравнивается SHA1 контента. Меняй и гоняй
            хоть каждый день.
          </li>
          <li>
            <strong>Конфликты.</strong> Если на бэке появилась запись
            на ту же дату из веба, скрипт пишет ОБЕ версии в{' '}
            <code className={styles.codeInline}>vault/conflicts/</code>{' '}
            и пропускает дату. Разрешаешь руками.
          </li>
          <li>
            <strong>Что парсится в structured.</strong> Эмоции (таблицы 7 полей),
            тренировки (<code>- присед 3×10×60</code>), метаданные
            (энергия, сон, кофе). Всё остальное остаётся в raw text.
          </li>
        </ul>
      </section>
    </div>
  )
}
