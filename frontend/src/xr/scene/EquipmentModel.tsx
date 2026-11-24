import { useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils, type Group } from 'three'
import { useTrainer } from '../store'

const NODE_POSITION: Record<string, [number, number, number]> = {
  hv_terminal: [0.45, 2.08, 0],
  earth_terminal: [0.2, 0.3, 0.55],
  isolator: [-0.98, 1.05, 0],
  earth_switch: [0.85, 0.85, 0.55],
  megger: [1.95, 0.25, 1.05],
  panel_record: [-0.2, 1.0, 0.56],
}

interface HotMeshProps {
  name: string
  onActivate: () => void
  color: string
  metalness?: number
  roughness?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  children: ReactNode
}

/** A clickable mesh that glows when it is the current step's target. */
function HotMesh({
  name,
  onActivate,
  color,
  metalness = 0.4,
  roughness = 0.5,
  position,
  rotation,
  children,
}: HotMeshProps) {
  const [hovered, setHovered] = useState(false)
  const highlighted = useTrainer((s) => s.steps[s.run.current]?.target === name)

  return (
    <mesh
      name={name}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        onActivate()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
    >
      {children}
      <meshStandardMaterial
        color={hovered ? '#f59e0b' : color}
        metalness={metalness}
        roughness={roughness}
        emissive={highlighted ? '#f59e0b' : '#000000'}
        emissiveIntensity={highlighted ? 0.55 : hovered ? 0.15 : 0}
      />
    </mesh>
  )
}

function SwitchLever({
  name,
  deviceKey,
  position,
  color,
}: {
  name: string
  deviceKey: 'isolator' | 'earth_switch'
  position: [number, number, number]
  color: string
}) {
  const dispatch = useTrainer((s) => s.dispatchAction)
  const state = useTrainer((s) => s.run.devices[deviceKey] ?? 'open')
  const highlighted = useTrainer((s) => s.steps[s.run.current]?.target === name)
  const [hovered, setHovered] = useState(false)
  const arm = useRef<Group>(null)

  const targetAngle = state === 'closed' ? 0 : -Math.PI / 2.4

  useFrame((_, dt) => {
    if (!arm.current) return
    arm.current.rotation.z = MathUtils.damp(arm.current.rotation.z, targetAngle, 8, dt)
  })

  const toggle = () => {
    document.body.style.cursor = 'default'
    dispatch({ kind: 'operate', target: deviceKey, value: state === 'closed' ? 'open' : 'closed' })
  }

  return (
    <group position={position}>
      <mesh position={[0, -0.04, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.08, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>
      <group
        ref={arm}
        name={name}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
      >
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.6, 12]} />
          <meshStandardMaterial
            color={hovered ? '#f59e0b' : color}
            metalness={0.7}
            roughness={0.3}
            emissive={highlighted ? '#f59e0b' : '#000000'}
            emissiveIntensity={highlighted ? 0.6 : 0}
          />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial
            color={hovered ? '#f59e0b' : color}
            metalness={0.7}
            roughness={0.3}
            emissive={highlighted ? '#f59e0b' : '#000000'}
            emissiveIntensity={highlighted ? 0.6 : 0}
          />
        </mesh>
      </group>
    </group>
  )
}

function Hotspots({ show }: { show: boolean }) {
  const parts = useTrainer((s) => s.scene.parts)
  if (!show) return null
  return (
    <>
      {parts.map((p) => {
        const at = NODE_POSITION[p.node]
        if (!at) return null
        return (
          <Html key={p.node} position={at} center distanceFactor={9} zIndexRange={[20, 0]}>
            <div
              title={p.description}
              style={{
                whiteSpace: 'nowrap',
                transform: 'translateY(-14px)',
                background: 'rgba(15,23,42,0.92)',
                color: '#f8fafc',
                border: '1px solid #f59e0b',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '11px',
                fontFamily: 'var(--font-data)',
                pointerEvents: 'none',
              }}
            >
              {p.label}
            </div>
          </Html>
        )
      })}
    </>
  )
}

export default function EquipmentModel({
  explode,
  showHotspots,
}: {
  explode: number
  showHotspots: boolean
}) {
  const dispatch = useTrainer((s) => s.dispatchAction)

  return (
    <group>
      {/* Base / plinth */}
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.9, 0.2, 1.2]} />
        <meshStandardMaterial color="#475569" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Tank */}
      <mesh position={[0, 0.8 + explode * 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.2, 0.9]} />
        <meshStandardMaterial color="#5b7c99" metalness={0.35} roughness={0.55} />
      </mesh>

      {/* Cooling fins */}
      {[-0.95, 0.95].map((x) =>
        [-0.28, -0.09, 0.1, 0.29].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, 0.8, z]} castShadow>
            <boxGeometry args={[0.12, 1.0, 0.12]} />
            <meshStandardMaterial color="#4a6b86" metalness={0.4} roughness={0.5} />
          </mesh>
        )),
      )}

      {/* Bushings (porcelain) */}
      {[-0.45, 0, 0.45].map((x, i) => (
        <group key={x}>
          <mesh position={[x, 1.68 + explode * 0.28, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.14, 0.6, 20]} />
            <meshStandardMaterial color="#e7e2d6" metalness={0.05} roughness={0.35} />
          </mesh>
          <mesh position={[x, 2.02 + explode * 0.28, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.12, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
          </mesh>
          {i === 2 && (
            <HotMesh
              name="hv_terminal"
              position={[0.45, 2.12 + explode * 0.28, 0]}
              color="#d4a017"
              metalness={0.9}
              roughness={0.25}
              onActivate={() => dispatch({ kind: 'connect', target: 'hv_terminal' })}
            >
              <sphereGeometry args={[0.085, 18, 18]} />
            </HotMesh>
          )}
        </group>
      ))}

      {/* Tank earth stud */}
      <HotMesh
        name="earth_terminal"
        position={[0.2, 0.3, 0.55]}
        color="#94a3b8"
        metalness={0.9}
        roughness={0.3}
        onActivate={() => dispatch({ kind: 'connect', target: 'earth_terminal' })}
      >
        <cylinderGeometry args={[0.05, 0.05, 0.14, 12]} />
      </HotMesh>

      {/* HV isolator + earth switch (interlocked levers) */}
      <SwitchLever name="isolator" deviceKey="isolator" position={[-0.98, 1.05, 0]} color="#f97316" />
      <SwitchLever name="earth_switch" deviceKey="earth_switch" position={[0.85, 0.85, 0.55]} color="#22c55e" />

      {/* Record panel */}
      <HotMesh
        name="panel_record"
        position={[-0.2, 1.0, 0.48]}
        color="#1e293b"
        metalness={0.5}
        roughness={0.4}
        onActivate={() => dispatch({ kind: 'inspect', target: 'panel_record' })}
      >
        <boxGeometry args={[0.4, 0.26, 0.06]} />
      </HotMesh>

      <Hotspots show={showHotspots} />
    </group>
  )
}
