import { useState, useEffect } from 'react'
import Header from './components/Header/Header'
import WheelView from './components/WheelView/WheelView'
import AspectsView from './components/AspectsView/AspectsView'
import DiaryView from './components/DiaryView/DiaryView'
import ProgressView from './components/ProgressView/ProgressView'
import JourneyView, { DEFAULT_JOURNEY } from './components/JourneyView/JourneyView'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import { ASPECT_KEYS } from './data/aspects'
import { ru } from './locales/ru'
import styles from './App.module.css'

const initScores = () => ASPECT_KEYS.reduce((acc, key) => ({ ...acc, [key]: 5 }), {})

export default function App() {
  const [view, setView] = useState('wheel')
  const [scores, setScores] = useState(initScores())
  const [history, setHistory] = useState([])
  const [diary, setDiary] = useState([])
  const [journey, setJourney] = useState(DEFAULT_JOURNEY)
  const [selectedAspect, setSelectedAspect] = useState(null)
  const [loading, setLoading] = useState(true)
  const t = ru

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const savedScores = await window.storage?.get('whl_scores')
      if (savedScores) setScores(JSON.parse(savedScores.value))

      const savedHistory = await window.storage?.get('whl_history')
      if (savedHistory) setHistory(JSON.parse(savedHistory.value))

      const savedDiary = await window.storage?.get('whl_diary')
      if (savedDiary) setDiary(JSON.parse(savedDiary.value))

      const savedJourney = await window.storage?.get('whl_journey')
      if (savedJourney) setJourney(JSON.parse(savedJourney.value))
    } catch (e) {
      console.error('Error loading data:', e)
    } finally {
      setLoading(false)
    }
  }

  const saveScores = async (newScores) => {
    setScores(newScores)
    try { await window.storage?.set('whl_scores', JSON.stringify(newScores)) } catch (e) { console.error(e) }
  }

  const saveHistory = async (newHistory) => {
    setHistory(newHistory)
    try { await window.storage?.set('whl_history', JSON.stringify(newHistory)) } catch (e) { console.error(e) }
  }

  const saveDiary = async (newDiary) => {
    setDiary(newDiary)
    try { await window.storage?.set('whl_diary', JSON.stringify(newDiary)) } catch (e) { console.error(e) }
  }

  const saveJourney = async (newJourney) => {
    setJourney(newJourney)
    try { await window.storage?.set('whl_journey', JSON.stringify(newJourney)) } catch (e) { console.error(e) }
  }

  if (loading) {
    return <LoadingScreen text={t.loading} />
  }

  return (
    <div className={styles.app}>
      <Header
        view={view}
        onViewChange={(newView) => {
          setView(newView)
          setSelectedAspect(null)
        }}
        journeyPendingCount={journey?.pendingTasks?.length ?? 0}
        t={t}
      />

      <main className={styles.main}>
        {view === 'wheel' && (
          <WheelView
            scores={scores}
            onSaveHistory={saveHistory}
            history={history}
            journey={journey}
            onAspectClick={(aspect) => {
              setSelectedAspect(aspect)
              setView('aspects')
            }}
            onStartJourney={() => setView('journey')}
            t={t}
          />
        )}

        {view === 'journey' && (
          <JourneyView
            journey={journey}
            onJourneyChange={saveJourney}
            scores={scores}
            onScoresChange={saveScores}
            diary={diary}
            onDiaryChange={saveDiary}
            t={t}
          />
        )}

        {view === 'aspects' && (
          <AspectsView
            selectedAspect={selectedAspect}
            onAspectSelect={setSelectedAspect}
            scores={scores}
            onScoreChange={saveScores}
            diary={diary}
            t={t}
          />
        )}

        {view === 'diary' && (
          <DiaryView
            diary={diary}
            onDiaryChange={saveDiary}
            t={t}
          />
        )}

        {view === 'progress' && (
          <ProgressView
            history={history}
            scores={scores}
            t={t}
          />
        )}
      </main>
    </div>
  )
}
