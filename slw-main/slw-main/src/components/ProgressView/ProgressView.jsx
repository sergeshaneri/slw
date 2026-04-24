import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { ASPECT_KEYS, ASPECT_COLORS } from '../../data/aspects'
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
        <div className={styles.title}>{t.progress.title}</div>
        <div className={styles.noData}>{t.progress.noData}</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>{t.progress.title}</div>
      
      <div className={styles.chartCard}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid stroke="#0d0d1a" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} />
            <YAxis domain={[0, 10]} tick={{ fill: '#555', fontSize: 10 }} />
            <Tooltip 
              contentStyle={{ 
                background: '#0A0A0F', 
                border: '1px solid #1a1a2e', 
                borderRadius: 0, 
                fontSize: 11 
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
                  boxShadow: `0 0 6px ${ASPECT_COLORS[key]}`
                }} 
              />
              <span style={{ color: ASPECT_COLORS[key] }}>{key}</span>
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className={styles.statsGrid}>
          {ASPECT_KEYS.map(key => {
            const first = history[0]?.scores[key] ?? 5
            const last = history[history.length - 1]?.scores[key] ?? scores[key]
            const diff = last - first
            
            return (
              <div 
                key={key} 
                className={styles.statCard}
                style={{ borderColor: `${ASPECT_COLORS[key]}22` }}
              >
                <div className={styles.statCode} style={{ color: ASPECT_COLORS[key] }}>
                  {key}
                </div>
                <div className={styles.statValue}>{last}</div>
                <div 
                  className={styles.statDiff}
                  style={{ 
                    color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#555' 
                  }}
                >
                  {diff > 0 ? '↑' : diff < 0 ? '↓' : '—'}
                  {diff !== 0 ? Math.abs(diff) : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
