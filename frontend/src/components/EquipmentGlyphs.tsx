import React from 'react'

export interface GlyphProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

/**
 * Custom 24px single-line-diagram equipment glyphs per 02-design-tokens.md & 03-components.md:
 * Single stroke weight (1.5px), crisp technical diagram aesthetics.
 */

// All Substation Equipment (Busbar node & branch topology)
export function AllEquipmentGlyph({ size = 20, ...props }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* Main Busbar */}
      <line x1="2" y1="6" x2="22" y2="6" strokeWidth="2" />
      {/* Feeders & Branches */}
      <line x1="6" y1="6" x2="6" y2="18" />
      <line x1="12" y1="6" x2="12" y2="14" />
      <line x1="18" y1="6" x2="18" y2="18" />
      {/* Bus Connection Nodes */}
      <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" />
    </svg>
  )
}

// Power Transformer (Two interlocking/adjacent inductive coils)
export function TransformerGlyph({ size = 20, ...props }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* Top terminal */}
      <line x1="12" y1="2" x2="12" y2="6" />
      {/* Primary Coil Circle */}
      <circle cx="12" cy="9.5" r="3.5" />
      {/* Secondary Coil Circle */}
      <circle cx="12" cy="14.5" r="3.5" />
      {/* Bottom terminal */}
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  )
}

// Shunt / Series Reactor (Inductor with core)
export function ReactorGlyph({ size = 20, ...props }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* Terminals */}
      <line x1="3" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="21" y2="12" />
      {/* 3 Coils / loops */}
      <path d="M6 12a3 3 0 0 1 4-2.5 3 3 0 0 1 4 0 3 3 0 0 1 4 2.5" />
      {/* Magnetic Core Line */}
      <line x1="6" y1="6" x2="18" y2="6" strokeDasharray="2 2" />
    </svg>
  )
}

// Circuit Breaker (Standard single-line symbol: Square / contact mechanism)
export function BreakerGlyph({ size = 20, ...props }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* Top and Bottom Line */}
      <line x1="12" y1="2" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="22" />
      {/* Breaker Box */}
      <rect x="7" y="7" width="10" height="10" rx="1" />
      {/* Internal Cross / Breaker Indicator */}
      <line x1="7" y1="7" x2="17" y2="17" />
    </svg>
  )
}

// Instrument Transformer: CT (Current Transformer) / CVT
export function InstrumentTransformerGlyph({ size = 20, ...props }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* Primary line passing straight through */}
      <line x1="2" y1="12" x2="22" y2="12" />
      {/* Toroidal sensing ring / CT core */}
      <circle cx="12" cy="12" r="5" />
      {/* Secondary winding leads */}
      <line x1="12" y1="17" x2="12" y2="22" />
      <line x1="10" y1="22" x2="14" y2="22" />
    </svg>
  )
}

// Surge Arrester (Non-linear varistor with spark gap and earth ground)
export function SurgeArresterGlyph({ size = 20, ...props }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* Line In */}
      <line x1="12" y1="2" x2="12" y2="6" />
      {/* Spark Gap / Lightning arrow into varistor */}
      <path d="M12 6l-2 4h4l-2 4" />
      {/* Ground lead */}
      <line x1="12" y1="14" x2="12" y2="18" />
      {/* Earth Ground Symbol */}
      <line x1="7" y1="18" x2="17" y2="18" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="11" y1="22" x2="13" y2="22" />
    </svg>
  )
}
