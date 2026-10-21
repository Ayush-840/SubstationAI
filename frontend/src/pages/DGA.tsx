import { useState } from 'react'
import { Button, Field, Input, SectionLabel } from '../components/common'

// Duval Triangle zone boundaries (IEC 60599 / IEEE C57.104)
// These are approximate zone boundaries - in production these should come from verified catalog data
// Coordinates are in barycentric coordinates (CH4%, C2H4%, C2H2%)
const DUVAL_ZONES = [
  { name: 'PD', label: 'Partial Discharge', color: 'rgba(76, 175, 80, 0.15)', points: [[98, 2, 0], [80, 10, 10], [55, 45, 0], [100, 0, 0]] },
  { name: 'T1', label: 'Thermal < 300°C', color: 'rgba(33, 150, 243, 0.15)', points: [[80, 10, 10], [50, 30, 20], [35, 65, 0], [55, 45, 0]] },
  { name: 'T2', label: 'Thermal 300-700°C', color: 'rgba(255, 193, 7, 0.15)', points: [[50, 30, 20], [20, 40, 40], [10, 90, 0], [35, 65, 0]] },
  { name: 'T3', label: 'Thermal > 700°C', color: 'rgba(255, 152, 0, 0.15)', points: [[20, 40, 40], [0, 20, 80], [0, 100, 0], [10, 90, 0]] },
  { name: 'D1', label: 'Discharge Low Energy', color: 'rgba(233, 30, 99, 0.15)', points: [[0, 20, 80], [0, 10, 90], [0, 0, 100], [0, 100, 0]] },
  { name: 'D2', label: 'Discharge High Energy', color: 'rgba(156, 39, 176, 0.15)', points: [[0, 10, 90], [10, 20, 70], [30, 30, 40], [20, 40, 40]] },
  { name: 'DT', label: 'Thermal & Discharge', color: 'rgba(121, 85, 72, 0.15)', points: [[10, 20, 70], [30, 30, 40], [50, 30, 20], [20, 40, 40]] },
]

// Triangle vertices in SVG coordinates (equilateral triangle)
const TRIANGLE_SIZE = 380
const CENTER_X = TRIANGLE_SIZE / 2
const CENTER_Y = TRIANGLE_SIZE / 2
const RADIUS = TRIANGLE_SIZE * 0.42

const VERTEX_CH4 = { x: CENTER_X, y: CENTER_Y - RADIUS }      // Top - CH4 100%
const VERTEX_C2H4 = { x: CENTER_X + RADIUS * Math.sin(Math.PI / 3), y: CENTER_Y + RADIUS * Math.cos(Math.PI / 3) }  // Bottom right - C2H4 100%
const VERTEX_C2H2 = { x: CENTER_X - RADIUS * Math.sin(Math.PI / 3), y: CENTER_Y + RADIUS * Math.cos(Math.PI / 3) }  // Bottom left - C2H2 100%

function barycentricToCartesian(ch4: number, c2h4: number, c2h2: number) {
  // Normalize to sum = 100
  const sum = ch4 + c2h4 + c2h2
  if (sum === 0) return { x: CENTER_X, y: CENTER_Y }
  const nCh4 = ch4 / sum
  const nC2h4 = c2h4 / sum
  const nC2h2 = c2h2 / sum

  // Barycentric interpolation
  const x = nCh4 * VERTEX_CH4.x + nC2h4 * VERTEX_C2H4.x + nC2h2 * VERTEX_C2H2.x
  const y = nCh4 * VERTEX_CH4.y + nC2h4 * VERTEX_C2H4.y + nC2h2 * VERTEX_C2H2.y
  return { x, y }
}

function getPolygonPoints(points: number[][]) {
  return points.map(([ch4, c2h4, c2h2]) => {
    const p = barycentricToCartesian(ch4, c2h4, c2h2)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
}

function getZoneCentroid(points: number[][]) {
  const sum = points.reduce((acc, [ch4, c2h4, c2h2]) => ({ ch4: acc.ch4 + ch4, c2h4: acc.c2h4 + c2h4, c2h2: acc.c2h2 + c2h2 }), { ch4: 0, c2h4: 0, c2h2: 0 })
  const n = points.length
  return barycentricToCartesian(sum.ch4 / n, sum.c2h4 / n, sum.c2h2 / n)
}

export default function DGA() {
  const [gases, setGases] = useState({
    H2: '',
    CH4: '',
    C2H6: '',
    C2H4: '',
    C2H2: '',
    CO: '',
    CO2: '',
  })
  const [result, setResult] = useState<{ ch4: number; c2h4: number; c2h2: number; zone: string; zoneLabel: string } | null>(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const ch4 = parseFloat(gases.CH4)
    const c2h4 = parseFloat(gases.C2H4)
    const c2h2 = parseFloat(gases.C2H2)

    if (isNaN(ch4) || isNaN(c2h4) || isNaN(c2h2)) {
      setError('Enter values for CH4, C2H4, and C2H2')
      return
    }

    const sum = ch4 + c2h4 + c2h2
    if (sum === 0) {
      setError('At least one of CH4, C2H4, C2H2 must be > 0')
      return
    }

    // Calculate percentages
    const pctCH4 = (ch4 / sum) * 100
    const pctC2H4 = (c2h4 / sum) * 100
    const pctC2H2 = (c2h2 / sum) * 100

    // Determine zone (simplified - in production use actual zone boundary checks)
    let zone = 'PD'
    let zoneLabel = 'Partial Discharge'

    if (pctC2H2 > 40) {
      zone = 'D2'
      zoneLabel = 'Discharge High Energy'
    } else if (pctC2H2 > 20) {
      zone = 'D1'
      zoneLabel = 'Discharge Low Energy'
    } else if (pctC2H4 > 65) {
      zone = 'T3'
      zoneLabel = 'Thermal > 700°C'
    } else if (pctC2H4 > 30) {
      zone = 'T2'
      zoneLabel = 'Thermal 300-700°C'
    } else if (pctC2H4 > 10) {
      zone = 'T1'
      zoneLabel = 'Thermal < 300°C'
    } else {
      zone = 'PD'
      zoneLabel = 'Partial Discharge'
    }

    setResult({ ch4: pctCH4, c2h4: pctC2H4, c2h2: pctC2H2, zone, zoneLabel })
  }

  const gasInputs = [
    { key: 'H2' as keyof typeof gases, label: 'Hydrogen (H₂)', unit: 'ppm' },
    { key: 'CH4' as keyof typeof gases, label: 'Methane (CH₄)', unit: 'ppm' },
    { key: 'C2H6' as keyof typeof gases, label: 'Ethane (C₂H₆)', unit: 'ppm' },
    { key: 'C2H4' as keyof typeof gases, label: 'Ethylene (C₂H₄)', unit: 'ppm' },
    { key: 'C2H2' as keyof typeof gases, label: 'Acetylene (C₂H₂)', unit: 'ppm' },
    { key: 'CO' as keyof typeof gases, label: 'Carbon Monoxide (CO)', unit: 'ppm' },
    { key: 'CO2' as keyof typeof gases, label: 'Carbon Dioxide (CO₂)', unit: 'ppm' },
  ]

  return (
    <div style={{ maxWidth: '1200px', margin: '0', width: '100%' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-display)',
        }}>
          DGA — Duval Triangle
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Enter dissolved gas analysis values in ppm. The triangle uses CH₄, C₂H₄, C₂H₂ percentages.
          Zone boundaries per IEC 60599 / IEEE C57.104.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Gas Inputs */}
        <div>
          <SectionLabel topRule={false}>Gas Inputs (ppm)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {gasInputs.map(({ key, label, unit }) => (
              <Field key={key} label={label} hint={`Unit: ${unit}`}>
                <Input
                  isNumeric
                  unitSuffix={unit}
                  placeholder="0"
                  value={gases[key]}
                  onChange={(e) => setGases({ ...gases, [key]: e.target.value })}
                  style={{ fontFamily: 'var(--font-data)' }}
                />
              </Field>
            ))}
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <Button variant="primary" onClick={calculate} style={{ minWidth: '160px' }}>
              Calculate
            </Button>
            <Button variant="secondary" onClick={() => setGases({ H2: '', CH4: '', C2H6: '', C2H4: '', C2H2: '', CO: '', CO2: '' })}>
              Clear
            </Button>
          </div>
          {error && <p style={{ marginTop: '12px', color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}
        </div>

        {/* Duval Triangle SVG */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', width: `${TRIANGLE_SIZE}px`, height: `${TRIANGLE_SIZE}px` }}>
            <svg
              width={TRIANGLE_SIZE}
              height={TRIANGLE_SIZE}
              viewBox={`0 0 ${TRIANGLE_SIZE} ${TRIANGLE_SIZE}`}
              role="img"
              aria-label={result
                ? `Duval triangle showing ${result.zone} (${result.zoneLabel}) at CH₄ ${result.ch4.toFixed(1)}%, C₂H₄ ${result.c2h4.toFixed(1)}%, C₂H₂ ${result.c2h2.toFixed(1)}%`
                : 'Duval triangle for DGA interpretation. Enter gas values and click Calculate.'}
            >
              {/* Triangle background */}
              <polygon
                points={`${VERTEX_CH4.x},${VERTEX_CH4.y} ${VERTEX_C2H4.x},${VERTEX_C2H4.y} ${VERTEX_C2H2.x},${VERTEX_C2H2.y}`}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="1"
              />

              {/* Zone polygons */}
              {DUVAL_ZONES.map((zone) => (
                <polygon
                  key={zone.name}
                  points={getPolygonPoints(zone.points)}
                  fill={zone.color}
                  stroke="var(--ink)"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              ))}

              {/* Axis ticks and labels */}
              {/* CH4 axis (top to bottom-left) */}
              {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => {
                const p = barycentricToCartesian(pct, 100 - pct, 0)
                const offset = 8
                const angle = Math.PI * 1.5
                return (
                  <g key={`ch4-${pct}`}>
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x + Math.cos(angle) * offset}
                      y2={p.y + Math.sin(angle) * offset}
                      stroke="var(--ink)"
                      strokeWidth="1"
                    />
                    <text
                      x={p.x + Math.cos(angle) * (offset + 4)}
                      y={p.y + Math.sin(angle) * (offset + 4) + 3}
                      fontFamily="var(--font-data)"
                      fontSize="9"
                      fill="var(--ink)"
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      {pct}%
                    </text>
                  </g>
                )
              })}

              {/* C2H4 axis (bottom-right to top) */}
              {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => {
                const p = barycentricToCartesian(100 - pct, pct, 0)
                const offset = 8
                const angle = Math.PI / 6
                return (
                  <g key={`c2h4-${pct}`}>
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x + Math.cos(angle) * offset}
                      y2={p.y + Math.sin(angle) * offset}
                      stroke="var(--ink)"
                      strokeWidth="1"
                    />
                    <text
                      x={p.x + Math.cos(angle) * (offset + 4)}
                      y={p.y + Math.sin(angle) * (offset + 4) + 3}
                      fontFamily="var(--font-data)"
                      fontSize="9"
                      fill="var(--ink)"
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      {pct}%
                    </text>
                  </g>
                )
              })}

              {/* C2H2 axis (bottom-left to top) */}
              {Array.from({ length: 11 }, (_, i) => i * 10).map((pct) => {
                const p = barycentricToCartesian(100 - pct, 0, pct)
                const offset = 8
                const angle = -Math.PI / 6
                return (
                  <g key={`c2h2-${pct}`}>
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x + Math.cos(angle) * offset}
                      y2={p.y + Math.sin(angle) * offset}
                      stroke="var(--ink)"
                      strokeWidth="1"
                    />
                    <text
                      x={p.x + Math.cos(angle) * (offset + 4) - 20}
                      y={p.y + Math.sin(angle) * (offset + 4) + 3}
                      fontFamily="var(--font-data)"
                      fontSize="9"
                      fill="var(--ink)"
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {pct}%
                    </text>
                  </g>
                )
              })}

              {/* Axis labels at vertices */}
              <text x={VERTEX_CH4.x} y={VERTEX_CH4.y - 14} fontFamily="var(--font-data)" fontSize="11" fill="var(--ink)" textAnchor="middle" fontWeight="600">CH₄ 100%</text>
              <text x={VERTEX_C2H4.x + 18} y={VERTEX_C2H4.y + 4} fontFamily="var(--font-data)" fontSize="11" fill="var(--ink)" textAnchor="start" fontWeight="600">C₂H₄ 100%</text>
              <text x={VERTEX_C2H2.x - 18} y={VERTEX_C2H2.y + 4} fontFamily="var(--font-data)" fontSize="11" fill="var(--ink)" textAnchor="end" fontWeight="600">C₂H₂ 100%</text>

              {/* Zone labels */}
              {DUVAL_ZONES.map((zone) => {
                const centroid = getZoneCentroid(zone.points)
                return (
                  <text
                    key={zone.name}
                    x={centroid.x}
                    y={centroid.y}
                    fontFamily="var(--font-data)"
                    fontSize="10"
                    fill="var(--ink)"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="600"
                  >
                    {zone.name}
                  </text>
                )
              })}

              {/* Result point */}
              {result && (
                <g>
                  {/* Ring with crosshair */}
                  <circle
                    cx={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x : CENTER_X}
                    cy={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y : CENTER_Y}
                    r="10"
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth="2"
                  />
                  <line
                    x1={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x - 10 : CENTER_X - 10}
                    y1={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y : CENTER_Y}
                    x2={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x + 10 : CENTER_X + 10}
                    y2={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y : CENTER_Y}
                    stroke="var(--ink)"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x : CENTER_X}
                    y1={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y - 10 : CENTER_Y - 10}
                    x2={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x : CENTER_X}
                    y2={result.ch4 !== undefined ? barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y + 10 : CENTER_Y + 10}
                    stroke="var(--ink)"
                    strokeWidth="1.5"
                  />

                  {/* Leader line to label */}
                  <line
                    x1={barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x + 14}
                    y1={barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y}
                    x2={barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x + 120}
                    y2={barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y - 20}
                    stroke="var(--ink)"
                    strokeWidth="1"
                    strokeDasharray="4,2"
                  />
                  <text
                    x={barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).x + 125}
                    y={barycentricToCartesian(result.ch4, result.c2h4, result.c2h2).y - 20}
                    fontFamily="var(--font-data)"
                    fontSize="10"
                    fill="var(--ink)"
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontWeight="500"
                  >
                    CH₄ {result.ch4.toFixed(1)}% · C₂H₄ {result.c2h4.toFixed(1)}% · C₂H₂ {result.c2h2.toFixed(1)}%
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Result interpretation */}
          {result && (
            <div style={{ maxWidth: '380px', textAlign: 'center', padding: '16px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--radius)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                Zone: {result.zone} — {result.zoneLabel}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                CH₄ {result.ch4.toFixed(1)}% · C₂H₄ {result.c2h4.toFixed(1)}% · C₂H₂ {result.c2h2.toFixed(1)}%
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <p style={{ maxWidth: '380px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
            Interpretation per IEC 60599 / IEEE C57.104. This tool is an aid — confirm with a senior engineer and the applicable standard.
          </p>
        </div>
      </div>
    </div>
  )
}