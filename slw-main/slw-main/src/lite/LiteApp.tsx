import { lazy, StrictMode, Suspense, useCallback, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { AspectKey } from '@/types/aspect'
import { ru } from '@/locales/ru'
import { ConfirmProvider } from '@/components/Confirm/ConfirmProvider'
import { UiPreferencesContext, type UiPreferencesContextValue } from '@/hooks/useSendKeyMode'
import { LiteSettings } from './LiteSettings'
import { useLiteSession } from './useLiteSession'
import { LITE_CONTENT_ACCESS } from './contentAccess'
import type { JourneyNavigationRequest } from '@/components/JourneyView/JourneyView'
import styles from './LiteApp.module.css'

const JourneyView = lazy(() => import('@/components/JourneyView/JourneyView'))
const AspectsView = lazy(() => import('@/components/AspectsView/AspectsView'))
const DiaryView = lazy(() => import('@/components/DiaryView/DiaryView'))
const CatalogView = lazy(() => import('./CatalogView').then(module => ({ default: module.CatalogView })))

type Panel = 'journey' | 'aspects' | 'catalog' | 'diary' | 'settings'

export function LiteApp() {
  const session = useLiteSession()
  const [panel, setPanel] = useState<Panel>('settings')
  const [journeyMounted, setJourneyMounted] = useState(false)
  const [aspectsMounted, setAspectsMounted] = useState(false)
  const [catalogMounted, setCatalogMounted] = useState(false)
  const [diaryMounted, setDiaryMounted] = useState(false)
  const [selectedAspect, setSelectedAspect] = useState<AspectKey | null>(null)
  const [navigationRequest, setNavigationRequest] = useState<JourneyNavigationRequest | null>(null)

  const preferences = useMemo<UiPreferencesContextValue>(() => ({
    sendKeyMode: session.data.preferences.sendKeyMode,
    hintsSeen: session.data.preferences.hintsSeen,
    setSendKeyMode: (sendKeyMode) => session.updatePreferences((current) => ({ ...current, sendKeyMode })),
    markHintSeen: (id) => session.updatePreferences((current) => ({
      ...current,
      hintsSeen: { ...current.hintsSeen, [id]: true },
    })),
  }), [session.data.preferences, session.updatePreferences])

  const openPanel = (next: Panel) => {
    if (next === 'journey') setJourneyMounted(true)
    if (next === 'aspects') setAspectsMounted(true)
    if (next === 'catalog') setCatalogMounted(true)
    if (next === 'diary') setDiaryMounted(true)
    setPanel(next)
  }

  const openAspectSkillTree = useCallback((aspect: AspectKey) => {
    setJourneyMounted(true)
    setNavigationRequest(previous => ({
      id: (previous?.id ?? 0) + 1,
      sessionEpoch: session.sessionEpoch,
      aspect,
      destination: 'skill-tree',
    }))
    setPanel('journey')
  }, [session.sessionEpoch])

  const currentNavigationRequest = navigationRequest?.sessionEpoch === session.sessionEpoch
    ? navigationRequest
    : null

  return (
    <UiPreferencesContext.Provider value={preferences}>
      <ConfirmProvider>
        <main className={styles.app} data-runtime="lite" data-session-epoch={session.sessionEpoch}>
          <header className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Локальная временная версия</p>
              <h1 className={styles.title}>Соционика — Колесо Баланса</h1>
            </div>
            <nav className={styles.nav} aria-label="Разделы локальной версии">
              <button type="button" aria-pressed={panel === 'journey'} onClick={() => openPanel('journey')}>Путешествие</button>
              <button type="button" aria-pressed={panel === 'aspects'} onClick={() => openPanel('aspects')}>Аспекты</button>
              <button type="button" aria-pressed={panel === 'catalog'} onClick={() => openPanel('catalog')}>Каталог</button>
              <button type="button" aria-pressed={panel === 'diary'} onClick={() => openPanel('diary')}>Дневник</button>
              <button type="button" aria-pressed={panel === 'settings'} onClick={() => openPanel('settings')}>Настройки</button>
            </nav>
          </header>

          {panel !== 'settings' && (
            <p className={styles.persistence} role="status" data-global-session-status={session.status}>
              {session.status === 'durable'
                ? 'Локальные данные сохранены'
                : session.status === 'conflict'
                  ? 'Обнаружен конфликт локальных данных. Откройте настройки.'
                  : 'Изменения хранятся только в памяти. Откройте настройки.'}
            </p>
          )}

          <section className={`${styles.panel} ${styles.journeyPanel}`} hidden={panel !== 'journey'} aria-label="Путешествие">
            <Suspense fallback={<p>Загрузка путешествия…</p>}>
            {journeyMounted && (
              <JourneyView
                key={session.sessionEpoch}
                journey={session.data.journey}
                onJourneyChange={session.updateJourney}
                scores={session.data.scores as Record<string, number>}
                onScoresChange={session.updateScores}
                diary={session.data.diary}
                onDiaryChange={session.updateDiary}
                t={ru}
                user={null}
                isAdmin={false}
                backendEnabled={false}
                contentAccess={LITE_CONTENT_ACCESS}
                navigationRequest={currentNavigationRequest}
              />
            )}
            </Suspense>
          </section>

          <section className={styles.panel} hidden={panel !== 'aspects'} aria-label="Аспекты">
            <Suspense fallback={<p>Загрузка аспектов…</p>}>
            {aspectsMounted && (
              <AspectsView
                key={session.sessionEpoch}
                selectedAspect={selectedAspect}
                onAspectSelect={setSelectedAspect}
                scores={session.data.scores}
                diary={session.data.diary}
                onDiaryChange={session.updateDiary}
                journey={session.data.journey}
                user={null}
                isAdmin={false}
                backendEnabled={false}
                contentAccess={LITE_CONTENT_ACCESS}
                onGoToSiSurveys={() => openAspectSkillTree('Si')}
                onGoToFeSurveys={() => openAspectSkillTree('Fe')}
                onGoToNeSurveys={() => openAspectSkillTree('Ne')}
                onGoToNiSurveys={() => openAspectSkillTree('Ni')}
                onGoToTeSurveys={() => openAspectSkillTree('Te')}
                onGoToTiSurveys={() => openAspectSkillTree('Ti')}
                onGoToFiSurveys={() => openAspectSkillTree('Fi')}
                onGoToSeSurveys={() => openAspectSkillTree('Se')}
              />
            )}
            </Suspense>
          </section>

          <section className={styles.panel} hidden={panel !== 'catalog'} aria-label="Каталог">
            <Suspense fallback={<p>Загрузка каталога…</p>}>
            {catalogMounted && (
              <CatalogView
                journey={session.data.journey}
                scores={session.data.scores}
                diary={session.data.diary}
                onDiaryChange={session.updateDiary}
              />
            )}
            </Suspense>
          </section>

          <section className={styles.panel} hidden={panel !== 'diary'} aria-label="Дневник">
            <Suspense fallback={<p>Загрузка дневника…</p>}>
            {diaryMounted && (
              <DiaryView
                key={session.sessionEpoch}
                diary={session.data.diary}
                onDiaryChange={session.updateDiary}
                t={ru}
                user={null}
              />
            )}
            </Suspense>
          </section>

          {panel === 'settings' && (
            <section className={styles.settingsPanel} aria-label="Настройки">
              <LiteSettings session={session} />
            </section>
          )}
        </main>
      </ConfirmProvider>
    </UiPreferencesContext.Provider>
  )
}

export function mountLiteApp(): void {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Root element #root not found in index.html')
  createRoot(rootEl).render(
    <StrictMode>
      <LiteApp />
    </StrictMode>,
  )
}
