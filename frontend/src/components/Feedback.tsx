import React, { useEffect } from 'react'
import { Button } from './Button'
import { AllEquipmentGlyph } from './EquipmentGlyphs'

// ── Dialog ──────────────────────────────────────────────────────────────────
export interface DialogProps {
  isOpen: boolean
  title: string
  description?: string
  children?: React.ReactNode
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  confirmVariant?: 'primary' | 'destructive'
  cancelLabel?: string
  style?: React.CSSProperties
}

/**
 * Dialog per 03-components.md section 12:
 * 4px radius, 1px border, overlay shadow allowed, no bouncy scale animation.
 */
export function Dialog({
  isOpen,
  title,
  description,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
  style,
}: DialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Overlay backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
        }}
        aria-hidden
      />

      {/* Modal Card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          background: 'var(--surface)',
          border: '1px solid var(--rule-strong)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-overlay)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          ...style,
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule)' }}>
          <h2
            id="dialog-title"
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--ink)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '14px',
                color: 'var(--muted)',
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </div>

        {children && <div style={{ padding: '20px 24px' }}>{children}</div>}

        <div
          style={{
            padding: '16px 24px',
            background: 'var(--surface-sunken)',
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <Button variant="secondary" size="small" onClick={onClose}>
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button variant={confirmVariant} size="small" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Toast ───────────────────────────────────────────────────────────────────
export interface ToastProps {
  message: string
  isOpen: boolean
  onClose?: () => void
  actionLabel?: string
  onAction?: () => void
  style?: React.CSSProperties
}

/**
 * Toast per 03-components.md section 12:
 * Solid --ink background with --bg text, 4px radius, role="status".
 */
export function Toast({
  message,
  isOpen,
  onClose,
  actionLabel,
  onAction,
  style,
}: ToastProps) {
  useEffect(() => {
    if (isOpen && onClose) {
      const timer = setTimeout(onClose, 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: 'var(--ink)',
        color: 'var(--bg)',
        padding: '12px 20px',
        borderRadius: 'var(--radius)',
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: 'var(--font-ui)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        maxWidth: '90vw',
        boxShadow: 'var(--shadow-overlay)',
        ...style,
      }}
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            textDecoration: 'underline',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            fontSize: '14px',
          }}
        >
          {actionLabel}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss toast"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--bg)',
            opacity: 0.7,
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: '14px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── EmptyState ──────────────────────────────────────────────────────────────
export interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * EmptyState per 03-components.md section 12:
 * Single-line-diagram custom line illustration, one sentence, one action.
 * No generic robot or emoji.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  style,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        border: '1px dashed var(--rule-strong)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        ...style,
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius)',
          background: 'var(--surface-sunken)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          marginBottom: '16px',
          border: '1px solid var(--rule)',
        }}
      >
        {icon || <AllEquipmentGlyph size={28} />}
      </div>
      <h3
        style={{
          margin: '0 0 6px',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: '0 0 20px',
          fontSize: '14px',
          color: 'var(--muted)',
          maxWidth: '380px',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="small" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// ── Placeholder (Static Loading Bars) ───────────────────────────────────────
export interface PlaceholderProps {
  lines?: number
  height?: string
  style?: React.CSSProperties
}

/**
 * Static placeholder bars per 03-components.md section 12:
 * In --surface-sunken, strictly NO animated shimmer or gradient.
 */
export function Placeholder({ lines = 3, height = '16px', style }: PlaceholderProps) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        ...style,
      }}
    >
      {Array.from({ length: lines }).map((_, idx) => {
        const width = idx === lines - 1 && lines > 1 ? '60%' : '100%'
        return (
          <div
            key={idx}
            style={{
              height,
              width,
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--rule)',
            }}
          />
        )
      })}
    </div>
  )
}
