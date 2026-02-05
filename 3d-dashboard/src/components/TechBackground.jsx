import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;
    vec2 grid = floor(uv * 40.0);
    vec2 f = fract(uv * 40.0);
    
    float t = uTime * 2.0;
    float h = hash(grid + floor(t * 0.1));
    
    // Digital pulse
    float pulse = step(0.98, hash(grid + floor(t * 0.5)));
    
    // Scanline effect
    float scanline = sin(uv.y * 100.0 + uTime * 10.0) * 0.1;
    
    // Circuit lines
    float line = step(0.95, f.x) + step(0.95, f.y);
    line *= step(0.7, hash(grid));
    
    vec3 circuitColor = mix(vec3(0.0), uColor, line * 0.5);
    circuitColor += uColor * pulse * 2.0; // Glow pulses
    
    // Depth effect
    float mask = smoothstep(1.0, 0.2, length(uv - 0.5) * 2.0);
    
    vec3 finalColor = circuitColor * mask;
    finalColor += vec3(0.01, 0.02, 0.03); // Deep blue base
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const TechBackground = () => {
    const meshRef = useRef();

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#00f2ff") }
    }), []);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 0, -5]} scale={[25, 15, 1]}>
            <planeGeometry />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent
            />
        </mesh>
    );
};
