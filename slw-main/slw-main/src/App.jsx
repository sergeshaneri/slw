import { useState, useEffect, useRef } from 'react'
import Header from './components/Header/Header'
import WheelView from './components/WheelView/WheelView'
import AspectsView from './components/AspectsView/AspectsView'
import DiaryView from './components/DiaryView/DiaryView'
import ProgressView from './components/ProgressView/ProgressView'
import JourneyView, { DEFAULT_JOURNEY } from './components/JourneyView/JourneyView'
import CoachView from './components/CoachView/CoachView'
import SettingsView from './components/SettingsView/SettingsView'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import AuthModal from './components/Auth/AuthModal'
import WelcomeScreen from './components/Welcome/WelcomeScreen'
import Footer from './components/Footer/Footer'
import { ASPECT_KEYS } from './data/aspects'
import { ru } from './locales/ru'
import { useAuth } from './hooks/useAuth'
import {
  fetchState, saveState,
  fetchScores, saveScores as apiSaveScores,
  fetchDiary, postDiaryEntry,
  fetchBotState,
  fetchEvents,
} from './api/client'
import styles from './App.module.css'

const initScores = () => ASPECT_KEYS.reduce((acc, key) => ({ ...acc, [key]: 5 }), {})

// localStorage ключи для гостевого режима (без auth).
// При логине данные с локалки могут переехать на бэк (миграцию пока не делаем).
const LS = {
  scores: 'whl_scores',
  history: 'whl_history',
  diary: 'whl_diary',
  journey: 'whl_journey'
}

const lsGet = (key, fallback) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

const lsSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) { console.error(e) }
}

export default function App() {
  const { user, loading: authLoading, onAuthSuccess, logout } = useAuth()

  const [view, setView] = useState('wheel')
  const [scores, setScores] = useState(initScores())
  const [history, setHistory] = useState([])
  const [diary, setDiary] = useState([])
  const [journey, setJourney] = useState(DEFAULT_JOURNEY)
  const [selectedAspect, setSelectedAspect] = useState(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  // welcomeDismissed: гость нажал «Начать бесплатно» и вошёл в приложение
  // без аутентификации. Запоминаем в localStorage, чтобы при следующем
  // визите сразу попадал на колесо. Сбрасывается на logout (см. ниже).
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem('welcome_seen') === '1'
  )
  // devAdmin: «пасхалочный» админский режим без бэка. Включается кликом по
  // невидимой точке (см. ProgressView → onToggleDevAdmin). Хранится в
  // localStorage, переживает logout и новые сессии. ИЛИ-сложение с user.is_admin.
  const [devAdmin, setDevAdmin] = useState(
    () => localStorage.getItem('slw_dev_admin') === '1'
  )
  const toggleDevAdmin = () => {
    setDevAdmin(prev => {
      const next = !prev
      if (next) localStorage.setItem('slw_dev_admin', '1')
      else localStorage.removeItem('slw_dev_admin')
      return next
    })
  }
  const isAdmin = (user?.is_admin === true) || devAdmin
  const t = ru

  // Скроллим `.main` наверх при смене view или selectedAspect.
  // Без этого позиция сохраняется и страница может оказаться на середине/внизу.
  // Чат (journey) сам управляет скроллом — его не трогаем.
  const mainRef = useRef(null)
  useEffect(() => {
    if (view === 'journey') return
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [view, selectedAspect])

  // Загрузка данных при изменении статуса auth.
  // Залогинен → API. Гость → localStorage.
  useEffect(() => {
    if (user === null) return  // ещё проверяем токен — ничего не делаем
    if (user) {
      loadFromApi()
    } else {
      loadFromLocal()
    }
  }, [user])

  const loadFromApi = async () => {
    setDataLoading(true)
    try {
      const [stateRes, scoresRes, diaryRes, botSync, eventsRes] = await Promise.all([
        fetchState(),
        fetchScores(),
        fetchDiary(),
        fetchBotState().catch(() => null),
        fetchEvents(0).catch(() => ({ events: [] })),
      ])

      // Bot position: apply aspect/level/streak from bot if Telegram is linked
      // and web journey is still at default (hasn't been started in web yet)
      let journeyOverride = stateRes.journey ?? null
      if (botSync?.linked && botSync.state) {
        const bs = botSync.state
        const isWebFresh = !journeyOverride || journeyOverride.screen === 'onboarding'
        if (isWebFresh && bs.current_aspect) {
          journeyOverride = {
            ...(journeyOverride ?? {}),
            currentAspect: bs.current_aspect,
            currentLevel: bs.current_level ?? 0,
            // Sync streak from bot if higher
            streak: Math.max(journeyOverride?.streak ?? 0, bs.streak_days ?? 0),
          }
        } else if (bs.streak_days) {
          // Always sync streak
          journeyOverride = {
            ...(journeyOverride ?? {}),
            streak: Math.max(journeyOverride?.streak ?? 0, bs.streak_days),
          }
        }
      }

      // Bot → Web events: дописываем в journey.completedScripts шаги, которые
      // юзер прошёл в TG-боте, scoped под текущий (currentAspect, currentLevel).
      // Web хранит short_id (`T-1`/`intro-1`) — бэк уже отдаёт распарсенные.
      const botEvents = (eventsRes?.events ?? []).filter(
        e => e.source === 'bot' && e.type === 'step_completed' && e.short_id
      )
      if (botEvents.length > 0) {
        const aspect = journeyOverride?.currentAspect
        const level = journeyOverride?.currentLevel ?? 0
        if (aspect) {
          const fromBot = botEvents
            .filter(e => e.aspect === aspect && (e.level ?? 0) === level)
            .map(e => e.short_id)
          if (fromBot.length > 0) {
            const merged = new Set(journeyOverride?.completedScripts ?? [])
            fromBot.forEach(id => merged.add(id))
            journeyOverride = {
              ...(journeyOverride ?? {}),
              completedScripts: Array.from(merged),
            }
          }
        }
      }

      if (journeyOverride) setJourney(j => ({ ...j, ...journeyOverride }))
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

  const loadFromLocal = () => {
    setScores(lsGet(LS.scores, initScores()))
    setHistory(lsGet(LS.history, []))
    setDiary(lsGet(LS.diary, []))
    setJourney(lsGet(LS.journey, DEFAULT_JOURNEY))
  }

  const saveScores = async (newScores) => {
    setScores(newScores)
    if (user) {
      try { await apiSaveScores(newScores) } catch (e) { console.error(e) }
    } else {
      lsSet(LS.scores, newScores)
    }
  }

  const saveHistory = async (newHistory) => {
    setHistory(newHistory)
    if (user) {
      try { await saveState({ history: newHistory }) } catch (e) { console.error(e) }
    } else {
      lsSet(LS.history, newHistory)
    }
  }

  const saveDiary = async (newDiary) => {
    const prev = diary
    setDiary(newDiary)
    if (user) {
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
    } else {
      lsSet(LS.diary, newDiary)
    }
  }

  const saveJourney = async (newJourney) => {
    setJourney(newJourney)
    if (user) {
      try { await saveState({ journey: newJourney }) } catch (e) { console.error(e) }
    } else {
      lsSet(LS.journey, newJourney)
    }
  }

  const goToJourney = async (screen) => {
    // Путешествие требует авторизации — гостям показываем AuthModal.
    // Исключение: dev-admin (пасхалка) пускает без логина.
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    if (screen) await saveJourney({ ...journey, screen })
    setView('journey')
  }

  const goToBSSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 должен быть пройден (currentLevel >= 1). Админу можно всегда.
    if (!isAdmin && (journey?.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({ ...journey, currentAspect: 'БС', screen: 'skill-tree', awaitingInput: null })
    setView('journey')
  }

  const handleAuthSuccess = (userData) => {
    onAuthSuccess(userData)
    setShowAuth(false)
    // После любого успешного логина — Welcome больше не показываем,
    // даже если юзер потом разлогинится (у него уже есть прогресс).
    localStorage.setItem('welcome_seen', '1')
    setWelcomeDismissed(true)
  }

  const handleViewChange = (newView) => {
    if (newView === 'journey' && !user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // Коуч требует авторизации — бэк всё равно отобьёт без JWT,
    // но проверяем здесь чтобы не показывать пустой экран с ошибкой.
    if (newView === 'coach' && !user) {
      setShowAuth(true)
      return
    }
    setView(newView)
    setSelectedAspect(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Пока useAuth проверяет токен — короткий лоадер, чтобы не моргало.
  if (authLoading) return <LoadingScreen text="Загрузка..." />
  // Гость, который ещё не нажал «Начать бесплатно» — экран приветствия.
  // После клика на «Начать бесплатно» — выпадает в общее приложение
  // (данные пишутся в localStorage, путешествие гейтится).
  if (!user && !welcomeDismissed) {
    return (
      <WelcomeScreen
        onAuthSuccess={onAuthSuccess}
        onContinueAsGuest={() => {
          localStorage.setItem('welcome_seen', '1')
          setWelcomeDismissed(true)
        }}
      />
    )
  }
  // Залогиненный юзер ждёт данные с бэка — лоадер.
  if (user && dataLoading) return <LoadingScreen text={t.loading} />

  return (
    <div className={styles.app}>
      <Header
        view={view}
        onViewChange={handleViewChange}
        journeyPendingCount={journey?.pendingTasks?.length ?? 0}
        user={user}
        onLogin={() => setShowAuth(true)}
        onLogout={logout}
        t={t}
      />

      {showAuth && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => setShowAuth(false)}
          user={user || null}
        />
      )}

      <main
        ref={mainRef}
        className={view === 'journey' ? styles.mainJourney : styles.main}
      >
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
            isAdmin={isAdmin}
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

        {view === 'coach' && (
          <CoachView
            diary={diary}
            onDiaryChange={saveDiary}
            journey={journey}
            onJourneyChange={saveJourney}
          />
        )}

        {view === 'progress' && (
          <ProgressView
            history={history}
            scores={scores}
            t={t}
            onToggleDevAdmin={toggleDevAdmin}
            devAdmin={devAdmin}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            user={user}
            onUserUpdate={onAuthSuccess}
            onAccountDeleted={() => {
              logout()
              setView('wheel')
            }}
            onLogout={logout}
          />
        )}

        {view !== 'journey' && <Footer />}
      </main>
    </div>
  )
}
