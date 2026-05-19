import { useCallback, useEffect, useState } from 'react'
import {
  adminNotifyBroadcast,
  adminNotifyClearCooldowns,
  adminNotifyGetConfig,
  adminNotifyGetLog,
  adminNotifyPatchConfig,
  adminNotifyRunNow,
  adminNotifyTest,
} from '../../api/client'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import styles from './AdminView.module.css'

type BroadcastTarget = 'tg_linked' | 'recent_30d' | 'all'

const TARGETS: ReadonlyArray<{ id: BroadcastTarget; label: string }> = [
  { id: 'tg_linked',  label: 'TG залинкован + включены уведомления' },
  { id: 'recent_30d', label: 'Активные за 30 дней + включены' },
  { id: 'all',        label: 'Все с TG (даже отключившие)' },
]

type NotifyType = 'pending_task_reminder' | 'practice_check' | 'continue_journey'

const TYPE_LABELS: Record<NotifyType, string> = {
  pending_task_reminder: 'Напоминание про взятое упражнение',
  practice_check:        'Проверка регулярной практики',
  continue_journey:      'Продолжить путешествие',
}

// Backend has no response_model for /api/admin/notify/config. Captures the
// fields read by JSX (singleton notification_settings + per-type flags via
// `type_<key>` index keys).
// NOTE(ts): pending backend response_model for notify/config.
type NotifyConfig = {
  enabled: boolean
  notify_hour_utc: number
  // type_pending_task_reminder, type_practice_check, type_continue_journey, ...
  [key: string]: unknown
}

type RunNowResp = {
  globally_disabled?: boolean
  sent?: number
  skipped?: number
  errors?: number
}

type TestResp = {
  sent?: number
  of?: number
  error?: string
}

type BroadcastResp = {
  sent?: number
  errors?: number
}

type ClearCooldownsResp = {
  affected?: number
}

type LogEntry = {
  id: number | string
  sent_at?: string | null
  user_display_name?: string | null
  user_email?: string | null
  web_user_id?: number | string | null
  telegram_id?: number | string | null
  type?: string
  error?: string | null
  text?: string | null
}

type LogResp = {
  entries?: LogEntry[]
}

type ActionLogEntry = { ts: number; msg: string }

/**
 * Admin Panel → 🔔 Уведомления.
 * Полный контроль над TG-нотификациями:
 *   1. Конфиг: глобальный enable, час отправки, какие типы включены
 *   2. Действия: тест себе, запуск раунда сейчас, broadcast кастомного
 *      сообщения, сброс cooldown-ов
 *   3. Лог последних отправок
 */
export default function NotifyTab() {
  const [config, setConfig] = useState<NotifyConfig | null>(null)
  const [configBusy, setConfigBusy] = useState<boolean>(false)
  const [configErr, setConfigErr] = useState<string>('')

  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [logBusy, setLogBusy] = useState<boolean>(false)

  const [broadcastText, setBroadcastText] = useState<string>('')
  const [sendKeyMode] = useSendKeyMode()
  const [broadcastTarget, setBroadcastTarget] = useState<BroadcastTarget>('tg_linked')

  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const pushAction = useCallback((msg: string) => {
    setActionLog(prev => [{ ts: Date.now(), msg }, ...prev].slice(0, 10))
  }, [])

  const loadConfig = useCallback(async () => {
    setConfigBusy(true)
    setConfigErr('')
    try {
      const data = await adminNotifyGetConfig() as NotifyConfig
      setConfig(data)
    } catch (e) {
      setConfigErr(e instanceof Error ? e.message : 'Не удалось')
    } finally {
      setConfigBusy(false)
    }
  }, [])

  const loadLog = useCallback(async () => {
    setLogBusy(true)
    try {
      const data = await adminNotifyGetLog({ limit: 100 }) as LogResp
      setLogEntries(data.entries ?? [])
    } catch (e) {
      pushAction(`Лог: ошибка ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLogBusy(false)
    }
  }, [pushAction])

  useEffect(() => {
    loadConfig()
    loadLog()
  }, [loadConfig, loadLog])

  const patchConfig = async (patch: Partial<NotifyConfig>) => {
    try {
      const updated = await adminNotifyPatchConfig(patch) as NotifyConfig
      setConfig(updated)
      pushAction('Конфиг сохранён')
    } catch (e) {
      pushAction(`Конфиг ошибка: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const runNow = async () => {
    if (!confirm('Запустить раунд рассылки сейчас? Будут отправлены уведомления всем подходящим юзерам.')) return
    try {
      const r = await adminNotifyRunNow() as RunNowResp
      if (r.globally_disabled) {
        pushAction('Не отправлено — глобально выключено')
      } else {
        pushAction(`Раунд: sent=${r.sent} skipped=${r.skipped} errors=${r.errors}`)
      }
      await loadLog()
    } catch (e) {
      pushAction(`run-now ошибка: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const sendTest = async () => {
    try {
      const r = await adminNotifyTest() as TestResp
      if (r.error) pushAction(`Тест ошибка: ${r.error}`)
      else pushAction(`Тест: отправлено ${r.sent} из ${r.of}`)
      await loadLog()
    } catch (e) {
      pushAction(`Тест ошибка: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const sendBroadcast = async () => {
    const text = broadcastText.trim()
    if (!text) {
      pushAction('Broadcast: введи текст')
      return
    }
    if (!confirm(`Отправить ВСЕМ юзерам (target: ${broadcastTarget})?\n\nТекст:\n${text}`)) return
    try {
      const r = await adminNotifyBroadcast({ text, target: broadcastTarget }) as BroadcastResp
      pushAction(`Broadcast: sent=${r.sent} errors=${r.errors}`)
      setBroadcastText('')
      await loadLog()
    } catch (e) {
      pushAction(`Broadcast ошибка: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const clearAllCooldowns = async () => {
    if (!confirm('Сбросить cooldown\'ы у ВСЕХ юзеров? После этого каждый снова может получить любой тип уведомления сегодня.')) return
    try {
      const r = await adminNotifyClearCooldowns({}) as ClearCooldownsResp
      pushAction(`Cooldowns сброшены: affected=${r.affected}`)
    } catch (e) {
      pushAction(`clear-cooldowns ошибка: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (configBusy && !config) {
    return <div className={styles.empty}>Загрузка…</div>
  }
  if (configErr) {
    return <div className={styles.warnLine}>{configErr}</div>
  }
  if (!config) return null

  return (
    <div>
      {/* ── Конфигурация ──────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Конфигурация</div>
        <div className={styles.subStats} style={{ marginBottom: 12 }}>
          Глобальный выключатель и тонкая настройка — какие типы шлём в раунде.
          Применяется к следующей итерации scheduler-loop'а (раз в час).
        </div>

        <div className={styles.bulkForm}>
          <label className={styles.bulkField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => patchConfig({ enabled: e.target.checked })}
              style={{ width: 20, height: 20 }}
            />
            <span style={{ fontSize: 14 }}>
              <strong>{config.enabled ? '🟢 Включено' : '🔴 Выключено'}</strong>
              {' — '}главный выключатель всей рассылки
            </span>
          </label>

          <label className={styles.bulkField}>
            <span>Час отправки (UTC)</span>
            <input
              type="number"
              className={styles.input}
              value={config.notify_hour_utc}
              min={0}
              max={23}
              onChange={e => patchConfig({ notify_hour_utc: Number(e.target.value) })}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              По МСК это {(config.notify_hour_utc + 3) % 24}:00. Дефолт 15 UTC = 18:00 МСК.
            </span>
          </label>
        </div>

        <div className={styles.subStats} style={{ marginTop: 14, marginBottom: 6 }}>
          <strong>Типы уведомлений:</strong>
        </div>
        <div className={styles.bulkForm} style={{ gridTemplateColumns: '1fr' }}>
          {(Object.entries(TYPE_LABELS) as Array<[NotifyType, string]>).map(([key, label]) => {
            const fieldKey = `type_${key}`
            return (
              <label
                key={key}
                className={styles.bulkField}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={!!config[fieldKey]}
                  onChange={e => patchConfig({ [fieldKey]: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 13 }}>{label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* ── Действия ───────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Действия</div>
        <div className={styles.actionGrid}>
          <button type="button" className={styles.action} onClick={sendTest}>
            🧪 Тест себе (3 типа подряд)
          </button>
          <button type="button" className={styles.actionWarn} onClick={runNow}>
            ▶ Запустить раунд рассылки сейчас
          </button>
          <button type="button" className={styles.action} onClick={clearAllCooldowns}>
            ↻ Сбросить cooldown'ы у всех
          </button>
          <button type="button" className={styles.action} onClick={loadLog}>
            🔄 Обновить лог
          </button>
        </div>
      </div>

      {/* ── Broadcast ──────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Broadcast — кастомное сообщение</div>
        <div className={styles.subStats} style={{ marginBottom: 10 }}>
          Игнорирует cooldown'ы. Идёт всем под выбранным таргетом с кнопкой
          «🎯 Открыть приложение». Для важных анонсов («попробуй новую фишку X»).
        </div>
        <textarea
          className={styles.stateEditor}
          value={broadcastText}
          onChange={e => setBroadcastText(e.target.value)}
          onKeyDown={e => {
            if (shouldSendOnKeyDown(e, sendKeyMode) && broadcastText.trim()) {
              e.preventDefault()
              sendBroadcast()
            }
          }}
          placeholder={sendKeyMode === 'enter'
            ? 'Текст сообщения... Эмодзи и Shift+Enter для переноса строк. Макс 4000.'
            : 'Текст сообщения... Можно эмодзи и переносы строк. Макс 4000 символов.'}
          rows={5}
        />
        <div className={styles.bulkForm} style={{ marginTop: 10 }}>
          <label className={styles.bulkField}>
            <span>Кому</span>
            <select
              className={styles.sortSelect}
              value={broadcastTarget}
              onChange={e => setBroadcastTarget(e.target.value as BroadcastTarget)}
            >
              {TARGETS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actionGrid} style={{ marginTop: 12 }}>
          <button
            type="button"
            className={styles.actionWarn}
            onClick={sendBroadcast}
            disabled={!broadcastText.trim()}
          >
            📢 Отправить broadcast
          </button>
        </div>
      </div>

      {/* ── Лог ───────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Последние отправки {logEntries.length > 0 && `(${logEntries.length})`}
        </div>
        {logBusy && logEntries.length === 0 && (
          <div className={styles.empty}>Загрузка…</div>
        )}
        {!logBusy && logEntries.length === 0 && (
          <div className={styles.empty}>Лог пуст — отправок ещё не было.</div>
        )}
        {logEntries.length > 0 && (
          <table className={styles.diffTable}>
            <thead>
              <tr>
                <th>Когда</th>
                <th>Юзер</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Текст</th>
              </tr>
            </thead>
            <tbody>
              {logEntries.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                    {e.sent_at?.replace('T', ' ').slice(0, 16)}
                  </td>
                  <td>
                    {e.user_display_name || e.user_email || (e.web_user_id ? `#${e.web_user_id}` : 'tg:' + e.telegram_id)}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {e.type}
                  </td>
                  <td>
                    {e.error
                      ? <span title={e.error} style={{ color: 'var(--danger)' }}>✗</span>
                      : <span style={{ color: 'var(--good)' }}>✓</span>}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-soft)' }}>
                    {(e.text || e.error || '').slice(0, 80)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actionLog.length > 0 && (
        <div className={styles.logPanel}>
          <div className={styles.logTitle}>Лог действий</div>
          {actionLog.map(entry => (
            <div key={entry.ts} className={styles.logRow}>
              <span className={styles.logTs}>
                {new Date(entry.ts).toLocaleTimeString()}
              </span>
              {entry.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
