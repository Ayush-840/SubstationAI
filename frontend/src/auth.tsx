import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  api,
  getRefreshToken,
  getStoredUser,
  logoutRemote,
  onSessionExpired,
  restoreSession,
  setSession,
  setStoredUser,
  warmUp,
} from './api/client'
import type { User } from './types'

interface AuthCtx {
  user: User | null
  /** a login/register request is in flight */
  loading: boolean
  /** restoring a saved session after a page load (cold starts can take a while) */
  booting: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

interface TokenPair {
  access_token: string
  refresh_token?: string | null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hasSavedSession = Boolean(getRefreshToken())
  // A stored profile without a refresh token is a leftover from an old build.
  const [user, setUser] = useState<User | null>(hasSavedSession ? (getStoredUser() as User | null) : null)
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(hasSavedSession)

  // Another part of the app (the API client) found the session is over.
  useEffect(() => onSessionExpired(() => setUser(null)), [])

  useEffect(() => {
    void warmUp() // wake a sleeping host while the user types
    if (!hasSavedSession) return
    let cancelled = false
    ;(async () => {
      const result = await restoreSession()
      if (cancelled) return
      if (result === 'ok') {
        try {
          const me = await api.get<User>('/api/auth/me')
          if (cancelled) return
          setStoredUser(me)
          setUser(me)
        } catch {
          /* keep the cached profile; the next request will retry */
        }
      } else if (result === 'invalid') {
        setSession(null)
        setStoredUser(null)
        setUser(null)
      }
      // 'unavailable' (offline / cold start): stay signed in with the cached profile
      setBooting(false)
    })()
    return () => {
      cancelled = true
    }
  }, [hasSavedSession])

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const tokens = await api.post<TokenPair>('/api/auth/login', { email, password })
      setSession(tokens)
      const me = await api.get<User>('/api/auth/me')
      setStoredUser(me)
      setUser(me)
    } catch (err) {
      setSession(null)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true)
      try {
        await api.post('/api/auth/register', { name, email, password })
      } finally {
        setLoading(false)
      }
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    void logoutRemote() // captures both tokens synchronously before the first await
    setSession(null)
    setStoredUser(null)
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, loading, booting, login, register, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
