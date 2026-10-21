import React, { useEffect } from 'react'
import type { CitationItem } from './Citation'
import { SectionLabel } from './SectionLabel'

export interface SourcesListProps {
  sources: CitationItem[]
  onSelectSource?: (source: CitationItem, index: number) => void
  style?: React.CSSProperties
}

/**
 * Sources list at the bottom of the structured sheet per 03-components.md section 2:
 * Numbered rows with `document title · section · page` in --text-small (13px);
 * the document name is the link.
 */
export function SourcesList({ sources, onSelectSource, style }: SourcesListProps) {
  if (!sources || sources.length === 0) return null

  return (
    <div style={{ marginTop: '16px', ...style }}>
      <SectionLabel>Sources</SectionLabel>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {sources.map((src, idx) => {
          const num = idx + 1
          return (
            <li
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--muted)',
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  color: 'var(--ink)',
                  fontWeight: 600,
                  minWidth: '16px',
                }}
              >
                {num}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => onSelectSource?.(src, idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--primary)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 500,
                    textAlign: 'left',
                  }}
                  className="focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {src.document}
                </button>
                {src.section && <span> · §{src.section}</span>}
                {src.page && <span> · p. {src.page}</span>}
                {src.standard && <span style={{ fontFamily: 'var(--font-data)' }}> · {src.standard}</span>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export interface SourcesPanelProps {
  source: CitationItem | null
  index?: number
  isOpen: boolean
  onClose: () => void
}

/**
 * SourcesPanel: desktop right side panel / mobile bottom sheet per 03-components.md:
 * - Scrolled to the passage with quoted text highlighted with subtle --hazard at 25% opacity
 * - Plain and responsive, keyboard accessible (Esc closes)
 */
export function SourcesPanel({ source, index = 0, isOpen, onClose }: SourcesPanelProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !source) return null

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 90,
          transition: 'opacity 150ms ease',
        }}
        aria-hidden
      />

      {/* Slide-out Panel (Desktop: Right drawer 420px; Mobile: Bottom sheet) */}
      <aside
        role="dialog"
        aria-label={`Source citation: ${source.document}`}
        aria-modal="true"
        style={{
          position: 'fixed',
          zIndex: 100,
          background: 'var(--surface)',
          border: '1px solid var(--rule-strong)',
          boxShadow: 'var(--shadow-overlay)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
        }}
        className="inset-x-0 bottom-0 rounded-t md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[420px] md:max-h-full md:rounded-none md:border-l md:border-t-0 md:border-b-0"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--rule)',
            background: 'var(--surface-sunken)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                marginBottom: '2px',
              }}
            >
              Source Citation [{index + 1}]
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--ink)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {source.document}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sources panel"
            style={{
              background: 'none',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius-sm)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--ink)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px 12px',
              fontSize: '13px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--rule)',
              paddingBottom: '16px',
            }}
          >
            {source.section && (
              <>
                <span style={{ color: 'var(--muted)' }}>Section:</span>
                <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{source.section}</span>
              </>
            )}
            {source.page && (
              <>
                <span style={{ color: 'var(--muted)' }}>Page:</span>
                <span style={{ fontWeight: 500, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>
                  {source.page}
                </span>
              </>
            )}
            {source.standard && (
              <>
                <span style={{ color: 'var(--muted)' }}>Standard:</span>
                <span style={{ fontWeight: 500, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>
                  {source.standard}
                </span>
              </>
            )}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <span
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: '8px',
              }}
            >
              Quoted Passage
            </span>
            <div
              style={{
                padding: '16px',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius)',
                fontSize: '15px',
                lineHeight: 1.6,
                color: 'var(--ink)',
              }}
            >
              {source.quote ? (
                <mark
                  style={{
                    backgroundColor: 'rgba(255, 187, 0, 0.25)', // subtle --hazard at 25% opacity
                    color: 'inherit',
                    padding: '2px 4px',
                    borderRadius: '2px',
                  }}
                >
                  {source.quote}
                </mark>
              ) : (
                <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                  Referenced from document "{source.document}" (page {source.page || 'N/A'}).
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
