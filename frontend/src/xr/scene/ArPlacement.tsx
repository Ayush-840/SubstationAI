import { useMemo, useRef } from 'react'
import { useXR, useXRHitTest } from '@react-three/xr'
import { DoubleSide, Matrix4, type Group } from 'three'

/**
 * AR hit-test reticle. Move the phone to find a table or floor, tap the ring to
 * place the equipment. iOS Safari has no WebXR AR, so this simply never shows.
 */
export default function ArPlacement({
  onPlace,
}: {
  onPlace: (p: [number, number, number]) => void
}) {
  const mode = useXR((s) => s.mode)
  const reticle = useRef<Group>(null)
  const matrix = useMemo(() => new Matrix4(), [])

  useXRHitTest(
    (results, getWorldMatrix) => {
      const g = reticle.current
      if (!g) return
      if (results.length === 0 || !getWorldMatrix(matrix, results[0])) {
        g.visible = false
        return
      }
      g.visible = true
      matrix.decompose(g.position, g.quaternion, g.scale)
    },
    'viewer',
    ['plane', 'mesh'],
  )

  if (mode !== 'immersive-ar') return null

  return (
    <group
      ref={reticle}
      visible={false}
      onClick={(e) => {
        e.stopPropagation()
        const g = reticle.current
        if (g) onPlace([g.position.x, g.position.y, g.position.z])
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.14, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} side={DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.02, 16]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
    </group>
  )
}
