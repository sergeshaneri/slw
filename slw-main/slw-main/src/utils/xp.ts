/**
 * Глобальный event-bus для XP-наград.
 *
 * Бэк возвращает `{ xp: {xp_delta, action_code, label, ...} }` в ответах
 * mutation-эндпоинтов. Любой компонент после успешного вызова дёргает
 * `emitXpEarned(response.xp)` — App.tsx слышит event и:
 *   1) пушит toast «+N XP за …»
 *   2) обновляет локальный journey.xp (чтобы XP-цифра в шапке/профиле
 *      освежилась без отдельного рефетча)
 *
 * Decoupled-подход: не нужно прокидывать setToasts/setJourney в каждый
 * лист дерева. Подходит для best-effort награды — если listener'а нет,
 * просто ничего не происходит.
 */

export type XpAward = {
  xp_delta?: number | null
  daily_cap_reached?: boolean
  action_code?: string
  label?: string
  new_xp?: number | null
}

const EVENT_NAME = 'slw:xp-earned'

/**
 * Эмитнуть XP-награду. Принимает объект из ответа бэка (или `null`/`undefined`
 * — тогда no-op). Игнорирует пустые delta (кап исчерпан, нет WebState и т.п.).
 */
export function emitXpEarned(xp: XpAward | null | undefined): void {
  if (!xp) return
  if (!xp.xp_delta || xp.xp_delta <= 0) return
  try {
    window.dispatchEvent(new CustomEvent<XpAward>(EVENT_NAME, { detail: xp }))
  } catch {
    // SSR / private-mode — игнорируем.
  }
}

/**
 * Подписаться на XP-события. Возвращает функцию отписки. Использует
 * useEffect-паттерн (но это не хук — это imperative API).
 */
export function onXpEarned(handler: (xp: XpAward) => void): () => void {
  const wrapped = (e: Event): void => {
    const ce = e as CustomEvent<XpAward>
    if (ce.detail) handler(ce.detail)
  }
  window.addEventListener(EVENT_NAME, wrapped)
  return () => window.removeEventListener(EVENT_NAME, wrapped)
}

// ── Стардаст-события ────────────────────────────────────────────────────────
// Аналог XP для стардаста. Используется, когда бэк начислил стардаст
// (refresh word-of-day, future rewards) — фронт эмитит, App.tsx ловит и:
//   1) пушит toast «+N ⭐ за …»
//   2) обновляет journey.stardust локально (чтобы цифра в шапке/кошельке
//      освежилась без отдельного фетча)

export type StardustAward = {
  amount: number
  label?: string
  source?: string
}

const STARDUST_EVENT_NAME = 'slw:stardust-earned'

export function emitStardustEarned(award: StardustAward | null | undefined): void {
  if (!award || !award.amount || award.amount <= 0) return
  try {
    window.dispatchEvent(new CustomEvent<StardustAward>(STARDUST_EVENT_NAME, { detail: award }))
  } catch {
    // SSR / private-mode — игнорируем.
  }
}

export function onStardustEarned(handler: (award: StardustAward) => void): () => void {
  const wrapped = (e: Event): void => {
    const ce = e as CustomEvent<StardustAward>
    if (ce.detail) handler(ce.detail)
  }
  window.addEventListener(STARDUST_EVENT_NAME, wrapped)
  return () => window.removeEventListener(STARDUST_EVENT_NAME, wrapped)
}
