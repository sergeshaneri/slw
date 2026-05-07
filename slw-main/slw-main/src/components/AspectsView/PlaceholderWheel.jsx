import styles from './SiWheel.module.css'

// Placeholder-колесо для аспектов, у которых ещё нет дерева навыков
// (Ti / Se / Fi / Te и т.п.). Структура совпадает с SiWheel/FeWheel —
// заголовок, общий рейтинг (—/10), круглый SVG с 4 пустыми секторами
// и подсказка «Скоро».
//
// Когда для аспекта появится skill-tree, в AspectsView нужно заменить
// <PlaceholderWheel/> на реальное колесо (SiWheel, FeWheel и т.п.).
//
// Props:
//   aspectName    — короткий код аспекта на кириллице (БС/ЧС/...).
//   aspectFull    — полное имя («Чёрная Сенсорика»).
//   color         — accent-цвет аспекта.
export default function PlaceholderWheel({ aspectName, aspectFull, color }) {
  const cx = 200
  const cy = 200
  const R = 150
  const sectors = 4

  // 4 равных сектора, каждый — четверть круга.
  const sectorPaths = []
  for (let i = 0; i < sectors; i++) {
    const a0 = (i / sectors) * 2 * Math.PI - Math.PI / 2
    const a1 = ((i + 1) / sectors) * 2 * Math.PI - Math.PI / 2
    const x0 = cx + R * Math.cos(a0)
    const y0 = cy + R * Math.sin(a0)
    const x1 = cx + R * Math.cos(a1)
    const y1 = cy + R * Math.sin(a1)
    sectorPaths.push(
      `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`
    )
  }

  return (
    <section className={styles.wheel} style={{ '--accent': color }}>
      <header className={styles.wheelHeader}>
        <div className={styles.wheelTitleBlock}>
          <span className={styles.wheelEyebrow}>Колесо {aspectName}</span>
          <h2 className={styles.wheelTitle}>{aspectFull}</h2>
        </div>
        <div className={styles.wheelStat}>
          <div className={styles.wheelStatVal}>
            —<span className={styles.wheelStatTotal}>/10</span>
          </div>
          <div className={styles.wheelStatLbl}>скоро</div>
        </div>
      </header>

      <div className={styles.stageBadge}>
        Дерево навыков {aspectName} скоро будет добавлено
      </div>

      <div className={styles.svgWrap}>
        <svg viewBox="0 0 400 400" width="100%" height="auto" aria-hidden="true">
          {/* Контур */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 4" />
          {/* 4 пустых сектора */}
          {sectorPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={color}
              fillOpacity={0.04}
              stroke={color}
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          ))}
          {/* Центральная подпись */}
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            fillOpacity={0.55}
            fontSize="28"
            fontWeight="600"
          >
            {aspectName}
          </text>
          <text
            x={cx}
            y={cy + 28}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            fillOpacity={0.4}
            fontSize="13"
          >
            скоро
          </text>
        </svg>
      </div>
    </section>
  )
}
