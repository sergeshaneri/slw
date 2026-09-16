import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AspectKey, AspectScores } from '@/types/aspect'
import type { JourneyState } from '@/types/journey'
import type { LocalPanel } from './LiteApp'
import type { UnavailableFeatureId } from './UnavailableFeature'
import styles from './LiteHome.module.css'
import pearlImage from '../assets/wheel-pearl.png'
import coreAnimation from '../assets/wheel-core.gif'
import coreStill from '../assets/wheel-core-still.png'
import { membranePath, membraneWeave, scoreValue } from './wheelGeometry'
import { useWheelMotion } from './useWheelMotion'

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

function polarPoint(angle: number, radius: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180
  return { x: CENTER + Math.cos(radians) * radius, y: CENTER + Math.sin(radians) * radius }
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
  const values = AXES.map(axis => scoreValue(Number(scores[axis.key] ?? 5)))
  const homeRef = useRef<HTMLDivElement>(null)
  useWheelMotion(homeRef, values)
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

  return <div ref={homeRef} className={styles.home}>
    <div className={styles.ambient} aria-hidden="true" />
    {fallbackNotice && <p className={styles.notice} role="status">{fallbackNotice}</p>}
    <section className={styles.dashboard} aria-label="Моё колесо баланса">
      <div className={styles.intro}>


        <h2>Моё колесо баланса</h2>
        <p className={styles.date}>Сегодня, {formatDate()}</p>
        <div className={styles.introRule} aria-hidden="true" />
        <p className={styles.balanceLine}>Общий баланс <strong data-average>{formatNumber(average)}</strong> <span>/ 10</span></p>


      </div>

      <div ref={visualRef} className={styles.wheelStage} onPointerMove={handlePointerMove} onPointerLeave={resetPointer}>
        <div className={styles.wheelAura} aria-hidden="true" />
        <div className={styles.wheelParallax}>
          <svg className={styles.wheel} viewBox={'0 0 ' + SIZE + ' ' + SIZE} role="img" aria-labelledby="wheel-title wheel-description">
            <title id="wheel-title">Колесо баланса по восьми аспектам</title>
            <desc id="wheel-description">Радиальная диаграмма показывает оценки от 0 до 10. Наведите курсор на ось, чтобы увидеть значение.</desc>
            <defs>
              <clipPath id="pearl-crop"><circle cx="300" cy="300" r="210" /></clipPath>
              <radialGradient id="membrane-fill">
                <stop offset="0%" stopColor="#5988f8" stopOpacity=".24" />
                <stop offset="64%" stopColor="#479fdd" stopOpacity=".16" />
                <stop offset="90%" stopColor="#507adb" stopOpacity=".2" />
                <stop offset="100%" stopColor="#ac78f3" stopOpacity=".18" />
              </radialGradient>
              <radialGradient id="node-halo"><stop stopColor="#68dcff" stopOpacity=".8" /><stop offset=".45" stopColor="#8949ff" stopOpacity=".35" /><stop offset="1" stopColor="#65dfff" stopOpacity="0" /></radialGradient>
              {[0,1,2,3].map(index => <linearGradient key={index} id={'silk-' + index} gradientTransform={'rotate(' + index * 55 + ' .5 .5)'} x1={index % 2 ? '0%' : '100%'} y1="0%" x2={index % 2 ? '100%' : '0%'} y2="100%">
                <stop offset="0%" stopColor="#24dfff" stopOpacity=".15" /><stop offset="18%" stopColor="#2eeaff" /><stop offset="34%" stopColor="#bd7aff" stopOpacity=".7" /><stop offset="46%" stopColor="#ee89ff" /><stop offset="53%" stopColor="#ffb575" /><stop offset="64%" stopColor="#db64ff" /><stop offset="80%" stopColor="#459aff" stopOpacity=".45" /><stop offset="93%" stopColor="#56f5ff" /><stop offset="100%" stopColor="#9268ff" stopOpacity=".3" />
              </linearGradient>)}
              <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <filter id="silk-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" /></filter>
              <linearGradient id="membrane-stroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6ee7ff" />
                <stop offset="30%" stopColor="#c07dff" />
                <stop offset="58%" stopColor="#ffb45c" />
                <stop offset="78%" stopColor="#ed8eff" />
                <stop offset="100%" stopColor="#2ed9ff" />
              </linearGradient>
              <radialGradient id="nucleus-fill" cx="36%" cy="28%" r="75%">
                <stop offset="0%" stopColor="#eaffff" /><stop offset=".13" stopColor="#7cf7ff" /><stop offset=".3" stopColor="#2ca3ec" /><stop offset=".5" stopColor="#5842da" /><stop offset=".72" stopColor="#292172" /><stop offset=".85" stopColor="#ac65ff" /><stop offset="1" stopColor="#87eaff" />
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
              {[.125, .25, .375, .5, .625, .75, .875, 1, 1.09, 1.18].map(level => <circle key={level} cx={CENTER} cy={CENTER} r={RADIUS * level} />)}
              {AXES.map(axis => { const point = polarPoint(axis.angle, RADIUS); return <line key={axis.key} x1={CENTER} y1={CENTER} x2={point.x} y2={point.y} /> })}
              {[2, 4, 6, 8, 10].map(level => { const point = polarPoint(-90, RADIUS * level / 10); return <text key={level} x={CENTER + 10} y={point.y + 4}>{level}</text> })}
            </g>
            <path data-membrane="trail" className={styles.membraneTrail} d={membranePath(values)} filter="url(#soft-glow)" />
            <path data-membrane="glow" className={styles.membraneShadow} d={membranePath(values)} filter="url(#soft-glow)" />
            <path data-membrane="surface" className={styles.membrane} d={membranePath(values)} filter="url(#membrane-glow)" />
            <g filter="url(#silk-glow)" opacity=".55" aria-hidden="true">
              {[4,8,12].map(thread => <path key={thread} data-membrane="ribbon" data-thread={thread} className={styles.ribbon} d={membraneWeave(values, thread, true)} fill={'url(#silk-' + thread % 4 + ')'} />)}
            </g>
            {[0,1,2,3].map(thread => <path key={thread} data-membrane="ribbon" data-thread={thread} className={styles.ribbon} d={membraneWeave(values, thread, true)} fill={'url(#silk-' + thread % 4 + ')'} />)}
            {Array.from({length: 12}, (_, thread) => <path key={thread} data-membrane="filament" data-thread={thread} className={styles.filament} d={membraneWeave(values, thread)} stroke={'url(#silk-' + thread % 4 + ')'} opacity={thread < 4 ? .7 : .24} />)}
            <path data-membrane="strand" data-thread="2" className={styles.strand} d={membraneWeave(values, 2)} stroke="#e7feff" strokeDasharray="8 43 18 71" filter="url(#node-glow)" />
            {[14,20,26,32,38].map(thread => <path key={thread} data-membrane="filament" data-thread={thread} className={styles.filament} d={membraneWeave(values, thread)} stroke="url(#silk-1)" opacity=".38" />)}
            {[.42,.61,.78].map(scale => <path key={scale} data-membrane="inner-light" data-scale={scale} className={styles.innerLight} d={membranePath(values, scale)} />)}
            <path data-membrane="highlight" className={styles.membraneHighlight} d={membranePath(values)} />
            {AXES.map((axis, index) => {
              const point = polarPoint(axis.angle, RADIUS * (values[index] / 10))

              const isActive = activeAxis === index
              return <g key={axis.key} className={styles.axisPoint + ' ' + (isActive ? styles.axisActive : '')}>
                <circle data-node={index} className={styles.axisHalo} cx={point.x} cy={point.y} r={isActive ? 19 : 14} />
                <svg data-orb={index} className={styles.pearlNode} x={point.x - 4.5} y={point.y - 4.5} width="9" height="9" viewBox="89 89 422 422" aria-hidden="true">
                  <image href={pearlImage} width="600" height="600" clipPath="url(#pearl-crop)" />
                </svg>
              </g>
            })}
            <foreignObject x={CENTER - 48} y={CENTER - 48} width="96" height="96" className={styles.coreMedia} aria-hidden="true">
              <div className={styles.coreCrop}><picture>
                <source media="(prefers-reduced-motion: reduce)" srcSet={coreStill} />
                <img src={coreAnimation} alt="" />
              </picture></div>
            </foreignObject>
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
                data-axis={axis.label + ', ' + axis.code}
                data-index={index}
                aria-label={axis.label + ', ' + axis.code + ', ' + formatNumber(values[index]) + ' из 10'}
                aria-pressed={isActive}
                onClick={() => setActiveAxis(index)}
                onFocus={() => setActiveAxis(index)}

              >
                <span>{axis.label}</span><strong data-score={index}>{formatNumber(values[index])}</strong>
              </button>
            })}
          </div>
        </div>

      </div>

      <aside className={styles.sidePanel} aria-label="Сводка за сегодня">
        <div className={styles.panelTopline}><span>Сегодня</span><span className={styles.metricIcon} aria-hidden="true"><i /><i /><i /></span></div>
        <div className={styles.bigMetric} data-average>{formatNumber(average)}</div>
        <p className={styles.metricLabel}>средний баланс</p>
        <p className={styles.progress}><strong>{completed}</strong> шагов · <strong>{diaryCount}</strong> записей</p>
        {active && <div className={styles.focusCard} role="status"><span>{active.code}</span><strong>{active.label}</strong><b data-score={activeAxis} data-suffix=" / 10">{formatNumber(activeValue ?? 0)} / 10</b><small>Оценка аспекта</small></div>}
        <button type="button" className={styles.primary} onClick={() => onNavigate('journey')}>Продолжить путешествие <span aria-hidden="true">→</span></button>
        <button type="button" className={styles.diaryLink} onClick={() => onNavigate('diary')}><span aria-hidden="true">▤</span><span>Последняя запись {diaryCount > 0 ? '· открыть' : '· пока нет'}</span><span aria-hidden="true">→</span></button>

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
