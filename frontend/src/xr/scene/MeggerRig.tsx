import { Html, Line } from '@react-three/drei'
import { useTrainer } from '../store'

const MEGGER_AT: [number, number, number] = [1.95, 0.25, 1.05]

export default function MeggerRig() {
  const dispatch = useTrainer((s) => s.dispatchAction)
  const highlighted = useTrainer((s) => s.steps[s.run.current]?.target === 'megger')
  const readings = useTrainer((s) => s.readings)
  const verdict = useTrainer((s) => s.resultVerdict)

  const hvConnected = useTrainer((s) => {
    const step = s.steps.find((x) => x.action === 'connect' && x.target === 'hv_terminal')
    return Boolean(step && s.run.done.includes(step.no))
  })
  const earthConnected = useTrainer((s) => {
    const step = s.steps.find((x) => x.action === 'connect' && x.target === 'earth_terminal')
    return Boolean(step && s.run.done.includes(step.no))
  })

  return (
    <group>
      {/* Instrument body */}
      <mesh
        position={MEGGER_AT}
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          dispatch({ kind: 'measure', target: 'megger' })
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
        name="megger"
      >
        <boxGeometry args={[0.42, 0.32, 0.26]} />
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.3}
          roughness={0.6}
          emissive={highlighted ? '#f59e0b' : '#000000'}
          emissiveIntensity={highlighted ? 0.5 : 0}
        />
      </mesh>

      {/* Screen */}
      <mesh position={[MEGGER_AT[0], MEGGER_AT[1] + 0.02, MEGGER_AT[2] + 0.135]}>
        <boxGeometry args={[0.3, 0.16, 0.01]} />
        <meshStandardMaterial color={readings ? '#052e16' : '#0b1220'} emissive="#0f766e" emissiveIntensity={0.25} />
      </mesh>

      <Html position={[MEGGER_AT[0], MEGGER_AT[1] + 0.28, MEGGER_AT[2]]} center distanceFactor={6}>
        <div
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            color: readings ? (verdict === 'FAIL' ? '#fca5a5' : '#86efac') : '#e2e8f0',
            background: 'rgba(2,6,23,0.88)',
            border: '1px solid #334155',
            borderRadius: '4px',
            padding: '3px 6px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {readings
            ? `R1 ${readings.r1.toFixed(0)} · R10 ${readings.r10.toFixed(0)} · PI ${readings.pi.toFixed(2)}`
            : hvConnected && earthConnected
              ? 'READY — press TEST'
              : 'Connect both leads'}
        </div>
      </Html>

      {/* Leads appear when the connect steps are done */}
      {hvConnected && (
        <Line
          points={[
            [MEGGER_AT[0] - 0.05, MEGGER_AT[1] + 0.18, MEGGER_AT[2] - 0.12],
            [1.25, 1.45, 0.5],
            [0.5, 2.0, 0.05],
          ]}
          color="#dc2626"
          lineWidth={2}
        />
      )}
      {earthConnected && (
        <Line
          points={[
            [MEGGER_AT[0] - 0.08, MEGGER_AT[1] + 0.12, MEGGER_AT[2] - 0.12],
            [1.0, 0.2, 0.75],
            [0.25, 0.3, 0.55],
          ]}
          color="#16a34a"
          lineWidth={2}
        />
      )}
    </group>
  )
}
