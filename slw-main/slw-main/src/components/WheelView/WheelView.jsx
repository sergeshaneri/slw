import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA, ASPECT_REALMS, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import styles from './WheelView.module.css'

export default function WheelView({ scores, onSaveHistory, history, journey, onAspectClick, onStartJourney, onOpenTasks, t }) {
  const [saveStatus, setSaveStatus] = useState('')

  const radarData = ASPECT_KEYS.map(key => ({
    subject: ASPECT_DISPLAY_KEY[key],
    value: scores[key],
    fullMark: 10
  }))

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

  const journeyStarted = journey?.totalCompleted > 0 || journey?.screen === 'chat' || journey?.screen === 'levelcomplete' || journey?.screen === 'profile'
  const journeyXp = journey?.xp ?? 0
  const pendingCount = journey?.aspects?.[journey?.currentAspect]?.pendingTasks?.length ?? 0

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* Radar Chart */}
        <section className={styles.radarCard}>
          <header className={styles.cardHead}>
            <span className={styles.cardEyebrow}>Колесо</span>
            <h2 className={styles.cardTitle}>{t.wheel.currentBalance}</h2>
          </header>
          <div className={styles.radarWrap}>
            <ResponsiveContainer width="100%" height={360}>
              <RadarChart data={radarData} margin={{ top: 14, right: 32, bottom: 14, left: 32 }}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#c8cad1', fontSize: 14, fontWeight: 600 }}
                />
                <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="#9d4edd"
                  fill="#9d4edd"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ fill: '#c77dff', r: 4 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.saveSection}>
            <button type="button" onClick={handleSaveToHistory} className={styles.saveButton}>
              {t.wheel.saveToHistory}
            </button>
            {saveStatus && <span className={styles.saveStatus}>{saveStatus}</span>}
          </div>
        </section>

        {/* Journey CTA */}
        <section className={styles.journeyCard}>
          <header className={styles.cardHead}>
            <span className={styles.cardEyebrow}>Путешествие</span>
            <h2 className={styles.cardTitle}>{t.wheel.journeyTitle}</h2>
          </header>
          <p className={styles.journeyText}>{t.wheel.journeySub}</p>

          {journeyStarted && (
            <div className={styles.journeyStats}>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{journeyXp}</span>
                <span className={styles.statLbl}>XP</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{journey?.totalCompleted ?? 0}</span>
                <span className={styles.statLbl}>заданий</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statVal}>{journey?.streak ?? 0}</span>
                <span className={styles.statLbl}>дней подряд</span>
              </div>
            </div>
          )}

          <div className={styles.journeyButtons}>
            <button type="button" onClick={onStartJourney} className={styles.journeyCta}>
              {journeyStarted ? t.wheel.journeyContinue : t.wheel.journeyCta}
            </button>
            {pendingCount > 0 && (
              <button type="button" onClick={onOpenTasks} className={styles.journeyTasksCta}>
                <span className={styles.journeyTasksDot} aria-hidden="true">●</span>
                Активные задания · {pendingCount}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Aspect Grid с дескрипторами */}
      <section className={styles.aspectsSection}>
        <header className={styles.aspectsHead}>
          <h2 className={styles.aspectsTitle}>Сферы жизни</h2>
          <p className={styles.aspectsHint}>{t.wheel.sphereHint}</p>
        </header>
        <div className={styles.aspectGrid}>
          {ASPECT_KEYS.map(key => {
            const color = ASPECT_COLORS[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => onAspectClick(key)}
                className={styles.aspectCard}
                style={{ '--accent': color }}
              >
                <div
                  className={styles.aspectGlow}
                  style={{ background: `radial-gradient(circle at 30% 20%, ${color}28, transparent 60%)` }}
                />
                <div className={styles.aspectTop}>
                  <span className={styles.aspectCode} style={{ color, textShadow: `0 0 24px ${color}66` }}>{ASPECT_DISPLAY_KEY[key]}</span>
                  <span className={styles.aspectScore}>{scores[key]}<span>/10</span></span>
                </div>
                <div className={styles.aspectName}>{ASPECT_DATA[key].name}</div>
                <div className={styles.aspectRealm}>{ASPECT_REALMS[key]}</div>
                <div className={styles.aspectBar}>
                  <div
                    className={styles.aspectBarFill}
                    style={{ width: `${scores[key] * 10}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: `0 0 10px ${color}88` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
