export default function SampleDataBanner() {
  return (
    <div
      role="note"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '8px 10px',
        border: '1px solid var(--rule)',
        borderLeft: '3px solid var(--warn)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-sunken)',
        fontSize: 12,
        color: 'var(--muted)',
      }}
    >
      <span aria-hidden style={{ color: 'var(--warn)', fontWeight: 700 }}>!</span>
      <span>
        Teaching sample: models, clearances and megger readings are simulated. Not a substitute for
        the site procedure or a calibrated instrument.
      </span>
    </div>
  )
}
