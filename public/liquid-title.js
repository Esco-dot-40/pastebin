import * as THREE from 'three';
// Using global gsap from index.html CDN


// Configuration
const params = {
  // Increased distortion for better visibility
  distortionIntensity: 0.35,
  distortionSpeed: 0.5,
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
  chromaticAberration: 0.015,
  edgeFog: 0.1,
  vignetteIntensity: 0.2,
  normalMapInfluence: 0.2,
  normalMapScale: 2.0,
  normalMapOffset: 0.005,

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
  vec3 m0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( m0*m0 + h*h );
  vec3 g;
  g.x  = m0.x  * x0.x  + h.x  * x0.y;
  g.yz = m0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

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

vec2 getFrostedGlassDistortion(vec2 uv, float time, float intensity) {
  float noise1 = fbm(uv * uDistortionScale, time * uDistortionSpeed);
  float noise2 = fbm(uv * uDistortionScale * uNoise2Scale, time * uDistortionSpeed * uNoise2Speed);
  float noise3 = fbm(uv * uDistortionScale * uNoise3Scale, time * uDistortionSpeed * uNoise3Speed);
  vec2 distortion = vec2(noise1 * uNoise1Weight + noise2 * uNoise2Weight + noise3 * uNoise3Weight);
  float flowAngle = time * uFlowSpeed + noise1;
  distortion += vec2(cos(flowAngle), sin(flowAngle)) * uFlowStrength;
  return distortion * intensity;
}

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

void main() {
  vec2 uv = vUv;
  float maskStart = uProgress - uEdgeWidth;
  float maskEnd = uProgress;
  float pMask = smoothstep(maskStart, maskEnd, uv.x);
  
  if (uProgress > 1.5) pMask = 1.0;

  vec3 normalMap = generateNormalMap(uv * uNormalMapScale, uTime);
  float distortionIntensity = uDistortionIntensity; 
  vec2 glassDistortion = getFrostedGlassDistortion(uv, uTime, distortionIntensity * pMask);
  glassDistortion += (normalMap.xy - 0.5) * uNormalMapInfluence * pMask;
  vec2 distortedUv = uv + glassDistortion;
  
  if (distortedUv.x < 0.0 || distortedUv.x > 1.0 || distortedUv.y < 0.0 || distortedUv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else {
    vec2 aberrationDir = (normalMap.xy - 0.5) * 2.0;
    float aberrationStrength = uChromaticAberration * pMask;
    vec3 color = chromaticAberration(uTexture, distortedUv, aberrationDir, aberrationStrength);
    float edgeFog = smoothstep(uProgress - uEdgeWidth + 0.05, uProgress - 0.05, uv.x);
    edgeFog = 1.0 - edgeFog;
    color = mix(color, vec3(1.0), edgeFog * uEdgeFog * pMask * 0.5);
    float vig = vignette(distortedUv, uVignetteIntensity * pMask);
    color *= vig;
    float alpha = texture2D(uTexture, distortedUv).a;
    gl_FragColor = vec4(color, alpha * pMask);
  }
}
`;

function initInstance(canvas) {
  if (!canvas) return;

  function createTextTexture() {
    const txtCanvas = document.createElement('canvas');
    const ctx = txtCanvas.getContext('2d');
    const w = 2000;
    const h = 500;
    txtCanvas.width = w;
    txtCanvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.font = '900 150px "Inter", "Arial", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '1rem';
    ctx.shadowColor = 'rgba(0, 245, 255, 0.8)';
    ctx.shadowBlur = 30;
    ctx.fillText('VEROE.SPACE', w / 2, h / 2);

    const tex = new THREE.CanvasTexture(txtCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return { texture: tex, aspectRatio: w / h };
  }

  const { texture: textTexture, aspectRatio: imgAspectRatio } = createTextTexture();
  const scene = new THREE.Scene();
  const frustumSize = 2;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
  });

  const geometry = new THREE.PlaneGeometry(imgAspectRatio, 1, 64, 64);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uTexture: { value: textTexture },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uProgress: { value: 0 },
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

  function resize() {
    const container = canvas.parentElement;
    const w = container ? container.clientWidth : window.innerWidth;
    const h = 250;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setSize(w, h);
    renderer.setPixelRatio(pixelRatio);
    const aspect = w / h;

    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();

    // SCALING - User says "Too big", reducing target width to 0.4
    const targetWidth = (2 * aspect) * 0.4;
    const targetHeight = 2 * 0.4;
    let scaleW = targetWidth / imgAspectRatio;
    let scaleH = targetHeight / 1.0;
    let finalScale = Math.min(scaleW, scaleH);
    mesh.scale.set(imgAspectRatio * finalScale, finalScale, 1);
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  function tick() {
    const elapsedTime = clock.getElapsedTime();
    material.uniforms.uTime.value = elapsedTime;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  if (window.gsap) {
    window.gsap.to(material.uniforms.uProgress, {
      value: 1.5,
      duration: 3,
      ease: "power2.out"
    });
  } else {
    // Fallback if GSAP is not loaded
    material.uniforms.uProgress.value = 1.5;
  }
}

function initLiquidTitle() {
  const canvases = document.querySelectorAll('canvas.webgl, canvas.webgl-splash');
  canvases.forEach(canvas => initInstance(canvas));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiquidTitle);
} else {
  initLiquidTitle();
}
