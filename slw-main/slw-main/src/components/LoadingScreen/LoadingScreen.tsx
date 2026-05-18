import styles from './LoadingScreen.module.css'

// Восемь аспектов — восемь спиц колеса.
// Цвета синхронизированы с data/aspects.js (ASPECT_COLORS).
const SPOKE_COLORS = [
  '#9d4edd', // ЧЛ
  '#7b2cbf', // БЛ
  '#c77dff', // ЧЭ
  '#e0aaff', // БЭ
  '#5e60ce', // ЧС
  '#a8d97b', // БС
  '#4895ef', // ЧИ
  '#3a86ff', // БИ
]

const R = 78
const CENTER = 100

type Props = {
  text?: string
}

export default function LoadingScreen({ text }: Props) {
  return (
    <div className={styles.container} role="status" aria-busy="true">
      <div className={styles.glow} />

      <div className={styles.stage}>
        <svg
          className={styles.wheel}
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <defs>
            <filter id="lsBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Внешнее тонкое кольцо — статичное, как контур колеса. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            className={styles.ring}
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R - 14}
            className={styles.ringInner}
          />

          {/* Спицы — крутятся группой, мерцают индивидуально. */}
          <g className={styles.spokes}>
            {SPOKE_COLORS.map((color, i) => {
              const angle = (i / SPOKE_COLORS.length) * 360 - 90
              const rad = (angle * Math.PI) / 180
              const x2 = CENTER + Math.cos(rad) * R
              const y2 = CENTER + Math.sin(rad) * R
              return (
                <line
                  key={i}
                  x1={CENTER}
                  y1={CENTER}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#lsBlur)"
                  className={styles.spoke}
                  style={{ animationDelay: `${i * 0.13}s` }}
                />
              )
            })}
            {/* Точки на конце каждой спицы — добавляют объём. */}
            {SPOKE_COLORS.map((color, i) => {
              const angle = (i / SPOKE_COLORS.length) * 360 - 90
              const rad = (angle * Math.PI) / 180
              const cx = CENTER + Math.cos(rad) * R
              const cy = CENTER + Math.sin(rad) * R
              return (
                <circle
                  key={`d-${i}`}
                  cx={cx}
                  cy={cy}
                  r="3.2"
                  fill={color}
                  filter="url(#lsBlur)"
                  className={styles.dot}
                  style={{ animationDelay: `${i * 0.13}s` }}
                />
              )
            })}
          </g>

          {/* Центральный «глаз» колеса. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r="5"
            className={styles.core}
          />
        </svg>
      </div>

      <div className={styles.brand}>
        <div className={styles.eyebrow}>Соционическое</div>
        <div className={styles.title}>Колесо Баланса</div>
      </div>

      {text && <div className={styles.text}>{text}</div>}
    </div>
  )
}
