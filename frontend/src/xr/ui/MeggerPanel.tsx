import { useMemo, useState } from 'react'
import { useTrainer, type Condition } from '../store'
import { CONDITIONS, correctTo20C, resistanceAt } from '../megger'
import { VerdictStamp } from '../../components/VerdictStamp'

const WIDTH = 300
const HEIGHT = 90

export default function MeggerPanel() {
  const condition = useTrainer((s) => s.condition)
  const setCondition = useTrainer((s) => s.setCondition)
  const measure = useTrainer((s) => s.measure)
  const readings = useTrainer((s) => s.readings)
  const verdict = useTrainer((s) => s.resultVerdict)
  const limits = useTrainer((s) => s.limits)
  const run = useTrainer((s) => s.run)
  const [tempC, setTempC] = useState(30)

  const curve = useMemo(() => {
    const pts: string[] = []
    const max = resistanceAt(condition, 600)
    for (let t = 0; t <= 600; t += 10) {
      const x = (t / 600) * WIDTH
      const y = HEIGHT - (resistanceAt(condition, t) / (max || 1)) * (HEIGHT - 8) - 4
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  }, [condition])

  const r1Corrected = readings ? correctTo20C(readings.r1, tempC) : null
  const finished = run.finishedAt !== undefined

  return (
    <section aria-label="Virtual megger" style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: 14 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Virtual megger</strong>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-data)' }}>
          R1 ≥ {limits.r1MinMOhm} MΩ · PI ≥ {limits.piMin}
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          Insulation condition
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            style={{ padding: '6px 8px', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}
          >
            {Object.keys(CONDITIONS).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
          Winding temperature (°C)
          <input
            type="number"
            value={tempC}
            min={-10}
            max={90}
            onChange={(e) => setTempC(Number(e.target.value))}
            style={{ padding: '6px 8px', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-data)' }}
          />
        </label>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Resistance absorption curve for ${condition} insulation`}
        style={{ width: '100%', height: 'auto', background: 'var(--surface-sunken)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)' }}
      >
        <polyline points={curve} fill="none" stroke="var(--primary)" strokeWidth={2} />
        <line x1={(60 / 600) * WIDTH} y1={0} x2={(60 / 600) * WIDTH} y2={HEIGHT} stroke="var(--rule)" strokeDasharray="3 3" />
        <line x1={(600 / 600) * WIDTH} y1={0} x2={(600 / 600) * WIDTH} y2={HEIGHT} stroke="var(--rule)" strokeDasharray="3 3" />
        <text x={4} y={12} fontSize={9} fill="var(--muted)" fontFamily="var(--font-data)">R(t) · 0–10 min</text>
      </svg>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={measure}
          disabled={finished}
        >
          {readings ? 'Test again' : 'Press TEST'}
        </button>
      </div>

      {readings && (
        <dl style={{ margin: '12px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 13, fontFamily: 'var(--font-data)' }}>
          <dt style={{ color: 'var(--muted)' }}>R1 (60 s)</dt>
          <dd style={{ margin: 0 }}>{readings.r1.toFixed(0)} MΩ</dd>
          <dt style={{ color: 'var(--muted)' }}>R10 (600 s)</dt>
          <dd style={{ margin: 0 }}>{readings.r10.toFixed(0)} MΩ</dd>
          <dt style={{ color: 'var(--muted)' }}>PI = R10 / R1</dt>
          <dd style={{ margin: 0, fontWeight: 700 }}>{readings.pi.toFixed(2)}</dd>
          <dt style={{ color: 'var(--muted)' }}>R1 corrected to 20 °C</dt>
          <dd style={{ margin: 0 }}>{r1Corrected?.toFixed(0)} MΩ</dd>
        </dl>
      )}

      {readings && verdict && (
        <div style={{ marginTop: 12 }}>
          <VerdictStamp
            verdict={verdict === 'PASS' ? 'pass' : verdict === 'MARGINAL' ? 'warn' : 'fail'}
            details={{
              enteredValue: `${readings.r1.toFixed(0)} MΩ @ 60 s`,
              limitApplied: `R1 ≥ ${limits.r1MinMOhm} MΩ, PI ≥ ${limits.piMin}`,
              condition: `${condition}, ${tempC} °C`,
              source: 'Catalog limits (sample data)',
            }}
          />
        </div>
      )}
    </section>
  )
}
