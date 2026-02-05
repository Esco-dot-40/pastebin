import { Text } from "troika-three-text";
import { useFrame, extend } from "react-three-fiber";
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { Lightning } from "./Lightning";
import { Rain } from "./Rain";

extend({ Text });

export const ThreeLoader = ({ progress }) => {
    const textMaterial = useRef();
    const groupRef = useRef();
    const textMeshRef = useRef();

    // Restricted colors: Green, Blue, Purple
    const colors = useMemo(() => [
        new THREE.Color("#00ff88"), // Emerald
        new THREE.Color("#0088ff"), // Blue
        new THREE.Color("#8800ff"), // Purple
        new THREE.Color("#00ffcc"), // Cyan-ish
    ], []);

    useFrame((state) => {
        const t = state.clock.elapsedTime;

        if (groupRef.current) {
            groupRef.current.position.y = Math.sin(t * 0.5) * 0.05;
        }

        if (textMaterial.current) {
            // 1. Color Cycling (Restricted to cool tones)
            const colorIndex = (t * 0.3) % colors.length;
            const nextColorIndex = (colorIndex + 1) % colors.length;
            const alpha = colorIndex % 1;

            textMaterial.current.color.lerpColors(
                colors[Math.floor(colorIndex)],
                colors[Math.floor(nextColorIndex)],
                alpha
            );
            textMaterial.current.emissive.copy(textMaterial.current.color);

            // 2. Toned down Lightning Effect (Safer pulsing)
            const flicker = 0.8 + Math.sin(t * 2) * 0.2;
            const lightningBurst = Math.random() > 0.995 ? 2.5 : 0;
            textMaterial.current.emissiveIntensity = (flicker + lightningBurst);
        }

        // Camera rig
        const targetX = state.mouse.x * (state.viewport.width / 2);
        const targetY = (1 + state.mouse.y) / 2;
        state.camera.position.x += (targetX - state.camera.position.x) * 0.05;
        state.camera.position.y += (targetY - state.camera.position.y) * 0.05;
        state.camera.lookAt(0, 0, 0);
    });

    useEffect(() => {
        if (textMeshRef.current) {
            textMeshRef.current.sync();
        }
    }, []);

    return (
        <group>
            {/* Immersive Rain */}
            <Rain count={1200} />
            <Lightning />

            {/* The Main Text */}
            <group ref={groupRef}>
                <mesh position={[0, 0, 0]}>
                    <text
                        ref={textMeshRef}
                        text="esco.io"
                        fontSize={2.5}
                        maxWidth={200}
                        lineHeight={1}
                        letterSpacing={-0.1}
                        textAlign="center"
                        font="/fonts/Poppins-Black.ttf"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.05}
                        outlineColor="#000000"
                    >
                        <meshStandardMaterial
                            ref={textMaterial}
                            attach="material"
                            color={colors[0]}
                            emissive={colors[0]}
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                    </text>
                </mesh>
            </group>

            {/* Perfect Mirror Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
                <planeGeometry attach="geometry" args={[100, 100]} />
                <meshStandardMaterial
                    attach="material"
                    color="#202020"
                    metalness={0.9}
                    roughness={0.1}
                />
            </mesh>

            {/* Progress UI */}
            <group position={[0, -2.5, 0]}>
                <mesh>
                    <planeGeometry attach="geometry" args={[4, 0.01]} />
                    <meshBasicMaterial attach="material" color="#111" transparent opacity={0.3} />
                </mesh>
                <mesh position={[(-2 + (progress / 100) * 2), 0, 0.01]}>
                    <planeGeometry attach="geometry" args={[(progress / 100) * 4, 0.01]} />
                    <meshBasicMaterial attach="material" color="#00ff88" />
                </mesh>

                <mesh position={[0, -0.3, 0]}>
                    <text
                        text={progress < 100 ? `INITIALIZING SYSTEM: ${progress}%` : "SYSTEM READY"}
                        fontSize={0.12}
                        font="/fonts/Poppins-Black.ttf"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            attach="material"
                            color="#00ff88"
                            transparent
                            opacity={0.6}
                        />
                    </text>
                </mesh>
            </group>

            {/* Lighting */}
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={1.5} color="#00ffff" />
            <pointLight position={[-10, -10, -10]} intensity={1.5} color="#ff00ff" />
            <spotLight
                position={[0, 8, 0]}
                angle={0.4}
                penumbra={1}
                intensity={2}
                color="#ffffff"
            />

            <fog attach="fog" args={["#000408", 8, 20]} />
        </group>
    );
};
