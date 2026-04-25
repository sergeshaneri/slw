import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import styles from './ProgressView.module.css'

export default function ProgressView({ history, scores, t }) {
  const chartData = history.map(h => {
    const obj = { date: h.date }
    ASPECT_KEYS.forEach(key => obj[key] = h.scores[key])
    return obj
  })

  if (history.length < 2) {
    return (
      <div className={styles.container}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Прогресс</span>
          <h1 className={styles.title}>{t.progress.title}</h1>
        </div>
        <div className={styles.noData}>{t.progress.noData}</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>Прогресс</span>
        <h1 className={styles.title}>{t.progress.title}</h1>
      </div>

      <div className={styles.chartCard}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 14, right: 24, left: 0, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#8f929c', fontSize: 12 }} />
            <YAxis domain={[0, 10]} tick={{ fill: '#8f929c', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: '#15161c',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 10,
                fontSize: 13,
                color: '#e9eaee',
                padding: '10px 14px'
              }}
            />
            {ASPECT_KEYS.map(key => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={ASPECT_COLORS[key]}
                strokeWidth={2}
                dot={{ r: 3, fill: ASPECT_COLORS[key] }}
                activeDot={{ r: 5, fill: ASPECT_COLORS[key] }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        <div className={styles.legend}>
          {ASPECT_KEYS.map(key => (
            <div key={key} className={styles.legendItem}>
              <div
                className={styles.legendLine}
                style={{
                  background: ASPECT_COLORS[key],
                  boxShadow: `0 0 8px ${ASPECT_COLORS[key]}aa`
                }}
              />
              <span style={{ color: ASPECT_COLORS[key] }}>{key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.statsGrid}>
        {ASPECT_KEYS.map(key => {
          const first = history[0]?.scores[key] ?? 5
          const last = history[history.length - 1]?.scores[key] ?? scores[key]
          const diff = last - first
          const trendColor = diff > 0 ? '#8fcf9b' : diff < 0 ? '#ef8888' : '#8f929c'

          return (
            <div
              key={key}
              className={styles.statCard}
              style={{ '--accent': ASPECT_COLORS[key] }}
            >
              <div className={styles.statTop}>
                <span className={styles.statCode} style={{ color: ASPECT_COLORS[key] }}>{key}</span>
                <span className={styles.statName}>{ASPECT_DATA[key].name}</span>
              </div>
              <div className={styles.statValueRow}>
                <span className={styles.statValue}>{last}</span>
                <span className={styles.statValueMax}>/10</span>
                <span className={styles.statDiff} style={{ color: trendColor }}>
                  {diff > 0 ? '↑' : diff < 0 ? '↓' : '—'}
                  {diff !== 0 && Math.abs(diff)}
                </span>
              </div>
              <div className={styles.statBar}>
                <div
                  className={styles.statBarFill}
                  style={{ width: `${last * 10}%`, background: ASPECT_COLORS[key] }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
