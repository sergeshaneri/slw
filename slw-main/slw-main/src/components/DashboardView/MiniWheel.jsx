import { ASPECT_KEYS, ASPECT_COLORS } from '../../data/aspects'
import styles from './MiniWheel.module.css'

/**
 * Мини-колесо для дашборда. 8 секторов; радиус каждого = его оценка.
 * Клик по сектору → onAspectClick(aspect). Клик по центру → onCenterClick.
 *
 * Без интерактивных регуляторов — это компактный обзор. Полное колесо
 * (с настройкой оценок) живёт в WheelView.
 */
export default function MiniWheel({ scores, size = 220, onAspectClick, onCenterClick }) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 8
  const slice = (Math.PI * 2) / ASPECT_KEYS.length

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className={styles.svg}
      >
        {/* Кольца-ориентиры */}
        {[2, 4, 6, 8, 10].map(v => (
          <circle
            key={v}
            cx={cx} cy={cy}
            r={(v / 10) * maxR}
            className={styles.ring}
          />
        ))}

        {/* Сектора */}
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
          const labelA = a0 + slice / 2
          const labelR = maxR + 6
          const lx = cx + Math.cos(labelA) * labelR * 0.92
          const ly = cy + Math.sin(labelA) * labelR * 0.92
          return (
            <g key={key} onClick={() => onAspectClick?.(key)} className={styles.sector}>
              <path d={path} fill={ASPECT_COLORS[key]} fillOpacity={0.65} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.label}
                fill={ASPECT_COLORS[key]}
              >
                {key}
              </text>
            </g>
          )
        })}

        {/* Центр (опционально кликабельный) */}
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.08}
          className={styles.center}
          onClick={onCenterClick}
        />
      </svg>
    </div>
  )
}
