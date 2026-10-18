import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { EquipmentClass, TestSummary } from '../types'

export default function ResultChecker() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [tests, setTests] = useState<TestSummary[]>([])
  const [selectedEquip, setSelectedEquip] = useState<string>('')
  const [selectedTest, setSelectedTest] = useState<number | null>(null)
  const [parameter, setParameter] = useState('')
  const [measuredValue, setMeasuredValue] = useState('')
  const [unit, setUnit] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedEquip) { setTests([]); return }
    api
      .get<TestSummary[]>(`/api/catalog/tests?equipment=${encodeURIComponent(selectedEquip)}`)
      .then((res) => setTests(Array.isArray(res) ? res : res.data ?? res))
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
      const res = await api.post('/api/check-result', {
        test_id: selectedTest,
        parameter,
        measured_value: value,
        unit: unit || undefined,
      })
      setResult(Array.isArray(res) ? res[0] : res)
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message ?? 'Check result failed.')
      setResult(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">Result Checker</h2>
      <p className="text-sm text-muted">
        Compare a measured test result against the catalog limits for a test.
      </p>

      <div className="flex gap-2">
        <select
          className="input"
          value={selectedEquip}
          onChange={(e) => { setSelectedEquip(e.target.value); setSelectedTest(null); setTests([]) }}
        >
          <option value="">Select equipment…</option>
          {equipment.map((e) => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>
        <select
          className="input"
          value={selectedTest ?? ''}
          onChange={(e) => setSelectedTest(e.target.value ? Number(e.target.value) : null)}
          disabled={!selectedEquip}
        >
          <option value="">Select a test…</option>
          {tests.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
      </div>

      {!selectedTest ? (
        <p className="text-sm text-muted">Select an equipment class and a test to check results.</p>
      ) : (
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Parameter</span>
            <input
              className="input"
              placeholder="e.g. Contact resistance per pole"
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Measured value</span>
            <input
              className="input"
              type="number"
              step="any"
              placeholder="e.g. 250"
              value={measuredValue}
              onChange={(e) => setMeasuredValue(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Unit (optional)</span>
            <input
              className="input"
              placeholder="e.g. µΩ"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </label>

          <button className="btn-primary" onClick={submit}>Check result</button>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}

          {submitted && result && (
            <div className="card space-y-2">
              <h3 className="font-medium">Result</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted">Status</dt>
                  <dd>{String(result.status ?? '—')}</dd>
                </div>
                <div>
                  <dt className="text-muted">Limit</dt>
                  <dd>{String(result.limit_value ?? '—')}</dd>
                </div>
                <div>
                  <dt className="text-muted">Source</dt>
                  <dd>{String(result.source ?? '—')}</dd>
                </div>
              </dl>
              {(result as any).troubleshooting?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted">Troubleshooting</p>
                  {(result as any).troubleshooting.map((t: any, i: number) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium">{t.symptom}</p>
                      <p className="text-muted">{t.probable_cause}</p>
                      <p className="text-muted">{t.recommended_action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
