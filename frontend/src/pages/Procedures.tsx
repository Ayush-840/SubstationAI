import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { EquipmentClass, ProcedureRun, TestSummary } from '../types'
import {
  SectionLabel,
  SafetyBlock,
  EquipmentFilter,
  type EquipmentCategory,
  Button,
  Wordmark,
} from '../components/common'

interface TestDetail {
  id: number
  name: string
  purpose: string | null
  summary: string | null
  steps: { step_no: number; type: string; text: string }[]
  equipment: { instrument: string; spec: string }[]
  limits: { parameter: string; value: string; condition: string }[]
  standards: { code: string; title: string; clause?: string }[]
  safety: { text: string; mandatory: boolean }[]
}

type View = 'list' | 'safety-gate' | 'step' | 'summary'

export default function Procedures() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [equipId, setEquipId] = useState<number | null>(null)
  const [tests, setTests] = useState<TestSummary[]>([])
  const [run, setRun] = useState<ProcedureRun | null>(null)
  const [detail, setDetail] = useState<TestDetail | null>(null)
  const [runs, setRuns] = useState<ProcedureRun[]>([])
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('list')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showNote, setShowNote] = useState<Record<number, boolean>>({})
  const [stepNote, setStepNote] = useState<Record<number, string>>({})

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
    api.get<ProcedureRun[]>('/api/procedures/runs').then(setRuns).catch(() => {})
  }, [])

  useEffect(() => {
    if (!equipId) { setTests([]); return }
    const eq = equipment.find((e) => e.id === equipId)
    if (!eq) return
    api.get<TestSummary[] | { data: TestSummary[] }>(`/api/catalog/tests?equipment=${encodeURIComponent(eq.name)}&page=1&page_size=100`)
      .then((res) => setTests(Array.isArray(res) ? res : res.data ?? []))
      .catch(() => {})
  }, [equipId])
  useEffect(() => { setTests([]); }, [equipment])

  const testIdParam = searchParams.get('test')
  useEffect(() => {
    if (testIdParam && !run) {
      const testId = Number(testIdParam)
      start(testId)
    }
  }, [testIdParam])

  const safetySteps = useMemo(
    () => (run ? Object.values(run.steps_state).filter((s) => s.type === 'safety').sort((a, b) => a.step_no - b.step_no) : []),
    [run],
  )
  const procedureSteps = useMemo(
    () => (run ? Object.values(run.steps_state).filter((s) => s.type !== 'safety').sort((a, b) => a.step_no - b.step_no) : []),
    [run],
  )
  const allSafetyDone = safetySteps.length > 0 && safetySteps.every((s) => s.done)
  const allDone = run ? Object.values(run.steps_state).every((s) => s.done) : false
  const doneCount = run ? Object.values(run.steps_state).filter((s) => s.done).length : 0
  const totalCount = run ? Object.keys(run.steps_state).length : 0

  const start = async (testId: number) => {
    setError('')
    try {
      const r = await api.post<ProcedureRun>('/api/procedures/start', { test_id: testId })
      setRun(r)
      setDetail(await api.get<TestDetail>(`/api/catalog/tests/${testId}`))
      setView('safety-gate')
      setCurrentStepIndex(0)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const tick = async (stepNo: number, done: boolean, flagged = false, note?: string) => {
    if (!run) return
    try {
      const res = await api.put<{ steps_state: ProcedureRun['steps_state'] }>(
        `/api/procedures/${run.id}/step`,
        { step_no: stepNo, done, flagged, note },
      )
      setRun({ ...run, steps_state: res.steps_state })
    } catch (e: any) {
      setError(e.message)
    }
  }

  const complete = async () => {
    if (!run) return
    try {
      const r = await api.post<ProcedureRun>(`/api/procedures/${run.id}/complete`, { notes: run.notes })
      setRun(r)
      setView('summary')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const exportPdf = () => {
    if (!run) return
    const url = `${import.meta.env.VITE_API_URL || ''}/api/procedures/${run.id}/export`
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('siq_token')}` } })
      .then((r) => { if (!r.ok) throw new Error('Export failed'); return r.blob() })
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `procedure_run_${run.id}.pdf`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch((e) => setError(e.message))
  }

  const closeRun = () => {
    setRun(null)
    setDetail(null)
    setView('list')
    setCurrentStepIndex(0)
    setSearchParams({})
  }

  const currentStep = procedureSteps[currentStepIndex]
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

  // List view
  if (view === 'list') {
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
            Guided Procedures
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Choose equipment and test. Safety steps are mandatory checkpoints before the procedure begins.
          </p>
        </header>

        <div style={{ marginBottom: '24px' }}>
          <EquipmentFilter selected={equipId ? equipment.find(e => e.id === equipId)?.name || 'all' : 'all'} onChange={(c) => {
            const eq = equipment.find(e => e.name === c)
            setEquipId(eq?.id ?? null)
          }} />
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }} role="alert">{error}</p>}

        {!equipId ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Select an equipment class to list its tests.</p>
        ) : tests.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No tests yet for this equipment class.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {tests.map((t) => (
              <div key={t.id} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>{t.name}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.category ?? 'routine'}</span>
                </div>
                {t.summary && <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>{t.summary}</p>}
                <Button variant="primary" style={{ width: 'fit-content' }} onClick={() => start(t.id)}>
                  Start procedure
                </Button>
              </div>
            ))}
          </div>
        )}

        {runs.length > 0 && (
          <div style={{ marginTop: '32px' }}>
            <SectionLabel topRule={false}>Recent Runs</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {runs.map((r) => (
                <div key={r.id} style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: 'var(--ink)' }}>Run #{r.id} · test {r.test_id}</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {r.completed_at ? `completed ${new Date(r.completed_at).toLocaleString()}` : 'in progress'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Safety Gate view
  if (view === 'safety-gate') {
    return (
      <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
        <SafetyBlock label="SAFETY GATE — BEFORE YOU START" rules={safetySteps.map(s => s.text)} />
        <div style={{ padding: '24px 0' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            {detail?.name}
          </h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Tick every mandatory check before continuing. All items must be confirmed.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {safetySteps.map((s) => (
            <label
              key={s.step_no}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                cursor: 'pointer',
                minHeight: '56px',
              }}
            >
              <input
                type="checkbox"
                checked={s.done}
                onChange={(e) => tick(s.step_no, e.target.checked)}
                style={{
                  width: '24px',
                  height: '24px',
                  flexShrink: 0,
                  marginTop: '2px',
                  accentColor: 'var(--primary)',
                }}
              />
              <span style={{ flex: 1, fontSize: '16px', lineHeight: 1.5, color: 'var(--ink)' }}>{s.text}</span>
              <button
                type="button"
                style={{
                  fontSize: '12px',
                  color: s.flagged ? 'var(--danger)' : 'var(--muted)',
                  border: `1px solid ${s.flagged ? 'var(--danger)' : 'var(--rule)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
                onClick={(e) => { e.preventDefault(); tick(s.step_no, s.done, !s.flagged) }}
              >
                {s.flagged ? 'Flagged' : 'Flag issue'}
              </button>
            </label>
          ))}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="primary"
            disabled={!allSafetyDone}
            style={{ minHeight: '56px', padding: '0 24px' }}
            onClick={() => setView('step')}
          >
            Continue
          </Button>
          {!allSafetyDone && (
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Tick every item to continue.</span>
          )}
        </div>

        <Button variant="tertiary" onClick={closeRun} style={{ marginTop: '16px' }}>
          Cancel procedure
        </Button>
      </div>
    )
  }

  // Step view
  if (view === 'step' && currentStep) {
    const isLastStep = currentStepIndex === procedureSteps.length - 1

    return (
      <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
        {/* Progress line */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--muted)' }}>
            <span>Step {currentStep.step_no} of {procedureSteps.length}</span>
            <span>{doneCount} of {totalCount} completed</span>
          </div>
          <div style={{ height: '4px', background: 'var(--rule)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 200ms ease' }} />
          </div>
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }} role="alert">{error}</p>}

        {/* Step content */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{
              flexShrink: 0,
              width: '48px',
              textAlign: 'right',
              fontFamily: 'var(--font-data)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--muted)',
              lineHeight: 1.1,
            }}>
              {currentStep.step_no}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px', fontSize: '20px', lineHeight: 1.4, color: 'var(--ink)' }}>
                {currentStep.text}
              </p>
              <span style={{ fontSize: '13px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {currentStep.type}
              </span>
            </div>
          </div>
        </div>

        {/* Note field - collapsed */}
        <details style={{ marginBottom: '24px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '14px', color: 'var(--primary)', fontWeight: 500, padding: '8px 0' }}>
            {showNote[currentStep.step_no] ? 'Hide note' : 'Add note'}
          </summary>
          <div style={{ marginTop: '8px' }}>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Add a note for this step…"
              value={stepNote[currentStep.step_no] || ''}
              onChange={(e) => setStepNote({ ...stepNote, [currentStep.step_no]: e.target.value })}
              style={{ width: '100%' }}
            />
            {showNote[currentStep.step_no] && (
              <Button variant="tertiary" size="small" style={{ marginTop: '8px' }} onClick={() => tick(currentStep.step_no, currentStep.done, currentStep.flagged, stepNote[currentStep.step_no])}>
                Save note
              </Button>
            )}
          </div>
        </details>

        {/* Step navigation */}
        <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--rule)' }}>
          <Button variant="secondary" disabled={currentStepIndex === 0} onClick={() => setCurrentStepIndex(currentStepIndex - 1)}>
            Previous
          </Button>
          <div style={{ flex: 1 }} />
          <Button
            variant="secondary"
            style={{ minHeight: '56px', minWidth: '120px' }}
            onClick={() => tick(currentStep.step_no, currentStep.done, !currentStep.flagged)}
          >
            {currentStep.flagged ? 'Flagged' : 'Flag issue'}
          </Button>
          <Button
            variant="primary"
            disabled={!allSafetyDone}
            style={{ minHeight: '56px', minWidth: '120px' }}
            onClick={() => {
              tick(currentStep.step_no, true, currentStep.flagged, stepNote[currentStep.step_no])
              if (!isLastStep) {
                setCurrentStepIndex(currentStepIndex + 1)
              } else if (allDone) {
                setView('summary')
              }
            }}
          >
            {isLastStep ? 'Complete procedure' : 'Done'}
          </Button>
        </div>

        <Button variant="tertiary" onClick={closeRun} style={{ marginTop: '16px', width: '100%' }}>
          Cancel procedure
        </Button>
      </div>
    )
  }

  // Summary view
  if (view === 'summary' && run && detail) {
    return (
      <div style={{ maxWidth: '760px', margin: '0', width: '100%' }}>
        <header style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--rule-strong)' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            Procedure Completed
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', color: 'var(--muted)' }}>
            <span><strong>Test:</strong> {detail.name}</span>
            <span><strong>Equipment:</strong> {detail?.purpose || '—'}</span>
            <span><strong>Date:</strong> {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}</span>
            <span><strong>Operator:</strong> {run.operator || '—'}</span>
          </div>
        </header>

        {/* Steps table */}
        <SectionLabel topRule={false}>Steps</SectionLabel>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-ui)' }}>
            <thead>
              <tr style={{ background: 'var(--surface-sunken)', borderBottom: '2px solid var(--rule-strong)' }}>
                {['Step', 'Type', 'Status', 'Note'].map((col) => (
                  <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(run.steps_state)
                .sort((a, b) => a.step_no - b.step_no)
                .map((s) => (
                  <tr key={s.step_no} style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', fontWeight: 600, color: 'var(--ink)' }}>{s.step_no}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>{s.type}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: s.done ? 'var(--success)' : s.flagged ? 'var(--danger)' : 'var(--muted)',
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: s.done ? 'var(--success)' : s.flagged ? 'var(--danger)' : 'var(--muted)',
                          flexShrink: 0,
                        }} />
                        {s.done ? 'Done' : s.flagged ? 'Flagged' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--ink)' }}>{s.note || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Safety confirmations */}
        {safetySteps.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <SectionLabel>Safety Confirmations</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {safetySteps.map((s) => (
                <div key={s.step_no} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: s.done ? 'var(--success)' : 'var(--muted)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-ink)', fontSize: '12px' }}>✓</span>
                  <span style={{ flex: 1, fontSize: '14px', color: 'var(--ink)' }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={exportPdf}>Export PDF</Button>
          <Button variant="tertiary" onClick={closeRun}>New procedure</Button>
        </div>
      </div>
    )
  }

  return null
}