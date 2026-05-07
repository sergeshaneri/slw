import { useEffect, useRef, useState } from 'react'
import { ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import { HALL_CONTENT } from '../../data/hallContent'
import {
  fetchHallOverview,
  fetchHallMessages,
  postHallMessage,
  deleteHallMessage,
  fetchHallInsights,
  fetchHallLeaderboard,
  fetchHallInspirations,
  postInsight,
  reactToInsightWithComment,
  fetchHabitsToday,
  tickHabit,
  untickHabit,
  fetchHallQuestions,
  fetchHallQuestion,
  postHallQuestion,
  postHallAnswer,
  markBestAnswer,
  bookmarkInsight,
  unbookmarkInsight,
} from '../../api/client'
import styles from './HallView.module.css'

const TABS = [
  { id: 'overview',  label: 'Обзор' },
  { id: 'chat',      label: 'Чат' },
  { id: 'questions', label: 'Вопросы' },
  { id: 'insights',  label: 'Инсайты' },
  { id: 'community', label: 'Сообщество' },
]

const REACTIONS = [
  { type: 'heart',  emoji: '♥' },
  { type: 'thanks', emoji: '🙏' },
  { type: 'aha',    emoji: '💡' },
  { type: 'fire',   emoji: '🔥' },
]

const INSPIRATION_ICON = {
  film: '🎬', book: '📚', music: '🎵', activity: '🏃', person: '👤', other: '✦',
}

const POLL_INTERVAL_MS = 5000

export default function HallView({ aspect, currentUserId, onBack, onOpenProfile }) {
  const [tab, setTab] = useState('overview')
  const accent = ASPECT_COLORS[aspect] || '#b39ddb'
  const meta = ASPECT_DATA[aspect] || {}
  const content = HALL_CONTENT[aspect] || {}

  return (
    <div className={styles.container} style={{ '--accent': accent }}>
      <button type="button" className={styles.backBtn} onClick={onBack}>← Назад</button>

      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Холл</span>
        <h1 className={styles.title} style={{ color: accent }}>
          {aspect} · {meta.name ?? 'Аспект'}
        </h1>
        {meta.metaphor && <div className={styles.subline}>{meta.metaphor}</div>}
        <HabitTickButton aspect={aspect} />
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          aspect={aspect}
          meta={meta}
          content={content}
          onOpenProfile={onOpenProfile}
        />
      )}
      {tab === 'chat' && (
        <ChatTab aspect={aspect} currentUserId={currentUserId} onOpenProfile={onOpenProfile} />
      )}
      {tab === 'questions' && (
        <QuestionsTab aspect={aspect} currentUserId={currentUserId} onOpenProfile={onOpenProfile} />
      )}
      {tab === 'insights' && (
        <InsightsTab aspect={aspect} currentUserId={currentUserId} onOpenProfile={onOpenProfile} />
      )}
      {tab === 'community' && (
        <CommunityTab
          aspect={aspect}
          content={content}
          currentUserId={currentUserId}
          onOpenProfile={onOpenProfile}
        />
      )}
    </div>
  )
}

// ── Overview ────────────────────────────────────────────────────────────────

function OverviewTab({ aspect, meta, content, onOpenProfile }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchHallOverview(aspect)
      .then(setData)
      .catch(e => setError(e.message ?? 'Не удалось загрузить'))
  }, [aspect])

  return (
    <div className={styles.tabBody}>
      {meta.essence && (
        <Section label="Суть аспекта">
          <p className={styles.bodyText}>{meta.essence}</p>
        </Section>
      )}

      {meta.superpower && (
        <Section label="Суперспособность">
          <p className={styles.bodyText}>{meta.superpower}</p>
        </Section>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {data && (
        <>
          <Section label="Твоя статистика в холле">
            <div className={styles.statsGrid}>
              <Stat label="Твоя оценка" value={data.my_score != null ? data.my_score.toFixed(1) : '—'} />
              <Stat label="Твоих инсайтов" value={data.my_insights} />
              <Stat label="Твоё место" value={data.my_rank ? `#${data.my_rank}` : '—'} />
              <Stat label="Активны за сутки" value={data.active_24h} />
            </div>
          </Section>

          {data.last_insights.length > 0 && (
            <Section label="Свежие инсайты">
              {data.last_insights.map(ins => (
                <div key={ins.id} className={styles.previewRow}>
                  <span className={styles.previewAvatar}>{ins.avatar || '🧑'}</span>
                  <button
                    type="button"
                    className={styles.previewName}
                    onClick={() => onOpenProfile?.(ins.user_id)}
                  >
                    {ins.display_name}
                  </button>
                  <span className={styles.previewText}>{trim(ins.text, 120)}</span>
                </div>
              ))}
            </Section>
          )}

          {data.last_messages.length > 0 && (
            <Section label="Последние сообщения">
              {data.last_messages.map(m => (
                <div key={m.id} className={styles.previewRow}>
                  <span className={styles.previewAvatar}>{m.avatar || '🧑'}</span>
                  <button
                    type="button"
                    className={styles.previewName}
                    onClick={() => onOpenProfile?.(m.user_id)}
                  >
                    {m.display_name}
                  </button>
                  <span className={styles.previewText}>{trim(m.text, 120)}</span>
                </div>
              ))}
            </Section>
          )}
        </>
      )}

      {(content.archetypes ?? []).length > 0 && (
        <Section label="Архетипы аспекта">
          <div className={styles.archetypeGrid}>
            {content.archetypes.map(a => (
              <div key={a.id ?? a.title} className={styles.archetypeCard}>
                <div className={styles.archetypeIcon}>{a.emoji}</div>
                <div className={styles.archetypeTitle}>{a.title}</div>
                <div className={styles.archetypeDesc}>{a.desc}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

// ── Chat ────────────────────────────────────────────────────────────────────

function ChatTab({ aspect, currentUserId, onOpenProfile }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [lastId, setLastId] = useState(0)
  const listRef = useRef(null)

  // Initial load.
  useEffect(() => {
    let cancelled = false
    fetchHallMessages(aspect, 0, 100)
      .then(({ messages: msgs, last_id }) => {
        if (cancelled) return
        setMessages(msgs)
        setLastId(last_id)
      })
      .catch(e => setError(e.message ?? 'Не удалось загрузить чат'))
    return () => { cancelled = true }
  }, [aspect])

  // Polling.
  useEffect(() => {
    if (lastId === 0) return
    const id = setInterval(async () => {
      try {
        const { messages: fresh, last_id } = await fetchHallMessages(aspect, lastId, 100)
        if (fresh.length === 0) return
        setMessages(prev => [...prev, ...fresh])
        setLastId(last_id)
      } catch {
        // Молча, polling не должен ломать UX.
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [aspect, lastId])

  // Автоскролл вниз при новых сообщениях.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const handleSend = async () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    setError(null)
    try {
      const msg = await postHallMessage(aspect, t)
      setMessages(prev => [...prev, msg])
      setLastId(prev => Math.max(prev, msg.id))
      setText('')
    } catch (e) {
      setError(e.message ?? 'Не удалось отправить')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteHallMessage(aspect, id)
      setMessages(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      setError(e.message ?? 'Не удалось удалить')
    }
  }

  return (
    <div className={styles.tabBody}>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.chatList} ref={listRef}>
        {messages.length === 0 && (
          <div className={styles.muted}>Пока тихо. Будь первым кто что-то скажет.</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`${styles.chatMsg} ${m.is_mine ? styles.chatMsgMine : ''}`}>
            <span className={styles.chatAvatar}>{m.avatar || '🧑'}</span>
            <div className={styles.chatBody}>
              <div className={styles.chatMeta}>
                <button
                  type="button"
                  className={styles.chatName}
                  onClick={() => onOpenProfile?.(m.user_id)}
                >
                  {m.display_name}
                </button>
                <span className={styles.chatTime}>{formatTime(m.created_at)}</span>
                {m.is_mine && (
                  <button
                    type="button"
                    className={styles.chatDelete}
                    onClick={() => handleDelete(m.id)}
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className={styles.chatText}>{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.chatInputRow}>
        <textarea
          className={styles.chatInput}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Напиши что-то в холл… (Ctrl+Enter)"
          maxLength={2000}
          rows={2}
        />
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleSend}
          disabled={busy || !text.trim()}
        >
          Отправить
        </button>
      </div>
    </div>
  )
}

// ── Insights feed ───────────────────────────────────────────────────────────

function InsightsTab({ aspect, currentUserId, onOpenProfile }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(true)
  const [sort, setSort] = useState('new')
  const [text, setText] = useState('')
  const [kind, setKind] = useState('insight')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  const reload = async () => {
    setBusy(true)
    try {
      setItems(await fetchHallInsights(aspect, sort))
    } catch (e) {
      setError(e.message ?? 'Не удалось загрузить')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [aspect, sort])

  const handlePost = async () => {
    const t = text.trim()
    if (!t || posting) return
    setPosting(true)
    setError(null)
    try {
      await postInsight({ aspect, kind, text: t, isPublic: true })
      setText('')
      await reload()
    } catch (e) {
      setError(e.message ?? 'Не удалось опубликовать')
    } finally {
      setPosting(false)
    }
  }

  const handleReact = async (insightId, reaction) => {
    try {
      const { my_reaction, reactions, total } =
        await reactToInsightWithComment(insightId, reaction)
      setItems(prev => prev.map(i =>
        i.id === insightId
          ? { ...i, my_reaction, reactions, likes: total }
          : i
      ))
    } catch (e) {
      setError(e.message ?? 'Не удалось реакция')
    }
  }

  const handleBookmark = async (insightId, current) => {
    try {
      if (current) await unbookmarkInsight(insightId)
      else await bookmarkInsight(insightId)
      setItems(prev => prev.map(i =>
        i.id === insightId ? { ...i, bookmarked_by_me: !current } : i
      ))
    } catch (e) {
      setError(e.message ?? 'Не удалось')
    }
  }

  return (
    <div className={styles.tabBody}>
      <Section label="Опубликовать в холл">
        <div className={styles.composer}>
          <div className={styles.composerRow}>
            <select
              className={styles.select}
              value={kind}
              onChange={e => setKind(e.target.value)}
            >
              <option value="insight">Инсайт</option>
              <option value="recommendation">Рекомендация</option>
            </select>
            <span className={styles.muted}>аспект: <strong>{ASPECT_DISPLAY_KEY[aspect]}</strong></span>
          </div>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Что заметил/понял по этому аспекту?"
            maxLength={2000}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handlePost}
            disabled={posting || !text.trim()}
          >
            {posting ? 'Публикуем…' : 'Опубликовать'}
          </button>
        </div>
      </Section>

      <div className={styles.sortRow}>
        <button
          type="button"
          className={`${styles.sortBtn} ${sort === 'new' ? styles.sortBtnActive : ''}`}
          onClick={() => setSort('new')}
        >Свежие</button>
        <button
          type="button"
          className={`${styles.sortBtn} ${sort === 'popular' ? styles.sortBtnActive : ''}`}
          onClick={() => setSort('popular')}
        >Популярные</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {busy && <div className={styles.muted}>Загружаем…</div>}

      <div className={styles.insightList}>
        {items.map(ins => (
          <div key={ins.id} className={styles.insightCard}>
            <div className={styles.insightHead}>
              <span className={styles.insightAvatar}>{ins.avatar || '🧑'}</span>
              <button
                type="button"
                className={styles.previewName}
                onClick={() => onOpenProfile?.(ins.user_id)}
              >
                {ins.display_name}
              </button>
              <span className={styles.insightKind}>
                · {ins.kind === 'recommendation' ? 'рекомендация' : 'инсайт'}
              </span>
              <span className={styles.muted}>{formatDate(ins.created_at)}</span>
            </div>
            <div className={styles.insightText}>{ins.text}</div>
            <div className={styles.reactionRow}>
              {REACTIONS.map(r => {
                const count = ins.reactions?.[r.type] ?? 0
                const isActive = ins.my_reaction === r.type
                return (
                  <button
                    key={r.type}
                    type="button"
                    className={`${styles.reactionBtn} ${isActive ? styles.reactionBtnActive : ''}`}
                    onClick={() => handleReact(ins.id, r.type)}
                    disabled={ins.user_id === currentUserId}
                  >
                    <span>{r.emoji}</span>
                    {count > 0 && <span className={styles.reactionCount}>{count}</span>}
                  </button>
                )
              })}
              <button
                type="button"
                className={`${styles.reactionBtn} ${ins.bookmarked_by_me ? styles.reactionBtnActive : ''}`}
                onClick={() => handleBookmark(ins.id, ins.bookmarked_by_me)}
                title={ins.bookmarked_by_me ? 'В закладках' : 'Сохранить в закладки'}
              >
                {ins.bookmarked_by_me ? '🔖' : '☆'}
              </button>
            </div>
          </div>
        ))}
        {!busy && items.length === 0 && (
          <div className={styles.muted}>В этом холле пока нет публичных инсайтов. Опубликуй первый.</div>
        )}
      </div>
    </div>
  )
}

// ── Community ───────────────────────────────────────────────────────────────

function CommunityTab({ aspect, content, currentUserId, onOpenProfile }) {
  const [top, setTop] = useState([])
  const [inspirations, setInspirations] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchHallLeaderboard(aspect), fetchHallInspirations(aspect)])
      .then(([t, i]) => { setTop(t); setInspirations(i) })
      .catch(e => setError(e.message ?? 'Не удалось загрузить'))
  }, [aspect])

  return (
    <div className={styles.tabBody}>
      {error && <div className={styles.error}>{error}</div>}

      <Section label={`Топ юзеров по аспекту`}>
        {top.length === 0 ? (
          <div className={styles.muted}>Пока пусто. Опубликуй первый инсайт — попадёшь в топ.</div>
        ) : (
          <ol className={styles.topList}>
            {top.map(row => {
              const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`
              return (
                <li key={row.user_id} className={`${styles.topRow} ${row.is_me ? styles.topRowMe : ''}`}>
                  <span className={styles.topRank}>{medal}</span>
                  <span className={styles.previewAvatar}>{row.avatar || '🧑'}</span>
                  <button
                    type="button"
                    className={styles.previewName}
                    onClick={() => onOpenProfile?.(row.user_id)}
                  >
                    {row.display_name}
                    {row.is_me && <span className={styles.youBadge}>ты</span>}
                  </button>
                  <span className={styles.topStats}>
                    {row.insights_count} инсайтов · {row.likes_received} реакций
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </Section>

      <Section label="Уголок вдохновения">
        {inspirations.length === 0 ? (
          <div className={styles.muted}>
            Пока пусто. Добавь карточку вдохновения с тегом «{aspect}» в свой профиль — появится здесь.
          </div>
        ) : (
          <div className={styles.inspirationGrid}>
            {inspirations.map((it, idx) => (
              <div key={`${it.user_id}-${idx}`} className={styles.inspirationCard}>
                <div className={styles.inspirationHead}>
                  <span className={styles.inspirationIcon}>{INSPIRATION_ICON[it.type] ?? '✦'}</span>
                  <button
                    type="button"
                    className={styles.previewName}
                    onClick={() => onOpenProfile?.(it.user_id)}
                  >
                    {it.display_name}
                  </button>
                </div>
                <div className={styles.inspirationTitle}>{it.title}</div>
                {it.note && <div className={styles.inspirationNote}>{it.note}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {(content.quotes ?? []).length > 0 && (
        <Section label="Цитаты">
          <div className={styles.quoteList}>
            {content.quotes.map((q, i) => (
              <blockquote key={i} className={styles.quote}>
                «{q.text}»
                <footer className={styles.quoteAuthor}>— {q.author}</footer>
              </blockquote>
            ))}
          </div>
        </Section>
      )}

      {(content.figures ?? []).length > 0 && (
        <Section label="Личности">
          <ul className={styles.figureList}>
            {content.figures.map((f, i) => (
              <li key={i} className={styles.figureItem}>
                <strong>{f.name}</strong>
                {f.note && <span className={styles.muted}> — {f.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(content.arts ?? []).length > 0 && (
        <Section label="Искусство">
          <div className={styles.artList}>
            {content.arts.map((a, i) => (
              <div key={i} className={styles.artItem}>
                <span className={styles.inspirationIcon}>{INSPIRATION_ICON[a.type] ?? '✦'}</span>
                <span><strong>{a.title}</strong>{a.note ? ` — ${a.note}` : ''}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function QuestionsTab({ aspect, currentUserId, onOpenProfile }) {
  const [list, setList] = useState([])
  const [openId, setOpenId] = useState(null)
  const [thread, setThread] = useState(null)
  const [busy, setBusy] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)
  const [askText, setAskText] = useState('')
  const [answerText, setAnswerText] = useState('')

  const reloadList = async () => {
    setBusy(true)
    try {
      setList(await fetchHallQuestions(aspect, 50))
    } catch (e) {
      setError(e.message ?? 'Не удалось загрузить вопросы')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reloadList() /* eslint-disable-next-line */ }, [aspect])

  useEffect(() => {
    if (!openId) { setThread(null); return }
    fetchHallQuestion(aspect, openId)
      .then(setThread)
      .catch(e => setError(e.message ?? 'Не удалось'))
  }, [aspect, openId])

  const handleAsk = async () => {
    const t = askText.trim()
    if (!t) return
    setPosting(true)
    setError(null)
    try {
      await postHallQuestion(aspect, t)
      setAskText('')
      reloadList()
    } catch (e) {
      setError(e.message ?? 'Не удалось')
    } finally {
      setPosting(false)
    }
  }

  const handleAnswer = async () => {
    const t = answerText.trim()
    if (!t || !openId) return
    setPosting(true)
    setError(null)
    try {
      await postHallAnswer(aspect, openId, t)
      setAnswerText('')
      const fresh = await fetchHallQuestion(aspect, openId)
      setThread(fresh)
      reloadList()
    } catch (e) {
      setError(e.message ?? 'Не удалось')
    } finally {
      setPosting(false)
    }
  }

  const handleMarkBest = async (answerId) => {
    if (!openId) return
    try {
      await markBestAnswer(aspect, openId, answerId)
      const fresh = await fetchHallQuestion(aspect, openId)
      setThread(fresh)
      reloadList()
    } catch (e) {
      setError(e.message ?? 'Не удалось')
    }
  }

  if (openId && thread) {
    const isQuestionAuthor = thread.question.user_id === currentUserId
    return (
      <div className={styles.tabBody}>
        <button
          type="button"
          className={styles.sortBtn}
          onClick={() => { setOpenId(null); setThread(null) }}
        >
          ← к вопросам
        </button>

        {error && <div className={styles.error}>{error}</div>}

        <Section label="Вопрос">
          <div className={styles.insightHead}>
            <span className={styles.insightAvatar}>{thread.question.avatar || '🧑'}</span>
            <button
              type="button"
              className={styles.previewName}
              onClick={() => onOpenProfile?.(thread.question.user_id)}
            >
              {thread.question.display_name}
            </button>
            <span className={styles.muted}>{formatDate(thread.question.created_at)}</span>
          </div>
          <div className={styles.insightText}>❓ {thread.question.text}</div>
        </Section>

        <Section label={`Ответы · ${thread.answers.length}`}>
          {thread.answers.length === 0 && (
            <div className={styles.muted}>Пока ответов нет — будь первым.</div>
          )}
          <div className={styles.insightList}>
            {thread.answers.map(a => (
              <div
                key={a.id}
                className={styles.insightCard}
                style={a.is_best ? { borderColor: 'var(--accent)', background: 'rgba(179,157,219,0.05)' } : undefined}
              >
                <div className={styles.insightHead}>
                  {a.is_best && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✨ ЛУЧШИЙ</span>}
                  <span className={styles.insightAvatar}>{a.avatar || '🧑'}</span>
                  <button
                    type="button"
                    className={styles.previewName}
                    onClick={() => onOpenProfile?.(a.user_id)}
                  >
                    {a.display_name}
                  </button>
                  <span className={styles.muted}>{formatDate(a.created_at)}</span>
                  {isQuestionAuthor && !a.is_best && (
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => handleMarkBest(a.id)}
                    >
                      пометить лучшим
                    </button>
                  )}
                </div>
                <div className={styles.insightText}>{a.text}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="Твой ответ">
          <textarea
            className={styles.textarea}
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            placeholder="Поделись опытом по этому вопросу…"
            maxLength={4000}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleAnswer}
            disabled={posting || !answerText.trim()}
          >
            {posting ? 'Отправка…' : 'Ответить'}
          </button>
        </Section>
      </div>
    )
  }

  return (
    <div className={styles.tabBody}>
      <Section label="Задать вопрос холлу">
        <textarea
          className={styles.textarea}
          value={askText}
          onChange={e => setAskText(e.target.value)}
          placeholder="Что хочешь спросить у тех, кто тоже работает с этим аспектом?"
          maxLength={2000}
        />
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleAsk}
          disabled={posting || !askText.trim()}
        >
          {posting ? 'Отправка…' : '❓ Задать вопрос'}
        </button>
      </Section>

      {error && <div className={styles.error}>{error}</div>}
      {busy && <div className={styles.muted}>Загружаем…</div>}

      {!busy && list.length === 0 && (
        <div className={styles.muted}>Пока никто не задавал вопросов в этом холле. Будь первым.</div>
      )}

      <div className={styles.insightList}>
        {list.map(q => (
          <button
            key={q.id}
            type="button"
            className={styles.insightCard}
            style={{ textAlign: 'left', cursor: 'pointer', background: 'transparent', border: '1px solid var(--line)', font: 'inherit', color: 'var(--text)', display: 'block', width: '100%' }}
            onClick={() => setOpenId(q.id)}
          >
            <div className={styles.insightHead}>
              <span style={{ color: 'var(--accent)' }}>❓</span>
              <span className={styles.insightAvatar}>{q.avatar || '🧑'}</span>
              <span className={styles.previewName} style={{ pointerEvents: 'none' }}>
                {q.display_name}
              </span>
              <span className={styles.muted}>{formatDate(q.created_at)}</span>
              <span className={styles.muted} style={{ marginLeft: 'auto' }}>
                {q.answers_count} {q.has_best_answer ? '· ✨' : ''}
              </span>
            </div>
            <div className={styles.insightText}>{q.text}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function HabitTickButton({ aspect }) {
  const [busy, setBusy] = useState(false)
  const [ticked, setTicked] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchHabitsToday()
      .then(({ aspects }) => { if (!cancelled) setTicked(aspects.includes(aspect)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [aspect])

  const handle = async () => {
    setBusy(true)
    try {
      if (ticked) {
        await untickHabit(aspect)
        setTicked(false)
      } else {
        await tickHabit(aspect)
        setTicked(true)
      }
    } catch {} finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`${styles.habitBtn} ${ticked ? styles.habitBtnDone : ''}`}
      onClick={handle}
      disabled={busy}
      title="Отметить сегодняшнюю практику по аспекту"
    >
      {ticked ? '✓ Практика сегодня' : '☐ Отметить практику'}
    </button>
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

function Stat({ label, value }) {
  return (
    <div className={styles.statItem}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

function trim(text, n) {
  if (!text) return ''
  const s = text.replace(/\n/g, ' ')
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
