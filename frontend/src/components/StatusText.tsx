import React from 'react'

export type StatusType = 'verified' | 'ready' | 'draft' | 'processing' | 'failed' | string

export interface StatusTextProps {
  status: StatusType
  label?: string
  reason?: string
  progress?: number // 0 - 100 for processing
  style?: React.CSSProperties
}

/**
 * StatusText per 03-components.md section 6:
 * - Text label with 8px dot (no background pill)
 * - ● Verified, ○ Draft, ● Processing… (static progress line, no spinner), ● Failed (with reason)
 */
export function StatusText({ status, label, reason, progress, style }: StatusTextProps) {
  const norm = status.toLowerCase()

  let dotColor = 'var(--muted)'
  let textColor = 'var(--ink)'
  let isHollow = false
  let displayLabel = label || status

  if (norm === 'verified' || norm === 'ready') {
    dotColor = 'var(--success)'
    textColor = 'var(--success)'
  } else if (norm === 'draft') {
    dotColor = 'var(--muted)'
    textColor = 'var(--muted)'
    isHollow = true
  } else if (norm === 'processing') {
    dotColor = 'var(--primary)'
    textColor = 'var(--primary)'
    displayLabel = label || 'Processing…'
  } else if (norm === 'failed') {
    dotColor = 'var(--danger)'
    textColor = 'var(--danger)'
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', ...style }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontFamily: 'var(--font-ui)' }}>
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isHollow ? 'transparent' : dotColor,
            border: isHollow ? `1.5px solid ${dotColor}` : 'none',
            flexShrink: 0,
          }}
          aria-hidden
        />
        <span style={{ fontWeight: 500, color: textColor }}>{displayLabel}</span>
      </div>

      {norm === 'processing' && progress !== undefined && (
        <div
          style={{
            width: '100%',
            minWidth: '80px',
            height: '3px',
            background: 'var(--rule)',
            borderRadius: '1px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              background: 'var(--primary)',
            }}
          />
        </div>
      )}

      {norm === 'failed' && reason && (
        <span style={{ fontSize: '12px', color: 'var(--danger)', marginLeft: '16px' }}>
          {reason}
        </span>
      )}
    </div>
  )
}
