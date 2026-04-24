import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import styles from './WheelView.module.css'

export default function WheelView({ scores, onScoresChange, onSaveHistory, history, onAspectClick, t }) {
  const [saveStatus, setSaveStatus] = useState('')

  const radarData = ASPECT_KEYS.map(key => ({
    subject: key,
    value: scores[key],
    fullMark: 10
  }))

  const handleScoreChange = (aspect, value) => {
    onScoresChange({ ...scores, [aspect]: value })
  }

  const handleSaveToHistory = async () => {
    const entry = {
      date: new Date().toLocaleDateString('ru-RU'),
      ts: Date.now(),
      scores: { ...scores }
    }
    const newHistory = [...history, entry].slice(-30)
    await onSaveHistory(newHistory)
    setSaveStatus(t.wheel.saved)
    setTimeout(() => setSaveStatus(''), 2000)
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* Radar Chart */}
        <div className={styles.radarCard}>
          <div className={styles.cardTitle}>{t.wheel.currentBalance}</div>
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#1a1a2e" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: '#9d4edd', fontSize: 13, fontWeight: 600 }} 
              />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <Radar 
                dataKey="value" 
                stroke="#9d4edd" 
                fill="#9d4edd" 
                fillOpacity={0.15} 
                strokeWidth={2} 
                dot={{ fill: '#9d4edd', r: 4 }} 
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className={styles.saveSection}>
            <button onClick={handleSaveToHistory} className={styles.saveButton}>
              {t.wheel.saveToHistory}
            </button>
            {saveStatus && <span className={styles.saveStatus}>{saveStatus}</span>}
          </div>
        </div>

        {/* Sliders */}
        <div className={styles.slidersCard}>
          <div className={styles.cardTitle}>{t.wheel.selfAssessment}</div>
          {ASPECT_KEYS.map(key => (
            <div key={key} className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.aspectLabel} style={{ color: ASPECT_COLORS[key] }}>
                  {key} <span className={styles.aspectName}>{ASPECT_DATA[key].name}</span>
                </span>
                <span className={styles.scoreValue} style={{ color: ASPECT_COLORS[key] }}>
                  {scores[key]}
                </span>
              </div>
              <div className={styles.sliderTrack}>
                <div 
                  className={styles.sliderFill} 
                  style={{ 
                    width: `${scores[key] * 10}%`,
                    background: `linear-gradient(90deg, #4a0080, ${ASPECT_COLORS[key]})`,
                    boxShadow: `0 0 8px ${ASPECT_COLORS[key]}66`
                  }} 
                />
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={scores[key]}
                  onChange={(e) => handleScoreChange(key, +e.target.value)}
                  className={styles.sliderInput}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aspect Grid */}
      <div className={styles.aspectGrid}>
        {ASPECT_KEYS.map(key => (
          <div
            key={key}
            onClick={() => onAspectClick(key)}
            className={styles.aspectCard}
            style={{ borderColor: `${ASPECT_COLORS[key]}44` }}
          >
            <div 
              className={styles.aspectCorner} 
              style={{ background: `${ASPECT_COLORS[key]}11` }} 
            />
            <div className={styles.aspectCode} style={{ color: ASPECT_COLORS[key] }}>
              {key}
            </div>
            <div className={styles.aspectTitle}>{ASPECT_DATA[key].name}</div>
            <div className={styles.aspectProgress}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ 
                    width: `${scores[key] * 10}%`,
                    background: ASPECT_COLORS[key],
                    boxShadow: `0 0 6px ${ASPECT_COLORS[key]}88`
                  }} 
                />
              </div>
              <span className={styles.progressValue} style={{ color: ASPECT_COLORS[key] }}>
                {scores[key]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
