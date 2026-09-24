import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { EquipmentClass, ProcedureRun, TestSummary } from '../types'

// Minimal local type for test detail (backend schema)
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

export default function Procedures() {
  const [equipment, setEquipment] = useState<EquipmentClass[]>([])
  const [equipId, setEquipId] = useState<number | null>(null)
  const [tests, setTests] = useState<TestSummary[]>([])
  const [run, setRun] = useState<ProcedureRun | null>(null)
  const [detail, setDetail] = useState<TestDetail | null>(null)
  const [runs, setRuns] = useState<ProcedureRun[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<EquipmentClass[]>('/api/catalog/equipment').then(setEquipment).catch(() => {})
    api.get<ProcedureRun[]>('/api/procedures/runs').then(setRuns).catch(() => {})
  }, [])

  useEffect(() => {
    if (!equipId) { setTests([]); return }
    const eq = equipment.find((e) => e.id === equipId)
    if (!eq) return
    api.get<TestSummary[]>(`/api/catalog/tests?equipment=${encodeURIComponent(eq.name)}`)
      .then(setTests).catch(() => {})
  }, [equipId, equipment])

  const safetySteps = useMemo(
    () => (run ? Object.values(run.steps_state).filter((s) => s.type === 'safety') : []),
    [run],
  )
  const allSafetyDone = safetySteps.every((s) => s.done)
  const allDone = run ? Object.values(run.steps_state).every((s) => s.done) : false
  const doneCount = run ? Object.values(run.steps_state).filter((s) => s.done).length : 0
  const totalCount = run ? Object.keys(run.steps_state).length : 0

  const start = async (testId: number) => {
    setError('')
    try {
      const r = await api.post<ProcedureRun>('/api/procedures/start', { test_id: testId })
      setRun(r)
      setDetail(await api.get<TestDetail>(`/api/catalog/tests/${testId}`))
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
      alert('Procedure completed. You can export the PDF report.')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const exportPdf = () => {
    if (!run) return
    const url = `${import.meta.env.VITE_API_URL || ''}/api/procedures/${run.id}/export`
    // fetch with auth then download
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

  if (run) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{detail?.name ?? `Run #${run.id}`}</h2>
            <p className="text-sm text-muted">
              Step {doneCount} of {totalCount} completed
            </p>
          </div>
          <button className="btn-secondary" onClick={() => { setRun(null); setDetail(null) }}>Close</button>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-brdr">
          <div className="h-full bg-primary transition-all"
               style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }} />
        </div>

        {error && <p className="text-sm text-danger" role="alert">{error}</p>}

        {/* Safety gate card — mandatory checks per TRD §9.1 */}
        {safetySteps.length > 0 && (
          <div className="card border-warning" style={{ borderWidth: 2 }}>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              🦺 Safety gate — tick all before continuing
            </h3>
            <div className="space-y-2">
              {safetySteps.map((s) => (
                <label key={s.step_no}
                       className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-control border border-brdr px-3">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]"
                         checked={s.done} onChange={(e) => tick(s.step_no, e.target.checked)} />
                  <span className="flex-1 text-sm">{s.text}</span>
                  <button type="button" className={`pill ${s.flagged ? 'bg-danger/15 text-danger' : 'bg-brdr text-muted'}`}
                          onClick={(e) => { e.preventDefault(); tick(s.step_no, s.done, !s.flagged) }}>
                    {s.flagged ? '⚠ flagged' : 'flag issue'}
                  </button>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step cards */}
        <div className="space-y-2">
          {Object.values(run.steps_state)
            .filter((s) => s.type !== 'safety')
            .sort((a, b) => a.step_no - b.step_no)
            .map((s) => (
              <div key={s.step_no} className={`card flex items-start gap-3 ${allSafetyDone ? '' : 'opacity-50 pointer-events-none'}`}>
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--primary)]"
                       checked={s.done} onChange={(e) => tick(s.step_no, e.target.checked)} />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="mr-1.5 font-semibold">{s.step_no}.</span>{s.text}
                  </p>
                  <span className="pill mt-1 bg-brdr text-muted">{s.type}</span>
                </div>
                <button className={`pill ${s.flagged ? 'bg-danger/15 text-danger' : 'bg-brdr text-muted'}`}
                        onClick={() => tick(s.step_no, s.done, !s.flagged)}>
                  {s.flagged ? '⚠ flagged' : 'flag'}
                </button>
              </div>
            ))}
        </div>

        <textarea className="input" rows={3} placeholder="Notes (optional)"
                  value={run.notes ?? ''} onChange={(e) => setRun({ ...run, notes: e.target.value })} />

        <div className="flex gap-2">
          <button className="btn-primary" disabled={!allDone || !!run.completed_at} onClick={complete}>
            {run.completed_at ? 'Completed ✓' : 'Complete procedure'}
          </button>
          {run.completed_at && (
            <button className="btn-secondary" onClick={exportPdf}>Export PDF</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">Guided Procedures</h2>
      <p className="text-sm text-muted">
        Choose equipment and test. Safety steps are mandatory checkpoints before the procedure begins.
      </p>

      <div className="flex flex-wrap gap-2">
        <button className={`chip ${!equipId ? 'chip-selected' : ''}`} onClick={() => setEquipId(null)}>All</button>
        {equipment.map((e) => (
          <button key={e.id} className={`chip ${equipId === e.id ? 'chip-selected' : ''}`}
                  onClick={() => setEquipId(e.id)}>
            {e.name}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        {(equipId ? tests : []).map((t) => (
          <div key={t.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{t.name}</h3>
              <span className="pill bg-primary/10 text-primary">{t.category ?? 'routine'}</span>
            </div>
            {t.summary && <p className="text-sm text-muted">{t.summary}</p>}
            <button className="btn-primary !min-h-[36px] w-fit" onClick={() => start(t.id)}>
              Start procedure
            </button>
          </div>
        ))}
        {!equipId && (
          <p className="text-sm text-muted">Select an equipment class to list its tests.</p>
        )}
      </div>

      {runs.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Recent runs</h3>
          {runs.map((r) => (
            <div key={r.id} className="card flex items-center justify-between text-sm">
              <span>Run #{r.id} · test {r.test_id}</span>
              <span className="pill bg-brdr text-muted">
                {r.completed_at ? `completed ${new Date(r.completed_at).toLocaleString()}` : 'in progress'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
