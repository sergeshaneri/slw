import NotificationsBell from '../Notifications/NotificationsBell'
import styles from './Header.module.css'

export default function Header({
  view,
  onViewChange,
  journeyPendingCount = 0,
  user,
  onLogin,
  onLogout,
  t,
  onOpenProfile,
  onOpenDM,
  onOpenHall,
}) {
  const navItems = [
    // Главная: для залогиненных — Дашборд, гостям — сразу к Колесу.
    ...(user ? [{ id: 'dashboard', label: t.nav.dashboard }] : []),
    { id: 'wheel', label: t.nav.wheel },
    { id: 'journey', label: t.nav.journey, badge: journeyPendingCount },
    { id: 'aspects', label: t.nav.aspects },
    { id: 'diary', label: t.nav.diary },
    { id: 'progress', label: t.nav.progress },
    // Топ публичный (без auth) — виден всем.
    { id: 'leaderboard', label: t.nav.leaderboard },
    // Коуч и Профиль гейтятся в App.jsx:handleViewChange — без логина
    // откроется AuthModal.
    { id: 'coach', label: t.nav.coach },
    ...(user ? [{ id: 'dm', label: t.nav.dm }] : []),
    ...(user ? [{ id: 'search', label: t.nav.search }] : []),
    // Настройки переехали внутрь страницы Профиля.
    ...(user ? [{ id: 'profile', label: t.nav.profile }] : []),
  ]

  return (
    <header className={styles.header}>
      <div className={styles.title}>
        <div className={styles.subtitle}>{t.app.title}</div>
        <div className={styles.mainTitle}>{t.app.subtitle}</div>
      </div>

      <nav className={styles.nav}>
        {navItems.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            className={`${styles.navButton} ${view === item.id ? styles.active : ''}`}
          >
            <span>{item.label}</span>
            {item.badge > 0 && <span className={styles.navBadge}>{item.badge}</span>}
          </button>
        ))}
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
            <button
              type="button"
              onClick={onLogout}
              className={styles.authBtn}
              title={user.email ?? user.telegram_first_name ?? 'Профиль'}
            >
              {user.telegram_first_name || user.email?.split('@')[0] || 'Профиль'} · выйти
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
