import React, { forwardRef } from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive'
  size?: 'default' | 'small'
  fullWidth?: boolean
  disabledReason?: string
  icon?: React.ReactNode
}

/**
 * Technical engineering button adhering to 03-components.md:
 * - Primary: solid --primary, --primary-ink text, 4px radius, 48px min height, 16px / 600
 * - Secondary: 1px --ink border, transparent bg, --ink text
 * - Tertiary: text only, underlined on hover, --primary
 * - Destructive: 1px --danger border or solid --danger
 * - Disabled: 40% opacity, aria-disabled, optional disabled reason
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'default',
    fullWidth = false,
    disabledReason,
    icon,
    disabled,
    children,
    style,
    className = '',
    title,
    ...props
  },
  ref
) {
  const isSmall = size === 'small'
  const minHeight = isSmall ? '36px' : '48px'
  const fontSize = isSmall ? '14px' : '16px'
  const padding = isSmall ? '0 12px' : '0 20px'

  let variantStyle: React.CSSProperties = {}

  if (variant === 'primary') {
    variantStyle = {
      background: 'var(--primary)',
      color: 'var(--primary-ink)',
      border: 'none',
      fontWeight: 600,
    }
  } else if (variant === 'secondary') {
    variantStyle = {
      background: 'transparent',
      color: 'var(--ink)',
      border: '1px solid var(--ink)',
      fontWeight: 500,
    }
  } else if (variant === 'tertiary') {
    variantStyle = {
      background: 'transparent',
      color: 'var(--primary)',
      border: 'none',
      padding: '0 8px',
      minHeight: isSmall ? '32px' : '44px',
      fontWeight: 500,
      textDecoration: 'none',
    }
  } else if (variant === 'destructive') {
    variantStyle = {
      background: 'transparent',
      color: 'var(--danger)',
      border: '1px solid var(--danger)',
      fontWeight: 600,
    }
  }

  const combinedStyle: React.CSSProperties = {
    display: fullWidth ? 'flex' : 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: fullWidth ? '100%' : 'auto',
    minHeight,
    minWidth: isSmall ? '36px' : '48px',
    padding,
    fontSize,
    borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-ui)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    lineHeight: 1,
    boxSizing: 'border-box',
    transition: 'background-color 100ms, border-color 100ms, opacity 100ms',
    ...variantStyle,
    ...style,
  }

  return (
    <div style={{ display: fullWidth ? 'block' : 'inline-block' }}>
      <button
        ref={ref}
        disabled={disabled}
        aria-disabled={disabled}
        title={disabled && disabledReason ? disabledReason : title}
        style={combinedStyle}
        className={`focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary ${className}`}
        {...props}
      >
        {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
        <span>{children}</span>
      </button>
      {disabled && disabledReason && (
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--muted)',
            marginTop: '4px',
          }}
        >
          {disabledReason}
        </span>
      )}
    </div>
  )
})

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  underline?: boolean
}

export function Link({ underline = true, children, style, ...props }: LinkProps) {
  return (
    <a
      style={{
        color: 'var(--primary)',
        textDecoration: underline ? 'underline' : 'none',
        cursor: 'pointer',
        fontSize: 'inherit',
        fontFamily: 'var(--font-ui)',
        ...style,
      }}
      {...props}
    >
      {children}
    </a>
  )
}
