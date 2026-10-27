import React from 'react'
import { copy } from '../copy'

export interface SafetyBlockProps {
  label?: string
  rules?: readonly string[]
  compact?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
}

const DEFAULT_LABEL = copy.pages.components.safetyBlock.label
const DEFAULT_RULES = copy.pages.components.safetyBlock.rules

/**
 * SafetyBlock per 03-components.md section 3:
 * - 10px hazard stripe across top edge
 * - 2px solid var(--ink) border, var(--surface) background
 * - High-contrast notice in 17-18px var(--ink)
 * - Plain triangle-exclamation SVG in 2px stroke. No emoji.
 * - Never collapsible, never dismissible.
 */
export function SafetyBlock({
  label = DEFAULT_LABEL,
  rules = DEFAULT_RULES,
  compact = false,
  children,
  style,
}: SafetyBlockProps) {
  return (
    <aside
      role="alert"
      aria-label={label}
      style={{
        border: '2px solid var(--ink)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* 10px high-contrast hazard stripe */}
      <div className="hazard-stripe" aria-hidden style={{ height: '10px' }} />

      <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          style={{ flexShrink: 0, color: 'var(--ink)' }}
        >
          <path d="M8 1.5L15 13.5H1L8 1.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 6V9M8 11.5H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {label}
        </span>
      </div>

      <div style={{ padding: compact ? '4px 16px 12px' : '6px 16px 16px' }}>
        {children ? (
          children
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              fontSize: compact ? '15px' : '17px',
              fontWeight: 500,
              color: 'var(--ink)',
              lineHeight: 1.55,
              listStyle: 'none',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {rules.map((rule, idx) => (
              <li key={idx} style={{ marginTop: idx > 0 ? '4px' : '2px' }}>
                {rule}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
