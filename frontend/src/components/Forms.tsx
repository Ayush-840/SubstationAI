import React, { forwardRef } from 'react'

export interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  requiredNotice?: string
  error?: string
  hint?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

/**
 * Standard field container per 03-components.md section 11:
 * - Label above field, 14px / 600, always visible
 * - Required marked with "required" in muted text
 * - Inline error message in --danger with SVG icon and plain text
 */
export function Field({
  label,
  htmlFor,
  required = false,
  requiredNotice = 'required',
  error,
  hint,
  children,
  style,
}: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <label
          htmlFor={htmlFor}
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {label}
        </label>
        {required && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {requiredNotice}
          </span>
        )}
      </div>

      {children}

      {hint && !error && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-ui)' }}>
          {hint}
        </p>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--danger)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isNumeric?: boolean
  unitSuffix?: string
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { isNumeric = false, unitSuffix, hasError = false, style, className = '', ...props },
  ref
) {
  const inputEl = (
    <input
      ref={ref}
      style={{
        width: '100%',
        minHeight: '48px',
        padding: unitSuffix ? '0 8px 0 12px' : '0 12px',
        borderRadius: unitSuffix ? 'var(--radius-sm) 0 0 var(--radius-sm)' : 'var(--radius-sm)',
        border: hasError ? '1px solid var(--danger)' : '1px solid var(--rule-strong)',
        background: 'var(--surface)',
        color: 'var(--ink)',
        fontSize: '15px',
        fontFamily: isNumeric ? 'var(--font-data)' : 'var(--font-ui)',
        boxSizing: 'border-box',
        fontVariantNumeric: isNumeric ? 'tabular-nums' : undefined,
        ...style,
      }}
      className={`focus:outline-none focus:border-ink ${className}`}
      {...props}
    />
  )

  if (unitSuffix) {
    return (
      <div style={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
        {inputEl}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 12px',
            background: 'var(--surface-sunken)',
            border: hasError ? '1px solid var(--danger)' : '1px solid var(--rule-strong)',
            borderLeft: 'none',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
            color: 'var(--muted)',
            fontSize: '14px',
            fontFamily: 'var(--font-data)',
            whiteSpace: 'nowrap',
          }}
        >
          {unitSuffix}
        </span>
      </div>
    )
  }

  return inputEl
})

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean
  options?: { value: string | number; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { hasError = false, options, children, style, className = '', ...props },
  ref
) {
  return (
    <select
      ref={ref}
      style={{
        width: '100%',
        minHeight: '48px',
        padding: '0 12px',
        borderRadius: 'var(--radius-sm)',
        border: hasError ? '1px solid var(--danger)' : '1px solid var(--rule-strong)',
        background: 'var(--surface)',
        color: 'var(--ink)',
        fontSize: '15px',
        fontFamily: 'var(--font-ui)',
        boxSizing: 'border-box',
        cursor: 'pointer',
        ...style,
      }}
      className={`focus:outline-none focus:border-ink ${className}`}
      {...props}
    >
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  )
})

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, checked, disabled, style, id, ...props },
  ref
) {
  const autoId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <label
      htmlFor={autoId}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        minHeight: '48px',
        padding: '8px 0',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        userSelect: 'none',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', height: '24px' }}>
        <input
          ref={ref}
          id={autoId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          style={{
            width: '18px',
            height: '18px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            accentColor: 'var(--primary)',
            borderRadius: '2px',
            border: '1px solid var(--ink)',
          }}
          {...props}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--ink)',
            lineHeight: '24px',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {label}
        </span>
        {description && (
          <span
            style={{
              fontSize: '13px',
              color: 'var(--muted)',
              marginTop: '2px',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {description}
          </span>
        )}
      </div>
    </label>
  )
})
