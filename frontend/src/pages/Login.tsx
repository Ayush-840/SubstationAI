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

  const fillDemo = (role: 'user' | 'admin') => {
    setMode('login')
    setEmail(role === 'user' ? 'demo@substationiq.dev' : 'admin@substationiq.dev')
    setPassword(role === 'user' ? 'demo1234' : 'admin1234')
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

        <div className="border-t border-brdr pt-3 text-xs text-muted space-y-1">
          <p className="font-medium text-txt">Demo credentials</p>
          <button type="button" className="underline hover:text-primary" onClick={() => fillDemo('user')}>
            demo@substationiq.dev / demo1234 (User)
          </button>
          <br />
          <button type="button" className="underline hover:text-primary" onClick={() => fillDemo('admin')}>
            admin@substationiq.dev / admin1234 (Admin)
          </button>
        </div>
      </form>
      <Disclaimer />
    </div>
  )
}
