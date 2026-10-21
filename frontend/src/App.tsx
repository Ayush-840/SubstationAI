import { useState } from 'react'
import { useAuth } from './auth'
import { useTheme, type Theme } from './hooks/useTheme'
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

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Ask' },
  { id: 'procedures', label: 'Procedures' },
  { id: 'diagnosis', label: 'Diagnose' },
  { id: 'learn', label: 'Learn' },
  { id: 'history', label: 'History' },
  { id: 'result-checker', label: 'Result Checker' },
]

// Fault diagnosis is Engineer+ (backend also role-gates the POST)
const ENGINEER_ONLY: Tab[] = ['diagnosis']

const ROLE_LABELS: Record<string, string> = {
  trainee: 'Trainee',
  engineer: 'Engineer',
  admin: 'Admin',
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'system', label: 'Match system' },
]

export default function App() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
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
  const activeTab: Tab = tabs.includes(tab) ? tab : 'chat'
  const allTabDefs = [...TABS, { id: 'admin' as Tab, label: 'Admin' }]
  const labels: Record<Tab, string> = Object.fromEntries(
    allTabDefs.map((t) => [t.id, t.label]),
  ) as any
  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  // Mobile shows max 4 items (Ask, Procedures, Result Checker, More-represented-as-last)
  const mobileTabs = tabs.slice(0, 4)

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop sidebar — 240px, text-first navigation */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--rule)',
        background: 'var(--bg)',
        padding: '16px',
      }} className="hidden md:flex">
        <Logo />

        <nav style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {tabs.map((t) => {
            const isActive = activeTab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--ink)' : 'var(--muted)',
                  textAlign: 'left',
                  width: '100%',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  transition: 'color 100ms, border-color 100ms',
                  fontFamily: 'var(--font-ui)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'
                }}
              >
                {labels[t]}
              </button>
            )
          })}
        </nav>

        {/* Sidebar footer: theme control + user */}
        <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* 3-way theme selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '4px' }}>
              Theme
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              aria-label="Select theme"
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: '13px',
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
              }}
            >
              {THEME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }} title={user.email}>
            {user.name}
            <span style={{
              display: 'inline-block',
              marginLeft: '6px',
              fontSize: '11px',
              color: 'var(--muted)',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px',
            }}>
              {roleLabel}
            </span>
          </div>
          <button className="btn-secondary" style={{ width: '100%' }} onClick={logout}>Sign out</button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="min-h-0 flex-1" style={{ paddingBottom: 'env(safe-area-inset-bottom, 64px)' }} id="main-content">
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'procedures' && <Procedures />}
        {activeTab === 'diagnosis' && <Diagnosis />}
        {activeTab === 'learn' && <Learn />}
        {activeTab === 'history' && <History />}
        {activeTab === 'result-checker' && <ResultChecker />}
        {activeTab === 'admin' && <Admin />}
      </main>

      {/* Mobile bottom bar — max 4 items, text labels always visible */}
      <nav
        aria-label="Main navigation"
        style={{
          position: 'fixed',
          inset: '0 0 0 0',
          top: 'auto',
          display: 'flex',
          height: '56px',
          borderTop: '1px solid var(--rule)',
          background: 'var(--surface)',
          zIndex: 50,
        }}
        className="md:hidden"
      >
        {mobileTabs.map((t) => {
          const isActive = activeTab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--primary)' : 'var(--muted)',
                fontFamily: 'var(--font-ui)',
                padding: '8px 4px',
              }}
            >
              {labels[t]}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
