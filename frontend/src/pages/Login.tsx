import { FormEvent, useState } from 'react'
import { useAuth } from '../auth'
import { Wordmark, Disclaimer, AllEquipmentGlyph } from '../components/common'

const DEMO_ACCOUNTS = {
  trainee: { email: 'demo@substationiq.dev', password: 'demo1234', label: 'Trainee' },
  engineer: { email: 'engineer@substationiq.dev', password: 'engineer1234', label: 'Engineer' },
  admin: { email: 'admin@substationiq.dev', password: 'admin1234', label: 'Admin' },
} as const

const isDemoMode = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'

export default function Login() {
  const { login, register, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    }
  }

  const fillDemo = (role: keyof typeof DEMO_ACCOUNTS) => {
    setMode('login')
    setEmail(DEMO_ACCOUNTS[role].email)
    setPassword(DEMO_ACCOUNTS[role].password)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--ink)',
    }}>
      {/* Desktop: two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        minHeight: '100vh',
        maxWidth: '1000px',
        width: '100%',
        margin: '0 auto',
      }}>
        {/* Left column - Brand & Purpose */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '48px',
          background: 'var(--bg)',
          textAlign: 'center',
        }}>
          <Wordmark size="large" style={{ marginBottom: '24px' }} />
          <p style={{
            margin: '0 0 32px',
            fontSize: '18px',
            lineHeight: 1.5,
            color: 'var(--ink)',
            maxWidth: '400px',
          }}>
            Test procedures, limits and standards for substation maintenance.
          </p>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
            border: '1px solid var(--rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)',
          }}>
            <AllEquipmentGlyph size={60} />
          </div>
          {isDemoMode && (
            <div style={{
              marginTop: '32px',
              padding: '16px',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-sunken)',
              textAlign: 'left',
            }}>
              <p style={{
                margin: '0 0 8px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                fontFamily: 'var(--font-data)',
              }}>
                Demo Accounts
              </p>
              {(Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).map((role) => (
                <div key={role} style={{ fontSize: '12px', fontFamily: 'var(--font-data)', marginBottom: '4px', color: 'var(--ink)' }}>
                  {DEMO_ACCOUNTS[role].email} / {DEMO_ACCOUNTS[role].password} <span style={{ color: 'var(--muted)' }}>({DEMO_ACCOUNTS[role].label})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column - Form */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '48px',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--rule)',
        }}>
          <form onSubmit={submit} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <h1 style={{
              margin: '0 0 8px',
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--ink)',
              fontFamily: 'var(--font-display)',
            }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: '15px', color: 'var(--muted)' }}>
              {mode === 'login' ? 'Enter your credentials to access SubstationIQ' : 'Register for access to maintenance procedures and limits'}
            </p>

            {mode === 'register' && (
              <Field label="Full Name" required>
                <Input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </Field>
            )}

            <Field label="Email" required>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>

            <Field label="Password" required>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>

            {error && <p style={{ marginTop: '12px', color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}

            <Button variant="primary" type="submit" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
            </Button>

            <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px', color: 'var(--muted)' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  color: 'var(--primary)',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* Mobile: stacked layout */}
      <div className="md:hidden" style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        maxWidth: '1000px',
        width: '100%',
        margin: '0 auto',
        padding: '24px 16px',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '32px 0',
        }}>
          <Wordmark size="large" style={{ marginBottom: '16px' }} />
          <p style={{
            margin: '0 0 24px',
            fontSize: '17px',
            lineHeight: 1.5,
            color: 'var(--ink)',
            maxWidth: '360px',
          }}>
            Test procedures, limits and standards for substation maintenance.
          </p>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
            border: '1px solid var(--rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)',
          }}>
            <AllEquipmentGlyph size={40} />
          </div>
          {isDemoMode && (
            <div style={{
              marginTop: '24px',
              width: '100%',
              maxWidth: '360px',
              padding: '16px',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-sunken)',
              textAlign: 'left',
            }}>
              <p style={{
                margin: '0 0 8px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                fontFamily: 'var(--font-data)',
              }}>
                Demo Accounts
              </p>
              {(Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).map((role) => (
                <div key={role} style={{ fontSize: '12px', fontFamily: 'var(--font-data)', marginBottom: '4px', color: 'var(--ink)' }}>
                  {DEMO_ACCOUNTS[role].email} / {DEMO_ACCOUNTS[role].password} <span style={{ color: 'var(--muted)' }}>({DEMO_ACCOUNTS[role].label})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          width: '100%',
          maxWidth: '400px',
          margin: '0 auto',
          padding: '16px 0 32px',
        }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h1 style={{
              margin: '0 0 8px',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--ink)',
              fontFamily: 'var(--font-display)',
            }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h1>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--muted)' }}>
              {mode === 'login' ? 'Enter your credentials to access SubstationIQ' : 'Register for access to maintenance procedures and limits'}
            </p>

            {mode === 'register' && (
              <Field label="Full Name" required>
                <Input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </Field>
            )}

            <Field label="Email" required>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>

            <Field label="Password" required>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>

            {error && <p style={{ color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}

            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
            </Button>

            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{
                  color: 'var(--primary)',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* Footer disclaimer */}
      <Disclaimer style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--rule)', background: 'var(--surface)' }} />
    </div>
  )
}