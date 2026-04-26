import styles from './Header.module.css'

export default function Header({ view, onViewChange, journeyPendingCount = 0, user, onLogin, onLogout, t }) {
  const navItems = [
    { id: 'wheel', label: t.nav.wheel },
    { id: 'journey', label: t.nav.journey, badge: journeyPendingCount },
    { id: 'aspects', label: t.nav.aspects },
    { id: 'diary', label: t.nav.diary },
    { id: 'progress', label: t.nav.progress }
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
        {user ? (
          <button
            type="button"
            onClick={onLogout}
            className={styles.authBtn}
            title={user.email ?? user.name ?? 'Профиль'}
          >
            {user.name || user.email?.split('@')[0] || 'Профиль'} · выйти
          </button>
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
