import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const CodeParticles = ({ count = 50 }) => {
    const meshRef = useRef();

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const position = [
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            ];
            const speed = Math.random() * 0.05 + 0.01;
            temp.push({ position, speed });
        }
        return temp;
    }, [count]);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.children.forEach((child, i) => {
                child.position.y += particles[i].speed;
                if (child.position.y > 10) child.position.y = -10;
                child.rotation.x += 0.01;
                child.rotation.y += 0.01;
            });
        }
    });

    return (
        <group ref={meshRef}>
            {particles.map((p, i) => (
                <mesh key={i} position={p.position}>
                    <boxGeometry args={[0.05, 0.2, 0.05]} />
                    <meshBasicMaterial color="#00f2ff" transparent opacity={0.3} />
                </mesh>
            ))}
        </group>
    );
};
