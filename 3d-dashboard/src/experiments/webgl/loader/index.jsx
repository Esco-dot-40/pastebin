import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "react-three-fiber";
import * as THREE from "three";
import { Text as DreiText } from "drei";

// Particle field background
function ParticleField() {
    const pointsRef = useRef();
    const particleCount = 3000;

    const particles = useMemo(() => {
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 30;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

            const color = new THREE.Color();
            const hue = Math.random() * 0.2 + 0.5; // Cyan to purple range
            color.setHSL(hue, 1, 0.5);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        return { positions, colors };
    }, []);

    useFrame(({ clock }) => {
        if (pointsRef.current) {
            pointsRef.current.rotation.y = clock.getElapsedTime() * 0.03;
            pointsRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.02) * 0.2;
        }
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attachObject={["attributes", "position"]}
                    count={particleCount}
                    array={particles.positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attachObject={["attributes", "color"]}
                    count={particleCount}
                    array={particles.colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.08}
                vertexColors
                transparent
                opacity={0.7}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

// Animated text component
function AnimatedText({ text, position, scale = 1, delay = 0, color = "#00ffff" }) {
    const textRef = useRef();
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            const fadeInterval = setInterval(() => {
                setOpacity((prev) => {
                    if (prev >= 1) {
                        clearInterval(fadeInterval);
                        return 1;
                    }
                    return prev + 0.05;
                });
            }, 50);
        }, delay);
        return () => clearTimeout(timer);
    }, [delay]);

    useFrame(({ clock }) => {
        if (textRef.current && opacity > 0) {
            // Gentle floating animation
            textRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 1.5 + delay / 100) * 0.08;

            // Glitch effect on text
            if (Math.random() < 0.01) {
                textRef.current.position.x = position[0] + (Math.random() - 0.5) * 0.05;
            } else {
                textRef.current.position.x = position[0];
            }
        }
    });

    return (
        <group ref={textRef} position={position} scale={[scale, scale, scale]}>
            <DreiText
                fontSize={0.8}
                color={color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#000000"
            >
                {text}
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.8}
                    transparent
                    opacity={opacity}
                />
            </DreiText>
        </group>
    );
}

// Loading ring
function LoadingRing() {
    const ringRef = useRef();
    const ring2Ref = useRef();

    useFrame(({ clock }) => {
        if (ringRef.current) {
            ringRef.current.rotation.z = clock.getElapsedTime() * 1.5;
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.z = -clock.getElapsedTime() * 2;
        }
    });

    return (
        <group position={[0, -1.8, 0]}>
            <mesh ref={ringRef}>
                <torusGeometry args={[2, 0.06, 16, 100]} />
                <meshStandardMaterial
                    color="#00ffff"
                    emissive="#00ffff"
                    emissiveIntensity={1.5}
                    metalness={0.9}
                    roughness={0.1}
                    transparent
                    opacity={0.8}
                />
            </mesh>
            <mesh ref={ring2Ref}>
                <torusGeometry args={[1.7, 0.04, 16, 100]} />
                <meshStandardMaterial
                    color="#ff00ff"
                    emissive="#ff00ff"
                    emissiveIntensity={1.5}
                    metalness={0.9}
                    roughness={0.1}
                    transparent
                    opacity={0.6}
                />
            </mesh>
        </group>
    );
}

// Orbiting spheres
function GlowingSphere({ position, color, speed = 1, radius = 2 }) {
    const meshRef = useRef();

    useFrame(({ clock }) => {
        if (meshRef.current) {
            const t = clock.getElapsedTime() * speed;
            meshRef.current.position.x = position[0] + Math.cos(t) * radius;
            meshRef.current.position.z = position[2] + Math.sin(t) * radius;
            meshRef.current.position.y = position[1] + Math.sin(t * 2) * 0.3;

            // Pulsing glow
            const pulse = Math.sin(t * 3) * 0.2 + 0.8;
            meshRef.current.scale.setScalar(pulse * 0.25);
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <sphereGeometry args={[0.25, 32, 32]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={3}
                transparent
                opacity={0.8}
                toneMapped={false}
            />
            <pointLight color={color} intensity={2} distance={5} />
        </mesh>
    );
}

// Central glowing core
function CoreSphere() {
    const meshRef = useRef();

    useFrame(({ clock }) => {
        if (meshRef.current) {
            const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.1 + 0.9;
            meshRef.current.scale.setScalar(pulse);
            meshRef.current.rotation.x += 0.005;
            meshRef.current.rotation.y += 0.007;
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 0, -1]}>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial
                color="#ffffff"
                emissive="#00ffff"
                emissiveIntensity={2}
                wireframe
                transparent
                opacity={0.3}
            />
        </mesh>
    );
}

// Grid floor effect
function GridFloor() {
    const gridRef = useRef();

    useFrame(({ clock }) => {
        if (gridRef.current) {
            gridRef.current.position.y = -3 + Math.sin(clock.getElapsedTime()) * 0.1;
        }
    });

    return (
        <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
            <planeGeometry args={[20, 20, 20, 20]} />
            <meshBasicMaterial
                color="#00ffff"
                wireframe
                transparent
                opacity={0.2}
            />
        </mesh>
    );
}

function LoaderScene() {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("INITIALIZING");

    useEffect(() => {
        const statuses = [
            "INITIALIZING",
            "LOADING ASSETS",
            "COMPILING SHADERS",
            "ESTABLISHING CONNECTION",
            "ALMOST READY",
            "COMPLETE"
        ];

        const interval = setInterval(() => {
            setProgress((prev) => {
                const newProgress = prev + 1;

                // Update status text based on progress
                const statusIndex = Math.floor((newProgress / 100) * (statuses.length - 1));
                setStatusText(statuses[statusIndex]);

                if (newProgress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        // Redirect to main app after completion
                        window.location.href = "/";
                    }, 1000);
                    return 100;
                }
                return newProgress;
            });
        }, 40); // Completes in about 4 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <color attach="background" args={["#000000"]} />
            <fog attach="fog" args={["#000408", 8, 20]} />

            {/* Lighting setup */}
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

            {/* Background effects */}
            <ParticleField />
            <GridFloor />

            {/* Core elements */}
            <CoreSphere />

            {/* Orbiting spheres */}
            <GlowingSphere position={[0, 0, 0]} color="#00ffff" speed={0.8} radius={2.5} />
            <GlowingSphere position={[0, 0, 0]} color="#ff00ff" speed={1.2} radius={2} />
            <GlowingSphere position={[0, 0, 0]} color="#ffff00" speed={1} radius={3} />

            {/* Loading rings */}
            <LoadingRing />

            {/* Main brand text */}
            <AnimatedText
                text="esco.io"
                position={[0, 0.2, 0]}
                scale={1.3}
                delay={200}
                color="#00ffff"
            />

            {/* Status text */}
            <AnimatedText
                text={statusText}
                position={[0, -2.8, 0]}
                scale={0.4}
                delay={600}
                color="#ff00ff"
            />

            {/* Progress percentage */}
            <AnimatedText
                text={`${progress}%`}
                position={[0, -3.4, 0]}
                scale={0.5}
                delay={800}
                color="#00ffff"
            />
        </>
    );
}

export default function Loader() {
    return (
        <div style={{
            width: "100vw",
            height: "100vh",
            background: "#000",
            margin: 0,
            padding: 0,
            overflow: "hidden"
        }}>
            <Canvas
                camera={{ position: [0, 0, 6], fov: 75 }}
                gl={{
                    antialias: true,
                    alpha: false,
                    powerPreference: "high-performance"
                }}
            >
                <LoaderScene />
            </Canvas>
        </div>
    );
}
