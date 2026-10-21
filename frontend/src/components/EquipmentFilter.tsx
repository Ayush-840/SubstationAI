import React from 'react'
import {
  AllEquipmentGlyph,
  TransformerGlyph,
  ReactorGlyph,
  BreakerGlyph,
  InstrumentTransformerGlyph,
  SurgeArresterGlyph,
} from './EquipmentGlyphs'

export type EquipmentCategory =
  | 'all'
  | 'transformer'
  | 'reactor'
  | 'breaker'
  | 'instrument_transformer'
  | 'surge_arrester'

export interface EquipmentOption {
  id: EquipmentCategory
  label: string
  glyph: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
}

export const EQUIPMENT_OPTIONS: EquipmentOption[] = [
  { id: 'all', label: 'All', glyph: AllEquipmentGlyph },
  { id: 'transformer', label: 'Transformer', glyph: TransformerGlyph },
  { id: 'reactor', label: 'Reactor', glyph: ReactorGlyph },
  { id: 'breaker', label: 'Breaker', glyph: BreakerGlyph },
  { id: 'instrument_transformer', label: 'Instrument Transformer', glyph: InstrumentTransformerGlyph },
  { id: 'surge_arrester', label: 'Surge Arrester', glyph: SurgeArresterGlyph },
]

export interface EquipmentFilterProps {
  selected: EquipmentCategory
  onChange: (category: EquipmentCategory) => void
  style?: React.CSSProperties
}

/**
 * EquipmentFilter per 03-components.md section 8:
 * - Single-select segmented row with custom equipment glyph + text label
 * - Selected: 2px bottom rule in --primary and --ink text
 * - Unselected: --muted
 * - Mobile: scrolls horizontally with edge fade
 */
export function EquipmentFilter({ selected, onChange, style }: EquipmentFilterProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderBottom: '1px solid var(--rule)',
        ...style,
      }}
    >
      <div
        role="tablist"
        aria-label="Equipment filter"
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none', // hide default scrollbar
          msOverflowStyle: 'none',
          paddingBottom: '0px',
        }}
        className="no-scrollbar"
      >
        {EQUIPMENT_OPTIONS.map((item) => {
          const isSelected = selected === item.id
          const Glyph = item.glyph

          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(item.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-1px', // overlaps container border
                color: isSelected ? 'var(--ink)' : 'var(--muted)',
                fontWeight: isSelected ? 600 : 500,
                fontSize: '14px',
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'color 100ms, border-color 100ms',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'
              }}
            >
              <Glyph size={18} style={{ color: isSelected ? 'var(--primary)' : 'currentColor' }} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
