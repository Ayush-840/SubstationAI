import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { Wordmark, Disclaimer, Field, Input, Button } from '../components/common'

/** POST /password/forgot — the server always answers 202 (no enumeration). */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!email.trim()) return setError('Enter the e-mail you registered with.')
    setBusy(true)
    try {
      await api.post('/api/auth/password/forgot', { email: email.trim() })
      setSent(true)
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
          {sent ? (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Check your e-mail
              </h1>
              <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--muted)' }}>
                If an account exists for <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>,
                we sent a link to reset the password. It expires in 30 minutes and works once.
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>
                Didn’t get it? Check the spam folder, or wait a moment and send it again from this page.
              </p>
              <Button variant="secondary" style={{ width: '100%', marginBottom: 16 }} onClick={() => setSent(false)}>
                Use a different address
              </Button>
            </>
          ) : (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Reset your password
              </h1>
              <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)' }}>
                Enter the address you registered with and we’ll email you a reset link.
              </p>
              <form onSubmit={submit} noValidate aria-busy={busy}>
                <Field label="Email" htmlFor="forgot-email" required>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                  />
                </Field>
                {error && (
                  <p style={{ margin: '0 0 12px', color: 'var(--danger)', fontSize: 14 }} role="alert">{error}</p>
                )}
                <Button variant="primary" type="submit" style={{ width: '100%' }} disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset link'}
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
