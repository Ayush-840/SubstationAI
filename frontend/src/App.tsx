import { useState, useContext, createContext, useEffect } from 'react'
import { useAuth } from './auth'
import { useTheme, type Theme } from './hooks/useTheme'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Logo, Disclaimer, Wordmark } from './components/common'
import { SourcesPanel, type CitationItem } from './components/Sources'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Procedures from './pages/Procedures'
import Diagnosis from './pages/Diagnosis'
import DGA from './pages/DGA'
import History from './pages/History'
import Admin from './pages/Admin'
import Learn from './pages/Learn'
import ResultChecker from './pages/ResultChecker'
import DevComponents from './pages/DevComponents'
import Catalog from './pages/Catalog'
import TestDetail from './pages/TestDetail'
import CatalogEditor from './pages/CatalogEditor'

type Tab = 'chat' | 'procedures' | 'diagnosis' | 'dga' | 'learn' | 'history' | 'admin' | 'result-checker' | 'dev-components' | 'catalog-editor'

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Ask' },
  { id: 'procedures', label: 'Procedures' },
  { id: 'diagnosis', label: 'Diagnose' },
  { id: 'dga', label: 'DGA' },
  { id: 'learn', label: 'Learn' },
  { id: 'history', label: 'History' },
  { id: 'result-checker', label: 'Result Checker' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'catalog-editor', label: 'Catalog Editor' },
]

const ENGINEER_ONLY: Tab[] = ['diagnosis', 'dga', 'catalog-editor']

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

interface SourcesContextValue {
  openSource: (source: CitationItem) => void
  closeSources: () => void
}

const SourcesContext = createContext<SourcesContextValue | null>(null)

export function useSources() {
  const ctx = useContext(SourcesContext)
  if (!ctx) throw new Error('useSources must be used within App')
  return ctx
}

function Shell() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('chat')
  const [activeSource, setActiveSource] = useState<CitationItem | null>(null)

  const isEngineerPlus = user.role === 'engineer' || user.role === 'admin'
  const allowedTabs = TABS.filter(
    (t) => !ENGINEER_ONLY.includes(t.id) || isEngineerPlus,
  )
  const tabs: Tab[] = [
    ...allowedTabs.map((t) => t.id),
    ...(user.role === 'admin' ? ['admin' as Tab] : []),
  ]
  const isDevUrl = typeof window !== 'undefined' && (
    window.location.pathname === '/dev/components' ||
    window.location.hash === '#/dev/components' ||
    window.location.hash === '#dev-components'
  )
  const isDev = isDevUrl || tab === 'dev-components'

  const activeTab: Tab = tabs.includes(tab) ? tab : 'chat'
  const allTabDefs = [...TABS, { id: 'admin' as Tab, label: 'Admin' }]
  const labels: Record<Tab, string> = Object.fromEntries(
    allTabDefs.map((t) => [t.id, t.label]),
  ) as any
  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  const mobileTabs = tabs.slice(0, 4)

  const openSource = (source: CitationItem) => {
    setActiveSource(source)
  }

  const closeSources = () => {
    setActiveSource(null)
  }

  return (
    <SourcesContext.Provider value={{ openSource, closeSources }}>
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

            <button
              type="button"
              onClick={() => setTab(isDev ? 'chat' : 'dev-components')}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0 0',
                fontSize: '11px',
                color: isDev ? 'var(--primary)' : 'var(--muted)',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'var(--font-data)',
                textDecoration: isDev ? 'underline' : 'none',
              }}
            >
              {isDev ? '← Back to app' : 'dev: /dev/components'}
            </button>
          </div>
        </aside>

        {/* Main content area — workspace max-width 760px, left-aligned */}
        <main className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom, 120px)' }} id="main-content">
          <div style={{
            maxWidth: '760px',
            margin: '0',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
          }}>
            {/* Page content */}
            <div style={{ flex: 1, padding: '24px 20px', overflowY: 'auto' }}>
              <Outlet />
            </div>

            {/* Footer disclaimer */}
            <Disclaimer style={{ padding: '12px 20px', borderTop: '1px solid var(--rule)', background: 'var(--surface)' }} />
          </div>
        </main>

        {/* Desktop sources panel — right drawer 360px */}
        <SourcesPanel
          source={activeSource}
          isOpen={Boolean(activeSource)}
          onClose={closeSources}
          className="hidden md:block"
        />

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

        {/* Mobile sources bottom sheet */}
        <SourcesPanel
          source={activeSource}
          isOpen={Boolean(activeSource)}
          onClose={closeSources}
          className="md:hidden"
        />
      </div>
    </SourcesContext.Provider>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute><Shell /></PrivateRoute>}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<Chat />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="catalog/tests/:testId" element={<TestDetail />} />
        <Route path="procedures" element={<Procedures />} />
        <Route path="diagnosis" element={<Diagnosis />} />
        <Route path="dga" element={<DGA />} />
        <Route path="learn" element={<Learn />} />
        <Route path="history" element={<History />} />
        <Route path="result-checker" element={<ResultChecker />} />
        <Route path="admin" element={<Admin />} />
        <Route path="catalog/editor" element={<CatalogEditor />} />
        <Route path="dev/components" element={<DevComponents />} />
      </Route>
    </Routes>
  )
}