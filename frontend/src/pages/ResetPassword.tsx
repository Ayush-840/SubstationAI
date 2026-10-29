import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { Wordmark, Disclaimer, Field, Input, Button } from '../components/common'
import { PasswordChecklist, firstPasswordProblem } from '../components/PasswordChecklist'

/** The reset link carries the single-use token in the URL fragment (§7.6). */
function tokenFromFragment(): string | null {
  try {
    return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
  } catch {
    return null
  }
}

/** POST /password/reset — sets the new password and revokes every session. */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [checkedToken, setCheckedToken] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setToken(tokenFromFragment())
    setCheckedToken(true)
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !token) return
    setError('')
    const problem = firstPasswordProblem(password)
    if (problem) return setError(problem)
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    try {
      await api.post('/api/auth/password/reset', { token, new_password: password })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : 'Could not reach the server — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)' }}>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Wordmark style={{ marginBottom: 24 }} />
          {!checkedToken ? null : done ? (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Password updated
              </h1>
              <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--muted)' }}>
                Every other signed-in device was signed out for safety. You can sign in with the new password now.
              </p>
              <Button variant="primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
                Go to sign in
              </Button>
            </>
          ) : !token ? (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Reset link incomplete
              </h1>
              <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--muted)' }}>
                This page needs the link from the reset e-mail — the token wasn’t found in the address.
                Request a fresh link and open it directly.
              </p>
              <Button variant="primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => navigate('/forgot-password')}>
                Request a new link
              </Button>
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Choose a new password
              </h1>
              <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)' }}>
                This link works once. Saving the new password signs out all your other sessions.
              </p>
              <form onSubmit={submit} noValidate aria-busy={busy}>
                <Field label="New password" htmlFor="reset-password" required>
                  <Input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                  />
                </Field>
                {password.length > 0 && <PasswordChecklist password={password} />}
                <Field label="Confirm new password" htmlFor="reset-confirm" required>
                  <Input
                    id="reset-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                {error && (
                  <p style={{ margin: '0 0 12px', color: 'var(--danger)', fontSize: 14 }} role="alert">{error}</p>
                )}
                <Button variant="primary" type="submit" style={{ width: '100%' }} disabled={busy}>
                  {busy ? 'Saving…' : 'Set new password'}
                </Button>
              </form>
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
