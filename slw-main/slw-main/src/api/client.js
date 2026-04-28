/**
 * API client for the SLW backend.
 * Base URL is read from VITE_API_URL env var (set in .env.local).
 * Token is stored in localStorage under 'slw_token'.
 */

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
  return request('GET', '/api/sync/bot-state')
}

// Bot → Web event-лог. На первом хите (если у юзера TG залинкован) бэк сам
// материализует прошлый прогресс из user_state. Возвращает { events, last_id }.
// Любая ошибка — на стороне фронта ловим через .catch и продолжаем без events.
export async function fetchEvents(sinceId = 0) {
  return request('GET', `/api/events?since_id=${sinceId}`)
}

// ── State ─────────────────────────────────────────────────────────────────────

export async function fetchState() {
  return request('GET', '/api/state')
}

export async function saveState({ journey, history } = {}) {
  return request('PUT', '/api/state', { journey, history })
}

// ── Scores ────────────────────────────────────────────────────────────────────

export async function fetchScores() {
  return request('GET', '/api/scores')
}

export async function saveScores(scores) {
  return request('PUT', '/api/scores', scores)
}

// ── Diary ─────────────────────────────────────────────────────────────────────

export async function fetchDiary() {
  return request('GET', '/api/diary')
}

export async function postDiaryEntry({ text, aspect, source = 'web', extra }) {
  return request('POST', '/api/diary', { text, aspect, source, extra })
}

// ── Profile / community ───────────────────────────────────────────────────────

export async function fetchMyProfile() {
  return request('GET', '/api/profile/me')
}

export async function updateMyProfile(patch) {
  return request('PUT', '/api/profile/me', patch)
}

export async function fetchPublicProfile(userId) {
  return request('GET', `/api/profile/${userId}`)
}

export async function fetchMyInsights() {
  return request('GET', '/api/profile/me/insights')
}

export async function postInsight({ aspect, kind = 'insight', text, isPublic = true }) {
  return request('POST', '/api/profile/insights', {
    aspect, kind, text, is_public: isPublic,
  })
}

export async function deleteInsight(id) {
  return request('DELETE', `/api/profile/insights/${id}`)
}

export async function toggleInsightLike(id) {
  return request('POST', `/api/profile/insights/${id}/like`)
}

export async function fetchInsightReactions(id) {
  return request('GET', `/api/profile/insights/${id}/reactions`)
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

export async function fetchHallOverview(aspect) {
  return request('GET', `/api/hall/${encodeURIComponent(aspect)}/overview`)
}

export async function fetchHallMessages(aspect, sinceId = 0, limit = 100) {
  return request('GET', `/api/hall/${encodeURIComponent(aspect)}/messages?since_id=${sinceId}&limit=${limit}`)
}

export async function postHallMessage(aspect, text) {
  return request('POST', `/api/hall/${encodeURIComponent(aspect)}/messages`, { text })
}

export async function deleteHallMessage(aspect, messageId) {
  return request('DELETE', `/api/hall/${encodeURIComponent(aspect)}/messages/${messageId}`)
}

export async function fetchHallInsights(aspect, sort = 'new') {
  return request('GET', `/api/hall/${encodeURIComponent(aspect)}/insights?sort=${sort}`)
}

export async function fetchHallLeaderboard(aspect) {
  return request('GET', `/api/hall/${encodeURIComponent(aspect)}/leaderboard`)
}

export async function fetchHallInspirations(aspect) {
  return request('GET', `/api/hall/${encodeURIComponent(aspect)}/inspirations`)
}

// ── Уведомления ────────────────────────────────────────────────────────────

export async function fetchNotifications(limit = 30) {
  return request('GET', `/api/notifications?limit=${limit}`)
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

export async function fetchHabitsToday() {
  return request('GET', '/api/habits/today')
}

export async function fetchMyHabits() {
  return request('GET', '/api/habits/me')
}

export async function chooseHabit({ aspect, title, exerciseId = null }) {
  return request('POST', '/api/habits/choose', {
    aspect,
    title,
    exercise_id: exerciseId,
  })
}

export async function clearHabit(aspect) {
  return request('DELETE', `/api/habits/${encodeURIComponent(aspect)}`)
}

export async function fetchHabitsHistory(aspect, days = 90) {
  return request('GET', `/api/habits/${encodeURIComponent(aspect)}/history?days=${days}`)
}

export async function tickHabit(aspect) {
  return request('POST', `/api/habits/${encodeURIComponent(aspect)}/tick`)
}

export async function untickHabit(aspect) {
  return request('DELETE', `/api/habits/${encodeURIComponent(aspect)}/tick`)
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
  return request('GET', `/api/hall/${encodeURIComponent(aspect)}/questions?limit=${limit}`)
}

export async function fetchHallQuestion(aspect, questionId) {
  return request('GET', `/api/hall/${encodeURIComponent(aspect)}/questions/${questionId}`)
}

export async function postHallQuestion(aspect, text) {
  return request('POST', `/api/hall/${encodeURIComponent(aspect)}/questions`, { text })
}

export async function postHallAnswer(aspect, questionId, text) {
  return request('POST', `/api/hall/${encodeURIComponent(aspect)}/questions/${questionId}/answer`, { text })
}

export async function markBestAnswer(aspect, questionId, answerId) {
  return request('POST', `/api/hall/${encodeURIComponent(aspect)}/questions/${questionId}/answers/${answerId}/best`)
}

// ── Закладки ─────────────────────────────────────────────────────────────

export async function fetchMyBookmarks() {
  return request('GET', '/api/bookmarks')
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
  return request('GET', url)
}

// ── Дашборд ──────────────────────────────────────────────────────────────

export async function fetchDashboard() {
  return request('GET', '/api/dashboard')
}

export async function reactToInsight(id, reaction = 'heart') {
  return request('POST', `/api/profile/insights/${id}/react`, { reaction })
}

export async function fetchLeaderboard(limit = 20) {
  return request('GET', `/api/leaderboard?limit=${limit}`)
}

// ── Coach (AI summon) ─────────────────────────────────────────────────────────

export async function fetchCoachQuota() {
  return request('GET', '/api/coach/quota')
}

export async function summonCoach({ prompt, focusAspect = null, payWithStardust = false }) {
  return request('POST', '/api/coach/summon', {
    prompt,
    focus_aspect: focusAspect,
    pay_with_stardust: payWithStardust,
  })
}

export async function fetchCoachHistory(limit = 20) {
  return request('GET', `/api/coach/history?limit=${limit}`)
}

export { getToken, setToken }
