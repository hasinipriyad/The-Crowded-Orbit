// Three.js background: stars + Earth + LEO debris
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("space-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true, // IMPORTANT: keep transparent over page
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 0); // transparent

// Scene & camera
const scene = new THREE.Scene();
// Keep fog subtle so stars/planet remain visible
scene.fog = new THREE.FogExp2(0x000010, 0.012);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 0.08, 2.6);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const dir = new THREE.DirectionalLight(0xffffff, 0.7);
dir.position.set(2.5, 1.5, 2.2);
scene.add(dir);

/*  STARFIELD  */
function makeStars(count = 14000, radius = 160) {
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
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false, // ignore fog so stars stay bright
  });
  const points = new THREE.Points(geom, mat);
  points.userData.baseSize = 0.02;
  return points;
}
const stars = makeStars();
scene.add(stars);

function updateStars(t) {
  const base = stars.userData.baseSize || 0.02;
  const tw = 1 + Math.sin(t * 2.9) * 0.085;
  stars.material.size = base * tw;
  stars.rotation.y = t * 0.019;
}

/*  EARTH  */
const loader = new THREE.TextureLoader();
const earthTex = loader.load("https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg");

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1.05, 64, 64),
  new THREE.MeshPhongMaterial({ map: earthTex, shininess: 5, specular: 0x222222 })
);
scene.add(earth);

const atm = new THREE.Mesh(
  new THREE.SphereGeometry(1.08, 64, 64),
  new THREE.MeshBasicMaterial({ color: 0x5ec8ff, transparent: true, opacity: 0.06, side: THREE.BackSide })
);
scene.add(atm);

/*  LEO SATELLITES (instanced)  */
function makeSatellites({
  count = 320,
  shells = [1.45, 1.6, 1.78],
  inclinations = [53, 70, 86],
} = {}) {
  const geom = new THREE.BoxGeometry(0.03, 0.02, 0.02);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8e6ff, metalness: 0.2, roughness: 0.4 });
  const inst = new THREE.InstancedMesh(geom, mat, count);

  const toRad = THREE.MathUtils.degToRad;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();

  const params = Array.from({ length: count }, (_, i) => ({
    r: shells[i % shells.length],
    inc: toRad(inclinations[i % inclinations.length] + THREE.MathUtils.randFloatSpread(4)),
    speed: THREE.MathUtils.randFloat(0.15, 0.45),
    phase: Math.random() * Math.PI * 2,
    roll: THREE.MathUtils.randFloat(0, Math.PI * 2),
    scale: THREE.MathUtils.randFloat(0.9, 1.4),
  }));

  inst.userData.update = (t) => {
    for (let i = 0; i < count; i++) {
      const p = params[i];
      const a = t * p.speed + p.phase;

      const x0 = Math.cos(a) * p.r;
      const z0 = Math.sin(a) * p.r;

      const incQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.inc);
      v3.set(x0, 0, z0).applyQuaternion(incQ);

      const s = p.scale * 0.8;
      q.setFromEuler(new THREE.Euler(0, a + p.roll, 0));
      m4.compose(v3, q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
  };

  return inst;
}
const sats = makeSatellites();
scene.add(sats);

/*  Input & Resize  */
const mouse = new THREE.Vector2(0, 0);
addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", onResize);

/*  Animate  */
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  // camera parallax
  camera.position.x = mouse.x * 0.12;
  camera.position.y = -mouse.y * 0.08;

  earth.rotation.y += 0.015 * dt;
  atm.rotation.y   += 0.008 * dt;

  updateStars(t);
  sats.userData.update(t);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

onResize();
animate();
