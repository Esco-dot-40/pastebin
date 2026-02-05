import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'

export function SpinningBox({ scale, ...props }) {
  // This reference gives us direct access to the THREE.Mesh object
  const ref = useRef()
  // Hold state for hovered and clicked events
  const [hovered, hover] = useState(false)
  useCursor(hovered)
  // Subscribe this component to the render-loop, rotate the mesh every frame
  useFrame((state, delta) => (ref.current.rotation.x = ref.current.rotation.y += delta))
  // Return the view, these are regular Threejs elements expressed in JSX
  return (
    <mesh
      {...props}
      ref={ref}
      scale={scale * 0.2}
      onPointerOver={(event) => hover(true)}
      onPointerOut={(event) => hover(false)}>
      <capsuleGeometry args={ [ 3, 6, 10, 10 ] } />
      <meshStandardMaterial color={hovered ?  'hotpink' : '#15f4ee'} roughness={0.2} metalness={0.2} />
    </mesh>
  )
}
