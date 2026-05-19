/**
 * API client for the SLW backend.
 * Base URL is read from VITE_API_URL env var (set in .env.local).
 * Token is stored in localStorage under 'slw_token'.
 *
 * Aspect-key translation
 * ──────────────────────
 * Frontend использует латинские ключи аспектов (Si/Se/Ti/Te/Fi/Fe/Ni/Ne).
 * Backend и БД продолжают использовать кириллицу (БС/ЧС/БЛ/ЧЛ/БЭ/ЧЭ/БИ/ЧИ).
 * Трансляция происходит на этой границе:
 *   • исходящие данные (path-параметры с аспектом, body.aspect) — Lat→Cyr;
 *   • входящие данные (response) — Cyr→Lat через translateAspectsInResponse.
 * journey-blob (state.journey.{currentAspect, aspects}) — НЕ трогаем,
 * там миграцию делает JourneyView.migrateState.
 */

import type { paths } from '@/types/api'
import type { AspectKey, CyrillicAspectKey } from '@/types/aspect'

// Helper aliases for the per-endpoint response/body extraction. Most SLW
// backend routes ship without an explicit response_model, so OpenAPI gives
// us `{ [key: string]: unknown }` here — the path-helper preserves that
// shape and will auto-tighten once the backend adds schemas.
// NOTE(ts): pending backend response_model rollout — the helper type will
// auto-tighten once OpenAPI ships explicit schemas for these routes.
type JsonOk<P extends keyof paths, M extends keyof paths[P]> =
  paths[P][M] extends { responses: { 200: { content: { 'application/json': infer R } } } } ? R : unknown

// Convenience aliases for hot endpoints.
type LoginResp = JsonOk<'/api/auth/login', 'post'>
type RegisterResp = JsonOk<'/api/auth/register', 'post'>
type TelegramAuthResp = JsonOk<'/api/auth/telegram', 'post'>
type MeResp = JsonOk<'/api/auth/me', 'get'>

// Backend uses Cyrillic aspect keys, frontend uses Latin. The mapping table
// is the canonical source of truth — both directions derive from it.
const CYR_TO_LAT: Record<CyrillicAspectKey, AspectKey> = {
  'БС': 'Si', 'ЧС': 'Se', 'БЛ': 'Ti', 'ЧЛ': 'Te',
  'БЭ': 'Fi', 'ЧЭ': 'Fe', 'БИ': 'Ni', 'ЧИ': 'Ne',
}
const LAT_TO_CYR: Record<AspectKey, CyrillicAspectKey> = Object.fromEntries(
  Object.entries(CYR_TO_LAT).map(([k, v]) => [v, k])
) as Record<AspectKey, CyrillicAspectKey>
const CYR_KEYS = new Set<string>(Object.keys(CYR_TO_LAT))
const LAT_KEYS = new Set<string>(Object.values(CYR_TO_LAT))

// Перевод одиночного значения. Если строка не распознана — возвращаем как есть.
function latToCyr(s: string): string {
  return (typeof s === 'string' && (LAT_TO_CYR as Record<string, string>)[s]) ? (LAT_TO_CYR as Record<string, string>)[s] : s
}
function cyrToLat(s: string): string {
  return (typeof s === 'string' && (CYR_TO_LAT as Record<string, string>)[s]) ? (CYR_TO_LAT as Record<string, string>)[s] : s
}

// Поля, в которых лежит одиночный код аспекта. Если значение — кир.
// аспект-код, переводим в лат.
const ASPECT_VALUE_FIELDS = new Set<string>(['aspect', 'currentAspect', 'focus_aspect'])

// Эвристика: ключи объекта — карта по аспектам? Все ключи должны быть
// валидными кир./лат. кодами (и не пусто). Используется для нормализации
// scores-подобных мап.
function looksLikeAspectMap(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const keys = Object.keys(obj as Record<string, unknown>)
  if (keys.length === 0) return false
  for (const k of keys) {
    if (!CYR_KEYS.has(k) && !LAT_KEYS.has(k)) return false
  }
  return true
}

type TranslateOpts = { skipJourneyBlob?: boolean }

// Рекурсивно проходит по структуре, переводя:
//   • значения полей aspect/currentAspect/focus_aspect (Cyr→Lat);
//   • элементы массива focus_aspects (Cyr→Lat);
//   • ключи объектов, в которых ВСЕ ключи — аспект-коды (Cyr→Lat).
// Не трогает journey-blob: на границе передаём skipJourney=true.
// NOTE(ts): structural mutation, types preserved by contract.
// NOTE(ts): a fully accurate mapped type for this recursive key-renaming
// would require a recursive `KeysToLat<T>` mapped type — overkill for a
// single boundary helper; the generic passthrough contract is sound at
// runtime and exposed callers see the same shape they pass in.
function translateAspectsInResponse<T>(node: T, opts: TranslateOpts = {}): T {
  const { skipJourneyBlob = false } = opts
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) {
    return (node as unknown[]).map((item) => translateAspectsInResponse(item, opts)) as unknown as T
  }
  if (typeof node !== 'object') return node

  const nodeObj = node as Record<string, unknown>

  // Если это аспект-keyed map — переводим ключи, не лезем в значения
  // глубже (они могут быть числами или объектами без аспект-полей).
  if (looksLikeAspectMap(nodeObj)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(nodeObj)) {
      const newKey = (CYR_TO_LAT as Record<string, string>)[k] ?? k
      out[newKey] = translateAspectsInResponse(v, opts)
    }
    return out as unknown as T
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(nodeObj)) {
    if (skipJourneyBlob && k === 'journey') {
      // Сохраняем journey-blob как есть, миграция в JourneyView.
      out[k] = v
      continue
    }
    if (ASPECT_VALUE_FIELDS.has(k) && typeof v === 'string') {
      out[k] = cyrToLat(v)
    } else if (k === 'focus_aspects' && Array.isArray(v)) {
      out[k] = v.map((x) => (typeof x === 'string' ? cyrToLat(x) : x))
    } else {
      out[k] = translateAspectsInResponse(v, opts)
    }
  }
  return out as unknown as T
}

const BASE: string = import.meta.env.VITE_API_URL ?? ''

function getToken(): string | null {
  return localStorage.getItem('slw_token')
}

function setToken(token: string | null): void {
  if (token) localStorage.setItem('slw_token', token)
  else localStorage.removeItem('slw_token')
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// ApiError — Error augmented with HTTP status + raw detail payload from the
// backend. Detail can be an object (e.g. 409 state_conflict) — JS new Error()
// loses it, so we preserve it on the thrown instance.
export type ApiError = Error & {
  status: number
  detail: unknown
}

async function request(method: RequestMethod, path: string, body?: unknown): Promise<unknown> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: unknown }
    // Сохраняем оригинальный detail отдельно: бэк может вернуть структуру
    // (например 409 со state_conflict). new Error() принимает только строку,
    // поэтому объект-detail терялся бы при сериализации в message.
    const detail = err.detail
    const messageStr = typeof detail === 'string'
      ? detail
      : ((detail as { message?: string } | null | undefined)?.message || JSON.stringify(detail || {}))
    throw Object.assign(new Error(messageStr || 'Request failed'), {
      status: res.status,
      detail,
    }) as ApiError
  }

  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(email: string, password: string, name: string = ''): Promise<RegisterResp> {
  const data = await request('POST', '/api/auth/register', { email, password, name }) as RegisterResp & { token?: string }
  setToken(data.token ?? null)
  return data
}

export async function login(email: string, password: string): Promise<LoginResp> {
  const data = await request('POST', '/api/auth/login', { email, password }) as LoginResp & { token?: string }
  setToken(data.token ?? null)
  return data
}

export async function telegramAuth(tgUser: unknown): Promise<TelegramAuthResp> {
  const data = await request('POST', '/api/auth/telegram', tgUser) as TelegramAuthResp & { token?: string }
  setToken(data.token ?? null)
  return data
}

export async function linkTelegram(tgUser: unknown): Promise<unknown> {
  return request('POST', '/api/auth/link', tgUser)
}

// Добавить email+пароль к уже существующему TG-аккаунту.
// Требует токен (юзер должен быть залогинен через TG).
export async function addEmail(email: string, password: string): Promise<unknown> {
  return request('POST', '/api/auth/add-email', { email, password })
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function updateProfile({ display_name }: { display_name?: string | null }): Promise<unknown> {
  return request('PUT', '/api/auth/profile', { display_name })
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<unknown> {
  return request('POST', '/api/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}

// ── Password reset ────────────────────────────────────────────────────────────
//
// Запросить ссылку для смены пароля. Бэк всегда возвращает 200 (не палит
// существование email'а). Поле channel говорит куда улетела ссылка:
//   'email'    — отправлено через Resend на user.email
//   'telegram' — отправлено через бота (fallback если нет email-сервиса)
//   'none'     — email не найден ЛИБО все каналы недоступны (UI всё равно
//                показывает успех, иначе по реакции можно проверять email'ы)
export type PasswordResetChannel = 'email' | 'telegram' | 'none'

export async function requestPasswordReset(email: string): Promise<{ ok: true; channel: PasswordResetChannel }> {
  return request('POST', '/api/auth/password-reset/request', { email }) as Promise<{ ok: true; channel: PasswordResetChannel }>
}

// Установить новый пароль по токену из ссылки. На 4xx бросит ApiError
// с явным сообщением (просрочен, использован, юзер не найден).
export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ ok: true }> {
  return request('POST', '/api/auth/password-reset/confirm', {
    token,
    new_password: newPassword,
  }) as Promise<{ ok: true }>
}

// ── Support ───────────────────────────────────────────────────────────────────
//
// Написать в поддержку. Работает и для гостей (без токена) — backend сам
// разберётся. reply_contact — обязательное поле «как ответить» (email или TG).
export async function sendSupportMessage(message: string, replyContact: string): Promise<{ ok: true }> {
  return request('POST', '/api/support/contact', {
    message,
    reply_contact: replyContact,
  }) as Promise<{ ok: true }>
}

export async function removeEmail(): Promise<unknown> {
  return request('POST', '/api/auth/remove-email')
}

export async function updateNotifications(enabled: boolean): Promise<unknown> {
  return request('PATCH', '/api/auth/notifications', { enabled })
}

export async function unlinkTelegram(): Promise<unknown> {
  return request('POST', '/api/auth/unlink-telegram')
}

export async function deleteAccount(confirm: unknown): Promise<unknown> {
  return request('POST', '/api/auth/delete-account', { confirm })
}

export async function exportData(): Promise<unknown> {
  return request('GET', '/api/auth/export')
}

export async function fetchMe(): Promise<MeResp> {
  return await request('GET', '/api/auth/me') as MeResp
}

export function logout(): void {
  setToken(null)
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export async function fetchBotState(): Promise<unknown> {
  const data = await request('GET', '/api/sync/bot-state')
  // bs.current_aspect и bs.aspects[].aspect — из BD кириллица. Переводим.
  return translateAspectsInResponse(data)
}

// Bot → Web event-лог. На первом хите (если у юзера TG залинкован) бэк сам
// материализует прошлый прогресс из user_state. Возвращает { events, last_id }.
// Любая ошибка — на стороне фронта ловим через .catch и продолжаем без events.
export async function fetchEvents(sinceId: number = 0): Promise<unknown> {
  const data = await request('GET', `/api/events?since_id=${sinceId}`)
  // events[].aspect — кириллица в БД.
  return translateAspectsInResponse(data)
}

// Web → backend step-completed запись в journey_events (append-only).
// Идемпотентно по (user, aspect, short_id, level). Шлём после каждого
// зачёта completedScripts — это страховка от потери прогресса при
// CONTENT_VERSION-бампах или конфликтах PUT /api/state.
//
// aspect передаём в кириллице (бэкенд так хранит aspect-колонку).
export async function postStepCompleted(
  { aspect, level, short_id, step_id }: {
    aspect: AspectKey | string
    level: number
    short_id: string
    step_id?: string | null
  },
): Promise<unknown> {
  const cyrAspect = latToCyr(aspect)
  return request('POST', '/api/events/step-completed', {
    aspect: cyrAspect,
    level,
    short_id,
    step_id: step_id ?? null,
  })
}

// ── State ─────────────────────────────────────────────────────────────────────

export async function fetchState(): Promise<unknown> {
  const data = await request('GET', '/api/state')
  // journey-blob НЕ трогаем (миграция в JourneyView.migrateState).
  // updated_at — для optimistic locking (см. saveState).
  return translateAspectsInResponse(data, { skipJourneyBlob: true })
}

export async function saveState(
  { journey, history, expected_updated_at }: {
    journey?: unknown
    history?: unknown
    expected_updated_at?: string | null
  } = {},
): Promise<unknown> {
  // journey хранится как JSONB — бэкенд только пишет/читает as-is, без
  // фильтров по ключам. Поэтому отправляем латинские ключи как есть.
  //
  // Optimistic locking: если expected_updated_at передан и не совпадает
  // с серверным значением — бэк отвечает 409. Это значит, что пока фронт
  // держал state в памяти, кто-то ещё (другая вкладка, admin-операция,
  // impersonation) изменил БД. Чтобы не перетереть — клиент должен
  // перечитать state.
  return request('PUT', '/api/state', { journey, history, expected_updated_at })
}

// ── Scores ────────────────────────────────────────────────────────────────────

export async function fetchScores(): Promise<unknown> {
  const data = await request('GET', '/api/scores')
  // scores: { 'БС': 5, ... } → { 'Si': 5, ... }
  return translateAspectsInResponse(data)
}

export async function saveScores(scores: Record<string, number> | null | undefined): Promise<unknown> {
  // Бэкенд хранит web_scores с кириллической колонкой aspect.
  // Переводим ключи Lat→Cyr на отправку.
  const cyrScores: Record<string, number> = {}
  for (const [k, v] of Object.entries(scores ?? {})) {
    cyrScores[latToCyr(k)] = v
  }
  return request('PUT', '/api/scores', cyrScores)
}

// ── Diary ─────────────────────────────────────────────────────────────────────

export async function fetchDiary(): Promise<unknown> {
  const data = await request('GET', '/api/diary')
  return translateAspectsInResponse(data)
}

export async function postDiaryEntry(
  { text, aspect, source = 'web', extra }: {
    text: string
    aspect?: AspectKey | string | null
    source?: string
    extra?: unknown
  },
): Promise<unknown> {
  return request('POST', '/api/diary', {
    text, aspect: aspect != null ? latToCyr(aspect) : aspect, source, extra,
  })
}

// ── Profile / community ───────────────────────────────────────────────────────

export async function fetchMyProfile(): Promise<unknown> {
  const data = await request('GET', '/api/profile/me')
  return translateAspectsInResponse(data)
}

export async function updateMyProfile(patch: Record<string, unknown> | null | undefined): Promise<unknown> {
  // patch может содержать focus_aspects: ['Si', 'Fe', ...] — переводим в кир.
  const out: Record<string, unknown> = { ...(patch ?? {}) }
  if (Array.isArray(out.focus_aspects)) {
    out.focus_aspects = (out.focus_aspects as unknown[]).map((x) => typeof x === 'string' ? latToCyr(x) : x)
  }
  const data = await request('PUT', '/api/profile/me', out)
  return translateAspectsInResponse(data)
}

export async function fetchPublicProfile(userId: number | string): Promise<unknown> {
  const data = await request('GET', `/api/profile/${userId}`)
  return translateAspectsInResponse(data)
}

export async function fetchMyInsights(): Promise<unknown> {
  const data = await request('GET', '/api/profile/me/insights')
  return translateAspectsInResponse(data)
}

export async function postInsight(
  { aspect, kind = 'insight', text, isPublic = true }: {
    aspect: AspectKey | string
    kind?: string
    text: string
    isPublic?: boolean
  },
): Promise<unknown> {
  const data = await request('POST', '/api/profile/insights', {
    aspect: latToCyr(aspect), kind, text, is_public: isPublic,
  })
  return translateAspectsInResponse(data)
}

export async function deleteInsight(id: number | string): Promise<unknown> {
  return request('DELETE', `/api/profile/insights/${id}`)
}

export async function toggleInsightLike(id: number | string): Promise<unknown> {
  return request('POST', `/api/profile/insights/${id}/like`)
}

export async function fetchInsightReactions(id: number | string): Promise<unknown> {
  const data = await request('GET', `/api/profile/insights/${id}/reactions`)
  return translateAspectsInResponse(data)
}

// reaction: 'heart'|'thanks'|'aha'|'fire', опциональный коммент.
// Семантика toggle: тот же тип без коммента — снимает; передал коммент — обновит.
export async function reactToInsightWithComment(
  id: number | string,
  reaction: string,
  comment?: string,
): Promise<unknown> {
  const body: { reaction: string; comment?: string } = { reaction }
  if (comment !== undefined) body.comment = comment
  return request('POST', `/api/profile/insights/${id}/react`, body)
}

// ── Подписки ────────────────────────────────────────────────────────────────

export async function followUser(userId: number | string): Promise<unknown> {
  return request('POST', `/api/profile/${userId}/follow`)
}

export async function unfollowUser(userId: number | string): Promise<unknown> {
  return request('DELETE', `/api/profile/${userId}/follow`)
}

export async function fetchMySubscriptions(): Promise<unknown> {
  return request('GET', '/api/profile/me/subscriptions')
}

export async function fetchMyFollowers(): Promise<unknown> {
  return request('GET', '/api/profile/me/followers')
}

// ── Heatmap активности ──────────────────────────────────────────────────────

export async function fetchHeatmap(userId: number | string, days: number = 180): Promise<unknown> {
  return request('GET', `/api/profile/${userId}/heatmap?days=${days}`)
}

// ── Холл аспекта ────────────────────────────────────────────────────────────
// Path-параметр {aspect} в холл-роутах должен быть кириллицей (БД хранит так).

export async function fetchHallOverview(aspect: AspectKey | string): Promise<unknown> {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/overview`)
  return translateAspectsInResponse(data)
}

export async function fetchHallMessages(aspect: AspectKey | string, sinceId: number = 0, limit: number = 100): Promise<unknown> {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/messages?since_id=${sinceId}&limit=${limit}`)
  return translateAspectsInResponse(data)
}

export async function postHallMessage(aspect: AspectKey | string, text: string): Promise<unknown> {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/messages`, { text })
  return translateAspectsInResponse(data)
}

export async function deleteHallMessage(aspect: AspectKey | string, messageId: number | string): Promise<unknown> {
  return request('DELETE', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/messages/${messageId}`)
}

export async function fetchHallInsights(aspect: AspectKey | string, sort: string = 'new'): Promise<unknown> {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/insights?sort=${sort}`)
  return translateAspectsInResponse(data)
}

export async function fetchHallLeaderboard(aspect: AspectKey | string): Promise<unknown> {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/leaderboard`)
  return translateAspectsInResponse(data)
}

export async function fetchHallInspirations(aspect: AspectKey | string): Promise<unknown> {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/inspirations`)
  return translateAspectsInResponse(data)
}

// ── Уведомления ────────────────────────────────────────────────────────────

export async function fetchNotifications(limit: number = 30): Promise<unknown> {
  const data = await request('GET', `/api/notifications?limit=${limit}`)
  return translateAspectsInResponse(data)
}

export async function fetchUnreadCount(): Promise<unknown> {
  return request('GET', '/api/notifications/unread_count')
}

export async function markNotificationsRead(ids: Array<number | string> | null): Promise<unknown> {
  // ids = null → пометить все
  return request('POST', '/api/notifications/mark_read', { ids: ids ?? null })
}

// ── ЛС (только при mutual follow) ──────────────────────────────────────────

export async function fetchDMThreads(): Promise<unknown> {
  return request('GET', '/api/dm/threads')
}

export async function fetchDMThread(userId: number | string, limit: number = 100): Promise<unknown> {
  return request('GET', `/api/dm/threads/${userId}?limit=${limit}`)
}

export async function sendDM(userId: number | string, text: string): Promise<unknown> {
  return request('POST', `/api/dm/threads/${userId}`, { text })
}

export async function markDMThreadRead(userId: number | string): Promise<unknown> {
  return request('POST', `/api/dm/threads/${userId}/read`)
}

export async function fetchDMUnreadCount(): Promise<unknown> {
  return request('GET', '/api/dm/unread_count')
}

// ── Трекер привычек ───────────────────────────────────────────────────────
// {aspect} в path и body — кириллица для бэкенда.

export async function fetchHabitsToday(): Promise<unknown> {
  const data = await request('GET', '/api/habits/today')
  return translateAspectsInResponse(data)
}

export async function fetchMyHabits(): Promise<unknown> {
  const data = await request('GET', '/api/habits/me')
  return translateAspectsInResponse(data)
}

export async function chooseHabit(
  { aspect, title, exerciseId = null }: {
    aspect: AspectKey | string
    title: string
    exerciseId?: string | number | null
  },
): Promise<unknown> {
  const data = await request('POST', '/api/habits/choose', {
    aspect: latToCyr(aspect),
    title,
    exercise_id: exerciseId,
  })
  return translateAspectsInResponse(data)
}

export async function clearHabit(aspect: AspectKey | string): Promise<unknown> {
  return request('DELETE', `/api/habits/${encodeURIComponent(latToCyr(aspect))}`)
}

export async function fetchHabitsHistory(aspect: AspectKey | string, days: number = 90): Promise<unknown> {
  const data = await request('GET', `/api/habits/${encodeURIComponent(latToCyr(aspect))}/history?days=${days}`)
  return translateAspectsInResponse(data)
}

export async function tickHabit(aspect: AspectKey | string): Promise<unknown> {
  return request('POST', `/api/habits/${encodeURIComponent(latToCyr(aspect))}/tick`)
}

export async function untickHabit(aspect: AspectKey | string): Promise<unknown> {
  return request('DELETE', `/api/habits/${encodeURIComponent(latToCyr(aspect))}/tick`)
}

// ── Серверный стрик ──────────────────────────────────────────────────────

export async function fetchMyStreak(): Promise<unknown> {
  return request('GET', '/api/streak/me')
}

export async function activateShield(): Promise<unknown> {
  return request('POST', '/api/streak/shield', { pay_with_stardust: true })
}

// ── Q&A в холле ──────────────────────────────────────────────────────────

export async function fetchHallQuestions(aspect: AspectKey | string, limit: number = 30): Promise<unknown> {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions?limit=${limit}`)
  return translateAspectsInResponse(data)
}

export async function fetchHallQuestion(aspect: AspectKey | string, questionId: number | string): Promise<unknown> {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions/${questionId}`)
  return translateAspectsInResponse(data)
}

export async function postHallQuestion(aspect: AspectKey | string, text: string): Promise<unknown> {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions`, { text })
  return translateAspectsInResponse(data)
}

export async function postHallAnswer(aspect: AspectKey | string, questionId: number | string, text: string): Promise<unknown> {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions/${questionId}/answer`, { text })
  return translateAspectsInResponse(data)
}

export async function markBestAnswer(aspect: AspectKey | string, questionId: number | string, answerId: number | string): Promise<unknown> {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions/${questionId}/answers/${answerId}/best`)
  return translateAspectsInResponse(data)
}

// ── Закладки ─────────────────────────────────────────────────────────────

export async function fetchMyBookmarks(): Promise<unknown> {
  const data = await request('GET', '/api/bookmarks')
  return translateAspectsInResponse(data)
}

export async function bookmarkInsight(insightId: number | string): Promise<unknown> {
  return request('POST', `/api/bookmarks/insight/${insightId}`)
}

export async function unbookmarkInsight(insightId: number | string): Promise<unknown> {
  return request('DELETE', `/api/bookmarks/insight/${insightId}`)
}

// ── Поиск ────────────────────────────────────────────────────────────────

export async function searchAll(q: string, scope: string = 'all', limit: number = 20): Promise<unknown> {
  const url = `/api/search?q=${encodeURIComponent(q)}&scope=${scope}&limit=${limit}`
  const data = await request('GET', url)
  return translateAspectsInResponse(data)
}

// ── Дашборд ──────────────────────────────────────────────────────────────

export async function fetchDashboard(): Promise<unknown> {
  const data = await request('GET', '/api/dashboard')
  return translateAspectsInResponse(data)
}

// ── Импортированные структуры дневника ──────────────────────────────────

export async function fetchEmotions(minIntensity: number | null = null): Promise<unknown> {
  const q = minIntensity != null ? `?min_intensity=${minIntensity}` : ''
  return request('GET', `/api/diary/emotions${q}`)
}

export async function fetchTrainings(): Promise<unknown> {
  return request('GET', '/api/diary/trainings')
}

export async function fetchAnalyticsList(): Promise<unknown> {
  return request('GET', '/api/diary/analytics')
}

export async function fetchAnalyticsReport(reportId: number | string): Promise<unknown> {
  return request('GET', `/api/diary/analytics/${reportId}`)
}

export async function fetchDiaryTemplate(): Promise<unknown> {
  return request('GET', '/api/diary/template')
}

// URL для скачивания vault-архива (пользуется JWT через ?token=fragment).
// На самом деле для StreamingResponse используем fetch+blob — отдельная функция:
export async function downloadVaultZip(): Promise<void> {
  const token = getToken()
  if (!token) throw new Error('Не авторизован')
  const res = await fetch(`${BASE}/api/sync/vault/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Сервер ответил ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const today = new Date().toISOString().slice(0, 10)
  a.download = `slw-vault-${today}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function reactToInsight(id: number | string, reaction: string = 'heart'): Promise<unknown> {
  return request('POST', `/api/profile/insights/${id}/react`, { reaction })
}

export async function fetchLeaderboard(limit: number = 20): Promise<unknown> {
  const data = await request('GET', `/api/leaderboard?limit=${limit}`)
  return translateAspectsInResponse(data)
}

// ── Community: подписка на аспект ─────────────────────────────────────────────
// Бэк хранит aspect-ключи кириллицей (см. CLAUDE.md), фронт работает в латинице.
// translateAspectsInResponse возвращает массив строк уже на латинице.
// 404 на старом бэке — graceful empty (фронт работает без новых эндпоинтов).

export async function fetchSubscribedAspects(): Promise<AspectKey[]> {
  try {
    const data = await request('GET', '/api/community/aspects-subscribed')
    const translated = translateAspectsInResponse(data) as
      | { aspects?: string[] }
      | string[]
      | null
      | undefined
    const list = Array.isArray(translated) ? translated : translated?.aspects ?? []
    return list as AspectKey[]
  } catch {
    return []
  }
}

export async function subscribeToAspect(aspect: AspectKey | string): Promise<unknown> {
  return request('POST', '/api/community/aspect-sub', { aspect: latToCyr(aspect) })
}

export async function unsubscribeFromAspect(aspect: AspectKey | string): Promise<unknown> {
  return request('DELETE', `/api/community/aspect-sub/${encodeURIComponent(latToCyr(aspect))}`)
}

// ── Community: лента подписок ────────────────────────────────────────────────

export async function fetchCommunityFeed(offset: number = 0, limit: number = 30): Promise<unknown[]> {
  try {
    const data = await request('GET', `/api/community/feed?offset=${offset}&limit=${limit}`)
    const translated = translateAspectsInResponse(data) as
      | { items?: unknown[] }
      | unknown[]
      | null
      | undefined
    const items = Array.isArray(translated) ? translated : translated?.items ?? []
    return items as unknown[]
  } catch {
    return []
  }
}

// ── Community: trending в холле (Фаза 5) ─────────────────────────────────────

export async function fetchHallTrending(aspect: AspectKey | string): Promise<{
  insights: unknown[]
  qa: unknown[]
}> {
  try {
    const data = await request('GET', `/api/community/trending/${encodeURIComponent(latToCyr(aspect))}`)
    const obj = (data ?? {}) as { insights?: unknown[]; qa?: unknown[] }
    return { insights: obj.insights ?? [], qa: obj.qa ?? [] }
  } catch {
    return { insights: [], qa: [] }
  }
}

// ── Community: комментарии под инсайтами (Фаза 4) ────────────────────────────

export async function fetchInsightComments(insightId: number | string): Promise<unknown[]> {
  try {
    const data = await request('GET', `/api/insights/${insightId}/comments`)
    const arr = Array.isArray(data) ? data : (data as { items?: unknown[] } | null)?.items ?? []
    return arr as unknown[]
  } catch {
    return []
  }
}

export async function postInsightComment(
  insightId: number | string,
  text: string,
): Promise<unknown> {
  return request('POST', `/api/insights/${insightId}/comments`, { text })
}

export async function deleteInsightComment(
  insightId: number | string,
  commentId: number | string,
): Promise<unknown> {
  return request('DELETE', `/api/insights/${insightId}/comments/${commentId}`)
}

// ── Coach (AI summon) ─────────────────────────────────────────────────────────

export async function fetchCoachQuota(): Promise<unknown> {
  return request('GET', '/api/coach/quota')
}

export async function summonCoach(
  { prompt, focusAspect = null, payWithStardust = false }: {
    prompt: string
    focusAspect?: AspectKey | string | null
    payWithStardust?: boolean
  },
): Promise<unknown> {
  const data = await request('POST', '/api/coach/summon', {
    prompt,
    focus_aspect: focusAspect ? latToCyr(focusAspect) : null,
    pay_with_stardust: payWithStardust,
  })
  return translateAspectsInResponse(data)
}

export async function fetchCoachHistory(limit: number = 20): Promise<unknown> {
  const data = await request('GET', `/api/coach/history?limit=${limit}`)
  return translateAspectsInResponse(data)
}

// ── Onboarding (3-layer) ─────────────────────────────────────────────────
// Layer 1 — Quick Tour: ставит web_users.onboarding_done.
// Layer 2 — Hints: ключ → hints_seen[key] = true.
// Layer 3 — DiscoverMore: ключ → hints_seen['discover-' + key] = true.
// Чистые флаговые апдейты, без аспект-перевода.

export async function markOnboardingDone(): Promise<unknown> {
  return request('POST', '/api/onboarding/complete')
}

export async function markHintSeen(key: string): Promise<unknown> {
  return request('POST', '/api/onboarding/hint', { key })
}

export async function dismissDiscoverCard(key: string): Promise<unknown> {
  return request('POST', '/api/onboarding/dismiss-card', { key })
}

// ── Admin ─────────────────────────────────────────────────────────────────────
// Гейтятся по is_admin на бэке. Используются в AdminView.

export async function adminListUsers(
  { limit = 50, offset = 0, search = '', sort = 'recent' }: {
    limit?: number
    offset?: number
    search?: string
    sort?: string
  } = {},
): Promise<unknown> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), sort })
  if (search) params.set('search', search)
  return request('GET', `/api/admin/users?${params}`)
}

export async function adminUserDiagnostic(
  { user_id, email, tg_username, telegram_id, display_name }: {
    user_id?: number | string | null
    email?: string
    tg_username?: string
    telegram_id?: number | string | null
    display_name?: string
  },
): Promise<unknown> {
  const params = new URLSearchParams()
  if (user_id != null) params.set('user_id', String(user_id))
  if (email) params.set('email', email)
  if (tg_username) params.set('tg_username', tg_username)
  if (telegram_id != null) params.set('telegram_id', String(telegram_id))
  if (display_name) params.set('display_name', display_name)
  return request('GET', `/api/admin/user-diagnostic?${params}`)
}

export async function adminRestoreFromDiary(
  { user_id, telegram_id, email, dry_run = true, bump_levels = true }: {
    user_id?: number | string | null
    telegram_id?: number | string | null
    email?: string | null
    dry_run?: boolean
    bump_levels?: boolean
  },
): Promise<unknown> {
  return request('POST', '/api/admin/restore-from-diary', {
    user_id, telegram_id, email, dry_run, bump_levels,
  })
}

export async function adminPromote(
  { user_id, telegram_id, email, is_admin }: {
    user_id?: number | string | null
    telegram_id?: number | string | null
    email?: string | null
    is_admin?: boolean
  },
): Promise<unknown> {
  return request('POST', '/api/admin/promote', {
    user_id, telegram_id, email, is_admin,
  })
}

export async function adminImpersonate(
  { user_id, telegram_id, email }: {
    user_id?: number | string | null
    telegram_id?: number | string | null
    email?: string | null
  },
): Promise<unknown> {
  return request('POST', '/api/admin/impersonate', {
    user_id, telegram_id, email,
  })
}

export async function adminRollbackRestore(
  { user_id, telegram_id, email }: {
    user_id?: number | string | null
    telegram_id?: number | string | null
    email?: string | null
  },
): Promise<unknown> {
  return request('POST', '/api/admin/rollback-restore', {
    user_id, telegram_id, email,
  })
}

export async function adminStats(): Promise<unknown> {
  return request('GET', '/api/admin/stats')
}

export async function adminBulkRestore(
  { threshold = 10, dry_run = true, bump_levels = true, limit = 100 }: {
    threshold?: number
    dry_run?: boolean
    bump_levels?: boolean
    limit?: number
  } = {},
): Promise<unknown> {
  return request('POST', '/api/admin/bulk-restore', {
    threshold, dry_run, bump_levels, limit,
  })
}

export async function adminUserDiary(
  userId: number | string,
  { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<unknown> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return request('GET', `/api/admin/user/${userId}/diary?${params}`)
}

export async function adminPatchUserState(userId: number | string, journey: unknown): Promise<unknown> {
  return request('PATCH', `/api/admin/user/${userId}/state`, { journey })
}

export async function adminListInsights(
  { limit = 50, offset = 0, aspect = null, only_public = false }: {
    limit?: number
    offset?: number
    aspect?: string | null
    only_public?: boolean
  } = {},
): Promise<unknown> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    only_public: String(only_public),
  })
  if (aspect) params.set('aspect', aspect)
  return request('GET', `/api/admin/insights?${params}`)
}

export async function adminDeleteInsight(insightId: number | string): Promise<unknown> {
  return request('DELETE', `/api/admin/insight/${insightId}`)
}

export async function adminPatchInsight(insightId: number | string, patch: unknown): Promise<unknown> {
  return request('PATCH', `/api/admin/insight/${insightId}`, patch)
}

// ── Admin: TG notifications ───────────────────────────────────────────────

export async function adminNotifyGetConfig(): Promise<unknown> {
  return request('GET', '/api/admin/notify/config')
}

export async function adminNotifyPatchConfig(patch: unknown): Promise<unknown> {
  return request('PATCH', '/api/admin/notify/config', patch)
}

export async function adminNotifyRunNow(): Promise<unknown> {
  return request('POST', '/api/admin/notify/run-now', {})
}

export async function adminNotifyTest(): Promise<unknown> {
  return request('POST', '/api/admin/notify/test', {})
}

export async function adminNotifyBroadcast(
  { text, target = 'tg_linked' }: { text: string; target?: string },
): Promise<unknown> {
  return request('POST', '/api/admin/notify/broadcast', { text, target })
}

export async function adminNotifyGetLog({ limit = 100 }: { limit?: number } = {}): Promise<unknown> {
  return request('GET', `/api/admin/notify/log?limit=${limit}`)
}

export async function adminNotifyClearCooldowns(
  { user_id = null }: { user_id?: number | string | null } = {},
): Promise<unknown> {
  return request('POST', '/api/admin/notify/clear-cooldowns', { user_id })
}

export async function adminNotifySendToUser(
  { user_id, text }: { user_id: number | string; text: string },
): Promise<unknown> {
  return request('POST', '/api/admin/notify/send-to-user', { user_id, text })
}

export async function adminSetAspectPosition(
  userId: number | string,
  { aspect, currentLevel, currentScriptId, currentScriptIndex, resetMessages, addToCompleted }: {
    aspect: AspectKey | string
    currentLevel?: number
    currentScriptId?: string | null
    currentScriptIndex?: number
    resetMessages?: boolean
    addToCompleted?: boolean
  },
): Promise<unknown> {
  return request('POST', `/api/admin/user/${userId}/set-aspect-position`, {
    aspect, currentLevel, currentScriptId, currentScriptIndex, resetMessages, addToCompleted,
  })
}

export async function adminAutoPositionFromDiary(userId: number | string): Promise<unknown> {
  return request('POST', `/api/admin/user/${userId}/auto-position-from-diary`)
}

export async function adminResetAspectPosition(userId: number | string, aspect: AspectKey | string): Promise<unknown> {
  return request('POST', `/api/admin/user/${userId}/reset-aspect-position`, { aspect })
}

export async function adminNormalizeCounters(userId: number | string): Promise<unknown> {
  return request('POST', `/api/admin/user/${userId}/normalize-counters`)
}

export { getToken, setToken }
