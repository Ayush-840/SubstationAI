import React from 'react'

export interface CitationItem {
  id?: string | number
  document: string
  page?: number | string
  section?: string
  quote?: string
  standard?: string
}

export interface CitationProps {
  n: number
  source: CitationItem
  onClick?: (source: CitationItem) => void
  style?: React.CSSProperties
}

/**
 * Footnote-style superscript citation per 03-components.md section 2:
 * - Superscript number link in --primary
 * - No background pill, underline on hover
 * - Minimum touch target 24x24 px (44px on touch devices)
 * - Clear aria-label for accessibility
 */
export function Citation({ n, source, onClick, style }: CitationProps) {
  const label = `Source ${n}: ${source.document}${source.page ? `, page ${source.page}` : ''}${
    source.section ? `, section ${source.section}` : ''
  }`
  const title = `${source.document}${source.page ? ` · p.${source.page}` : ''}${
    source.section ? ` · §${source.section}` : ''
  }`

  return (
    <sup style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: 0 }}>
      <button
        type="button"
        onClick={() => onClick?.(source)}
        aria-label={label}
        title={title}
        style={{
          color: 'var(--primary)',
          fontSize: '11px',
          fontWeight: 600,
          textDecoration: 'underline',
          background: 'none',
          border: 'none',
          padding: '2px 4px',
          cursor: 'pointer',
          minWidth: '24px',
          minHeight: '24px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-data)',
          ...style,
        }}
        className="focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {n}
      </button>
    </sup>
  )
}
