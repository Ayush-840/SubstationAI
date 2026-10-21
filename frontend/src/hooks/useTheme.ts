import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'outdoor' | 'system'

/** Resolve the effective display theme, honouring system preference when theme === 'system'. */
function resolveTheme(theme: Theme): 'light' | 'dark' | 'outdoor' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

/** Apply the theme to <html data-theme="…">. */
function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme)
  const html = document.documentElement
  // Remove legacy .dark class and set data-theme
  html.classList.remove('dark')
  if (resolved === 'dark') {
    html.dataset.theme = 'dark'
  } else if (resolved === 'outdoor') {
    html.dataset.theme = 'outdoor'
  } else {
    delete html.dataset.theme
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    return stored ?? 'system'
  })

  useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', theme)
    }
  }, [theme])

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const resolved = resolveTheme(theme)

  return {
    theme,
    resolved,
    dark: resolved === 'dark',
    outdoor: resolved === 'outdoor',
    setTheme,
    // Legacy toggle kept so existing callers keep working — cycles light → dark
    toggle: () => setTheme((t) => (resolveTheme(t) === 'dark' ? 'light' : 'dark')),
  }
}
