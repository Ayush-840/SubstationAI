import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { ClearanceMonitor } from '../clearance'
import { useTrainer } from '../store'
import type { HazardZone } from '../api'

/**
 * Live-zone clearance volumes. The monitor fires on ENTRY only, so staying in
 * a zone records one violation rather than one per frame.
 */
export default function HazardZones({ zones }: { zones: HazardZone[] }) {
  const hazard = useTrainer((s) => s.hazard)
  const monitor = useMemo(
    () => new ClearanceMonitor(zones.map((z) => ({ id: z.id, center: z.center, radius: z.radius }))),
    [zones],
  )
  const tmp = useMemo(() => new Vector3(), [])
  const inside = useRef<Set<string>>(new Set())
  const activeIds = useRef<string[]>([])
  const [active, setActive] = useState<string[]>([])

  useFrame(({ camera }) => {
    const p = camera.getWorldPosition(tmp).toArray() as [number, number, number]
    const entered = monitor.update(p)
    if (entered.length) {
      for (const id of entered) {
        inside.current.add(id)
        hazard(id)
      }
    }
    // Recompute membership so the tint clears on exit.
    const now = zones.filter((z) => {
      const dx = p[0] - z.center[0]
      const dy = p[1] - z.center[1]
      const dz = p[2] - z.center[2]
      return Math.hypot(dx, dy, dz) < z.radius
    })
    const ids = now.map((z) => z.id)
    const changed =
      ids.length !== activeIds.current.length || ids.some((id, i) => id !== activeIds.current[i])
    if (changed) {
      activeIds.current = ids
      setActive(ids)
    }
  })

  return (
    <>
      {zones.map((z) => {
        const breached = active.includes(z.id)
        return (
          <mesh key={z.id} position={z.center}>
            <sphereGeometry args={[z.radius, 20, 20]} />
            <meshStandardMaterial
              color={breached ? '#ef4444' : '#f59e0b'}
              transparent
              opacity={breached ? 0.28 : 0.1}
              depthWrite={false}
              emissive={breached ? '#ef4444' : '#000000'}
              emissiveIntensity={breached ? 0.5 : 0}
            />
          </mesh>
        )
      })}
    </>
  )
}
