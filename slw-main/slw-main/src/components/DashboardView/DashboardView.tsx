import { useEffect, useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import {
  fetchDashboard,
  tickHabit,
  untickHabit,
  postDiaryEntry,
  followUser,
} from '../../api/client'
import MiniWheel from './MiniWheel'
import Heatmap from '../Heatmap/Heatmap'
import Hint from '../Onboarding/Hint'
import DiscoverMore from './DiscoverMore'
import { useSendKeyMode, shouldSendOnKeyDown } from '../../hooks/useSendKeyMode'
import { emitXpEarned, type XpAward } from '../../utils/xp'
import type { AspectKey, AspectScores } from '@/types/aspect'
import type { JourneyState } from '@/types/journey'
import styles from './DashboardView.module.css'

// Маленький цветок-глиф для лейбла «Колесо баланса». 8 лепестков по
// цветам аспектов. Заменяет красный emoji ⭕ на цветной знак, который
// тематически вяжется с самим колесом.
type WheelFlowerGlyphProps = { size?: number }

function WheelFlowerGlyph({ size = 18 }: WheelFlowerGlyphProps) {
  const cx = size / 2
  const cy = size / 2
  const petalR = size * 0.32 // расстояние от центра до центра лепестка
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: '6px' }}
    >
      {ASPECT_KEYS.map((key, i) => {
        const angle = (i / ASPECT_KEYS.length) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(angle) * petalR
        const y = cy + Math.sin(angle) * petalR
        const deg = (angle * 180) / Math.PI + 90
        return (
          <ellipse
            key={key}
            cx={x}
            cy={y}
            rx={size * 0.13}
            ry={size * 0.22}
            fill={ASPECT_COLORS[key]}
            opacity={0.9}
            transform={`rotate(${deg} ${x} ${y})`}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={size * 0.16} fill="#fff5d6" />
    </svg>
  )
}

const STREAK_STATUS_LABEL: Record<string, string> = {
  none:         'Стрик ещё не начался',
  ticked_today: 'Сегодня уже отметился ✓',
  due_today:    '⚠ Сделай что-то сегодня — стрик в зоне риска',
  shielded:     '🛡 Защита покрыла пропуск',
  broken:       'Стрик сорвался — начни новый',
}

// Гейт ИИ-коуча. Дублирует Header.tsx:COACH_UNLOCK_AT — оба места должны
// быть синхронны. Если меняешь порог — правь и там.
const COACH_UNLOCK_AT = 5
const COACH_LOCKED_HINT =
  'ИИ-коуч доступен тем, кто начал путешествие по планетам и прошёл хотя бы 5 шагов'

// Shape ответа /api/dashboard. У бэка нет response_model, поэтому
// локальный тип покрывает только load-bearing поля, остальное —
// Record<string, unknown> для forward-compat.
// NOTE(ts): pending backend response_model for /api/dashboard.
type DashboardHabit = {
  aspect: AspectKey
  title: string
  ticked_today?: boolean
} & Record<string, unknown>

type DashboardStreak = {
  current?: number
  status?: 'none' | 'ticked_today' | 'due_today' | 'shielded' | 'broken' | string
} & Record<string, unknown>

type DashboardUser = {
  display_name?: string
  avatar?: string
  focus_aspects?: AspectKey[]
  hints_seen?: Record<string, boolean>
  following_count?: number
  bio?: string | null
} & Record<string, unknown>

type DashboardNotification = {
  id: number | string
  type: string
  payload?: Record<string, unknown>
}

type DashboardCoach = {
  remaining_today: number
  daily_limit: number
  streak_bonus?: number
}

type DashboardLevelProgress = {
  completed_steps: number
} & Record<string, unknown>

type DashboardSubFeedItem = {
  id: number | string
  user_id: number | string
  display_name?: string
  avatar?: string
  aspect: AspectKey
  text?: string
}

type DashboardSuggestedAuthor = {
  user_id: number | string
  display_name?: string
  avatar?: string
  insights_count?: number
  likes_received?: number
}

type DashboardWordOfDay = {
  text: string
  author: string
  aspect: AspectKey
}

type DashboardData = {
  user: DashboardUser
  today?: string
  scores: AspectScores
  streak: DashboardStreak
  habits: DashboardHabit[]
  coach: DashboardCoach
  notifications: {
    unread_count: number
    latest: DashboardNotification[]
  }
  subs_feed: DashboardSubFeedItem[]
  suggested_authors: DashboardSuggestedAuthor[]
  word_of_day?: DashboardWordOfDay | null
  dm_unread_count?: number
  active_aspect?: AspectKey | null
  level_progress?: DashboardLevelProgress | null
} & Record<string, unknown>

type Props = {
  currentUserId: number | string | null | undefined
  user: unknown
  journey: JourneyState | null | undefined
  onOpenAspect?: (aspect: AspectKey) => void
  onOpenAspects?: () => void
  onOpenJourney?: () => void
  onOpenCoach?: () => void
  onOpenDiary?: () => void
  onOpenHall?: (aspect: AspectKey) => void
  onOpenProfile?: (userId: number | string) => void
  onOpenMyProfile?: () => void
  onOpenDM?: (userId: number | string) => void
  onOpenDMList?: () => void
  onOpenLeaderboard?: () => void
  onOpenTour?: () => void
}

/**
 * Дашборд — главный экран для залогиненных. Один запрос /api/dashboard.
 * Гостям не показывается (App.jsx гейтит).
 */
export default function DashboardView({
  currentUserId,
  user,
  journey,
  onOpenAspect,
  onOpenAspects,
  onOpenJourney,
  onOpenCoach,
  onOpenDiary,
  onOpenHall: _onOpenHall,
  onOpenProfile,
  onOpenMyProfile,
  onOpenDM: _onOpenDM,
  onOpenDMList,
  onOpenLeaderboard,
  onOpenTour,
}: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [busy, setBusy] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [diaryText, setDiaryText] = useState<string>('')
  const [sendKeyMode] = useSendKeyMode()
  const [diaryAspect, setDiaryAspect] = useState<AspectKey | 'general'>('general')
  const [savingDiary, setSavingDiary] = useState<boolean>(false)
  const [diarySaved, setDiarySaved] = useState<boolean>(false)

  // _onOpenHall and _onOpenDM are accepted to preserve the prop interface
  // (callers may pass them) but the current dashboard layout doesn't use
  // them directly — Hall is reached via aspect click, DMs via DMList.
  void _onOpenHall
  void _onOpenDM

  const reload = async (): Promise<void> => {
    setBusy(true)
    try {
      const d = await fetchDashboard()
      setData(d as DashboardData)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить дашборд')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reload() }, [])

  if (busy) {
    return <div className={styles.container}><div className={styles.muted}>Собираем дашборд…</div></div>
  }
  if (error) {
    return <div className={styles.container}><div className={styles.error}>{error}</div></div>
  }
  if (!data) return null

  const greet = greeting()
  const streak = data.streak || {}
  const streakColor = streak.status === 'broken' ? '#e57373'
                    : streak.status === 'due_today' ? '#f0c674'
                    : '#b39ddb'

  const handleHabitToggle = async (h: DashboardHabit): Promise<void> => {
    try {
      if (h.ticked_today) await untickHabit(h.aspect)
      else {
        const tResp = await tickHabit(h.aspect) as { xp?: XpAward }
        emitXpEarned(tResp.xp)
      }
      reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось')
    }
  }

  const handleDiarySave = async (): Promise<void> => {
    const t = diaryText.trim()
    if (!t || savingDiary) return
    setSavingDiary(true)
    try {
      const dResp = await postDiaryEntry({
        text: t,
        aspect: diaryAspect === 'general' ? null : diaryAspect,
        source: 'web',
      }) as { xp?: XpAward }
      emitXpEarned(dResp.xp)
      setDiaryText('')
      setDiarySaved(true)
      setTimeout(() => setDiarySaved(false), 2000)
      reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSavingDiary(false)
    }
  }

  const handleFollow = async (userId: number | string): Promise<void> => {
    try {
      await followUser(userId)
      reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось')
    }
  }

  const lvl = data.level_progress
  const active = data.active_aspect
  const coachLocked = (journey?.totalCompleted ?? 0) < COACH_UNLOCK_AT

  return (
    <div className={styles.container}>
      <Hint id="dashboard-intro" user={user}>
        Здесь твой день начинается. Практики, колесо, лента сообщества и AI-коуч.
      </Hint>

      {/* ── Шапка ──────────────────────────────── */}
      <div className={styles.greetRow}>
        <div>
          <div className={styles.greet}>{greet}, {data.user.display_name}</div>
          <div className={styles.muted}>{prettyDate(data.today)}</div>
        </div>
        <div className={styles.streakBlock} style={{ color: streakColor }}>
          <div className={styles.streakNumber}>🔥 {streak.current ?? 0}</div>
          <div className={styles.streakStatus}>
            {STREAK_STATUS_LABEL[streak.status ?? ''] || ''}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* ── Новичок: большой призыв на путешествие ─────────────────
            Если юзер ещё не сделал ни одного шага путешествия — заменяем
            блоки «Сегодня/практики/К аспектам» одним крупным CTA-блоком,
            который ясно говорит «смысл игры — пройти путешествие по 8
            сферам жизни». Для опытных всё как было. */}
        {data.is_newbie ? (
          <Section className={styles.spanFull}>
            <div className={styles.newbieHero}>
              <div className={styles.newbieIcon}>🌌</div>
              <h2 className={styles.newbieTitle}>
                Пройди путешествие по 8 сферам своей жизни
              </h2>
              <p className={styles.newbieText}>
                Каждая планета — одна из 8 сфер: быт, отношения, дело, идеи, эмоции,
                воля, время, логика. На каждой ты проходишь уровни L0 → L3:
                знакомство, практика, интеграция, мастерство. По пути формируешь
                свои привычки, ведёшь дневник, видишь как растёт колесо баланса.
              </p>
              <p className={styles.newbieText}>
                Это <strong>самокоучинговая игра</strong> — не «развлечение», а
                инструмент для жизни. Чем дальше — тем глубже.
              </p>
              <button
                type="button"
                className={styles.newbieCta}
                onClick={onOpenJourney}
              >
                🚀 Начать путешествие
              </button>
              <div className={styles.muted} style={{ marginTop: 10 }}>
                После первых шагов на этом экране появятся твои сегодняшние
                практики, фокус-аспекты и быстрый дневник.
              </div>
            </div>
          </Section>
        ) : (
          <>
            {/* ── Сегодня ─────────────────────────── */}
            <Section label="🎯 Сегодня" className={styles.spanFull}>
              {data.habits.length === 0 ? (
                <div className={styles.emptyCard}>
                  <p className={styles.muted}>
                    Ты ещё не выбрал ни одной ежедневной практики. Открой страницу аспекта и нажми «+ Выбрать практику».
                  </p>
                  <button type="button" className={styles.btnPrimary} onClick={onOpenAspects}>
                    → К аспектам
                  </button>
                </div>
              ) : (
                <div className={styles.habitsList}>
                  {data.habits.map(h => (
                    <button
                      key={h.aspect}
                      type="button"
                      className={`${styles.habitRow} ${h.ticked_today ? styles.habitRowDone : ''}`}
                      onClick={() => handleHabitToggle(h)}
                      style={{ '--accent': ASPECT_COLORS[h.aspect] } as React.CSSProperties}
                    >
                      <span className={styles.habitAspect} style={{ color: ASPECT_COLORS[h.aspect] }}>
                        {ASPECT_DISPLAY_KEY[h.aspect] ?? h.aspect}
                      </span>
                      <span className={styles.habitTitle}>{h.title}</span>
                      <span className={styles.habitTick}>
                        {h.ticked_today ? '✓' : '☐'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Какая сфера интересна ────────────── */}
            <Section className={styles.spanFull}>
              <div className={styles.sphereCta}>
                <div>
                  <div className={styles.sphereCtaTitle}>Какая сфера жизни тебе интересна сейчас?</div>
                  <div className={styles.muted}>Выбери — увидишь карту аспекта, тематический холл и упражнения.</div>
                </div>
                <button type="button" className={styles.btnPrimary} onClick={onOpenAspects}>
                  → К аспектам
                </button>
              </div>
            </Section>
          </>
        )}

        {/* ── Личное: профиль + сообщения ───────── */}
        <Section label="✦ Я" className={styles.spanFull}>
          <div className={styles.personalRow}>
            <button
              type="button"
              className={styles.personalCard}
              onClick={onOpenMyProfile}
            >
              <span className={styles.personalIcon}>{data.user.avatar || '🧑'}</span>
              <div className={styles.personalBody}>
                <div className={styles.personalTitle}>Мой профиль</div>
                <div className={styles.muted}>
                  {data.user.display_name}
                  {(data.user.focus_aspects ?? []).length > 0 && ' · ' + (data.user.focus_aspects ?? []).map(a => ASPECT_DISPLAY_KEY[a] ?? a).join(', ')}
                </div>
              </div>
              <span className={styles.personalArrow}>→</span>
            </button>

            <button
              type="button"
              className={styles.personalCard}
              onClick={() => onOpenDMList?.()}
            >
              <span className={styles.personalIcon}>✉</span>
              <div className={styles.personalBody}>
                <div className={styles.personalTitle}>
                  Сообщения
                  {(data.dm_unread_count ?? 0) > 0 && (
                    <span className={styles.dmBadge}>{data.dm_unread_count}</span>
                  )}
                </div>
                <div className={styles.muted}>
                  {(data.dm_unread_count ?? 0) > 0
                    ? `${data.dm_unread_count} непрочитанных`
                    : 'Личные диалоги'}
                </div>
              </div>
              <span className={styles.personalArrow}>→</span>
            </button>
          </div>
        </Section>

        {/* ── Колесо мини + актуальный аспект ───── */}
        <Section label={<><WheelFlowerGlyph />Колесо баланса</>}>
          <div style={{ position: 'relative' }}>
            <Hint id="dashboard-wheel" user={user} position="top-right">
              8 сфер жизни. Колесо растёт по мере того, как ты проходишь
              шаги в путешествии и отвечаешь на вопросы навыков.
              Тыкни в любой сектор — откроется страница аспекта.
            </Hint>
            <MiniWheel
              scores={data.scores}
              size={220}
              onAspectClick={(a) => onOpenAspect?.(a)}
            />
          </div>
          <div className={styles.scoresLine}>
            {ASPECT_KEYS.map(k => (
              <span key={k} style={{ color: ASPECT_COLORS[k] }} className={styles.scoreChip}>
                {ASPECT_DISPLAY_KEY[k]} {(data.scores[k] ?? 5).toFixed(1)}
              </span>
            ))}
          </div>
          {active && (
            <div className={styles.activeAspectRow}>
              <span className={styles.muted}>Актуальный аспект:</span>{' '}
              <button
                type="button"
                className={styles.linkBtn}
                style={{ color: ASPECT_COLORS[active] }}
                onClick={() => onOpenAspect?.(active)}
              >
                {ASPECT_DISPLAY_KEY[active]} · {ASPECT_DATA[active]?.name ?? ''}
              </button>
              {lvl && (
                <div className={styles.muted}>
                  Пройдено шагов: <strong>{lvl.completed_steps}</strong>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── Коуч ─────────────────────────────── */}
        <Section label="🤖 ИИ-коуч">
          <div className={styles.coachCard}>
            <div className={styles.coachStats}>
              <div className={styles.coachBig}>
                {coachLocked ? '🔒' : `${data.coach.remaining_today}/${data.coach.daily_limit}`}
              </div>
              <div className={styles.muted}>
                {coachLocked
                  ? COACH_LOCKED_HINT
                  : (
                    <>
                      осталось сегодня
                      {(data.coach.streak_bonus ?? 0) > 0 && ` · бонус +${data.coach.streak_bonus}`}
                    </>
                  )}
              </div>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                if (coachLocked) { onOpenJourney?.(); return }
                onOpenCoach?.()
              }}
              disabled={!coachLocked && data.coach.remaining_today === 0}
              title={coachLocked ? COACH_LOCKED_HINT : undefined}
            >
              {coachLocked
                ? '🚀 К путешествию'
                : data.coach.remaining_today === 0 ? 'Вернётся завтра' : 'Позвать'}
            </button>
          </div>
        </Section>

        {/* ── Быстрая запись в дневник ───────── */}
        <Section label="📝 Быстрая запись" className={styles.spanFull}>
          <div className={styles.diaryRow}>
            <textarea
              className={styles.diaryInput}
              value={diaryText}
              onChange={e => setDiaryText(e.target.value)}
              onKeyDown={e => {
                if (shouldSendOnKeyDown(e, sendKeyMode) && diaryText.trim() && !savingDiary) {
                  e.preventDefault()
                  handleDiarySave()
                }
              }}
              placeholder="Что заметил, понял или почувствовал?"
              rows={2}
              maxLength={1000}
            />
            <select
              value={diaryAspect}
              onChange={e => setDiaryAspect(e.target.value as AspectKey | 'general')}
              className={styles.diarySelect}
            >
              <option value="general">— общая запись —</option>
              {ASPECT_KEYS.map(k => (
                <option key={k} value={k}>{ASPECT_DISPLAY_KEY[k]} · {ASPECT_DATA[k].name}</option>
              ))}
            </select>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleDiarySave}
              disabled={savingDiary || !diaryText.trim()}
            >
              {savingDiary ? 'Сохраняю…' : (diarySaved ? '✓ Сохранено' : 'Записать')}
            </button>
          </div>
        </Section>

        {/* ── Что нового ─────────────────────── */}
        {data.notifications.unread_count > 0 && (
          <Section label={`🔔 Что нового · ${data.notifications.unread_count}`}>
            <div className={styles.notifList}>
              {data.notifications.latest.map(n => (
                <div key={n.id} className={styles.notifItem}>
                  {describeNotif(n)}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Лента подписок ИЛИ топ авторов ─── */}
        {data.subs_feed.length > 0 ? (
          <Section label="👥 У твоих подписок">
            <div className={styles.feedList}>
              {data.subs_feed.map(it => (
                <div key={it.id} className={styles.feedItem}>
                  <button
                    type="button"
                    className={styles.feedAuthor}
                    onClick={() => onOpenProfile?.(it.user_id)}
                  >
                    {it.avatar || '🧑'} {it.display_name}
                  </button>
                  <span style={{ color: ASPECT_COLORS[it.aspect] }} className={styles.feedAspect}>
                    {ASPECT_DISPLAY_KEY[it.aspect] ?? it.aspect}
                  </span>
                  <div className={styles.feedText}>{trim(it.text, 160)}</div>
                </div>
              ))}
            </div>
          </Section>
        ) : data.suggested_authors.length > 0 && (
          <Section label="✨ Подпишись на интересных авторов">
            <div className={styles.muted} style={{ marginBottom: 10 }}>
              Активные авторы сообщества — у них много инсайтов и реакций.
            </div>
            <div className={styles.suggestedList}>
              {data.suggested_authors.map(a => (
                <div key={a.user_id} className={styles.suggestedItem}>
                  <span className={styles.feedAvatar}>{a.avatar || '🧑'}</span>
                  <button
                    type="button"
                    className={styles.feedAuthor}
                    onClick={() => onOpenProfile?.(a.user_id)}
                  >
                    {a.display_name}
                  </button>
                  <span className={styles.muted}>
                    {a.insights_count} инсайтов · {a.likes_received} реакций
                  </span>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => handleFollow(a.user_id)}
                  >
                    + Подписаться
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.linkBtn}
                onClick={onOpenLeaderboard}
              >
                → Полный топ
              </button>
            </div>
          </Section>
        )}

        {/* ── Слово дня ──────────────────────── */}
        {data.word_of_day && (
          <Section label="💭 Слово дня">
            <blockquote
              className={styles.quote}
              style={{ borderLeftColor: ASPECT_COLORS[data.word_of_day.aspect] }}
            >
              «{data.word_of_day.text}»
              <footer className={styles.quoteFooter}>
                — {data.word_of_day.author} ·{' '}
                <span style={{ color: ASPECT_COLORS[data.word_of_day.aspect] }}>
                  {ASPECT_DISPLAY_KEY[data.word_of_day.aspect] ?? data.word_of_day.aspect}
                </span>
              </footer>
            </blockquote>
          </Section>
        )}

        {/* ── DiscoverMore (Layer 3) ──────────── */}
        <div className={styles.spanFull}>
          <DiscoverMore
            data={data}
            journey={journey}
            user={user as Parameters<typeof DiscoverMore>[0]['user']}
            onOpenDiary={() => onOpenDiary?.()}
            onOpenPlanets={onOpenJourney}
            onOpenLeaderboard={onOpenLeaderboard}
            onOpenMyProfile={onOpenMyProfile}
            onReload={reload}
          />
        </div>

        {/* ── «Пройти обучение» — открывает IntroTour-как-«Обучение» ── */}
        {onOpenTour && (
          <div className={styles.spanFull}>
            <button
              type="button"
              className={styles.tourCta}
              onClick={onOpenTour}
            >
              <span className={styles.tourCtaIcon}>🎓</span>
              <span className={styles.tourCtaBody}>
                <span className={styles.tourCtaTitle}>Пройти обучение</span>
                <span className={styles.tourCtaSub}>
                  Краткий тур по приложению — 5 экранов с разъяснениями.
                  Открыть в любой момент.
                </span>
              </span>
              <span className={styles.tourCtaArrow}>→</span>
            </button>
          </div>
        )}

        {/* ── Heatmap 30 дней ────────────────── */}
        <Section label="📅 Активность за 30 дней" className={styles.spanFull}>
          <Heatmap userId={currentUserId} days={30} />
        </Section>
      </div>
    </div>
  )
}

type SectionProps = {
  label?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

function Section({ label, children, className = '' }: SectionProps) {
  return (
    <section className={`${styles.section} ${className}`}>
      {label && <div className={styles.sectionLabel}>{label}</div>}
      {children}
    </section>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function prettyDate(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })
}

function trim(t: string | null | undefined, n: number): string {
  if (!t) return ''
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function describeNotif(n: DashboardNotification): string {
  const p = (n.payload || {}) as Record<string, unknown>
  switch (n.type) {
    case 'reaction':
      return `${reactEmoji(p.reaction as string | undefined)} ${(p.actor_name as string | undefined) ?? 'Кто-то'} отреагировал на твой инсайт`
    case 'follow':
      return `+ ${(p.actor_name as string | undefined) ?? 'Кто-то'} подписался на тебя`
    case 'dm':
      return `💬 ${(p.sender_name as string | undefined) ?? 'Кто-то'}: «${trim((p.preview as string | undefined) ?? '', 80)}»`
    case 'hall_reply': {
      const aspKey = p.aspect as keyof typeof ASPECT_DISPLAY_KEY | undefined
      const aspLabel = aspKey ? (ASPECT_DISPLAY_KEY[aspKey] ?? String(aspKey)) : ''
      return `✦ ${(p.actor_name as string | undefined) ?? 'Кто-то'} в холле ${aspLabel}: «${trim((p.preview as string | undefined) ?? '', 80)}»`
    }
    case 'achievement':
      return `🏆 Разблокировано: ${(p.title as string | undefined) ?? (p.code as string | undefined) ?? '—'}`
    default:
      return n.type
  }
}

function reactEmoji(r: string | undefined): string {
  const map: Record<string, string> = { heart: '♥', thanks: '🙏', aha: '💡', fire: '🔥' }
  return r != null ? (map[r] ?? '♥') : '♥'
}
