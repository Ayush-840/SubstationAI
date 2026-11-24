import { useTrainer } from '../store'

const TYPE_LABEL: Record<string, string> = {
  safety: 'Safety',
  prep: 'Prepare',
  action: 'Test',
  record: 'Record',
}

export default function StepPanel() {
  const steps = useTrainer((s) => s.steps)
  const run = useTrainer((s) => s.run)
  const complete = useTrainer((s) => s.completeCurrentStep)

  const finished = run.finishedAt !== undefined
  const currentNo = steps[run.current]?.no

  return (
    <section aria-label="Procedure steps" style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
      <header style={{ padding: '12px 14px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Procedure</strong>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-data)' }}>
          {run.done.length}/{steps.length} done · {run.violations.length} violation{run.violations.length === 1 ? '' : 's'}
        </span>
      </header>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((step, i) => {
          const done = run.done.includes(step.no)
          const isCurrent = !finished && i === run.current
          return (
            <li
              key={step.no}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr',
                gap: 10,
                padding: '10px 14px',
                borderBottom: i === steps.length - 1 ? 'none' : '1px solid var(--rule)',
                background: isCurrent ? 'var(--surface-sunken)' : 'transparent',
                borderLeft: isCurrent ? '3px solid var(--primary)' : '3px solid transparent',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontFamily: 'var(--font-data)',
                  fontWeight: 600,
                  background: done ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'var(--surface-sunken)',
                  color: done || isCurrent ? 'var(--primary-ink)' : 'var(--muted)',
                  border: '1px solid var(--rule)',
                }}
              >
                {done ? '✓' : step.no}
              </span>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: isCurrent ? 'var(--primary)' : 'var(--muted)' }}>
                    {TYPE_LABEL[step.type] ?? step.type}
                  </span>
                  <code style={{ fontSize: 11, color: 'var(--muted)' }}>{step.target}</code>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.45, color: done ? 'var(--muted)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>
                  {step.text}
                </div>
                {isCurrent && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ marginTop: 8, fontSize: 12, padding: '4px 10px' }}
                    onClick={complete}
                  >
                    Perform step {currentNo} from the keyboard
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <footer style={{ padding: '10px 14px', borderTop: '1px solid var(--rule)', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, fontFamily: 'var(--font-data)', color: 'var(--muted)' }}>
        <span>Isolator: <strong style={{ color: run.devices.isolator === 'open' ? 'var(--success)' : 'var(--danger)' }}>{run.devices.isolator}</strong></span>
        <span>Earth switch: <strong style={{ color: run.devices.earth_switch === 'closed' ? 'var(--success)' : 'var(--muted)' }}>{run.devices.earth_switch}</strong></span>
      </footer>
    </section>
  )
}
