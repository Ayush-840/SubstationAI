import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, getStoredUser, setStoredUser } from './api/client'
import type { User } from './types'

type StoredUser = { id: number; name: string; email: string; role: string }

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null as any)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser() as User | null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Re-validate stored token on mount
    if (getToken()) {
      api.get<User>('/api/auth/me')
        .then(setUser)
        .catch(() => {
          setToken(null)
          setStoredUser(null)
          setUser(null)
        })
    }
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const res = await api.post<{ access_token: string }>('/api/auth/login', { email, password })
      setToken(res.access_token)
      const me = await api.get<StoredUser>('/api/auth/me')
      setStoredUser(me)
      setUser(me as User)
    } finally {
      setLoading(false)
    }
  }

  const register = async (name: string, email: string, password: string) => {
    setLoading(true)
    try {
      await api.post('/api/auth/register', { name, email, password })
      await login(email, password)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setToken(null)
    setStoredUser(null)
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
