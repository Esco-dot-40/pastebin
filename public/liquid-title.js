import * as THREE from 'three';

// Configuration
const params = {
  distortionIntensity: 0.6, // Increased for "waves"
  uProgress: 1.5,
  chromaticAberration: 0.02
};

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
uniform float uProgress;
uniform float uDistortionIntensity;
uniform float uChromaticAberration;

varying vec2 vUv;

// ========== GRADIENT NOISE ==========
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float gradientNoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289_2(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m*m*m;
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

float fbm(vec2 p, float time) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for(int i = 0; i < 5; i++) {
    value += amplitude * gradientNoise(p * frequency + time * 0.3);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = vUv;
  
  // Progress Mask (Force visible if progress is high)
  float pMask = 1.0;
  if (uProgress < 1.3) {
      pMask = smoothstep(uProgress - 0.3, uProgress, uv.x);
  }

  // Wave/Liquid Distortion (FBM)
  float ripple = fbm(uv * 1.2, uTime * 0.4);
  vec2 distortion = vec2(ripple) * uDistortionIntensity * 0.15;
  
  vec2 distortedUv = uv + distortion;
  
  // Chromatic Aberration
  float r = texture2D(uTexture, distortedUv + vec2(uChromaticAberration, 0.0)).r;
  float g = texture2D(uTexture, distortedUv).g;
  float b = texture2D(uTexture, distortedUv - vec2(uChromaticAberration, 0.0)).b;
  float alpha = texture2D(uTexture, distortedUv).a;
  
  vec3 color = vec3(r, g, b);
  
  // Enhance the glow color (Veroe Cyan)
  vec3 glowColor = vec4(0.0, 0.96, 1.0, 1.0).rgb;
  color = mix(color, glowColor, (1.0 - alpha) * 0.15);

  gl_FragColor = vec4(color, alpha * pMask);
}
`;

function initInstance(canvas) {
  if (!canvas) return;

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

  const txtCanvas = document.createElement('canvas');
  /* Adjusted Config for sharper text and SAFE fitting */
  const w = 4096;
  const h = 1024;
  txtCanvas.width = w;
  txtCanvas.height = h;

  const ctx = txtCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  // Reduced font size to ensure it fits horizontally in 4096px
  ctx.font = '900 250px "Inter", "Arial", sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if ('letterSpacing' in ctx) ctx.letterSpacing = '40px';

  // Strong Neon Glow
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 50;
  ctx.fillText('VEROE.SPACE', w / 2, h / 2);

  const texture = new THREE.CanvasTexture(txtCanvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Create material with balanced distortion
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uProgress: { value: params.uProgress },
      uDistortionIntensity: { value: 0.25 },
      uChromaticAberration: { value: 0.01 }
    },
    transparent: true,
    side: THREE.DoubleSide
  });

  const imgAspectRatio = w / h;
  const geometry = new THREE.PlaneGeometry(imgAspectRatio, 1, 64, 64);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const frustumSize = 2;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  function resize() {
    const container = canvas.parentElement;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight || 200;

    renderer.setSize(cw, ch);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const aspect = cw / ch;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();

    // Scale: Ensure it fits properly
    // We want the text to span about 80-90% of the container width
    const targetWidth = (frustumSize * aspect) * 0.9;

    // Calculate scale based on width primarily since it's text
    let scale = targetWidth / imgAspectRatio;

    // Safety check just in case it gets too tall
    if (scale > frustumSize * 0.8) {
      scale = frustumSize * 0.8;
    }

    mesh.scale.set(scale, scale, 1);
  }

  window.addEventListener('resize', resize);
  setTimeout(resize, 0);
  resize();

  const clock = new THREE.Clock();
  function animate() {
    material.uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  if (window.gsap) {
    material.uniforms.uProgress.value = 0;
    window.gsap.to(material.uniforms.uProgress, {
      value: 1.5,
      duration: 3.5,
      ease: "power2.out"
    });
  } else {
    material.uniforms.uProgress.value = 1.5;
  }
}

function start() {
  const canvases = document.querySelectorAll('.webgl, .webgl-splash');
  canvases.forEach(initInstance);
}

// Global hook for re-init if needed
window.initVeroeLogo = start;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  setTimeout(start, 100);
}
