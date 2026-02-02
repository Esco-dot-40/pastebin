import * as THREE from 'three'
import React, { useRef, useMemo } from 'react'
import { useFrame } from 'react-three-fiber'
import { useGLTF } from 'drei'
import geoObject from './geo.min.glb';

function Hit({ position, size, color = "#00F2FF" }) {
  const mesh = useRef()
  useFrame((state) => {
    if (mesh.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 5 + position.x) * 0.2
      mesh.current.scale.set(s, s, s)
    }
  })
  return (
    <mesh position={position}>
      <sphereBufferGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function DataLines({ count = 15, color = "#00F2FF" }) {
  const lines = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const start = new THREE.Vector3().setFromSphericalCoords(1.05, Math.random() * Math.PI, Math.random() * Math.PI * 2)
      const end = new THREE.Vector3().setFromSphericalCoords(1.05, Math.random() * Math.PI, Math.random() * Math.PI * 2)
      const curve = new THREE.QuadraticBezierCurve3(
        start,
        new THREE.Vector3().lerpVectors(start, end, 0.5).multiplyScalar(1.2),
        end
      )
      return curve.getPoints(20)
    })
  }, [count])

  return (
    <group>
      {lines.map((points, i) => (
        <line key={i}>
          <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(points)} />
          <lineBasicMaterial attach="material" color={color} transparent opacity={0.3} />
        </line>
      ))}
    </group>
  )
}

export default function Model({ hits: externalHits, color = "#00F2FF", ...props }) {
  const group = useRef()
  const { nodes } = useGLTF(`${window.PUBLIC_PATH}${geoObject}`, true)

  const hits = useMemo(() => {
    if (externalHits) return externalHits;
    // Default random hits if none provided
    return new Array(40).fill(0).map(() => ({
      pos: new THREE.Vector3().setFromSphericalCoords(1.05, Math.random() * Math.PI, Math.random() * Math.PI * 2),
      size: Math.random() * 0.02 + 0.01
    }))
  }, [externalHits])

  useFrame(({ clock }) => {
    const t = (0.5 + Math.sin(clock.getElapsedTime() * 0.5)) / 2
    if (group.current) {
      group.current.position.y = t / 5
      group.current.rotation.y += 0.002
      group.current.rotation.z += 0.001
    }
  })

  return (
    <group {...props} dispose={null}>
      <group ref={group}>
        <mesh geometry={nodes.geo.geometry}>
          <meshBasicMaterial wireframe color={color} transparent opacity={0.15} />
        </mesh>
        {hits.map((hit, i) => (
          <Hit key={i} position={hit.pos} size={hit.size || 0.02} color={color} />
        ))}
        <DataLines color={color} />
      </group>
    </group>
  )
}
