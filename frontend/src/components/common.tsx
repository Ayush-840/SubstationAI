import React from 'react'

// ── Safety block ──────────────────────────────────────────────────────────────
// Hazard-stripe top, 2px ink border, never collapsible.
// Replaces the old amber rounded banner.
export function SafetyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div role="alert" aria-label="Safety notice" style={{
      border: '2px solid var(--ink)',
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
    }}>
      <div className="hazard-stripe" aria-hidden />
      <div style={{ padding: '12px 16px 0' }}>
        <span style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink)',
          fontFamily: 'var(--font-ui)',
        }}>
          Safety before you start
        </span>
      </div>
      {!compact && (
        <ul style={{
          margin: '6px 0 0',
          padding: '0 16px 16px',
          fontSize: '17px',
          color: 'var(--ink)',
          lineHeight: 1.6,
          listStyle: 'none',
        }}>
          <li>Isolate. Earth. Verify dead.</li>
          <li>Permit-to-work in place. PPE on.</li>
          <li>This is a reminder, not your site procedure. Follow your utility's safety rules.</li>
        </ul>
      )}
    </div>
  )
}

// ── Danger notice ─────────────────────────────────────────────────────────────
export function DangerBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        border: '2px solid var(--danger)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--danger)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {message}
    </div>
  )
}

// ── Out-of-scope notice ───────────────────────────────────────────────────────
export function OutOfScopeNotice({ message }: { message: string }) {
  return (
    <div
      role="note"
      style={{
        border: '1px solid var(--rule)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        fontSize: '14px',
        color: 'var(--muted)',
      }}
    >
      {message}
    </div>
  )
}

// ── Confidence indicator ──────────────────────────────────────────────────────
// Only shown when below threshold — never a badge on everything.
export function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 0.5) return null // Only show when low
  return (
    <p style={{
      color: 'var(--warn)',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M7 1.5L13 12.5H1L7 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M7 5.5v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      Low confidence. Check this against the OEM manual before acting.
    </p>
  )
}

// ── Status text (dot + label) ─────────────────────────────────────────────────
// Replaces colored pills for status.
export function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    processing: 'var(--primary)',
    ready: 'var(--success)',
    verified: 'var(--success)',
    failed: 'var(--danger)',
    draft: 'var(--muted)',
  }
  const color = colorMap[status.toLowerCase()] ?? 'var(--muted)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color }}>
      <span style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }} aria-hidden />
      {status}
    </span>
  )
}

// ── Citation chip → superscript link ─────────────────────────────────────────
// Replaces colored citation chips with footnote-style superscripts.
export function CitationChip({ n, citation, onClick }: {
  n: number
  citation: { document: string; page: number | string; section?: string }
  onClick?: () => void
}) {
  return (
    <sup>
      <button
        onClick={onClick}
        aria-label={`Source ${n}: ${citation.document}, page ${citation.page}${citation.section ? ', ' + citation.section : ''}`}
        title={`${citation.document} · p.${citation.page}${citation.section ? ' · ' + citation.section : ''}`}
        style={{
          color: 'var(--primary)',
          fontSize: '11px',
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
        }}
      >
        {n}
      </button>
    </sup>
  )
}

// ── Wordmark ─────────────────────────────────────────────────────────────────
// Typographic wordmark — no emoji, "IQ" in primary color.
export function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="4" fill="var(--primary)" />
        <path d="M17.5 5 9 18h5.5L13 27l9.5-13.5H17L17.5 5z" fill="white" />
      </svg>
      <span style={{
        fontSize: '17px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: 'var(--ink)',
        fontFamily: 'var(--font-ui)',
      }}>
        Substation<span style={{ color: 'var(--primary)' }}>IQ</span>
      </span>
    </div>
  )
}

export const FOOTER_DISCLAIMER =
  'SubstationIQ is an aid, not a substitute for official procedures, permits and OEM instructions.'

export function Disclaimer() {
  return (
    <p style={{
      fontSize: '13px',
      color: 'var(--muted)',
      textAlign: 'center',
      padding: '0 16px',
    }}>
      {FOOTER_DISCLAIMER}
    </p>
  )
}
