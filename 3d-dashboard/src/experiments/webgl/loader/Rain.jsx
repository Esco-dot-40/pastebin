import { useRef, useMemo } from "react";
import { useFrame } from "react-three-fiber";
import * as THREE from "three";

export const Rain = ({ count = 1000 }) => {
    const points = useRef();

    const [positions, velocities] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 1] = Math.random() * 20;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
            vel[i] = 0.1 + Math.random() * 0.2;
        }
        return [pos, vel];
    }, [count]);

    useFrame(() => {
        if (!points.current) return;
        const posAttr = points.current.geometry.attributes.position;
        for (let i = 0; i < count; i++) {
            posAttr.array[i * 3 + 1] -= velocities[i];
            if (posAttr.array[i * 3 + 1] < -5) {
                posAttr.array[i * 3 + 1] = 15;
            }
        }
        posAttr.needsUpdate = true;
    });

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute
                    attachObject={["attributes", "position"]}
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.05}
                color="#ffffff"
                transparent
                opacity={0.3}
                sizeAttenuation
            />
        </points>
    );
};
