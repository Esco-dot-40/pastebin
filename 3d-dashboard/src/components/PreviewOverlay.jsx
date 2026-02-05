import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Float, MeshDistortMaterial, Center, useVideoTexture, useTexture } from '@react-three/drei'
import * as THREE from 'three'

export const PreviewOverlay = ({ project, onConfirm, onCancel }) => {
    const groupRef = useRef()
    const [hovered, setHovered] = useState(null)
    const videoTexture = project.video ? useVideoTexture(project.video, { muted: true, loop: true, start: true }) : null
    const imageTexture = project.image ? useTexture(project.image) : null

    useFrame((state) => {
        if (groupRef.current) {
            // "Shoot out" animation: Lerp from the distance into view
            // Adjusting target Z to be further away from the camera [z=12]
            groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, 2, 0.08)
            groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05
        }
    })

    return (
        <group ref={groupRef} position={[0, 0, -20]}>
            {/* Background Glass Plate */}
            <mesh>
                <planeGeometry args={[8, 5]} />
                <meshPhysicalMaterial
                    color="#002211"
                    transparent
                    opacity={0.8}
                    roughness={0.1}
                    metalness={0.8}
                    transmission={0.5}
                    thickness={1}
                />
            </mesh>

            {/* Project Title */}
            <Text
                position={[0, 2.2, 0.1]}
                fontSize={0.4}
                font="/fonts/Poppins-Black.ttf"
                color="#00ff88"
            >
                {`LIVE_LINK // ${project.name.toUpperCase()}`}
            </Text>

            {/* Preview "GIF" / Video Panel */}
            <mesh position={[0, 0.2, 0.1]}>
                <planeGeometry args={[7.5, 3.5]} />
                {videoTexture ? (
                    <meshBasicMaterial map={videoTexture} toneMapped={false} />
                ) : imageTexture ? (
                    <meshBasicMaterial map={imageTexture} toneMapped={false} />
                ) : (
                    <>
                        <meshStandardMaterial color="#001105" emissive={project.color} emissiveIntensity={0.2} />
                        <Text
                            position={[0, 0, 0.01]}
                            fontSize={0.2}
                            color="white"
                            opacity={0.5}
                        >
                            [ DATA_SHARD_PREVIEW_ANIM_PLACEHOLDER ]
                        </Text>
                    </>
                )}
            </mesh>

            {/* Confirmation Panel */}
            <group position={[0, -1.5, 0.2]}>
                <Text
                    position={[0, 0.6, 0]}
                    fontSize={0.25}
                    color="white"
                    textAlign="center"
                >
                    ESTABLISH NEURAL UPLINK TO EXTERNAL NODE?
                </Text>

                {/* Yes Button */}
                <group
                    position={[-1.5, -0.2, 0]}
                    onPointerOver={() => setHovered('yes')}
                    onPointerOut={() => setHovered(null)}
                    onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                >
                    <mesh>
                        <planeGeometry args={[1.5, 0.6]} />
                        <meshBasicMaterial
                            color={hovered === 'yes' ? '#00ff88' : '#004422'}
                            transparent
                            opacity={0.8}
                        />
                    </mesh>
                    <Text fontSize={0.2} color="white" position={[0, 0, 0.01]}>YES</Text>
                </group>

                {/* No Button */}
                <group
                    position={[1.5, -0.2, 0]}
                    onPointerOver={() => setHovered('no')}
                    onPointerOut={() => setHovered(null)}
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                >
                    <mesh>
                        <planeGeometry args={[1.5, 0.6]} />
                        <meshBasicMaterial
                            color={hovered === 'no' ? '#ff4444' : '#661111'}
                            transparent
                            opacity={0.8}
                        />
                    </mesh>
                    <Text fontSize={0.2} color="white" position={[0, 0, 0.01]}>NO</Text>
                </group>
            </group>

        </group>
    )
}
