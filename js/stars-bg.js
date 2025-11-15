// js/stars-bg.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// Container and canvas
const container = document.getElementById("space-bg");
const canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.inset = "0";
canvas.style.width = "100vw";
canvas.style.height = "100vh";
canvas.style.pointerEvents = "none";
canvas.style.zIndex = "0";
container.appendChild(canvas);

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 0);

// Scene & camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.z = 5;

// --- Starfield ---
function makeStars(count = 9000, radius = 180) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.cbrt(Math.random()) * radius;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.02,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geom, mat);
  points.userData.baseSize = 0.02;
  return points;
}

const stars = makeStars();
scene.add(stars);

// Mouse parallax
const mouse = new THREE.Vector2(0, 0);
window.addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

// Resize handler
window.addEventListener("resize", () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// Animate
const clock = new THREE.Clock();
function animate() {
  const t = clock.elapsedTime;
  const base = stars.userData.baseSize || 0.02;
  const tw = 1 + Math.sin(t * 2.8) * 0.08; // gentle twinkle
  stars.material.size = base * tw;

  // rotate stars slowly + parallax shift
  stars.rotation.y = t * 0.008;
  camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.03;
  camera.position.y += (-mouse.y * 0.2 - camera.position.y) * 0.03;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
