import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import type { AspectKey, AspectScores } from '@/types/aspect'
import styles from './MiniWheel.module.css'

type Props = {
  scores: AspectScores
  size?: number
  onAspectClick?: (aspect: AspectKey) => void
  onCenterClick?: () => void
}

/**
 * Мини-колесо для дашборда. 8 секторов; радиус каждого = его оценка
 * (1..10 → 10..maxR). Подписи аспектов рисуются СНАРУЖИ внешнего обода —
 * выглядит как настоящее колесо.
 *
 * Клик по сектору → onAspectClick(aspect). Клик по центру → onCenterClick.
 *
 * Без интерактивных регуляторов — это компактный обзор. Полное колесо
 * (с настройкой оценок) живёт в WheelView.
 */
export default function MiniWheel({ scores, size = 240, onAspectClick, onCenterClick }: Props) {
  const cx = size / 2
  const cy = size / 2
  // Запас наружу под подписи аспектов и под жирный обод колеса.
  const labelPadding = 28
  const maxR = size / 2 - labelPadding
  const rimR = maxR + 4
  const labelR = maxR + 18
  const slice = (Math.PI * 2) / ASPECT_KEYS.length

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className={styles.svg}
      >
        <defs>
          {/* Неоновое свечение для контура секторов. */}
          <filter id="mwNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Внешний обод — «рамка» колеса. */}
        <circle cx={cx} cy={cy} r={rimR} className={styles.rimOuter} />
        <circle cx={cx} cy={cy} r={rimR - 4} className={styles.rimInner} />

        {/* Кольца-ориентиры внутри колеса. */}
        {[2, 4, 6, 8].map(v => (
          <circle
            key={v}
            cx={cx} cy={cy}
            r={(v / 10) * maxR}
            className={styles.ring}
          />
        ))}

        {/* Контур каждого сектора до 10 — неоновое свечение цвета аспекта.
           Рисуем ПОД заполняющими путями, чтобы fill сектора прикрывал
           часть контура и видна была только «внешняя дуга до края». */}
        {ASPECT_KEYS.map((key, i) => {
          const a0 = -Math.PI / 2 + i * slice
          const a1 = a0 + slice
          const x1 = cx + Math.cos(a0) * maxR
          const y1 = cy + Math.sin(a0) * maxR
          const x2 = cx + Math.cos(a1) * maxR
          const y2 = cy + Math.sin(a1) * maxR
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${maxR} ${maxR} 0 0 1 ${x2} ${y2} Z`
          return (
            <path
              key={`outline-${key}`}
              d={path}
              fill="none"
              stroke={ASPECT_COLORS[key]}
              strokeWidth="1.6"
              strokeLinejoin="round"
              filter="url(#mwNeonGlow)"
              className={styles.outline}
              opacity={0.85}
            />
          )
        })}

        {/* Сектора. */}
        {ASPECT_KEYS.map((key, i) => {
          const value = scores?.[key] ?? 5
          const r = (value / 10) * maxR
          const a0 = -Math.PI / 2 + i * slice
          const a1 = a0 + slice
          const x1 = cx + Math.cos(a0) * r
          const y1 = cy + Math.sin(a0) * r
          const x2 = cx + Math.cos(a1) * r
          const y2 = cy + Math.sin(a1) * r
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`
          // Подпись — снаружи обода, по центру угла сектора.
          const labelA = a0 + slice / 2
          const lx = cx + Math.cos(labelA) * labelR
          const ly = cy + Math.sin(labelA) * labelR
          return (
            <g key={key} onClick={() => onAspectClick?.(key)} className={styles.sector}>
              <path d={path} fill={ASPECT_COLORS[key]} fillOpacity={0.7} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.label}
                fill={ASPECT_COLORS[key]}
              >
                {ASPECT_DISPLAY_KEY[key]}
              </text>
            </g>
          )
        })}

        {/* Спицы колеса — едва видимые радиальные линии до обода. */}
        {ASPECT_KEYS.map((_, i) => {
          const a = -Math.PI / 2 + i * slice
          const x = cx + Math.cos(a) * maxR
          const y = cy + Math.sin(a) * maxR
          return (
            <line
              key={`spoke-${i}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              className={styles.spoke}
            />
          )
        })}

        {/* Центр (кликабельный — открывает полное колесо). */}
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.07}
          className={styles.center}
          onClick={onCenterClick}
        />
      </svg>
    </div>
  )
}
