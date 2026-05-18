import { ru } from '../../locales/ru'
import NotificationsBell from '../Notifications/NotificationsBell'
import type { User } from '@/types/user'
import type { ViewName } from '@/types/view'
import styles from './Header.module.css'

// Минимальные слайсы локали, которые Header реально использует. typeof ru
// даёт точные литеральные ключи, так что опечатка в `t.nav.foo` отобьётся.
type Locale = typeof ru
type HeaderLocale = {
  app: Pick<Locale['app'], 'title' | 'subtitle'>
  nav: Pick<Locale['nav'], 'dashboard' | 'journey' | 'aspects' | 'diary' | 'leaderboard' | 'coach'>
}

type Props = {
  view: ViewName
  onViewChange: (view: ViewName) => void
  journeyPendingCount?: number
  journeyHighlight?: boolean
  aspectsHighlight?: boolean
  user: User | null
  userAvatar?: string
  onLogin?: () => void
  onLogout: () => void
  onOpenMyProfile?: () => void
  t: HeaderLocale
  onOpenProfile?: (userId: number | string) => void
  onOpenDM?: (partnerId?: number | string | null) => void
  onOpenHall?: (aspect: string) => void
  onOpenAdmin?: () => void
}

type NavItem = {
  id: ViewName
  label: string
  badge?: number
}

export default function Header({
  view,
  onViewChange,
  journeyPendingCount = 0,
  journeyHighlight = false,
  aspectsHighlight = false,
  user,
  userAvatar,
  onLogin,
  onLogout,
  onOpenMyProfile,
  t,
  onOpenProfile,
  onOpenDM,
  onOpenHall,
  onOpenAdmin,
}: Props) {
  const navItems: NavItem[] = [
    // Главная: для залогиненных — Дашборд, гостям — сразу Аспекты (read-only).
    ...(user ? [{ id: 'dashboard' as const, label: t.nav.dashboard }] : []),
    { id: 'journey', label: t.nav.journey, badge: journeyPendingCount },
    { id: 'aspects', label: t.nav.aspects },
    { id: 'diary', label: t.nav.diary },
    // Топ публичный (без auth) — виден всем.
    { id: 'leaderboard', label: t.nav.leaderboard },
    // Коуч гейтится в App.jsx:handleViewChange — без логина откроется AuthModal.
    { id: 'coach', label: t.nav.coach },
    // Колесо и Прогресс убраны (2026-05). Функционал колеса — в MiniWheel
    // на дашборде; история оценок не использовалась — функционал удалён.
    // Сообщения и Профиль на дашборде + аватар справа.
  ]

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <div className={styles.subtitle}>{t.app.title}</div>
        <div className={styles.mainTitle}>{t.app.subtitle}</div>
      </div>

      <nav className={styles.nav}>
        {navItems.map(item => {
          let highlightLabel: string | null = null
          if (item.id === 'journey' && journeyHighlight) highlightLabel = '👈 Тут начинается игра'
          else if (item.id === 'aspects' && aspectsHighlight) highlightLabel = '👆 Тут больше информации по сферам жизни'
          const isHighlight = !!highlightLabel
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`${styles.navButton} ${view === item.id ? styles.active : ''} ${isHighlight ? styles.navHighlight : ''}`}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && <span className={styles.navBadge}>{item.badge}</span>}
              {isHighlight && (
                <span className={styles.navHighlightLabel}>
                  {highlightLabel}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className={styles.authBlock}>
        {user && (
          <NotificationsBell
            onOpenProfile={onOpenProfile}
            onOpenDM={onOpenDM}
            onOpenHall={onOpenHall}
          />
        )}
        {user ? (
          <>
            {!user.email && onLogin && (
              <button
                type="button"
                onClick={onLogin}
                className={styles.authBtn}
                title="Добавить email и пароль к аккаунту"
              >
                + email
              </button>
            )}
            {user.is_admin && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className={styles.authBtn}
                title="Admin Panel"
              >
                🛡 admin
              </button>
            )}
            {onOpenMyProfile && (
              <button
                type="button"
                onClick={onOpenMyProfile}
                className={styles.avatarBtn}
                title="Мой профиль"
              >
                <span className={styles.avatarEmoji}>{userAvatar || '🧑'}</span>
                <span className={styles.avatarName}>
                  {user.telegram_first_name || user.email?.split('@')[0] || 'Профиль'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className={styles.authBtn}
              title="Выйти"
            >
              выйти
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className={styles.authBtn}
          >
            Войти
          </button>
        )}
      </div>
    </header>
  )
}
