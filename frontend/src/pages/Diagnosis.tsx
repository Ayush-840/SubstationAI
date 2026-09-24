import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { DiagnosisCause, EquipmentClass, TestSummary } from '../types'

interface CheckResponse {
  status: string
  limit_value: string
  source: string
  troubleshooting: { symptom: string; cause: string; action: string }[]
}

export default function Diagnosis() {
  const [tab, setTab] = useState<'diagnose' | 'check'>('diagnose')
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex gap-2">
        <button className={`chip ${tab === 'diagnose' ? 'chip-selected' : ''}`} onClick={() => setTab('diagnose')}>
          Fault Diagnosis
        </button>
        <button className={`chip ${tab === 'check' ? 'chip-selected' : ''}`} onClick={() => setTab('check')}>
          Result Checker
        </button>
      </div>
      {tab === 'diagnose' ? <DiagnoseForm /> : <ResultChecker />}
    </div>
  )
}

function DiagnoseForm() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [equipId, setEquipId] = useState<number | null>(null)
  const [symptoms, setSymptoms] = useState('')
  const [readings, setReadings] = useState('')
  const [causes, setCauses] = useState<DiagnosisCause[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!equipId) return
    setError('')
    setCauses(null)
    try {
      const res = await api.post<{ causes: DiagnosisCause[] }>('/api/diagnosis', {
        equipment_class_id: equipId,
        symptoms,
        readings: readings ? { free_text: readings } : undefined,
      })
      setCauses(res.causes)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-semibold">Describe the fault</h2>
        <select className="input" value={equipId ?? ''} onChange={(e) => setEquipId(Number(e.target.value) || null)} required>
          <option value="">Select equipment…</option>
          {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <textarea className="input" rows={3} placeholder="Symptoms (e.g. leakage current high, oil temperature rising…)"
                  value={symptoms} onChange={(e) => setSymptoms(e.target.value)} required />
        <textarea className="input" rows={2} placeholder="Optional readings (e.g. H2 = 145 ppm, tan delta = 1.9%)"
                  value={readings} onChange={(e) => setReadings(e.target.value)} />
        <button className="btn-primary">Diagnose</button>
      </form>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {causes && (
        <div className="space-y-2">
          <h3 className="font-medium">Ranked probable causes</h3>
          {causes.length === 0 && <p className="text-sm text-muted">No matching causes found in the catalog.</p>}
          {causes.map((c, i) => (
            <div key={i} className="card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{c.cause}</p>
                <span className="pill bg-primary/10 text-primary">
                  likelihood {Math.round(c.likelihood * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-brdr">
                <div className="h-full bg-primary" style={{ width: `${c.likelihood * 100}%` }} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Recommended checks</p>
                <ul className="list-inside list-disc text-sm">
                  {c.recommended_checks.map((r, j) => <li key={j}>{r}</li>)}
                </ul>
              </div>
              <p className="text-xs text-muted">
                Sources: {c.sources.map((s) => `${s.document} · ${s.section}`).join(' | ')}
              </p>
            </div>
          ))}
          <p className="text-xs text-muted">
            Diagnosis is an aid based on catalog records and sample logs — confirm with a senior engineer.
          </p>
        </div>
      )}
    </div>
  )
}

function ResultChecker() {
  const [tests, setTests] = useState<TestSummary[]>([])
  const [testId, setTestId] = useState<number | null>(null)
  const [parameter, setParameter] = useState('')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<TestSummary[]>('/api/catalog/tests').then(setTests).catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testId) return
    setError('')
    setResult(null)
    try {
      const res = await api.post<CheckResponse>('/api/check-result', {
        test_id: testId,
        parameter,
        measured_value: parseFloat(value),
        unit: '',
      })
      setResult(res)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">Compare a measured value with catalog limits</h2>
      <select className="input" value={testId ?? ''} onChange={(e) => setTestId(Number(e.target.value) || null)} required>
        <option value="">Select test…</option>
        {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input className="input" placeholder="Parameter (e.g. Contact resistance per pole)"
             value={parameter} onChange={(e) => setParameter(e.target.value)} required />
      <input className="input" type="number" step="any" placeholder="Measured value"
             value={value} onChange={(e) => setValue(e.target.value)} required />
      <button className="btn-primary">Check result</button>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {result && (
        <div className="card space-y-2">
          <span className={`pill ${
            result.status === 'within limits' ? 'bg-success/15 text-success'
            : result.status === 'borderline' ? 'bg-warning/15 text-warning'
            : 'bg-danger/15 text-danger'}`}>
            {result.status}
          </span>
          <p className="text-sm">Limit: <span className="font-mono">{result.limit_value}</span></p>
          <p className="text-xs text-muted">{result.source}</p>
          {result.troubleshooting.length > 0 && (
            <div className="border-t border-brdr pt-2">
              <p className="text-xs font-medium text-muted">Outside limits — probable causes</p>
              <ul className="list-inside list-disc text-sm">
                {result.troubleshooting.map((t, i) => (
                  <li key={i}>{t.cause} → {t.action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
