import { useState, useEffect, useRef } from 'react'
import { captureReferralFromURL } from './utils/referral'
import Header from './components/Header/Header'
import AspectsView from './components/AspectsView/AspectsView'
import DiaryView from './components/DiaryView/DiaryView'
import JourneyView, { DEFAULT_JOURNEY, DEFAULT_ASPECT_STATE } from './components/JourneyView/JourneyView'
import CoachView from './components/CoachView/CoachView'
import ProfileView from './components/ProfileView/ProfileView'
import PublicProfileView from './components/PublicProfileView/PublicProfileView'
import CommunityView, { type CommunityTab } from './components/CommunityView/CommunityView'
import HallView from './components/HallView/HallView'
import DMView from './components/DMView/DMView'
import DashboardView from './components/DashboardView/DashboardView'
import SettingsView from './components/SettingsView/SettingsView'
import AdminView from './components/AdminView/AdminView'
import AchievementToast from './components/Toast/AchievementToast'
import type { Toast } from './components/Toast/AchievementToast'
import IntroTour from './components/Onboarding/IntroTour'
import { fetchMyProfile, markOnboardingDone, markHintSeen } from './api/client'
import type { ApiError } from './api/client'
import LoadingScreen from './components/LoadingScreen/LoadingScreen'
import AuthModal from './components/Auth/AuthModal'
import WelcomeScreen from './components/Welcome/WelcomeScreen'
import Footer from './components/Footer/Footer'
import { ConfirmProvider } from './components/Confirm/ConfirmProvider'
import {
  readGuestProgress, hasMeaningfulGuestProgress,
  mergeJourneys, mergeScores, clearGuestProgress,
} from './utils/guestProgressMigration'
import { isTMA } from './tma'
import { useBackButton } from './tma/hooks'
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
import type { AspectKey, AspectScores } from '@/types/aspect'
import type { JourneyState, AspectState, ChatMessage } from '@/types/journey'
import type { DiaryEntry } from '@/types/diary'
import type { User } from '@/types/user'
import type { ViewName } from '@/types/view'
import styles from './App.module.css'

// ── localStorage helpers ────────────────────────────────────────────────────

const initScores = (): AspectScores =>
  ASPECT_KEYS.reduce<AspectScores>((acc, key) => ({ ...acc, [key]: 5 }), {})

// localStorage ключи для гостевого режима (без auth).
// При логине данные с локалки могут переехать на бэк (миграцию пока не делаем).
const LS = {
  scores: 'whl_scores',
  history: 'whl_history',
  diary: 'whl_diary',
  journey: 'whl_journey',
} as const

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) { console.error(e) }
}

// ── Loose shapes for API responses (no response_model on backend yet) ───────

// `/api/state` GET response: { journey, history, updated_at }.
type FetchStateResponse = {
  journey?: JourneyState | Record<string, unknown> | null
  history?: unknown
  updated_at?: string | null
} & Record<string, unknown>

// `/api/scores` GET response (object keyed by aspect → number).
type ScoresResponse = Record<string, number>

// Single bot-state aspect row from `/api/sync/bot-state`.
type BotAspectRow = {
  aspect?: AspectKey | string
  current_level?: number
}

type BotState = {
  current_aspect?: AspectKey | string
  current_level?: number
  aspects?: BotAspectRow[]
  streak_days?: number
}

type BotSyncResponse = {
  linked?: boolean
  state?: BotState | null
} & Record<string, unknown>

type JourneyEventItem = {
  type?: string
  aspect?: AspectKey | string
  short_id?: string
  // additional fields permitted but not read here
} & Record<string, unknown>

type EventsResponse = {
  events?: JourneyEventItem[]
} & Record<string, unknown>

// `/api/diary` GET item shape — we map it into the canonical DiaryEntry below.
type DiaryRow = {
  id: number
  created_at: string
  aspect: AspectKey | 'general' | string
  text: string
  source?: string
  extra?: Record<string, unknown> | null
} & Record<string, unknown>

// `/api/profile/me` response — only the load-bearing fields we read here.
type ProfileMe = {
  avatar?: string | null
  newly_unlocked?: string[]
  achievements_catalog?: Array<{
    code: string
    title?: string
    icon?: string
    desc?: string
  }>
} & Record<string, unknown>

// `/api/state` PUT response — returns the new updated_at (and a few other fields).
type SaveStateResponse = {
  updated_at?: string | null
} & Record<string, unknown>

// State-conflict body in a 409 — emitted by saveState's optimistic locking.
type StateConflictDetail = {
  code?: string
  current_updated_at?: string
  your_expected?: string
} & Record<string, unknown>

// ── Diary normalization ─────────────────────────────────────────────────────

function normalizeDiaryRow(row: DiaryRow): DiaryEntry {
  const extra = (row.extra && typeof row.extra === 'object' ? row.extra : {}) as Record<string, unknown>
  return {
    id: row.id,
    date: new Date(row.created_at).toLocaleDateString('ru-RU'),
    ts: new Date(row.created_at).getTime(),
    aspect: row.aspect as AspectKey | 'general',
    text: row.text,
    source: row.source,
    ...extra,
  } as DiaryEntry
}

// ── App root ────────────────────────────────────────────────────────────────

// Реферальный код из URL: ловим до первого render'а (модуль-level, не
// component) — иначе React-роутинг или auth-flow могут переключить URL и
// потерять `?ref=`. Идемпотентно: проверяет, есть ли уже токен, и пишет
// в localStorage. См. utils/referral.ts.
captureReferralFromURL()

const HOME_VIEWS: ReadonlyArray<ViewName> = ['dashboard', 'aspects']

export default function App() {
  const { user, loading: authLoading, onAuthSuccess, logout } = useAuth()

  // `user` from useAuth is `User | null | false`. We pass through to children
  // as `User | null` (false → null, both mean "no logged-in user" for UI).
  const appUser: User | null = user ? (user as User) : null

  // Дефолтный view (с 2026-05):
  //   • залогиненный — 'aspects' → useEffect ниже перекинет на 'dashboard'
  //   • вернувшийся гость (welcome_seen=1, нет токена) — сразу 'journey'
  //   • новый гость — WelcomeScreen, после CTA → 'journey' (см. handleContinueAsGuest)
  // Идея: первое знакомство всегда через Путешествие, дашборд/колесо —
  // расширение кругозора уже после онбординга.
  const [view, setView] = useState<ViewName>(() => {
    try {
      const hasToken = !!localStorage.getItem('slw_token')
      const seenWelcome = localStorage.getItem('welcome_seen') === '1'
      if (!hasToken && seenWelcome) return 'journey'
    } catch { /* private mode / SSR */ }
    return 'aspects'
  })
  const [scores, setScores] = useState<AspectScores>(initScores())
  const [history, setHistory] = useState<unknown[]>([])
  const [diary, setDiary] = useState<DiaryEntry[]>([])
  const [journey, setJourney] = useState<JourneyState>(DEFAULT_JOURNEY)
  const [selectedAspect, setSelectedAspect] = useState<AspectKey | null>(null)
  // Чей публичный профиль смотрим (id WebUser). null — не открыт.
  const [viewingProfileId, setViewingProfileId] = useState<number | string | null>(null)
  // В каком холле сейчас юзер (ключ аспекта). null — не в холле.
  const [hallAspect, setHallAspect] = useState<AspectKey | null>(null)
  // С каким юзером открыт DM-тред. null — список тредов.
  const [dmPartnerId, setDmPartnerId] = useState<number | string | null>(null)
  // Какой таб активен в CommunityView. По умолчанию — 'halls'. Точки входа
  // могут переключать (например, dashboard.onOpenLeaderboard → 'top',
  // public-profile.onBack из ленты → 'feed').
  const [communityTab, setCommunityTab] = useState<CommunityTab>('halls')
  // Очередь тостов (новые ачивки и т.п.). Каждый { id, icon, title, desc, kind, stardust }.
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dataLoading, setDataLoading] = useState<boolean>(false)
  const [showAuth, setShowAuth] = useState<boolean>(false)
  // Стартовая вкладка AuthModal — 'register' для nudge'ов гостя ради
  // сохранения прогресса, 'login' для обычного «Войти» из шапки.
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login')
  // Токен из URL ?reset_token=... — если есть, при следующем открытии
  // AuthModal сразу покажется форма смены пароля. Сбрасывается на null
  // после первого использования (см. handleAuthSuccess).
  const [resetToken, setResetToken] = useState<string | null>(null)
  // welcomeDismissed: гость нажал «Начать бесплатно» и вошёл в приложение
  // без аутентификации. Запоминаем в localStorage, чтобы при следующем
  // визите сразу попадал на колесо. Сбрасывается на logout (см. ниже).
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean>(
    () => localStorage.getItem('welcome_seen') === '1'
  )
  // devAdmin: «пасхалочный» админский режим без бэка. Включается 5 кликами
  // по букве «й» в конце фразы «… дней» в Heatmap-заголовке (DashboardView).
  // Хранится в localStorage, переживает logout. ИЛИ-сложение с user.is_admin.
  const [devAdmin, setDevAdmin] = useState<boolean>(
    () => localStorage.getItem('slw_dev_admin') === '1'
  )
  // toggleDevAdmin: пасхалка, переключение dev-admin режима. Хук-в-перчатке
  // для DashboardView (Heatmap), оставлен в App.tsx как часть публичного
  // API на будущее. NOTE(ts): keep declared even if unused at this point;
  // .jsx исходник тоже его декларировал.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleDevAdmin = (): void => {
    setDevAdmin(prev => {
      const next = !prev
      if (next) localStorage.setItem('slw_dev_admin', '1')
      else localStorage.removeItem('slw_dev_admin')
      return next
    })
  }
  void toggleDevAdmin
  const isAdmin: boolean = (appUser?.is_admin === true) || devAdmin
  const t = ru
  // IntroTour (Layer 1) — Quick Tour. Видим если:
  //   • залогиненный юзер ещё не прошёл (user.onboarding_done === false)
  //   • гость в режиме welcomeDismissed и без localStorage['slw_intro_seen']='1'
  // Re-open из Profile через кнопку «📖 Гид».
  const [showIntroTour, setShowIntroTour] = useState<boolean>(false)

  // Аватар юзера из public_profiles. Источник правды — бэк
  // (/api/profile/me). Фетчим при логине, обновляем после save в ProfileView.
  const [myAvatar, setMyAvatar] = useState<string>('')
  useEffect(() => {
    if (!appUser) { setMyAvatar(''); return }
    let cancelled = false
    fetchMyProfile()
      .then(p => {
        if (cancelled) return
        const profile = (p ?? {}) as ProfileMe
        setMyAvatar(profile.avatar ?? '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [appUser?.id])

  // Скроллим страницу наверх при смене view или selectedAspect. В обычном
  // режиме (не journey) скролл живёт на window — поэтому скроллим именно его.
  // Inner-`.main`.scrollTop оставляем на всякий случай (если когда-то снова
  // окажемся в overflow-режиме на этом узле). Чат journey сам управляет
  // скроллом — его не трогаем.
  const mainRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (view === 'journey') return
    if (mainRef.current) mainRef.current.scrollTop = 0
    window.scrollTo(0, 0)
  }, [view, selectedAspect])

  // ── View history (back button) ────────────────────────────────────────
  // Стек последних N "снимков" навигации. Каждый снимок — это view + те
  // aux-поля, которые определяют конкретный экран внутри view:
  //   • aspects        → selectedAspect (детальная карточка)
  //   • public-profile → viewingProfileId (чей профиль смотрим)
  //   • hall           → hallAspect (какой холл)
  //   • dm             → dmPartnerId (с кем тред)
  // Без снимка aux-полей кнопка «Назад» возвращала бы только view, а
  // detail-state терялся (юзер видел бы пустой Aspects вместо нужной
  // карточки).
  //
  // Кнопка «Назад» доступна, пока в стеке > 1 снимка. Стек ограничен 30
  // элементами — рост практически не виден, но защита от утечки есть.
  type ViewSnapshot = {
    view: ViewName
    selectedAspect: AspectKey | null
    viewingProfileId: number | string | null
    hallAspect: AspectKey | null
    dmPartnerId: number | string | null
  }
  const [viewHistory, setViewHistory] = useState<ViewSnapshot[]>([])
  // Флаг "сейчас идёт goBack" — чтобы snapshot-effect не пушил
  // восстановленное состояние обратно в стек.
  const isGoingBackRef = useRef<boolean>(false)

  useEffect(() => {
    if (isGoingBackRef.current) {
      isGoingBackRef.current = false
      return
    }
    setViewHistory(prev => {
      const snap: ViewSnapshot = { view, selectedAspect, viewingProfileId, hallAspect, dmPartnerId }
      const last = prev[prev.length - 1]
      if (last
        && last.view === snap.view
        && last.selectedAspect === snap.selectedAspect
        && last.viewingProfileId === snap.viewingProfileId
        && last.hallAspect === snap.hallAspect
        && last.dmPartnerId === snap.dmPartnerId
      ) return prev
      const next = [...prev, snap]
      return next.length > 30 ? next.slice(-30) : next
    })
  }, [view, selectedAspect, viewingProfileId, hallAspect, dmPartnerId])

  const goBack = (): void => {
    if (viewHistory.length < 2) return
    const target = viewHistory[viewHistory.length - 2]
    if (!target) return
    isGoingBackRef.current = true
    setView(target.view)
    // Aux-поля восстанавливаем только если они уместны для целевого view.
    // Иначе оставляем null — handleViewChange делает то же самое.
    setSelectedAspect(target.view === 'aspects' ? target.selectedAspect : null)
    setViewingProfileId(target.view === 'public-profile' ? target.viewingProfileId : null)
    setHallAspect(target.view === 'hall' ? target.hallAspect : null)
    setDmPartnerId(target.view === 'dm' ? target.dmPartnerId : null)
    setViewHistory(prev => prev.slice(0, -1))
  }

  const canGoBack: boolean = viewHistory.length > 1

  // Browser-back integration: mouse 4 (thumb-back), Alt+←, кнопка ← в
  // браузере, swipe-back — все триггерят popstate. Чтобы перехватить
  // их и выполнить in-app goBack, при монтировании пушим history-маркер.
  // На popstate: если есть куда вернуться внутри SPA — делаем goBack
  // и пушим новый маркер, иначе пропускаем (юзер выходит из приложения).
  //
  // viewHistory/goBack хранятся в ref — иначе useEffect пересоздавал бы
  // listener на каждый render и могли бы быть гонки с history-стеком.
  const viewHistoryRef = useRef<ViewSnapshot[]>(viewHistory)
  viewHistoryRef.current = viewHistory
  const goBackRef = useRef<() => void>(goBack)
  goBackRef.current = goBack

  useEffect(() => {
    // Маркер-страж в истории. Если URL вернётся на этот маркер — popstate
    // не сработает (мы ещё на нём). Поэтому ниже re-push после успешного
    // back, чтобы следующая навигация тоже была перехвачена.
    window.history.pushState({ slwBackMarker: true }, '')

    const handlePopState = (): void => {
      if (viewHistoryRef.current.length < 2) {
        // SPA-стек пуст — позволяем браузеру навигировать обычным образом
        // (выйти из приложения, например).
        return
      }
      goBackRef.current()
      window.history.pushState({ slwBackMarker: true }, '')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Optimistic locking. Хранит updated_at последнего успешно загруженного/
  // сохранённого state. При PUT отправляем как expected_updated_at — если
  // кто-то ещё изменил (admin restore, другая вкладка, impersonation) —
  // бэк ответит 409 и мы перечитаем свежее значение.
  // ОБЪЯВЛЕНО ДО loadFromApi, чтобы избежать TDZ при использовании в closure.
  const stateVersionRef = useRef<string | null>(null)

  // Загрузка данных при изменении статуса auth.
  // Залогинен → API. Гость → localStorage.
  useEffect(() => {
    if (user === null) return  // ещё проверяем токен — ничего не делаем
    if (user) {
      void loadFromApi()
      // При первом логине переключаем на дашборд (если ещё на стартовом 'aspects').
      setView(v => v === 'aspects' ? 'dashboard' : v)
    } else {
      loadFromLocal()
    }
  }, [user])

  const loadFromApi = async (): Promise<void> => {
    setDataLoading(true)
    try {
      const [stateRes, scoresRes, diaryRes, botSync, eventsRes] = await Promise.all([
        fetchState() as Promise<FetchStateResponse>,
        fetchScores() as Promise<ScoresResponse>,
        fetchDiary() as Promise<DiaryRow[]>,
        (fetchBotState() as Promise<BotSyncResponse>).catch(() => null),
        (fetchEvents(0) as Promise<EventsResponse>).catch(() => ({ events: [] } as EventsResponse)),
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
      let journeyOverride: (JourneyState & Record<string, unknown>) | null =
        (stateRes.journey as (JourneyState & Record<string, unknown>) | undefined) ?? null

      const readAspectFolder = (
        jo: (JourneyState & Record<string, unknown>) | null,
        aspect: AspectKey | string
      ): Partial<AspectState> | null => {
        if (!jo) return null
        if (jo.aspects && (jo.aspects as Record<string, AspectState | undefined>)[aspect]) {
          return (jo.aspects as Record<string, AspectState>)[aspect]
        }
        // Старый плоский state с бэка — читаем поля как есть.
        return {
          currentLevel: (jo as Record<string, unknown>).currentLevel as AspectState['currentLevel'] | undefined,
          currentScriptIndex: (jo as Record<string, unknown>).currentScriptIndex as number | undefined,
          currentScriptId: (jo as Record<string, unknown>).currentScriptId as string | null | undefined,
          awaitingInput: (jo as Record<string, unknown>).awaitingInput as AspectState['awaitingInput'] | undefined,
          messages: (jo as Record<string, unknown>).messages as ChatMessage[] | undefined,
          completedScripts: (jo as Record<string, unknown>).completedScripts as string[] | undefined,
          pendingTasks: (jo as Record<string, unknown>).pendingTasks as AspectState['pendingTasks'] | undefined,
        }
      }

      const writeAspectFolder = (
        jo: (JourneyState & Record<string, unknown>) | null,
        aspect: AspectKey | string,
        patch: Partial<AspectState>,
      ): JourneyState & Record<string, unknown> => {
        const base = jo ?? ({} as JourneyState & Record<string, unknown>)
        const prevFolder = readAspectFolder(base, aspect) ?? {}
        return {
          ...base,
          aspects: {
            ...(base.aspects ?? {}),
            [aspect]: { ...prevFolder, ...patch },
          },
        } as JourneyState & Record<string, unknown>
      }

      const bumpAspectFromBot = (
        jo: (JourneyState & Record<string, unknown>) | null,
        aspect: AspectKey | string,
        botLevel: number,
      ): (JourneyState & Record<string, unknown>) | null => {
        const folder = readAspectFolder(jo, aspect) ?? {}
        const webLevel = folder.currentLevel ?? 0
        if (botLevel <= webLevel) return jo
        const journeyData = getJourney(aspect as AspectKey)
        const nextLevelData = journeyData?.levels?.[botLevel as 0 | 1 | 2 | 3] as
          | { core?: Array<{ id: string }>; scripts?: Array<{ id: string }> }
          | undefined
        const firstScript = (nextLevelData?.core ?? nextLevelData?.scripts ?? [])[0]
        return writeAspectFolder(jo, aspect, {
          currentLevel: botLevel as AspectState['currentLevel'],
          currentScriptIndex: 0,
          currentScriptId: firstScript?.id ?? null,
          awaitingInput: null,
          messages: firstScript
            ? [
                ...((folder.messages ?? []) as ChatMessage[]),
                {
                  id: Date.now() + Math.random(),
                  role: 'bot',
                  kind: 'script',
                  scriptId: firstScript.id,
                  level: botLevel,
                },
              ]
            : ((folder.messages ?? []) as ChatMessage[]),
        })
      }

      if (botSync?.linked && botSync.state) {
        const bs = botSync.state
        const isWebFresh = !journeyOverride || (journeyOverride.screen as string | undefined) === 'onboarding'

        if (isWebFresh && bs.current_aspect) {
          journeyOverride = {
            ...((journeyOverride ?? {}) as JourneyState & Record<string, unknown>),
            currentAspect: bs.current_aspect as AspectKey,
          } as JourneyState & Record<string, unknown>
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
            journeyOverride, bs.current_aspect, bs.current_level ?? 0,
          )
        }

        if (bs.streak_days) {
          journeyOverride = {
            ...((journeyOverride ?? {}) as JourneyState & Record<string, unknown>),
            streak: Math.max(journeyOverride?.streak ?? 0, bs.streak_days),
          } as JourneyState & Record<string, unknown>
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
        (e): e is JourneyEventItem & { aspect: string; short_id: string } =>
          e.type === 'step_completed' && !!e.short_id && !!e.aspect
      )
      if (botEvents.length > 0) {
        // Группируем по аспекту → раскладываем по папкам.
        const byAspect = botEvents.reduce<Record<string, string[]>>((acc, e) => {
          (acc[e.aspect] ??= []).push(e.short_id)
          return acc
        }, {})
        for (const [aspect, ids] of Object.entries(byAspect)) {
          const folder = readAspectFolder(journeyOverride, aspect) ?? {}
          const merged = new Set<string>(folder.completedScripts ?? [])
          ids.forEach(id => merged.add(id))
          journeyOverride = writeAspectFolder(journeyOverride, aspect, {
            completedScripts: Array.from(merged),
          })
        }
      }

      // Гостевой прогресс из localStorage — мерджим в свежий API-state и
      // пушим обратно. Max-стратегия не разрушает данные: если на аккаунте
      // уже было прогрессировано — guest добавляет только то, чего не было
      // (см. utils/guestProgressMigration.ts). После успешного push'а
      // localStorage стирается.
      const guest = readGuestProgress()
      const willMigrate = hasMeaningfulGuestProgress(guest)
      let journeyForState: JourneyState | null =
        journeyOverride ? (journeyOverride as JourneyState) : null
      let scoresForState: AspectScores | null =
        Object.keys(scoresRes).length > 0 ? (scoresRes as AspectScores) : null

      if (willMigrate && guest) {
        const merged = mergeJourneys(journeyForState, guest.journey)
        const mergedScores = mergeScores(scoresForState, guest.scores)
        journeyForState = merged
        scoresForState = mergedScores

        // Пушим merged-state на бэк. Дебаунс/queue в saveStateGuarded.
        try {
          await saveStateGuarded({ journey: merged })
          await apiSaveScores(mergedScores as Record<string, number>)
        } catch (e) {
          console.error('guest migration: save state/scores failed', e)
        }

        // Пушим гостевые записи дневника. Они уже могут быть в diaryRes
        // (если юзер раньше логинился и писал на бэк), но обычно нет —
        // гость не имел токена. Без дедупа: bek сам выдаёт новые id,
        // юзер увидит свои записи (плюс возможные пары если уже были
        // одинаковые тексты — пусть лучше дубли чем потеря).
        for (const entry of guest.diary) {
          try {
            await postDiaryEntry({
              text: entry.text,
              aspect: entry.aspect,
              source: entry.source ?? 'guest-migration',
              extra: {
                scriptId: entry.scriptId ?? null,
                promptTitle: entry.promptTitle ?? null,
                prompt: entry.prompt ?? null,
                survey: entry.survey ?? null,
              },
            })
          } catch (e) {
            console.error('guest migration: diary entry failed', e)
          }
        }

        // Свежий пересчёт diary с бэка (получим новые id для UI).
        try {
          const fresh = await fetchDiary() as DiaryRow[]
          diaryRes.length = 0
          diaryRes.push(...fresh)
        } catch (e) {
          console.error('guest migration: refetch diary failed', e)
        }

        // Стираем гостевые ключи. Если юзер выйдет — начнёт с чистого
        // листа, не получит дубль миграции при следующем логине.
        clearGuestProgress()

        // Toast — даём знать что произошло. Тост короткий, не показываем
        // числа (juzer и так это видит на дашборде).
        const { xp, totalCompleted, diaryCount } = guest.summary
        const parts: string[] = []
        if (xp > 0) parts.push(`${xp} XP`)
        if (totalCompleted > 0) parts.push(`${totalCompleted} ${totalCompleted === 1 ? 'шаг' : 'шагов'}`)
        if (diaryCount > 0) parts.push(`${diaryCount} ${diaryCount === 1 ? 'запись' : 'записей'}`)
        setToasts(prev => [...prev, {
          id: `migrate-${Date.now()}`,
          kind: 'info',
          icon: '🎁',
          title: 'Прогресс перенесён в аккаунт',
          desc: parts.length > 0 ? parts.join(' · ') : 'Твои данные сохранены.',
        }])
      }

      if (journeyForState) {
        setJourney(j => ({ ...j, ...journeyForState! }))
      }
      if (stateRes.history) setHistory(stateRes.history as unknown[])
      if (scoresForState) {
        setScores(scoresForState)
      }

      if (diaryRes.length > 0) {
        setDiary(diaryRes.map(normalizeDiaryRow))
      }
    } catch (e) {
      console.error('Error loading data:', e)
    } finally {
      setDataLoading(false)
    }
  }

  const loadFromLocal = (): void => {
    setScores(lsGet<AspectScores>(LS.scores, initScores()))
    setHistory(lsGet<unknown[]>(LS.history, []))
    setDiary(lsGet<DiaryEntry[]>(LS.diary, []))
    setJourney(lsGet<JourneyState>(LS.journey, DEFAULT_JOURNEY))
  }

  const saveScores = async (newScores: AspectScores): Promise<void> => {
    setScores(newScores)
    if (appUser) {
      try { await apiSaveScores(newScores as Record<string, number>) } catch (e) { console.error(e) }
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
  type SavePatch = { journey?: JourneyState; history?: unknown }
  const saveDebounceRef = useRef<SavePatch | null>(null)
  const lastSavePromiseRef = useRef<Promise<SaveStateResponse | null>>(Promise.resolve(null))

  const saveStateGuarded = (patch: SavePatch): Promise<SaveStateResponse | null> => {
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
        }) as SaveStateResponse | null
        if (res?.updated_at) stateVersionRef.current = res.updated_at
        return res
      } catch (e: unknown) {
        const err = e as ApiError
        if (err?.status === 409) {
          // Обновляем ref свежим значением из тела 409 — следующий save
          // пойдёт с ним. Loading-индикатор не показываем, тост не сыпем.
          // Если на самом деле что-то поменялось снаружи (admin) — следующая
          // ручная перезагрузка страницы подтянет свежий state.
          const detail = err.detail as StateConflictDetail | null | undefined
          const fresh = detail && typeof detail === 'object'
            ? detail.current_updated_at ?? null
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

  const saveHistory = async (newHistory: unknown[]): Promise<void> => {
    setHistory(newHistory)
    if (appUser) {
      try { await saveStateGuarded({ history: newHistory }) } catch (e) { console.error(e) }
    } else {
      lsSet(LS.history, newHistory)
    }
  }
  // saveHistory is plumbed through `history` state for future use; reference
  // to silence unused-warning until a child wires it.
  void saveHistory

  const saveDiary = async (newDiary: DiaryEntry[]): Promise<void> => {
    const prev = diary
    setDiary(newDiary)
    if (appUser) {
      const newEntries = newDiary.filter(e => !prev.find(p => p.id === e.id))
      // Lazy import чтобы не зависеть от utils/xp на top-level App.tsx.
      const { emitXpEarned } = await import('./utils/xp')
      for (const entry of newEntries) {
        try {
          const resp = await postDiaryEntry({
            text: entry.text,
            aspect: entry.aspect,
            source: entry.source ?? 'web',
            extra: {
              scriptId: entry.scriptId ?? null,
              promptTitle: entry.promptTitle ?? null,
              prompt: entry.prompt ?? null,
              survey: entry.survey ?? null,
            },
          }) as { xp?: { xp_delta?: number; action_code?: string; label?: string } }
          emitXpEarned(resp.xp)
        } catch (e) { console.error(e) }
      }
    } else {
      lsSet(LS.diary, newDiary)
    }
  }

  const saveJourney = async (newJourney: JourneyState): Promise<void> => {
    setJourney(newJourney)
    if (appUser) {
      try { await saveStateGuarded({ journey: newJourney }) } catch (e) { console.error(e) }
    } else {
      lsSet(LS.journey, newJourney)
    }
  }

  // ── Surveys-entry helpers per aspect ──────────────────────────────────────

  const makeGoToAspectSurveys = (aspect: AspectKey) => async (): Promise<void> => {
    if (!appUser && !devAdmin) {
      setShowAuth(true)
      return
    }
    // L0 должен быть пройден (currentLevel >= 1). Админу можно всегда.
    // currentLevel и awaitingInput теперь живут в journey.aspects[aspect].
    const folder: AspectState = journey?.aspects?.[aspect] ?? DEFAULT_ASPECT_STATE
    if (!isAdmin && (folder.currentLevel ?? 0) < 1) {
      return
    }
    await saveJourney({
      ...journey,
      currentAspect: aspect,
      screen: 'skill-tree',
      aspects: {
        ...(journey?.aspects ?? {}),
        [aspect]: { ...folder, awaitingInput: null },
      },
    })
    setView('journey')
  }

  const goToSiSurveys = makeGoToAspectSurveys('Si')
  const goToFeSurveys = makeGoToAspectSurveys('Fe')
  const goToNeSurveys = makeGoToAspectSurveys('Ne')
  const goToNiSurveys = makeGoToAspectSurveys('Ni')
  const goToFiSurveys = makeGoToAspectSurveys('Fi')
  const goToTeSurveys = makeGoToAspectSurveys('Te')
  const goToTiSurveys = makeGoToAspectSurveys('Ti')
  const goToSeSurveys = makeGoToAspectSurveys('Se')

  const handleAuthSuccess = (userData: unknown): void => {
    onAuthSuccess(userData as User)
    setShowAuth(false)
    // После любого успешного логина — Welcome больше не показываем,
    // даже если юзер потом разлогинится (у него уже есть прогресс).
    localStorage.setItem('welcome_seen', '1')
    setWelcomeDismissed(true)
  }

  const handleViewChange = (newView: ViewName): void => {
    // Journey доступен гостям с 2026-05: первое знакомство — сразу
    // в путешествие, прогресс хранится в localStorage['whl_journey'].
    // После пары шагов фронт показывает soft-nudge на регистрацию.
    // Коуч и Профиль требуют авторизации — бэк всё равно отобьёт без JWT,
    // но проверяем здесь чтобы не показывать пустой экран с ошибкой.
    if ((newView === 'coach' || newView === 'profile' || newView === 'search') && !appUser) {
      setShowAuth(true)
      return
    }
    // Гасим подсветку Аспектов при первом клике. Best-effort: пишем
    // на бэк (hints_seen) и в localStorage, чтобы условие подсветки
    // в App.tsx больше не срабатывало.
    if (newView === 'aspects' && appUser && !appUser?.hints_seen?.['nav-aspects-cta']) {
      try { localStorage.setItem('hint_nav-aspects-cta', '1') } catch { /* ignore */ }
      markHintSeen('nav-aspects-cta').catch(() => {})
      onAuthSuccess({
        ...appUser,
        hints_seen: { ...(appUser.hints_seen ?? {}), 'nav-aspects-cta': true },
      } as User)
    }
    setView(newView)
    setSelectedAspect(null)
    setViewingProfileId(null)
    setHallAspect(null)
    if (newView !== 'dm') setDmPartnerId(null)
  }

  const openPublicProfile = (userId: number | string): void => {
    setViewingProfileId(userId)
    setView('public-profile')
  }

  const enterHall = (aspect: AspectKey): void => {
    if (!appUser) {
      setShowAuth(true)
      return
    }
    setHallAspect(aspect)
    setView('hall')
  }

  const openDM = (partnerId: number | string | null = null): void => {
    if (!appUser) { setShowAuth(true); return }
    setDmPartnerId(partnerId)
    setView('dm')
  }

  const dismissToast = (id: string): void => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // XP-events: компоненты после mutation эмитят `slw:xp-earned` через
  // emitXpEarned(response.xp). Здесь слушаем и:
  //   1) пушим toast «+N XP за …»
  //   2) увеличиваем journey.xp в локальном state — чтобы цифра в шапке
  //      обновилась без отдельного фетча. Опционально сохраняем на бэк
  //      через saveStateGuarded, но это уже сделано на бэке (web_state.xp
  //      обновился при award_xp), так что фронт может просто прочитать
  //      delta и применить.
  useEffect(() => {
    // Динамический импорт, чтобы не плодить top-level import-ов выше.
    let unsubscribe = () => {}
    import('./utils/xp').then(({ onXpEarned }) => {
      unsubscribe = onXpEarned((xp) => {
        const delta = xp.xp_delta ?? 0
        if (delta <= 0) return
        // Toast.
        setToasts(prev => [...prev, {
          id: `xp-${xp.action_code}-${Date.now()}`,
          kind: 'xp',
          icon: '✨',
          title: xp.label ?? `+${delta} XP`,
          xpAmount: delta,
        }])
        // Локальный journey.xp += delta. Не пушим через saveStateGuarded —
        // бэк уже обновил web_state.journey.xp атомарно, при следующем
        // GET /api/state или 409-fall-through всё синхронизируется.
        setJourney(j => ({ ...j, xp: (j?.xp ?? 0) + delta }))
      })
    })
    return () => unsubscribe()
  }, [])

  // BackButton от Telegram: показываем стрелку «назад» в шапке TG на всех
  // экранах кроме «домашних» (dashboard, aspects). Клик возвращает на
  // дашборд для залогиненных или aspects для гостей.
  // Если открыт чужой профиль или холл — сначала закрываем их (возврат на
  // дашборд), иначе двойной back не нужен.
  const tmaBackHandler = isTMA && !HOME_VIEWS.includes(view)
    ? () => {
        // Чужой профиль/холл/DM-тред: закрываем их и идём на «домашний» view.
        setViewingProfileId(null)
        setHallAspect(null)
        setDmPartnerId(null)
        setSelectedAspect(null)
        setView(appUser ? 'dashboard' : 'aspects')
      }
    : null
  useBackButton(tmaBackHandler)

  // При логине проверяем разблокированные ачивки. /api/profile/me грантит
  // и возвращает newly_unlocked — ставим тосты и +1 стардаст за каждую.
  // Хук срабатывает только когда user стал не-null (loadFromApi уже отработал).
  useEffect(() => {
    if (!appUser) return
    let cancelled = false
    fetchMyProfile()
      .then(p => {
        if (cancelled) return
        const profile = (p ?? {}) as ProfileMe
        const newCodes = profile.newly_unlocked ?? []
        if (newCodes.length === 0) return
        const catalog = new Map((profile.achievements_catalog ?? []).map(a => [a.code, a]))
        const newToasts: Toast[] = newCodes.map(code => {
          const meta = catalog.get(code) ?? { code, title: code, icon: '✨', desc: '' }
          return {
            id: `ach-${code}-${Date.now()}`,
            kind: 'achievement',
            icon: meta.icon ?? '✨',
            title: meta.title ?? code,
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
            const updated: JourneyState = { ...j, stardust: (j?.stardust ?? 0) + grant }
            saveStateGuarded({ journey: updated }).catch(() => {})
            return updated
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id])

  // IntroTour: 2026-05-19 — авто-показ снова включён, но ТОЛЬКО перед
  // первым входом в Путешествие. Поток: WelcomeScreen → click → view='journey'
  // → useEffect ниже ловит и открывает IntroTour (5 шагов). После закрытия
  // тура юзер видит Journey-Onboarding (4 чат-сообщения). Открыть тур
  // вручную можно через «🎓 Пройти обучение» в дашборде / «📖 Гид» в ProfileView.
  // Гость: флаг localStorage['slw_intro_seen'].
  // Залогиненный: server-флаг user.onboarding_done.
  useEffect(() => {
    if (view !== 'journey') return
    if (showIntroTour) return // уже открыт
    const seenForGuest = (() => {
      try { return localStorage.getItem('slw_intro_seen') === '1' } catch { return false }
    })()
    const seenForUser = appUser?.onboarding_done === true
    if (seenForGuest || seenForUser) return
    setShowIntroTour(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, appUser?.onboarding_done])

  const handleTourClose = async (): Promise<void> => {
    setShowIntroTour(false)
    if (appUser) {
      try { await markOnboardingDone() } catch (e) { console.error(e) }
      // Локально ставим флаг в user, чтобы повторный логин не открывал тур
      // снова из useEffect выше (useAuth кэширует user).
      onAuthSuccess({ ...appUser, onboarding_done: true } as User)
    } else {
      localStorage.setItem('slw_intro_seen', '1')
    }
  }

  const handleTourComplete = async (): Promise<void> => {
    await handleTourClose()
    // Финальный CTA — переключаемся на путешествие. Если юзер уже в
    // 'journey' (тур авто-открылся при входе) — setView no-op, ниже
    // развернётся Journey-Onboarding.
    setView('journey')
  }

  // ?u=<id> в URL → открываем публичный профиль (deeplink с шеринга).
  // Один раз при маунте: если параметр есть, переключаемся на view.
  // ?reset_token=XXX в URL → открываем AuthModal в режиме смены пароля
  // (см. backend/.../auth.py:password_reset_request — ссылка из email/TG).
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
    const rt = params.get('reset_token')
    if (rt && rt.length >= 16) {
      setResetToken(rt)
      setShowAuth(true)
      // Убираем токен из URL — иначе reload снова откроет модалку и
      // создаст ощущение «зациклилось», плюс токен висит в истории браузера.
      const url = new URL(window.location.href)
      url.searchParams.delete('reset_token')
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
  if (!appUser && !welcomeDismissed && !isTMA) {
    return (
      <WelcomeScreen
        onAuthSuccess={onAuthSuccess as (data: unknown) => void}
        onContinueAsGuest={() => {
          localStorage.setItem('welcome_seen', '1')
          setWelcomeDismissed(true)
          // Гость попадает сразу в Путешествие (онбординг). Остальные view
          // он откроет позже из меню — а в начале фокус один.
          setView('journey')
        }}
      />
    )
  }
  // Залогиненный юзер ждёт данные с бэка — лоадер.
  if (appUser && dataLoading) return <LoadingScreen text={t.loading} />

  // В Telegram Mini App на странице путешествия скрываем Header —
  // там и так есть свой топбар внутри Chat (с avatar/планетой/XP),
  // плюс BackButton TG для возврата. Иначе на мобильном суммарно 4 шапки
  // съедают половину экрана, чат и клавиатура не помещаются.
  const hideHeader = isTMA && view === 'journey'

  const activeAspect = journey?.currentAspect
  const pendingCount = activeAspect
    ? journey?.aspects?.[activeAspect]?.pendingTasks?.length ?? 0
    : 0

  return (
    <ConfirmProvider>
    <div className={`${styles.app} ${view === 'journey' ? styles.appLocked : ''}`}>
      <AchievementToast items={toasts} onDismiss={dismissToast} />
      {showIntroTour && (
        <IntroTour
          isGuest={!appUser}
          onClose={handleTourClose}
          onGoToPlanets={handleTourComplete}
        />
      )}
      {!hideHeader && <Header
        view={view}
        onViewChange={handleViewChange}
        canGoBack={canGoBack}
        onGoBack={goBack}
        journeyPendingCount={pendingCount}
        // Подсвечиваем «Путешествие» если юзер залогинен, на дашборде и
        // ни разу не начинал путешествие. Условие выключается само,
        // как только totalCompleted > 0 (юзер прошёл хотя бы один шаг).
        journeyHighlight={!!appUser && view === 'dashboard' && (journey?.totalCompleted ?? 0) === 0}
        // Подсветка «Аспекты» — для юзера который УЖЕ начал проходить
        // путешествие (3+ шагов), но ещё не открывал страницу Аспектов.
        // Цель: напомнить про теорию/контент сфер, когда у юзера накопился
        // интерес к деталям. Отключается через hints_seen['nav-aspects-cta']
        // при первом клике на кнопку.
        aspectsHighlight={
          !!appUser
          && view === 'dashboard'
          && (journey?.totalCompleted ?? 0) >= 3
          && !appUser?.hints_seen?.['nav-aspects-cta']
          && localStorage.getItem('hint_nav-aspects-cta') !== '1'
        }
        user={appUser}
        userAvatar={myAvatar}
        totalStepsCompleted={journey?.totalCompleted ?? 0}
        onLogin={() => setShowAuth(true)}
        onLogout={logout}
        onOpenMyProfile={() => handleViewChange('profile')}
        onOpenProfile={openPublicProfile}
        onOpenDM={openDM}
        onOpenHall={(aspect) => enterHall(aspect as AspectKey)}
        onOpenAdmin={() => setView('admin')}
        t={t}
      />}

      {showAuth && (
        <AuthModal
          onSuccess={handleAuthSuccess}
          onClose={() => { setShowAuth(false); setResetToken(null) }}
          user={appUser || null}
          initialMode={authInitialMode}
          resetToken={resetToken}
        />
      )}

      <main
        ref={mainRef}
        className={view === 'journey' ? styles.mainJourney : styles.main}
      >
        {view === 'dashboard' && appUser && (
          <DashboardView
            currentUserId={appUser.id}
            user={appUser}
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
            onOpenLeaderboard={() => {
              setCommunityTab('top')
              handleViewChange('community')
            }}
            onOpenTour={() => setShowIntroTour(true)}
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
            user={appUser}
            onRequestAuth={(mode = 'register') => {
              setAuthInitialMode(mode)
              setShowAuth(true)
            }}
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
            user={appUser}
          />
        )}

        {view === 'diary' && (
          <DiaryView
            diary={diary}
            onDiaryChange={saveDiary}
            t={t}
            user={appUser}
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

        {view === 'profile' && appUser && (
          <ProfileView
            onOpenPublicProfile={openPublicProfile}
            onOpenSettings={() => handleViewChange('settings')}
            onOpenTour={() => setShowIntroTour(true)}
            journey={journey}
            onJourneyChange={saveJourney}
            onAvatarChange={setMyAvatar}
          />
        )}

        {view === 'dm' && appUser && (
          <DMView
            initialPartnerId={dmPartnerId}
            currentUserId={appUser.id}
            onOpenProfile={openPublicProfile}
          />
        )}

        {view === 'public-profile' && viewingProfileId && (
          <PublicProfileView
            userId={viewingProfileId}
            currentUserId={appUser?.id}
            onBack={() => {
              setViewingProfileId(null)
              setView('community')
            }}
            onOpenProfile={openPublicProfile}
            onOpenDM={openDM}
          />
        )}

        {view === 'community' && (
          <CommunityView
            user={appUser}
            currentUserId={appUser?.id ?? null}
            initialTab={communityTab}
            onEnterHall={enterHall}
            onOpenProfile={openPublicProfile}
            onOpenDM={openDM}
            onRequestAuth={() => setShowAuth(true)}
          />
        )}

        {view === 'hall' && hallAspect && appUser && (
          <HallView
            aspect={hallAspect}
            currentUserId={appUser?.id}
            onBack={() => {
              setHallAspect(null)
              setView('aspects')
            }}
            onOpenProfile={openPublicProfile}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            user={appUser}
            onUserUpdate={(u) => onAuthSuccess(u as User)}
            onAccountDeleted={() => {
              logout()
              setView('aspects')
            }}
            onLogout={logout}
          />
        )}

        {view === 'admin' && appUser?.is_admin && (
          <AdminView
            onBack={() => setView('dashboard')}
            onImpersonateApply={() => window.location.reload()}
          />
        )}

        {view !== 'journey' && <Footer />}
      </main>
    </div>
    </ConfirmProvider>
  )
}
