import { getAllPlanets } from '../../data/journey/registry'
import { ASPECT_DISPLAY_KEY } from '../../data/aspects'
import styles from './PlanetMap.module.css'

// PlanetMap — экран выбора планеты (аспекта).
//
// Показывает 8 карточек со всеми аспектами. По клику на доступную —
// onSwitch(key) переключает state.currentAspect и переводит в чат.
// Locked-карточки кликабельны, но показывают тост вместо переключения.
//
// Props:
//   state         — журнал (нужен для статуса прогресса по каждой планете)
//   onSwitch      — (aspectKey) => void
//   onClose       — закрыть карту, остаться в текущем аспекте
//   onLockedTap   — () => void — что показать при тапе на «скоро»-карточку
export default function PlanetMap({ state, onSwitch, onClose, onLockedTap }) {
  const planets = getAllPlanets()
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
      </div>

      <div className={styles.grid}>
        {planets.map(p => {
          const folder = state.aspects?.[p.aspect]
          const isActive = activeAspect === p.aspect
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
function computeStatus(planet, folder) {
  if (!planet.available) return { kind: 'locked', label: 'Скоро' }
  const level = folder?.currentLevel ?? 0
  const completed = folder?.completedScripts?.length ?? 0
  if (level > 0 || completed > 0) {
    return { kind: 'progress', label: `Уровень ${level}`, level }
  }
  return { kind: 'idle', label: 'Не начато' }
}

function PlanetCard({ planet, status, isActive, onClick }) {
  const { aspect, name, realm, color, planet: latin, available } = planet
  const cls = [
    styles.card,
    isActive && styles.active,
    !available && styles.locked,
    status.kind === 'progress' && styles.hasProgress,
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      style={{ '--planet-color': color }}
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
          <span className={`${styles.statusTag} ${styles[`status_${status.kind}`]}`}>
            {status.kind === 'progress' && <span aria-hidden="true">✓ </span>}
            {status.label}
          </span>
        )}
      </div>
    </button>
  )
}
