import { useState, useEffect, useRef } from 'react'
import Header from './components/Header/Header'
import AspectsView from './components/AspectsView/AspectsView'
import DiaryView from './components/DiaryView/DiaryView'
import JourneyView, { DEFAULT_JOURNEY } from './components/JourneyView/JourneyView'
import CoachView from './components/CoachView/CoachView'
import ProfileView from './components/ProfileView/ProfileView'
import PublicProfileView from './components/PublicProfileView/PublicProfileView'
import LeaderboardView from './components/LeaderboardView/LeaderboardView'
import HallView from './components/HallView/HallView'
import DMView from './components/DMView/DMView'
import SearchView from './components/SearchView/SearchView'
import DashboardView from './components/DashboardView/DashboardView'
import SettingsView from './components/SettingsView/SettingsView'
import AdminView from './components/AdminView/AdminView'
import AchievementToast from './components/Toast/AchievementToast'
import IntroTour from './components/Onboarding/IntroTour'
import { fetchMyProfile, markOnboardingDone } from './api/client'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import AuthModal from './components/Auth/AuthModal'
import WelcomeScreen from './components/Welcome/WelcomeScreen'
import Footer from './components/Footer/Footer'
import { isTMA } from './tma'
import { ASPECT_KEYS } from './data/aspects'
import { getJourney } from './data/journey/registry'
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

  // Дефолт: залогиненным — дашборд, гостям — колесо.
  // Конкретный view выставится в useEffect после того как `user` определится.
  // Дефолтный view. Для гостя — 'aspects' (read-only с teaser-механикой).
  // Залогиненный сразу перекидывается на 'dashboard' (см. useEffect ниже).
  const [view, setView] = useState('aspects')
  const [scores, setScores] = useState(initScores())
  const [history, setHistory] = useState([])
  const [diary, setDiary] = useState([])
  const [journey, setJourney] = useState(DEFAULT_JOURNEY)
  const [selectedAspect, setSelectedAspect] = useState(null)
  // Чей публичный профиль смотрим (id WebUser). null — не открыт.
  const [viewingProfileId, setViewingProfileId] = useState(null)
  // В каком холле сейчас юзер (ключ аспекта). null — не в холле.
  const [hallAspect, setHallAspect] = useState(null)
  // С каким юзером открыт DM-тред. null — список тредов.
  const [dmPartnerId, setDmPartnerId] = useState(null)
  // Очередь тостов (новые ачивки и т.п.). Каждый { id, icon, title, desc, kind, stardust }.
  const [toasts, setToasts] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  // welcomeDismissed: гость нажал «Начать бесплатно» и вошёл в приложение
  // без аутентификации. Запоминаем в localStorage, чтобы при следующем
  // визите сразу попадал на колесо. Сбрасывается на logout (см. ниже).
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem('welcome_seen') === '1'
  )
  // devAdmin: «пасхалочный» админский режим без бэка. Включается 5 кликами
  // по букве «й» в конце фразы «… дней» в Heatmap-заголовке (DashboardView).
  // Хранится в localStorage, переживает logout. ИЛИ-сложение с user.is_admin.
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
  // IntroTour (Layer 1) — Quick Tour. Видим если:
  //   • залогиненный юзер ещё не прошёл (user.onboarding_done === false)
  //   • гость в режиме welcomeDismissed и без localStorage['slw_intro_seen']='1'
  // Re-open из Profile через кнопку «📖 Гид».
  const [showIntroTour, setShowIntroTour] = useState(false)

  // Аватар юзера из public_profiles. Источник правды — бэк
  // (/api/profile/me). Фетчим при логине, обновляем после save в ProfileView.
  const [myAvatar, setMyAvatar] = useState('')
  useEffect(() => {
    if (!user) { setMyAvatar(''); return }
    let cancelled = false
    fetchMyProfile()
      .then(p => { if (!cancelled) setMyAvatar(p.avatar ?? '') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])

  // Скроллим `.main` наверх при смене view или selectedAspect.
  // Без этого позиция сохраняется и страница может оказаться на середине/внизу.
  // Чат (journey) сам управляет скроллом — его не трогаем.
  const mainRef = useRef(null)
  useEffect(() => {
    if (view === 'journey') return
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [view, selectedAspect])

  // Optimistic locking. Хранит updated_at последнего успешно загруженного/
  // сохранённого state. При PUT отправляем как expected_updated_at — если
  // кто-то ещё изменил (admin restore, другая вкладка, impersonation) —
  // бэк ответит 409 и мы перечитаем свежее значение.
  // ОБЪЯВЛЕНО ДО loadFromApi, чтобы избежать TDZ при использовании в closure.
  const stateVersionRef = useRef(null)

  // Загрузка данных при изменении статуса auth.
  // Залогинен → API. Гость → localStorage.
  useEffect(() => {
    if (user === null) return  // ещё проверяем токен — ничего не делаем
    if (user) {
      loadFromApi()
      // При первом логине переключаем на дашборд (если ещё на стартовом 'aspects').
      setView(v => v === 'aspects' ? 'dashboard' : v)
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

      // Запоминаем версию state с сервера для optimistic locking.
      // При следующем PUT отправим её как expected_updated_at — если кто-то
      // успел изменить state между нашим GET и PUT, бэк ответит 409 и мы
      // перечитаем свежую версию вместо перетирания чужих изменений.
      stateVersionRef.current = stateRes?.updated_at ?? null

      // Bot → Web sync. Multi-aspect модель:
      //   • bs.aspects[] — массив прогресса по каждому аспекту, в котором
      //     юзер был в боте. Для каждого делаем Math.max-бамп
      //     journey.aspects[X].currentLevel и подкладываем первый шаг
      //     нового уровня в messages, если фактически прыгнули вперёд.
      //   • currentAspect — переносим из бота только если веб ещё на
      //     онбординге (иначе пользователь, переключившийся в вебе на
      //     другой аспект, после релоада возвращался бы в бот-аспект).
      //   • streak — всегда max (глобальный счётчик).
      //
      // bs.aspects может отсутствовать на старом бэке — fallback на
      // одиночные top-level поля (current_aspect/current_level).
      let journeyOverride = stateRes.journey ?? null

      const readAspectFolder = (jo, aspect) => {
        if (!jo) return null
        if (jo.aspects && jo.aspects[aspect]) return jo.aspects[aspect]
        // Старый плоский state с бэка — читаем поля как есть.
        return {
          currentLevel: jo.currentLevel,
          currentScriptIndex: jo.currentScriptIndex,
          currentScriptId: jo.currentScriptId,
          awaitingInput: jo.awaitingInput,
          messages: jo.messages,
          completedScripts: jo.completedScripts,
          pendingTasks: jo.pendingTasks,
        }
      }

      const writeAspectFolder = (jo, aspect, patch) => {
        const base = jo ?? {}
        const prevFolder = readAspectFolder(base, aspect) ?? {}
        return {
          ...base,
          aspects: {
            ...(base.aspects ?? {}),
            [aspect]: { ...prevFolder, ...patch },
          },
        }
      }

      const bumpAspectFromBot = (jo, aspect, botLevel) => {
        const folder = readAspectFolder(jo, aspect) ?? {}
        const webLevel = folder.currentLevel ?? 0
        if (botLevel <= webLevel) return jo
        const nextLevelData = getJourney(aspect)?.levels?.[botLevel]
        const firstScript = (nextLevelData?.core ?? nextLevelData?.scripts ?? [])[0]
        return writeAspectFolder(jo, aspect, {
          currentLevel: botLevel,
          currentScriptIndex: 0,
          currentScriptId: firstScript?.id ?? null,
          awaitingInput: null,
          messages: firstScript
            ? [
                ...(folder.messages ?? []),
                {
                  id: Date.now() + Math.random(),
                  role: 'bot',
                  kind: 'script',
                  scriptId: firstScript.id,
                  level: botLevel,
                },
              ]
            : (folder.messages ?? []),
        })
      }

      if (botSync?.linked && botSync.state) {
        const bs = botSync.state
        const isWebFresh = !journeyOverride || journeyOverride.screen === 'onboarding'

        if (isWebFresh && bs.current_aspect) {
          journeyOverride = {
            ...(journeyOverride ?? {}),
            currentAspect: bs.current_aspect,
          }
        }

        if (Array.isArray(bs.aspects) && bs.aspects.length > 0) {
          // Новый формат: бэк отдаёт массив. Бампаем каждый аспект.
          for (const row of bs.aspects) {
            if (!row?.aspect) continue
            const botLevel = row.current_level ?? 0
            journeyOverride = bumpAspectFromBot(journeyOverride, row.aspect, botLevel)
          }
        } else if (bs.current_aspect) {
          // Legacy: одиночные поля. Бампаем только текущий аспект.
          journeyOverride = bumpAspectFromBot(
            journeyOverride, bs.current_aspect, bs.current_level ?? 0
          )
        }

        if (bs.streak_days) {
          journeyOverride = {
            ...(journeyOverride ?? {}),
            streak: Math.max(journeyOverride?.streak ?? 0, bs.streak_days),
          }
        }
      }

      // Bot/Web → completedScripts: дописываем в каждую папку
      // journey.aspects[X].completedScripts все step_completed события для
      // этого юзера (и от бота, и от веба — журнал append-only, и тот и
      // другой источник истины). Фильтруем по аспекту, но НЕ по level —
      // иначе после скачка на L1 ачивки L0 пропадают.
      //
      // Зачем мёрджить ВЕБ-события обратно в свой state? Это страховка
      // от сбросов: при CONTENT_VERSION-бампе локальный state может
      // обнулиться, а журнал в БД останется — и при следующей загрузке
      // мы пересоберём полный список завершённых скриптов.
      const botEvents = (eventsRes?.events ?? []).filter(
        e => e.type === 'step_completed' && e.short_id && e.aspect
      )
      if (botEvents.length > 0) {
        // Группируем по аспекту → раскладываем по папкам.
        const byAspect = botEvents.reduce((acc, e) => {
          (acc[e.aspect] ??= []).push(e.short_id)
          return acc
        }, {})
        for (const [aspect, ids] of Object.entries(byAspect)) {
          const folder = readAspectFolder(journeyOverride, aspect) ?? {}
          const merged = new Set(folder.completedScripts ?? [])
          ids.forEach(id => merged.add(id))
          journeyOverride = writeAspectFolder(journeyOverride, aspect, {
            completedScripts: Array.from(merged),
          })
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

  // Гvardованный save с дебаунсом. Решает две проблемы:
  // 1. Race condition: за 1 шаг в чате state меняется 3-5 раз — без дебаунса
  //    каждое изменение шлёт PUT, ref не успевает обновиться, второй PUT
  //    получает 409, фронт срабатывает на loadFromApi, локальный progress
  //    откатывается. Юзер видит «загрузку» и застрявший ползунок.
  // 2. Network spam: 5 PUT-ов в секунду — лишняя нагрузка.
  //
  // Реальный 409 (от admin-операции / другой вкладки) сейчас просто
  // обновляет ref из тела ответа и продолжает. Если бы был настоящий
  // конфликт — следующий save отправит свежий ref. Полный reload через
  // loadFromApi оказался слишком агрессивным — он триггерил «загрузку».
  const saveDebounceRef = useRef(null)
  const lastSavePromiseRef = useRef(Promise.resolve())

  const saveStateGuarded = (patch) => {
    // Сохраняем последний патч, чтобы при дебаунсе слать актуальный.
    saveDebounceRef.current = { ...(saveDebounceRef.current ?? {}), ...patch }

    // Если предыдущий save ещё в полёте — отложимся за ним.
    lastSavePromiseRef.current = lastSavePromiseRef.current.then(async () => {
      const merged = saveDebounceRef.current
      saveDebounceRef.current = null
      if (!merged) return null
      try {
        const res = await saveState({
          ...merged,
          expected_updated_at: stateVersionRef.current,
        })
        if (res?.updated_at) stateVersionRef.current = res.updated_at
        return res
      } catch (e) {
        if (e.status === 409) {
          // Обновляем ref свежим значением из тела 409 — следующий save
          // пойдёт с ним. Loading-индикатор не показываем, тост не сыпем.
          // Если на самом деле что-то поменялось снаружи (admin) — следующая
          // ручная перезагрузка страницы подтянет свежий state.
          const detail = (e && e.detail) || null
          const fresh = detail && typeof detail === 'object'
            ? detail.current_updated_at
            : null
          if (fresh) stateVersionRef.current = fresh
          console.warn('state PUT 409, ref refreshed to', fresh)
          return null
        }
        console.error('saveState failed', e)
        return null
      }
    })

    return lastSavePromiseRef.current
  }

  const saveHistory = async (newHistory) => {
    setHistory(newHistory)
    if (user) {
      try { await saveStateGuarded({ history: newHistory }) } catch (e) { console.error(e) }
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
      try { await saveStateGuarded({ journey: newJourney }) } catch (e) { console.error(e) }
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

  const goToSiSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 должен быть пройден (currentLevel >= 1). Админу можно всегда.
    // currentLevel и awaitingInput теперь живут в journey.aspects[aspect].
    const siFolder = journey?.aspects?.['Si'] ?? {}
    if (!isAdmin && (siFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Si',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Si': { ...siFolder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToFeSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 ЧЭ должен быть пройден (currentLevel >= 1). Админу можно всегда.
    const feFolder = journey?.aspects?.['Fe'] ?? {}
    if (!isAdmin && (feFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Fe',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Fe': { ...feFolder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToNeSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 ЧИ должен быть пройден (currentLevel >= 1). Админу можно всегда.
    const neFolder = journey?.aspects?.['Ne'] ?? {}
    if (!isAdmin && (neFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Ne',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Ne': { ...neFolder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToNiSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 БИ должен быть пройден (currentLevel >= 1). Админу можно всегда.
    const niFolder = journey?.aspects?.['Ni'] ?? {}
    if (!isAdmin && (niFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Ni',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Ni': { ...niFolder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToFiSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 БЭ должен быть пройден (currentLevel >= 1). Админу можно всегда.
    const fiFolder = journey?.aspects?.['Fi'] ?? {}
    if (!isAdmin && (fiFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Fi',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Fi': { ...fiFolder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToTeSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 ЧЛ должен быть пройден (currentLevel >= 1). Админу можно всегда.
    const teFolder = journey?.aspects?.['Te'] ?? {}
    if (!isAdmin && (teFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Te',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Te': { ...teFolder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToTiSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 БЛ должен быть пройден (currentLevel >= 1). Админу можно всегда.
    const tiFolder = journey?.aspects?.['Ti'] ?? {}
    if (!isAdmin && (tiFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Ti',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Ti': { ...tiFolder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToSeSurveys = async () => {
    if (!user && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 ЧС должен быть пройден (currentLevel >= 1). Админу можно всегда.
    const seFolder = journey?.aspects?.['Se'] ?? {}
    if (!isAdmin && (seFolder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: 'Se',
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        'Se': { ...seFolder, awaitingInput: null },
      },
    })
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
    // Коуч и Профиль требуют авторизации — бэк всё равно отобьёт без JWT,
    // но проверяем здесь чтобы не показывать пустой экран с ошибкой.
    if ((newView === 'coach' || newView === 'profile' || newView === 'search') && !user) {
      setShowAuth(true)
      return
    }
    setView(newView)
    setSelectedAspect(null)
    setViewingProfileId(null)
    setHallAspect(null)
    if (newView !== 'dm') setDmPartnerId(null)
  }

  const openPublicProfile = (userId) => {
    setViewingProfileId(userId)
    setView('public-profile')
  }

  const enterHall = (aspect) => {
    if (!user) {
      setShowAuth(true)
      return
    }
    setHallAspect(aspect)
    setView('hall')
  }

  const openDM = (partnerId = null) => {
    if (!user) { setShowAuth(true); return }
    setDmPartnerId(partnerId)
    setView('dm')
  }

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // При логине проверяем разблокированные ачивки. /api/profile/me грантит
  // и возвращает newly_unlocked — ставим тосты и +1 стардаст за каждую.
  // Хук срабатывает только когда user стал не-null (loadFromApi уже отработал).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchMyProfile()
      .then(p => {
        if (cancelled) return
        const newCodes = p.newly_unlocked ?? []
        if (newCodes.length === 0) return
        const catalog = new Map((p.achievements_catalog ?? []).map(a => [a.code, a]))
        const newToasts = newCodes.map(code => {
          const meta = catalog.get(code) || { title: code, icon: '✨', desc: '' }
          return {
            id: `ach-${code}-${Date.now()}`,
            kind: 'achievement',
            icon: meta.icon,
            title: meta.title,
            desc: meta.desc,
            stardust: 1,
          }
        })
        setToasts(prev => [...prev, ...newToasts])
        // +1 стардаст за каждую новую ачивку. Списываем во фронтовый journey
        // и пушим назад в state. Trust-based, как и всё со стардастом сейчас.
        const grant = newCodes.length
        if (grant > 0) {
          setJourney(j => {
            const updated = { ...j, stardust: (j?.stardust ?? 0) + grant }
            saveStateGuarded({ journey: updated }).catch(() => {})
            return updated
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // IntroTour: показать при первом контакте.
  // Залогиненным — read user.onboarding_done с бэка (грузится в useAuth).
  // Гостям — localStorage флаг 'slw_intro_seen' (после welcomeDismissed).
  // user === null означает «ещё проверяем токен» — ничего не делаем.
  useEffect(() => {
    if (user === null) return
    if (user && user.onboarding_done === false) {
      setShowIntroTour(true)
    } else if (user === false && welcomeDismissed && localStorage.getItem('slw_intro_seen') !== '1') {
      setShowIntroTour(true)
    }
  }, [user, welcomeDismissed])

  const handleTourClose = async () => {
    setShowIntroTour(false)
    if (user) {
      try { await markOnboardingDone() } catch (e) { console.error(e) }
      // Локально ставим флаг в user, чтобы повторный логин не открывал тур
      // снова из useEffect выше (useAuth кэширует user).
      onAuthSuccess({ ...user, onboarding_done: true })
    } else {
      localStorage.setItem('slw_intro_seen', '1')
    }
  }

  const handleTourComplete = async () => {
    await handleTourClose()
    // Финальный CTA — переключаемся на journey (Карта Планет открывается
    // по умолчанию для тех, кто ещё не входил в чат).
    if (user || devAdmin) setView('journey')
    else setView('aspects')
  }

  // ?u=<id> в URL → открываем публичный профиль (deeplink с шеринга).
  // Один раз при маунте: если параметр есть, переключаемся на view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const u = params.get('u')
    if (u && /^\d+$/.test(u)) {
      setViewingProfileId(parseInt(u, 10))
      setView('public-profile')
      // Убираем из URL чтобы reload не зацикливал.
      const url = new URL(window.location.href)
      url.searchParams.delete('u')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────

  // Пока useAuth проверяет токен — короткий лоадер, чтобы не моргало.
  if (authLoading) return <LoadingScreen text="Загрузка..." />
  // Внутри Telegram Mini App: bootstrapTMA уже положил токен, useAuth его
  // подобрал. WelcomeScreen не показываем — юзер всегда авторизован через TG.
  // Гость (вне TG), который ещё не нажал «Начать бесплатно» — экран приветствия.
  // После клика на «Начать бесплатно» — выпадает в общее приложение
  // (данные пишутся в localStorage, путешествие гейтится).
  if (!user && !welcomeDismissed && !isTMA) {
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
      <AchievementToast items={toasts} onDismiss={dismissToast} />
      {showIntroTour && (
        <IntroTour
          isGuest={!user}
          onClose={handleTourClose}
          onGoToPlanets={handleTourComplete}
        />
      )}
      <Header
        view={view}
        onViewChange={handleViewChange}
        journeyPendingCount={journey?.aspects?.[journey?.currentAspect]?.pendingTasks?.length ?? 0}
        user={user}
        userAvatar={myAvatar}
        onLogin={() => setShowAuth(true)}
        onLogout={logout}
        onOpenMyProfile={() => handleViewChange('profile')}
        onOpenProfile={openPublicProfile}
        onOpenDM={openDM}
        onOpenHall={enterHall}
        onOpenAdmin={() => setView('admin')}
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
        {view === 'dashboard' && user && (
          <DashboardView
            currentUserId={user.id}
            user={user}
            journey={journey}
            onOpenAspect={(aspect) => {
              setSelectedAspect(aspect)
              setView('aspects')
            }}
            onOpenAspects={() => handleViewChange('aspects')}
            onOpenJourney={() => handleViewChange('journey')}
            onOpenCoach={() => handleViewChange('coach')}
            onOpenDiary={() => handleViewChange('diary')}
            onOpenHall={enterHall}
            onOpenProfile={openPublicProfile}
            onOpenMyProfile={() => handleViewChange('profile')}
            onOpenDM={openDM}
            onOpenDMList={() => openDM(null)}
            onOpenLeaderboard={() => handleViewChange('leaderboard')}
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
            user={user}
          />
        )}

        {view === 'aspects' && (
          <AspectsView
            selectedAspect={selectedAspect}
            onAspectSelect={setSelectedAspect}
            scores={scores}
            diary={diary}
            onDiaryChange={saveDiary}
            journey={journey}
            onGoToSiSurveys={goToSiSurveys}
            onGoToFeSurveys={goToFeSurveys}
            onGoToNeSurveys={goToNeSurveys}
            onGoToNiSurveys={goToNiSurveys}
            onGoToFiSurveys={goToFiSurveys}
            onGoToTeSurveys={goToTeSurveys}
            onGoToTiSurveys={goToTiSurveys}
            onGoToSeSurveys={goToSeSurveys}
            onEnterHall={enterHall}
            isAdmin={isAdmin}
            t={t}
            user={user}
          />
        )}

        {view === 'diary' && (
          <DiaryView
            diary={diary}
            onDiaryChange={saveDiary}
            t={t}
            user={user}
            onOpenProfile={openPublicProfile}
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

        {view === 'profile' && user && (
          <ProfileView
            onOpenPublicProfile={openPublicProfile}
            onOpenSettings={() => handleViewChange('settings')}
            onOpenTour={() => setShowIntroTour(true)}
            journey={journey}
            onJourneyChange={saveJourney}
            onAvatarChange={setMyAvatar}
          />
        )}

        {view === 'dm' && user && (
          <DMView
            initialPartnerId={dmPartnerId}
            currentUserId={user.id}
            onOpenProfile={openPublicProfile}
          />
        )}

{view === 'public-profile' && viewingProfileId && (
          <PublicProfileView
            userId={viewingProfileId}
            currentUserId={user?.id}
            onBack={() => {
              setViewingProfileId(null)
              setView('leaderboard')
            }}
            onOpenProfile={openPublicProfile}
            onOpenDM={openDM}
          />
        )}

        {view === 'leaderboard' && (
          <LeaderboardView
            currentUserId={user?.id}
            onOpenPublicProfile={openPublicProfile}
          />
        )}

        {view === 'hall' && hallAspect && user && (
          <HallView
            aspect={hallAspect}
            currentUserId={user?.id}
            onBack={() => {
              setHallAspect(null)
              setView('aspects')
            }}
            onOpenProfile={openPublicProfile}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            user={user}
            onUserUpdate={onAuthSuccess}
            onAccountDeleted={() => {
              logout()
              setView('aspects')
            }}
            onLogout={logout}
          />
        )}

        {view === 'admin' && user?.is_admin && (
          <AdminView
            onBack={() => setView('dashboard')}
            onImpersonateApply={() => window.location.reload()}
          />
        )}

        {view !== 'journey' && <Footer />}
      </main>
    </div>
  )
}
