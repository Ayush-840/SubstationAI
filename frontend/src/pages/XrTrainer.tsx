import { useEffect, useState } from 'react'
import { selectScore, useTrainer } from '../xr/store'
import SceneRoot, { xrStore } from '../xr/scene/SceneRoot'
import StepPanel from '../xr/ui/StepPanel'
import MeggerPanel from '../xr/ui/MeggerPanel'
import SummaryCard from '../xr/ui/SummaryCard'
import SampleDataBanner from '../xr/ui/SampleDataBanner'

type XrMode = 'DESKTOP' | 'VR' | 'AR'

export default function XrTrainer() {
  const load = useTrainer((s) => s.load)
  const loadHistory = useTrainer((s) => s.loadHistory)
  const reset = useTrainer((s) => s.reset)
  const hazard = useTrainer((s) => s.hazard)
  const message = useTrainer((s) => s.message)
  const clearMessage = useTrainer((s) => s.clearMessage)
  const loading = useTrainer((s) => s.loading)
  const fromApi = useTrainer((s) => s.fromApi)
  const equipmentName = useTrainer((s) => s.equipmentName)
  const testName = useTrainer((s) => s.testName)
  const setMode = useTrainer((s) => s.setMode)
  const sessions = useTrainer((s) => s.sessions)
  const score = useTrainer(selectScore)

  const [explode, setExplode] = useState(0)
  const [showHotspots, setShowHotspots] = useState(true)
  const [vrOk, setVrOk] = useState(false)
  const [arOk, setArOk] = useState(false)
  const [xrError, setXrError] = useState<string | null>(null)

  useEffect(() => {
    void load()
    void loadHistory()
  }, [load, loadHistory])

  useEffect(() => {
    const xr = (navigator as unknown as { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr
    if (!xr?.isSessionSupported) return
    let alive = true
    xr.isSessionSupported('immersive-vr').then((v) => alive && setVrOk(v)).catch(() => {})
    xr.isSessionSupported('immersive-ar').then((v) => alive && setArOk(v)).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    return xrStore.subscribe((state) => {
      if (!state.mode) setMode('DESKTOP')
      else if (state.mode === 'immersive-vr') setMode('VR')
      else if (state.mode === 'immersive-ar') setMode('AR')
    })
  }, [setMode])

  async function enter(mode: XrMode) {
    setXrError(null)
    try {
      setMode(mode)
      if (mode === 'VR') await xrStore.enterVR()
      else await xrStore.enterAR()
    } catch (e: any) {
      setMode('DESKTOP')
      setXrError(e?.message ?? `Could not start ${mode}. WebXR needs HTTPS and a supported device.`)
    }
  }

  return (
    <div style={{ maxWidth: 1100, width: '100%' }}>
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 600, fontFamily: 'var(--font-display)' }}>XR Trainer</h1>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-data)', color: 'var(--muted)' }}>
            {loading ? 'Loading…' : `${equipmentName} · ${testName}`}
          </span>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15 }}>
          Practise an insulation-resistance test on a 3D transformer: isolate, earth, connect, test,
          and get a verdict from the catalog limits.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button type="button" className="btn-primary" onClick={() => enter('VR')} disabled={!vrOk} title={vrOk ? 'Enter VR' : 'WebXR VR is not available on this device'}>
          Enter VR
        </button>
        <button type="button" className="btn-secondary" onClick={() => enter('AR')} disabled={!arOk} title={arOk ? 'Place in AR' : 'WebXR AR is not available on this device (Android Chrome + ARCore only)'}>
          View in AR
        </button>
        <button type="button" className="btn-secondary" onClick={reset}>Restart run</button>
        <button type="button" className="btn-secondary" onClick={() => hazard('hv_bushing')} title="Inject a live-zone breach to demonstrate the clearance alarm">
          Demo hazard breach
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginLeft: 'auto' }}>
          Explode
          <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
          <input type="checkbox" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} />
          Part labels
        </label>
      </div>

      {(!vrOk || !arOk) && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>
          {vrOk ? '' : 'VR unavailable (use the Immersive Web Emulator or a headset). '}
          {arOk ? '' : 'AR unavailable on this device (Android Chrome + ARCore only; iOS Safari has no WebXR AR). '}
          Desktop mode is fully functional.
        </p>
      )}
      {xrError && <p role="alert" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--danger)' }}>{xrError}</p>}

      <div style={{ position: 'relative', height: 440, border: '1px solid var(--rule)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#0b1220', marginBottom: 12 }}>
        <SceneRoot explode={explode} showHotspots={showHotspots} />
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', gap: 8, pointerEvents: 'none' }}>
          <span style={{ pointerEvents: 'auto', background: 'rgba(2,6,23,0.82)', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'var(--font-data)' }}>
            {fromApi ? 'Steps from database' : 'Cached procedure'} · score {score}
          </span>
          <span style={{ pointerEvents: 'auto', background: 'rgba(2,6,23,0.82)', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'var(--font-data)' }}>
            Drag to orbit · scroll to zoom · click the highlighted part
          </span>
        </div>

        {message && (
          <div
            role="status"
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 4,
              fontSize: 13,
              background: message.tone === 'error' ? 'rgba(127,29,29,0.95)' : message.tone === 'ok' ? 'rgba(6,78,59,0.95)' : 'rgba(30,41,59,0.95)',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <span>{message.text}</span>
            <button type="button" onClick={clearMessage} style={{ background: 'none', border: 'none', color: '#f8fafc', cursor: 'pointer', fontSize: 16, lineHeight: 1 }} aria-label="Dismiss message">×</button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <SampleDataBanner />
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
        <StepPanel />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MeggerPanel />
          <SummaryCard />
        </div>
      </div>

      <section aria-label="My training" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', margin: '0 0 8px' }}>My training</h2>
        {sessions.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            No saved runs yet. Finish a run and press <strong>Save run</strong>.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--rule)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {sessions.map((s) => (
              <li key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--rule)', fontSize: 13 }}>
                <span>
                  <strong>{new Date(s.createdAt).toLocaleString()}</strong>
                  <span style={{ color: 'var(--muted)' }}> · {s.mode} · {s.stepsDone}/{s.stepsTotal} steps</span>
                </span>
                <span style={{ fontFamily: 'var(--font-data)' }}>{s.violations?.length ?? 0} viol.</span>
                <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700 }}>{s.score}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
