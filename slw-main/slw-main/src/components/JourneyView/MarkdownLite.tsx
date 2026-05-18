import styles from './JourneyView.module.css'

// Лёгкий markdown-рендерер для скриптов чата (ScriptCard).
// Поддерживает: параграфы (разделены пустой строкой), переносы внутри
// параграфа, нумерованные/маркированные списки, **жирный**, _курсив_,
// *курсив*, `code`. Без заголовков/ссылок/таблиц — этого в скриптах нет.
//
// Не используем dangerouslySetInnerHTML — собираем React-элементы.
// Контент под нашим контролем (markdown в репо), но привычка важнее.

const BOLD_RE = /\*\*([^*\n]+?)\*\*/g
const ITALIC_RE = /(^|[\s(\[«"'])([_*])([^_*\n]+?)\2(?=[\s.,!?:;)\]»"']|$)/g
const CODE_RE = /`([^`\n]+?)`/g

type SegmentKind = 'text' | 'code' | 'bold' | 'em'
type Segment = { kind: SegmentKind; value: string }

// Превращает строку в массив React-элементов с inline-форматированием.
function renderInline(text: string, keyPrefix: string = ''): Array<React.ReactNode> {
  // Применяем последовательно: code → bold → italic. Каждое — токенизация
  // на сегменты [{ kind: 'text'|'code'|'bold'|'em', value }] и replace.
  let segments: Segment[] = [{ kind: 'text', value: text }]

  const splitBy = (regex: RegExp, kind: SegmentKind, group: number = 1) => {
    const next: Segment[] = []
    for (const seg of segments) {
      if (seg.kind !== 'text') { next.push(seg); continue }
      let lastIdx = 0
      const str = seg.value
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(str)) !== null) {
        if (m.index > lastIdx) {
          next.push({ kind: 'text', value: str.slice(lastIdx, m.index) })
        }
        // group=1 для code/bold; для italic мы пишем кастомную логику ниже
        next.push({ kind, value: m[group] })
        lastIdx = m.index + m[0].length
      }
      if (lastIdx < str.length) {
        next.push({ kind: 'text', value: str.slice(lastIdx) })
      }
    }
    segments = next
  }

  splitBy(CODE_RE, 'code')
  splitBy(BOLD_RE, 'bold')

  // Italic: regex ловит ведущий пробел/скобку — нужно его сохранить.
  {
    const next: Segment[] = []
    for (const seg of segments) {
      if (seg.kind !== 'text') { next.push(seg); continue }
      let lastIdx = 0
      const str = seg.value
      ITALIC_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = ITALIC_RE.exec(str)) !== null) {
        const lead = m[1] ?? ''
        const inner = m[3]
        const startInner = m.index + lead.length
        // Пушим всё до lead (включительно)
        if (startInner > lastIdx) {
          next.push({ kind: 'text', value: str.slice(lastIdx, startInner) })
        }
        next.push({ kind: 'em', value: inner })
        lastIdx = m.index + m[0].length
      }
      if (lastIdx < str.length) {
        next.push({ kind: 'text', value: str.slice(lastIdx) })
      }
    }
    segments = next
  }

  return segments.map((s, i) => {
    const k = `${keyPrefix}-${i}`
    if (s.kind === 'code') return <code key={k} className={styles.mdCode}>{s.value}</code>
    if (s.kind === 'bold') return <strong key={k}>{s.value}</strong>
    if (s.kind === 'em') return <em key={k}>{s.value}</em>
    return s.value
  })
}

// Превращает массив строк (lines одного «параграфа») в React-children
// с переносами через <br/>.
function renderLinesWithBreaks(lines: string[], keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`${keyPrefix}-br-${i}`} />)
    out.push(...renderInline(line, `${keyPrefix}-l${i}`))
  })
  return out
}

type Props = {
  text?: string | null
}

export default function MarkdownLite({ text }: Props) {
  if (!text) return null

  // Разбиваем на блоки по пустым строкам.
  const blocks = String(text).split(/\n\s*\n/)
  const elements: React.ReactNode[] = []

  // Внутри блока разделяем строки на под-сегменты:
  //   text-сегмент   → одна или несколько строк обычного текста
  //   ol-сегмент     → подряд идущие строки вида "1. …", "2. …"
  //   ul-сегмент     → подряд идущие строки вида "- …", "• …", "* …", "— …"
  // Это позволяет корректно выделять список, даже если перед ним идёт
  // вступительная строка "Как делать:" в том же блоке (без пустой строки).
  const ORDERED = /^\s*\d+\.\s+/
  const BULLET = /^\s*[-*•—]\s+/

  type BlockSegmentKind = 'text' | 'ol' | 'ul'
  type BlockSegment = { kind: BlockSegmentKind; lines: string[] }

  blocks.forEach((block, bi) => {
    const trimmed = block.trim()
    if (!trimmed) return
    const lines = trimmed.split('\n')

    const segments: BlockSegment[] = []
    let buffer: string[] = []
    let bufferKind: BlockSegmentKind = 'text'
    const flush = () => {
      if (buffer.length === 0) return
      segments.push({ kind: bufferKind, lines: buffer })
      buffer = []
    }
    for (const line of lines) {
      let kind: BlockSegmentKind = 'text'
      if (ORDERED.test(line)) kind = 'ol'
      else if (BULLET.test(line)) kind = 'ul'
      if (kind !== bufferKind) flush()
      bufferKind = kind
      buffer.push(line)
    }
    flush()

    segments.forEach((seg, si) => {
      const k = `b-${bi}-${si}`
      if (seg.kind === 'ol') {
        elements.push(
          <ol key={k} className={styles.mdList}>
            {seg.lines.map((l, li) => {
              const item = l.replace(ORDERED, '')
              return <li key={`${k}-${li}`}>{renderInline(item, `${k}-${li}`)}</li>
            })}
          </ol>
        )
      } else if (seg.kind === 'ul') {
        elements.push(
          <ul key={k} className={styles.mdList}>
            {seg.lines.map((l, li) => {
              const item = l.replace(BULLET, '')
              return <li key={`${k}-${li}`}>{renderInline(item, `${k}-${li}`)}</li>
            })}
          </ul>
        )
      } else {
        elements.push(
          <p key={k} className={styles.mdPara}>
            {renderLinesWithBreaks(seg.lines, k)}
          </p>
        )
      }
    })
  })

  return <>{elements}</>
}
