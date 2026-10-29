/**
 * API client + session handling (see AUTH_TRD.md §6).
 *
 * - The access token lives in memory only (a page reload gets a new one through
 *   the refresh token), so an XSS bug cannot read a long-lived credential from
 *   localStorage.
 * - The refresh token is kept in localStorage because the SPA (Vercel) and the
 *   API (Render) are on different sites; an HttpOnly cookie would be blocked as
 *   third-party. It rotates on every use and a replayed one ends the session.
 * - A 401 triggers exactly one refresh (single-flight, shared by concurrent
 *   requests) and one retry. The user is only signed out when the server says
 *   the refresh token is invalid -- never because of a network error, a cold
 *   start or a 5xx.
 */

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const REFRESH_KEY = 'siq_refresh'
const USER_KEY = 'siq_user'

export type StoredUser = { id: number; name: string; email: string; role: string }

let accessToken: string | null = null

const safeGet = (k: string): string | null => {
  try { return localStorage.getItem(k) } catch { return null }
}
const safeSet = (k: string, v: string | null) => {
  try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* private mode */ }
}

export const getToken = () => accessToken
export const getRefreshToken = () => safeGet(REFRESH_KEY)

export function setSession(tokens: { access_token: string; refresh_token?: string | null } | null) {
  accessToken = tokens?.access_token ?? null
  if (!tokens) safeSet(REFRESH_KEY, null)
  else if (tokens.refresh_token) safeSet(REFRESH_KEY, tokens.refresh_token)
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = safeGet(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
export const setStoredUser = (u: StoredUser | null) => safeSet(USER_KEY, u ? JSON.stringify(u) : null)

// ── session-expiry notification (AuthProvider subscribes) ────────────────────
const expiryListeners = new Set<() => void>()
export function onSessionExpired(fn: () => void) {
  expiryListeners.add(fn)
  return () => { expiryListeners.delete(fn) }
}
function expireSession() {
  setSession(null)
  setStoredUser(null)
  expiryListeners.forEach((fn) => fn())
}

// ── errors ───────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number
  retryAfter?: number
  constructor(status: number, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** Turn any backend error body into one readable sentence. */
export function formatError(body: any, status: number, fallback: string): string {
  const d = body?.detail ?? body?.error?.message ?? body?.message
  if (typeof d === 'string' && d.trim()) return d
  if (Array.isArray(d) && d.length) {
    // FastAPI/Pydantic 422: [{loc:[..,'password'], msg:'Value error, ...'}]
    return d
      .map((e: any) => {
        const msg = String(e?.msg ?? '').replace(/^Value error,\s*/i, '')
        const field = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : ''
        return field && field !== 'body' ? `${field}: ${msg}` : msg
      })
      .filter(Boolean)
      .join('. ')
  }
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'The server had a problem. Please try again in a moment.'
  return fallback || `Request failed (${status})`
}

const NETWORK_MSG = "Can't reach the server. It may be waking up (this can take up to a minute) — check your connection and try again."

// ── refresh (single flight) ──────────────────────────────────────────────────
type RefreshResult = 'ok' | 'invalid' | 'unavailable'
let refreshing: Promise<RefreshResult> | null = null

async function doRefresh(): Promise<RefreshResult> {
  const refresh_token = getRefreshToken()
  if (!refresh_token) return 'invalid'
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    })
  } catch {
    return 'unavailable' // offline / cold start: keep the session
  }
  if (res.ok) {
    setSession(await res.json())
    return 'ok'
  }
  if (res.status === 401 || res.status === 403) return 'invalid'
  return 'unavailable' // 5xx, 429, ...
}

export function refreshSession(): Promise<RefreshResult> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null })
  return refreshing
}

/** Restore a session after a page load. 'ok' => accessToken is set. */
export async function restoreSession(): Promise<RefreshResult> {
  if (accessToken) return 'ok'
  return refreshSession()
}

// ── fetch with auth + one retry ──────────────────────────────────────────────
// Paths that run before (or instead of) a session: a 401 here means the
// request itself was rejected, not that the access token expired — never
// attempt a refresh for these.
const AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/password/forgot',
  '/api/auth/password/reset',
  '/api/auth/mfa/verify',
]

async function authedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, NETWORK_MSG)
  }
  if (res.status === 401 && retry && !AUTH_PATHS.includes(path)) {
    const r = await refreshSession()
    if (r === 'ok') return authedFetch(path, init, false)
    if (r === 'invalid') expireSession()
    // 'unavailable': surface the 401 without signing the user out
  }
  return res
}

async function errorFrom(res: Response): Promise<ApiError> {
  let body: any = null
  try { body = await res.json() } catch { /* not json */ }
  const ra = Number(res.headers.get('Retry-After')) || undefined
  return new ApiError(res.status, formatError(body, res.status, res.statusText), ra)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await authedFetch(path, { ...options, headers })
  if (!res.ok) throw await errorFrom(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body !== undefined ? JSON.stringify(body) : undefined,
})

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, json('POST', body)),
  put: <T>(path: string, body?: unknown) => request<T>(path, json('PUT', body)),
  patch: <T>(path: string, body?: unknown) => request<T>(path, json('PATCH', body)),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
  /** Authenticated file download (PDF export etc.) saved through a temporary link. */
  download: async (path: string, filename: string) => {
    const res = await authedFetch(path)
    if (!res.ok) throw await errorFrom(res)
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}

/** Fire-and-forget wake-up call for hosts that sleep (Render free tier). */
export function warmUp(): Promise<boolean> {
  return fetch(`${API_BASE}/health`).then((r) => r.ok).catch(() => false)
}

/** Tell the server to end the session; never throws. */
export async function logoutRemote(): Promise<void> {
  const refresh_token = getRefreshToken()
  try {
    await authedFetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token }) }, false)
  } catch { /* offline: local sign-out still happens */ }
}

// ── session management (account page) ────────────────────────────────────────
export interface SessionInfo {
  family_id: string
  user_agent: string | null
  ip: string | null
  created_at: string
  last_used_at: string | null
  active: boolean
  current: boolean
}

/** List this account's sessions; the current one is flagged via the refresh token. */
export async function listSessions(): Promise<SessionInfo[]> {
  const refresh_token = getRefreshToken()
  const res = await authedFetch('/api/auth/sessions', {
    headers: refresh_token ? { 'X-Refresh-Token': refresh_token } : {},
  })
  if (!res.ok) throw await errorFrom(res)
  const body = (await res.json()) as { sessions: SessionInfo[] }
  return body.sessions ?? []
}

/**
 * End every session of this account — including the caller's (the server
 * deny-lists the current access token too). The caller must sign out locally
 * afterwards.
 */
export async function logoutAllRemote(): Promise<void> {
  await authedFetch('/api/auth/logout-all', { method: 'POST' })
}

/** Revoke one other device's session by family id. */
export async function revokeSessionRemote(familyId: string): Promise<void> {
  const res = await authedFetch(`/api/auth/sessions/${encodeURIComponent(familyId)}`, { method: 'DELETE' })
  if (!res.ok) throw await errorFrom(res)
}

export interface SSEEvent {
  type: 'intent' | 'token' | 'citations' | 'safety' | 'done' | 'error'
  data: any
}

/** POST to an SSE endpoint and invoke onEvent for each parsed event. */
export async function streamSSE(
  path: string,
  body: unknown,
  onEvent: (ev: SSEEvent) => void,
): Promise<void> {
  const res = await authedFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) throw await errorFrom(res)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      try {
        onEvent(JSON.parse(line.slice(6)))
      } catch { /* malformed event */ }
    }
  }
}
