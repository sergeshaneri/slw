import styles from './UnavailableFeature.module.css'

export type UnavailableFeatureId =
  | 'account' | 'admin' | 'analytics-reports' | 'coach' | 'community'
  | 'diary-emotions' | 'diary-trainings' | 'follows' | 'habit-tracker'
  | 'hall-chat' | 'hall-publications' | 'hall-qa' | 'leaderboard' | 'likes'
  | 'messages' | 'notifications' | 'profile' | 'server-dashboard'
  | 'server-search' | 'streak-protection' | 'support' | 'vault-sync' | 'word-bonus'

const FEATURES: Record<UnavailableFeatureId, { title: string; description: string }> = {
  account: { title: 'Аккаунт и авторизация', description: 'Вход, регистрация и восстановление пароля требуют подключения.' },
  admin: { title: 'Администрирование', description: 'Административные данные и действия доступны после входа с правами администратора.' },
  'analytics-reports': { title: 'Аналитические отчёты', description: 'Сводные отчёты формируются после синхронизации данных с аккаунтом.' },
  coach: { title: 'ИИ-коуч', description: 'Ответы коуча требуют подключения. Запрос не отправлен, звёздная пыль не списана.' },
  community: { title: 'Сообщество', description: 'Лента, подписки, реакции и публичные публикации доступны после подключения.' },
  'diary-emotions': { title: 'Эмоции дневника', description: 'Журнал эмоций требует аккаунта. Обычные записи дневника сохраняются в этом браузере.' },
  'diary-trainings': { title: 'Тренировки дневника', description: 'История тренировок требует аккаунта. Задания путешествия продолжают работать.' },
  follows: { title: 'Подписки', description: 'Список подписок и его обновление требуют подключения.' },
  'habit-tracker': { title: 'Трекер привычек', description: 'Синхронизация отметок трекера требует аккаунта. Задания путешествия сохраняются отдельно.' },
  'hall-chat': { title: 'Чат холла', description: 'Переписка требует подключения. Подборка материалов аспекта доступна для чтения.' },
  'hall-publications': { title: 'Публикации холла', description: 'Публикации пользователей требуют подключения. Подборка материалов аспекта доступна для чтения.' },
  'hall-qa': { title: 'Вопросы и ответы холла', description: 'Пользовательские вопросы и ответы требуют подключения. Подборка материалов аспекта доступна для чтения.' },
  leaderboard: { title: 'Рейтинг и достижения', description: 'Общий рейтинг, достижения, серии и бонусы требуют аккаунта.' },
  likes: { title: 'Реакции и отметки', description: 'Реакции к публикациям требуют подключения.' },
  messages: { title: 'Личные сообщения', description: 'Список диалогов и переписка доступны после входа в аккаунт.' },
  notifications: { title: 'Уведомления', description: 'Уведомления приложения и Telegram доступны после подключения аккаунта.' },
  profile: { title: 'Публичный профиль', description: 'Профиль и подписки доступны после входа в аккаунт.' },
  'server-dashboard': { title: 'Главная аккаунта', description: 'Общие показатели, рейтинг и достижения доступны после входа в аккаунт.' },
  'server-search': { title: 'Поиск людей и публикаций', description: 'Поиск по пользователям и публикациям требует подключения. Учебные материалы доступны через каталог.' },
  'streak-protection': { title: 'Защита серии', description: 'Проверка и использование защиты серии требуют аккаунта. Валюта и прогресс не изменены.' },
  support: { title: 'Обращение в поддержку', description: 'Отправка обращения требует подключения. Сообщение не отправлено.' },
  'vault-sync': { title: 'Синхронизация данных', description: 'Синхронизация между устройствами требует аккаунта. Экспорт файла доступен в настройках.' },
  'word-bonus': { title: 'Бонус слова дня', description: 'Начисление бонуса слова дня требует аккаунта.' },
}

export function UnavailableFeature({ feature, onBack, onHome }: { feature: UnavailableFeatureId; onBack: () => void; onHome: () => void }) {
  const copy = FEATURES[feature]
  return <article className={styles.stub} data-unavailable-feature={feature}>
    <h2>Сейчас недоступно</h2>
    <h3>{copy.title}</h3>
    <p>{copy.description}</p>
    <p className={styles.boundary}>Без аккаунта доступны материалы, путешествие, анкеты, дневник и сохранение данных в этом браузере.</p>
    <div className={styles.actions}>
      <button type="button" onClick={onBack}>Вернуться назад</button>
      <button type="button" onClick={onHome}>К материалам</button>
    </div>
  </article>
}
