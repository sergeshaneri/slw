/**
 * Реферальная система — клиент.
 *
 * При первом входе по ссылке `?ref=XXX` (или `?r=XXX`) код парсится из URL,
 * сохраняется в localStorage и URL чистится через replaceState. Дальше код
 * прокидывается в `register`/`telegramWebApp` body — бэк привязывает
 * `referrer_id` к новому юзеру и выдаёт +50 стардаст приветственного бонуса
 * + +25 стардаст приглашающему.
 *
 * Если у юзера уже есть токен (зашёл повторно) — `?ref=` игнорируется.
 */

const STORAGE_KEY = 'slw_pending_ref'

/**
 * Вызвать один раз при загрузке приложения (до auth-flow). Парсит `?ref=` /
 * `?r=` из текущего URL, сохраняет в LS, чистит URL.
 */
export function captureReferralFromURL(): void {
  try {
    if (typeof window === 'undefined') return
    // Если юзер уже залогинен — игнорируем, чтобы не подменять его историю.
    if (localStorage.getItem('slw_token')) return

    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref') || params.get('r')
    if (!ref) return

    // Сохраняем код в LS — он переживёт переходы по страницам.
    localStorage.setItem(STORAGE_KEY, ref.slice(0, 32))

    // Чистим URL чтобы код не висел в адресной строке.
    const url = new URL(window.location.href)
    url.searchParams.delete('ref')
    url.searchParams.delete('r')
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* private mode / SSR — игнорируем */
  }
}

/** Получить сохранённый код (или null если нет). */
export function getPendingReferralCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Очистить сохранённый код (после успешной регистрации/привязки). */
export function clearPendingReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Построить ссылку-приглашение для шаринга. Берёт текущий origin+pathname
 *  плюс `?ref=CODE`. На gh-pages выглядит как `https://sergeshaneri.github.io/slw/?ref=abc123`. */
export function buildReferralUrl(code: string): string {
  try {
    const base = `${window.location.origin}${window.location.pathname}`
    const url = new URL(base)
    url.searchParams.set('ref', code)
    return url.toString()
  } catch {
    return `?ref=${code}`
  }
}
