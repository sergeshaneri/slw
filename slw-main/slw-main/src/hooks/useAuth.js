/**
 * useAuth — manages authentication state for the app.
 *
 * On mount: tries to fetch /api/auth/me with the stored token.
 * If it succeeds → user is logged in.
 * If it fails (401 / no token) → user is null → show AuthModal.
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchMe, logout as apiLogout, getToken } from '../api/client'

export function useAuth() {
  const [user, setUser] = useState(null)        // null = not loaded yet | false = unauthenticated
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
