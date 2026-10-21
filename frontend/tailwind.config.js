/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Use data-theme selector — matches tokens.css; legacy .dark class kept for transition period
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    // Replace (not extend) so the default blue/gray palette cannot leak in.
    // Breakage on build is intentional: migrate each class to a token.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      sunken: 'var(--surface-sunken)',
      ink: 'var(--ink)',
      muted: 'var(--muted)',
      rule: 'var(--rule)',
      'rule-strong': 'var(--rule-strong)',
      primary: 'var(--primary)',
      'primary-ink': 'var(--primary-ink)',
      hazard: 'var(--hazard)',
      'hazard-ink': 'var(--hazard-ink)',
      danger: 'var(--danger)',
      warn: 'var(--warn)',
      success: 'var(--success)',
      focus: 'var(--focus)',
      // Keep white/black for specific uses (print, Logo SVG)
      white: '#FFFFFF',
      black: '#000000',
    },
    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      DEFAULT: 'var(--radius)',
      // pill only for status dots and avatars
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      // Overlays (dialogs, menus) only
      overlay: '0 2px 8px rgba(0,0,0,.18)',
    },
    fontFamily: {
      sans: 'var(--font-ui)',
      mono: 'var(--font-data)',
      display: 'var(--font-display)',
    },
    extend: {
      // Minimal extends only — do not add decoration here
      typography: {},
    },
  },
  plugins: [],
}
