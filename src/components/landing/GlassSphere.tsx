// @ts-nocheck — R3F JSX elements (mesh, lights, etc.) no están en JSX.IntrinsicElements estándar
'use client'
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, Float, Environment } from '@react-three/drei'
import type { Mesh } from 'three'

function Orb() {
  const ref = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.elapsedTime * 0.18
    ref.current.rotation.z = clock.elapsedTime * 0.06
  })

  return (
    <Float speed={1.4} floatIntensity={0.7} rotationIntensity={0.25}>
      {/* Glass shell */}
      <mesh ref={ref}>
        <sphereGeometry args={[1.6, 128, 128]} />
        <MeshTransmissionMaterial
          backside
          backsideThickness={0.2}
          samples={16}
          thickness={0.6}
          chromaticAberration={0.1}
          anisotropy={0.4}
          distortion={0.2}
          distortionScale={0.4}
          temporalDistortion={0.04}
          iridescence={1}
          iridescenceIOR={1.5}
          iridescenceThicknessRange={[0, 1300]}
          roughness={0}
          color="#6080ff"
          transmission={1}
        />
      </mesh>
      {/* Soft inner core glow */}
      <mesh scale={0.45}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshStandardMaterial
          color="#4466ff"
          emissive="#3355ee"
          emissiveIntensity={0.6}
          transparent
          opacity={0.18}
        />
      </mesh>
    </Float>
  )
}

export default function GlassSphere() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 5]} intensity={2} color="#c0d0ff" />
      <pointLight position={[-6, -4, -6]} intensity={3} color="#5040cc" />
      <pointLight position={[4, 6, 3]} intensity={1.5} color="#ffffff" />
      <pointLight position={[0, 0, 6]} intensity={0.8} color="#8899ff" />
      <Environment preset="city" />
      <Orb />
    </Canvas>
  )
}
