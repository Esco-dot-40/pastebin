import {
    Environment,
    Float,
    Text,
    MeshReflectorMaterial,
    BakeShadows
} from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { easing } from "maath";
import { Computers, Instances } from "./Computers";
import { Rain } from "./Rain";
import { Lightning } from "./Lightning";

export const Experience = ({ onSelect }) => {
    return (
        <group>
            <ambientLight intensity={0.1} />
            <hemisphereLight intensity={0.5} color="white" groundColor="black" />
            <pointLight position={[10, 10, 10]} intensity={1} color="#00ff88" />
            <spotLight position={[0, 5, 0]} intensity={2} color="#00ff88" angle={0.5} penumbra={1} />

            <Rain count={1200} />
            <Lightning />

            {/* Main Monitor Room Focus */}
            <group position={[0, -1, 0]}>
                <Instances>
                    <Computers onSelect={onSelect} />
                </Instances>

                {/* Razor Sharp Mirror Floor */}
                <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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
            </group>

            <CameraRig />
            <BakeShadows />
            <Environment preset="night" />
        </group>
    );
};

function CameraRig() {
    useFrame((state, delta) => {
        // Targeted ideal spot [0, 0, 12] zoomed out slightly
        // Mouse movement adds a dynamic offset for interactivity
        easing.damp3(
            state.camera.position,
            [
                (state.pointer.x * state.viewport.width) / 4,
                (state.pointer.y * state.viewport.height) / 4,
                12 + Math.sin(state.clock.elapsedTime * 0.5) * 0.5 // Slight breathing zoom
            ],
            0.5,
            delta
        );
        state.camera.lookAt(0, 0, 0);
    });
}
