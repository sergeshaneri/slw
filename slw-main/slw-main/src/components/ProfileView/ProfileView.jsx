import { useEffect, useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import {
  fetchMyProfile,
  updateMyProfile,
  postInsight,
  deleteInsight,
  fetchMySubscriptions,
  fetchMyFollowers,
} from '../../api/client'
import ReactorsList from '../PublicProfileView/ReactorsList'
import Heatmap from '../Heatmap/Heatmap'
import styles from './ProfileView.module.css'

const AVATAR_OPTIONS = [
  '🧑', '🧙', '🧝', '🌱', '🌟', '🦊', '🦉', '🐻', '🦁', '🐉',
  '🌊', '🔥', '⚡', '🌙', '☀', '🌌', '✨', '💎', '🎭', '🎨',
]

const INSPIRATION_TYPES = [
  ['film', 'Фильм'],
  ['book', 'Книга'],
  ['music', 'Музыка'],
  ['activity', 'Активность'],
  ['person', 'Человек'],
  ['other', 'Другое'],
]

const KIND_LABEL = {
  insight: 'инсайт',
  recommendation: 'рекомендация',
}

export default function ProfileView({ onOpenPublicProfile, onOpenSettings }) {
  const [profile, setProfile] = useState(null)
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [subsList, setSubsList] = useState([])
  const [followersList, setFollowersList] = useState([])
  const [subsTab, setSubsTab] = useState(null) // 'subs' | 'followers' | null
  // id своих инсайтов, для которых раскрыт список реагировавших
  const [reactorsOpen, setReactorsOpen] = useState(() => new Set())

  // Локальные черновики
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState('')
  const [focusAspects, setFocusAspects] = useState([])
  const [interestInput, setInterestInput] = useState('')
  const [interests, setInterests] = useState([])
  const [inspirations, setInspirations] = useState([])
  const [goals, setGoals] = useState(['', '', ''])

  // Новый инсайт
  const [insightAspect, setInsightAspect] = useState('БС')
  const [insightKind, setInsightKind] = useState('insight')
  const [insightText, setInsightText] = useState('')
  const [insightPublic, setInsightPublic] = useState(true)

  useEffect(() => {
    fetchMyProfile()
      .then(p => {
        setProfile(p)
        setBio(p.bio ?? '')
        setAvatar(p.avatar ?? '')
        setFocusAspects(p.focus_aspects ?? [])
        setInterests(p.interests ?? [])
        setInspirations(p.inspirations ?? [])
        const g = p.goals ?? []
        setGoals([g[0] ?? '', g[1] ?? '', g[2] ?? ''])
      })
      .catch(e => setError(e.message ?? 'Ошибка загрузки профиля'))
      .finally(() => setBusy(false))
  }, [])

  const handleShare = async () => {
    if (!profile) return
    const url = `${window.location.origin}${window.location.pathname}?u=${profile.user_id}`
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // Fallback: показываем prompt
      window.prompt('Скопируй ссылку:', url)
    }
  }

  const openSubsTab = async (which) => {
    if (subsTab === which) {
      setSubsTab(null)
      return
    }
    setSubsTab(which)
    try {
      if (which === 'subs') setSubsList(await fetchMySubscriptions())
      else setFollowersList(await fetchMyFollowers())
    } catch (e) {
      setError(e.message ?? 'Не удалось загрузить')
    }
  }

  const toggleFocus = (aspect) => {
    setFocusAspects(prev => {
      if (prev.includes(aspect)) return prev.filter(a => a !== aspect)
      if (prev.length >= 3) return prev
      return [...prev, aspect]
    })
  }

  const addInterest = () => {
    const tag = interestInput.trim()
    if (!tag || interests.includes(tag) || interests.length >= 12) return
    setInterests([...interests, tag])
    setInterestInput('')
  }

  const removeInterest = (tag) => {
    setInterests(interests.filter(t => t !== tag))
  }

  const addInspiration = () => {
    if (inspirations.length >= 24) return
    setInspirations([...inspirations, { type: 'film', title: '', note: '', aspect: null }])
  }

  const updateInspiration = (idx, patch) => {
    setInspirations(inspirations.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  const removeInspiration = (idx) => {
    setInspirations(inspirations.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const cleanedInsp = inspirations
        .filter(it => it.title.trim())
        .map(it => ({
          type: it.type,
          title: it.title.trim(),
          note: it.note?.trim() || null,
          aspect: it.aspect || null,
        }))
      const cleanedGoals = goals.map(g => g.trim()).filter(Boolean)

      const updated = await updateMyProfile({
        bio: bio.trim() || null,
        avatar: avatar || null,
        focus_aspects: focusAspects,
        interests,
        inspirations: cleanedInsp,
        goals: cleanedGoals,
      })
      setProfile(updated)
      setSavedAt(Date.now())
    } catch (e) {
      setError(e.message ?? 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const handlePostInsight = async () => {
    const text = insightText.trim()
    if (!text) return
    try {
      const created = await postInsight({
        aspect: insightAspect,
        kind: insightKind,
        text,
        isPublic: insightPublic,
      })
      setProfile(p => ({
        ...p,
        insights: [created, ...(p?.insights ?? [])],
      }))
      setInsightText('')
    } catch (e) {
      setError(e.message ?? 'Не удалось добавить')
    }
  }

  const handleDeleteInsight = async (id) => {
    try {
      await deleteInsight(id)
      setProfile(p => ({
        ...p,
        insights: (p?.insights ?? []).filter(i => i.id !== id),
      }))
    } catch (e) {
      setError(e.message ?? 'Не удалось удалить')
    }
  }

  if (busy) return <div className={styles.container}><div className={styles.muted}>Загрузка профиля…</div></div>
  if (!profile) return null

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <div className={styles.titleRow}>
          <div className={styles.avatarBig}>{profile.avatar || '🧑'}</div>
          <div className={styles.titleText}>
            <span className={styles.eyebrow}>Профиль</span>
            <h1 className={styles.title}>{profile.display_name}</h1>
            <div className={styles.subline}>
              XP: {profile.xp}
              {profile.is_public ? null : ' · 🔒 скрыт от других'}
            </div>
          </div>
        </div>
        <div className={styles.subsRow}>
          <button
            type="button"
            className={styles.subsCount}
            onClick={() => openSubsTab('followers')}
          >
            <strong>{profile.followers_count ?? 0}</strong> подписчиков
          </button>
          <button
            type="button"
            className={styles.subsCount}
            onClick={() => openSubsTab('subs')}
          >
            <strong>{profile.following_count ?? 0}</strong> подписок
          </button>
        </div>
        {subsTab && (
          <div className={styles.subsListBlock}>
            {(subsTab === 'subs' ? subsList : followersList).length === 0 ? (
              <div className={styles.muted}>Пока никого нет.</div>
            ) : (
              <ul className={styles.subsList}>
                {(subsTab === 'subs' ? subsList : followersList).map(u => (
                  <li key={u.user_id} className={styles.subsItem}>
                    <span className={styles.subsAvatar}>{u.avatar || '🧑'}</span>
                    <button
                      type="button"
                      className={styles.subsName}
                      onClick={() => onOpenPublicProfile?.(u.user_id)}
                    >
                      {u.display_name}
                    </button>
                    {(u.focus_aspects ?? []).slice(0, 2).map(a => (
                      <span
                        key={a}
                        className={styles.subsChip}
                        style={{ color: ASPECT_COLORS[a], borderColor: `${ASPECT_COLORS[a]}55` }}
                      >
                        {a}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => onOpenPublicProfile?.(profile.user_id)}
          >
            Посмотреть как видят другие →
          </button>
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={handleShare}
          >
            {shareCopied ? '✓ скопировано' : '🔗 поделиться'}
          </button>
          {onOpenSettings && (
            <button
              type="button"
              className={styles.settingsBtn}
              onClick={() => onOpenSettings()}
            >
              ⚙ Настройки
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── Avatar picker ───────────────────────── */}
      <Section label="Аватар">
        <div className={styles.avatarPicker}>
          {AVATAR_OPTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              className={`${styles.avatarOption} ${avatar === emoji ? styles.avatarOptionActive : ''}`}
              onClick={() => setAvatar(emoji)}
            >
              {emoji}
            </button>
          ))}
          {avatar && (
            <button
              type="button"
              className={styles.avatarClear}
              onClick={() => setAvatar('')}
              title="Сбросить"
            >
              ×
            </button>
          )}
        </div>
      </Section>

      {/* ── Bio ─────────────────────────────────── */}
      <Section label="О себе">
        <textarea
          className={styles.textarea}
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Коротко о себе: что ищешь, что развиваешь, что для тебя важно…"
          maxLength={600}
        />
        <div className={styles.counter}>{bio.length} / 600</div>
      </Section>

      {/* ── Focus aspects ───────────────────────── */}
      <Section label={`Что развиваю сейчас (до 3 аспектов · выбрано ${focusAspects.length}/3)`}>
        <div className={styles.aspectGrid}>
          {ASPECT_KEYS.map(key => {
            const active = focusAspects.includes(key)
            return (
              <button
                type="button"
                key={key}
                className={`${styles.aspectChip} ${active ? styles.aspectChipActive : ''}`}
                style={active ? { borderColor: ASPECT_COLORS[key], color: ASPECT_COLORS[key] } : undefined}
                onClick={() => toggleFocus(key)}
                disabled={!active && focusAspects.length >= 3}
              >
                {key} · {ASPECT_DATA[key].name}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Interests ───────────────────────────── */}
      <Section label="Интересы и сферы (теги)">
        <div className={styles.tagList}>
          {interests.map(tag => (
            <span key={tag} className={styles.tag}>
              {tag}
              <button
                type="button"
                onClick={() => removeInterest(tag)}
                className={styles.tagRemove}
                aria-label="Удалить"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className={styles.tagInputRow}>
          <input
            type="text"
            className={styles.input}
            value={interestInput}
            onChange={e => setInterestInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
            placeholder="финансы, дизайн, спорт…"
            maxLength={40}
          />
          <button
            type="button"
            className={styles.btnGhost}
            onClick={addInterest}
            disabled={!interestInput.trim() || interests.length >= 12}
          >
            +
          </button>
        </div>
        <div className={styles.counter}>{interests.length} / 12</div>
      </Section>

      {/* ── Inspirations ────────────────────────── */}
      <Section label="Что вдохновляет">
        <div className={styles.inspirationList}>
          {inspirations.map((it, idx) => (
            <div key={idx} className={styles.inspirationCard}>
              <div className={styles.inspirationRow}>
                <select
                  value={it.type}
                  onChange={e => updateInspiration(idx, { type: e.target.value })}
                  className={styles.select}
                >
                  {INSPIRATION_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <select
                  value={it.aspect ?? ''}
                  onChange={e => updateInspiration(idx, { aspect: e.target.value || null })}
                  className={styles.select}
                >
                  <option value="">— без аспекта —</option>
                  {ASPECT_KEYS.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.btnRemove}
                  onClick={() => removeInspiration(idx)}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                className={styles.input}
                value={it.title}
                onChange={e => updateInspiration(idx, { title: e.target.value })}
                placeholder="Название"
                maxLength={100}
              />
              <input
                type="text"
                className={styles.input}
                value={it.note}
                onChange={e => updateInspiration(idx, { note: e.target.value })}
                placeholder="Заметка (опционально)"
                maxLength={300}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={addInspiration}
          disabled={inspirations.length >= 24}
        >
          + добавить вдохновение
        </button>
      </Section>

      {/* ── Goals ───────────────────────────────── */}
      <Section label="Текущие цели (до 3)">
        {goals.map((g, idx) => (
          <input
            key={idx}
            type="text"
            className={styles.input}
            value={g}
            onChange={e => setGoals(goals.map((x, i) => i === idx ? e.target.value : x))}
            placeholder={`Цель ${idx + 1}`}
            maxLength={200}
          />
        ))}
      </Section>

      <div className={styles.saveBar}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Сохраняю…' : 'Сохранить профиль'}
        </button>
        {savedAt && !saving && (
          <span className={styles.savedHint}>Сохранено ✓</span>
        )}
      </div>

      {/* ── Achievements ────────────────────────── */}
      <AchievementsSection
        unlocked={profile.achievements ?? []}
        catalog={profile.achievements_catalog ?? []}
      />

      {/* ── Heatmap активности ──────────────────── */}
      <Section label="Активность за полгода">
        <Heatmap userId={profile.user_id} days={180} />
      </Section>

      {/* ── Insights ────────────────────────────── */}
      <Section label="Мои инсайты и рекомендации">
        <div className={styles.muted}>
          Делись находками по конкретному аспекту — другие смогут лайкать.
        </div>

        <div className={styles.insightForm}>
          <div className={styles.insightFormRow}>
            <select
              value={insightAspect}
              onChange={e => setInsightAspect(e.target.value)}
              className={styles.select}
            >
              {ASPECT_KEYS.map(k => (
                <option key={k} value={k}>{k} · {ASPECT_DATA[k].name}</option>
              ))}
            </select>
            <select
              value={insightKind}
              onChange={e => setInsightKind(e.target.value)}
              className={styles.select}
            >
              <option value="insight">Инсайт</option>
              <option value="recommendation">Рекомендация</option>
            </select>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={insightPublic}
                onChange={e => setInsightPublic(e.target.checked)}
              />
              Публично
            </label>
          </div>
          <textarea
            className={styles.textarea}
            value={insightText}
            onChange={e => setInsightText(e.target.value)}
            placeholder="Поделись инсайтом или рекомендацией по аспекту…"
            maxLength={2000}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handlePostInsight}
            disabled={!insightText.trim()}
          >
            Опубликовать
          </button>
        </div>

        <div className={styles.insightList}>
          {(profile.insights ?? []).map(ins => (
            <div
              key={ins.id}
              className={styles.insightCard}
              style={{ borderColor: `${ASPECT_COLORS[ins.aspect]}55` }}
            >
              <div className={styles.insightHead}>
                <span style={{ color: ASPECT_COLORS[ins.aspect] }} className={styles.insightAspect}>
                  {ins.aspect}
                </span>
                <span className={styles.insightKind}>{KIND_LABEL[ins.kind] ?? ins.kind}</span>
                {!ins.is_public && <span className={styles.insightPrivate}>🔒 личное</span>}
                <span className={styles.insightLikes}>♥ {ins.likes}</span>
                <button
                  type="button"
                  className={styles.btnRemove}
                  onClick={() => handleDeleteInsight(ins.id)}
                  aria-label="Удалить"
                >
                  ×
                </button>
              </div>
              <div className={styles.insightText}>{ins.text}</div>
              {ins.is_public && ins.likes > 0 && (
                <>
                  <button
                    type="button"
                    className={styles.reactorsToggleOwn}
                    onClick={() => setReactorsOpen(prev => {
                      const next = new Set(prev)
                      if (next.has(ins.id)) next.delete(ins.id)
                      else next.add(ins.id)
                      return next
                    })}
                  >
                    {reactorsOpen.has(ins.id)
                      ? '▲ скрыть кто реагировал'
                      : `👥 кто реагировал (${ins.likes})`}
                  </button>
                  <ReactorsList
                    insightId={ins.id}
                    open={reactorsOpen.has(ins.id)}
                    onOpenProfile={onOpenPublicProfile}
                  />
                </>
              )}
            </div>
          ))}
          {(profile.insights ?? []).length === 0 && (
            <div className={styles.muted}>Пока пусто — добавь первый инсайт.</div>
          )}
        </div>
      </Section>
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

function AchievementsSection({ unlocked, catalog }) {
  const unlockedCodes = new Set(unlocked.map(a => a.code))
  const total = catalog.length
  const got = unlocked.length
  return (
    <Section label={`Достижения · ${got}/${total}`}>
      <div className={styles.achievementsGrid}>
        {catalog.map(a => {
          const isUnlocked = unlockedCodes.has(a.code)
          return (
            <div
              key={a.code}
              className={`${styles.achievement} ${isUnlocked ? styles.achievementUnlocked : styles.achievementLocked}`}
              title={a.desc}
            >
              <div className={styles.achievementIcon}>{isUnlocked ? a.icon : '🔒'}</div>
              <div className={styles.achievementBody}>
                <div className={styles.achievementTitle}>{a.title}</div>
                <div className={styles.achievementDesc}>{a.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
