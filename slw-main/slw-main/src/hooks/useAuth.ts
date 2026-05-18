/**
 * useAuth — manages authentication state for the app.
 *
 * On mount: tries to fetch /api/auth/me with the stored token.
 * If it succeeds → user is logged in.
 * If it fails (401 / no token) → user is null → show AuthModal.
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchMe, logout as apiLogout, getToken, setToken, telegramAuth } from '../api/client'
import type { paths } from '@/types/api'

// /api/auth/me — response shape is currently { [key: string]: unknown } in
// OpenAPI (backend has no response_model). The path-helper carries that as
// User; once backend tightens schemas, types tighten automatically.
// NOTE(ts): pending backend response_model for /api/auth/me. The canonical
// `User` shape in `@/types/user` re-declares the load-bearing fields; this
// path-derived alias auto-tightens when the backend ships an explicit schema.
type User = paths['/api/auth/me']['get']['responses']['200']['content']['application/json']

// `false` is the unauthenticated sentinel preserved from the .js source —
// distinguishes "not loaded yet" (null) from "definitely no user" (false).
type UserState = User | null | false

type UseAuthReturn = {
  user: UserState
  loading: boolean
  onAuthSuccess: (userData: User) => void
  logout: () => void
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserState>(null)        // null = not loaded yet | false = unauthenticated
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    // Fallback for Telegram widget-mode callback: result arrives as
    // #tgAuthResult=base64(JSON) in the hash. Decode and exchange for a JWT
    // via /api/auth/telegram. Normal flow uses ?token= (handled below).
    const hashMatch = window.location.hash.match(/tgAuthResult=([^&]+)/)
    if (hashMatch) {
      try {
        const tgUser = JSON.parse(atob(decodeURIComponent(hashMatch[1])))
        window.history.replaceState({}, '', window.location.pathname + window.location.search)
        telegramAuth(tgUser)
          .then(setUser)
          .catch(() => setUser(false))
          .finally(() => setLoading(false))
        return
      } catch { /* bad payload — fall through to normal flow */ }
    }

    // Handle Telegram redirect flow (mobile): ?token=JWT in URL
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    if (urlToken) {
      setToken(urlToken)
      window.history.replaceState({}, '', window.location.pathname)

      // If we're inside the popup that Telegram opened on desktop — notify
      // parent page and close the popup so parent reloads.
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.location.reload()
          window.close()
          return
        } catch { /* cross-origin guard — just fall through */ }
      }
    }

    if (!getToken()) {
      setUser(false)
      setLoading(false)
      return
    }
    fetchMe()
      .then(setUser)
      .catch(() => setUser(false))
      .finally(() => setLoading(false))
  }, [])

  const onAuthSuccess = useCallback((userData: User) => {
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUser(false)
  }, [])

  return { user, loading, onAuthSuccess, logout }
}
