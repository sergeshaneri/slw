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

const CYR_TO_LAT = {
  'БС': 'Si', 'ЧС': 'Se', 'БЛ': 'Ti', 'ЧЛ': 'Te',
  'БЭ': 'Fi', 'ЧЭ': 'Fe', 'БИ': 'Ni', 'ЧИ': 'Ne',
}
const LAT_TO_CYR = Object.fromEntries(
  Object.entries(CYR_TO_LAT).map(([k, v]) => [v, k])
)
const CYR_KEYS = new Set(Object.keys(CYR_TO_LAT))
const LAT_KEYS = new Set(Object.values(CYR_TO_LAT))

// Перевод одиночного значения. Если строка не распознана — возвращаем как есть.
function latToCyr(s) {
  return (typeof s === 'string' && LAT_TO_CYR[s]) ? LAT_TO_CYR[s] : s
}
function cyrToLat(s) {
  return (typeof s === 'string' && CYR_TO_LAT[s]) ? CYR_TO_LAT[s] : s
}

// Поля, в которых лежит одиночный код аспекта. Если значение — кир.
// аспект-код, переводим в лат.
const ASPECT_VALUE_FIELDS = new Set(['aspect', 'currentAspect', 'focus_aspect'])

// Эвристика: ключи объекта — карта по аспектам? Все ключи должны быть
// валидными кир./лат. кодами (и не пусто). Используется для нормализации
// scores-подобных мап.
function looksLikeAspectMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const keys = Object.keys(obj)
  if (keys.length === 0) return false
  for (const k of keys) {
    if (!CYR_KEYS.has(k) && !LAT_KEYS.has(k)) return false
  }
  return true
}

// Рекурсивно проходит по структуре, переводя:
//   • значения полей aspect/currentAspect/focus_aspect (Cyr→Lat);
//   • элементы массива focus_aspects (Cyr→Lat);
//   • ключи объектов, в которых ВСЕ ключи — аспект-коды (Cyr→Lat).
// Не трогает journey-blob: на границе передаём skipJourney=true.
function translateAspectsInResponse(node, opts = {}) {
  const { skipJourneyBlob = false } = opts
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) {
    return node.map(item => translateAspectsInResponse(item, opts))
  }
  if (typeof node !== 'object') return node

  // Если это аспект-keyed map — переводим ключи, не лезем в значения
  // глубже (они могут быть числами или объектами без аспект-полей).
  if (looksLikeAspectMap(node)) {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      const newKey = CYR_TO_LAT[k] ?? k
      out[newKey] = translateAspectsInResponse(v, opts)
    }
    return out
  }

  const out = {}
  for (const [k, v] of Object.entries(node)) {
    if (skipJourneyBlob && k === 'journey') {
      // Сохраняем journey-blob как есть, миграция в JourneyView.
      out[k] = v
      continue
    }
    if (ASPECT_VALUE_FIELDS.has(k) && typeof v === 'string') {
      out[k] = cyrToLat(v)
    } else if (k === 'focus_aspects' && Array.isArray(v)) {
      out[k] = v.map(x => (typeof x === 'string' ? cyrToLat(x) : x))
    } else {
      out[k] = translateAspectsInResponse(v, opts)
    }
  }
  return out
}

const BASE = import.meta.env.VITE_API_URL ?? ''

function getToken() {
  return localStorage.getItem('slw_token')
}

function setToken(token) {
  if (token) localStorage.setItem('slw_token', token)
  else localStorage.removeItem('slw_token')
}

async function request(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw Object.assign(new Error(err.detail ?? 'Request failed'), { status: res.status })
  }

  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(email, password, name = '') {
  const data = await request('POST', '/api/auth/register', { email, password, name })
  setToken(data.token)
  return data
}

export async function login(email, password) {
  const data = await request('POST', '/api/auth/login', { email, password })
  setToken(data.token)
  return data
}

export async function telegramAuth(tgUser) {
  const data = await request('POST', '/api/auth/telegram', tgUser)
  setToken(data.token)
  return data
}

export async function linkTelegram(tgUser) {
  return request('POST', '/api/auth/link', tgUser)
}

// Добавить email+пароль к уже существующему TG-аккаунту.
// Требует токен (юзер должен быть залогинен через TG).
export async function addEmail(email, password) {
  return request('POST', '/api/auth/add-email', { email, password })
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function updateProfile({ display_name }) {
  return request('PUT', '/api/auth/profile', { display_name })
}

export async function changePassword(oldPassword, newPassword) {
  return request('POST', '/api/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}

export async function removeEmail() {
  return request('POST', '/api/auth/remove-email')
}

export async function unlinkTelegram() {
  return request('POST', '/api/auth/unlink-telegram')
}

export async function deleteAccount(confirm) {
  return request('POST', '/api/auth/delete-account', { confirm })
}

export async function exportData() {
  return request('GET', '/api/auth/export')
}

export async function fetchMe() {
  return request('GET', '/api/auth/me')
}

export function logout() {
  setToken(null)
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export async function fetchBotState() {
  const data = await request('GET', '/api/sync/bot-state')
  // bs.current_aspect и bs.aspects[].aspect — из BD кириллица. Переводим.
  return translateAspectsInResponse(data)
}

// Bot → Web event-лог. На первом хите (если у юзера TG залинкован) бэк сам
// материализует прошлый прогресс из user_state. Возвращает { events, last_id }.
// Любая ошибка — на стороне фронта ловим через .catch и продолжаем без events.
export async function fetchEvents(sinceId = 0) {
  const data = await request('GET', `/api/events?since_id=${sinceId}`)
  // events[].aspect — кириллица в БД.
  return translateAspectsInResponse(data)
}

// ── State ─────────────────────────────────────────────────────────────────────

export async function fetchState() {
  const data = await request('GET', '/api/state')
  // journey-blob НЕ трогаем (миграция в JourneyView.migrateState).
  // updated_at — для optimistic locking (см. saveState).
  return translateAspectsInResponse(data, { skipJourneyBlob: true })
}

export async function saveState({ journey, history, expected_updated_at } = {}) {
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

export async function fetchScores() {
  const data = await request('GET', '/api/scores')
  // scores: { 'БС': 5, ... } → { 'Si': 5, ... }
  return translateAspectsInResponse(data)
}

export async function saveScores(scores) {
  // Бэкенд хранит web_scores с кириллической колонкой aspect.
  // Переводим ключи Lat→Cyr на отправку.
  const cyrScores = {}
  for (const [k, v] of Object.entries(scores ?? {})) {
    cyrScores[latToCyr(k)] = v
  }
  return request('PUT', '/api/scores', cyrScores)
}

// ── Diary ─────────────────────────────────────────────────────────────────────

export async function fetchDiary() {
  const data = await request('GET', '/api/diary')
  return translateAspectsInResponse(data)
}

export async function postDiaryEntry({ text, aspect, source = 'web', extra }) {
  return request('POST', '/api/diary', {
    text, aspect: latToCyr(aspect), source, extra,
  })
}

// ── Profile / community ───────────────────────────────────────────────────────

export async function fetchMyProfile() {
  const data = await request('GET', '/api/profile/me')
  return translateAspectsInResponse(data)
}

export async function updateMyProfile(patch) {
  // patch может содержать focus_aspects: ['Si', 'Fe', ...] — переводим в кир.
  const out = { ...(patch ?? {}) }
  if (Array.isArray(out.focus_aspects)) {
    out.focus_aspects = out.focus_aspects.map(latToCyr)
  }
  const data = await request('PUT', '/api/profile/me', out)
  return translateAspectsInResponse(data)
}

export async function fetchPublicProfile(userId) {
  const data = await request('GET', `/api/profile/${userId}`)
  return translateAspectsInResponse(data)
}

export async function fetchMyInsights() {
  const data = await request('GET', '/api/profile/me/insights')
  return translateAspectsInResponse(data)
}

export async function postInsight({ aspect, kind = 'insight', text, isPublic = true }) {
  const data = await request('POST', '/api/profile/insights', {
    aspect: latToCyr(aspect), kind, text, is_public: isPublic,
  })
  return translateAspectsInResponse(data)
}

export async function deleteInsight(id) {
  return request('DELETE', `/api/profile/insights/${id}`)
}

export async function toggleInsightLike(id) {
  return request('POST', `/api/profile/insights/${id}/like`)
}

export async function fetchInsightReactions(id) {
  const data = await request('GET', `/api/profile/insights/${id}/reactions`)
  return translateAspectsInResponse(data)
}

// reaction: 'heart'|'thanks'|'aha'|'fire', опциональный коммент.
// Семантика toggle: тот же тип без коммента — снимает; передал коммент — обновит.
export async function reactToInsightWithComment(id, reaction, comment) {
  const body = { reaction }
  if (comment !== undefined) body.comment = comment
  return request('POST', `/api/profile/insights/${id}/react`, body)
}

// ── Подписки ────────────────────────────────────────────────────────────────

export async function followUser(userId) {
  return request('POST', `/api/profile/${userId}/follow`)
}

export async function unfollowUser(userId) {
  return request('DELETE', `/api/profile/${userId}/follow`)
}

export async function fetchMySubscriptions() {
  return request('GET', '/api/profile/me/subscriptions')
}

export async function fetchMyFollowers() {
  return request('GET', '/api/profile/me/followers')
}

// ── Heatmap активности ──────────────────────────────────────────────────────

export async function fetchHeatmap(userId, days = 180) {
  return request('GET', `/api/profile/${userId}/heatmap?days=${days}`)
}

// ── Холл аспекта ────────────────────────────────────────────────────────────
// Path-параметр {aspect} в холл-роутах должен быть кириллицей (БД хранит так).

export async function fetchHallOverview(aspect) {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/overview`)
  return translateAspectsInResponse(data)
}

export async function fetchHallMessages(aspect, sinceId = 0, limit = 100) {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/messages?since_id=${sinceId}&limit=${limit}`)
  return translateAspectsInResponse(data)
}

export async function postHallMessage(aspect, text) {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/messages`, { text })
  return translateAspectsInResponse(data)
}

export async function deleteHallMessage(aspect, messageId) {
  return request('DELETE', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/messages/${messageId}`)
}

export async function fetchHallInsights(aspect, sort = 'new') {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/insights?sort=${sort}`)
  return translateAspectsInResponse(data)
}

export async function fetchHallLeaderboard(aspect) {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/leaderboard`)
  return translateAspectsInResponse(data)
}

export async function fetchHallInspirations(aspect) {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/inspirations`)
  return translateAspectsInResponse(data)
}

// ── Уведомления ────────────────────────────────────────────────────────────

export async function fetchNotifications(limit = 30) {
  const data = await request('GET', `/api/notifications?limit=${limit}`)
  return translateAspectsInResponse(data)
}

export async function fetchUnreadCount() {
  return request('GET', '/api/notifications/unread_count')
}

export async function markNotificationsRead(ids) {
  // ids = null → пометить все
  return request('POST', '/api/notifications/mark_read', { ids: ids ?? null })
}

// ── ЛС (только при mutual follow) ──────────────────────────────────────────

export async function fetchDMThreads() {
  return request('GET', '/api/dm/threads')
}

export async function fetchDMThread(userId, limit = 100) {
  return request('GET', `/api/dm/threads/${userId}?limit=${limit}`)
}

export async function sendDM(userId, text) {
  return request('POST', `/api/dm/threads/${userId}`, { text })
}

export async function markDMThreadRead(userId) {
  return request('POST', `/api/dm/threads/${userId}/read`)
}

export async function fetchDMUnreadCount() {
  return request('GET', '/api/dm/unread_count')
}

// ── Трекер привычек ───────────────────────────────────────────────────────
// {aspect} в path и body — кириллица для бэкенда.

export async function fetchHabitsToday() {
  const data = await request('GET', '/api/habits/today')
  return translateAspectsInResponse(data)
}

export async function fetchMyHabits() {
  const data = await request('GET', '/api/habits/me')
  return translateAspectsInResponse(data)
}

export async function chooseHabit({ aspect, title, exerciseId = null }) {
  const data = await request('POST', '/api/habits/choose', {
    aspect: latToCyr(aspect),
    title,
    exercise_id: exerciseId,
  })
  return translateAspectsInResponse(data)
}

export async function clearHabit(aspect) {
  return request('DELETE', `/api/habits/${encodeURIComponent(latToCyr(aspect))}`)
}

export async function fetchHabitsHistory(aspect, days = 90) {
  const data = await request('GET', `/api/habits/${encodeURIComponent(latToCyr(aspect))}/history?days=${days}`)
  return translateAspectsInResponse(data)
}

export async function tickHabit(aspect) {
  return request('POST', `/api/habits/${encodeURIComponent(latToCyr(aspect))}/tick`)
}

export async function untickHabit(aspect) {
  return request('DELETE', `/api/habits/${encodeURIComponent(latToCyr(aspect))}/tick`)
}

// ── Серверный стрик ──────────────────────────────────────────────────────

export async function fetchMyStreak() {
  return request('GET', '/api/streak/me')
}

export async function activateShield() {
  return request('POST', '/api/streak/shield', { pay_with_stardust: true })
}

// ── Q&A в холле ──────────────────────────────────────────────────────────

export async function fetchHallQuestions(aspect, limit = 30) {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions?limit=${limit}`)
  return translateAspectsInResponse(data)
}

export async function fetchHallQuestion(aspect, questionId) {
  const data = await request('GET', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions/${questionId}`)
  return translateAspectsInResponse(data)
}

export async function postHallQuestion(aspect, text) {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions`, { text })
  return translateAspectsInResponse(data)
}

export async function postHallAnswer(aspect, questionId, text) {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions/${questionId}/answer`, { text })
  return translateAspectsInResponse(data)
}

export async function markBestAnswer(aspect, questionId, answerId) {
  const data = await request('POST', `/api/hall/${encodeURIComponent(latToCyr(aspect))}/questions/${questionId}/answers/${answerId}/best`)
  return translateAspectsInResponse(data)
}

// ── Закладки ─────────────────────────────────────────────────────────────

export async function fetchMyBookmarks() {
  const data = await request('GET', '/api/bookmarks')
  return translateAspectsInResponse(data)
}

export async function bookmarkInsight(insightId) {
  return request('POST', `/api/bookmarks/insight/${insightId}`)
}

export async function unbookmarkInsight(insightId) {
  return request('DELETE', `/api/bookmarks/insight/${insightId}`)
}

// ── Поиск ────────────────────────────────────────────────────────────────

export async function searchAll(q, scope = 'all', limit = 20) {
  const url = `/api/search?q=${encodeURIComponent(q)}&scope=${scope}&limit=${limit}`
  const data = await request('GET', url)
  return translateAspectsInResponse(data)
}

// ── Дашборд ──────────────────────────────────────────────────────────────

export async function fetchDashboard() {
  const data = await request('GET', '/api/dashboard')
  return translateAspectsInResponse(data)
}

// ── Импортированные структуры дневника ──────────────────────────────────

export async function fetchEmotions(minIntensity = null) {
  const q = minIntensity != null ? `?min_intensity=${minIntensity}` : ''
  return request('GET', `/api/diary/emotions${q}`)
}

export async function fetchTrainings() {
  return request('GET', '/api/diary/trainings')
}

export async function fetchAnalyticsList() {
  return request('GET', '/api/diary/analytics')
}

export async function fetchAnalyticsReport(reportId) {
  return request('GET', `/api/diary/analytics/${reportId}`)
}

export async function fetchDiaryTemplate() {
  return request('GET', '/api/diary/template')
}

// URL для скачивания vault-архива (пользуется JWT через ?token=fragment).
// На самом деле для StreamingResponse используем fetch+blob — отдельная функция:
export async function downloadVaultZip() {
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

export async function reactToInsight(id, reaction = 'heart') {
  return request('POST', `/api/profile/insights/${id}/react`, { reaction })
}

export async function fetchLeaderboard(limit = 20) {
  const data = await request('GET', `/api/leaderboard?limit=${limit}`)
  return translateAspectsInResponse(data)
}

// ── Coach (AI summon) ─────────────────────────────────────────────────────────

export async function fetchCoachQuota() {
  return request('GET', '/api/coach/quota')
}

export async function summonCoach({ prompt, focusAspect = null, payWithStardust = false }) {
  const data = await request('POST', '/api/coach/summon', {
    prompt,
    focus_aspect: focusAspect ? latToCyr(focusAspect) : null,
    pay_with_stardust: payWithStardust,
  })
  return translateAspectsInResponse(data)
}

export async function fetchCoachHistory(limit = 20) {
  const data = await request('GET', `/api/coach/history?limit=${limit}`)
  return translateAspectsInResponse(data)
}

// ── Onboarding (3-layer) ─────────────────────────────────────────────────
// Layer 1 — Quick Tour: ставит web_users.onboarding_done.
// Layer 2 — Hints: ключ → hints_seen[key] = true.
// Layer 3 — DiscoverMore: ключ → hints_seen['discover-' + key] = true.
// Чистые флаговые апдейты, без аспект-перевода.

export async function markOnboardingDone() {
  return request('POST', '/api/onboarding/complete')
}

export async function markHintSeen(key) {
  return request('POST', '/api/onboarding/hint', { key })
}

export async function dismissDiscoverCard(key) {
  return request('POST', '/api/onboarding/dismiss-card', { key })
}

// ── Admin ─────────────────────────────────────────────────────────────────────
// Гейтятся по is_admin на бэке. Используются в AdminView.

export async function adminListUsers({ limit = 50, offset = 0, search = '', sort = 'recent' } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), sort })
  if (search) params.set('search', search)
  return request('GET', `/api/admin/users?${params}`)
}

export async function adminUserDiagnostic({ user_id, email, tg_username, telegram_id, display_name }) {
  const params = new URLSearchParams()
  if (user_id != null) params.set('user_id', String(user_id))
  if (email) params.set('email', email)
  if (tg_username) params.set('tg_username', tg_username)
  if (telegram_id != null) params.set('telegram_id', String(telegram_id))
  if (display_name) params.set('display_name', display_name)
  return request('GET', `/api/admin/user-diagnostic?${params}`)
}

export async function adminRestoreFromDiary({ user_id, telegram_id, email, dry_run = true, bump_levels = true }) {
  return request('POST', '/api/admin/restore-from-diary', {
    user_id, telegram_id, email, dry_run, bump_levels,
  })
}

export async function adminPromote({ user_id, telegram_id, email, is_admin }) {
  return request('POST', '/api/admin/promote', {
    user_id, telegram_id, email, is_admin,
  })
}

export async function adminImpersonate({ user_id, telegram_id, email }) {
  return request('POST', '/api/admin/impersonate', {
    user_id, telegram_id, email,
  })
}

export async function adminRollbackRestore({ user_id, telegram_id, email }) {
  return request('POST', '/api/admin/rollback-restore', {
    user_id, telegram_id, email,
  })
}

export async function adminStats() {
  return request('GET', '/api/admin/stats')
}

export async function adminBulkRestore({ threshold = 10, dry_run = true, bump_levels = true, limit = 100 } = {}) {
  return request('POST', '/api/admin/bulk-restore', {
    threshold, dry_run, bump_levels, limit,
  })
}

export async function adminUserDiary(userId, { limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return request('GET', `/api/admin/user/${userId}/diary?${params}`)
}

export async function adminPatchUserState(userId, journey) {
  return request('PATCH', `/api/admin/user/${userId}/state`, { journey })
}

export async function adminListInsights({ limit = 50, offset = 0, aspect = null, only_public = false } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    only_public: String(only_public),
  })
  if (aspect) params.set('aspect', aspect)
  return request('GET', `/api/admin/insights?${params}`)
}

export async function adminDeleteInsight(insightId) {
  return request('DELETE', `/api/admin/insight/${insightId}`)
}

export async function adminPatchInsight(insightId, patch) {
  return request('PATCH', `/api/admin/insight/${insightId}`, patch)
}

export { getToken, setToken }
