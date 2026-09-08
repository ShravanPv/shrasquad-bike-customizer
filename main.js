import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const viewport = document.getElementById('viewport');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f13);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(2.1, 1.5, 3.1); // opening shot frames the bike and the garage sign

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.52;
controls.minDistance = 1.2;
controls.maxDistance = 4.2; // stay inside the garage walls
controls.autoRotateSpeed = 0.9;

// Idle turntable: spins after 4s of no interaction, stops the moment you touch it.
let idleTimer = null;
function keepAwake() {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { controls.autoRotate = true; }, 4000);
}
['pointerdown', 'wheel', 'touchstart'].forEach((ev) =>
  renderer.domElement.addEventListener(ev, keepAwake, { passive: true })
);
keepAwake();

const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
dirLight.position.set(3, 5, 2);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -3;
dirLight.shadow.camera.right = 3;
dirLight.shadow.camera.top = 3;
dirLight.shadow.camera.bottom = -3;
dirLight.shadow.radius = 6;
scene.add(dirLight);
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30281e, 0.55));
const rim = new THREE.DirectionalLight(0x6688ff, 0.7);
rim.position.set(-3, 2, -3);
scene.add(rim);

// ---------------------------------------------------------------------------
// The ShraSquad Garage — procedural room the bike lives in
// ---------------------------------------------------------------------------
const garage = new THREE.Group();
scene.add(garage);

const ROOM = { w: 11, d: 9, h: 3.4 };

// Concrete floor with subtle stains
function makeConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#33363c';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 120; i++) {
    const r = 14 + Math.random() * 60;
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '20,21,24' : '64,68,76'},${0.02 + Math.random() * 0.035})`;
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM.w, ROOM.d),
  new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), roughness: 0.92, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0.012; // sit above the room box's bottom face to avoid z-fighting
floor.receiveShadow = true;
garage.add(floor);

// Walls + ceiling: one inward-facing box
const room = new THREE.Mesh(
  new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d),
  new THREE.MeshStandardMaterial({ color: 0x272b32, roughness: 0.95, metalness: 0.05, side: THREE.BackSide })
);
room.position.y = ROOM.h / 2;
room.receiveShadow = true;
garage.add(room);

// Neon "SHRASQUAD GARAGE" sign on the back wall
function makeSignTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0d10';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#3a2620';
  g.lineWidth = 10;
  g.strokeRect(12, 12, 1000, 232);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#ff5d3a';
  g.shadowBlur = 46;
  g.fillStyle = '#ffc2a3';
  g.font = 'bold 96px "Space Grotesk", Arial, sans-serif';
  g.fillText('SHRASQUAD', 512, 88);
  g.shadowColor = '#ff3d81';
  g.font = 'bold 74px "Space Grotesk", Arial, sans-serif';
  g.fillStyle = '#ffd9e6';
  g.fillText('G A R A G E', 512, 186);
  return new THREE.CanvasTexture(c);
}

const sign = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, 0.85),
  new THREE.MeshBasicMaterial({ map: makeSignTexture(), toneMapped: false })
);
sign.position.set(0, 2.35, -ROOM.d / 2 + 0.02);
garage.add(sign);

const signGlow = new THREE.PointLight(0xff6b45, 14, 6, 2);
signGlow.position.set(0, 2.3, -ROOM.d / 2 + 0.7);
garage.add(signGlow);

// Roller shutter door on the left wall
function makeShutterTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  for (let y = 0; y < 512; y += 32) {
    const grad = g.createLinearGradient(0, y, 0, y + 32);
    grad.addColorStop(0, '#4a4f57');
    grad.addColorStop(0.5, '#31353c');
    grad.addColorStop(0.85, '#23262c');
    grad.addColorStop(1, '#15171b');
    g.fillStyle = grad;
    g.fillRect(0, y, 256, 32);
  }
  return new THREE.CanvasTexture(c);
}

const shutter = new THREE.Mesh(
  new THREE.PlaneGeometry(3.2, 2.7),
  new THREE.MeshStandardMaterial({ map: makeShutterTexture(), roughness: 0.6, metalness: 0.55 })
);
shutter.rotation.y = Math.PI / 2;
shutter.position.set(-ROOM.w / 2 + 0.02, 1.35, 0.6);
garage.add(shutter);

// Tire stack in the back corner
for (let i = 0; i < 3; i++) {
  const t = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.115, 14, 32),
    new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.95 })
  );
  t.rotation.x = Math.PI / 2;
  t.position.set(-4.1, 0.12 + i * 0.235, -3.5);
  t.castShadow = true;
  garage.add(t);
}

// Shelf with paint cans on the back-right wall
const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3d424b, roughness: 0.7, metalness: 0.4 });
for (let level = 0; level < 3; level++) {
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.5), shelfMat);
  board.position.set(3.6, 0.75 + level * 0.7, -ROOM.d / 2 + 0.3);
  board.castShadow = true;
  garage.add(board);
}
const canColors = [0xc0392b, 0x007cb0, 0xf6b600, 0x4b9b3f, 0x9da3a6, 0xbf4077];
canColors.forEach((color, i) => {
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.22, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
  );
  can.position.set(2.75 + (i % 3) * 0.75, 0.89 + Math.floor(i / 3) * 0.7, -ROOM.d / 2 + 0.3);
  can.castShadow = true;
  garage.add(can);
});

// Warm ceiling light fixtures
[-1.9, 1.9].forEach((x) => {
  const fixture = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.06, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xfff2dd, toneMapped: false })
  );
  fixture.position.set(x, ROOM.h - 0.04, 0);
  garage.add(fixture);
  const p = new THREE.PointLight(0xffe6c4, 10, 8, 1.8);
  p.position.set(x, ROOM.h - 0.35, 0);
  garage.add(p);
});

// Soft radial glow under the bike
const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 256;
{
  const g = glowCanvas.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,120,70,0.22)');
  grad.addColorStop(0.5, 'rgba(255,80,90,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
}
const glow = new THREE.Mesh(
  new THREE.CircleGeometry(2.4, 48),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false })
);
glow.rotation.x = -Math.PI / 2;
glow.position.y = 0.02;
garage.add(glow);

// Polished showroom slab under the bike — real planar reflections
const mirror = new Reflector(new THREE.CircleGeometry(2.1, 64), {
  clipBias: 0.003,
  textureWidth: 1024,
  textureHeight: 1024,
  color: 0x5a5f66, // darkens the reflection so it reads as polished concrete
});
mirror.rotation.x = -Math.PI / 2;
mirror.position.y = 0.014;
garage.add(mirror);
// Rough overlay ring so the mirror fades into the concrete at its edge
const fadeCanvas = document.createElement('canvas');
fadeCanvas.width = fadeCanvas.height = 256;
{
  const g = fadeCanvas.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  grad.addColorStop(0, 'rgba(51,54,60,0)');
  grad.addColorStop(0.75, 'rgba(51,54,60,0.55)');
  grad.addColorStop(1, 'rgba(51,54,60,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
}
const fade = new THREE.Mesh(
  new THREE.CircleGeometry(2.12, 64),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fadeCanvas), transparent: true, depthWrite: false })
);
fade.rotation.x = -Math.PI / 2;
fade.position.y = 0.017;
garage.add(fade);

// ---------------------------------------------------------------------------
// Materials & part registry
// ---------------------------------------------------------------------------
const FINISHES = {
  gloss:    { roughness: 0.12, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.06 },
  matte:    { roughness: 0.85, metalness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.5 },
  metallic: { roughness: 0.32, metalness: 0.9, clearcoat: 0.7, clearcoatRoughness: 0.15 },
  chrome:   { roughness: 0.04, metalness: 1.0, clearcoat: 1.0, clearcoatRoughness: 0.03 },
};

const DEFAULTS = {
  tank:      { color: '#c0392b', finish: 'gloss' },
  fenders:   { color: '#c0392b', finish: 'gloss' },
  frame:     { color: '#16181d', finish: 'gloss' },
  seat:      { color: '#2b2b30', finish: 'matte' },
  engine:    { color: '#6a707a', finish: 'metallic' },
  exhaust:   { color: '#c9ced6', finish: 'chrome' },
  fork:      { color: '#c9ced6', finish: 'chrome' },
  handlebar: { color: '#8a9099', finish: 'metallic' },
  rims:      { color: '#23262c', finish: 'metallic' },
  tires:     { color: '#1a1a1a', finish: 'matte' },
  luggage:   { color: '#2f333a', finish: 'matte' },
};

const parts = {}; // name -> { material, meshes: [], state: {color, finish} }

function partMaterial(name) {
  if (!parts[name]) {
    const state = { ...DEFAULTS[name] };
    const mat = new THREE.MeshPhysicalMaterial({ color: state.color, ...FINISHES[state.finish] });
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveIntensity = 0;
    parts[name] = { material: mat, meshes: [], state };
  }
  return parts[name].material;
}

function addMesh(partName, geometry, position, rotation) {
  const mesh = new THREE.Mesh(geometry, partMaterial(partName));
  if (position) mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.castShadow = true;
  mesh.userData.part = partName;
  parts[partName].meshes.push(mesh);
  bike.add(mesh);
  return mesh;
}

// Cylinder connecting two points (frame tubes).
function tube(partName, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 20);
  const mesh = new THREE.Mesh(geo, partMaterial(partName));
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.userData.part = partName;
  parts[partName].meshes.push(mesh);
  bike.add(mesh);
  return mesh;
}

// Capsule between two points — rounded tube ends read far less "lego" than cylinders.
function capsule(partName, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(radius, len, 6, 14);
  const mesh = new THREE.Mesh(geo, partMaterial(partName));
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.userData.part = partName;
  parts[partName].meshes.push(mesh);
  bike.add(mesh);
  return mesh;
}

// Smooth swept pipe along a curve — used for the handlebar bend and exhaust runs.
function curveTube(partName, pts, radius) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 40, radius, 14, false);
  const mesh = new THREE.Mesh(geo, partMaterial(partName));
  mesh.castShadow = true;
  mesh.userData.part = partName;
  parts[partName].meshes.push(mesh);
  bike.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Procedural motorcycle factory — three model lines + bolt-on accessories
// ---------------------------------------------------------------------------
const bike = new THREE.Group();
scene.add(bike);

// Fixed (non-paintable) accent materials
const rubberDark = new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.9 });
const headlightLens = new THREE.MeshBasicMaterial({ color: 0xfff6dd, toneMapped: false });
const taillightLens = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
const screenGlass = new THREE.MeshPhysicalMaterial({
  color: 0xcfe4f0, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false,
});

const TYPES = {
  cruiser: { label: 'Cruiser' },
  adv:     { label: 'ADV' },
  cafe:    { label: 'Café Racer' },
};

const ACC_DEFS = [
  { key: 'windscreen', label: 'Windscreen' },
  { key: 'panniers',   label: 'Panniers' },
  { key: 'rack',       label: 'Luggage rack' },
  { key: 'topbox',     label: 'Top box' },
  { key: 'crashbars',  label: 'Crash bars' },
];

let currentType = 'cruiser';
const accessories = { windscreen: false, panniers: false, rack: false, topbox: false, crashbars: false };

function fixedMesh(material, geometry, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.castShadow = true;
  bike.add(mesh);
  return mesh;
}

function buildWheel(cx, tireR, tireTube, widthScale, discSide) {
  const R = tireR + tireTube;
  const tire = new THREE.Mesh(new THREE.TorusGeometry(tireR, tireTube, 24, 56), partMaterial('tires'));
  tire.position.set(cx, R, 0);
  tire.scale.z = widthScale;
  tire.castShadow = true;
  tire.userData.part = 'tires';
  parts.tires.meshes.push(tire);
  bike.add(tire);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(tireR - 0.055, 0.02, 12, 48), partMaterial('rims'));
  ring.position.set(cx, R, 0);
  ring.castShadow = true;
  ring.userData.part = 'rims';
  parts.rims.meshes.push(ring);
  bike.add(ring);

  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, (tireR - 0.05) * 2, 0.025), partMaterial('rims'));
    arm.position.set(cx, R, 0);
    arm.rotation.z = (i / 5) * Math.PI * 2;
    arm.userData.part = 'rims';
    parts.rims.meshes.push(arm);
    bike.add(arm);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 20), partMaterial('rims'));
  hub.position.set(cx, R, 0);
  hub.rotation.x = Math.PI / 2;
  hub.userData.part = 'rims';
  parts.rims.meshes.push(hub);
  bike.add(hub);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 32), partMaterial('exhaust'));
  disc.position.set(cx, R, 0.09 * discSide);
  disc.rotation.x = Math.PI / 2;
  disc.userData.part = 'exhaust';
  parts.exhaust.meshes.push(disc);
  bike.add(disc);

  fixedMesh(rubberDark, new THREE.BoxGeometry(0.07, 0.1, 0.05),
    new THREE.Vector3(cx + 0.1 * (cx > 0 ? -1 : 1), R - 0.08, 0.09 * discSide));
  return R;
}

function engineCylinder(x, y, tilt) {
  addMesh('engine', new THREE.CylinderGeometry(0.065, 0.075, 0.22, 18),
    new THREE.Vector3(x, y, 0), { x: 0, y: 0, z: tilt });
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.21), partMaterial('engine'));
    const off = -0.06 + i * 0.045;
    fin.position.set(x - Math.sin(tilt) * off, y + Math.cos(tilt) * off, 0);
    fin.rotation.z = tilt;
    fin.userData.part = 'engine';
    parts.engine.meshes.push(fin);
    bike.add(fin);
  }
  addMesh('engine', new THREE.BoxGeometry(0.15, 0.05, 0.18),
    new THREE.Vector3(x - Math.sin(tilt) * 0.13, y + Math.cos(tilt) * 0.13, 0), { x: 0, y: 0, z: tilt });
}

function fender(cx, wheelR, arc, rotZ, width) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(wheelR + 0.035, 0.05, 12, 32, arc), partMaterial('fenders'));
  mesh.position.set(cx, wheelR, 0);
  mesh.rotation.z = rotZ;
  mesh.scale.z = width;
  mesh.castShadow = true;
  mesh.userData.part = 'fenders';
  parts.fenders.meshes.push(mesh);
  bike.add(mesh);
}

function clearBike() {
  while (bike.children.length) {
    const m = bike.children.pop();
    if (m.geometry) m.geometry.dispose();
  }
  for (const name of Object.keys(parts)) parts[name].meshes = [];
}

Object.keys(DEFAULTS).forEach(partMaterial);

function buildBike(type) {
  clearBike();

  // --- Per-type dimensions ---
  const cfg = {
    cruiser: {
      frontTire: [0.245, 0.095, 1.0], rearTire: [0.245, 0.095, 1.3],
      frontX: 0.82, rearX: -0.8, head: [0.46, 0.88, 0],
      tank: { pos: [0.06, 0.825], scale: [2.15, 0.78, 1.02], rot: -0.06, r: 0.17 },
      barY: 1.0, seatY: 0.73,
    },
    adv: {
      frontTire: [0.27, 0.075, 0.95], rearTire: [0.24, 0.09, 1.2],
      frontX: 0.84, rearX: -0.78, head: [0.48, 0.98, 0],
      tank: { pos: [0.1, 0.93], scale: [1.55, 1.0, 1.05], rot: -0.12, r: 0.17 },
      barY: 1.14, seatY: 0.84,
    },
    cafe: {
      frontTire: [0.245, 0.09, 0.95], rearTire: [0.245, 0.09, 1.15],
      frontX: 0.8, rearX: -0.78, head: [0.48, 0.87, 0],
      tank: { pos: [0.05, 0.83], scale: [2.5, 0.62, 0.95], rot: -0.02, r: 0.17 },
      barY: 0.9, seatY: 0.75,
    },
  }[type];

  const HEAD = cfg.head;
  const frontR = buildWheel(cfg.frontX, cfg.frontTire[0], cfg.frontTire[1], cfg.frontTire[2], 1);
  const rearR = buildWheel(cfg.rearX, cfg.rearTire[0], cfg.rearTire[1], cfg.rearTire[2], -1);
  const FRONT = [cfg.frontX, frontR, 0];
  const REAR = [cfg.rearX, rearR, 0];
  const backboneEnd = [-0.3, cfg.seatY + 0.01, 0];

  // --- Frame ---
  capsule('frame', HEAD, backboneEnd, 0.034);
  capsule('frame', HEAD, [0.34, 0.42, 0.05], 0.022);
  capsule('frame', HEAD, [0.34, 0.42, -0.05], 0.022);
  capsule('frame', [0.34, 0.42, 0.05], [-0.18, 0.4, 0.05], 0.022);
  capsule('frame', [0.34, 0.42, -0.05], [-0.18, 0.4, -0.05], 0.022);
  capsule('frame', [backboneEnd[0], backboneEnd[1], 0.04], [-0.76, cfg.seatY - 0.09, 0.04], 0.02);
  capsule('frame', [backboneEnd[0], backboneEnd[1], -0.04], [-0.76, cfg.seatY - 0.09, -0.04], 0.02);
  capsule('frame', [-0.18, 0.4, 0.04], [-0.5, cfg.seatY - 0.05, 0.04], 0.018);
  capsule('frame', [-0.18, 0.4, -0.04], [-0.5, cfg.seatY - 0.05, -0.04], 0.018);

  // Swingarm + twin shocks
  capsule('frame', [-0.16, 0.4, 0.09], [REAR[0], REAR[1], 0.09], 0.026);
  capsule('frame', [-0.16, 0.4, -0.09], [REAR[0], REAR[1], -0.09], 0.026);
  capsule('frame', [-0.45, 0.38, 0.09], [-0.45, 0.38, -0.09], 0.02);
  capsule('fork', [-0.6, cfg.seatY - 0.07, 0.11], [REAR[0] + 0.02, REAR[1] + 0.04, 0.11], 0.02);
  capsule('fork', [-0.6, cfg.seatY - 0.07, -0.11], [REAR[0] + 0.02, REAR[1] + 0.04, -0.11], 0.02);

  // --- Engine ---
  addMesh('engine', new THREE.BoxGeometry(0.4, 0.22, 0.28), new THREE.Vector3(0.06, 0.44, 0));
  addMesh('engine', new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24),
    new THREE.Vector3(0.06, 0.42, 0.16), { x: Math.PI / 2, y: 0, z: 0 });
  addMesh('engine', new THREE.CylinderGeometry(0.08, 0.08, 0.05, 24),
    new THREE.Vector3(0.06, 0.42, -0.16), { x: Math.PI / 2, y: 0, z: 0 });
  if (type === 'adv') {
    // Parallel twin: two upright pots
    engineCylinder(0.16, 0.62, -0.12);
    engineCylinder(0.0, 0.62, -0.12);
    // Skid plate
    addMesh('engine', new THREE.BoxGeometry(0.46, 0.03, 0.26), new THREE.Vector3(0.06, 0.31, 0));
  } else {
    // V-twin
    engineCylinder(0.18, 0.62, -0.45);
    engineCylinder(-0.07, 0.62, 0.3);
  }
  addMesh('exhaust', new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20),
    new THREE.Vector3(0.02, 0.56, 0.17), { x: Math.PI / 2, y: 0, z: 0 }); // air filter

  // --- Tank ---
  const tankGeo = new THREE.SphereGeometry(cfg.tank.r, 36, 24);
  tankGeo.scale(...cfg.tank.scale);
  const tankMesh = addMesh('tank', tankGeo, new THREE.Vector3(cfg.tank.pos[0], cfg.tank.pos[1], 0));
  tankMesh.rotation.z = cfg.tank.rot;
  addMesh('exhaust', new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16),
    new THREE.Vector3(cfg.tank.pos[0] + 0.06, cfg.tank.pos[1] + 0.125, 0)); // filler cap

  // --- Seat (per type) ---
  if (type === 'cafe') {
    const pad = new THREE.SphereGeometry(0.1, 26, 18);
    pad.scale(1.7, 0.32, 0.95);
    addMesh('seat', pad, new THREE.Vector3(-0.38, cfg.seatY + 0.02, 0));
    const hump = new THREE.SphereGeometry(0.12, 26, 18);
    hump.scale(1.0, 0.6, 0.85);
    addMesh('seat', hump, new THREE.Vector3(-0.6, cfg.seatY + 0.02, 0)); // café tail hump
  } else if (type === 'adv') {
    const pad = new THREE.SphereGeometry(0.11, 26, 18);
    pad.scale(2.5, 0.4, 1.0);
    addMesh('seat', pad, new THREE.Vector3(-0.42, cfg.seatY, 0)); // long flat rally seat
  } else {
    const seatMain = new THREE.SphereGeometry(0.11, 26, 18);
    seatMain.scale(1.9, 0.45, 1.05);
    addMesh('seat', seatMain, new THREE.Vector3(-0.42, cfg.seatY, 0));
    const seatPillion = new THREE.SphereGeometry(0.09, 22, 16);
    seatPillion.scale(1.25, 0.42, 0.95);
    addMesh('seat', seatPillion, new THREE.Vector3(-0.64, cfg.seatY + 0.05, 0));
    addMesh('seat', new THREE.BoxGeometry(0.16, 0.09, 0.18), new THREE.Vector3(-0.76, cfg.seatY - 0.01, 0));
  }
  fixedMesh(taillightLens, new THREE.BoxGeometry(0.02, 0.045, 0.1),
    new THREE.Vector3(-0.85, cfg.seatY - 0.01, 0));

  // --- Fork ---
  const axleTopF = [FRONT[0] - 0.03, FRONT[1] + 0.02, 0];
  [-1, 1].forEach((s) => {
    const stanchTop = [HEAD[0] + 0.02, HEAD[1] + 0.04, 0.08 * s];
    const mid = [
      stanchTop[0] + (axleTopF[0] - stanchTop[0]) * 0.55,
      stanchTop[1] + (axleTopF[1] - stanchTop[1]) * 0.55,
      0.08 * s,
    ];
    capsule('fork', stanchTop, mid, 0.019);
    capsule('frame', mid, [FRONT[0] - 0.01, FRONT[1], 0.08 * s], 0.03);
  });
  addMesh('frame', new THREE.BoxGeometry(0.08, 0.03, 0.22),
    new THREE.Vector3(HEAD[0] + 0.01, HEAD[1] + 0.05, 0), { x: 0, y: 0, z: -0.35 });
  addMesh('frame', new THREE.BoxGeometry(0.07, 0.03, 0.22),
    new THREE.Vector3(HEAD[0] + 0.06, HEAD[1] - 0.06, 0), { x: 0, y: 0, z: -0.35 });

  // --- Headlight ---
  const lightR = type === 'cafe' ? 0.095 : 0.085;
  addMesh('handlebar', new THREE.CylinderGeometry(lightR, lightR - 0.01, 0.1, 24),
    new THREE.Vector3(HEAD[0] + 0.1, HEAD[1] - 0.01, 0), { x: 0, y: 0, z: Math.PI / 2 });
  fixedMesh(headlightLens, new THREE.CylinderGeometry(lightR - 0.013, lightR - 0.013, 0.012, 24),
    new THREE.Vector3(HEAD[0] + 0.155, HEAD[1] - 0.01, 0), { x: 0, y: 0, z: Math.PI / 2 });

  // --- Handlebar (per type) ---
  if (type === 'cafe') {
    // Clip-ons: two stubby bars dropping off the fork tops, bar-end mirrors
    [-1, 1].forEach((s) => {
      capsule('handlebar', [HEAD[0] + 0.01, HEAD[1] + 0.06, 0.09 * s], [HEAD[0] + 0.1, HEAD[1] + 0.02, 0.24 * s], 0.014);
      fixedMesh(rubberDark, new THREE.CylinderGeometry(0.019, 0.019, 0.1, 14),
        new THREE.Vector3(HEAD[0] + 0.11, HEAD[1] + 0.015, 0.27 * s), { x: Math.PI / 2, y: 0.35 * s, z: 0 });
      capsule('handlebar', [HEAD[0] + 0.1, HEAD[1] + 0.03, 0.3 * s], [HEAD[0] + 0.08, HEAD[1] + 0.1, 0.34 * s], 0.005);
      const m = new THREE.SphereGeometry(0.035, 16, 12);
      m.scale(0.45, 1, 1.3);
      fixedMesh(rubberDark, m, new THREE.Vector3(HEAD[0] + 0.08, HEAD[1] + 0.11, 0.34 * s));
    });
  } else {
    const bx = HEAD[0] - 0.03, by = cfg.barY;
    const spread = type === 'adv' ? 0.38 : 0.34;
    curveTube('handlebar', [
      [bx + 0.01, by - 0.04, -spread], [bx - 0.01, by, -spread * 0.47],
      [bx + 0.01, by - 0.01, 0],
      [bx - 0.01, by, spread * 0.47], [bx + 0.01, by - 0.04, spread],
    ], 0.016);
    capsule('handlebar', [HEAD[0], HEAD[1] + 0.05, -0.06], [bx, by - 0.01, -0.1], 0.015);
    capsule('handlebar', [HEAD[0], HEAD[1] + 0.05, 0.06], [bx, by - 0.01, 0.1], 0.015);
    [-1, 1].forEach((s) => {
      fixedMesh(rubberDark, new THREE.CylinderGeometry(0.021, 0.021, 0.11, 14),
        new THREE.Vector3(bx + 0.01, by - 0.045, (spread + 0.04) * s), { x: Math.PI / 2, y: 0, z: 0 });
      capsule('handlebar', [bx, by - 0.01, 0.24 * s], [bx + 0.06, by + 0.13, 0.3 * s], 0.006);
      const m = new THREE.SphereGeometry(0.042, 16, 12);
      m.scale(0.45, 1, 1.35);
      fixedMesh(rubberDark, m, new THREE.Vector3(bx + 0.06, by + 0.14, 0.3 * s));
    });
  }

  // --- Exhaust (per type) ---
  if (type === 'adv') {
    // High-mount upswept can
    curveTube('exhaust', [
      [0.2, 0.52, 0.1], [0.34, 0.36, 0.14], [0.2, 0.26, 0.15], [-0.25, 0.28, 0.16], [-0.5, 0.4, 0.16],
    ], 0.028);
    capsule('exhaust', [-0.5, 0.4, 0.165], [-0.8, 0.6, 0.17], 0.05);
    fixedMesh(rubberDark, new THREE.CylinderGeometry(0.036, 0.036, 0.02, 18),
      new THREE.Vector3(-0.81, 0.61, 0.17), { x: 0, y: 0, z: Math.PI / 2 - 0.6 });
  } else if (type === 'cafe') {
    // Straight low pipe into a reverse-cone megaphone
    curveTube('exhaust', [
      [0.24, 0.54, 0.1], [0.4, 0.36, 0.13], [0.34, 0.24, 0.14], [-0.2, 0.23, 0.15],
    ], 0.028);
    capsule('exhaust', [-0.2, 0.23, 0.15], [-0.72, 0.28, 0.16], 0.048);
    fixedMesh(rubberDark, new THREE.CylinderGeometry(0.052, 0.03, 0.05, 18),
      new THREE.Vector3(-0.74, 0.285, 0.16), { x: 0, y: 0, z: Math.PI / 2 - 0.1 });
  } else {
    curveTube('exhaust', [
      [0.24, 0.56, 0.1], [0.38, 0.42, 0.14], [0.4, 0.28, 0.15], [0.1, 0.23, 0.16], [-0.35, 0.25, 0.16],
    ], 0.03);
    curveTube('exhaust', [
      [-0.02, 0.58, 0.1], [0.12, 0.44, 0.15], [0.1, 0.28, 0.16], [-0.35, 0.28, 0.165],
    ], 0.024);
    capsule('exhaust', [-0.35, 0.27, 0.165], [-0.92, 0.36, 0.17], 0.055);
    fixedMesh(rubberDark, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 18),
      new THREE.Vector3(-0.93, 0.365, 0.17), { x: 0, y: 0, z: Math.PI / 2 - 0.15 });
  }

  // Chain + sprocket (left side)
  addMesh('engine', new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24),
    new THREE.Vector3(REAR[0], REAR[1], -0.1), { x: Math.PI / 2, y: 0, z: 0 });
  capsule('engine', [-0.05, 0.46, -0.105], [REAR[0], REAR[1] + 0.07, -0.105], 0.011);
  capsule('engine', [-0.05, 0.4, -0.105], [REAR[0], REAR[1] - 0.07, -0.105], 0.011);

  // --- Fenders (per type) ---
  if (type === 'adv') {
    fender(FRONT[0], frontR, 1.0, Math.PI / 2 - 0.4, 1.6);                 // close hugger
    // Beak under the headlight
    const beak = addMesh('fenders', new THREE.BoxGeometry(0.3, 0.035, 0.16),
      new THREE.Vector3(HEAD[0] + 0.17, HEAD[1] - 0.18, 0), { x: 0, y: 0, z: 0.42 });
    beak.scale.x = 1.0;
    fender(REAR[0], rearR, 1.2, Math.PI / 2 - 0.5, 2.2);
  } else if (type === 'cafe') {
    fender(FRONT[0], frontR, 1.0, Math.PI / 2 - 0.5, 1.6);
    fender(REAR[0], rearR, 0.8, Math.PI / 2 - 0.55, 1.8);
  } else {
    fender(FRONT[0], frontR, 1.6, Math.PI / 2 - 0.7, 2.0);
    fender(REAR[0], rearR, 1.5, Math.PI / 2 - 0.45, 2.5);
  }

  // --- Accessories (bolt-ons) ---
  const needRack = accessories.rack || accessories.topbox;
  if (needRack) {
    addMesh('luggage', new THREE.BoxGeometry(0.26, 0.02, 0.26), new THREE.Vector3(-0.8, cfg.seatY + 0.08, 0));
    capsule('luggage', [-0.7, cfg.seatY + 0.07, 0.1], [-0.62, cfg.seatY - 0.02, 0.08], 0.01);
    capsule('luggage', [-0.7, cfg.seatY + 0.07, -0.1], [-0.62, cfg.seatY - 0.02, -0.08], 0.01);
  }
  if (accessories.topbox) {
    addMesh('luggage', new THREE.BoxGeometry(0.32, 0.24, 0.34), new THREE.Vector3(-0.82, cfg.seatY + 0.21, 0));
    fixedMesh(rubberDark, new THREE.BoxGeometry(0.33, 0.03, 0.1), new THREE.Vector3(-0.82, cfg.seatY + 0.31, 0));
  }
  if (accessories.panniers) {
    [-1, 1].forEach((s) => {
      addMesh('luggage', new THREE.BoxGeometry(0.3, 0.32, 0.13), new THREE.Vector3(-0.62, cfg.seatY - 0.22, 0.25 * s));
    });
  }
  if (accessories.windscreen) {
    const screenGeo = new THREE.CylinderGeometry(0.24, 0.26, type === 'adv' ? 0.34 : 0.26, 24, 1, true, -0.6, 1.2);
    const screen = new THREE.Mesh(screenGeo, screenGlass);
    screen.position.set(HEAD[0] + 0.02, HEAD[1] + (type === 'adv' ? 0.22 : 0.18), 0);
    screen.rotation.z = -0.28;
    screen.rotation.y = Math.PI; // opening faces the rider
    bike.add(screen);
  }
  if (accessories.crashbars) {
    [-1, 1].forEach((s) => {
      const bar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 10, 24, Math.PI), partMaterial('exhaust'));
      bar.position.set(0.2, 0.48, 0.17 * s);
      bar.rotation.z = Math.PI / 2 + 0.2;
      bar.castShadow = true;
      bar.userData.part = 'exhaust';
      parts.exhaust.meshes.push(bar);
      bike.add(bar);
      capsule('exhaust', [0.2, 0.31, 0.17 * s], [0.2, 0.31, 0.08 * s], 0.014);
      capsule('exhaust', [0.2, 0.65, 0.17 * s], [0.2, 0.65, 0.05 * s], 0.014);
    });
  }

  // Repaint everything with the saved per-part states
  for (const name of Object.keys(parts)) applyState(name);
  updateEmissives();
}

// ---------------------------------------------------------------------------
// Selection, hover & customization
// ---------------------------------------------------------------------------
const PART_LABELS = {
  tank: 'Tank', fenders: 'Fenders', frame: 'Frame', seat: 'Seat',
  engine: 'Engine', exhaust: 'Exhaust', fork: 'Fork', handlebar: 'Handlebar',
  rims: 'Rims', tires: 'Tires', luggage: 'Luggage',
};

const PRESETS = [
  '#c0392b', '#ff6b35', '#f6b600', '#4b9b3f', '#007cb0', '#00387b',
  '#76689a', '#bf4077', '#eef0f4', '#9da3a6', '#383e42', '#0a0a0d',
];

let selected = 'tank';
let hovered = null;

const partList = document.getElementById('partList');
const selectedLabel = document.getElementById('selectedPart');
const colorPicker = document.getElementById('colorPicker');
const colorHex = document.getElementById('colorHex');
const presetRow = document.getElementById('presetRow');
const finishSeg = document.getElementById('finishSeg');
const toastEl = document.getElementById('toast');

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function updateEmissives() {
  for (const name of Object.keys(parts)) {
    const mat = parts[name].material;
    mat.emissiveIntensity = name === selected ? 0.07 : name === hovered ? 0.04 : 0;
  }
}

function renderPartList() {
  partList.innerHTML = '';
  for (const name of Object.keys(PART_LABELS)) {
    const btn = document.createElement('button');
    btn.className = 'part-btn' + (name === selected ? ' active' : '');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = parts[name].state.color;
    const label = document.createElement('span');
    label.className = 'p-name';
    label.textContent = PART_LABELS[name];
    btn.append(sw, label);
    btn.onclick = () => selectPart(name);
    partList.appendChild(btn);
  }
}

function renderPresets() {
  presetRow.innerHTML = '';
  const current = parts[selected].state.color.toLowerCase();
  for (const hex of PRESETS) {
    const b = document.createElement('button');
    b.className = 'preset' + (hex.toLowerCase() === current ? ' active' : '');
    b.style.background = hex;
    b.title = hex;
    b.setAttribute('aria-label', `Set ${PART_LABELS[selected]} to ${hex}`);
    b.onclick = () => setColor(hex);
    presetRow.appendChild(b);
  }
}

function renderFinish() {
  const current = parts[selected].state.finish;
  finishSeg.querySelectorAll('.seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.finish === current);
  });
}

function syncUI() {
  selectedLabel.textContent = PART_LABELS[selected];
  colorPicker.value = parts[selected].state.color;
  colorHex.textContent = parts[selected].state.color.toUpperCase();
  renderPartList();
  renderPresets();
  renderFinish();
}

function selectPart(name) {
  selected = name;
  updateEmissives();
  syncUI();
}

function applyState(name) {
  const { material, state } = parts[name];
  material.color.set(state.color);
  const f = FINISHES[state.finish];
  material.roughness = f.roughness;
  material.metalness = f.metalness;
  material.clearcoat = f.clearcoat;
  material.clearcoatRoughness = f.clearcoatRoughness;
  material.needsUpdate = true;
}

function setColor(hex) {
  parts[selected].state.color = hex;
  applyState(selected);
  syncUI();
}

colorPicker.addEventListener('input', () => setColor(colorPicker.value));

finishSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  parts[selected].state.finish = btn.dataset.finish;
  applyState(selected);
  renderFinish();
});

document.getElementById('resetBtn').onclick = () => {
  for (const name of Object.keys(DEFAULTS)) {
    parts[name].state = { ...DEFAULTS[name] };
    applyState(name);
  }
  syncUI();
  toast('All parts reset to defaults');
};

// --- Bike type switcher ---
const typeSeg = document.getElementById('typeSeg');
function renderTypeSeg() {
  typeSeg.querySelectorAll('.seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === currentType);
  });
}
typeSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn || btn.dataset.type === currentType) return;
  currentType = btn.dataset.type;
  buildBike(currentType);
  renderTypeSeg();
  toast(`${TYPES[currentType].label} loaded — colors carried over`);
});

// --- Accessory toggles ---
const accList = document.getElementById('accList');
function renderAccList() {
  accList.innerHTML = '';
  for (const def of ACC_DEFS) {
    const btn = document.createElement('button');
    btn.className = 'part-btn' + (accessories[def.key] ? ' active' : '');
    btn.textContent = (accessories[def.key] ? '✓ ' : '+ ') + def.label;
    btn.onclick = () => {
      accessories[def.key] = !accessories[def.key];
      buildBike(currentType);
      renderAccList();
    };
    accList.appendChild(btn);
  }
}

// Raycast: hover highlight + click select
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pickPart(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(bike.children, false);
  return hits.length ? hits[0].object.userData.part : null;
}

renderer.domElement.addEventListener('pointermove', (e) => {
  const part = pickPart(e);
  if (part !== hovered) {
    hovered = part;
    renderer.domElement.style.cursor = part ? 'pointer' : '';
    updateEmissives();
  }
});

let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 6) return;
  const part = pickPart(e);
  if (part) selectPart(part);
});

// Fade the controls hint after first real interaction
const hint = document.getElementById('controlsHint');
let hintGone = false;
renderer.domElement.addEventListener('pointerdown', () => {
  if (hintGone) return;
  hintGone = true;
  setTimeout(() => hint.classList.add('fade'), 1500);
});

// ---------------------------------------------------------------------------
// Photo upload + palette extraction (k-means, fully in-browser)
// ---------------------------------------------------------------------------
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const paletteDiv = document.getElementById('palette');
const dropzone = document.getElementById('dropzone');
const dzInner = document.getElementById('dzInner');
let photoDataUrl = null;

dropzone.addEventListener('click', () => photoInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoInput.click(); }
});
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadPhoto(file);
});
photoInput.addEventListener('change', () => {
  if (photoInput.files[0]) loadPhoto(photoInput.files[0]);
});

function loadPhoto(file) {
  const reader = new FileReader();
  reader.onload = () => {
    photoDataUrl = reader.result;
    photoPreview.src = photoDataUrl;
    photoPreview.hidden = false;
    dzInner.hidden = true;
    const img = new Image();
    img.onload = () => {
      const clusters = extractPalette(img, 6);
      renderPalette(clusters.map((c) => c.hex));
      autoApplyPalette(clusters);
      toast('Photo colors applied to the bike — tweak any part below');
    };
    img.src = photoDataUrl;
  };
  reader.readAsDataURL(file);
}

function extractPalette(img, k) {
  const c = document.createElement('canvas');
  const scale = 80 / Math.max(img.width, img.height);
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;

  const px = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 128) px.push([data[i], data[i + 1], data[i + 2]]);
  }
  let centers = [];
  for (let i = 0; i < k; i++) centers.push(px[Math.floor((i + 0.5) * px.length / k)]);
  for (let iter = 0; iter < 10; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let best = 0, bd = Infinity;
      for (let ci = 0; ci < centers.length; ci++) {
        const d = dist2(p, centers[ci]);
        if (d < bd) { bd = d; best = ci; }
      }
      const s = sums[best];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    centers = sums.map((s, ci) => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[ci]);
  }
  // Re-count cluster sizes against the final centers
  const counts = centers.map(() => 0);
  for (const p of px) {
    let best = 0, bd = Infinity;
    for (let ci = 0; ci < centers.length; ci++) {
      const d = dist2(p, centers[ci]);
      if (d < bd) { bd = d; best = ci; }
    }
    counts[best]++;
  }
  return centers.map((c2, i) => ({ hex: rgbToHex(c2[0], c2[1], c2[2]), rgb: c2, count: counts[i] }));
}

// HSL helpers for palette-to-part mapping
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

// Map extracted photo colors onto the motorcycle:
// most vivid & frequent -> tank + fenders (the painted panels),
// next distinct vivid -> frame, darkest -> seat + tires.
// Chrome/metal parts (exhaust, fork, engine, rims, handlebar) keep defaults.
function autoApplyPalette(clusters) {
  const total = clusters.reduce((a, c) => a + c.count, 0) || 1;
  const scored = clusters.map((c) => {
    const { s, l } = rgbToHsl(c.rgb);
    // Vividness favors saturated, mid-lightness, well-represented colors
    const vivid = s * (1 - Math.abs(l - 0.5)) * Math.sqrt(c.count / total);
    return { ...c, s, l, vivid };
  });

  const byVivid = [...scored].sort((a, b) => b.vivid - a.vivid);
  const tankC = byVivid[0];
  const frameC = byVivid.find((c) => c !== tankC && dist2(c.rgb, tankC.rgb) > 2500) || tankC;
  const darkest = [...scored].sort((a, b) => a.l - b.l)[0];

  parts.tank.state.color = tankC.hex;
  parts.fenders.state.color = tankC.hex;
  parts.frame.state.color = frameC.hex;
  parts.seat.state.color = darkest.hex;
  parts.tires.state.color = darkest.hex;
  ['tank', 'fenders', 'frame', 'seat', 'tires'].forEach(applyState);
  syncUI();
}

function dist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function renderPalette(colors) {
  paletteDiv.innerHTML = '';
  for (const hex of colors) {
    const sw = document.createElement('button');
    sw.className = 'palette-swatch';
    sw.style.background = hex;
    sw.title = `${hex} — apply to selected part`;
    sw.onclick = () => setColor(hex);
    paletteDiv.appendChild(sw);
  }
}

// ---------------------------------------------------------------------------
// RAL color matching (shops speak RAL)
// ---------------------------------------------------------------------------
const RAL = [
  ['RAL 1003', 'Signal yellow', '#f9a800'], ['RAL 1013', 'Oyster white', '#ece5ce'],
  ['RAL 1021', 'Rape yellow', '#f6b600'], ['RAL 2004', 'Pure orange', '#e25303'],
  ['RAL 3000', 'Flame red', '#a72920'], ['RAL 3003', 'Ruby red', '#8d1d2c'],
  ['RAL 3020', 'Traffic red', '#c1121c'], ['RAL 4005', 'Blue lilac', '#76689a'],
  ['RAL 4010', 'Telemagenta', '#bf4077'], ['RAL 5002', 'Ultramarine blue', '#00387b'],
  ['RAL 5010', 'Gentian blue', '#004f7c'], ['RAL 5015', 'Sky blue', '#007cb0'],
  ['RAL 5021', 'Water blue', '#007577'], ['RAL 6002', 'Leaf green', '#2d5546'],
  ['RAL 6018', 'Yellow green', '#4b9b3f'], ['RAL 6027', 'Light green', '#7ebab5'],
  ['RAL 7016', 'Anthracite grey', '#383e42'], ['RAL 7035', 'Light grey', '#c5c7c4'],
  ['RAL 7040', 'Window grey', '#9da3a6'], ['RAL 8003', 'Clay brown', '#7e4b26'],
  ['RAL 8017', 'Chocolate brown', '#442f29'], ['RAL 9005', 'Jet black', '#0a0a0d'],
  ['RAL 9006', 'White aluminium', '#a1a1a0'], ['RAL 9010', 'Pure white', '#f1ece1'],
  ['RAL 9016', 'Traffic white', '#f1f0ea'], ['RAL 3004', 'Purple red', '#6b1c23'],
  ['RAL 5024', 'Pastel blue', '#5d9b9b'], ['RAL 1028', 'Melon yellow', '#ff9b00'],
];

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function nearestRal(hex) {
  const rgb = hexToRgb(hex);
  let best = RAL[0], bd = Infinity;
  for (const entry of RAL) {
    const d = dist2(rgb, hexToRgb(entry[2]));
    if (d < bd) { bd = d; best = entry; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// PDF spec sheet export
// ---------------------------------------------------------------------------
const VIEWS = [
  { name: 'Side',  pos: [0, 0.7, 3.2] },
  { name: 'Front', pos: [3.2, 0.7, 0] },
  { name: 'Top',   pos: [0.01, 3.4, 0.01] },
  { name: '3/4',   pos: [2.2, 1.5, 2.2] },
];

function captureViews() {
  const W = 640, H = 480;
  const printRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  printRenderer.setSize(W, H);
  printRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  const printCam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  const oldBg = scene.background;
  scene.background = new THREE.Color(0xffffff);
  garage.visible = false;

  // Print renders must not carry the selection/hover glow
  const savedEmissives = {};
  for (const name of Object.keys(parts)) {
    savedEmissives[name] = parts[name].material.emissiveIntensity;
    parts[name].material.emissiveIntensity = 0;
  }

  const shots = [];
  for (const v of VIEWS) {
    printCam.position.set(...v.pos);
    printCam.lookAt(0, 0.55, 0);
    printRenderer.render(scene, printCam);
    shots.push({ name: v.name, dataUrl: printRenderer.domElement.toDataURL('image/png') });
  }

  scene.background = oldBg;
  garage.visible = true;
  for (const name of Object.keys(parts)) {
    parts[name].material.emissiveIntensity = savedEmissives[name];
  }
  printRenderer.dispose();
  return shots;
}

const exportBtn = document.getElementById('exportBtn');
exportBtn.onclick = () => {
  exportBtn.disabled = true;
  // Let the disabled state paint before the (brief) capture work
  requestAnimationFrame(() => {
    try {
      buildPdf();
      toast('Spec sheet downloaded 📄');
    } finally {
      exportBtn.disabled = false;
    }
  });
};

function buildPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const buildName = document.getElementById('buildName').value || 'Custom Build';
  const pageW = 210;
  const margin = 14;

  // Header
  doc.setFillColor(20, 22, 26);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('BIKE CUSTOMIZATION SPEC SHEET', margin, 11);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Build: ${buildName}   |   Model: ${TYPES[currentType].label}   |   Date: ${new Date().toLocaleDateString()}`, margin, 19);

  // Renders — 2x2 grid
  const shots = captureViews();
  const imgW = (pageW - margin * 2 - 6) / 2;
  const imgH = imgW * 0.75;
  doc.setTextColor(40, 40, 40);
  shots.forEach((shot, i) => {
    const x = margin + (i % 2) * (imgW + 6);
    const y = 32 + Math.floor(i / 2) * (imgH + 10);
    doc.addImage(shot.dataUrl, 'PNG', x, y, imgW, imgH);
    doc.setFontSize(9);
    doc.text(`${shot.name} view`, x + 1, y + imgH + 4);
  });

  // Paint & finish table
  let ty = 32 + 2 * (imgH + 10) + 4;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Paint & Finish Specification', margin, ty);
  ty += 6;

  doc.setFontSize(9);
  const cols = [margin, margin + 38, margin + 62, margin + 88, margin + 130, margin + 158];
  doc.setFillColor(235, 235, 235);
  doc.rect(margin - 2, ty - 4, pageW - margin * 2 + 4, 6, 'F');
  doc.text('Part', cols[0], ty);
  doc.text('Hex', cols[1], ty);
  doc.text('Swatch', cols[2], ty);
  doc.text('Nearest RAL', cols[3], ty);
  doc.text('RAL name', cols[4], ty);
  doc.text('Finish', cols[5], ty);
  ty += 3;

  doc.setFont('helvetica', 'normal');
  for (const name of Object.keys(PART_LABELS)) {
    ty += 6;
    const { state } = parts[name];
    const ral = nearestRal(state.color);
    const [r, g, b] = hexToRgb(state.color);
    doc.text(PART_LABELS[name], cols[0], ty);
    doc.text(state.color.toUpperCase(), cols[1], ty);
    doc.setFillColor(r, g, b);
    doc.rect(cols[2], ty - 3.5, 10, 4.5, 'F');
    doc.setDrawColor(150);
    doc.rect(cols[2], ty - 3.5, 10, 4.5, 'S');
    doc.text(ral[0], cols[3], ty);
    doc.text(ral[1], cols[4], ty);
    doc.text(state.finish.charAt(0).toUpperCase() + state.finish.slice(1), cols[5], ty);
  }

  // Fitted accessories
  const fitted = ACC_DEFS.filter((d) => accessories[d.key]).map((d) => d.label);
  ty += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Fitted accessories:', margin, ty);
  doc.setFont('helvetica', 'normal');
  doc.text(fitted.length ? fitted.join(', ') : 'None', margin + 36, ty);

  // Reference photo, if provided
  if (photoDataUrl) {
    ty += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Customer reference photo', margin, ty);
    try {
      doc.addImage(photoDataUrl, 'JPEG', margin, ty + 3, 52, 39);
    } catch {
      try { doc.addImage(photoDataUrl, 'PNG', margin, ty + 3, 52, 39); } catch { /* unsupported format */ }
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text('Generated by ShraSquad Bike Customizer — hex values are authoritative; RAL codes are nearest matches for shop convenience.', margin, 290);

  doc.save(`${buildName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-spec.pdf`);
}

// ---------------------------------------------------------------------------
// Resize + render loop
// ---------------------------------------------------------------------------
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

// Init
buildBike(currentType);
renderTypeSeg();
renderAccList();
selectPart('tank');
