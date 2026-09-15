import { lazy, StrictMode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { AspectKey } from '@/types/aspect'
import type { HallSection } from '@/components/AspectsView/blocks'
import type { JourneyNavigationRequest } from '@/components/JourneyView/JourneyView'
import { ru } from '@/locales/ru'
import { ConfirmProvider } from '@/components/Confirm/ConfirmProvider'
import { UiPreferencesContext, type UiPreferencesContextValue } from '@/hooks/useSendKeyMode'
import { LiteHeader } from './LiteHeader'
import { LiteHome } from './LiteHome'
import { LiteSettings } from './LiteSettings'
import { UnavailableFeature, type UnavailableFeatureId } from './UnavailableFeature'
import { LiteHallView } from './LiteHallView'
import { useLiteSession } from './useLiteSession'
import { LITE_CONTENT_ACCESS } from './contentAccess'
import styles from './LiteApp.module.css'

const JourneyView = lazy(() => import('@/components/JourneyView/JourneyView'))
const AspectsView = lazy(() => import('@/components/AspectsView/AspectsView'))
const DiaryView = lazy(() => import('@/components/DiaryView/DiaryView'))
const CatalogView = lazy(() => import('./CatalogView').then(module => ({ default: module.CatalogView })))

export type LocalPanel = 'home' | 'journey' | 'aspects' | 'catalog' | 'diary' | 'settings'
type LocalRoute = { panel: LocalPanel; selectedAspect?: AspectKey | null; fallbackNotice?: string } | { panel: 'hall'; aspect: AspectKey; section?: HallSection } | { panel: 'unavailable'; feature: UnavailableFeatureId }
const ASPECTS: readonly AspectKey[] = ['Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe', 'Ni', 'Ne']
const LOCAL_PANELS: readonly LocalPanel[] = ['home', 'journey', 'aspects', 'catalog', 'diary', 'settings']
const SERVER_ROUTES: Partial<Record<string, UnavailableFeatureId>> = { coach: 'coach', community: 'community', dm: 'messages', profile: 'profile', 'public-profile': 'profile', admin: 'admin', search: 'server-search', dashboard: 'server-dashboard', login: 'account', auth: 'account', register: 'account', notifications: 'notifications', leaderboard: 'leaderboard' }

function isAspect(value: string | null): value is AspectKey { return value !== null && ASPECTS.includes(value as AspectKey) }
function initialRoute(): LocalRoute {
  const params = new URLSearchParams(window.location.search)
  if (params.has('u')) return { panel: 'unavailable', feature: 'profile' }
  if (params.has('token') || params.has('reset_token') || params.has('auth') || /tgAuthResult=/i.test(window.location.hash)) return { panel: 'unavailable', feature: 'account' }
  const requested = params.get('view') ?? params.get('route')
  if (requested === 'hall') { const aspect = params.get('aspect'); return isAspect(aspect) ? { panel: 'hall', aspect } : { panel: 'unavailable', feature: 'hall-chat' } }
  if (requested && LOCAL_PANELS.includes(requested as LocalPanel)) return { panel: requested as LocalPanel }
  if (requested && SERVER_ROUTES[requested]) return { panel: 'unavailable', feature: SERVER_ROUTES[requested]! }
  if (requested) return { panel: 'home', fallbackNotice: `Маршрут «${requested}» отсутствует в локальной версии. Открыта главная.` }
  const baseParts = import.meta.env.BASE_URL.split('/').filter(Boolean)
  const pathParts = window.location.pathname.split('/').filter(Boolean)
  if (pathParts.slice(baseParts.length).length > 0) return { panel: 'home', fallbackNotice: 'Неизвестный адрес заменён безопасной локальной главной.' }
  return { panel: 'home' }
}

function sanitizedInitialUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('token')
  url.searchParams.delete('reset_token')
  url.searchParams.delete('auth')
  if (url.hash) {
    const remainingHash = url.hash.slice(1).split('&').filter(part => !/^tgAuthResult=/i.test(part))
    url.hash = remainingHash.length > 0 ? `#${remainingHash.join('&')}` : ''
  }
  return `${url.pathname}${url.search}${url.hash}`
}

type LiteHistoryState = { slwLiteIndex: number; slwLiteRoute: LocalRoute }

export function LiteApp() {
  const session = useLiteSession()
  const [startup] = useState(() => ({ route: initialRoute(), url: sanitizedInitialUrl() }))
  const directEntry = startup.route.panel !== 'home'
  const [route, setRoute] = useState<LocalRoute>(startup.route)
  const [historyIndex, setHistoryIndex] = useState(directEntry ? 1 : 0)
  const [journeyMounted, setJourneyMounted] = useState(route.panel === 'journey')
  const [aspectsMounted, setAspectsMounted] = useState(route.panel === 'aspects')
  const [catalogMounted, setCatalogMounted] = useState(route.panel === 'catalog')
  const [diaryMounted, setDiaryMounted] = useState(route.panel === 'diary')
  const [navigationRequest, setNavigationRequest] = useState<JourneyNavigationRequest | null>(null)
  const routeRef = useRef(route)
  const historyIndexRef = useRef(directEntry ? 1 : 0)
  const historyInitializedRef = useRef(false)
  routeRef.current = route
  const preferences = useMemo<UiPreferencesContextValue>(() => ({ sendKeyMode: session.data.preferences.sendKeyMode, hintsSeen: session.data.preferences.hintsSeen, setSendKeyMode: sendKeyMode => session.updatePreferences(current => ({ ...current, sendKeyMode })), markHintSeen: id => session.updatePreferences(current => ({ ...current, hintsSeen: { ...current.hintsSeen, [id]: true } })) }), [session.data.preferences, session.updatePreferences])
  const installRoute = useCallback((next: LocalRoute) => { if (next.panel === 'journey') setJourneyMounted(true); if (next.panel === 'aspects') setAspectsMounted(true); if (next.panel === 'catalog') setCatalogMounted(true); if (next.panel === 'diary') setDiaryMounted(true); routeRef.current = next; setRoute(next) }, [])
  const navigate = useCallback((next: LocalRoute) => {
    if (JSON.stringify(next) === JSON.stringify(routeRef.current)) return
    const nextIndex = historyIndexRef.current + 1
    window.history.pushState({ slwLiteIndex: nextIndex, slwLiteRoute: next } satisfies LiteHistoryState, '')
    historyIndexRef.current = nextIndex
    setHistoryIndex(nextIndex)
    installRoute(next)
  }, [installRoute])
  const goBack = useCallback(() => {
    if (historyIndexRef.current > 0) { window.history.back(); return }
    if (routeRef.current.panel !== 'home') {
      const home: LocalRoute = { panel: 'home' }
      window.history.replaceState({ slwLiteIndex: 0, slwLiteRoute: home } satisfies LiteHistoryState, '', startup.url)
      installRoute(home)
    }
  }, [installRoute, startup.url])
  useEffect(() => {
    if (!historyInitializedRef.current) {
      const initialState = { ...(window.history.state ?? {}), slwLiteIndex: 0, slwLiteRoute: directEntry ? { panel: 'home' } : startup.route } as LiteHistoryState
      window.history.replaceState(initialState, '', startup.url)
      if (directEntry) window.history.pushState({ slwLiteIndex: 1, slwLiteRoute: startup.route } satisfies LiteHistoryState, '', startup.url)
      historyInitializedRef.current = true
    }
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as Partial<LiteHistoryState> | null
      const next = state?.slwLiteRoute ?? { panel: 'home' }
      const nextIndex = typeof state?.slwLiteIndex === 'number' ? state.slwLiteIndex : 0
      historyIndexRef.current = nextIndex
      setHistoryIndex(nextIndex)
      installRoute(next)
    }
    const onKeyDown = (event: KeyboardEvent) => { if ((event.altKey && event.key === 'ArrowLeft') || (event.key === 'Escape' && routeRef.current.panel !== 'home')) { event.preventDefault(); goBack() } }
    window.addEventListener('popstate', onPopState); window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('popstate', onPopState); window.removeEventListener('keydown', onKeyDown) }
  }, [directEntry, goBack, installRoute, startup.route, startup.url])
  const openPanel = useCallback((panel: LocalPanel) => navigate({ panel }), [navigate])
  const openUnavailable = useCallback((feature: UnavailableFeatureId) => navigate({ panel: 'unavailable', feature }), [navigate])
  const openHall = useCallback((aspect: AspectKey, section?: HallSection) => navigate({ panel: 'hall', aspect, section }), [navigate])
  const openAspectSkillTree = useCallback((aspect: AspectKey) => { setJourneyMounted(true); setNavigationRequest(previous => ({ id: (previous?.id ?? 0) + 1, sessionEpoch: session.sessionEpoch, aspect, destination: 'skill-tree' })); navigate({ panel: 'journey' }) }, [navigate, session.sessionEpoch])
  const currentNavigationRequest = navigationRequest?.sessionEpoch === session.sessionEpoch ? navigationRequest : null
  return <UiPreferencesContext.Provider value={preferences}><ConfirmProvider><main className={styles.app} data-runtime="lite" data-session-epoch={session.sessionEpoch} data-route={route.panel}>
    <LiteHeader panel={route.panel} canGoBack={historyIndex > 0 || route.panel !== 'home'} onBack={goBack} onNavigate={openPanel} onUnavailable={openUnavailable} />
    {route.panel !== 'settings' && <p className={styles.persistence} role="status" data-global-session-status={session.status}>{session.status === 'durable' ? 'Локальные данные сохранены' : session.status === 'conflict' ? 'Обнаружен конфликт локальных данных. Откройте настройки.' : 'Изменения хранятся только в памяти. Откройте настройки.'}</p>}
    {route.panel === 'home' && <section className={styles.panel} aria-label="Главная"><LiteHome journey={session.data.journey} diaryCount={session.data.diary.length} fallbackNotice={route.fallbackNotice} onNavigate={openPanel} onUnavailable={openUnavailable} /></section>}
    <section className={`${styles.panel} ${styles.journeyPanel}`} hidden={route.panel !== 'journey'} aria-label="Путешествие"><Suspense fallback={<p>Загрузка путешествия…</p>}>{journeyMounted && <JourneyView key={session.sessionEpoch} journey={session.data.journey} onJourneyChange={session.updateJourney} scores={session.data.scores as Record<string, number>} onScoresChange={session.updateScores} diary={session.data.diary} onDiaryChange={session.updateDiary} t={ru} user={null} isAdmin={false} backendEnabled={false} contentAccess={LITE_CONTENT_ACCESS} navigationRequest={currentNavigationRequest} />}</Suspense></section>
    <section className={styles.panel} hidden={route.panel !== 'aspects'} aria-label="Аспекты"><Suspense fallback={<p>Загрузка аспектов…</p>}>{aspectsMounted && <AspectsView key={session.sessionEpoch} selectedAspect={route.panel === 'aspects' ? route.selectedAspect ?? null : null} onAspectSelect={aspect => navigate({ panel: 'aspects', selectedAspect: aspect })} scores={session.data.scores} diary={session.data.diary} onDiaryChange={session.updateDiary} journey={session.data.journey} user={null} isAdmin={false} backendEnabled={false} contentAccess={LITE_CONTENT_ACCESS} onGoToSiSurveys={() => openAspectSkillTree('Si')} onGoToFeSurveys={() => openAspectSkillTree('Fe')} onGoToNeSurveys={() => openAspectSkillTree('Ne')} onGoToNiSurveys={() => openAspectSkillTree('Ni')} onGoToTeSurveys={() => openAspectSkillTree('Te')} onGoToTiSurveys={() => openAspectSkillTree('Ti')} onGoToFiSurveys={() => openAspectSkillTree('Fi')} onGoToSeSurveys={() => openAspectSkillTree('Se')} onEnterHall={openHall} />}</Suspense></section>
    <section className={styles.panel} hidden={route.panel !== 'catalog'} aria-label="Каталог"><Suspense fallback={<p>Загрузка каталога…</p>}>{catalogMounted && <CatalogView journey={session.data.journey} scores={session.data.scores} diary={session.data.diary} onDiaryChange={session.updateDiary} />}</Suspense></section>
    <section className={styles.panel} hidden={route.panel !== 'diary'} aria-label="Дневник"><Suspense fallback={<p>Загрузка дневника…</p>}>{diaryMounted && <DiaryView key={session.sessionEpoch} diary={session.data.diary} onDiaryChange={session.updateDiary} t={ru} user={null} />}</Suspense></section>
    {route.panel === 'settings' && <section className={styles.settingsPanel} aria-label="Настройки"><LiteSettings session={session} onUnavailable={openUnavailable} /></section>}
    {route.panel === 'hall' && <section className={styles.panel} aria-label="Холл аспекта"><LiteHallView aspect={route.aspect} initialSection={route.section} onBack={goBack} onUnavailable={openUnavailable} /></section>}
    {route.panel === 'unavailable' && <section className={styles.panel} aria-label="Недоступная функция"><UnavailableFeature feature={route.feature} onBack={goBack} onHome={() => openPanel('home')} /></section>}
  </main></ConfirmProvider></UiPreferencesContext.Provider>
}
export function mountLiteApp(): void { const rootEl = document.getElementById('root'); if (!rootEl) throw new Error('Root element #root not found in index.html'); createRoot(rootEl).render(<StrictMode><LiteApp /></StrictMode>) }
