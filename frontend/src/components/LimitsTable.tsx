import React from 'react'

export interface LimitRow {
  parameter: string
  value: string | number
  unit?: string
  condition?: string
  standard?: string
  notes?: string
}

export interface LimitsTableProps {
  rows: LimitRow[]
  caption?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * LimitsTable per 03-components.md section 4:
 * - Desktop: Full width, 12px uppercase headers on --surface-sunken, 2px --rule-strong bottom rule.
 *   Body rows with 1px --rule bottom borders only, no vertical borders, no zebra stripes.
 *   Value in mono tabular-nums, unit in mono muted, condition/standard in muted.
 * - Mobile (< 640px): Stacked card layout with zero horizontal scroll:
 *   Parameter name, large value + unit, condition and standard below.
 */
export function LimitsTable({ rows, caption, className = '', style }: LimitsTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '14px', fontStyle: 'italic' }}>
        No limit parameters defined.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...style }} className={className}>
      {caption && (
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted)',
            marginBottom: '8px',
          }}
        >
          {caption}
        </div>
      )}

      {/* Desktop & Tablet Table (hidden below sm: 640px) */}
      <div className="hidden sm:block overflow-x-auto">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--surface-sunken)',
                borderBottom: '2px solid var(--rule-strong)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              <th style={{ padding: '10px 14px' }}>Parameter</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Value</th>
              <th style={{ padding: '10px 14px' }}>Unit</th>
              <th style={{ padding: '10px 14px' }}>Condition</th>
              <th style={{ padding: '10px 14px' }}>Standard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid var(--rule)',
                  fontSize: '14px',
                }}
              >
                <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ink)' }}>
                  {row.parameter}
                  {row.notes && (
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: 'var(--muted)', marginTop: '2px' }}>
                      {row.notes}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    textAlign: 'right',
                    fontFamily: 'var(--font-data)',
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.value}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontFamily: 'var(--font-data)',
                    color: 'var(--muted)',
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.unit || '—'}
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '13px' }}>
                  {row.condition || '—'}
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    fontFamily: 'var(--font-data)',
                    color: 'var(--muted)',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.standard || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Layout (hidden at sm and above) */}
      <div className="block sm:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((row, idx) => (
          <div
            key={idx}
            style={{
              padding: '12px',
              background: 'var(--surface)',
              border: '1px solid var(--rule)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* Parameter title */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {row.parameter}
            </div>

            {/* Value + Unit large on top */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.value}
              </span>
              {row.unit && (
                <span
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: '15px',
                    color: 'var(--muted)',
                  }}
                >
                  {row.unit}
                </span>
              )}
            </div>

            {/* Condition and Standard below */}
            {(row.condition || row.standard) && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  borderTop: '1px solid var(--rule)',
                  paddingTop: '6px',
                  marginTop: '2px',
                }}
              >
                {row.condition && <span>Condition: {row.condition}</span>}
                {row.standard && (
                  <span style={{ fontFamily: 'var(--font-data)' }}>
                    Standard: {row.standard}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
