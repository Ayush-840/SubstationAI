import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { DiagnosisCause, EquipmentClass, FaultLog } from '../types'
import {
  SectionLabel,
  EquipmentFilter,
  type EquipmentCategory,
  Button,
  Field,
  Input,
  Select,
  Wordmark,
} from '../components/common'

export default function Diagnosis() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [equipId, setEquipId] = useState<number | null>(null)
  const [symptoms, setSymptoms] = useState('')
  const [readings, setReadings] = useState('')
  const [causes, setCauses] = useState<DiagnosisCause[] | null>(null)
  const [error, setError] = useState('')
  const [historyKey, setHistoryKey] = useState(0)

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
      setHistoryKey((k) => k + 1)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 8px',
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--ink)',
          fontFamily: 'var(--font-display)',
        }}>
          Fault Diagnosis
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Describe symptoms and optional readings to get ranked probable causes with recommended checks.
        </p>
      </header>

      <SectionLabel topRule={false}>Describe the Fault</SectionLabel>
      <form onSubmit={submit} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Field label="Equipment Class" required>
          <Select defaultValue={String(equipId || '')}>
            <option value="">Select equipment…</option>
            {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </Field>

        <Field label="Symptoms" required hint="e.g. leakage current high, oil temperature rising, abnormal DGA">
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Describe the observed symptoms…"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            required
          />
        </Field>

        <Field label="Optional Readings" hint="e.g. H2 = 145 ppm, tan delta = 1.9%, C2H2 = 12 ppm">
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Any test readings or measurements…"
            value={readings}
            onChange={(e) => setReadings(e.target.value)}
          />
        </Field>

        <Button variant="primary" type="submit" style={{ width: 'fit-content' }}>
          Diagnose
        </Button>
      </form>

      {error && <p style={{ marginTop: '16px', color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}

      {causes && (
        <div style={{ marginTop: '24px' }}>
          <SectionLabel>Ranked Probable Causes</SectionLabel>
          {causes.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No matching causes found in the catalog.</p>
          )}
          {causes.map((c, i) => (
            <div key={i} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>{c.cause}</p>
                <span style={{ fontSize: '12px', color: 'var(--primary)', fontFamily: 'var(--font-data)' }}>
                  likelihood {Math.round(c.likelihood * 100)}%
                </span>
              </div>
              <div style={{ height: '4px', background: 'var(--rule)', borderRadius: 0, marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${c.likelihood * 100}%`, background: 'var(--primary)', transition: 'width 200ms ease' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>
                  Recommended Checks
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6 }}>
                  {c.recommended_checks.map((r, j) => <li key={j}>{r}</li>)}
                </ul>
              </div>
              <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                Sources: {c.sources.map((s) => `${s.document} · ${s.section}`).join(' | ')}
              </p>
            </div>
          ))}
          <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>
            Diagnosis is an aid based on catalog records and sample logs — confirm with a senior engineer.
          </p>
        </div>
      )}

      <div style={{ marginTop: '32px' }}>
        <SectionLabel>Recent Diagnoses</SectionLabel>
        <FaultLogHistory refreshKey={historyKey} />
      </div>
    </div>
  )
}

/** Past diagnoses from the fault_logs collection (MongoDB). */
function FaultLogHistory({ refreshKey }: { refreshKey: number }) {
  const [logs, setLogs] = useState<FaultLog[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .get<FaultLog[]>('/api/fault-logs')
      .then((res) => {
        if (!cancelled) {
          setLogs(Array.isArray(res) ? res : [])
          setError('')
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setLogs([])
          setError(err.message ?? 'Failed to load history.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {logs === null && <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading history…</p>}
      {error && <p style={{ color: 'var(--danger)', fontSize: '14px' }} role="alert">{error}</p>}
      {logs !== null && logs.length === 0 && !error && (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No diagnoses logged yet.</p>
      )}
      {logs?.map((log) => (
        <div key={log.id} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{log.equipment_class}</p>
            <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {log.logged_at ? new Date(log.logged_at).toLocaleString() : ''}
            </span>
          </div>
          {log.symptoms.length > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Symptoms: {log.symptoms.join(', ')}
            </p>
          )}
          {Object.keys(log.readings ?? {}).length > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Readings: {Object.entries(log.readings)
                .map(([k, v]) => `${k} = ${String(v)}`)
                .join(', ')}
            </p>
          )}
          {log.diagnosis && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink)' }}>
              <span style={{ color: 'var(--muted)' }}>Causes: </span>
              {log.diagnosis.split('\n')[0]}
            </p>
          )}
          {log.resolution && (
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink)' }}>
              <span style={{ color: 'var(--muted)' }}>Checks: </span>
              {log.resolution.split('\n')[0]}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}