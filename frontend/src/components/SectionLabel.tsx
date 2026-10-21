import React from 'react'

export interface SectionLabelProps {
  children: React.ReactNode
  id?: string
  topRule?: boolean
  style?: React.CSSProperties
  action?: React.ReactNode
}

/**
 * SectionLabel per 03-components.md section 1:
 * - 12 px uppercase
 * - letter-spacing: 0.08em
 * - --muted text
 * - top rule 1px --rule (when topRule=true, default)
 * - No emoji
 */
export function SectionLabel({
  children,
  id,
  topRule = true,
  style,
  action,
}: SectionLabelProps) {
  return (
    <div
      id={id}
      style={{
        borderTop: topRule ? '1px solid var(--rule)' : 'none',
        paddingTop: topRule ? '16px' : '0',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style,
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {children}
      </span>
      {action && <div>{action}</div>}
    </div>
  )
}
