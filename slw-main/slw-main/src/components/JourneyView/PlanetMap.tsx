import type { CSSProperties } from 'react'
import type { AspectKey } from '@/types/aspect'
import type { JourneyState, AspectState } from '@/types/journey'
import { getAllPlanets } from '../../data/journey/registry'
import { ASPECT_DISPLAY_KEY } from '../../data/aspects'
import Hint from '../Onboarding/Hint'
import styles from './PlanetMap.module.css'

// PlanetMap — экран выбора планеты (аспекта).
//
// Показывает 8 карточек со всеми аспектами. По клику на доступную —
// onSwitch(key) переключает state.currentAspect и переводит в чат.
// Locked-карточки кликабельны, но показывают тост вместо переключения.

// Структурный shape планеты, как возвращает registry.getAllPlanets().
// NOTE(ts): tightened in P3 — registry.ts экспортирует Planet тип.
type Planet = {
  aspect: AspectKey
  name: string
  realm?: string
  planet?: string
  color: string
  available: boolean
}

type CardStatus =
  | { kind: 'locked'; label: string; level?: number }
  | { kind: 'progress'; label: string; level: number }
  | { kind: 'idle'; label: string; level?: number }

type Props = {
  state: JourneyState
  user?: unknown
  onSwitch: (aspectKey: AspectKey) => void
  onClose?: () => void
  onLockedTap?: () => void
}

export default function PlanetMap({ state, user, onSwitch, onClose, onLockedTap }: Props) {
  const planets = getAllPlanets() as Planet[]
  const activeAspect = state.currentAspect

  return (
    <div className={styles.shell}>
      <div className={styles.topBar}>
        {onClose && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={onClose}
            aria-label="Назад"
          >
            <span aria-hidden="true">←</span>
            <span>Назад</span>
          </button>
        )}
      </div>

      <div className={styles.titleBlock}>
        <div className={styles.eyebrow}>Карта Путешествия</div>
        <h1 className={styles.title}>Выбери планету</h1>
        <p className={styles.subtitle}>
          Каждый аспект — это отдельный мир со своим путём.
          Переключайся между ними свободно: твой прогресс сохраняется в каждом.
        </p>
        <Hint id="planetmap-intro" user={user} position="top-right">
          Тыкни на любую планету и начни познавать свои сферы жизни.
        </Hint>
      </div>

      <div className={styles.grid}>
        {planets.map(p => {
          const folder = state.aspects?.[p.aspect]
          // «Сейчас здесь» появляется ТОЛЬКО когда на планете уже начат
          // скрипт (или есть прогресс уровня) — иначе все 8 показывают
          // зовущее «Начать путешествие», и БС не выглядит «занятой».
          const hasRealProgress =
            (folder?.completedScripts?.length ?? 0) > 0 ||
            (folder?.currentLevel ?? 0) > 0 ||
            !!folder?.currentScriptId
          const isActive = activeAspect === p.aspect && hasRealProgress
          const status = computeStatus(p, folder)
          return (
            <PlanetCard
              key={p.aspect}
              planet={p}
              status={status}
              isActive={isActive}
              onClick={() => {
                if (!p.available) {
                  onLockedTap?.()
                  return
                }
                onSwitch(p.aspect)
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// Status: одно из 'active' | 'progress' | 'idle' | 'locked'.
// «Прогресс» = юзер реально что-то сделал (закрыл хотя бы один скрипт
// или перешёл на >L0). Просто заход на планету (есть intro в messages,
// но completedScripts пустой) не считается прогрессом — иначе карта
// врёт после случайного клика.
function computeStatus(planet: Planet, folder: AspectState | undefined): CardStatus {
  if (!planet.available) return { kind: 'locked', label: 'Скоро' }
  const level = folder?.currentLevel ?? 0
  const completed = folder?.completedScripts?.length ?? 0
  if (level > 0 || completed > 0) {
    return { kind: 'progress', label: `Уровень ${level}`, level }
  }
  return { kind: 'idle', label: 'Начать' }
}

type PlanetColorStyle = CSSProperties & { '--planet-color'?: string }

type CardProps = {
  planet: Planet
  status: CardStatus
  isActive: boolean
  onClick: () => void
}

function PlanetCard({ planet, status, isActive, onClick }: CardProps) {
  const { aspect, name, realm, color, planet: latin, available } = planet
  const cls = [
    styles.card,
    isActive && styles.active,
    !available && styles.locked,
    status.kind === 'progress' && styles.hasProgress,
  ].filter(Boolean).join(' ')

  const cardStyle: PlanetColorStyle = { '--planet-color': color }
  const statusClass = (styles as Record<string, string>)[`status_${status.kind}`] ?? ''

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      style={cardStyle}
    >
      <div className={styles.cardHead}>
        <span className={styles.glyph} aria-hidden="true">◍</span>
        <span className={styles.aspectKey}>{ASPECT_DISPLAY_KEY[aspect]}</span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.aspectName}>{name}</div>
        {realm && <div className={styles.realm}>{realm}</div>}
        {latin && <div className={styles.latin}>{latin}</div>}
      </div>

      <div className={styles.cardFoot}>
        {isActive && (
          <span className={styles.activeTag}>Сейчас здесь</span>
        )}
        {!isActive && (
          <span className={`${styles.statusTag} ${statusClass}`}>
            {status.kind === 'progress' && <span aria-hidden="true">✓ </span>}
            {status.label}
          </span>
        )}
      </div>
    </button>
  )
}
