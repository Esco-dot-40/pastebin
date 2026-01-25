import * as THREE from 'three';

// Configuration
const params = {
  distortionIntensity: 0.25,
  distortionSpeed: 0.4,
  distortionScale: 0.8,
  noise1Weight: 0.6,
  noise2Weight: 0.3,
  noise3Weight: 0.1,
  chromaticAberration: 0.012,
  edgeFog: 0.05,
  normalMapInfluence: 0.15,
  uProgress: 1.5 // Start fully progressed for now to avoid reveal issues
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

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  
  // Ripple Effect
  float n = noise(uv * 3.0 + uTime * 0.5);
  vec2 distortion = vec2(
    noise(uv * 4.0 + uTime * 0.3),
    noise(uv * 4.0 + uTime * 0.2 + 10.0)
  ) * uDistortionIntensity;
  
  vec2 distortedUv = uv + distortion * 0.1;
  
  // Chromatic Aberration
  float r = texture2D(uTexture, distortedUv + vec2(uChromaticAberration, 0.0)).r;
  float g = texture2D(uTexture, distortedUv).g;
  float b = texture2D(uTexture, distortedUv - vec2(uChromaticAberration, 0.0)).b;
  float alpha = texture2D(uTexture, distortedUv).a;
  
  gl_FragColor = vec4(r, g, b, alpha);
}
`;

function initInstance(canvas) {
  if (!canvas) return;

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

  // High quality text texture
  const txtCanvas = document.createElement('canvas');
  const ctx = txtCanvas.getContext('2d');
  txtCanvas.width = 1024;
  txtCanvas.height = 256;
  ctx.clearRect(0, 0, txtCanvas.width, txtCanvas.height);
  ctx.font = '900 80px "Inter", "Outfit", sans-serif';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '12px';
  // Subtle glow
  ctx.shadowColor = 'rgba(0, 245, 255, 0.5)';
  ctx.shadowBlur = 15;
  ctx.fillText('VEROE.SPACE', txtCanvas.width / 2, txtCanvas.height / 2);

  const texture = new THREE.CanvasTexture(txtCanvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uProgress: { value: params.uProgress },
      uDistortionIntensity: { value: params.distortionIntensity },
      uChromaticAberration: { value: params.chromaticAberration }
    },
    transparent: true
  });

  const geometry = new THREE.PlaneGeometry(4, 1);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.z = 3;

  function resize() {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight || 150;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Fit mesh to view
    const dist = camera.position.z;
    const height = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
    const width = height * camera.aspect;

    // SCALE DOWN: Make the logo smaller within its space
    const scale = 0.35;
    mesh.scale.set(width * scale, (width * scale) / 4, 1);
  }

  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  function animate() {
    material.uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

function start() {
  const canvases = document.querySelectorAll('.webgl, .webgl-splash');
  canvases.forEach(initInstance);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
