import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Wordmark, Disclaimer, Button } from '../components/common'

/** The verification link carries the token in the URL fragment (§7.6). */
function tokenFromFragment(): string | null {
  try {
    return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
  } catch {
    return null
  }
}

type State = 'checking' | 'ok' | 'fail'

/** POST /verify-email — one-shot; unknown/expired/used tokens are a uniform 400. */
export default function VerifyEmail() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    const token = tokenFromFragment()
    if (!token) {
      setState('fail')
      return
    }
    let cancelled = false
    api
      .post('/api/auth/verify-email', { token })
      .then(() => { if (!cancelled) setState('ok') })
      .catch(() => { if (!cancelled) setState('fail') })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)' }}>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'left' }}>
          <Wordmark style={{ marginBottom: 24 }} />
          {state === 'checking' && (
            <p style={{ fontSize: 15, color: 'var(--muted)' }} role="status">
              Confirming your address…
            </p>
          )}
          {state === 'ok' && (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                E-mail confirmed
              </h1>
              <p style={{ margin: '0 0 20px', fontSize: 15, color: 'var(--muted)' }}>
                Your address is verified — you can sign in now.
              </p>
              <Button variant="primary" style={{ width: '100%' }} onClick={() => { window.location.hash = ''; window.location.pathname = '/login' }}>
                Go to sign in
              </Button>
            </>
          )}
          {state === 'fail' && (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Link didn’t work
              </h1>
              <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--muted)' }}>
                This confirmation link is invalid, expired, or was already used.
                You can request a fresh one from the sign-in page (or by registering again).
              </p>
              <Button variant="primary" style={{ width: '100%' }} onClick={() => { window.location.hash = ''; window.location.pathname = '/login' }}>
                Go to sign in
              </Button>
            </>
          )}
          <p style={{ marginTop: 20, fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
            <Link to="/login" style={{ color: 'var(--primary)' }}>← Back to sign in</Link>
          </p>
        </div>
      </main>
      <Disclaimer style={{ padding: 16, borderTop: '1px solid var(--rule)', background: 'var(--surface)' }} />
    </div>
  )
}
