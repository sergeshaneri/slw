import styles from './Header.module.css'

export default function Header({ view, onViewChange, t }) {
  const navItems = [
    { id: 'wheel', label: t.nav.wheel },
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
            onClick={() => onViewChange(item.id)}
            className={`${styles.navButton} ${view === item.id ? styles.active : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
