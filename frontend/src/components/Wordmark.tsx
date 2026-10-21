import React from 'react'

export interface WordmarkProps {
  size?: 'default' | 'small' | 'large'
  style?: React.CSSProperties
}

/**
 * Typographic wordmark with custom single-line-diagram electrical mark per 03-components.md section 13:
 * - No emoji
 * - 4px radius on mark, single-line diagram symbol
 * - "SubstationIQ" with "IQ" in --primary
 */
export function Wordmark({ size = 'default', style }: WordmarkProps) {
  const isSmall = size === 'small'
  const isLarge = size === 'large'

  const markSize = isSmall ? 22 : isLarge ? 34 : 28
  const fontSize = isSmall ? '15px' : isLarge ? '20px' : '17px'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '6px' : '8px',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Precision Single-Line-Diagram Icon Mark */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        style={{ flexShrink: 0 }}
      >
        {/* Solid container with 4px radius */}
        <rect width="32" height="32" rx="4" fill="var(--primary)" />
        {/* Schematic line & node in high contrast primary-ink */}
        {/* Main feeder conductor */}
        <line x1="6" y1="16" x2="26" y2="16" stroke="var(--primary-ink)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Primary coil / contact gap */}
        <circle cx="12" cy="16" r="4.5" stroke="var(--primary-ink)" strokeWidth="2" fill="none" />
        <circle cx="20" cy="16" r="4.5" stroke="var(--primary-ink)" strokeWidth="2" fill="none" />
        {/* Branch terminal */}
        <line x1="16" y1="7" x2="16" y2="11.5" stroke="var(--primary-ink)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="6" r="1.5" fill="var(--primary-ink)" />
      </svg>

      {/* Typographic Label */}
      <span
        style={{
          fontSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1,
        }}
      >
        Substation<span style={{ color: 'var(--primary)' }}>IQ</span>
      </span>
    </div>
  )
}
