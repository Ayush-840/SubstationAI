import { selectScore, useTrainer } from '../store'

export default function SummaryCard() {
  const run = useTrainer((s) => s.run)
  const steps = useTrainer((s) => s.steps)
  const score = useTrainer(selectScore)
  const verdict = useTrainer((s) => s.resultVerdict)
  const readings = useTrainer((s) => s.readings)
  const savedId = useTrainer((s) => s.savedId)
  const saving = useTrainer((s) => s.saving)
  const save = useTrainer((s) => s.save)
  const testId = useTrainer((s) => s.testId)

  const finished = run.finishedAt !== undefined
  const elapsed = finished ? Math.round(((run.finishedAt as number) - run.startedAt) / 1000) : null

  return (
    <section aria-label="Run summary" style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: 14 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Run summary</strong>
        <span style={{ fontSize: 12, color: finished ? 'var(--success)' : 'var(--muted)', fontFamily: 'var(--font-data)' }}>
          {finished ? 'Complete' : 'In progress'}
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <Stat label="Score" value={String(score)} />
        <Stat label="Steps" value={`${run.done.length}/${steps.length}`} />
        <Stat label="Violations" value={String(run.violations.length)} />
      </div>

      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 13 }}>
        <dt style={{ color: 'var(--muted)' }}>Verdict</dt>
        <dd style={{ margin: 0, fontWeight: 600 }}>{verdict ?? '—'}</dd>
        <dt style={{ color: 'var(--muted)' }}>PI</dt>
        <dd style={{ margin: 0, fontFamily: 'var(--font-data)' }}>{readings ? readings.pi.toFixed(2) : '—'}</dd>
        <dt style={{ color: 'var(--muted)' }}>Duration</dt>
        <dd style={{ margin: 0, fontFamily: 'var(--font-data)' }}>{elapsed === null ? '—' : `${elapsed} s`}</dd>
      </dl>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={!finished || saving || Boolean(savedId) || !testId}>
          {savedId ? 'Saved' : saving ? 'Saving…' : 'Save run'}
        </button>
        {!testId && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Cached run — seed the API to save.</span>}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', background: 'var(--surface-sunken)' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    </div>
  )
}
