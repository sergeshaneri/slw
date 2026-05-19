import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  /** Доступна ли «Назад» — в стеке навигации есть более ранний экран. */
  canGoBack?: boolean
  /** Откатиться на предыдущий снимок навигации (view + aux-стейт). */
  onGoBack?: () => void
  journeyPendingCount?: number
  journeyHighlight?: boolean
  aspectsHighlight?: boolean
  user: User | null
  userAvatar?: string
  /** Сколько шагов путешествия юзер прошёл — для гейта ИИ-коуча (≥5). */
  totalStepsCompleted?: number
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
  /** Кнопка визуально приглушена + дисэйблена + показывает tooltip. */
  locked?: boolean
  lockedTitle?: string
}

const COACH_UNLOCK_AT = 5

export default function Header({
  view,
  onViewChange,
  canGoBack = false,
  onGoBack,
  journeyPendingCount = 0,
  journeyHighlight = false,
  aspectsHighlight = false,
  user,
  userAvatar,
  totalStepsCompleted = 0,
  onLogin,
  onLogout,
  onOpenMyProfile,
  t,
  onOpenProfile,
  onOpenDM,
  onOpenHall,
  onOpenAdmin,
}: Props) {
  // ИИ-коуч заблокирован пока юзер не прошёл хотя бы 5 шагов путешествия.
  // На незалогиненных тоже показываем lock — чтобы было видно что фича
  // существует, но не для гостей.
  const coachLocked = !user || totalStepsCompleted < COACH_UNLOCK_AT
  const coachLockedTitle =
    'ИИ-коуч доступен тем, кто начал путешествие по планетам и прошёл хотя бы 5 шагов'

  const navItems: NavItem[] = [
    // Главная: для залогиненных — Дашборд, гостям — сразу Аспекты (read-only).
    ...(user ? [{ id: 'dashboard' as const, label: t.nav.dashboard }] : []),
    { id: 'journey', label: t.nav.journey, badge: journeyPendingCount },
    { id: 'aspects', label: t.nav.aspects },
    { id: 'diary', label: t.nav.diary },
    // Топ публичный (без auth) — виден всем.
    { id: 'leaderboard', label: t.nav.leaderboard },
    // Коуч гейтится: до 5 пройденных шагов — затемнён и показывает tooltip.
    {
      id: 'coach',
      label: t.nav.coach,
      locked: coachLocked,
      lockedTitle: coachLockedTitle,
    },
    // Колесо и Прогресс убраны (2026-05). Функционал колеса — в MiniWheel
    // на дашборде; история оценок не использовалась — функционал удалён.
    // Сообщения и Профиль на дашборде + аватар справа.
  ]

  // Активный hint-label — для мобильного баннера (на десктопе тултип под
  // кнопкой работает, на мобиле его клипает overflow-x:auto у .nav).
  // Оба highlight'а не пересекаются по условиям (journey: 0 шагов,
  // aspects: ≥3 шагов), так что один баннер за раз.
  // Используем 👆 (вверх) — баннер ниже nav, стрелка должна указывать НА кнопку
  // которая выше.
  const activeHighlight: string | null =
    journeyHighlight ? '👆 Тут начинается игра' :
    aspectsHighlight ? '👆 Тут больше информации по сферам жизни' :
    null

  // Refs на подсвеченные кнопки — нужны чтобы вычислить X-координату центра
  // кнопки и спозиционировать баннер ПОД ней (а не растягивать на всю
  // ширину header). На мобиле .nav scroll'ится, position обновляется на
  // resize/scroll/смену highlight'а.
  const journeyBtnRef = useRef<HTMLButtonElement | null>(null)
  const aspectsBtnRef = useRef<HTMLButtonElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const [hintX, setHintX] = useState<number | null>(null)

  useEffect(() => {
    if (!activeHighlight) { setHintX(null); return }
    const update = (): void => {
      const target = journeyHighlight ? journeyBtnRef.current
                   : aspectsHighlight ? aspectsBtnRef.current
                   : null
      const header = navRef.current?.closest('header') as HTMLElement | null
      if (!target || !header) { setHintX(null); return }
      const r = target.getBoundingClientRect()
      const headerR = header.getBoundingClientRect()
      // Центр X кнопки относительно левого края header'а.
      setHintX(r.left + r.width / 2 - headerR.left)
    }
    update()
    window.addEventListener('resize', update)
    // Скролл внутри .nav (overflow-x:auto) тоже сдвигает кнопку — слушаем.
    const nav = navRef.current
    nav?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      nav?.removeEventListener('scroll', update)
    }
  }, [activeHighlight, journeyHighlight, aspectsHighlight])

  return (
    <header className={styles.header}>
      {/* Группируем логотип и back-кнопку, чтобы лого не "ездил" при появлении
          стрелки — позиция логотипа фиксирована, back возникает справа от него,
          поближе к nav-кнопкам (активной зоне). */}
      <div className={styles.headerLeft}>
        <div className={styles.title}>
          <div className={styles.subtitle}>{t.app.title}</div>
          <div className={styles.mainTitle}>{t.app.subtitle}</div>
        </div>
        {canGoBack && onGoBack && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={onGoBack}
            title="Назад"
            aria-label="Назад"
          >
            ←
          </button>
        )}
      </div>

      <nav className={styles.nav} ref={navRef}>
        {navItems.map(item => {
          let highlightLabel: string | null = null
          if (item.id === 'journey' && journeyHighlight) highlightLabel = '👈 Тут начинается игра'
          else if (item.id === 'aspects' && aspectsHighlight) highlightLabel = '👆 Тут больше информации по сферам жизни'
          const isHighlight = !!highlightLabel
          // Locked-кнопка остаётся кликабельной (alert через title) —
          // визуально приглушена, не отключена hard (чтобы tooltip работал
          // на мобиле через клик). Клик показывает alert с пояснением.
          const handleClick = () => {
            if (item.locked) {
              window.alert(item.lockedTitle || 'Функция заблокирована')
              return
            }
            onViewChange(item.id)
          }
          // Ref только на подсвеченную кнопку — её координаты нужны для
          // позиционирования hint-баннера ниже на мобиле.
          const refForButton =
            item.id === 'journey' && journeyHighlight ? journeyBtnRef :
            item.id === 'aspects' && aspectsHighlight ? aspectsBtnRef :
            undefined
          return (
            <button
              key={item.id}
              ref={refForButton}
              type="button"
              onClick={handleClick}
              title={item.locked ? item.lockedTitle : undefined}
              aria-disabled={item.locked || undefined}
              className={`${styles.navButton} ${view === item.id ? styles.active : ''} ${isHighlight ? styles.navHighlight : ''} ${item.locked ? styles.navLocked : ''}`}
            >
              <span>{item.label}</span>
              {item.locked && <span className={styles.navLockIcon}>🔒</span>}
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

      {/* Мобильный hint-баннер — виден на ≤1024px вместо тултипа под кнопкой
          (тот клипается overflow-x:auto у .nav). Позиционируется по
          --hint-x (X-центр подсвеченной кнопки относительно header'а),
          стрелочка ::before указывает вверх НА кнопку. На десктопе скрыт. */}
      {activeHighlight && (
        <div
          className={styles.navHighlightBanner}
          style={hintX != null ? ({ '--hint-x': `${hintX}px` } as CSSProperties) : undefined}
        >
          {activeHighlight}
        </div>
      )}

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
