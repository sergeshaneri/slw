import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchAnalyticsList, fetchAnalyticsReport } from '../../api/client'
import styles from './AnalyticsTab.module.css'

/**
 * Минимальный markdown-рендер для отчётов. Раньше выводили `<pre>{text}</pre>`
 * и `## Заголовок` / `**жирно**` отображались как символы.
 *
 * Поддерживаем самое нужное для отчётов:
 *   • `# / ## / ###` — заголовки
 *   • `**bold**` / `*italic*` — внутри строки
 *   • `- item` / `* item` / `1. item` — маркированные/нумерованные списки
 *   • Пустые строки — разделители параграфов
 *
 * Намеренно простой: zero deps, no XSS (всё через React-text).
 */
function MdLite({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let buf: string[] = []
  let bufType: 'p' | 'ul' | 'ol' | null = null
  let bufKey = 0

  const flush = () => {
    if (!buf.length) return
    if (bufType === 'ul') {
      blocks.push(
        <ul key={`b${bufKey++}`} className={styles.mdList}>
          {buf.map((item, i) => <li key={i}>{inline(item)}</li>)}
        </ul>
      )
    } else if (bufType === 'ol') {
      blocks.push(
        <ol key={`b${bufKey++}`} className={styles.mdList}>
          {buf.map((item, i) => <li key={i}>{inline(item)}</li>)}
        </ol>
      )
    } else if (bufType === 'p') {
      blocks.push(
        <p key={`b${bufKey++}`} className={styles.mdP}>
          {inline(buf.join(' '))}
        </p>
      )
    }
    buf = []
    bufType = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { flush(); continue }
    let m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      flush()
      const level = Math.min(6, m[1].length)
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      blocks.push(<Tag key={`b${bufKey++}`} className={styles[`mdH${level}` as keyof typeof styles] ?? styles.mdH3}>{inline(m[2])}</Tag>)
      continue
    }
    m = /^[-*]\s+(.*)$/.exec(line)
    if (m) {
      if (bufType !== 'ul') flush()
      bufType = 'ul'
      buf.push(m[1])
      continue
    }
    m = /^\d+\.\s+(.*)$/.exec(line)
    if (m) {
      if (bufType !== 'ol') flush()
      bufType = 'ol'
      buf.push(m[1])
      continue
    }
    if (bufType !== 'p') flush()
    bufType = 'p'
    buf.push(line)
  }
  flush()

  return <div className={styles.mdRoot}>{blocks}</div>
}

// Inline: **bold** / *italic*. Без XSS: используем React-узлы.
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  let rest = s
  let k = 0
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(rest)) !== null) {
    if (match.index > lastIndex) {
      out.push(rest.slice(lastIndex, match.index))
    }
    if (match[2]) out.push(<strong key={`i${k++}`}>{match[2]}</strong>)
    else if (match[4]) out.push(<em key={`i${k++}`}>{match[4]}</em>)
    lastIndex = re.lastIndex
  }
  if (lastIndex < rest.length) out.push(rest.slice(lastIndex))
  return out
}

// Shape сохраняемых отчётов в таблице `analytics_reports`. Backend
// возвращает массив без response_model, поэтому локальный тип.
// NOTE(ts): pending backend response_model for /api/diary/analytics.
type AnalyticsReportType = 'week' | 'month' | 'custom' | string

type AnalyticsReportSummary = {
  id: number | string
  type: AnalyticsReportType
  title?: string | null
  period_start?: string | null
  period_end?: string | null
}

type AnalyticsReportFull = AnalyticsReportSummary & {
  content_md?: string
}

const TYPE_LABEL: Record<string, string> = {
  week:   'Неделя',
  month:  'Месяц',
  custom: 'Произвольный',
}

/**
 * Список аналитических отчётов (`analytics_reports`). При клике —
 * раскрывается markdown-контент. Markdown рендерим простым white-space:
 * pre-wrap (без полноценного парсера — это user-генерируемый контент,
 * минимум форматирования и так читаем).
 */
export default function AnalyticsTab() {
  const [items, setItems] = useState<AnalyticsReportSummary[]>([])
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | string | null>(null)
  const [openContent, setOpenContent] = useState<AnalyticsReportFull | null>(null)
  const [contentBusy, setContentBusy] = useState<boolean>(false)

  useEffect(() => {
    setBusy(true)
    fetchAnalyticsList()
      .then((d) => setItems(d as AnalyticsReportSummary[]))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить отчёты'))
      .finally(() => setBusy(false))
  }, [])

  const handleOpen = async (id: number | string): Promise<void> => {
    if (openId === id) {
      setOpenId(null)
      setOpenContent(null)
      return
    }
    setOpenId(id)
    setOpenContent(null)
    setContentBusy(true)
    try {
      const data = await fetchAnalyticsReport(id)
      setOpenContent(data as AnalyticsReportFull)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить отчёт')
    } finally {
      setContentBusy(false)
    }
  }

  if (busy) return <div className={styles.muted}>Загружаем отчёты…</div>
  if (error) return <div className={styles.error}>{error}</div>

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>Отчётов пока нет</h3>
        <p className={styles.muted}>
          Аналитические отчёты импортируются из локального vault'а
          (папка <code className={styles.code}>analytics/</code>) — это
          недельные и месячные отчёты, которые ты собираешь через
          AI-агента в Claude Code.
        </p>
        <p className={styles.muted}>
          Запусти на компе:
          <code className={styles.code}>python tools/vault_sync.py import</code>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {items.map(r => {
          const isOpen = openId === r.id
          return (
            <div key={r.id} className={styles.row}>
              <button
                type="button"
                className={styles.head}
                onClick={() => handleOpen(r.id)}
              >
                <span className={styles.type}>{TYPE_LABEL[r.type] || r.type}</span>
                <span className={styles.title}>{r.title || `${r.period_start} – ${r.period_end}`}</span>
                <span className={styles.period}>{r.period_start} – {r.period_end}</span>
                <span className={styles.toggleArrow}>{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className={styles.body}>
                  {contentBusy && <div className={styles.muted}>Загружаем…</div>}
                  {openContent && (
                    <MdLite text={openContent.content_md ?? ''} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
