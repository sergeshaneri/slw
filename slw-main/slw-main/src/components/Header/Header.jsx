import NotificationsBell from '../Notifications/NotificationsBell'
import styles from './Header.module.css'

export default function Header({
  view,
  onViewChange,
  journeyPendingCount = 0,
  journeyHighlight = false,
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
}) {
  const navItems = [
    // Главная: для залогиненных — Дашборд, гостям — сразу Аспекты (read-only).
    ...(user ? [{ id: 'dashboard', label: t.nav.dashboard }] : []),
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
          const isHighlight = item.id === 'journey' && journeyHighlight
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`${styles.navButton} ${view === item.id ? styles.active : ''} ${isHighlight ? styles.navHighlight : ''}`}
            >
              <span>{item.label}</span>
              {item.badge > 0 && <span className={styles.navBadge}>{item.badge}</span>}
              {isHighlight && (
                <span className={styles.navHighlightLabel}>
                  👈 Тут начинается игра
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
