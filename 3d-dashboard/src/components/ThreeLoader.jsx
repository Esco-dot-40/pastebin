import {
    Text,
    Environment,
    Float,
    useFont,
    Center,
    MeshReflectorMaterial
} from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { easing } from "maath";
import { Lightning } from "./Lightning";
import { Rain } from "./Rain";

export const ThreeLoader = ({ progress }) => {
    const textMaterial = useRef();
    const groupRef = useRef();

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
    });

    return (
        <group>
            {/* Immersive Rain */}
            <Rain count={1200} />
            <Lightning />

            {/* The Main Text */}
            <group ref={groupRef}>
                <Center position={[0, 0, 0]}>
                    <Text
                        font={"/fonts/Poppins-Black.ttf"}
                        fontSize={2.5}
                        letterSpacing={-0.1}
                        textAlign="center"
                        anchorY="middle"
                    >
                        esco.io
                        <meshStandardMaterial
                            ref={textMaterial}
                            color={colors[0]}
                            emissive={colors[0]}
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                    </Text>
                </Center>
            </group>

            {/* Perfect Mirror Floor - Razor Sharp & Dark */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
                <planeGeometry args={[100, 100]} />
                <MeshReflectorMaterial
                    blur={[300, 30]}
                    resolution={2048}
                    mixBlur={1}
                    mixStrength={80}
                    roughness={1}
                    depthScale={1.2}
                    minDepthThreshold={0.4}
                    maxDepthThreshold={1.4}
                    color="#202020"
                    metalness={0.8}
                />
            </mesh>

            {/* Progress UI */}
            <group position={[0, -2.5, 0]}>
                <mesh>
                    <planeGeometry args={[4, 0.01]} />
                    <meshBasicMaterial color="#111" transparent opacity={0.3} />
                </mesh>
                <mesh position-x={-2 + (progress / 100) * 2} position-z={0.01}>
                    <planeGeometry args={[(progress / 100) * 4, 0.01]} />
                    <meshBasicMaterial color="#00ff88" />
                </mesh>

                <Text
                    position-y={-0.3}
                    fontSize={0.12}
                    font={"/fonts/Poppins-Black.ttf"}
                    color="#00ff88"
                    opacity={0.6}
                >
                    {progress < 100 ? `INITIALIZING SYSTEM: ${progress}%` : "SYSTEM READY"}
                </Text>
            </group>

            <CameraRig />
            <Environment preset="night" />
        </group>
    );
};

function CameraRig() {
    useFrame((state, delta) => {
        easing.damp3(
            state.camera.position,
            [state.pointer.x * (state.viewport.width / 2), (1 + state.pointer.y) / 2, 5.5],
            0.5,
            delta
        );
        state.camera.lookAt(0, 0, 0);
    });
}

useFont.preload("/fonts/Poppins-Black.ttf");
