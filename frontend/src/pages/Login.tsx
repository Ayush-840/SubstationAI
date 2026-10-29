import { FormEvent, useEffect, useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError, api } from '../api/client'
import { googleEnabled, renderGoogleButton } from '../api/google'
import { Wordmark, Disclaimer, AllEquipmentGlyph, Field, Input, Button } from '../components/common'
import { PasswordChecklist, firstPasswordProblem } from '../components/PasswordChecklist'
import { copy } from '../copy'

const DEMO_ACCOUNTS = {
  trainee: { email: 'demo@substationiq.dev', password: 'demo1234', label: 'Trainee' },
  engineer: { email: 'engineer@substationiq.dev', password: 'engineer1234', label: 'Engineer' },
  admin: { email: 'admin@substationiq.dev', password: 'admin1234', label: 'Admin' },
} as const

// Demo credentials are shown only in local dev or when explicitly enabled at build time.
const isDemoMode = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'

const linkButton: React.CSSProperties = {
  color: 'var(--primary)',
  textDecoration: 'underline',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontFamily: 'var(--font-ui)',
  marginLeft: '6px',
}

type Mode = 'login' | 'register' | 'verify-sent'

export default function Login() {
  const { user, login, loginWithGoogle, register, completeMfa, cancelMfa, mfaPending, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // Live countdown (seconds) after a 429; 0 = not locked.
  const [lockSeconds, setLockSeconds] = useState(0)
  // MFA step: which kind of code the user is typing.
  const [mfaCode, setMfaCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const googleBtnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lockSeconds <= 0) return
    const t = setTimeout(() => setLockSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(t)
  }, [lockSeconds])

  // Already signed in (e.g. opened /login in a second tab): go to the app.
  if (user) return <Navigate to="/chat" replace />

  const isLogin = mode === 'login'
  const showMfa = mfaPending
  const t = copy.pages.login

  const noteError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 429 && err.retryAfter) {
      setLockSeconds(err.retryAfter)
      setError(`Too many attempts — try again in ${err.retryAfter} seconds.`)
      return
    }
    if (err instanceof ApiError && err.status === 403 && err.message === 'email_not_verified') {
      setError('Confirm your e-mail address to sign in. Check your inbox for the link.')
      return
    }
    setError(err instanceof Error && err.message ? err.message : copy.pages.errors.authFailed)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || lockSeconds > 0) return
    setError('')
    if (!email.trim() || !password) return setError('Enter your email and password.')
    if (!isLogin) {
      if (!name.trim()) return setError('Please enter your name.')
      const problem = firstPasswordProblem(password)
      if (problem) return setError(problem)
    }
    try {
      if (isLogin) {
        const result = await login(email.trim(), password)
        if (result === 'mfa') {
          setMfaCode('')
          setUseRecovery(false)
        }
      } else {
        const result = await register(name.trim(), email.trim(), password)
        if (result === 'verify') setMode('verify-sent')
        if (result === 'mfa') {
          setMfaCode('')
          setUseRecovery(false)
        }
      }
    } catch (err) {
      noteError(err)
    }
  }

  const submitMfa = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    const code = mfaCode.trim()
    if (!code) return setError(useRecovery ? 'Enter a recovery code.' : 'Enter the 6-digit code from your authenticator app.')
    try {
      await completeMfa(code)
    } catch (err) {
      noteError(err)
    }
  }

  const backFromMfa = () => {
    cancelMfa()
    setMfaCode('')
    setUseRecovery(false)
    setError('')
  }

  const resendVerification = async () => {
    if (resendState !== 'idle') return
    setResendState('sending')
    try {
      await api.post('/api/auth/resend-verification', { email: email.trim() })
      setResendState('sent')
    } catch {
      // The endpoint always answers 202; only a network failure lands here.
      setResendState('idle')
    }
  }

  const handleGoogle = async (idToken: string) => {
    setError('')
    try {
      await loginWithGoogle(idToken)
    } catch (err) {
      noteError(err)
    }
  }

  // Google button lives in the login/register form only (not MFA / verify).
  useEffect(() => {
    if (!googleEnabled || showMfa || mode === 'verify-sent') return
    const el = googleBtnRef.current
    if (!el) return
    el.innerHTML = ''
    renderGoogleButton(el, (idToken) => { void handleGoogle(idToken) }, { width: 340 }).catch(() => {
      /* offline or blocked: password form still works */
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showMfa])

  const switchMode = () => {
    setMode(isLogin ? 'register' : 'login')
    setError('')
  }

  const fillDemo = (role: keyof typeof DEMO_ACCOUNTS) => {
    setMode('login')
    setError('')
    setEmail(DEMO_ACCOUNTS[role].email)
    setPassword(DEMO_ACCOUNTS[role].password)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)' }}>
      <main
        className="grid md:grid-cols-2"
        style={{ flex: 1, width: '100%', maxWidth: 1000, margin: '0 auto' }}
      >
        {/* Brand column: stacks above the form on small screens */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <Wordmark size="large" style={{ marginBottom: 16 }} />
          <p style={{ margin: '0 0 24px', fontSize: 17, lineHeight: 1.5, maxWidth: 380 }}>{copy.brand.tagline}</p>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              border: '1px solid var(--rule)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
            }}
          >
            <AllEquipmentGlyph size={48} />
          </div>

          {isDemoMode && !showMfa && mode !== 'verify-sent' && (
            <div
              style={{
                marginTop: 24,
                width: '100%',
                maxWidth: 380,
                padding: 16,
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-sunken)',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                  fontFamily: 'var(--font-data)',
                }}
              >
                {t.demoAccounts.heading}
              </p>
              {(Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => fillDemo(role)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'var(--font-data)',
                    color: 'var(--ink)',
                  }}
                >
                  {DEMO_ACCOUNTS[role].email} <span style={{ color: 'var(--muted)' }}>({DEMO_ACCOUNTS[role].label}) — click to fill</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Form column */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '32px 24px',
            background: 'var(--surface)',
            borderLeft: '1px solid var(--rule)',
          }}
        >
          {/* ── Second factor ───────────────────────────────────────────── */}
          {showMfa ? (
            <form onSubmit={submitMfa} noValidate style={{ width: '100%', maxWidth: 400, margin: '0 auto' }} aria-busy={loading}>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Two-factor check
              </h1>
              <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)' }}>
                {useRecovery
                  ? 'Enter one of the recovery codes you saved when you turned on two-factor.'
                  : 'Enter the 6-digit code from your authenticator app.'}
              </p>

              <Field label={useRecovery ? 'Recovery code' : 'Authentication code'} htmlFor="auth-mfa" required>
                <Input
                  id="auth-mfa"
                  type="text"
                  inputMode={useRecovery ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  maxLength={32}
                  style={{ fontFamily: 'var(--font-data)', letterSpacing: useRecovery ? 'normal' : '0.15em' }}
                />
              </Field>

              {error && (
                <p style={{ margin: '0 0 12px', color: 'var(--danger)', fontSize: 14 }} role="alert">
                  {error}
                </p>
              )}

              <Button variant="primary" type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify'}
              </Button>

              <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>
                <button type="button" onClick={() => { setUseRecovery(!useRecovery); setMfaCode(''); setError('') }} style={linkButton}>
                  {useRecovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
                </button>
              </p>
              <p style={{ marginTop: 8, textAlign: 'center', fontSize: 14 }}>
                <button type="button" onClick={backFromMfa} style={linkButton}>
                  ← Back to sign in
                </button>
              </p>
            </form>
          ) : mode === 'verify-sent' ? (
            /* ── Check-your-e-mail screen (register with verification required) ── */
            <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Check your e-mail
              </h1>
              <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--muted)' }}>
                We sent a confirmation link to <strong style={{ color: 'var(--ink)' }}>{email.trim()}</strong>.
                Click it to activate your account, then sign in.
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
                The link works once and expires after a short time — request a new one if it ran out.
              </p>
              {resendState === 'sent' ? (
                <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--success, #15803d)' }} role="status">
                  Sent. Check your inbox (and spam folder).
                </p>
              ) : (
                <Button variant="secondary" style={{ width: '100%', marginBottom: 12 }} disabled={resendState === 'sending'} onClick={resendVerification}>
                  {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
                </Button>
              )}
              <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>
                Wrong address?
                <button type="button" onClick={() => { setMode('register'); setResendState('idle'); setError('') }} style={linkButton}>
                  Register again
                </button>
              </p>
            </div>
          ) : (
            /* ── Login / register ──────────────────────────────────────── */
            <form onSubmit={submit} noValidate style={{ width: '100%', maxWidth: 400, margin: '0 auto' }} aria-busy={loading}>
              <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                {isLogin ? t.heading.login : t.heading.register}
              </h1>
              <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--muted)' }}>
                {isLogin ? t.description.login : t.description.register}
              </p>

              {!isLogin && (
                <Field label={t.fields.name} htmlFor="auth-name" required>
                  <Input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    autoComplete="name"
                  />
                </Field>
              )}

              <Field label={t.fields.email} htmlFor="auth-email" required>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </Field>

              <Field
                label={t.fields.password}
                htmlFor="auth-password"
                required
              >
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </Field>

              {!isLogin && password.length > 0 && <PasswordChecklist password={password} />}

              {isLogin && (
                <p style={{ margin: '-4px 0 16px', textAlign: 'right', fontSize: 13 }}>
                  <Link to="/forgot-password" style={{ color: 'var(--primary)' }}>Forgot password?</Link>
                </p>
              )}

              {error && (
                <p style={{ margin: '0 0 12px', color: 'var(--danger)', fontSize: 14 }} role="alert">
                  {error}
                  {error.includes('Confirm your e-mail') && resendState !== 'sent' && (
                    <button type="button" onClick={resendVerification} style={linkButton} disabled={resendState === 'sending'}>
                      {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
                    </button>
                  )}
                </p>
              )}

              <Button variant="primary" type="submit" style={{ width: '100%' }} disabled={loading || lockSeconds > 0}>
                {lockSeconds > 0
                  ? `Locked — retry in ${lockSeconds}s`
                  : loading
                    ? t.submit.loading
                    : isLogin
                      ? t.submit.login
                      : t.submit.register}
              </Button>
              {loading && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }} role="status">
                  The server may be waking up — this can take up to a minute on the first request.
                </p>
              )}

              {isLogin && googleEnabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 12px', color: 'var(--muted)', fontSize: 12 }}>
                    <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
                    or
                    <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
                  </div>
                  <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
                </>
              )}

              <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>
                {isLogin ? "Don't have an account?" : 'Already registered?'}
                <button type="button" onClick={switchMode} style={linkButton}>
                  {isLogin ? 'Register' : 'Sign in'}
                </button>
              </p>
            </form>
          )}
        </section>
      </main>

      <Disclaimer style={{ padding: 16, borderTop: '1px solid var(--rule)', background: 'var(--surface)' }} />
    </div>
  )
}
