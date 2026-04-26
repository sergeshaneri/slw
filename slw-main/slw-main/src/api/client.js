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

export async function fetchMe() {
  return request('GET', '/api/auth/me')
}

export function logout() {
  setToken(null)
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

export { getToken }
