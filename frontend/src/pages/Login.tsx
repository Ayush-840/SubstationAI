import { FormEvent, useState } from 'react'
import { useAuth } from '../auth'
import { Logo, Disclaimer } from '../components/common'

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

  const DEMO_ACCOUNTS = {
    trainee: { email: 'demo@substationiq.dev', password: 'demo1234', label: 'Trainee' },
    engineer: { email: 'engineer@substationiq.dev', password: 'engineer1234', label: 'Engineer' },
    admin: { email: 'admin@substationiq.dev', password: 'admin1234', label: 'Admin' },
  } as const

  const fillDemo = (role: keyof typeof DEMO_ACCOUNTS) => {
    setMode('login')
    setEmail(DEMO_ACCOUNTS[role].email)
    setPassword(DEMO_ACCOUNTS[role].password)
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>

        {mode === 'register' && (
          <input className="input" placeholder="Full name" value={name}
                 onChange={(e) => setName(e.target.value)} required />
        )}
        <input className="input" type="email" placeholder="Email" value={email}
               onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="input" type="password" placeholder="Password" value={password}
               onChange={(e) => setPassword(e.target.value)} required
               autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

        {error && <p className="text-sm text-danger" role="alert">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>

        <p className="text-sm text-muted text-center">
          {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
          <button type="button" className="text-primary underline"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>

        <div className="border-t border-brdr pt-3 text-xs text-muted space-y-2">
          <p className="font-medium text-txt mb-1">Demo credentials</p>
          {(Object.keys(DEMO_ACCOUNTS) as (keyof typeof DEMO_ACCOUNTS)[]).map((role) => (
            <button
              key={role}
              type="button"
              className="w-full text-left underline hover:text-primary"
              onClick={() => fillDemo(role)}
            >
              {DEMO_ACCOUNTS[role].email} / {DEMO_ACCOUNTS[role].password} ({DEMO_ACCOUNTS[role].label})
            </button>
          ))}
        </div>
      </form>
      <Disclaimer />
    </div>
  )
}
