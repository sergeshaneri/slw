import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY, type AspectInfo } from '../../data/aspects'
import {
  HALL_CONTENT,
  type HallContent, type HallQuote, type HallFigure, type HallArt, type HallArchetype, type HallFact,
} from '../../data/hallContent'
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
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import { useConfirm } from '../Confirm/ConfirmProvider'
import type { AspectKey } from '@/types/aspect'
import styles from './HallView.module.css'

// Backend hall.py routes (no response_model). Local types mirror the fields
// the UI reads.
// NOTE(ts): pending backend response_model for /api/hall/*.

// Одна страница холла без tab-split. Сверху видны: Суть → Чат → Канон →
// Архетипы. Ниже свёрнуто в Collapse: Инсайты / Вопросы / Топ юзеров /
// Уголок вдохновения / Моя статистика.
//
// До 2026-05 здесь было 5 вкладок (Обзор/Чат/Вопросы/Инсайты/Сообщество)
// или 2 вкладки (Об аспекте / Лента общения) — оба варианта прятали чат и
// курируемый канон за переключатели, что выглядело "скучно". Сейчас то и
// другое — главное на странице.

type HallPreviewInsight = {
  id: number
  user_id: number
  display_name: string
  avatar?: string | null
  text: string
}

type HallPreviewMessage = {
  id: number
  user_id: number
  display_name: string
  avatar?: string | null
  text: string
}

type HallOverview = {
  my_score?: number | null
  my_insights: number
  my_rank?: number | null
  active_24h: number
  last_insights: HallPreviewInsight[]
  last_messages: HallPreviewMessage[]
}

type HallMessage = {
  id: number
  user_id: number
  display_name: string
  avatar?: string | null
  text: string
  is_mine: boolean
  created_at: string
}

type HallMessagesResp = {
  messages: HallMessage[]
  last_id: number
}

type ReactionType = 'heart' | 'thanks' | 'aha' | 'fire'

type HallInsight = {
  id: number
  user_id: number
  display_name: string
  avatar?: string | null
  text: string
  kind: 'insight' | 'recommendation' | string
  created_at: string
  reactions?: Partial<Record<ReactionType, number>>
  my_reaction?: ReactionType | null
  likes?: number
  bookmarked_by_me?: boolean
}

type ReactionResp = {
  my_reaction: ReactionType | null
  reactions: Partial<Record<ReactionType, number>>
  total: number
}

type LeaderboardEntry = {
  user_id: number
  rank: number
  display_name: string
  avatar?: string | null
  insights_count: number
  likes_received: number
  is_me?: boolean
}

type InspirationType = 'film' | 'book' | 'music' | 'activity' | 'person' | 'other' | string

type Inspiration = {
  user_id: number
  display_name: string
  type: InspirationType
  title: string
  note?: string | null
}

type HallQuestion = {
  id: number
  user_id: number
  display_name: string
  avatar?: string | null
  text: string
  created_at: string
  answers_count: number
  has_best_answer?: boolean
}

type HallAnswer = {
  id: number
  user_id: number
  display_name: string
  avatar?: string | null
  text: string
  created_at: string
  is_best?: boolean
}

type HallThread = {
  question: HallQuestion
  answers: HallAnswer[]
}

type HabitsTodayResp = {
  aspects: Array<AspectKey | string>
}

const REACTIONS: ReadonlyArray<{ type: ReactionType; emoji: string }> = [
  { type: 'heart',  emoji: '♥' },
  { type: 'thanks', emoji: '🙏' },
  { type: 'aha',    emoji: '💡' },
  { type: 'fire',   emoji: '🔥' },
]

const INSPIRATION_ICON: Record<string, string> = {
  film: '🎬', book: '📚', music: '🎵', activity: '🏃', person: '👤', other: '✦',
}

const POLL_INTERVAL_MS = 5000

type HallViewProps = {
  aspect: AspectKey
  currentUserId: number | string | null | undefined
  onBack: () => void
  onOpenProfile?: (userId: number | string) => void
}

// Style extension for setting CSS custom properties via inline style.
type AccentCSS = CSSProperties & { '--accent'?: string }

export default function HallView({ aspect, currentUserId, onBack, onOpenProfile }: HallViewProps) {
  const accent = ASPECT_COLORS[aspect] || '#b39ddb'
  const meta: AspectInfo = ASPECT_DATA[aspect]
  const content: HallContent = HALL_CONTENT[aspect] ?? {}

  const archetypes = content.archetypes ?? []
  const hasCurated =
    (content.quotes?.length ?? 0) > 0 ||
    (content.figures?.length ?? 0) > 0 ||
    (content.arts?.length ?? 0) > 0 ||
    (content.interestingFacts?.length ?? 0) > 0

  const containerStyle: AccentCSS = { '--accent': accent }

  return (
    <div className={styles.container} style={containerStyle}>
      <button type="button" className={styles.backBtn} onClick={onBack}>← Назад</button>

      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Холл</span>
        <h1 className={styles.title} style={{ color: accent }}>
          {ASPECT_DISPLAY_KEY[aspect] ?? aspect} · {meta.name ?? 'Аспект'}
        </h1>
        {meta.metaphor && <div className={styles.subline}>{meta.metaphor}</div>}
        <HabitTickButton aspect={aspect} />
      </div>

      <div className={styles.tabBody}>
        {/* Чат холла — главный живой блок, виден сразу.
            «Суть аспекта» убрана из Холла 2026-05 — она дублирует то, что юзер
            видел на странице аспекта; здесь только живая активность и
            курируемые «интересности». */}
        <Section label="💬 Чат холла">
          <ChatList aspect={aspect} onOpenProfile={onOpenProfile} />
        </Section>

        {/* Интересности аспекта — курируемые цитаты / личности / произведения / факты.
            Раньше называлось «Канон аспекта» — переименовано в «Интересности»
            как более понятный термин для юзера. */}
        {hasCurated && (
          <Section label="📚 Интересности">
            <CanonBlock aspect={aspect} content={content} />
          </Section>
        )}

        {/* Архетипы аспекта — короткие плитки. */}
        {archetypes.length > 0 && (
          <Section label="🧠 Архетипы аспекта">
            <div className={styles.archetypeGrid}>
              {archetypes.map((a: HallArchetype) => (
                <div key={a.id ?? a.title} className={styles.archetypeCard}>
                  <div className={styles.archetypeIcon}>{a.emoji}</div>
                  <div className={styles.archetypeTitle}>{a.title}</div>
                  <div className={styles.archetypeDesc}>{a.desc}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── Свёрнутое ниже ─────────────────────────────────── */}

        <Collapse icon="💡" title="Инсайты по аспекту" hint="публиковать · читать · реагировать">
          <InsightsList
            aspect={aspect}
            currentUserId={currentUserId}
            onOpenProfile={onOpenProfile}
          />
        </Collapse>

        <Collapse icon="❓" title="Вопросы холла" hint="задать · ответить">
          <QuestionsList
            aspect={aspect}
            currentUserId={currentUserId}
            onOpenProfile={onOpenProfile}
          />
        </Collapse>

        <Collapse icon="🏆" title="Топ юзеров по аспекту">
          <TopUsersList aspect={aspect} onOpenProfile={onOpenProfile} />
        </Collapse>

        <Collapse icon="✦" title="Уголок вдохновения">
          <InspirationsList aspect={aspect} onOpenProfile={onOpenProfile} />
        </Collapse>

        <Collapse icon="📊" title="Моя статистика в холле">
          <MyStats aspect={aspect} />
        </Collapse>
      </div>
    </div>
  )
}

// ── CanonBlock: цитаты / личности / произведения / факты со случайной выборкой

type CanonBlockProps = {
  aspect: AspectKey
  content: HallContent
}

function CanonBlock({ aspect, content }: CanonBlockProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const refresh = () => setSeed(Math.floor(Math.random() * 1e9))

  const quotesSample = useMemo<HallQuote[]>(
    () => pickRandom<HallQuote>(content.quotes, 3, seed),
    [content.quotes, seed],
  )
  const figuresSample = useMemo<HallFigure[]>(() => {
    const all = content.figures ?? []
    const gifts   = all.filter(f => /^Дар\./i.test(f.name ?? ''))
    const shadows = all.filter(f => /^Тень\./i.test(f.name ?? ''))
    const giftPick   = pickRandom<HallFigure>(gifts, 1, seed)
    const shadowPick = pickRandom<HallFigure>(shadows, 1, seed + 1)
    if (giftPick.length + shadowPick.length === 0) return pickRandom<HallFigure>(all, 2, seed)
    return [...giftPick, ...shadowPick]
  }, [content.figures, seed])
  const artsSample = useMemo<HallArt[]>(
    () => pickRandom<HallArt>(content.arts, 3, seed),
    [content.arts, seed],
  )
  const factsSample = useMemo<HallFact[]>(
    () => pickRandom<HallFact>(content.interestingFacts, 3, seed),
    [content.interestingFacts, seed],
  )

  return (
    <>
      <div className={styles.curatedHead}>
        <span className={styles.curatedHeadText}>
          Случайные подборки. «🔀 Другая подборка» меняет набор.
        </span>
        <button type="button" className={styles.curatedShuffle} onClick={refresh}>
          🔀 Другая подборка
        </button>
      </div>

      {quotesSample.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            Цитаты — {quotesSample.length} из {content.quotes?.length ?? 0}
          </div>
          <div className={styles.quoteList}>
            {quotesSample.map((q, i) => (
              <blockquote key={`${seed}-q-${i}`} className={styles.quote}>
                «{q.text}»
                <footer className={styles.quoteAuthor}>— {q.author}</footer>
                {q.note && <div className={styles.curatedNote}>{q.note}</div>}
                <DiscussCuratedItem
                  aspect={aspect}
                  quoteBlock={`📜 «${q.text}» — ${q.author}`}
                  itemLabel="цитату"
                />
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {figuresSample.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            Личности — {figuresSample.length} из {content.figures?.length ?? 0}
          </div>
          <ul className={styles.figureList}>
            {figuresSample.map((f, i) => (
              <li key={`${seed}-f-${i}`} className={styles.figureItem}>
                <strong>{f.name}</strong>
                {f.note && <span className={styles.muted}> — {f.note}</span>}
                <DiscussCuratedItem
                  aspect={aspect}
                  quoteBlock={`👤 ${f.name}${f.note ? ` — ${f.note}` : ''}`}
                  itemLabel="личность"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {artsSample.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            Произведения — {artsSample.length} из {content.arts?.length ?? 0}
          </div>
          <div className={styles.artList}>
            {artsSample.map((a, i) => (
              <div key={`${seed}-a-${i}`} className={styles.artItem}>
                <span className={styles.inspirationIcon}>{INSPIRATION_ICON[a.type] ?? '✦'}</span>
                <span><strong>{a.title}</strong>{a.note ? ` — ${a.note}` : ''}</span>
                <DiscussCuratedItem
                  aspect={aspect}
                  quoteBlock={`🎨 ${a.title}${a.note ? ` — ${a.note}` : ''}`}
                  itemLabel="произведение"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Интересные факты — перенесены из карточки аспекта (был отдельный
          блок `facts`, теперь живут только в Холле, как цитаты/личности/искусство). */}
      {factsSample.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionLabel}>
            Факты — {factsSample.length} из {content.interestingFacts?.length ?? 0}
          </div>
          <ul className={styles.figureList}>
            {factsSample.map((f, i) => (
              <li key={`${seed}-fact-${i}`} className={styles.figureItem}>
                <strong>{f.name}</strong>
                {f.desc && <div className={styles.curatedNote} style={{ marginTop: 4 }}>{f.desc}</div>}
                <DiscussCuratedItem
                  aspect={aspect}
                  quoteBlock={`💡 ${f.name}${f.desc ? `\n\n${f.desc}` : ''}`}
                  itemLabel="факт"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ── ChatList ───────────────────────────────────────────────────────────────

type ChatListProps = {
  aspect: AspectKey
  onOpenProfile?: (userId: number | string) => void
}

function ChatList({ aspect, onOpenProfile }: ChatListProps) {
  const [messages, setMessages] = useState<HallMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastId, setLastId] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [sendKeyMode] = useSendKeyMode()
  const confirm = useConfirm()

  // Initial load.
  useEffect(() => {
    let cancelled = false
    fetchHallMessages(aspect, 0, 100)
      .then((resp) => {
        if (cancelled) return
        const { messages: msgs, last_id } = resp as HallMessagesResp
        setMessages(msgs)
        setLastId(last_id)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить чат'))
    return () => { cancelled = true }
  }, [aspect])

  // Polling.
  useEffect(() => {
    if (lastId === 0) return
    const id = setInterval(async () => {
      try {
        const { messages: fresh, last_id } =
          (await fetchHallMessages(aspect, lastId, 100)) as HallMessagesResp
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
      const msg = (await postHallMessage(aspect, t)) as HallMessage
      setMessages(prev => [...prev, msg])
      setLastId(prev => Math.max(prev, msg.id))
      setText('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: number) => {
    const msg = messages.find(m => m.id === id)
    const preview = (msg?.text ?? '').slice(0, 80)
    const ok = await confirm({
      title: 'Удалить сообщение?',
      body: (
        <>
          {preview ? <>«{preview}{(msg?.text?.length ?? 0) > 80 ? '…' : ''}»</> : 'Это сообщение'} пропадёт
          из чата холла. <strong>Вернуть не получится.</strong>
        </>
      ),
      confirmLabel: 'Удалить',
      cancelLabel: 'Оставить',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteHallMessage(aspect, id)
      setMessages(prev => prev.filter(m => m.id !== id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  return (
    <>
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
            if (shouldSendOnKeyDown(e, sendKeyMode)) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Напиши что-то в холл…"
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
    </>
  )
}

// ── InsightsList — лента + inline-композер ────────────────────────────────

type InsightsListProps = {
  aspect: AspectKey
  currentUserId: number | string | null | undefined
  onOpenProfile?: (userId: number | string) => void
}

function InsightsList({ aspect, currentUserId, onOpenProfile }: InsightsListProps) {
  const [items, setItems] = useState<HallInsight[]>([])
  const [busy, setBusy] = useState(true)
  const [sort, setSort] = useState<'new' | 'popular'>('new')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<'insight' | 'recommendation'>('insight')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendKeyMode] = useSendKeyMode()

  const reload = async () => {
    setBusy(true)
    try {
      const list = (await fetchHallInsights(aspect, sort)) as HallInsight[]
      setItems(list ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить')
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось опубликовать')
    } finally {
      setPosting(false)
    }
  }

  const handleReact = async (insightId: number, reaction: ReactionType) => {
    try {
      const { my_reaction, reactions, total } =
        (await reactToInsightWithComment(insightId, reaction)) as ReactionResp
      setItems(prev => prev.map(i =>
        i.id === insightId
          ? { ...i, my_reaction, reactions, likes: total }
          : i
      ))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось реакция')
    }
  }

  const handleBookmark = async (insightId: number, current: boolean | undefined) => {
    try {
      if (current) await unbookmarkInsight(insightId)
      else await bookmarkInsight(insightId)
      setItems(prev => prev.map(i =>
        i.id === insightId ? { ...i, bookmarked_by_me: !current } : i
      ))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось')
    }
  }

  return (
    <>
      <Section label="Опубликовать в холл">
        <div className={styles.composer}>
          <div className={styles.composerRow}>
            <select
              className={styles.select}
              value={kind}
              onChange={e => setKind(e.target.value as 'insight' | 'recommendation')}
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
            onKeyDown={e => {
              if (shouldSendOnKeyDown(e, sendKeyMode) && text.trim() && !posting) {
                e.preventDefault()
                handlePost()
              }
            }}
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
    </>
  )
}

// ── QuestionsList — список + inline-композер + thread ──────────────────────

type QuestionsListProps = {
  aspect: AspectKey
  currentUserId: number | string | null | undefined
  onOpenProfile?: (userId: number | string) => void
}

function QuestionsList({ aspect, currentUserId, onOpenProfile }: QuestionsListProps) {
  const [list, setList] = useState<HallQuestion[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [thread, setThread] = useState<HallThread | null>(null)
  const [busy, setBusy] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askText, setAskText] = useState('')
  const [sendKeyMode] = useSendKeyMode()
  const [answerText, setAnswerText] = useState('')

  const reloadList = async () => {
    setBusy(true)
    try {
      const data = (await fetchHallQuestions(aspect, 50)) as HallQuestion[]
      setList(data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить вопросы')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reloadList() /* eslint-disable-next-line */ }, [aspect])

  useEffect(() => {
    if (!openId) { setThread(null); return }
    fetchHallQuestion(aspect, openId)
      .then((t) => setThread(t as HallThread))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось'))
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось')
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
      const fresh = (await fetchHallQuestion(aspect, openId)) as HallThread
      setThread(fresh)
      reloadList()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось')
    } finally {
      setPosting(false)
    }
  }

  const handleMarkBest = async (answerId: number) => {
    if (!openId) return
    try {
      await markBestAnswer(aspect, openId, answerId)
      const fresh = (await fetchHallQuestion(aspect, openId)) as HallThread
      setThread(fresh)
      reloadList()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось')
    }
  }

  if (openId && thread) {
    const isQuestionAuthor = thread.question.user_id === currentUserId
    return (
      <>
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
            onKeyDown={e => {
              if (shouldSendOnKeyDown(e, sendKeyMode) && answerText.trim() && !posting) {
                e.preventDefault()
                handleAnswer()
              }
            }}
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
      </>
    )
  }

  return (
    <>
      <Section label="Задать вопрос холлу">
        <textarea
          className={styles.textarea}
          value={askText}
          onChange={e => setAskText(e.target.value)}
          onKeyDown={e => {
            if (shouldSendOnKeyDown(e, sendKeyMode) && askText.trim() && !posting) {
              e.preventDefault()
              handleAsk()
            }
          }}
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
    </>
  )
}

// ── TopUsersList — рейтинг участников холла ────────────────────────────────

type TopUsersListProps = {
  aspect: AspectKey
  onOpenProfile?: (userId: number | string) => void
}

function TopUsersList({ aspect, onOpenProfile }: TopUsersListProps) {
  const [top, setTop] = useState<LeaderboardEntry[]>([])
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    fetchHallLeaderboard(aspect)
      .then(t => setTop((t as LeaderboardEntry[]) ?? []))
      .catch(() => {})
      .finally(() => setBusy(false))
  }, [aspect])

  if (busy) return <div className={styles.muted}>Загружаем…</div>
  if (top.length === 0) {
    return <div className={styles.muted}>Пока пусто. Опубликуй первый инсайт — попадёшь в топ.</div>
  }

  return (
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
  )
}

// ── InspirationsList — UGC вдохновение ─────────────────────────────────────

type InspirationsListProps = {
  aspect: AspectKey
  onOpenProfile?: (userId: number | string) => void
}

function InspirationsList({ aspect, onOpenProfile }: InspirationsListProps) {
  const [items, setItems] = useState<Inspiration[]>([])
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    fetchHallInspirations(aspect)
      .then(i => setItems((i as Inspiration[]) ?? []))
      .catch(() => {})
      .finally(() => setBusy(false))
  }, [aspect])

  if (busy) return <div className={styles.muted}>Загружаем…</div>
  if (items.length === 0) {
    return (
      <div className={styles.muted}>
        Пока пусто. Добавь карточку вдохновения с тегом «{ASPECT_DISPLAY_KEY[aspect] ?? aspect}»
        в свой профиль — появится здесь.
      </div>
    )
  }

  return (
    <div className={styles.inspirationGrid}>
      {items.map((it, idx) => (
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
  )
}

// ── MyStats — личная статистика в холле ────────────────────────────────────

function MyStats({ aspect }: { aspect: AspectKey }) {
  const [data, setData] = useState<HallOverview | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    fetchHallOverview(aspect)
      .then(d => setData(d as HallOverview))
      .catch(() => {})
      .finally(() => setBusy(false))
  }, [aspect])

  if (busy) return <div className={styles.muted}>Загружаем…</div>
  if (!data) return <div className={styles.muted}>Нет данных.</div>

  return (
    <div className={styles.statsGrid}>
      <Stat label="Твоя оценка" value={data.my_score != null ? data.my_score.toFixed(1) : '—'} />
      <Stat label="Твоих инсайтов" value={data.my_insights} />
      <Stat label="Твоё место" value={data.my_rank ? `#${data.my_rank}` : '—'} />
      <Stat label="Активны за сутки" value={data.active_24h} />
    </div>
  )
}

// ── Collapse ───────────────────────────────────────────────────────────────

type CollapseProps = {
  icon: string
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}

function Collapse({ icon, title, hint, defaultOpen = false, children }: CollapseProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.collapse}>
      <button
        type="button"
        className={`${styles.collapseHeader} ${open ? styles.collapseHeaderOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={styles.collapseChevron} aria-hidden="true">▶</span>
        <span className={styles.collapseIcon} aria-hidden="true">{icon}</span>
        <span className={styles.collapseTitle}>{title}</span>
        {hint && <span className={styles.collapseHint}>{hint}</span>}
      </button>
      {open && <div className={styles.collapseBody}>{children}</div>}
    </div>
  )
}

// ── DiscussCuratedItem ─────────────────────────────────────────────────────

// При отправке делает 2 POST параллельно:
//  - postInsight — попадает в ленту инсайтов аспекта и в ленту юзера
//  - postHallMessage — попадает в чат по аспекту (для оживления процесса)
type DiscussCuratedItemProps = {
  aspect: AspectKey
  quoteBlock: string
  itemLabel: string
}

function DiscussCuratedItem({ aspect, quoteBlock, itemLabel }: DiscussCuratedItemProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendKeyMode] = useSendKeyMode()

  const canSubmit = text.trim().length > 0 && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const composed = `${quoteBlock}\n\n${text.trim()}`
    try {
      await Promise.all([
        postInsight({ aspect, kind: 'insight', text: composed, isPublic: true }),
        postHallMessage(aspect, composed)
      ])
      setDone(true)
      setText('')
      setOpen(false)
      setTimeout(() => setDone(false), 4000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось опубликовать')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className={styles.discussSuccess}>
        ✓ Опубликовано. Найдёшь в Чате этого аспекта, в Ленте инсайтов аспекта
        и в Своих инсайтах в твоём профиле.
      </div>
    )
  }

  if (!open) {
    return (
      <div className={styles.curatedActions}>
        <button
          type="button"
          className={styles.discussToggleBtn}
          onClick={() => setOpen(true)}
        >
          💬 Обсудить эту {itemLabel}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.discussBox}>
      <textarea
        className={styles.discussTextarea}
        placeholder="Твой комментарий, наблюдение, вопрос…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (shouldSendOnKeyDown(e, sendKeyMode) && canSubmit) {
            e.preventDefault()
            submit()
          }
        }}
        disabled={busy}
        autoFocus
      />
      <div className={styles.discussHint}>
        Цитируемый объект автоматически добавится к посту. Появится в трёх местах:
        чат аспекта, лента инсайтов аспекта, твоя лента инсайтов.
      </div>
      {error && <div className={styles.discussError}>{error}</div>}
      <div className={styles.discussActions}>
        <button
          type="button"
          className={styles.discussCancel}
          onClick={() => { setOpen(false); setText(''); setError(null) }}
          disabled={busy}
        >
          Отмена
        </button>
        <button
          type="button"
          className={styles.discussSubmit}
          onClick={submit}
          disabled={!canSubmit}
        >
          {busy ? 'Публикую…' : 'Опубликовать'}
        </button>
      </div>
    </div>
  )
}

function HabitTickButton({ aspect }: { aspect: AspectKey }) {
  const [busy, setBusy] = useState(false)
  const [ticked, setTicked] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchHabitsToday()
      .then((data) => {
        if (cancelled) return
        const { aspects } = (data as HabitsTodayResp) ?? { aspects: [] }
        setTicked(aspects.includes(aspect))
      })
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

type SectionProps = {
  label: string
  children: ReactNode
}

function Section({ label, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </section>
  )
}

type StatProps = {
  label: string
  value: ReactNode
}

function Stat({ label, value }: StatProps) {
  return (
    <div className={styles.statItem}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

// Утилита: вернуть n случайных уникальных элементов массива (или меньше, если
// массив короче). Seed используется для детерминированности на одно «обновление».
function pickRandom<T>(arr: ReadonlyArray<T> | undefined | null, n: number, seed: number): T[] {
  if (!Array.isArray(arr) || arr.length === 0) return []
  // Простой PRNG на seed (Mulberry32) — детерминированный для конкретного seed.
  let s = seed | 0
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pool = arr.map((item, i) => ({ item, k: rand() + i * 1e-9 }))
  pool.sort((a, b) => a.k - b.k)
  return pool.slice(0, n).map(x => x.item)
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
