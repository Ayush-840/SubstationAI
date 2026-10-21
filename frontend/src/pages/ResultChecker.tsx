import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { EquipmentClass, TestSummary } from '../types'
import {
  SectionLabel,
  EquipmentFilter,
  type EquipmentCategory,
  Button,
  VerdictStamp,
  LimitsTable,
  type LimitRow,
  Field,
  Input,
  Select,
} from '../components/common'

interface CheckResultResponse {
  verdict: 'within_limit' | 'borderline' | 'outside_limit'
  entered_value: number
  limit_applied: string
  condition: string
  source: string
  parameter: string
  unit: string
  troubleshooting?: { cause: string; action: string }[]
  limit_found: boolean
}

export default function ResultChecker() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [tests, setTests] = useState<TestSummary[]>([])
  const [selectedEquip, setSelectedEquip] = useState<EquipmentCategory>('all')
  const [selectedTest, setSelectedTest] = useState<number | null>(null)
  const [parameter, setParameter] = useState('')
  const [measuredValue, setMeasuredValue] = useState('')
  const [unit, setUnit] = useState('')
  const [condition, setCondition] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<CheckResultResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedEquip === 'all') { setTests([]); return }
    api.get<TestSummary[] | { data: TestSummary[] }>(`/api/catalog/tests?equipment=${encodeURIComponent(selectedEquip)}`)
      .then((res) => setTests(Array.isArray(res) ? res : res.data ?? []))
      .catch(() => {})
  }, [selectedEquip])

  const submit = async () => {
    if (!selectedTest || !parameter || measuredValue === '') {
      setError('Select a test, parameter and enter a measured value.')
      return
    }
    setError('')
    setSubmitted(false)
    try {
      const value = parseFloat(measuredValue)
      if (!Number.isFinite(value)) throw new Error('Enter a valid number.')
      const res = await api.post<CheckResultResponse>('/api/check-result', {
        test_id: selectedTest,
        parameter,
        measured_value: value,
        unit: unit || undefined,
        condition: condition || undefined,
      })
      setResult(res)
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message ?? 'Check result failed.')
      setResult(null)
    }
  }

  const reset = () => {
    setSubmitted(false)
    setResult(null)
    setError('')
    setMeasuredValue('')
    setUnit('')
    setCondition('')
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0', width: '100%' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-display)',
        }}>
          Result Checker
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Compare a measured test result against the catalog limits for a test.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Form column */}
        <div style={{ maxWidth: '420px' }}>
          <SectionLabel topRule={false}>Input</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <EquipmentFilter selected={selectedEquip} onChange={(c) => { setSelectedEquip(c); setSelectedTest(null); setTests([]) }} />

            {tests.length > 0 && (
              <Field label="Test" required>
                <Select defaultValue={String(selectedTest || '')}>
                  <option value="">Select a test…</option>
                  {tests.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Parameter" required hint="As listed in the test limits table">
              <Input placeholder="e.g. Contact resistance per pole" value={parameter} onChange={(e) => setParameter(e.target.value)} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Measured value" required>
                <Input isNumeric step="any" placeholder="e.g. 250" value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)} />
              </Field>
              <Field label="Unit" required hint="e.g. µΩ, MΩ, kV">
                <Input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
            </div>

            <Field label="Condition (optional)" hint="e.g. Ambient temperature 25 °C">
              <Input placeholder="e.g. 25 °C" value={condition} onChange={(e) => setCondition(e.target.value)} />
            </Field>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="primary" onClick={submit} style={{ flex: 1 }}>Check result</Button>
              <Button variant="secondary" onClick={reset} style={{ flex: 1 }}>Reset</Button>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}
          </div>
        </div>

        {/* Result column */}
        <div>
          <SectionLabel topRule={false}>Result</SectionLabel>
          {!selectedTest ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
              <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: '15px' }}>Select a test and enter a measured value.</p>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>The result will appear here after checking.</p>
            </div>
          ) : !submitted ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
              <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: '15px' }}>Ready to check.</p>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Enter the measured value and press <strong>Check result</strong>.</p>
            </div>
          ) : result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Verdict Stamp */}
              <VerdictStamp
                verdict={result.verdict}
                details={{
                  enteredValue: `${result.entered_value} ${result.unit}`,
                  limitApplied: result.limit_applied,
                  condition: result.condition,
                  source: result.source,
                }}
                troubleshooting={result.troubleshooting?.map(t => `${t.cause} → ${t.action}`)}
              />

              {/* Definition list */}
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '14px', padding: '16px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius)', border: '1px solid var(--rule)' }}>
                <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Parameter:</dt>
                <dd style={{ margin: 0, color: 'var(--ink)', fontWeight: 600 }}>{result.parameter}</dd>
                <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Measured value:</dt>
                <dd style={{ margin: 0, color: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{result.entered_value} {result.unit}</dd>
                <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Limit applied:</dt>
                <dd style={{ margin: 0, color: 'var(--ink)', fontFamily: 'var(--font-data)' }}>{result.limit_applied}</dd>
                <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Condition:</dt>
                <dd style={{ margin: 0, color: 'var(--muted)' }}>{result.condition}</dd>
                <dt style={{ color: 'var(--muted)', fontWeight: 500 }}>Source:</dt>
                <dd style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-data)' }}>{result.source}</dd>
              </dl>

              {/* Troubleshooting for outside/borderline */}
              {result.troubleshooting && result.troubleshooting.length > 0 && (
                <div style={{ padding: '16px', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                  <span style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: result.verdict === 'outside_limit' ? 'var(--danger)' : 'var(--warn)',
                    marginBottom: '12px',
                  }}>
                    Probable Causes & Actions
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6 }}>
                    {result.troubleshooting.map((t, idx) => (
                      <li key={idx} style={{ marginTop: idx > 0 ? '8px' : '0' }}>
                        <strong>{t.cause}</strong> → {t.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No limit found */}
              {!result.limit_found && (
                <div style={{ padding: '16px', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    No applicable limit found for this parameter in the selected test. Verify against the OEM manual or applicable standard.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}