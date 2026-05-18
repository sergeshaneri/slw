import { useState } from 'react'
import UsersTab from './UsersTab'
import StatsTab from './StatsTab'
import BulkTab from './BulkTab'
import ModerationTab from './ModerationTab'
import NotifyTab from './NotifyTab'
import styles from './AdminView.module.css'

type TabId = 'users' | 'stats' | 'bulk' | 'moderation' | 'notify'

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'users',      label: '👥 Юзеры' },
  { id: 'stats',      label: '📊 Статистика' },
  { id: 'bulk',       label: '⚙ Массовые операции' },
  { id: 'moderation', label: '🛡 Модерация' },
  { id: 'notify',     label: '🔔 Уведомления' },
]

type Props = {
  onBack?: () => void
  onImpersonateApply?: (token: string, user: unknown) => void
}

/**
 * Admin Panel — корневой компонент с вкладками.
 * Виден только юзерам с is_admin=true.
 */
export default function AdminView({ onBack, onImpersonateApply }: Props) {
  const [tab, setTab] = useState<TabId>('users')

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Admin</span>
        <h1 className={styles.title}>🛡 Admin Panel</h1>
        <div className={styles.subline}>Юзеры, статистика, массовые операции, модерация.</div>
        {onBack && (
          <button type="button" className={styles.backBtn} onClick={onBack}>
            ← Назад
          </button>
        )}
      </div>

      <div className={styles.tabsRow}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === 'users' && (
          <UsersTab onImpersonateApply={onImpersonateApply} />
        )}
        {tab === 'stats' && <StatsTab />}
        {tab === 'bulk' && <BulkTab />}
        {tab === 'moderation' && <ModerationTab />}
        {tab === 'notify' && <NotifyTab />}
      </div>
    </div>
  )
}
