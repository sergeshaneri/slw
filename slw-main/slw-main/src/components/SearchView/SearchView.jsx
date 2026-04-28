import { useEffect, useState } from 'react'
import { ASPECT_COLORS } from '../../data/aspects'
import { searchAll } from '../../api/client'
import styles from './SearchView.module.css'

const SCOPES = [
  { id: 'all',       label: 'Везде' },
  { id: 'mine',      label: 'Мои инсайты + дневник' },
  { id: 'community', label: 'Сообщество' },
]

/**
 * Простой поиск по своим и публичным сущностям.
 * Backend: ILIKE по text-полям. От 2 символов запрос работает.
 *
 * `initialQuery` — пред-заполненный запрос (например, из ?q= в URL).
 */
export default function SearchView({ initialQuery = '', onOpenProfile }) {
  const [q, setQ] = useState(initialQuery)
  const [scope, setScope] = useState('all')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (q.length < 2) { setData(null); return }
    let cancelled = false
    setBusy(true)
    setError(null)
    const t = setTimeout(() => {
      searchAll(q, scope)
        .then(d => { if (!cancelled) setData(d) })
        .catch(e => { if (!cancelled) setError(e.message ?? 'Ошибка поиска') })
        .finally(() => { if (!cancelled) setBusy(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, scope])

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Поиск</span>
        <h1 className={styles.title}>🔍 Поиск</h1>
        <div className={styles.subline}>По своим инсайтам, дневнику и публичным инсайтам сообщества.</div>
      </div>

      <input
        type="text"
        className={styles.input}
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Введи слово или фразу… (от 2 символов)"
        autoFocus
      />

      <div className={styles.scopeRow}>
        {SCOPES.map(s => (
          <button
            key={s.id}
            type="button"
            className={`${styles.scopeBtn} ${scope === s.id ? styles.scopeBtnActive : ''}`}
            onClick={() => setScope(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {busy && <div className={styles.muted}>Ищем…</div>}

      {data && q.length >= 2 && (
        <>
          {(scope === 'all' || scope === 'mine') && (
            <Section label={`Мои инсайты · ${data.my_insights.length}`}>
              {data.my_insights.length === 0
                ? <div className={styles.muted}>Ничего не нашлось</div>
                : data.my_insights.map(it => (
                  <div key={`mi-${it.id}`} className={styles.card}>
                    <div className={styles.cardHead}>
                      <span style={{ color: ASPECT_COLORS[it.aspect] }} className={styles.cardAspect}>
                        {it.aspect}
                      </span>
                      <span className={styles.cardKind}>
                        {it.kind === 'recommendation' ? 'рекомендация' : 'инсайт'}
                      </span>
                      {!it.is_public && <span className={styles.cardMuted}>🔒 личное</span>}
                      <span className={styles.cardMuted}>{formatDate(it.created_at)}</span>
                    </div>
                    <div className={styles.cardText}>{highlight(it.text, q)}</div>
                  </div>
                ))
              }
            </Section>
          )}

          {(scope === 'all' || scope === 'mine') && (
            <Section label={`Дневник · ${data.diary.length}`}>
              {data.diary.length === 0
                ? <div className={styles.muted}>Ничего не нашлось</div>
                : data.diary.map(it => (
                  <div key={`d-${it.id}`} className={styles.card}>
                    <div className={styles.cardHead}>
                      {it.aspect && (
                        <span style={{ color: ASPECT_COLORS[it.aspect] }} className={styles.cardAspect}>
                          {it.aspect}
                        </span>
                      )}
                      <span className={styles.cardMuted}>{formatDate(it.created_at)}</span>
                    </div>
                    <div className={styles.cardText}>{highlight(it.text, q)}</div>
                  </div>
                ))
              }
            </Section>
          )}

          {(scope === 'all' || scope === 'community') && (
            <Section label={`Сообщество · ${data.community_insights.length}`}>
              {data.community_insights.length === 0
                ? <div className={styles.muted}>Ничего не нашлось</div>
                : data.community_insights.map(it => (
                  <div key={`c-${it.id}`} className={styles.card}>
                    <div className={styles.cardHead}>
                      <span style={{ color: ASPECT_COLORS[it.aspect] }} className={styles.cardAspect}>
                        {it.aspect}
                      </span>
                      <button
                        type="button"
                        className={styles.cardAuthor}
                        onClick={() => onOpenProfile?.(it.user_id)}
                      >
                        {it.avatar || '🧑'} {it.display_name}
                      </button>
                      <span className={styles.cardMuted}>{formatDate(it.created_at)}</span>
                    </div>
                    <div className={styles.cardText}>{highlight(it.text, q)}</div>
                  </div>
                ))
              }
            </Section>
          )}
        </>
      )}

      {q.length < 2 && (
        <div className={styles.muted}>Начни вводить — поиск показывает результаты от 2 символов.</div>
      )}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </section>
  )
}

function highlight(text, q) {
  if (!q || q.length < 2) return text
  // Простой case-insensitive split. Не идеален для regex-special символов в q, но для MVP ок.
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${safe})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className={styles.mark}>{p}</mark> : <span key={i}>{p}</span>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
