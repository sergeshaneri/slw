import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AspectKey, AspectScores } from '@/types/aspect'
import type { JourneyState } from '@/types/journey'
import type { LocalPanel } from './LiteApp'
import type { UnavailableFeatureId } from './UnavailableFeature'
import styles from './LiteHome.module.css'

type Axis = {
  key: AspectKey
  code: string
  label: string
  angle: number
}

const AXES: readonly Axis[] = [
  { key: 'Si', code: 'БС', label: 'Тело', angle: -90 },
  { key: 'Fe', code: 'ЧЭ', label: 'Эмоции', angle: -45 },
  { key: 'Fi', code: 'БЭ', label: 'Отношения', angle: 0 },
  { key: 'Te', code: 'ЧЛ', label: 'Работа', angle: 45 },
  { key: 'Ti', code: 'БЛ', label: 'Структура', angle: 90 },
  { key: 'Se', code: 'ЧС', label: 'Воля', angle: 135 },
  { key: 'Ne', code: 'ЧИ', label: 'Идеи', angle: 180 },
  { key: 'Ni', code: 'БИ', label: 'Смысл', angle: 225 },
]

const SIZE = 640
const CENTER = SIZE / 2
const RADIUS = 222

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function polarPoint(angle: number, radius: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180
  return { x: CENTER + Math.cos(radians) * radius, y: CENTER + Math.sin(radians) * radius }
}

function pointsForScores(values: readonly number[], radius = RADIUS): string {
  return values.map((value, index) => {
    const point = polarPoint(AXES[index].angle, radius * (value / 10))
    return point.x.toFixed(2) + ',' + point.y.toFixed(2)
  }).join(' ')
}

function gridPoints(level: number): string {
  return AXES.map(axis => {
    const point = polarPoint(axis.angle, RADIUS * level / 10)
    return point.x.toFixed(2) + ',' + point.y.toFixed(2)
  }).join(' ')
}

function formatDate(): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date())
}

function formatNumber(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function LiteHome({ journey, scores, diaryCount, fallbackNotice, onNavigate, onUnavailable }: {
  journey: JourneyState
  scores: AspectScores
  diaryCount: number
  fallbackNotice?: string
  onNavigate: (panel: LocalPanel) => void
  onUnavailable: (feature: UnavailableFeatureId) => void
}) {
  const [activeAxis, setActiveAxis] = useState<number | null>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const completed = Object.values(journey.aspects).reduce((sum, aspect) => sum + (aspect?.completedScripts.length ?? 0), 0)
  const values = useMemo(() => AXES.map(axis => clamp(Number(scores[axis.key] ?? 5), 0, 10)), [scores])
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const active = activeAxis === null ? null : AXES[activeAxis]
  const activeValue = activeAxis === null ? null : values[activeAxis]

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width - .5) * 2
    const y = ((event.clientY - bounds.top) / bounds.height - .5) * 2
    event.currentTarget.style.setProperty('--pointer-x', (x * 7).toFixed(2) + 'px')
    event.currentTarget.style.setProperty('--pointer-y', (y * 7).toFixed(2) + 'px')
  }

  const resetPointer = () => {
    visualRef.current?.style.setProperty('--pointer-x', '0px')
    visualRef.current?.style.setProperty('--pointer-y', '0px')
  }

  return <div className={styles.home}>
    <div className={styles.ambient} aria-hidden="true" />
    {fallbackNotice && <p className={styles.notice} role="status">{fallbackNotice}</p>}
    <section className={styles.dashboard} aria-label="Моё колесо баланса">
      <div className={styles.intro}>
        <h1 className={styles.brandHeading}>Соционика: Колесо Баланса</h1>
        <span className={styles.eyebrow}>ЛИЧНЫЙ ПРОФИЛЬ</span>
        <h2>Моё колесо<br />баланса</h2>
        <p className={styles.date}>Сегодня, {formatDate()}</p>
        <div className={styles.introRule} aria-hidden="true" />
        <p className={styles.balanceLine}>Общий баланс <strong>{formatNumber(average)}</strong> <span>/ 10</span></p>

        <div className={styles.introStats} aria-label="Локальный прогресс">
          <span><strong>{completed}</strong> шагов</span>
          <span><strong>{diaryCount}</strong> записей</span>
        </div>
      </div>

      <div ref={visualRef} className={styles.wheelStage} onPointerMove={handlePointerMove} onPointerLeave={resetPointer}>
        <div className={styles.wheelAura} aria-hidden="true" />
        <div className={styles.wheelParallax}>
          <svg className={styles.wheel} viewBox={'0 0 ' + SIZE + ' ' + SIZE} role="img" aria-labelledby="wheel-title wheel-description">
            <title id="wheel-title">Колесо баланса по восьми аспектам</title>
            <desc id="wheel-description">Радиальная диаграмма показывает оценки от 0 до 10. Наведите курсор на ось, чтобы увидеть значение.</desc>
            <defs>
              <linearGradient id="membrane-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6ee7ff" stopOpacity=".28" />
                <stop offset="38%" stopColor="#8d4be8" stopOpacity=".18" />
                <stop offset="72%" stopColor="#f5a7ff" stopOpacity=".24" />
                <stop offset="100%" stopColor="#2ed9ff" stopOpacity=".12" />
              </linearGradient>
              <linearGradient id="membrane-stroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6ee7ff" />
                <stop offset="30%" stopColor="#c07dff" />
                <stop offset="58%" stopColor="#ffb45c" />
                <stop offset="78%" stopColor="#ed8eff" />
                <stop offset="100%" stopColor="#2ed9ff" />
              </linearGradient>
              <radialGradient id="nucleus-fill" cx="34%" cy="28%">
                <stop offset="0%" stopColor="#fbf5ff" />
                <stop offset="16%" stopColor="#6ee7ff" />
                <stop offset="48%" stopColor="#6746d8" />
                <stop offset="100%" stopColor="#151b50" />
              </radialGradient>
              <filter id="membrane-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="soft-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
            </defs>
            <g className={styles.gridLayer}>
              {[.2, .4, .6, .8, 1].map(level => <polygon key={level} points={gridPoints(level)} />)}
              {AXES.map(axis => { const point = polarPoint(axis.angle, RADIUS); return <line key={axis.key} x1={CENTER} y1={CENTER} x2={point.x} y2={point.y} /> })}
              {[2, 4, 6, 8, 10].map(level => { const point = polarPoint(-90, RADIUS * level / 10); return <text key={level} x={CENTER + 10} y={point.y + 4}>{level}</text> })}
            </g>
            <polygon className={styles.membraneShadow} points={pointsForScores(values, RADIUS + 2)} filter="url(#soft-glow)" />
            <polygon className={styles.membrane} points={pointsForScores(values)} filter="url(#membrane-glow)" />
            <polygon className={styles.membraneHighlight} points={pointsForScores(values, RADIUS - 4)} />
            {AXES.map((axis, index) => {
              const point = polarPoint(axis.angle, RADIUS * (values[index] / 10))
              const outer = polarPoint(axis.angle, RADIUS)
              const isActive = activeAxis === index
              return <g key={axis.key} className={styles.axisPoint + ' ' + (isActive ? styles.axisActive : '')}>
                <circle className={styles.axisHalo} cx={point.x} cy={point.y} r={isActive ? 19 : 14} />
                <circle className={styles.axisNode} cx={point.x} cy={point.y} r={isActive ? 7 : 5.5} />
                <circle className={styles.outerNode} cx={outer.x} cy={outer.y} r="4" />
              </g>
            })}
            <circle className={styles.nucleusGlow} cx={CENTER} cy={CENTER} r="34" filter="url(#soft-glow)" />
            <circle className={styles.nucleus} cx={CENTER} cy={CENTER} r="24" />
            <circle className={styles.nucleusCore} cx={CENTER} cy={CENTER} r="11" />
          </svg>
          <div className={styles.axisHitTargets} aria-label="Оценки аспектов">
            {AXES.map((axis, index) => {
              const point = polarPoint(axis.angle, RADIUS + 48)
              const isActive = activeAxis === index
              return <button
                key={axis.key}
                type="button"
                className={styles.axisLabel + ' ' + (isActive ? styles.axisLabelActive : '')}
                style={{ left: (point.x / SIZE * 100) + '%', top: (point.y / SIZE * 100) + '%' }}
                aria-label={axis.label + ', ' + axis.code + ', ' + formatNumber(values[index]) + ' из 10'}
                aria-pressed={isActive}
                onClick={() => setActiveAxis(index)}
                onFocus={() => setActiveAxis(index)}

              >
                <span>{axis.label}</span><strong>{formatNumber(values[index])}</strong>
              </button>
            })}
          </div>
        </div>
        <p className={styles.wheelHint}>Наведите на ось, чтобы увидеть оценку</p>
      </div>

      <aside className={styles.sidePanel} aria-label="Сводка за сегодня">
        <div className={styles.panelTopline}><span>СЕГОДНЯ</span><span className={styles.metricIcon} aria-hidden="true"><i /><i /><i /></span></div>
        <div className={styles.bigMetric}>{formatNumber(average)}</div>
        <p className={styles.metricLabel}>средний баланс</p>
        <p className={styles.trend}><span aria-hidden="true">↑</span> +0.4 <em>за 7 дней</em></p>
        {active && <div className={styles.focusCard} role="status"><span>{active.code}</span><strong>{active.label}</strong><b>{formatNumber(activeValue ?? 0)} / 10</b><small>Оценка аспекта</small></div>}
        <button type="button" className={styles.primary} onClick={() => onNavigate('journey')}>Продолжить путешествие <span aria-hidden="true">→</span></button>
        <button type="button" className={styles.diaryLink} onClick={() => onNavigate('diary')}><span aria-hidden="true">▤</span><span>Последняя запись {diaryCount > 0 ? '· сегодня' : '· пока нет'}</span><span aria-hidden="true">→</span></button>

      </aside>
    </section>

    <footer className={styles.footerBar}>
      <div className={styles.footerActions} aria-label="Действия с колесом">
        <button type="button" onClick={() => onNavigate('aspects')}><span aria-hidden="true">↻</span> Обновить колесо</button>
        <button type="button" onClick={() => onNavigate('catalog')}><span aria-hidden="true">◷</span> История</button>
        <button type="button" onClick={() => onNavigate('diary')}><span aria-hidden="true">▱</span> Открыть дневник</button>
      </div>

    </footer>

    <div className={styles.utilityLinks} aria-label="Быстрый доступ">
      <button type="button" onClick={() => onNavigate('catalog')}><strong>Каталог</strong><span>Теория, навыки и вопросы по восьми аспектам</span></button>
      <button type="button" onClick={() => onNavigate('aspects')}><strong>Аспекты</strong><span>Теория, оценки и тематические подборки</span></button>
      <button type="button" onClick={() => onNavigate('settings')}><strong>Настройки</strong><span>Экспорт и импорт локальных данных</span></button>
    </div>
  </div>
}
