/**
 * useAuth — manages authentication state for the app.
 *
 * On mount: tries to fetch /api/auth/me with the stored token.
 * If it succeeds → user is logged in.
 * If it fails (401 / no token) → user is null → show AuthModal.
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchMe, logout as apiLogout, getToken, setToken } from '../api/client'

export function useAuth() {
  const [user, setUser] = useState(null)        // null = not loaded yet | false = unauthenticated
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  const onAuthSuccess = useCallback((userData) => {
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUser(false)
  }, [])

  return { user, loading, onAuthSuccess, logout }
}
