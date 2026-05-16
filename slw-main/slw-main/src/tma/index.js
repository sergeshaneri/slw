/**
 * Telegram Mini App — runtime-детект и bootstrap.
 *
 * Вне Telegram window.Telegram отсутствует, isTMA === false, всё остальное
 * приложение работает как обычный веб без изменений.
 *
 * Внутри Telegram WebView:
 *   1. SDK подложен через <script> в index.html — window.Telegram.WebApp есть.
 *   2. initData содержит подписанные данные о юзере + auth_date.
 *   3. bootstrapTMA():
 *      • валидирует наличие initData (длина > 0)
 *      • POST /api/auth/telegram-webapp { init_data } → JWT
 *      • кладёт JWT в localStorage['slw_token']
 *      • вызывает WebApp.ready() и expand()
 *   4. useAuth дальше работает как обычно — токен есть, fetchMe() проходит.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export const tma = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

export const isTMA = !!(tma && tma.initData && tma.initData.length > 0)

/**
 * Стартовый параметр из t.me/<bot>/<app>?startapp=XYZ.
 * Используется как замена web-deeplink ?u=<id>.
 */
export function getStartParam() {
  return tma?.initDataUnsafe?.start_param || null
}

/**
 * Кладёт SDK в готовое состояние и обменивает initData на JWT.
 * Возвращает токен (или null если не TMA или ошибка).
 *
 * Идемпотентна: если токен в localStorage уже есть, повторно не дёргает бэк.
 * Это важно для UX — открыл, закрыл, снова открыл → не ждём сетевой round-trip.
 */
export async function bootstrapTMA() {
  if (!isTMA) return null

  // SDK-стандартные сигналы Telegram: «UI готов» + «развернуть на весь экран».
  try {
    tma.ready()
    tma.expand()
    // disableVerticalSwipes доступно с Bot API 7.7 — gracefully skip на старых.
    tma.disableVerticalSwipes?.()
  } catch (e) {
    console.warn('TMA SDK init warning:', e)
  }

  // Если токен уже сохранён — useAuth подхватит его сам. Не дёргаем бэк зря.
  const existing = localStorage.getItem('slw_token')
  if (existing) return existing

  try {
    const res = await fetch(`${API_BASE}/api/auth/telegram-webapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: tma.initData }),
    })
    if (!res.ok) {
      console.error('TMA auth failed:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    if (data?.token) {
      localStorage.setItem('slw_token', data.token)
      return data.token
    }
    return null
  } catch (e) {
    console.error('TMA bootstrap error:', e)
    return null
  }
}
