import React from 'react'

export type VerdictType = 'within_limit' | 'borderline' | 'outside_limit' | 'pass' | 'fail' | 'warn'

export interface VerdictDetail {
  enteredValue?: string | number
  limitApplied?: string
  condition?: string
  source?: string
}

export interface VerdictStampProps {
  verdict: VerdictType
  details?: VerdictDetail
  troubleshooting?: string[]
  style?: React.CSSProperties
}

/**
 * VerdictStamp per 03-components.md section 5:
 * - Rectangular stamp: 2px border in semantic color, uppercase 14px mono label, --radius-sm (2px)
 * - Always icon + text + color:
 *   - WITHIN LIMIT (check icon, --success)
 *   - BORDERLINE (minus/alert icon, --warn)
 *   - OUTSIDE LIMIT (X icon, --danger)
 * - Two-column definition list for entered value, limit, condition, source
 * - Troubleshooting list for outside-limit results
 */
export function VerdictStamp({ verdict, details, troubleshooting, style }: VerdictStampProps) {
  const normVerdict = verdict.toLowerCase()

  let label = 'WITHIN LIMIT'
  let color = 'var(--success)'
  let icon = (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="2 8 6 12 14 3" />
    </svg>
  )

  if (normVerdict.includes('outside') || normVerdict === 'fail') {
    label = 'OUTSIDE LIMIT'
    color = 'var(--danger)'
    icon = (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="3" y1="3" x2="13" y2="13" />
        <line x1="13" y1="3" x2="3" y2="13" />
      </svg>
    )
  } else if (normVerdict.includes('borderline') || normVerdict === 'warn') {
    label = 'BORDERLINE'
    color = 'var(--warn)'
    icon = (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="3" y1="8" x2="13" y2="8" />
      </svg>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', ...style }}>
      {/* Stamp box */}
      <div style={{ display: 'inline-flex' }}>
        <div
          role="status"
          aria-label={`Verdict: ${label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: `2px solid ${color}`,
            borderRadius: 'var(--radius-sm)',
            padding: '6px 14px',
            background: 'var(--surface)',
            color: color,
            fontFamily: 'var(--font-data)',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {icon}
          <span>{label}</span>
        </div>
      </div>

      {/* Details definition list */}
      {details && (
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            fontSize: '13px',
            padding: '12px 14px',
            background: 'var(--surface-sunken)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--rule)',
          }}
        >
          {details.enteredValue !== undefined && (
            <>
              <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Entered value:</dt>
              <dd style={{ margin: 0, color: 'var(--ink)', fontWeight: 600, fontFamily: 'var(--font-data)' }}>
                {details.enteredValue}
              </dd>
            </>
          )}
          {details.limitApplied && (
            <>
              <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Limit applied:</dt>
              <dd style={{ margin: 0, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>
                {details.limitApplied}
              </dd>
            </>
          )}
          {details.condition && (
            <>
              <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Condition:</dt>
              <dd style={{ margin: 0, color: 'var(--muted)' }}>{details.condition}</dd>
            </>
          )}
          {details.source && (
            <>
              <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Source:</dt>
              <dd style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-data)' }}>
                {details.source}
              </dd>
            </>
          )}
        </dl>
      )}

      {/* Troubleshooting for outside-limit results */}
      {label === 'OUTSIDE LIMIT' && troubleshooting && troubleshooting.length > 0 && (
        <div
          style={{
            marginTop: '4px',
            padding: '12px 14px',
            border: '1px solid var(--rule)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--danger)',
              marginBottom: '6px',
            }}
          >
            If outside limits · Probable Causes & Actions
          </span>
          <ul
            style={{
              margin: 0,
              paddingLeft: '18px',
              fontSize: '14px',
              color: 'var(--ink)',
              lineHeight: 1.5,
            }}
          >
            {troubleshooting.map((item, idx) => (
              <li key={idx} style={{ marginTop: idx > 0 ? '4px' : '0' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
