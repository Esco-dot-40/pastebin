import * as THREE from 'three';
import { gsap } from 'https://cdn.skypack.dev/gsap';

// Configuration
const params = {
    // Distortion - REDUCED for clarity
    distortionIntensity: 0.1,
    distortionSpeed: 0.4,
    distortionScale: 1.0,
    noise1Weight: 0.5,
    noise2Weight: 0.3,
    noise3Weight: 0.2,
    noise2Scale: 2.0,
    noise3Scale: 4.0,
    noise2Speed: 0.2,
    noise3Speed: 0.1,

    // Animation
    animationEnabled: true,
    animationDuration: 3.8,
    animationDelay: 0.5,
    edgeWidth: 0.2,
    manualProgress: 0,

    // Effects
    chromaticAberration: 0.005,
    edgeFog: 0.1,
    vignetteIntensity: 0.2,
    normalMapInfluence: 0.05,
    normalMapScale: 2.0,
    normalMapOffset: 0.002,

    // Flow
    flowSpeed: 0.2,
    flowStrength: 0.2,

    // FBM
    fbmOctaves: 4,
    fbmSpeed: 0.1,
    fbmAmplitude: 0.3,
    fbmFrequency: 2.0,
    fbmLacunarity: 2.0,
    fbmGain: 0.5,
};

// Shaders
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uMouse;
uniform float uProgress;

// Uniforms for tweakable parameters
uniform float uDistortionIntensity;
uniform float uDistortionSpeed;
uniform float uDistortionScale;
uniform float uNoise1Weight;
uniform float uNoise2Weight;
uniform float uNoise3Weight;
uniform float uNoise2Scale;
uniform float uNoise3Scale;
uniform float uNoise2Speed;
uniform float uNoise3Speed;
uniform float uEdgeWidth;
uniform float uChromaticAberration;
uniform float uEdgeFog;
uniform float uVignetteIntensity;
uniform float uNormalMapInfluence;
uniform float uNormalMapScale;
uniform float uNormalMapOffset;
uniform float uFlowSpeed;
uniform float uFlowStrength;
uniform float uFbmSpeed;
uniform float uFbmAmplitude;
uniform float uFbmFrequency;
uniform float uFbmLacunarity;
uniform float uFbmGain;

varying vec2 vUv;

// ========== GRADIENT NOISE ==========
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float gradientNoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                     -0.577350269189626,
                      0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289_2(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian Motion
float fbm(vec2 p, float time) {
  float value = 0.0;
  float amplitude = uFbmAmplitude;
  float frequency = uFbmFrequency;
  
  for(int i = 0; i < 5; i++) {
    value += amplitude * gradientNoise(p * frequency + time * uFbmSpeed);
    frequency *= uFbmLacunarity;
    amplitude *= uFbmGain;
  }
  return value;
}

// ========== NORMAL MAP GENERATION ==========
vec3 generateNormalMap(vec2 uv, float time) {
  float offset = uNormalMapOffset;
  
  float center = fbm(uv, time);
  float right = fbm(uv + vec2(offset, 0.0), time);
  float top = fbm(uv + vec2(0.0, offset), time);
  
  float dx = (right - center) / offset;
  float dy = (top - center) / offset;
  
  vec3 normal = normalize(vec3(-dx, -dy, 1.0));
  
  return normal * 0.5 + 0.5;
}

// ========== FROSTED GLASS DISTORTION ==========
vec2 getFrostedGlassDistortion(vec2 uv, float time, float intensity) {
  float noise1 = fbm(uv * uDistortionScale, time * uDistortionSpeed);
  float noise2 = fbm(uv * uDistortionScale * uNoise2Scale, time * uDistortionSpeed * uNoise2Speed);
  float noise3 = fbm(uv * uDistortionScale * uNoise3Scale, time * uDistortionSpeed * uNoise3Speed);
  
  vec2 distortion = vec2(noise1 * uNoise1Weight + noise2 * uNoise2Weight + noise3 * uNoise3Weight);
  
  float flowAngle = time * uFlowSpeed + noise1;
  distortion += vec2(cos(flowAngle), sin(flowAngle)) * uFlowStrength;
  
  return distortion * intensity;
}

// ========== POST-PROCESSING EFFECTS ==========
vec3 chromaticAberration(sampler2D tex, vec2 uv, vec2 direction, float strength) {
  vec2 offset = direction * strength;
  float r = texture2D(tex, uv + offset).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - offset).b;
  return vec3(r, g, b);
}

float vignette(vec2 uv, float intensity) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);
  return 1.0 - smoothstep(0.3, 0.8, dist) * intensity;
}

// ========== MAIN ==========
void main() {
  vec2 uv = vUv;
  
  // Scale to 50% and center
  // float scale = 0.5;
  // uv = (uv - 0.5) / scale + 0.5;
  // Note: Removing the scaling here to let CSS control size via canvas size, or we keep it if desired. 
  // The original script scaled it down. I will keep it full size for now to fill the plane.
  
  // Create animated progress mask
  float maskStart = uProgress - uEdgeWidth;
  float maskEnd = uProgress;
  float progressMask = smoothstep(maskStart, maskEnd, uv.x);
  
  // Actually, let's keep it simple: just distort appropriately.
  
  // Generate normal map
  vec3 normalMap = generateNormalMap(uv * uNormalMapScale, uTime);
  
  // Get frosted glass distortion
  float distortionIntensity = uDistortionIntensity; // * progressMask; // Removing progress mask from distortion intensity for constant liquid effect, but we can animate it back.
  // The original script animated 'uProgress' to reveal/hide or animate the effect.
  // The user wants "replace the text with this animation".
  // If we want the text to always be visible but liquidy:
  float mask = 1.0; 
  
  // Let's stick closer to the original logic but maybe adjust the mask so it's always visible?
  // The original GSAP animates uProgress from 0 to 1.2.
  // If we want it to *be* the text, we probably want it fully 'progressed' or looping.
  // The snippet has:
  // progressAnimation = gsap.to(material.uniforms.uProgress, { value: 1.2, ... repeat: -1, yoyo: true ... })
  // So it wipes in and out. That might be cool. I'll keep it.
  
  float progressVal = uProgress; 
  // If we want the text to always be visible, we should maybe clamp progressVal. 
  // But let's follow the "animation" request exactly.
  
  float pMask = smoothstep(progressVal - uEdgeWidth, progressVal, uv.x);

  vec2 glassDistortion = getFrostedGlassDistortion(uv, uTime, distortionIntensity * pMask);
  
  // Apply normal map influence
  glassDistortion += (normalMap.xy - 0.5) * uNormalMapInfluence * pMask;
  
  // Final distorted UV
  vec2 distortedUv = uv + glassDistortion;
  
  // Check bounds
  if (distortedUv.x < 0.0 || distortedUv.x > 1.0 || distortedUv.y < 0.0 || distortedUv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else {
    // Sample texture with chromatic aberration
    vec2 aberrationDir = (normalMap.xy - 0.5) * 2.0;
    float aberrationStrength = uChromaticAberration * pMask;
    vec3 color = chromaticAberration(uTexture, distortedUv, aberrationDir, aberrationStrength);
    
    // Add frosted glass fog effect
    float edgeFog = smoothstep(progressVal - uEdgeWidth + 0.05, progressVal - 0.05, uv.x);
    edgeFog = 1.0 - edgeFog;
    color = mix(color, vec3(1.0), edgeFog * uEdgeFog * pMask);
    
    // Apply vignette
    float vig = vignette(distortedUv, uVignetteIntensity * pMask);
    color *= vig;
    
    // Sample original texture alpha
    float alpha = texture2D(uTexture, distortedUv).a;
    
    gl_FragColor = vec4(color, alpha);
  }
}
`;

function initLiquidTitle() {
    const canvas = document.querySelector('canvas.webgl');
    if (!canvas) return;

    // Text Content Generation
    function createTextTexture() {
        const txtCanvas = document.createElement('canvas');
        const ctx = txtCanvas.getContext('2d');
        const w = 2000;
        const h = 500;
        txtCanvas.width = w;
        txtCanvas.height = h;

        ctx.clearRect(0, 0, w, h);

        // Font settings
        ctx.font = '900 150px "Inter", "Arial", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '1rem';

        // Shadow/Glow
        ctx.shadowColor = 'rgba(0, 245, 255, 0.8)';
        ctx.shadowBlur = 30;

        // Draw Text
        ctx.fillText('VEROE.SPACE', w / 2, h / 2);

        const tex = new THREE.CanvasTexture(txtCanvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return { texture: tex, aspectRatio: w / h };
    }

    const { texture: textTexture, aspectRatio: imgAspectRatio } = createTextTexture();

    // Scene setup
    const scene = new THREE.Scene();

    // Camera
    const frustumSize = 2;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });

    // Plane
    // Initial geometry, will be scaled in resize
    const geometry = new THREE.PlaneGeometry(imgAspectRatio, 1, 64, 64);

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uTexture: { value: textTexture },
            uMouse: { value: new THREE.Vector2(0, 0) },
            uProgress: { value: 0 },

            // Params
            uDistortionIntensity: { value: params.distortionIntensity },
            uDistortionSpeed: { value: params.distortionSpeed },
            uDistortionScale: { value: params.distortionScale },
            uNoise1Weight: { value: params.noise1Weight },
            uNoise2Weight: { value: params.noise2Weight },
            uNoise3Weight: { value: params.noise3Weight },
            uNoise2Scale: { value: params.noise2Scale },
            uNoise3Scale: { value: params.noise3Scale },
            uNoise2Speed: { value: params.noise2Speed },
            uNoise3Speed: { value: params.noise3Speed },
            uEdgeWidth: { value: params.edgeWidth },
            uChromaticAberration: { value: params.chromaticAberration },
            uEdgeFog: { value: params.edgeFog },
            uVignetteIntensity: { value: params.vignetteIntensity },
            uNormalMapInfluence: { value: params.normalMapInfluence },
            uNormalMapScale: { value: params.normalMapScale },
            uNormalMapOffset: { value: params.normalMapOffset },
            uFlowSpeed: { value: params.flowSpeed },
            uFlowStrength: { value: params.flowStrength },
            uFbmSpeed: { value: params.fbmSpeed },
            uFbmAmplitude: { value: params.fbmAmplitude },
            uFbmFrequency: { value: params.fbmFrequency },
            uFbmLacunarity: { value: params.fbmLacunarity },
            uFbmGain: { value: params.fbmGain },
        },
        transparent: true,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Resize Logic - Robust "Contain"
    function resize() {
        const container = canvas.parentElement;
        const w = container ? container.clientWidth : window.innerWidth;
        const h = 250; // Fixed height container

        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        renderer.setSize(w, h);
        renderer.setPixelRatio(pixelRatio);

        const aspect = w / h;

        camera.left = -frustumSize * aspect / 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = -frustumSize / 2;
        camera.updateProjectionMatrix();

        // Goal: Fit the text texture (imgAspectRatio) into the camera view (aspect)
        // Texture width = imgAspectRatio (relative to height 1)
        // Camera width = frustumSize * aspect = 2 * aspect
        // Camera height = 2

        // If we set mesh scale to (imgAspectRatio, 1, 1), it has height 1 (half screen).
        // Let's make base height 1.5 to fill more vertical space? 
        // Or keep it 1.0 relative to Viewport height of 2.

        // We want the text to roughly fill 80% of width OR height.

        const targetWidth = (2 * aspect) * 0.8;
        const targetHeight = 2 * 0.8;

        // Calculate scale to fit width
        let scaleW = targetWidth / imgAspectRatio;
        // Calculate scale to fit height
        let scaleH = targetHeight / 1.0;

        // Choose smaller scale to ensure it fits both
        let finalScale = Math.min(scaleW, scaleH);

        mesh.scale.set(imgAspectRatio * finalScale, finalScale, 1);
    }
    window.addEventListener('resize', resize);
    resize();

    // Animation Loop
    const clock = new THREE.Clock();

    function tick() {
        const elapsedTime = clock.getElapsedTime();
        material.uniforms.uTime.value = elapsedTime;
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
    }

    tick();

    // STATIC VISIBILITY - No Wiping
    // We just want it to be visible and rippling.
    material.uniforms.uProgress.value = 1.5;

    // Optional: Animate slight entry float? No, keep it simple.
    gsap.from(mesh.position, {
        y: -0.5,
        duration: 1.5,
        ease: "power3.out"
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiquidTitle);
} else {
    initLiquidTitle();
}
