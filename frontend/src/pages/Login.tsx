import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Wordmark, Disclaimer, AllEquipmentGlyph, Field, Input, Button } from '../components/common'
import { copy } from '../copy'

const DEMO_ACCOUNTS = {
  trainee: { email: 'demo@substationiq.dev', password: 'demo1234', label: 'Trainee' },
  engineer: { email: 'engineer@substationiq.dev', password: 'engineer1234', label: 'Engineer' },
  admin: { email: 'admin@substationiq.dev', password: 'admin1234', label: 'Admin' },
} as const

// Demo credentials are shown only in local dev or when explicitly enabled at build time.
const isDemoMode = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'

/** Same rules as the backend (schemas.UserCreate) so users get feedback before a round trip. */
function validateRegistration(name: string, password: string): string | null {
  if (!name.trim()) return 'Please enter your name.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.'
  if (new TextEncoder().encode(password).length > 72) return 'Password is too long (72 bytes maximum).'
  return null
}

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

export default function Login() {
  const { user, login, register, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Already signed in (e.g. opened /login in a second tab): go to the app.
  if (user) return <Navigate to="/chat" replace />

  const isLogin = mode === 'login'
  const t = copy.pages.login

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError('')
    if (!email.trim() || !password) return setError('Enter your email and password.')
    if (!isLogin) {
      const problem = validateRegistration(name, password)
      if (problem) return setError(problem)
    }
    try {
      if (isLogin) await login(email.trim(), password)
      else await register(name.trim(), email.trim(), password)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.pages.errors.authFailed)
    }
  }

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

          {isDemoMode && (
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
              hint={isLogin ? undefined : 'At least 8 characters, with a letter and a number.'}
            >
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </Field>

            {error && (
              <p style={{ margin: '0 0 12px', color: 'var(--danger)', fontSize: 14 }} role="alert">
                {error}
              </p>
            )}

            <Button variant="primary" type="submit" style={{ width: '100%' }} disabled={loading}>
              {loading ? t.submit.loading : isLogin ? t.submit.login : t.submit.register}
            </Button>
            {loading && (
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }} role="status">
                The server may be waking up — this can take up to a minute on the first request.
              </p>
            )}

            <p style={{ marginTop: 16, textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>
              {isLogin ? "Don't have an account?" : 'Already registered?'}
              <button type="button" onClick={switchMode} style={linkButton}>
                {isLogin ? 'Register' : 'Sign in'}
              </button>
            </p>
          </form>
        </section>
      </main>

      <Disclaimer style={{ padding: 16, borderTop: '1px solid var(--rule)', background: 'var(--surface)' }} />
    </div>
  )
}
