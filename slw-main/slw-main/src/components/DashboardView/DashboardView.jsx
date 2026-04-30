import { useEffect, useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import {
  fetchDashboard,
  tickHabit,
  untickHabit,
  postDiaryEntry,
  followUser,
} from '../../api/client'
import MiniWheel from './MiniWheel'
import Heatmap from '../Heatmap/Heatmap'
import styles from './DashboardView.module.css'

// Маленький цветок-глиф для лейбла «Колесо баланса». 8 лепестков по
// цветам аспектов. Заменяет красный emoji ⭕ на цветной знак, который
// тематически вяжется с самим колесом.
function WheelFlowerGlyph({ size = 18 }) {
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

const STREAK_STATUS_LABEL = {
  none:         'Стрик ещё не начался',
  ticked_today: 'Сегодня уже отметился ✓',
  due_today:    '⚠ Сделай что-то сегодня — стрик в зоне риска',
  shielded:     '🛡 Защита покрыла пропуск',
  broken:       'Стрик сорвался — начни новый',
}

/**
 * Дашборд — главный экран для залогиненных. Один запрос /api/dashboard.
 * Гостям не показывается (App.jsx гейтит).
 */
export default function DashboardView({
  currentUserId,
  onOpenAspect,
  onOpenAspects,
  onOpenWheel,
  onOpenJourney,
  onOpenCoach,
  onOpenHall,
  onOpenProfile,
  onOpenMyProfile,
  onOpenDM,
  onOpenDMList,
  onOpenLeaderboard,
}) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(null)
  const [diaryText, setDiaryText] = useState('')
  const [diaryAspect, setDiaryAspect] = useState('general')
  const [savingDiary, setSavingDiary] = useState(false)
  const [diarySaved, setDiarySaved] = useState(false)

  const reload = async () => {
    setBusy(true)
    try {
      setData(await fetchDashboard())
    } catch (e) {
      setError(e.message ?? 'Не удалось загрузить дашборд')
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

  const handleHabitToggle = async (h) => {
    try {
      if (h.ticked_today) await untickHabit(h.aspect)
      else await tickHabit(h.aspect)
      reload()
    } catch (e) {
      setError(e.message ?? 'Не удалось')
    }
  }

  const handleDiarySave = async () => {
    const t = diaryText.trim()
    if (!t || savingDiary) return
    setSavingDiary(true)
    try {
      await postDiaryEntry({
        text: t,
        aspect: diaryAspect === 'general' ? null : diaryAspect,
        source: 'web',
      })
      setDiaryText('')
      setDiarySaved(true)
      setTimeout(() => setDiarySaved(false), 2000)
      reload()
    } catch (e) {
      setError(e.message ?? 'Не удалось сохранить')
    } finally {
      setSavingDiary(false)
    }
  }

  const handleFollow = async (userId) => {
    try {
      await followUser(userId)
      reload()
    } catch (e) {
      setError(e.message ?? 'Не удалось')
    }
  }

  const lvl = data.level_progress
  const active = data.active_aspect

  return (
    <div className={styles.container}>
      {/* ── Шапка ──────────────────────────────── */}
      <div className={styles.greetRow}>
        <div>
          <div className={styles.greet}>{greet}, {data.user.display_name}</div>
          <div className={styles.muted}>{prettyDate(data.today)}</div>
        </div>
        <div className={styles.streakBlock} style={{ color: streakColor }}>
          <div className={styles.streakNumber}>🔥 {streak.current ?? 0}</div>
          <div className={styles.streakStatus}>
            {STREAK_STATUS_LABEL[streak.status] || ''}
          </div>
        </div>
      </div>

      <div className={styles.grid}>
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
                  style={{ '--accent': ASPECT_COLORS[h.aspect] }}
                >
                  <span className={styles.habitAspect} style={{ color: ASPECT_COLORS[h.aspect] }}>
                    {h.aspect}
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
                  {(data.user.focus_aspects ?? []).length > 0 && ' · ' + data.user.focus_aspects.join(', ')}
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
                  {data.dm_unread_count > 0 && (
                    <span className={styles.dmBadge}>{data.dm_unread_count}</span>
                  )}
                </div>
                <div className={styles.muted}>
                  {data.dm_unread_count > 0
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
          <MiniWheel
            scores={data.scores}
            size={220}
            onAspectClick={(a) => onOpenAspect?.(a)}
            onCenterClick={onOpenWheel}
          />
          <div className={styles.scoresLine}>
            {ASPECT_KEYS.map(k => (
              <span key={k} style={{ color: ASPECT_COLORS[k] }} className={styles.scoreChip}>
                {k} {(data.scores[k] ?? 5).toFixed(1)}
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
                {active} · {ASPECT_DATA[active]?.name ?? ''}
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
                {data.coach.remaining_today}/{data.coach.daily_limit}
              </div>
              <div className={styles.muted}>
                осталось сегодня
                {data.coach.streak_bonus > 0 && ` · бонус +${data.coach.streak_bonus}`}
              </div>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={onOpenCoach}
              disabled={data.coach.remaining_today === 0}
            >
              {data.coach.remaining_today === 0 ? 'Вернётся завтра' : 'Позвать'}
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
              placeholder="Что заметил, понял или почувствовал?"
              rows={2}
              maxLength={1000}
            />
            <select
              value={diaryAspect}
              onChange={e => setDiaryAspect(e.target.value)}
              className={styles.diarySelect}
            >
              <option value="general">— общая запись —</option>
              {ASPECT_KEYS.map(k => (
                <option key={k} value={k}>{k} · {ASPECT_DATA[k].name}</option>
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
                    {it.aspect}
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
                  {data.word_of_day.aspect}
                </span>
              </footer>
            </blockquote>
          </Section>
        )}

        {/* ── Heatmap 30 дней ────────────────── */}
        <Section label="📅 Активность за 30 дней" className={styles.spanFull}>
          <Heatmap userId={currentUserId} days={30} />
        </Section>
      </div>
    </div>
  )
}

function Section({ label, children, className = '' }) {
  return (
    <section className={`${styles.section} ${className}`}>
      {label && <div className={styles.sectionLabel}>{label}</div>}
      {children}
    </section>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function prettyDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })
}

function trim(t, n) {
  if (!t) return ''
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function describeNotif(n) {
  const p = n.payload || {}
  switch (n.type) {
    case 'reaction':
      return `${reactEmoji(p.reaction)} ${p.actor_name ?? 'Кто-то'} отреагировал на твой инсайт`
    case 'follow':
      return `+ ${p.actor_name ?? 'Кто-то'} подписался на тебя`
    case 'dm':
      return `💬 ${p.sender_name ?? 'Кто-то'}: «${trim(p.preview ?? '', 80)}»`
    case 'hall_reply':
      return `✦ ${p.actor_name ?? 'Кто-то'} в холле ${p.aspect}: «${trim(p.preview ?? '', 80)}»`
    case 'achievement':
      return `🏆 Разблокировано: ${p.title ?? p.code ?? '—'}`
    default:
      return n.type
  }
}

function reactEmoji(r) {
  return ({ heart: '♥', thanks: '🙏', aha: '💡', fire: '🔥' })[r] ?? '♥'
}
