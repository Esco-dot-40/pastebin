import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const Lightning = () => {
    const [active, setActive] = useState(false);

    const points = useMemo(() => {
        const p = [];
        let current = new THREE.Vector3(0, 5, 0);
        for (let i = 0; i < 20; i++) {
            p.push(current.clone());
            current.add(new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                -0.6,
                (Math.random() - 0.5) * 2
            ));
        }
        return p;
    }, [active]);

    useFrame((state) => {
        // Random strikes (Increased frequency)
        if (Math.random() > 0.97) {
            setActive(true);
            setTimeout(() => setActive(false), 50 + Math.random() * 150);
        }
    });

    if (!active) return null;

    const posArray = new Float32Array(points.flatMap(p => [p.x, p.y, p.z]));

    return (
        <group position={[(Math.random() - 0.5) * 30, 8, (Math.random() - 0.5) * 20]}>
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={points.length}
                        array={posArray}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color="#ffffff" linewidth={3} transparent opacity={1} />
            </line>
            <pointLight intensity={100} distance={100} color="#00ff88" />
            <pointLight intensity={50} distance={50} color="#ffffff" />
        </group>
    );
};
