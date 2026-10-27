import React from 'react'

// Re-export all core Phase 2 components
export * from './Button'
export * from './Forms'
export * from './SectionLabel'
export * from './SafetyBlock'
export * from './LimitsTable'
export * from './Citation'
export * from './Sources'
export * from './VerdictStamp'
export * from './StatusText'
export * from './EquipmentGlyphs'
export * from './EquipmentFilter'
export * from './Feedback'
export * from './Wordmark'
export * from './TestSheet'

import { SafetyBlock } from './SafetyBlock'
import { StatusText } from './StatusText'
import { copy } from '../copy'
import { Citation as CitationComponent } from './Citation'
import { Wordmark } from './Wordmark'

// ── Backward-compatible Aliases ──────────────────────────────────────────────

/**
 * SafetyBanner: backward-compatible wrapper for SafetyBlock
 */
export function SafetyBanner({ compact = false }: { compact?: boolean }) {
  return <SafetyBlock compact={compact} />
}

/**
 * StatusPill: backward-compatible wrapper for StatusText (dot + label)
 */
export function StatusPill({ status }: { status: string }) {
  return <StatusText status={status} />
}

/**
 * CitationChip: backward-compatible wrapper for footnote Citation
 */
export function CitationChip({
  n,
  citation,
  onClick,
}: {
  n: number
  citation: { document: string; page: number | string; section?: string }
  onClick?: () => void
}) {
  return <CitationComponent n={n} source={citation} onClick={onClick} />
}

/**
 * Logo: backward-compatible wrapper for Wordmark
 */
export function Logo({ size }: { size?: 'default' | 'small' | 'large' }) {
  return <Wordmark size={size} />
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
        <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
    <p
      style={{
        color: 'var(--warn)',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M7 1.5L13 12.5H1L7 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7 5.5v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {copy.pages.components.testSheet.confidence}
    </p>
  )
}

export function Disclaimer({ style }: { style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontSize: '13px',
        color: 'var(--muted)',
        textAlign: 'center',
        padding: '0 16px',
        ...style,
      }}
    >
      {copy.brand.footerDisclaimer}
    </p>
  )
}
