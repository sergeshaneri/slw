import type { JourneyState } from '@/types/journey'
import type { LocalPanel } from './LiteApp'
import type { UnavailableFeatureId } from './UnavailableFeature'
import styles from './LiteHome.module.css'

export function LiteHome({ journey, diaryCount, fallbackNotice, onNavigate, onUnavailable }: {
  journey: JourneyState
  diaryCount: number
  fallbackNotice?: string
  onNavigate: (panel: LocalPanel) => void
  onUnavailable: (feature: UnavailableFeatureId) => void
}) {
  const completed = Object.values(journey.aspects).reduce((sum, aspect) => sum + (aspect?.completedScripts.length ?? 0), 0)
  return <div className={styles.home}>
    {fallbackNotice && <p className={styles.notice} role="status">{fallbackNotice}</p>}
    <header className={styles.hero}>
      <div>
        <h1>Соционика: Колесо Баланса</h1>
        <p>Материалы, упражнения и личный прогресс доступны без регистрации. Данные сохраняются в этом браузере.</p>
      </div>
      <button type="button" className={styles.primary} onClick={() => onNavigate('journey')}>Продолжить путешествие</button>
    </header>
    <section className={styles.localLinks} aria-label="Основные разделы">
      <button type="button" onClick={() => onNavigate('catalog')}><strong>Каталог</strong><span>Теория, навыки и вопросы по восьми аспектам</span></button>
      <button type="button" onClick={() => onNavigate('aspects')}><strong>Аспекты</strong><span>Теория, оценки и тематические подборки</span></button>
      <button type="button" onClick={() => onNavigate('diary')}><strong>Дневник</strong><span>Записей в этом браузере: {diaryCount}</span></button>
      <button type="button" onClick={() => onNavigate('settings')}><strong>Настройки</strong><span>Экспорт, импорт, сброс и режим отправки текста</span></button>
    </section>
    <dl className={styles.summary} aria-label="Прогресс">
      <div><dt>Пройдено шагов</dt><dd>{completed}</dd></div>
      <div><dt>XP</dt><dd>{journey.xp}</dd></div>
      <div><dt>Звёздная пыль</dt><dd>{journey.stardust}</dd></div>
    </dl>
    <details className={styles.guide}><summary>О сохранении данных</summary><p>Путешествие, ответы и дневник сохраняются в этом браузере. Для открытия приложения требуется доступ к сайту.</p></details>
    <section className={styles.serverLinks} aria-labelledby="server-features-title">
      <h2 id="server-features-title">Дополнительные возможности</h2>
      <p>Эти разделы требуют аккаунта и подключения.</p>
      <div>{(['community', 'coach', 'messages', 'profile', 'leaderboard', 'notifications'] as const).map(feature => <button key={feature} type="button" onClick={() => onUnavailable(feature)}>{({ community: 'Сообщество', coach: 'ИИ-коуч', messages: 'Сообщения', profile: 'Профиль', leaderboard: 'Рейтинг и достижения', notifications: 'Уведомления' })[feature]}</button>)}</div>
    </section>
  </div>
}
