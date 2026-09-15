import styles from './UnavailableFeature.module.css'

export type UnavailableFeatureId =
  | 'account' | 'admin' | 'analytics-reports' | 'coach' | 'community'
  | 'diary-emotions' | 'diary-trainings' | 'follows' | 'habit-tracker'
  | 'hall-chat' | 'hall-publications' | 'hall-qa' | 'leaderboard' | 'likes'
  | 'messages' | 'notifications' | 'profile' | 'server-dashboard'
  | 'server-search' | 'streak-protection' | 'support' | 'vault-sync' | 'word-bonus'

const FEATURES: Record<UnavailableFeatureId, { title: string; description: string }> = {
  account: { title: 'Аккаунт и авторизация', description: 'Вход, регистрация, восстановление пароля и привязка аккаунта требуют серверной части.' },
  admin: { title: 'Администрирование', description: 'Административные данные и действия доступны только в серверной версии. Локальный флаг администратора их не включает.' },
  'analytics-reports': { title: 'Аналитические отчёты', description: 'Сводные отчёты рассчитываются по серверным данным и не формируются локальной версией.' },
  coach: { title: 'ИИ-коуч', description: 'Ответы коуча формируются сервером. Локальная версия не отправляет запрос и не списывает звёздную пыль.' },
  community: { title: 'Сообщество', description: 'Лента, подписки, реакции и публичные публикации требуют серверной части.' },
  'diary-emotions': { title: 'Эмоции дневника', description: 'Серверный журнал эмоций недоступен. Обычные локальные записи дневника сохраняются в этом браузере.' },
  'diary-trainings': { title: 'Тренировки дневника', description: 'Серверные тренировки и их история недоступны. Локальные задания путешествия продолжают работать.' },
  follows: { title: 'Подписки', description: 'Список подписок и лента обновляются на сервере.' },
  'habit-tracker': { title: 'Трекер привычек', description: 'Серверный трекер привычек и синхронизация отметок недоступны. Локальные задания путешествия сохраняются отдельно.' },
  'hall-chat': { title: 'Чат холла', description: 'Переписка холла хранится на сервере. Статическая коллекция аспекта доступна локально.' },
  'hall-publications': { title: 'Публикации холла', description: 'Пользовательские публикации холла находятся на сервере. Статическая коллекция аспекта доступна локально.' },
  'hall-qa': { title: 'Вопросы и ответы холла', description: 'Пользовательские вопросы и ответы находятся на сервере. Статическая коллекция аспекта доступна локально.' },
  leaderboard: { title: 'Рейтинг и достижения', description: 'Рейтинг, серверные достижения, серии и бонусы рассчитываются сервером.' },
  likes: { title: 'Реакции и отметки', description: 'Реакции к пользовательским материалам записываются на сервере.' },
  messages: { title: 'Личные сообщения', description: 'Список диалогов и переписка хранятся на сервере.' },
  notifications: { title: 'Уведомления', description: 'Серверные и Telegram-уведомления не запрашиваются локальной версией.' },
  profile: { title: 'Публичный профиль', description: 'Профили, подписки и их общие данные доступны только через сервер.' },
  'server-dashboard': { title: 'Серверная главная', description: 'Серверные показатели, рейтинг и достижения заменены локальной главной с данными этого браузера.' },
  'server-search': { title: 'Поиск по серверу', description: 'Поиск по пользователям и публикациям требует серверной базы. Учебные материалы доступны через локальный каталог.' },
  'streak-protection': { title: 'Защита серии', description: 'Защита серии проверяется и расходуется сервером. Локальная заглушка не меняет валюту и прогресс.' },
  support: { title: 'Обращение в поддержку', description: 'Форма отправки обращения требует серверной части. Локальная версия не сообщает об успешной отправке.' },
  'vault-sync': { title: 'Vault Sync', description: 'Синхронизация хранилища требует серверной части. Локальный экспорт остаётся доступен в настройках.' },
  'word-bonus': { title: 'Бонус слова дня', description: 'Серверный бонус слова дня не начисляется локальной версией.' },
}

export function UnavailableFeature({ feature, onBack, onHome }: { feature: UnavailableFeatureId; onBack: () => void; onHome: () => void }) {
  const copy = FEATURES[feature]
  return <article className={styles.stub} data-unavailable-feature={feature}>
    <p className={styles.label}>Локальная граница</p>
    <h2>Временно недоступно в локальной версии</h2>
    <h3>{copy.title}</h3>
    <p>{copy.description}</p>
    <p className={styles.boundary}>Локально работают учебные материалы, путешествие, анкеты, дневник и сохранение в этом браузере. Для загрузки статических файлов требуется доступ к хостингу.</p>
    <div className={styles.actions}>
      <button type="button" onClick={onBack}>Вернуться назад</button>
      <button type="button" onClick={onHome}>К локальным материалам</button>
    </div>
  </article>
}
