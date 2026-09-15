import type { LocalPanel } from './LiteApp'
import type { UnavailableFeatureId } from './UnavailableFeature'
import styles from './LiteHeader.module.css'

type HeaderPanel = LocalPanel | 'hall' | 'unavailable'
const LOCAL_NAV: ReadonlyArray<{ panel: LocalPanel; label: string }> = [
  { panel: 'home', label: 'Главная' }, { panel: 'journey', label: 'Путешествие' },
  { panel: 'aspects', label: 'Аспекты' }, { panel: 'catalog', label: 'Каталог' }, { panel: 'diary', label: 'Дневник' },
]
const SERVER_NAV: ReadonlyArray<{ feature: UnavailableFeatureId; label: string }> = [
  { feature: 'community', label: 'Сообщество' }, { feature: 'coach', label: 'ИИ-коуч' },
  { feature: 'messages', label: 'Сообщения' }, { feature: 'profile', label: 'Профиль' },
  { feature: 'likes', label: 'Реакции' }, { feature: 'follows', label: 'Подписки' },
  { feature: 'hall-chat', label: 'Чат холла' }, { feature: 'hall-qa', label: 'Вопросы и ответы холла' },
  { feature: 'hall-publications', label: 'Публикации холла' },
  { feature: 'habit-tracker', label: 'Трекер привычек' },
  { feature: 'diary-emotions', label: 'Эмоции дневника' }, { feature: 'diary-trainings', label: 'Тренировки дневника' },
  { feature: 'analytics-reports', label: 'Аналитические отчёты' }, { feature: 'vault-sync', label: 'Vault Sync' },
  { feature: 'streak-protection', label: 'Защита серии' }, { feature: 'word-bonus', label: 'Бонус слова дня' },
  { feature: 'leaderboard', label: 'Рейтинг и достижения' }, { feature: 'notifications', label: 'Уведомления' },
  { feature: 'server-search', label: 'Поиск по серверу' }, { feature: 'admin', label: 'Администрирование' },
  { feature: 'support', label: 'Поддержка' }, { feature: 'account', label: 'Вход и аккаунт' },
]

export function LiteHeader({ panel, canGoBack, onBack, onNavigate, onUnavailable }: {
  panel: HeaderPanel
  canGoBack: boolean
  onBack: () => void
  onNavigate: (panel: LocalPanel) => void
  onUnavailable: (feature: UnavailableFeatureId) => void
}) {
  return <header className={styles.header}>
    <div className={styles.identity}>
      {canGoBack && <button type="button" className={styles.iconButton} onClick={onBack} aria-label="Назад" title="Назад">←</button>}
      <button type="button" className={styles.brand} onClick={() => onNavigate('home')} aria-label="На главную">
        <span>Соционика</span><strong>Колесо Баланса</strong>
      </button>
    </div>
    <nav className={styles.nav} aria-label="Разделы локальной версии">
      {LOCAL_NAV.map(item => <button key={item.panel} type="button" aria-current={panel === item.panel ? 'page' : undefined} onClick={() => onNavigate(item.panel)}>{item.label}</button>)}
    </nav>
    <div className={styles.actions}>
      <details className={styles.serverMenu}>
        <summary>Серверные функции</summary>
        <div className={styles.serverMenuList}>{SERVER_NAV.map(item => <button key={item.feature} type="button" onClick={(event) => { onUnavailable(item.feature); (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open') }}>{item.label}</button>)}</div>
      </details>
      <button type="button" className={styles.iconButton} aria-current={panel === 'settings' ? 'page' : undefined} onClick={() => onNavigate('settings')} aria-label="Настройки" title="Настройки">⚙</button>
    </div>
  </header>
}
