import { useState } from 'react'
import { useAuth } from './auth'
import { useTheme } from './hooks/useTheme'
import { Logo, Disclaimer } from './components/common'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Procedures from './pages/Procedures'
import Diagnosis from './pages/Diagnosis'
import History from './pages/History'
import Admin from './pages/Admin'
import Learn from './pages/Learn'

type Tab = 'chat' | 'procedures' | 'diagnosis' | 'learn' | 'history' | 'admin'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'procedures', label: 'Procedures', icon: '📋' },
  { id: 'diagnosis', label: 'Diagnose', icon: '🩺' },
  { id: 'learn', label: 'Learn', icon: '🎓' },
  { id: 'history', label: 'History', icon: '🕘' },
]

export default function App() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const [tab, setTab] = useState<Tab>('chat')

  if (!user) return <Login />

  const tabs: Tab[] = user.role === 'admin' ? [...TABS.map((t) => t.id), 'admin'] : TABS.map((t) => t.id)
  const labels: Record<Tab, string> = Object.fromEntries(
    [...TABS, { id: 'admin' as Tab, label: 'Admin', icon: '⚙️' }].map((t) => [t.id, t.label]),
  ) as any

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-brdr bg-surface p-4 md:flex">
        <Logo />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {tabs.map((t) => (
            <button key={t}
                    className={`flex min-h-[44px] items-center gap-2 rounded-control px-3 text-sm font-medium
                      ${tab === t ? 'bg-primary/10 text-primary' : 'hover:bg-bg'}`}
                    onClick={() => setTab(t)}>
              <span aria-hidden>{t === 'admin' ? '⚙️' : TABS.find((x) => x.id === t)?.icon}</span>
              {labels[t]}
            </button>
          ))}
        </nav>
        <div className="space-y-2 border-t border-brdr pt-3 text-sm">
          <button className="btn-secondary w-full" onClick={toggle} aria-label="Toggle theme">
            {dark ? '☀️ Light' : '🌙 Dark'}
          </button>
          <div className="truncate px-1 text-muted" title={user.email}>
            {user.name} <span className="pill bg-brdr text-muted">{user.role}</span>
          </div>
          <button className="btn-secondary w-full" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* Main panel */}
      <main className="min-h-0 flex-1 pb-16 md:pb-0">
        {tab === 'chat' && <Chat />}
        {tab === 'procedures' && <Procedures />}
        {tab === 'diagnosis' && <Diagnosis />}
        {tab === 'learn' && <Learn />}
        {tab === 'history' && <History />}
        {tab === 'admin' && <Admin />}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-brdr bg-surface md:hidden">
        {tabs.map((t) => (
          <button key={t}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]
                    ${tab === t ? 'text-primary' : 'text-muted'}`}
                  onClick={() => setTab(t)}>
            <span aria-hidden className="text-base">{t === 'admin' ? '⚙️' : TABS.find((x) => x.id === t)?.icon}</span>
            {labels[t]}
          </button>
        ))}
      </nav>
    </div>
  )
}
