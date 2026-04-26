import { useState, useEffect } from 'react'
import Header from './components/Header/Header'
import WheelView from './components/WheelView/WheelView'
import AspectsView from './components/AspectsView/AspectsView'
import DiaryView from './components/DiaryView/DiaryView'
import ProgressView from './components/ProgressView/ProgressView'
import JourneyView, { DEFAULT_JOURNEY } from './components/JourneyView/JourneyView'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import AuthModal from './components/Auth/AuthModal'
import { ASPECT_KEYS } from './data/aspects'
import { ru } from './locales/ru'
import { useAuth } from './hooks/useAuth'
import {
  fetchState, saveState,
  fetchScores, saveScores as apiSaveScores,
  fetchDiary, postDiaryEntry,
} from './api/client'
import styles from './App.module.css'

const initScores = () => ASPECT_KEYS.reduce((acc, key) => ({ ...acc, [key]: 5 }), {})

export default function App() {
  const { user, loading: authLoading, onAuthSuccess, logout } = useAuth()

  const [view, setView] = useState('wheel')
  const [scores, setScores] = useState(initScores())
  const [history, setHistory] = useState([])
  const [diary, setDiary] = useState([])
  const [journey, setJourney] = useState(DEFAULT_JOURNEY)
  const [selectedAspect, setSelectedAspect] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)
  const t = ru

  // Load data from backend when user is authenticated
  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setDataLoading(true)
    try {
      const [stateRes, scoresRes, diaryRes] = await Promise.all([
        fetchState(),
        fetchScores(),
        fetchDiary(),
      ])

      if (stateRes.journey) setJourney(stateRes.journey)
      if (stateRes.history) setHistory(stateRes.history)
      if (Object.keys(scoresRes).length > 0) setScores(scoresRes)

      if (diaryRes.length > 0) {
        setDiary(diaryRes.map(e => ({
          id: e.id,
          date: new Date(e.created_at).toLocaleDateString('ru-RU'),
          ts: new Date(e.created_at).getTime(),
          aspect: e.aspect,
          text: e.text,
          source: e.source,
          ...(e.extra ?? {}),
        })))
      }
    } catch (e) {
      console.error('Error loading data:', e)
    } finally {
      setDataLoading(false)
    }
  }

  const saveScores = async (newScores) => {
    setScores(newScores)
    try { await apiSaveScores(newScores) } catch (e) { console.error(e) }
  }

  const saveHistory = async (newHistory) => {
    setHistory(newHistory)
    try { await saveState({ history: newHistory }) } catch (e) { console.error(e) }
  }

  const saveDiary = async (newDiary) => {
    const prev = diary
    setDiary(newDiary)
    // Send only entries that are new (not yet saved to backend)
    const newEntries = newDiary.filter(e => !prev.find(p => p.id === e.id))
    for (const entry of newEntries) {
      try {
        await postDiaryEntry({
          text: entry.text,
          aspect: entry.aspect,
          source: entry.source ?? 'web',
          extra: {
            scriptId: entry.scriptId ?? null,
            promptTitle: entry.promptTitle ?? null,
            prompt: entry.prompt ?? null,
            survey: entry.survey ?? null,
          },
        })
      } catch (e) { console.error(e) }
    }
  }

  const saveJourney = async (newJourney) => {
    setJourney(newJourney)
    try { await saveState({ journey: newJourney }) } catch (e) { console.error(e) }
  }

  const goToJourney = async (screen) => {
    if (screen) await saveJourney({ ...journey, screen })
    setView('journey')
  }

  const goToBSSurveys = async () => {
    await saveJourney({ ...journey, currentAspect: 'БС', screen: 'skill-tree', awaitingInput: null })
    setView('journey')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading) return <LoadingScreen text="Загрузка..." />
  if (!user) return <AuthModal onSuccess={onAuthSuccess} />
  if (dataLoading) return <LoadingScreen text={t.loading} />

  return (
    <div className={styles.app}>
      <Header
        view={view}
        onViewChange={(newView) => {
          setView(newView)
          setSelectedAspect(null)
        }}
        journeyPendingCount={journey?.pendingTasks?.length ?? 0}
        user={user}
        onLogout={logout}
        t={t}
      />

      <main className={view === 'journey' ? styles.mainJourney : styles.main}>
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
            onStartJourney={() => goToJourney(null)}
            onOpenTasks={() => goToJourney('tasks')}
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
            onDiaryChange={saveDiary}
            journey={journey}
            onGoToBSSurveys={goToBSSurveys}
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
