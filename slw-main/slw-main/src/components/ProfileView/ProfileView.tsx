import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import {
  fetchMyProfile,
  updateMyProfile,
  postInsight,
  deleteInsight,
  fetchMySubscriptions,
  fetchMyFollowers,
  fetchMyStreak,
  activateShield,
  fetchMyHabits,
  clearHabit,
  fetchMyBookmarks,
  unbookmarkInsight,
} from '../../api/client'
import ReactorsList from '../PublicProfileView/ReactorsList'
import Heatmap from '../Heatmap/Heatmap'
import { useConfirm } from '../Confirm/ConfirmProvider'
import { tmaNotify } from '../../tma/hooks'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import { emitXpEarned, type XpAward } from '../../utils/xp'
import type { AspectKey } from '@/types/aspect'
import type { JourneyState } from '@/types/journey'
import styles from './ProfileView.module.css'

// Эмодзи-набор для аватарок. as const → readonly string[] литерал.
const AVATAR_OPTIONS = [
  '🧑', '🧙', '🧝', '🌱', '🌟', '🦊', '🦉', '🐻', '🦁', '🐉',
  '🌊', '🔥', '⚡', '🌙', '☀', '🌌', '✨', '💎', '🎭', '🎨',
] as const

const INSPIRATION_TYPES: ReadonlyArray<readonly [InspirationType, string]> = [
  ['film', 'Фильм'],
  ['book', 'Книга'],
  ['music', 'Музыка'],
  ['activity', 'Активность'],
  ['person', 'Человек'],
  ['other', 'Другое'],
]

const KIND_LABEL: Record<string, string> = {
  insight: 'инсайт',
  recommendation: 'рекомендация',
}

type InspirationType = 'film' | 'book' | 'music' | 'activity' | 'person' | 'other'
type InsightKind = 'insight' | 'recommendation'

// Shape captured from /api/profile/me usage in this file. Backend has no
// response_model yet, so this list mirrors what the JSX actually reads.
// NOTE(ts): pending backend response_model for /api/profile/me.
type Inspiration = {
  type: InspirationType | string
  title: string
  note?: string | null
  aspect?: AspectKey | string | null
}

type Insight = {
  id: number | string
  aspect: AspectKey | string
  kind: InsightKind | string
  text: string
  likes: number
  is_public: boolean
}

type Achievement = {
  code: string
  title?: string
  icon?: string
  desc?: string
  unlocked_at?: string
}

type CatalogEntry = {
  code: string
  title: string
  icon: string
  desc: string
}

type MyProfile = {
  user_id: number | string
  display_name: string
  avatar?: string | null
  bio?: string | null
  xp: number
  is_public?: boolean
  followers_count?: number
  following_count?: number
  focus_aspects?: Array<AspectKey | string>
  interests?: string[]
  inspirations?: Inspiration[]
  goals?: string[]
  insights?: Insight[]
  achievements?: Achievement[]
  achievements_catalog?: CatalogEntry[]
  // Реферальная инфа — только в собственном профиле (GET /api/profile/me).
  referral?: {
    code: string
    referrals_count: number
    stardust_earned: number
    referrals: Array<{
      user_id: number
      display_name: string
      joined_at: string | null
      milestones_completed: string[]
    }>
  } | null
}

type SubscriptionUser = {
  user_id: number | string
  display_name: string
  avatar?: string | null
  focus_aspects?: Array<AspectKey | string>
}

type Props = {
  onOpenPublicProfile?: (userId: number | string) => void
  onOpenSettings?: () => void
  onOpenTour?: () => void
  journey?: JourneyState | null
  onJourneyChange?: (next: JourneyState) => void | Promise<void>
  onAvatarChange?: (avatar: string) => void
}

export default function ProfileView({
  onOpenPublicProfile,
  onOpenSettings,
  onOpenTour,
  journey,
  onJourneyChange,
  onAvatarChange,
}: Props) {
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [busy, setBusy] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [shareCopied, setShareCopied] = useState<boolean>(false)
  const [subsList, setSubsList] = useState<SubscriptionUser[]>([])
  const [followersList, setFollowersList] = useState<SubscriptionUser[]>([])
  const [subsTab, setSubsTab] = useState<'subs' | 'followers' | null>(null)
  // id своих инсайтов, для которых раскрыт список реагировавших
  const [reactorsOpen, setReactorsOpen] = useState<Set<number | string>>(() => new Set())

  // Локальные черновики
  const [bio, setBio] = useState<string>('')
  const [avatar, setAvatar] = useState<string>('')
  const [focusAspects, setFocusAspects] = useState<Array<AspectKey | string>>([])
  const [interestInput, setInterestInput] = useState<string>('')
  const [interests, setInterests] = useState<string[]>([])
  const [inspirations, setInspirations] = useState<Inspiration[]>([])
  const [goals, setGoals] = useState<[string, string, string]>(['', '', ''])

  // Новый инсайт
  const [insightAspect, setInsightAspect] = useState<AspectKey>('Si')
  const [insightKind, setInsightKind] = useState<InsightKind>('insight')
  const [insightText, setInsightText] = useState<string>('')
  const [sendKeyMode] = useSendKeyMode()
  const [insightPublic, setInsightPublic] = useState<boolean>(true)

  // Collapse-by-default для длинного списка своих инсайтов (у активного
  // юзера легко 50+). Inspirations в ProfileView — edit-форма, её не
  // сворачиваем (юзеру нужно видеть всё чтобы редактировать).
  // Collapse inspirations на чужом профиле — в PublicProfileView.
  const [showAllInsights, setShowAllInsights] = useState<boolean>(false)

  useEffect(() => {
    fetchMyProfile()
      .then(resp => {
        const p = resp as MyProfile
        setProfile(p)
        setBio(p.bio ?? '')
        setAvatar(p.avatar ?? '')
        setFocusAspects(p.focus_aspects ?? [])
        setInterests(p.interests ?? [])
        setInspirations(p.inspirations ?? [])
        const g = p.goals ?? []
        setGoals([g[0] ?? '', g[1] ?? '', g[2] ?? ''])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки профиля'))
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

  const openSubsTab = async (which: 'subs' | 'followers') => {
    if (subsTab === which) {
      setSubsTab(null)
      return
    }
    setSubsTab(which)
    try {
      if (which === 'subs') setSubsList(await fetchMySubscriptions() as SubscriptionUser[])
      else setFollowersList(await fetchMyFollowers() as SubscriptionUser[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить')
    }
  }

  const toggleFocus = (aspect: AspectKey) => {
    setFocusAspects(prev => {
      if (prev.includes(aspect)) return prev.filter(a => a !== aspect)
      if (prev.length >= 3) {
        // Раньше тихо игнорировали 4-й тап — юзер не понимал почему ничего
        // не происходит. Теперь короткое сообщение через error-плашку (которая
        // уже видна на форме).
        setError('Можно выбрать максимум 3 фокус-аспекта. Сначала сними один.')
        setTimeout(() => setError(prev => prev === 'Можно выбрать максимум 3 фокус-аспекта. Сначала сними один.' ? null : prev), 3000)
        return prev
      }
      // При успешном выборе чистим прошлое сообщение лимита.
      setError(prev => prev && prev.startsWith('Можно выбрать максимум') ? null : prev)
      return [...prev, aspect]
    })
  }

  const addInterest = () => {
    const tag = interestInput.trim()
    if (!tag) return
    if (interests.includes(tag)) {
      setError(`«${tag}» уже в списке`)
      setTimeout(() => setError(prev => prev?.includes('уже в списке') ? null : prev), 2500)
      return
    }
    if (interests.length >= 12) {
      // Раньше тихо игнорировали 13+ — кнопка просто disabled, юзер не
      // понимал лимит. Теперь короткое сообщение.
      setError('Максимум 12 тегов. Удали один чтобы добавить новый.')
      setTimeout(() => setError(prev => prev?.startsWith('Максимум 12') ? null : prev), 3000)
      return
    }
    setInterests([...interests, tag])
    setInterestInput('')
  }

  const removeInterest = (tag: string) => {
    setInterests(interests.filter(t => t !== tag))
  }

  const addInspiration = () => {
    if (inspirations.length >= 24) return
    setInspirations([...inspirations, { type: 'film', title: '', note: '', aspect: null }])
  }

  const updateInspiration = (idx: number, patch: Partial<Inspiration>) => {
    setInspirations(inspirations.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  const removeInspiration = (idx: number) => {
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
      }) as MyProfile
      setProfile(updated)
      setSavedAt(Date.now())
      // Авто-сброс лейбла «Сохранено ✓» через 2.5с. Раньше висел до
      // следующего сейва — выглядел постоянно «вот-вот сохранил».
      setTimeout(() => setSavedAt(null), 2500)
      tmaNotify('success')
      // Обновляем аватарку в шапке App-уровня — иначе там остаётся старая
      // (Header читает из App.myAvatar, а не из локального ProfileView state).
      if (onAvatarChange) onAvatarChange(updated.avatar ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      tmaNotify('error')
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
      }) as Insight & { xp?: XpAward }
      emitXpEarned(created.xp)
      setProfile(p => p ? ({
        ...p,
        insights: [created, ...(p.insights ?? [])],
      }) : p)
      setInsightText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить')
    }
  }

  const handleDeleteInsight = async (id: number | string) => {
    try {
      await deleteInsight(id)
      setProfile(p => p ? ({
        ...p,
        insights: (p.insights ?? []).filter(i => i.id !== id),
      }) : p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  if (busy) return <div className={styles.container}><div className={styles.muted}>Загрузка профиля…</div></div>
  if (!profile) return null

  const colorOf = (a: string): string => (ASPECT_COLORS as Record<string, string>)[a] ?? ''
  const displayOf = (a: string): string => (ASPECT_DISPLAY_KEY as Record<string, string>)[a] ?? a

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
                        style={{ color: colorOf(a), borderColor: `${colorOf(a)}55` }}
                      >
                        {displayOf(a)}
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
          {onOpenTour && (
            <button
              type="button"
              className={styles.settingsBtn}
              onClick={() => onOpenTour()}
            >
              📖 Гид по приложению
            </button>
          )}
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
          onKeyDown={e => {
            if (shouldSendOnKeyDown(e, sendKeyMode)) {
              e.preventDefault()
              handleSave()
            }
          }}
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
                {ASPECT_DISPLAY_KEY[key]} · {ASPECT_DATA[key].name}
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
                  onChange={e => updateInspiration(idx, { type: e.target.value as InspirationType })}
                  className={styles.select}
                >
                  {INSPIRATION_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <select
                  value={it.aspect ?? ''}
                  onChange={e => updateInspiration(idx, { aspect: (e.target.value as AspectKey) || null })}
                  className={styles.select}
                >
                  <option value="">— без аспекта —</option>
                  {ASPECT_KEYS.map(k => (
                    <option key={k} value={k}>{ASPECT_DISPLAY_KEY[k]}</option>
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
                value={it.note ?? ''}
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
            onChange={e => setGoals(goals.map((x, i) => i === idx ? e.target.value : x) as [string, string, string])}
            placeholder={`Цель ${idx + 1}`}
            maxLength={200}
          />
        ))}
      </Section>

      {/* Web save-bar показывается всегда (TMA MainButton подключается параллельно). */}
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

      {/* ── Стрик с бэка + защита ─────────────── */}
      <StreakSection journey={journey ?? null} onJourneyChange={onJourneyChange} />

      {/* ── Мои выбранные практики ──────────────── */}
      <MyHabitsSection />

      {/* ── Закладки ─────────────────────────── */}
      <MyBookmarksSection onOpenProfile={onOpenPublicProfile} />

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
              onChange={e => setInsightAspect(e.target.value as AspectKey)}
              className={styles.select}
            >
              {ASPECT_KEYS.map(k => (
                <option key={k} value={k}>{ASPECT_DISPLAY_KEY[k]} · {ASPECT_DATA[k].name}</option>
              ))}
            </select>
            <select
              value={insightKind}
              onChange={e => setInsightKind(e.target.value as InsightKind)}
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
            onKeyDown={e => {
              if (shouldSendOnKeyDown(e, sendKeyMode) && insightText.trim()) {
                e.preventDefault()
                handlePostInsight()
              }
            }}
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
          {((profile.insights ?? []).slice(
            0,
            showAllInsights ? undefined : 10
          )).map(ins => (
            <div
              key={ins.id}
              className={styles.insightCard}
              style={{ borderColor: `${colorOf(ins.aspect as string)}55` }}
            >
              <div className={styles.insightHead}>
                <span style={{ color: colorOf(ins.aspect as string) }} className={styles.insightAspect}>
                  {displayOf(ins.aspect as string)}
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
          {(profile.insights ?? []).length > 10 && (
            <button
              type="button"
              className={styles.achievementsExpandBtn}
              onClick={() => setShowAllInsights(v => !v)}
            >
              {showAllInsights
                ? '↑ Свернуть'
                : `↓ Показать все ${(profile.insights ?? []).length} инсайтов`}
            </button>
          )}
        </div>
      </Section>

      {/* Реферальная секция — приватная, видна только в своём профиле.
          referral-блок приходит из GET /api/profile/me. */}
      {profile.referral && (
        <ReferralSection referral={profile.referral} />
      )}
    </div>
  )
}

type ReferralData = {
  code: string
  referrals_count: number
  stardust_earned: number
  referrals: Array<{
    user_id: number
    display_name: string
    joined_at: string | null
    milestones_completed: string[]
  }>
}

const REFERRAL_MILESTONE_LABEL: Record<string, string> = {
  referee_registered:     'зарегистрировался',
  referee_first_step:     'прошёл первый шаг',
  referee_diary_10:       '10 записей в дневнике',
  referee_linked_tg:      'привязал Telegram',
  referee_first_insight:  'опубликовал инсайт',
}

function ReferralSection({ referral }: { referral: ReferralData }) {
  const [copied, setCopied] = useState(false)

  // Lazy-импорт чтобы не загружать утилиту на каждый профиль.
  const url = (() => {
    try {
      const base = `${window.location.origin}${window.location.pathname}`
      const u = new URL(base)
      u.searchParams.set('ref', referral.code)
      return u.toString()
    } catch { return `?ref=${referral.code}` }
  })()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Скопируй ссылку:', url)
    }
  }

  return (
    <Section label={`🎁 Пригласить друзей · ${referral.referrals_count} приглашено · ${referral.stardust_earned}⚡ заработано`}>
      <div className={styles.hint} style={{ marginBottom: 10 }}>
        Приглашай друзей по ссылке. За каждую веху в их прогрессе ты получишь стардаст
        (1 вызов ИИ-коуча = 25⚡): регистрация +25, первый шаг +25, 10 записей в дневнике +50,
        TG +25, первый инсайт +25 — итого до <strong>150⚡</strong> за одного друга.
        Сам друг получит <strong>+50⚡</strong> стартового пакета.
      </div>
      <div className={styles.referralLinkRow}>
        <input
          className={styles.input}
          value={url}
          readOnly
          onClick={(e) => (e.target as HTMLInputElement).select()}
          style={{ fontSize: 12, fontFamily: 'monospace' }}
        />
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={copy}
        >
          {copied ? '✓ Скопировано' : 'Скопировать'}
        </button>
      </div>
      {referral.referrals.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className={styles.hint} style={{ cursor: 'pointer' }}>
            Мои приглашённые ({referral.referrals.length})
          </summary>
          <ul className={styles.referralList}>
            {referral.referrals.map(r => (
              <li key={r.user_id} className={styles.referralItem}>
                <strong>{r.display_name}</strong>
                {r.milestones_completed.length === 0 ? (
                  <span className={styles.muted}> · только зарегистрировался</span>
                ) : (
                  <span className={styles.muted}>
                    {' · '}
                    {r.milestones_completed
                      .map(c => REFERRAL_MILESTONE_LABEL[c] ?? c)
                      .join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
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

const SHIELD_COST = 50

// «2026-05-23» → «до 23 мая». Если дата невалидная — возвращаем как есть.
function formatShieldDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

const STATUS_DESC: Record<string, string> = {
  none:         'Стрик ещё не начался — сделай хоть что-то сегодня (тик практики, запись в дневник, инсайт).',
  ticked_today: 'Стрик сегодня уже подтверждён.',
  due_today:    'Стрик ещё держится — сделай что-нибудь сегодня, чтобы продолжить.',
  shielded:     '🛡 Защита покрыла пропущенный день.',
  broken:       'Стрик сорвался. Начни новый — любая активность сегодня запустит цикл заново.',
  active:       '',
}

type StreakData = {
  current: number
  longest: number
  last_active_date?: string | null
  shield_until?: string | null
  today: string
  status?: string
}

type StreakSectionProps = {
  journey: JourneyState | null
  onJourneyChange?: (next: JourneyState) => void | Promise<void>
}

function StreakSection({ journey, onJourneyChange }: StreakSectionProps) {
  const [data, setData] = useState<StreakData | null>(null)
  const [busy, setBusy] = useState<boolean>(true)
  const [activating, setActivating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const stardust = journey?.stardust ?? 0

  const reload = async () => {
    setBusy(true)
    try {
      setData(await fetchMyStreak() as StreakData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить стрик')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reload() }, [])

  const handleShield = async () => {
    if (!onJourneyChange || !journey || stardust < SHIELD_COST || activating) return

    // 50 ✦ — заметная сумма (≈ 50 пройденных шагов). Без подтверждения
    // случайный тап в плотной шапке стрика стоил юзеру дня прогресса.
    const ok = await confirm({
      title: 'Активировать защиту стрика?',
      body: (
        <>
          Со счёта спишется <strong>{SHIELD_COST} ✦ звёздной пыли</strong>
          {' '}(сейчас у тебя {stardust}). Защита даёт один пропуск в стрике —
          если завтра ничего не сделаешь, серия не оборвётся.
        </>
      ),
      confirmLabel: `Активировать (−${SHIELD_COST} ✦)`,
      cancelLabel: 'Не сейчас',
    })
    if (!ok) return

    setActivating(true)
    setError(null)
    try {
      // Сначала списываем стардаст (trust-based — как раньше).
      await onJourneyChange({ ...journey, stardust: stardust - SHIELD_COST })
      await activateShield()
      await reload()
    } catch (e) {
      // Откатываем стардаст.
      if (journey) await onJourneyChange?.({ ...journey, stardust })
      setError(e instanceof Error ? e.message : 'Не удалось активировать')
    } finally {
      setActivating(false)
    }
  }

  if (busy) return <Section label="Стрик"><div className={styles.muted}>Загружаем…</div></Section>
  if (!data) return null

  const today = data.today
  const shielded = !!(data.shield_until && data.shield_until >= today)
  const status = data.status || 'active'

  return (
    <Section label="Стрик активности">
      <div className={styles.streakRow}>
        <div className={styles.streakBig}>
          🔥 {data.current}
          <span className={styles.streakUnit}>{pluralDays(data.current)}</span>
        </div>
        <div className={styles.streakMeta}>
          <div>Лучший: <strong>{data.longest}</strong></div>
          {data.last_active_date && (
            <div className={styles.muted}>Последняя активность: {data.last_active_date}</div>
          )}
          {shielded && (
            <div style={{ color: 'var(--accent)' }}>🛡 защита до {formatShieldDate(data.shield_until)}</div>
          )}
        </div>
      </div>

      {STATUS_DESC[status] && (
        <div className={styles.muted} style={{ marginTop: 10 }}>{STATUS_DESC[status]}</div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!shielded && (
        <button
          type="button"
          className={styles.btnGhost}
          onClick={handleShield}
          disabled={stardust < SHIELD_COST || activating}
          title={stardust < SHIELD_COST ? `Нужно ${SHIELD_COST} стардаста` : ''}
          style={{ marginTop: 12 }}
        >
          🛡 Активировать защиту (⚡{SHIELD_COST})
        </button>
      )}
    </Section>
  )
}

type HabitItem = {
  aspect: AspectKey | string
  title: string
  ticked_today?: boolean
}

function MyHabitsSection() {
  const [habits, setHabits] = useState<HabitItem[]>([])
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const reload = async () => {
    setBusy(true)
    try {
      const resp = await fetchMyHabits() as { habits: HabitItem[] }
      setHabits(resp.habits)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reload() }, [])

  const handleClear = async (aspect: AspectKey | string) => {
    const display = (ASPECT_DISPLAY_KEY as Record<string, string>)[aspect] ?? aspect
    const habit = habits.find(h => h.aspect === aspect)
    const ok = await confirm({
      title: `Снять практику в ${display}?`,
      body: habit ? (
        <>
          «<strong>{habit.title}</strong>» больше не будет ежедневной.
          История тиков и стрик не пропадут.
        </>
      ) : 'Практика для этого аспекта будет снята.',
      confirmLabel: 'Снять',
      cancelLabel: 'Оставить',
    })
    if (!ok) return
    try {
      await clearHabit(aspect)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось снять')
    }
  }

  return (
    <Section label={`Мои практики · ${habits.length}`}>
      {busy && <div className={styles.muted}>Загружаем…</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!busy && habits.length === 0 && (
        <div className={styles.muted}>
          Ты ещё не выбрал практики. Зайди на страницу аспекта (Аспекты → выбрать) и нажми «+ Выбрать практику».
        </div>
      )}
      {!busy && habits.length > 0 && (
        <ul className={styles.habitsList}>
          {habits.map(h => (
            <li key={h.aspect} className={styles.habitItem}>
              <span className={styles.habitAspect}>
                {(ASPECT_DISPLAY_KEY as Record<string, string>)[h.aspect] ?? h.aspect}
              </span>
              <span className={styles.habitTitle}>{h.title}</span>
              <span className={`${styles.habitDot} ${h.ticked_today ? styles.habitDotDone : ''}`}>
                {h.ticked_today ? '✓ сегодня' : '☐ сегодня'}
              </span>
              <button
                type="button"
                className={styles.btnRemove}
                onClick={() => handleClear(h.aspect)}
                aria-label="Снять"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

type Bookmark = {
  kind: string
  target_id: number | string
  saved_at: string
  aspect?: AspectKey | string | null
  text?: string | null
  available: boolean
  display_name?: string | null
  avatar?: string | null
  user_id?: number | string
}

function MyBookmarksSection({ onOpenProfile }: { onOpenProfile?: (userId: number | string) => void }) {
  const [items, setItems] = useState<Bookmark[]>([])
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setBusy(true)
    try {
      setItems(await fetchMyBookmarks() as Bookmark[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reload() }, [])

  const handleRemove = async (id: number | string) => {
    try {
      await unbookmarkInsight(id)
      setItems(prev => prev.filter(b => !(b.kind === 'insight' && b.target_id === id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось')
    }
  }

  return (
    <Section label={`Мои закладки · ${items.length}`}>
      {busy && <div className={styles.muted}>Загружаем…</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!busy && items.length === 0 && (
        <div className={styles.muted}>
          Нажми 🔖 на чужом инсайте — он сохранится сюда «себе на память».
        </div>
      )}
      <div className={styles.insightList}>
        {items.map((b) => (
          <div key={`${b.kind}-${b.target_id}-${b.saved_at}`} className={styles.insightCard}>
            <div className={styles.insightHead}>
              <span className={styles.insightAspect}>
                {b.aspect ? ((ASPECT_DISPLAY_KEY as Record<string, string>)[b.aspect] ?? b.aspect) : '—'}
              </span>
              {b.available && b.display_name && b.user_id != null && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => onOpenProfile?.(b.user_id!)}
                >
                  {b.avatar || '🧑'} {b.display_name}
                </button>
              )}
              <button
                type="button"
                className={styles.btnRemove}
                onClick={() => handleRemove(b.target_id)}
                title="Убрать из закладок"
              >
                ×
              </button>
            </div>
            <div className={styles.insightText}>
              {b.available ? b.text : <em className={styles.muted}>Инсайт стал недоступен (удалён или скрыт)</em>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function pluralDays(n: number): string {
  const m = n % 10
  if (n % 100 >= 11 && n % 100 <= 14) return 'дней'
  if (m === 1) return 'день'
  if (m >= 2 && m <= 4) return 'дня'
  return 'дней'
}

type AchievementsProps = {
  unlocked: Achievement[]
  catalog: CatalogEntry[]
}

// По умолчанию показываем только разблокированные ачивки (юзеру интереснее
// видеть свои достижения, чем длинный список locked-карточек). Если их
// больше LIMIT — обрезаем. Кнопка «Показать все» раскрывает весь каталог.
const ACHIEVEMENTS_DEFAULT_LIMIT = 15

function AchievementsSection({ unlocked, catalog }: AchievementsProps) {
  const [expanded, setExpanded] = useState<boolean>(false)
  const unlockedCodes = new Set(unlocked.map(a => a.code))
  const total = catalog.length
  const got = unlocked.length

  // Какие карточки рендерим:
  //   collapsed → только разблокированные, до ACHIEVEMENTS_DEFAULT_LIMIT
  //   expanded  → все из каталога (как раньше)
  const visible = expanded
    ? catalog
    : catalog
        .filter(a => unlockedCodes.has(a.code))
        .slice(0, ACHIEVEMENTS_DEFAULT_LIMIT)

  const hasMore = got > ACHIEVEMENTS_DEFAULT_LIMIT || total > got

  return (
    <Section label={`Достижения · ${got}/${total}`}>
      <div className={styles.achievementsGrid}>
        {visible.map(a => {
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
        {!expanded && got === 0 && (
          <div className={styles.muted} style={{ gridColumn: '1 / -1' }}>
            Пока пусто. Жми «Показать все», чтобы увидеть какие ачивки можно открыть.
          </div>
        )}
      </div>
      {hasMore && (
        <button
          type="button"
          className={styles.achievementsExpandBtn}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded
            ? '↑ Свернуть'
            : `↓ Показать все (${total} ачивок, ${got} открыто)`}
        </button>
      )}
    </Section>
  )
}

