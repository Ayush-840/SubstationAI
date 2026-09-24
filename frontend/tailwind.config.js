/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--rgb-bg) / <alpha-value>)',
        surface: 'rgb(var(--rgb-surface) / <alpha-value>)',
        brdr: 'rgb(var(--rgb-border) / <alpha-value>)',
        txt: 'rgb(var(--rgb-text) / <alpha-value>)',
        muted: 'rgb(var(--rgb-muted) / <alpha-value>)',
        primary: 'rgb(var(--rgb-primary) / <alpha-value>)',
        accent: 'rgb(var(--rgb-accent) / <alpha-value>)',
        warning: 'rgb(var(--rgb-warning) / <alpha-value>)',
        danger: 'rgb(var(--rgb-danger) / <alpha-value>)',
        success: 'rgb(var(--rgb-success) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '8px',
        card: '12px',
      },
    },
  },
  plugins: [],
}
