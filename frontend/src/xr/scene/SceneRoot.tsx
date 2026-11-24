import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XR, createXRStore, useXR } from '@react-three/xr'
import { useTrainer } from '../store'
import { useGLTF } from '@react-three/drei'
import EquipmentModel from './EquipmentModel'
import MeggerRig from './MeggerRig'
import HazardZones from './HazardZones'
import ArPlacement from './ArPlacement'

useGLTF.setDecoderPath('/draco/')

/** One store for the whole app; enterVR()/enterAR() are called from the page UI. */
export const xrStore = createXRStore()

function DesktopControls() {
  const mode = useXR((s) => s.mode)
  if (mode) return null
  return <OrbitControls makeDefault enablePan={false} minDistance={2.5} maxDistance={14} target={[0, 1, 0]} />
}

function Scene({ explode, showHotspots }: { explode: number; showHotspots: boolean }) {
  const zones = useTrainer((s) => s.scene.zones)
  const mode = useXR((s) => s.mode)
  const isAR = mode === 'immersive-ar'
  const [placement, setPlacement] = useState<[number, number, number] | null>(null)

  const position: [number, number, number] = isAR ? (placement ?? [0, 0, -1.2]) : [0, 0, 0]
  const scale = isAR ? 0.05 : 1

  return (
    <>
      <color attach="background" args={['#0b1220']} />
      <fog attach="fog" args={['#0b1220', 12, 28]} />

      <hemisphereLight args={['#e2e8f0', '#1e293b', 0.7]} />
      <directionalLight position={[5, 9, 6]} intensity={1.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-4, 4, -5]} intensity={0.35} color="#93c5fd" />

      <gridHelper args={[24, 48, '#1e293b', '#0f172a']} />

      <group position={position} scale={scale}>
        <EquipmentModel explode={explode} showHotspots={showHotspots} />
        <MeggerRig />
      </group>

      {!isAR && <HazardZones zones={zones} />}
      <ArPlacement onPlace={setPlacement} />

      <DesktopControls />
    </>
  )
}

export default function SceneRoot({
  explode,
  showHotspots,
}: {
  explode: number
  showHotspots: boolean
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [4.2, 3.1, 6], fov: 45, near: 0.1, far: 100 }}
      onPointerMissed={() => {
        document.body.style.cursor = 'default'
      }}
    >
      <XR store={xrStore}>
        <Scene explode={explode} showHotspots={showHotspots} />
      </XR>
    </Canvas>
  )
}
