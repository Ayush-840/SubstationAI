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
import ResultChecker from './pages/ResultChecker'

type Tab = 'chat' | 'procedures' | 'diagnosis' | 'learn' | 'history' | 'admin' | 'result-checker'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'procedures', label: 'Procedures', icon: '📋' },
  { id: 'diagnosis', label: 'Diagnose', icon: '🩺' },
  { id: 'learn', label: 'Learn', icon: '🎓' },
  { id: 'history', label: 'History', icon: '🕘' },
  { id: 'result-checker', label: 'Result Checker', icon: '✅' },
]

// Day 7 C — fault diagnosis is an Engineer+ tool (POST /api/diagnosis is
// role-gated on the backend too); everything else is open to every role.
const ENGINEER_ONLY: Tab[] = ['diagnosis']

const ROLE_LABELS: Record<string, string> = {
  trainee: 'Trainee',
  engineer: 'Engineer',
  admin: 'Admin',
}

export default function App() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const [tab, setTab] = useState<Tab>('chat')

  if (!user) return <Login />

  const isEngineerPlus = user.role === 'engineer' || user.role === 'admin'
  const allowedTabs = TABS.filter(
    (t) => !ENGINEER_ONLY.includes(t.id) || isEngineerPlus,
  )
  const tabs: Tab[] = [
    ...allowedTabs.map((t) => t.id),
    ...(user.role === 'admin' ? ['admin' as Tab] : []),
  ]
  // A role change mid-session must never leave a hidden tool mounted.
  const activeTab: Tab = tabs.includes(tab) ? tab : 'chat'
  const labels: Record<Tab, string> = Object.fromEntries(
    [...TABS, { id: 'admin' as Tab, label: 'Admin', icon: '⚙️' }].map((t) => [t.id, t.label]),
  ) as any
  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-brdr bg-surface p-4 md:flex">
        <Logo />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              className={`flex min-h-[44px] items-center gap-2 rounded-control px-3 text-sm font-medium
                ${activeTab === t ? 'bg-primary/10 text-primary' : 'hover:bg-bg hover:text-primary'}`}
              onClick={() => setTab(t)}
            >
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
            {user.name} <span className="pill bg-brdr text-muted">{roleLabel}</span>
          </div>
          <button className="btn-secondary w-full" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* Main panel */}
      <main className="min-h-0 flex-1 pb-16 md:pb-0">
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'procedures' && <Procedures />}
        {activeTab === 'diagnosis' && <Diagnosis />}
        {activeTab === 'learn' && <Learn />}
        {activeTab === 'history' && <History />}
        {activeTab === 'result-checker' && <ResultChecker />}
        {activeTab === 'admin' && <Admin />}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-brdr bg-surface md:hidden">
        {tabs.map((t) => (
          <button
            key={t}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]
              ${activeTab === t ? 'text-primary' : 'text-muted hover:text-primary'}`}
            onClick={() => setTab(t)}
          >
            <span aria-hidden className="text-base">{t === 'admin' ? '⚙️' : TABS.find((x) => x.id === t)?.icon}</span>
            {labels[t]}
          </button>
        ))}
      </nav>
    </div>
  )
}
