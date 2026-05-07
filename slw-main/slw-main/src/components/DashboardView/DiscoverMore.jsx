import { dismissDiscoverCard } from '../../api/client'
import styles from './DiscoverMore.module.css'

// Список карточек. Каждая знает, при каких условиях она актуальна
// (`show({ data, journey, user })`), и какое действие делает (`action`).
const CARDS = [
  {
    id: 'daily-review',
    icon: '📅',
    title: 'Запиши сегодняшний день',
    desc: 'Эмоции, тренировки, привычки в одном экране.',
    cta: 'Открыть Дневник',
    action: 'open-diary',
    show: ({ data }) => {
      const map = data?.diary_today_count_by_source ?? {}
      return (map['daily-review'] ?? 0) === 0
    },
  },
  {
    id: 'all-planets',
    icon: '🌍',
    title: 'Открой все 8 планет',
    desc: 'Каждая грань — свой мир. Карта показывает прогресс по каждой.',
    cta: 'Карта Планет',
    action: 'open-planets',
    show: ({ journey }) => {
      const visited = Object.values(journey?.aspects ?? {}).filter(
        a => (a?.completedScripts?.length ?? 0) > 0
      ).length
      return visited <= 1
    },
  },
  {
    id: 'subscribe',
    icon: '👥',
    title: 'Подпишись на интересных авторов',
    desc: 'В лидерборде есть люди, у которых много инсайтов. Подписки = обновления в ленте.',
    cta: 'Лидерборд',
    action: 'open-leaderboard',
    show: ({ data }) => (data?.user?.following_count ?? 0) === 0,
  },
  {
    id: 'publish',
    icon: '✨',
    title: 'Опубликуй первый инсайт',
    desc: 'Делись находками по аспекту — за реакции дают XP.',
    cta: 'Профиль',
    action: 'open-profile',
    show: ({ data }) => (data?.published_insights_count ?? 0) === 0,
  },
  {
    id: 'profile',
    icon: '🎨',
    title: 'Заполни профиль',
    desc: 'Аватар, bio, фокус-аспекты — это твоя витрина.',
    cta: 'Открыть профиль',
    action: 'open-profile',
    show: ({ data }) => !data?.user?.bio || !data?.user?.avatar,
  },
]

/**
 * «Открой больше» — секция dynamic-карточек на дашборде (Layer 3).
 * Закрытие карточки крестиком кладёт ключ в hints_seen с префиксом
 * `discover-`. После того как все карточки скрыты, секция исчезает.
 *
 * Props:
 *   data, journey, user — от родителя (DashboardView).
 *   onOpenDiary / onOpenPlanets / onOpenLeaderboard / onOpenMyProfile — навигация.
 *   onReload — после dismiss перезагрузить дашборд (флаг придёт со /api).
 */
export default function DiscoverMore({
  data,
  journey,
  user,
  onOpenDiary,
  onOpenPlanets,
  onOpenLeaderboard,
  onOpenMyProfile,
  onReload,
}) {
  // hints_seen может прийти двумя путями: из user (App.jsx — обновляется
  // при логине / перезагрузке страницы) и из data.user (свежий ответ
  // /api/dashboard, который обновляется при reload). Сливаем — так после
  // dismiss карточка исчезает сразу.
  const seen = { ...(user?.hints_seen ?? {}), ...(data?.user?.hints_seen ?? {}) }
  const cards = CARDS.filter(c => !seen[`discover-${c.id}`] && c.show({ data, journey, user }))
  if (cards.length === 0) return null

  const handleAction = (card) => {
    switch (card.action) {
      case 'open-diary':       onOpenDiary?.(); break
      case 'open-planets':     onOpenPlanets?.(); break
      case 'open-leaderboard': onOpenLeaderboard?.(); break
      case 'open-profile':     onOpenMyProfile?.(); break
      default: break
    }
  }

  const handleDismiss = async (card) => {
    try { await dismissDiscoverCard(card.id) } catch { /* best-effort */ }
    onReload?.()
  }

  return (
    <section className={styles.section}>
      <div className={styles.label}>✨ Открой больше</div>
      <div className={styles.cards}>
        {cards.map(card => (
          <div key={card.id} className={styles.card}>
            <button
              type="button"
              className={styles.cardDismiss}
              onClick={() => handleDismiss(card)}
              aria-label="Скрыть карточку"
              title="Скрыть"
            >×</button>
            <div className={styles.icon}>{card.icon}</div>
            <div className={styles.title}>{card.title}</div>
            <div className={styles.desc}>{card.desc}</div>
            <button
              type="button"
              className={styles.cta}
              onClick={() => handleAction(card)}
            >
              {card.cta} →
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
