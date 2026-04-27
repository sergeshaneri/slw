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

// Общий event-лог bot↔web. Возвращает { events, last_id }.
// `sinceId` позволяет инкрементально подтягивать (пока используем 0 при каждой
// загрузке — событий немного, всё помещается).
export async function fetchEvents(sinceId = 0) {
  return request('GET', `/api/events?since_id=${sinceId}`)
}

// Web → Bot: фронт пишет событие, бот его подтянет в cmd_go/cmd_resume и
// сдвинет current_step_id вперёд. Body: { type, aspect, level, short_id }.
export async function postEvent(event) {
  return request('POST', '/api/events', event)
}

// Одноразовый бэкфилл прошлого TG-прогресса в journey_events.
// Идемпотентен — удаляет старые `step_completed` перед заливкой.
// Нужен, потому что Railway-CLI команды залочены через railway.toml.
export async function backfillEvents() {
  return request('POST', '/api/events/backfill')
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

export { getToken, setToken }
