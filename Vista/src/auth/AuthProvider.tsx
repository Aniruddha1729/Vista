import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import type { AuthContextValue, User } from './AuthContext'
import { authenticatedFetch } from './authenticatedFetch'

function accessTokenExpiry(token: string) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { exp?: number }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(`/api/auth${path}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(result?.message || 'Could not complete that request.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  const clearSessionExpired = useCallback(() => setSessionExpired(false), [])

  useEffect(() => {
    function expireSession() {
      setAccessToken(null)
      setUser(null)
      setSessionExpired(true)
    }
    window.addEventListener('vista:session-expired', expireSession)
    return () => window.removeEventListener('vista:session-expired', expireSession)
  }, [])

  useEffect(() => {
    if (!accessToken) return
    const expiresAt = accessTokenExpiry(accessToken)
    if (!expiresAt) return
    const delay = Math.max(0, expiresAt - Date.now())
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('vista:session-expired')), delay)
    return () => window.clearTimeout(timer)
  }, [accessToken])

  const saveSession = useCallback(async (path: string, details?: unknown) => {
    const result = await authRequest<{ accessToken: string; user: User }>(path, details)
    setSessionExpired(false)
    setAccessToken(result.accessToken)
    setUser(result.user)
  }, [])

  useEffect(() => {
    authRequest<{ accessToken: string; user: User }>('/refresh', {})
      .then((session) => {
        setAccessToken(session.accessToken)
        setUser(session.user)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    loading,
    login: (credentials) => saveSession('/login', credentials),
    signup: async (details) => {
      const result = await authRequest<{ message: string }>('/signup', details)
      return result.message
    },
    logout: async () => {
      await authRequest('/logout', {})
      setUser(null)
      setAccessToken(null)
      setSessionExpired(false)
    },
    updateUser: setUser,
    sessionExpired,
    clearSessionExpired,
  }), [accessToken, clearSessionExpired, loading, saveSession, sessionExpired, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
