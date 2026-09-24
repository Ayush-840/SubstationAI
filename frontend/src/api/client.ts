const API_BASE = import.meta.env.VITE_API_URL || ''

export function getToken(): string | null {
  return localStorage.getItem('siq_token')
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('siq_token', token)
  else localStorage.removeItem('siq_token')
}

export function getStoredUser(): { id: number; name: string; email: string; role: string } | null {
  try {
    const raw = localStorage.getItem('siq_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: { id: number; name: string; email: string; role: string } | null) {
  if (user) localStorage.setItem('siq_user', JSON.stringify(user))
  else localStorage.removeItem('siq_user')
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || JSON.stringify(body)
    } catch { /* not json */ }
    if (res.status === 401) {
      setToken(null)
      setStoredUser(null)
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
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
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    let detail = res.statusText
    try { detail = (await res.json()).detail ?? detail } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }

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
