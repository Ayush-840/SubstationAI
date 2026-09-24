import React from 'react'

// Safety banner: fixed (non-LLM) safety notice per TRD §8.5. Amber, high-contrast.
export function SafetyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="alert"
      className="rounded-card border border-warning bg-warning/10 px-4 py-3 text-sm"
      style={{ borderLeftWidth: '4px' }}
    >
      <div className="flex items-center gap-2 font-semibold text-txt">
        <span aria-hidden>🦺</span> Safety first
      </div>
      {!compact && (
        <ul className="mt-1.5 list-inside list-disc text-txt/90 space-y-0.5">
          <li>Isolate the equipment from all energy sources</li>
          <li>Apply earth / ground connections</li>
          <li>Verify zero voltage (dead condition)</li>
          <li>Obtain a valid permit-to-work</li>
          <li>Wear appropriate PPE &amp; follow site procedures</li>
        </ul>
      )}
    </div>
  )
}

// High-contrast critical banner (red) — used for refused bypass requests.
export function DangerBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-card border border-danger bg-danger/10 px-4 py-3 text-sm font-medium text-txt"
      style={{ borderLeftWidth: '4px' }}
    >
      <span aria-hidden>⛔</span> {message}
    </div>
  )
}

// Confidence badge: never colour alone — includes text (DESIGN.md §7).
export function ConfidenceBadge({ value }: { value: number }) {
  const level = value >= 0.5 ? 'High' : value >= 0.2 ? 'Medium' : 'Low'
  const cls =
    level === 'High'
      ? 'bg-success/15 text-success'
      : level === 'Medium'
        ? 'bg-warning/15 text-warning'
        : 'bg-danger/15 text-danger'
  return (
    <span className={`pill ${cls}`}>
      {level} confidence
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    processing: 'bg-primary/15 text-primary',
    ready: 'bg-success/15 text-success',
    failed: 'bg-danger/15 text-danger',
  }
  return <span className={`pill ${map[status] ?? 'bg-brdr text-muted'}`}>{status}</span>
}

export function CitationChip({ n, citation, onClick }: {
  n: number
  citation: { document: string; page: number | string; section?: string }
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="pill bg-accent/15 text-accent hover:bg-accent/25 cursor-pointer"
      title={`${citation.document} · p.${citation.page} ${citation.section ?? ''}`}
    >
      [{n}] {citation.document} · p.{citation.page}
    </button>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path d="M17.5 5 9 18h5.5L13 27l9.5-13.5H17L17.5 5z" fill="#fff" />
      </svg>
      <span className="text-lg font-semibold">SubstationIQ</span>
    </div>
  )
}

export const FOOTER_DISCLAIMER =
  'SubstationIQ is an aid, not a substitute for official procedures, permits and OEM instructions.'

export function Disclaimer() {
  return <p className="text-xs text-muted text-center px-4">{FOOTER_DISCLAIMER}</p>
}
