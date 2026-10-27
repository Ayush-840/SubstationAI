import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  ApiError,
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

/** 'ok' = signed in; 'mfa' = a second factor is waiting (see completeMfa). */
type LoginResult = 'ok' | 'mfa'
/** 'verify' = registration succeeded but the e-mail link must be clicked first. */
type RegisterResult = 'ok' | 'mfa' | 'verify'

interface AuthCtx {
  user: User | null
  /** a login/register/MFA request is in flight */
  loading: boolean
  /** restoring a saved session after a page load (cold starts can take a while) */
  booting: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  register: (name: string, email: string, password: string) => Promise<RegisterResult>
  /** Submit the TOTP/recovery code for the pending mfa_token. */
  completeMfa: (code: string) => Promise<void>
  /** true while a login is waiting for its second factor */
  mfaPending: boolean
  /** Abandon the pending MFA challenge (back to the sign-in form). */
  cancelMfa: () => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

interface TokenPair {
  access_token: string
  refresh_token?: string | null
}

type LoginResponse = TokenPair & { mfa_required?: boolean; mfa_token?: string }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hasSavedSession = Boolean(getRefreshToken())
  // A stored profile without a refresh token is a leftover from an old build.
  const [user, setUser] = useState<User | null>(hasSavedSession ? (getStoredUser() as User | null) : null)
  const [loading, setLoading] = useState(false)
  const [booting, setBooting] = useState(hasSavedSession)
  const [mfaToken, setMfaToken] = useState<string | null>(null)

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

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setLoading(true)
    try {
      const res = await api.post<LoginResponse>('/api/auth/login', { email, password })
      if (res?.mfa_required && res.mfa_token) {
        // Second factor needed: no tokens yet — park the challenge and let the
        // caller show the code form. Drop any previous session on purpose.
        setSession(null)
        setMfaToken(res.mfa_token)
        return 'mfa'
      }
      setSession(res)
      const me = await api.get<User>('/api/auth/me')
      setStoredUser(me)
      setUser(me)
      return 'ok'
    } catch (err) {
      setSession(null)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const completeMfa = useCallback(
    async (code: string) => {
      if (!mfaToken) throw new Error('No code is waiting — sign in again.')
      setLoading(true)
      try {
        const tokens = await api.post<TokenPair>('/api/auth/mfa/verify', { mfa_token: mfaToken, code })
        setSession(tokens)
        const me = await api.get<User>('/api/auth/me')
        setStoredUser(me)
        setUser(me)
        setMfaToken(null) // success — the challenge is consumed
        // On failure the mfaToken is kept so the user can retry or switch
        // to a recovery code.
      } finally {
        setLoading(false)
      }
    },
    [mfaToken],
  )

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<RegisterResult> => {
      setLoading(true)
      try {
        await api.post('/api/auth/register', { name, email, password })
      } finally {
        setLoading(false)
      }
      try {
        return await login(email, password)
      } catch (err) {
        // Verification required: registration itself succeeded.
        if (err instanceof ApiError && err.status === 403 && err.message === 'email_not_verified') {
          return 'verify'
        }
        throw err
      }
    },
    [login],
  )

  const cancelMfa = useCallback(() => setMfaToken(null), [])

  const logout = useCallback(() => {
    void logoutRemote() // captures both tokens synchronously before the first await
    setSession(null)
    setStoredUser(null)
    setUser(null)
    setMfaToken(null)
  }, [])

  const value: AuthCtx = {
    user,
    loading,
    booting,
    login,
    register,
    completeMfa,
    mfaPending: mfaToken !== null,
    cancelMfa,
    logout,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
