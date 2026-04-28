import { useEffect, useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import { fetchPublicProfile, reactToInsight, fetchInsightReactions } from '../../api/client'
import ReactorsList from './ReactorsList'
import styles from './PublicProfileView.module.css'

const KIND_LABEL = {
  insight: 'инсайт',
  recommendation: 'рекомендация',
}

const INSPIRATION_TYPE_LABEL = {
  film: '🎬',
  book: '📚',
  music: '🎵',
  activity: '🏃',
  person: '👤',
  other: '✦',
}

const REACTIONS = [
  { type: 'heart',  emoji: '♥', title: 'нравится' },
  { type: 'thanks', emoji: '🙏', title: 'спасибо' },
  { type: 'aha',    emoji: '💡', title: 'осенило' },
  { type: 'fire',   emoji: '🔥', title: 'топ' },
]

export default function PublicProfileView({ userId, currentUserId, onBack, onOpenProfile }) {
  const [profile, setProfile] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  // id инсайтов, для которых раскрыт список реагировавших
  const [reactorsOpen, setReactorsOpen] = useState(() => new Set())

  useEffect(() => {
    if (!userId) return
    setBusy(true)
    setError(null)
    fetchPublicProfile(userId)
      .then(setProfile)
      .catch(e => {
        setError(e.status === 404
          ? 'Этот профиль не найден или скрыт владельцем.'
          : (e.message ?? 'Не удалось загрузить профиль'))
      })
      .finally(() => setBusy(false))
  }, [userId])

  const handleReact = async (insightId, reaction) => {
    try {
      const { my_reaction, reactions, total } = await reactToInsight(insightId, reaction)
      setProfile(p => ({
        ...p,
        insights: (p.insights ?? []).map(i =>
          i.id === insightId
            ? {
                ...i,
                my_reaction,
                liked_by_me: my_reaction !== null,
                reactions,
                likes: total,
              }
            : i
        ),
      }))
    } catch (e) {
      setError(e.message ?? 'Не удалось поставить реакцию')
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
  const sortedScores = Object.entries(profile.scores ?? {})
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => b[1] - a[1])

  return (
    <div className={styles.container}>
      <BackBtn onBack={onBack} />

      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Профиль</span>
        <h1 className={styles.title}>
          {profile.display_name}
          {isMe && <span className={styles.youBadge}>ты</span>}
        </h1>
        <div className={styles.statsRow}>
          <span><strong>{profile.xp}</strong> XP</span>
          {(profile.focus_aspects ?? []).length > 0 && (
            <span className={styles.focusList}>
              · развивает:
              {profile.focus_aspects.map(a => (
                <span
                  key={a}
                  className={styles.focusChip}
                  style={{ color: ASPECT_COLORS[a], borderColor: `${ASPECT_COLORS[a]}55` }}
                >
                  {a}
                </span>
              ))}
            </span>
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
            {profile.interests.map(t => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
        </Section>
      )}

      {(profile.goals ?? []).length > 0 && (
        <Section label="Текущие цели">
          <ol className={styles.goalsList}>
            {profile.goals.map((g, i) => (
              <li key={i} className={styles.goalItem}>{g}</li>
            ))}
          </ol>
        </Section>
      )}

      {(profile.inspirations ?? []).length > 0 && (
        <Section label="Что вдохновляет">
          <div className={styles.inspirationGrid}>
            {profile.inspirations.map((it, idx) => (
              <div
                key={idx}
                className={styles.inspirationCard}
                style={it.aspect ? { borderColor: `${ASPECT_COLORS[it.aspect]}55` } : undefined}
              >
                <div className={styles.inspirationHead}>
                  <span className={styles.inspirationIcon}>
                    {INSPIRATION_TYPE_LABEL[it.type] ?? '✦'}
                  </span>
                  {it.aspect && (
                    <span style={{ color: ASPECT_COLORS[it.aspect] }} className={styles.inspirationAspect}>
                      {it.aspect}
                    </span>
                  )}
                </div>
                <div className={styles.inspirationTitle}>{it.title}</div>
                {it.note && <div className={styles.inspirationNote}>{it.note}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(profile.achievements ?? []).length > 0 && (
        <Section label={`Достижения · ${profile.achievements.length}`}>
          <div className={styles.achievementsRow}>
            {profile.achievements.map(a => (
              <div key={a.code} className={styles.achievementBadge} title={a.desc}>
                <span className={styles.achievementBadgeIcon}>{a.icon}</span>
                <span className={styles.achievementBadgeTitle}>{a.title}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {sortedScores.length > 0 && (
        <Section label="Оценки по аспектам">
          <div className={styles.scoresList}>
            {sortedScores.map(([aspect, value]) => (
              <div key={aspect} className={styles.scoreRow}>
                <span style={{ color: ASPECT_COLORS[aspect] }} className={styles.scoreAspect}>
                  {aspect}
                </span>
                <span className={styles.scoreName}>{ASPECT_DATA[aspect]?.name ?? ''}</span>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreBarFill}
                    style={{
                      width: `${(value / 10) * 100}%`,
                      background: ASPECT_COLORS[aspect],
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
            {profile.insights.map(ins => (
              <div
                key={ins.id}
                className={styles.insightCard}
                style={{ borderColor: `${ASPECT_COLORS[ins.aspect]}55` }}
              >
                <div className={styles.insightHead}>
                  <span style={{ color: ASPECT_COLORS[ins.aspect] }} className={styles.insightAspect}>
                    {ins.aspect} · {ASPECT_DATA[ins.aspect]?.name ?? ''}
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
                </div>
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

function Section({ label, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </section>
  )
}

function BackBtn({ onBack }) {
  if (!onBack) return null
  return (
    <button type="button" className={styles.backBtn} onClick={onBack}>
      ← Назад
    </button>
  )
}
