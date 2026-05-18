import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import {
  fetchPublicProfile,
  reactToInsightWithComment,
  followUser,
  unfollowUser,
  bookmarkInsight,
  unbookmarkInsight,
} from '../../api/client'
import ReactorsList from './ReactorsList'
import Heatmap from '../Heatmap/Heatmap'
import { tmaHaptic } from '../../tma/hooks'
import type { AspectKey, AspectScores } from '@/types/aspect'
import type { ApiError } from '../../api/client'
import styles from './PublicProfileView.module.css'

// Public profile shape — backend has no response_model for /api/profile/{id}
// yet. Captures the fields we actually read.
// NOTE(ts): pending backend response_model for /api/profile/{user_id}.
type Insight = {
  id: number | string
  aspect: AspectKey | string
  kind: 'insight' | 'recommendation' | string
  text: string
  likes?: number
  reactions?: Record<string, number>
  my_reaction?: ReactionType | null
  my_comment?: string | null
  liked_by_me?: boolean
  bookmarked_by_me?: boolean
  is_public?: boolean
}

type Inspiration = {
  type: 'film' | 'book' | 'music' | 'activity' | 'person' | 'other' | string
  title: string
  note?: string | null
  aspect?: AspectKey | string | null
}

type Achievement = {
  code: string
  title: string
  icon: string
  desc: string
}

type PublicProfile = {
  user_id: number | string
  display_name: string
  avatar?: string | null
  bio?: string | null
  xp: number
  followers_count?: number
  is_followed_by_me?: boolean
  focus_aspects?: Array<AspectKey | string>
  interests?: string[]
  goals?: string[]
  inspirations?: Inspiration[]
  achievements?: Achievement[]
  scores?: AspectScores | Record<string, number>
  insights?: Insight[]
}

type ReactionType = 'heart' | 'thanks' | 'aha' | 'fire'

const KIND_LABEL: Record<string, string> = {
  insight: 'инсайт',
  recommendation: 'рекомендация',
}

const INSPIRATION_TYPE_LABEL: Record<string, string> = {
  film: '🎬',
  book: '📚',
  music: '🎵',
  activity: '🏃',
  person: '👤',
  other: '✦',
}

const REACTIONS: ReadonlyArray<{ type: ReactionType; emoji: string; title: string }> = [
  { type: 'heart',  emoji: '♥', title: 'нравится' },
  { type: 'thanks', emoji: '🙏', title: 'спасибо' },
  { type: 'aha',    emoji: '💡', title: 'осенило' },
  { type: 'fire',   emoji: '🔥', title: 'топ' },
]

type Props = {
  userId: number | string | null | undefined
  currentUserId: number | string | null | undefined
  onBack?: () => void
  onOpenProfile?: (userId: number | string) => void
  onOpenDM?: (userId: number | string) => void
}

export default function PublicProfileView({ userId, currentUserId, onBack, onOpenProfile, onOpenDM }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  // id инсайтов, для которых раскрыт список реагировавших
  const [reactorsOpen, setReactorsOpen] = useState<Set<number | string>>(() => new Set())
  // Collapse-by-default для длинных списков. У активного юзера может
  // быть 20+ inspirations и 50+ инсайтов — раскрываются по кнопке.
  const [showAllInspirations, setShowAllInspirations] = useState<boolean>(false)
  const [showAllInsights, setShowAllInsights] = useState<boolean>(false)

  useEffect(() => {
    if (!userId) return
    setBusy(true)
    setError(null)
    fetchPublicProfile(userId)
      .then(p => setProfile(p as PublicProfile))
      .catch((e: ApiError | Error) => {
        const status = (e as Partial<ApiError>).status
        setError(status === 404
          ? 'Этот профиль не найден или скрыт владельцем.'
          : (e instanceof Error ? e.message : 'Не удалось загрузить профиль'))
      })
      .finally(() => setBusy(false))
  }, [userId])

  const handleReact = async (insightId: number | string, reaction: ReactionType, comment?: string) => {
    tmaHaptic('light')   // вибро в TG на тапе по реакции
    try {
      const resp = await reactToInsightWithComment(insightId, reaction, comment) as {
        my_reaction: ReactionType | null
        my_comment: string | null
        reactions: Record<string, number>
        total: number
      }
      const { my_reaction, my_comment, reactions, total } = resp
      setProfile(p => p ? ({
        ...p,
        insights: (p.insights ?? []).map(i =>
          i.id === insightId
            ? {
                ...i,
                my_reaction,
                my_comment,
                liked_by_me: my_reaction !== null,
                reactions,
                likes: total,
              }
            : i
        ),
      }) : p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось поставить реакцию')
    }
  }

  const handleBookmark = async (insightId: number | string, current: boolean | undefined) => {
    try {
      if (current) await unbookmarkInsight(insightId)
      else await bookmarkInsight(insightId)
      setProfile(p => p ? ({
        ...p,
        insights: (p.insights ?? []).map(i =>
          i.id === insightId ? { ...i, bookmarked_by_me: !current } : i
        ),
      }) : p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось')
    }
  }

  const handleFollow = async () => {
    if (!profile) return
    try {
      const fn = profile.is_followed_by_me ? unfollowUser : followUser
      const resp = await fn(profile.user_id) as { following: boolean; followers_count: number }
      const { following, followers_count } = resp
      setProfile(p => p ? ({ ...p, is_followed_by_me: following, followers_count }) : p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить подписку')
    }
  }

  if (busy) return <div className={styles.container}><div className={styles.muted}>Загрузка профиля…</div></div>

  if (error) {
    return (
      <div className={styles.container}>
        <BackBtn onBack={onBack} />
        <div className={styles.errorBlock}>{error}</div>
      </div>
    )
  }

  if (!profile) return null

  const isMe = profile.user_id === currentUserId
  const sortedScores: Array<[string, number]> = Object.entries(profile.scores ?? {})
    .filter((entry): entry is [string, number] => Number.isFinite(entry[1] as number))
    .sort((a, b) => b[1] - a[1])

  // ASPECT_COLORS / ASPECT_DATA / ASPECT_DISPLAY_KEY indexed by AspectKey
  // (Latin). Backend may return Cyrillic codes too — both ends are accessed
  // by string here, fall back via lookup.
  const colorOf = (a: string): string => (ASPECT_COLORS as Record<string, string>)[a] ?? ''
  const nameOf = (a: string): string => (ASPECT_DATA as Record<string, { name: string }>)[a]?.name ?? ''
  const displayOf = (a: string): string => (ASPECT_DISPLAY_KEY as Record<string, string>)[a] ?? a

  return (
    <div className={styles.container}>
      <BackBtn onBack={onBack} />

      <div className={styles.titleBlock}>
        <div className={styles.titleRow}>
          <div className={styles.avatarBig}>{profile.avatar || '🧑'}</div>
          <div className={styles.titleText}>
            <span className={styles.eyebrow}>Профиль</span>
            <h1 className={styles.title}>
              {profile.display_name}
              {isMe && <span className={styles.youBadge}>ты</span>}
            </h1>
            <div className={styles.statsRow}>
              <span><strong>{profile.xp}</strong> XP</span>
              <span>· <strong>{profile.followers_count ?? 0}</strong> подписчиков</span>
              {(profile.focus_aspects ?? []).length > 0 && (
                <span className={styles.focusList}>
                  · развивает:
                  {profile.focus_aspects!.map(a => (
                    <span
                      key={a}
                      className={styles.focusChip}
                      style={{ color: colorOf(a), borderColor: `${colorOf(a)}55` }}
                    >
                      {displayOf(a)}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
          {!isMe && currentUserId != null && (
            <div className={styles.actionStack}>
              <button
                type="button"
                className={`${styles.followBtn} ${profile.is_followed_by_me ? styles.followBtnActive : ''}`}
                onClick={handleFollow}
              >
                {profile.is_followed_by_me ? '✓ Подписан' : '+ Подписаться'}
              </button>
              {onOpenDM && (
                <button
                  type="button"
                  className={styles.dmBtn}
                  onClick={() => onOpenDM(profile.user_id)}
                  title="Доступно при взаимной подписке"
                >
                  ✉ Написать
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {profile.bio && (
        <Section label="О себе">
          <div className={styles.bioText}>{profile.bio}</div>
        </Section>
      )}

      {(profile.interests ?? []).length > 0 && (
        <Section label="Интересы">
          <div className={styles.tagList}>
            {profile.interests!.map(t => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
        </Section>
      )}

      {(profile.goals ?? []).length > 0 && (
        <Section label="Текущие цели">
          <ol className={styles.goalsList}>
            {profile.goals!.map((g, i) => (
              <li key={i} className={styles.goalItem}>{g}</li>
            ))}
          </ol>
        </Section>
      )}

      {(profile.inspirations ?? []).length > 0 && (
        <Section label="Что вдохновляет">
          <div className={styles.inspirationGrid}>
            {profile.inspirations!
              .slice(0, showAllInspirations ? undefined : 6)
              .map((it, idx) => (
              <div
                key={idx}
                className={styles.inspirationCard}
                style={it.aspect ? { borderColor: `${colorOf(it.aspect)}55` } : undefined}
              >
                <div className={styles.inspirationHead}>
                  <span className={styles.inspirationIcon}>
                    {INSPIRATION_TYPE_LABEL[it.type] ?? '✦'}
                  </span>
                  {it.aspect && (
                    <span style={{ color: colorOf(it.aspect) }} className={styles.inspirationAspect}>
                      {displayOf(it.aspect)}
                    </span>
                  )}
                </div>
                <div className={styles.inspirationTitle}>{it.title}</div>
                {it.note && <div className={styles.inspirationNote}>{it.note}</div>}
              </div>
            ))}
          </div>
          {(profile.inspirations ?? []).length > 6 && (
            <button
              type="button"
              className={styles.expandBtn}
              onClick={() => setShowAllInspirations(v => !v)}
            >
              {showAllInspirations
                ? '↑ Свернуть'
                : `↓ Показать все ${profile.inspirations!.length} карточек`}
            </button>
          )}
        </Section>
      )}

      {(profile.achievements ?? []).length > 0 && (
        <Section label={`Достижения · ${profile.achievements!.length}`}>
          <div className={styles.achievementsRow}>
            {profile.achievements!.map(a => (
              <div key={a.code} className={styles.achievementBadge} title={a.desc}>
                <span className={styles.achievementBadgeIcon}>{a.icon}</span>
                <span className={styles.achievementBadgeTitle}>{a.title}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section label="Активность за полгода">
        <Heatmap userId={profile.user_id} days={180} />
      </Section>

      {sortedScores.length > 0 && (
        <Section label="Оценки по аспектам">
          <div className={styles.scoresList}>
            {sortedScores.map(([aspect, value]) => (
              <div key={aspect} className={styles.scoreRow}>
                <span style={{ color: colorOf(aspect) }} className={styles.scoreAspect}>
                  {aspect}
                </span>
                <span className={styles.scoreName}>{nameOf(aspect)}</span>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreBarFill}
                    style={{
                      width: `${(value / 10) * 100}%`,
                      background: colorOf(aspect),
                    }}
                  />
                </div>
                <span className={styles.scoreValue}>{value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(profile.insights ?? []).length > 0 && (
        <Section label="Инсайты и рекомендации">
          <div className={styles.insightList}>
            {profile.insights!
              .slice(0, showAllInsights ? undefined : 10)
              .map(ins => (
              <div
                key={ins.id}
                className={styles.insightCard}
                style={{ borderColor: `${colorOf(ins.aspect as string)}55` }}
              >
                <div className={styles.insightHead}>
                  <span style={{ color: colorOf(ins.aspect as string) }} className={styles.insightAspect}>
                    {displayOf(ins.aspect as string)} · {nameOf(ins.aspect as string)}
                  </span>
                  <span className={styles.insightKind}>{KIND_LABEL[ins.kind] ?? ins.kind}</span>
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
                        disabled={isMe}
                        title={isMe ? 'Нельзя реагировать на свои инсайты' : r.title}
                      >
                        <span className={styles.reactionEmoji}>{r.emoji}</span>
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
                {!isMe && ins.my_reaction && (
                  <ReactionCommentInput
                    initial={ins.my_comment ?? ''}
                    onSave={(comment) => handleReact(ins.id, ins.my_reaction as ReactionType, comment)}
                  />
                )}
                {(() => {
                  const total = ins.likes ?? Object.values(ins.reactions ?? {}).reduce((a, b) => a + b, 0)
                  if (total === 0) return null
                  const isOpen = reactorsOpen.has(ins.id)
                  return (
                    <>
                      <button
                        type="button"
                        className={styles.reactorsToggle}
                        onClick={() => setReactorsOpen(prev => {
                          const next = new Set(prev)
                          if (next.has(ins.id)) next.delete(ins.id)
                          else next.add(ins.id)
                          return next
                        })}
                      >
                        {isOpen ? '▲ скрыть' : `👥 кто реагировал (${total})`}
                      </button>
                      <ReactorsList
                        insightId={ins.id}
                        open={isOpen}
                        onOpenProfile={onOpenProfile}
                      />
                    </>
                  )
                })()}
              </div>
            ))}
          </div>
          {(profile.insights ?? []).length > 10 && (
            <button
              type="button"
              className={styles.expandBtn}
              onClick={() => setShowAllInsights(v => !v)}
            >
              {showAllInsights
                ? '↑ Свернуть'
                : `↓ Показать все ${profile.insights!.length} инсайтов`}
            </button>
          )}
        </Section>
      )}

      {(!profile.bio
        && !(profile.focus_aspects ?? []).length
        && !(profile.interests ?? []).length
        && !(profile.inspirations ?? []).length
        && !(profile.goals ?? []).length
        && !(profile.insights ?? []).length) && (
        <div className={styles.empty}>
          Этот юзер ещё не заполнил профиль.
        </div>
      )}
    </div>
  )
}

type SectionProps = { label: string; children: ReactNode }

function Section({ label, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </section>
  )
}

function BackBtn({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null
  return (
    <button type="button" className={styles.backBtn} onClick={onBack}>
      ← Назад
    </button>
  )
}

type CommentInputProps = {
  initial: string
  onSave: (comment: string) => void | Promise<void>
}

/**
 * Inline-инпут для коммента к реакции. Появляется когда юзер уже поставил
 * реакцию на инсайт. По нажатию «Сохранить» обновляет коммент через
 * существующий react-эндпоинт (тот же reaction + новый comment).
 */
function ReactionCommentInput({ initial, onSave }: CommentInputProps) {
  const [text, setText] = useState<string>(initial)
  const [editing, setEditing] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)

  useEffect(() => { setText(initial) }, [initial])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(text.trim())
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (!editing && !initial) {
    return (
      <button
        type="button"
        className={styles.commentToggle}
        onClick={() => setEditing(true)}
      >
        ✎ добавить коммент к реакции
      </button>
    )
  }

  if (!editing && initial) {
    return (
      <div className={styles.myCommentRow}>
        <span className={styles.myCommentText}>{initial}</span>
        <button
          type="button"
          className={styles.commentToggle}
          onClick={() => setEditing(true)}
        >
          ✎ изменить
        </button>
      </div>
    )
  }

  return (
    <div className={styles.commentEdit}>
      <input
        type="text"
        className={styles.commentInput}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Коротко скажи почему откликнулось…"
        maxLength={300}
      />
      <button
        type="button"
        className={styles.commentSave}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? '…' : '✓'}
      </button>
      <button
        type="button"
        className={styles.commentCancel}
        onClick={() => { setText(initial); setEditing(false) }}
      >
        ×
      </button>
    </div>
  )
}
