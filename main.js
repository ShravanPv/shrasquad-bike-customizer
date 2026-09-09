// ShraSquad Garage — Bike Customizer
// Copyright (c) 2026 Shravan PV. Licensed under the MIT License — see LICENSE.
// https://github.com/ShravanPv/shrasquad-bike-customizer

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const viewport = document.getElementById('viewport');
// Read once, up front: the camera presets, the idle animation and the intro all key off it.
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 6, 14); // the floor fades to nothing — no walls, no horizon

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(2.1, 1.5, 3.1); // opening shot frames the bike and the wordmark

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.appendChild(renderer.domElement);
// Not tabbable: focus on the canvas enabled nothing (keys 1–5 work from anywhere, orbit is
// pointer-only), so it was an empty tab stop. The camera pill is the keyboard path to the views.
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', 'Interactive 3D preview of your motorcycle build');

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.52;
controls.minDistance = 1.2;
controls.maxDistance = 6; // no walls now — this is the only thing keeping the bike framed
controls.autoRotateSpeed = 0.9;

// Idle turntable: spins after 4s of no interaction, stops the moment you touch it.
// autoRotateEnabled is the user's switch (the Auto-rotate button in the camera pill); while
// it is off, nothing here may turn the turntable back on. Off by default for reduced motion.
let autoRotateEnabled = !REDUCED_MOTION;
let idleTimer = null;
function keepAwake() {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
  if (!autoRotateEnabled) return;
  idleTimer = setTimeout(() => { if (autoRotateEnabled) controls.autoRotate = true; }, 4000);
}
// Hovering the stage also parks it (auto-rotating content must pause on hover); the same 4s
// countdown restarts it afterwards.
['pointerdown', 'pointerenter', 'wheel', 'touchstart'].forEach((ev) =>
  renderer.domElement.addEventListener(ev, keepAwake, { passive: true })
);
keepAwake();

// ---------------------------------------------------------------------------
// Lighting rig — MotoGP-launch studio: one hard warm key, two cool kickers
// ---------------------------------------------------------------------------
// The rig lives on the scene (not the stage group) so the PDF spec renders keep the
// same lighting once captureViews() hides the stage.
const STAGE_TARGET = new THREE.Vector3(0, 0.55, 0); // everything is aimed at the tank
const KEY_POS = new THREE.Vector3(1.6, 4.2, 2.2);
const KEY_ANGLE = 0.42;

const keyLight = new THREE.SpotLight(0xfff1e0, 26, 12, KEY_ANGLE, 0.55, 2);
keyLight.position.copy(KEY_POS);
keyLight.target.position.copy(STAGE_TARGET);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0002;
keyLight.shadow.radius = 4;
keyLight.shadow.camera.near = 1.5; // far is taken from the light's distance automatically
scene.add(keyLight, keyLight.target);

// Kickers: cool rim light from behind-left and behind-right so the silhouette separates
// from the void. No shadows — they only trace edges.
[[-3.2, 2.6, -2.4], [3.0, 2.4, -2.8]].forEach((pos) => {
  const kicker = new THREE.SpotLight(0xcfd8ff, 7, 12, 0.6, 0.7, 2);
  kicker.position.set(...pos);
  kicker.target.position.copy(STAGE_TARGET);
  scene.add(kicker, kicker.target);
});

// Barely-there fill so the underside is never pitch black
scene.add(new THREE.HemisphereLight(0x8fa3c8, 0x0a0a0a, 0.12));

// ---------------------------------------------------------------------------
// The stage — a black void with a wet-black floor, a light beam and the neon wordmark
// ---------------------------------------------------------------------------
// captureViews() hides this whole group and renders the bike on white for the PDF.
const stage = new THREE.Group();
scene.add(stage);

const BRAND = '#ff3b1f'; // the one neon/accent colour — matches the UI accent exactly

// Floor: near-black, slightly glossy, fading into the fog
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.45, metalness: 0.15, envMapIntensity: 0.6 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
stage.add(floor);

// Wet-black slab under the bike — real planar reflections of the bike and the wordmark
const mirror = new Reflector(new THREE.CircleGeometry(2.4, 64), {
  clipBias: 0.003,
  textureWidth: 1024,
  textureHeight: 1024,
  color: 0x3a3a3a, // darkens the reflection so it reads as a wet black stage, not a mirror
});
mirror.rotation.x = -Math.PI / 2;
mirror.position.y = 0.012;
stage.add(mirror);

// Fake volumetric beam under the key light: an open cone from the lamp down to the floor.
// Alpha peaks where the surface faces the camera and dies toward the silhouette, so it
// reads as haze rather than a flat translucent triangle, and it dissolves before the
// floor so there is no hard ellipse where the two meet. Additive, so black adds nothing.
const beamMat = new THREE.ShaderMaterial({
  uniforms: {
    color: { value: new THREE.Color(0xffe8d0) },
    opacity: { value: 0.06 },
  },
  vertexShader: `
    varying float vFacing;
    varying float vAlong;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      vFacing = abs(dot(n, normalize(-mvPosition.xyz)));
      vAlong = uv.y; // 1 at the lamp, 0 at the floor
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform float opacity;
    varying float vFacing;
    varying float vAlong;
    void main() {
      float hem = smoothstep(0.0, 0.5, vAlong);
      gl_FragColor = vec4(color, opacity * pow(vFacing, 1.6) * hem);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const beamDir = STAGE_TARGET.clone().sub(KEY_POS).normalize();
const beamLen = KEY_POS.y / -beamDir.y; // along the axis from the lamp down to y = 0
const beamFoot = KEY_POS.clone().addScaledVector(beamDir, beamLen);
const beam = new THREE.Mesh(
  new THREE.ConeGeometry(Math.tan(KEY_ANGLE) * beamLen * 0.8, beamLen, 48, 1, true),
  beamMat
);
beam.position.copy(KEY_POS).add(beamFoot).multiplyScalar(0.5); // apex at the lamp, base on the floor
beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().negate());
// Layer 1: the main camera sees the beam, the Reflector's virtual camera (layer 0 only)
// does not — seen from under the floor the haze just washes out the reflected bike.
beam.layers.set(1);
camera.layers.enable(1);
stage.add(beam);

// Neon wordmark floating in the void behind the bike — text only, no panel, no frame.
// Drawn on a transparent canvas: neon tubes in BRAND with a heavy halo and a hot core.
function drawWordmark(c) {
  const W = c.width, H = c.height;
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  // Italic lean: skew about the vertical centre so the block stays centred
  g.setTransform(1, 0, -0.12, 1, 0.12 * (H / 2), 0);
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const stack = '"Barlow Condensed", "Space Grotesk", Arial, sans-serif';

  // Headline — condensed heavy; shrink to fit if a wider fallback font is in use
  let size = 300;
  g.font = `800 ${size}px ${stack}`;
  size = Math.floor(size * Math.min(1, 1360 / g.measureText('SHRASQUAD').width));
  g.font = `800 ${size}px ${stack}`;
  g.textAlign = 'center';
  const y1 = 205;
  g.shadowColor = BRAND;
  g.shadowBlur = 40;
  g.fillStyle = BRAND;
  g.fillText('SHRASQUAD', W / 2, y1); // stacked twice: a denser halo
  g.fillText('SHRASQUAD', W / 2, y1);
  g.shadowBlur = 0;
  // Hot core, then the neon rim — the stroke straddles the outline, so it eats into the
  // letter and leaves a thin white-hot centre like a real tube
  g.fillStyle = '#fff1ea';
  g.fillText('SHRASQUAD', W / 2, y1);
  g.strokeStyle = BRAND;
  g.lineWidth = size * 0.11;
  g.strokeText('SHRASQUAD', W / 2, y1);

  // Sub-line — thin, tracked-out GARAGE with a short neon rail either side
  const size2 = Math.floor(size * 0.3);
  g.font = `600 ${size2}px ${stack}`;
  g.textAlign = 'left';
  const y2 = y1 + size * 0.63;
  const gap = size2 * 0.36;
  const chars = 'GARAGE'.split('');
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, w) => a + w, 0) + gap * (chars.length - 1);
  const x0 = W / 2 - total / 2;
  const drawSpaced = () => {
    let x = x0;
    chars.forEach((ch, i) => { g.fillText(ch, x, y2); x += widths[i] + gap; });
  };
  g.shadowColor = BRAND;
  g.shadowBlur = 28;
  g.fillStyle = BRAND;
  drawSpaced();
  drawSpaced();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,241,234,0.7)';
  drawSpaced();

  const railGap = 44, railLen = 240;
  g.shadowColor = BRAND;
  g.shadowBlur = 24;
  g.strokeStyle = BRAND;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(x0 - railGap - railLen, y2);
  g.lineTo(x0 - railGap, y2);
  g.moveTo(x0 + total + railGap, y2);
  g.lineTo(x0 + total + railGap + railLen, y2);
  g.stroke();
  g.shadowBlur = 0;
}

const wordmarkCanvas = document.createElement('canvas');
wordmarkCanvas.width = 1600;
wordmarkCanvas.height = 500;
drawWordmark(wordmarkCanvas);
const wordmarkTex = new THREE.CanvasTexture(wordmarkCanvas);
wordmarkTex.colorSpace = THREE.SRGBColorSpace;
wordmarkTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const wordmark = new THREE.Mesh(
  new THREE.PlaneGeometry(4.2, 4.2 * (wordmarkCanvas.height / wordmarkCanvas.width)),
  new THREE.MeshBasicMaterial({ map: wordmarkTex, transparent: true, toneMapped: false, depthWrite: false, fog: false })
);
wordmark.material.color.setScalar(1.35); // push the tubes past 1.0 so bloom catches the hot core
wordmark.position.set(0, 1.75, -3.6);
stage.add(wordmark);
// Canvas text is rasterised with whatever font is loaded at draw time — redraw once the
// web font lands. One-off; a no-op when the font is already in.
if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load('800 300px "Barlow Condensed"'),
    document.fonts.load('600 90px "Barlow Condensed"'),
  ]).then(() => {
    drawWordmark(wordmarkCanvas);
    wordmarkTex.needsUpdate = true;
  }).catch(() => { /* fallback font already drawn */ });
}

// Neon spill: tints the floor and the bike's rear edges, and shows up in the Reflector
const neonLight = new THREE.PointLight(new THREE.Color(BRAND), 8, 7, 2);
neonLight.position.set(0, 1.6, -2.9);
stage.add(neonLight);

// ---------------------------------------------------------------------------
// Materials & part registry
// ---------------------------------------------------------------------------
// sheen is the fine metal-flake sparkle on 'metallic'; it is 0 (off) on every other finish.
// gloss = wet paint: a full, very smooth clearcoat over a slightly rough base.
// envMapIntensity caps the RoomEnvironment contribution on the mirror finishes: its light
// panels sit at radiance 17-100, and a near-perfect mirror of them is far past the bloom
// threshold over the whole part — chrome went solid white with a halo, not chrome.
const FINISHES = {
  gloss:    { roughness: 0.14, metalness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.05, sheen: 0, sheenRoughness: 0.5, envMapIntensity: 1.0 },
  matte:    { roughness: 0.85, metalness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.5, sheen: 0, sheenRoughness: 0.5, envMapIntensity: 1.0 },
  metallic: { roughness: 0.32, metalness: 0.9, clearcoat: 0.8, clearcoatRoughness: 0.12, sheen: 0.25, sheenRoughness: 0.5, envMapIntensity: 0.8 },
  chrome:   { roughness: 0.04, metalness: 1.0, clearcoat: 1.0, clearcoatRoughness: 0.03, sheen: 0, sheenRoughness: 0.5, envMapIntensity: 0.35 },
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
    mat.sheenColor = new THREE.Color(0xffffff); // white flake; sheen strength comes from the finish
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveIntensity = 0;
    parts[name] = { material: mat, meshes: [], state };
  }
  return parts[name].material;
}

// Register a paintable mesh: shared per-part material, raycast tag, shadow, parent.
// `parent` defaults to the bike root; wheel meshes pass their pivot, engine pots their group.
function addMesh(partName, geometry, position, rotation, parent = bike) {
  const mesh = new THREE.Mesh(geometry, partMaterial(partName));
  if (position) mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.castShadow = true;
  mesh.userData.part = partName;
  parts[partName].meshes.push(mesh);
  parent.add(mesh);
  return mesh;
}

// Cylinder connecting two points (frame tubes).
function tube(partName, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const mesh = addMesh(partName, new THREE.CylinderGeometry(radius, radius, len, 20));
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// Capsule between two points — rounded tube ends read far less "lego" than cylinders.
function capsule(partName, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const mesh = addMesh(partName, new THREE.CapsuleGeometry(radius, len, 6, 14));
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// Smooth swept pipe along a curve — used for the handlebar bend and exhaust runs.
function curveTube(partName, pts, radius) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return addMesh(partName, new THREE.TubeGeometry(curve, 40, radius, 14, false));
}

// Same sweep with a fixed (non-paintable) material — brake lines, cables, seat piping.
function fixedCurveTube(material, pts, radius) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return fixedMesh(material, new THREE.TubeGeometry(curve, 40, radius, 10, false));
}

// Revolve an [r, y] profile around Y. Profiles are traced counter-clockwise in the (r, y)
// plane — outward along the bottom, up the outside, inward across the top, down the inside —
// so LatheGeometry's normals and winding come out facing away from the solid.
function latheGeo(profile, segments = 32) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

// Radius of a lathe profile at axial position y (linear between the profile points).
function profileRadiusAt(profile, y) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y0 !== y1 && y >= Math.min(y0, y1) && y <= Math.max(y0, y1)) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}

// Point a mesh built along its local +y (lathes, cylinders) from `from` toward `to`,
// with its base sitting at `from`. Returns the distance.
function alignY(mesh, from, to) {
  const a = new THREE.Vector3(...from);
  const dir = new THREE.Vector3(...to).sub(a);
  const len = dir.length();
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return len;
}

// Rounded rectangle centred on the origin, for bevelled extrusions (crankcase, covers, caliper).
function roundedRectShape(w, h, r) {
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedBox(w, h, depth, r, bevel) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// ---------------------------------------------------------------------------
// Procedural motorcycle factory — three model lines + bolt-on accessories
// ---------------------------------------------------------------------------
const bike = new THREE.Group();
scene.add(bike);
// One Group per wheel, positioned at the axle; the render loop spins these. Reset by clearBike().
const wheelPivots = [];

// Fixed (non-paintable) accent materials
const rubberDark = new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.9 });
const treadDark = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.92, sheen: 0.2, sheenRoughness: 0.8 });
const chainMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3d43, roughness: 0.45, metalness: 0.9 });
const boltMat = new THREE.MeshPhysicalMaterial({ color: 0xb9bec6, roughness: 0.3, metalness: 1.0 });
const badgeMat = new THREE.MeshPhysicalMaterial({
  color: BRAND, emissive: BRAND, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.2, clearcoat: 1,
});
const amberLens = new THREE.MeshBasicMaterial({ color: 0xffa62b, toneMapped: false });
const plateMat = new THREE.MeshPhysicalMaterial({ color: 0x1c1e22, roughness: 0.5 });
const plateBorder = new THREE.MeshPhysicalMaterial({ color: 0xe9e9e6, roughness: 0.4 });
const headlightLens = new THREE.MeshBasicMaterial({ color: 0xfff6dd, toneMapped: false });
const HEADLIGHT_PRINT = headlightLens.color.clone(); // display-range cream for the PDF renders
// Live: pushed past 1.0 so the lens clears the bloom threshold even at the dim end of its pulse
// (toneMapped:false is inert under the composer — OutputPass tone-maps the finished frame).
headlightLens.color.multiplyScalar(1.6);
// The idle loop breathes the lens between these two (mean brightness 0.92x, +/-8%)
const HEADLIGHT_BASE = headlightLens.color.clone();
const HEADLIGHT_DIM = HEADLIGHT_BASE.clone().multiplyScalar(0.84);
const taillightLens = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });
const screenGlass = new THREE.MeshPhysicalMaterial({
  color: 0xcfe4f0, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false,
});

// Final drive lives on the left, outboard of the swingarm (z = -0.11) and the crankcase (z = -0.16)
const CHAIN_Z = -0.175;
const CHAIN_PITCH = 0.02;

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

function fixedMesh(material, geometry, position, rotation, parent = bike) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Five Y-spokes: a tapered stem from the hub that forks into two arms meeting the rim.
function ySpokeShape(rHub, rRim, half) {
  const hw0 = 0.024, hw1 = 0.016, hw2 = 0.011;
  const rSplit = rRim * 0.5;
  const sa = Math.sin(half), ca = Math.cos(half);
  const eL = [-sa * rRim, ca * rRim], eR = [sa * rRim, ca * rRim];
  const pL = [-ca, -sa], pR = [ca, -sa]; // outward perpendiculars of each arm
  const s = new THREE.Shape();
  s.moveTo(-hw0, rHub);
  s.lineTo(-hw1, rSplit);
  s.lineTo(eL[0] + pL[0] * hw2, eL[1] + pL[1] * hw2);
  s.lineTo(eL[0] - pL[0] * hw2, eL[1] - pL[1] * hw2);
  s.lineTo(0, rSplit + 0.03);
  s.lineTo(eR[0] - pR[0] * hw2, eR[1] - pR[1] * hw2);
  s.lineTo(eR[0] + pR[0] * hw2, eR[1] + pR[1] * hw2);
  s.lineTo(hw1, rSplit);
  s.lineTo(hw0, rHub);
  s.closePath();
  return s;
}

// tireR + tireTube is the rolling radius (kept from the old torus so the frame maths holds);
// widthScale sets the section width. `sprocket` hangs the rear sprocket + carrier on the pivot.
function buildWheel(cx, tireR, tireTube, widthScale, discSide, sprocket = false) {
  const R = tireR + tireTube;
  const w = tireTube * widthScale * 0.62;   // half section width
  const rimR = R - 0.105;                    // bead-seat radius (~105mm section height)
  const AX = { x: Math.PI / 2, y: 0, z: 0 }; // lathe axis y -> wheel axis z
  // Everything that spins hangs off one pivot sitting at the axle, with the meshes at the
  // local origin, so the render loop rolls the whole wheel with a single rotation.z.
  // The caliper is NOT a child — it stays bolted to the bike (fixedMesh below).
  const pivot = new THREE.Group();
  pivot.position.set(cx, R, 0);
  pivot.userData.radius = R; // rolling radius, used to turn the wheel by distance travelled
  wheelPivots.push(pivot);
  bike.add(pivot);

  // Tire body: bead, bulged sidewall, shoulder, crown (crown sits 6mm under the tread cap)
  const bead = rimR + 0.01, Rc = R - 0.006;
  addMesh('tires', latheGeo([
    [bead, -w * 0.72], [rimR + 0.03, -w * 0.9], [rimR + 0.07, -w], [Rc - 0.04, -w * 0.98], [Rc - 0.016, -w * 0.85],
    [Rc - 0.005, -w * 0.55], [Rc, -w * 0.25], [Rc, w * 0.25], [Rc - 0.005, w * 0.55], [Rc - 0.016, w * 0.85],
    [Rc - 0.04, w * 0.98], [rimR + 0.07, w], [rimR + 0.03, w * 0.9], [bead, w * 0.72],
    [rimR - 0.005, w * 0.65], [rimR - 0.005, -w * 0.65], [bead, -w * 0.72],
  ], 40), null, AX, pivot);
  // Tread cap: darker band over the crown — reads as tread without a texture
  fixedMesh(treadDark, latheGeo([
    [Rc - 0.014, -w * 0.8], [R - 0.001, -w * 0.5], [R, -w * 0.25], [R, w * 0.25], [R - 0.001, w * 0.5],
    [Rc - 0.014, w * 0.8], [Rc - 0.03, w * 0.75], [Rc - 0.012, w * 0.5], [Rc - 0.008, 0], [Rc - 0.012, -w * 0.5],
    [Rc - 0.03, -w * 0.75], [Rc - 0.014, -w * 0.8],
  ], 40), null, AX, pivot);

  // Rim: outer lips either side, drop-centre well in the middle
  const wr = w * 0.8;
  addMesh('rims', latheGeo([
    [rimR + 0.012, -wr], [rimR + 0.012, -wr + 0.008], [rimR - 0.002, -wr + 0.014], [rimR - 0.03, -wr * 0.45],
    [rimR - 0.03, wr * 0.45], [rimR - 0.002, wr - 0.014], [rimR + 0.012, wr - 0.008], [rimR + 0.012, wr],
    [rimR - 0.008, wr], [rimR - 0.04, wr * 0.45], [rimR - 0.04, -wr * 0.45], [rimR - 0.008, -wr], [rimR + 0.012, -wr],
  ], 40), null, AX, pivot);

  // Spokes + hub
  const spokeGeo = new THREE.ExtrudeGeometry(ySpokeShape(0.045, rimR - 0.03, Math.PI / 10), {
    depth: 0.026, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1,
  });
  spokeGeo.translate(0, 0, -0.013);
  for (let i = 0; i < 5; i++) addMesh('rims', spokeGeo, null, { x: 0, y: 0, z: (i / 5) * Math.PI * 2 }, pivot);
  addMesh('rims', new THREE.CylinderGeometry(0.05, 0.05, 0.16, 24), null, AX, pivot);
  addMesh('rims', new THREE.CylinderGeometry(0.085, 0.085, 0.025, 24), null, AX, pivot);
  fixedMesh(boltMat, new THREE.CylinderGeometry(0.012, 0.012, 0.34, 10), null, AX, pivot); // axle

  // Brake disc: steel ring + black carrier + 6 bolt heads (all spin with the wheel)
  const dz = 0.095 * discSide;
  addMesh('exhaust', latheGeo([[0.085, -0.0025], [0.14, -0.0025], [0.14, 0.0025], [0.085, 0.0025], [0.085, -0.0025]], 48),
    new THREE.Vector3(0, 0, dz), AX, pivot);
  fixedMesh(rubberDark, latheGeo([[0.06, -0.004], [0.09, -0.004], [0.09, 0.004], [0.06, 0.004], [0.06, -0.004]], 32),
    new THREE.Vector3(0, 0, dz - 0.006 * discSide), AX, pivot);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    fixedMesh(boltMat, new THREE.CylinderGeometry(0.006, 0.006, 0.006, 8),
      new THREE.Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, dz + 0.004 * discSide), AX, pivot);
  }

  if (sprocket) {
    // Carrier from the hub out to the chain line, then the toothed sprocket
    const cz = (CHAIN_Z - 0.08) / 2;
    addMesh('rims', new THREE.CylinderGeometry(0.045, 0.045, Math.abs(CHAIN_Z + 0.08), 20),
      new THREE.Vector3(0, 0, cz), AX, pivot);
    addMesh('engine', latheGeo([[0.062, -0.004], [0.088, -0.004], [0.088, 0.004], [0.062, 0.004], [0.062, -0.004]], 36),
      new THREE.Vector3(0, 0, CHAIN_Z), AX, pivot);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      addMesh('engine', new THREE.BoxGeometry(0.014, 0.012, 0.007),
        new THREE.Vector3(Math.cos(a) * 0.092, Math.sin(a) * 0.092, CHAIN_Z), { x: 0, y: 0, z: a }, pivot);
    }
  }

  // Caliper: bevelled block straddling the disc. Front: behind-below the axle (fork leg
  // clears it); rear: ahead-above, clear of the muffler and the swingarm.
  const cal = cx > 0 ? [-0.09, -0.07] : [0.08, 0.1];
  fixedMesh(rubberDark, roundedBox(0.06, 0.1, 0.04, 0.012, 0.004),
    new THREE.Vector3(cx + cal[0], R + cal[1], dz), { x: 0, y: 0, z: cx > 0 ? -0.5 : 0.6 });
  return R;
}

// Air-cooled pot: barrel with the fins cut into the lathe profile, head, bevelled valve
// cover, spark plug. Built in its own Group so the tilt is one rotation.
function engineCylinder(x, y, tilt) {
  const g = new THREE.Group();
  // (x, y) is the old barrel centre; the group origin is the barrel base
  g.position.set(x + Math.sin(tilt) * 0.11, y - Math.cos(tilt) * 0.11, 0);
  g.rotation.z = tilt;
  bike.add(g);

  const rc = 0.066, rf = 0.08;
  const prof = [[0, 0], [rc, 0]];
  for (let i = 0; i < 8; i++) {
    const y0 = 0.015 + i * 0.019;
    prof.push([rc, y0], [rf, y0 + 0.004], [rf, y0 + 0.011], [rc, y0 + 0.015]);
  }
  prof.push([rc, 0.17], [0.074, 0.175], [0.078, 0.215], [0.06, 0.222], [0, 0.222]);
  addMesh('engine', latheGeo(prof, 28), null, null, g);
  addMesh('engine', roundedBox(0.15, 0.045, 0.125, 0.014, 0.006), new THREE.Vector3(0, 0.245, 0), null, g);
  // Spark plug boss on the outside (exhaust side) of the head, chrome plug in it
  fixedMesh(rubberDark, new THREE.CylinderGeometry(0.013, 0.013, 0.03, 10),
    new THREE.Vector3(0, 0.2, 0.088), { x: Math.PI / 2, y: 0, z: 0 }, g);
  fixedMesh(boltMat, new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8),
    new THREE.Vector3(0, 0.2, 0.11), { x: Math.PI / 2, y: 0, z: 0 }, g);
}

// Lipped fender with real thickness: an arc ring extruded across the tire, bevelled edges.
// mount: { type: 'stays', part, to: [x, y, z] } runs a thin strut from each fender end to the
// anchor (rear fenders); { type: 'bracket', part, angle, z } bolts the fender straight to the
// fork lowers with a short tab either side (front fenders).
function fender(cx, wheelR, start, arc, width, mount) {
  const ro = wheelR + 0.045, ri = wheelR + 0.02;
  const s = new THREE.Shape();
  s.absarc(0, 0, ro, start, start + arc, false);
  s.absarc(0, 0, ri, start + arc, start, true);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 28,
  });
  geo.translate(0, 0, -width / 2);
  addMesh('fenders', geo, new THREE.Vector3(cx, wheelR, 0));
  if (!mount) return;
  if (mount.type === 'stays') {
    const rs = ri + 0.012;
    [start + 0.08, start + arc - 0.08].forEach((a) => {
      [-1, 1].forEach((side) => {
        const z = side * (width / 2 + 0.006);
        capsule(mount.part, [cx + Math.cos(a) * rs, wheelR + Math.sin(a) * rs, z],
          [mount.to[0], mount.to[1], side * mount.to[2]], 0.005);
      });
    });
  } else {
    const a = mount.angle, rb = ri + 0.008;
    const len = mount.z - width / 2 + 0.02;
    [-1, 1].forEach((side) => {
      addMesh(mount.part, new THREE.BoxGeometry(0.03, 0.016, len),
        new THREE.Vector3(cx + Math.cos(a) * rb, wheelR + Math.sin(a) * rb, side * (width / 2 + len / 2 - 0.01)),
        { x: 0, y: 0, z: a - Math.PI / 2 });
    });
  }
}

// Side-profile seat: dished rider area, step to the pillion, rounded tail — extruded
// across z with a bevel, and a darker piping tube along both top edges.
function seat(topPts, depth, base) {
  const s = new THREE.Shape();
  const first = topPts[0], last = topPts[topPts.length - 1];
  s.moveTo(first[0], first[1] - base);
  s.lineTo(first[0], first[1]);
  s.splineThru(topPts.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  s.lineTo(last[0], last[1] - base);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  addMesh('seat', geo);
  [-1, 1].forEach((side) => {
    fixedCurveTube(rubberDark, topPts.map(([x, y]) => [x, y - 0.004, side * (depth / 2 + 0.007)]), 0.004);
  });
}

// Coil spring: a helix swept with a thin tube around the shock axis.
function coilSpring(partName, from, to, radius, turns) {
  const a = new THREE.Vector3(...from);
  const axis = new THREE.Vector3(...to).sub(a);
  const len = axis.length();
  axis.normalize();
  const ref = Math.abs(axis.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const n = new THREE.Vector3().crossVectors(axis, ref).normalize();
  const m = new THREE.Vector3().crossVectors(axis, n);
  const N = turns * 10;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, ang = t * turns * Math.PI * 2;
    pts.push(a.clone().addScaledVector(axis, len * t)
      .addScaledVector(n, Math.cos(ang) * radius).addScaledVector(m, Math.sin(ang) * radius));
  }
  return addMesh(partName, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, 0.007, 8, false));
}

// Half-shell heat shield over a straight-ish header run, biased toward the outside of the bike.
function heatShield(from, to, radius) {
  const a = new THREE.Vector3(...from);
  const dir = new THREE.Vector3(...to).sub(a);
  const len = dir.length();
  const mesh = addMesh('exhaust', new THREE.CylinderGeometry(radius, radius, len, 14, 1, true, 0, Math.PI));
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.rotateY(-0.7); // the open half faces the pipe; the shell wraps top + outside
  return mesh;
}

// Muffler body along from -> to: fat lathe with a tapered end cap and a dark inner tip ring.
function muffler(from, to, r, profileFn) {
  const a = new THREE.Vector3(...from);
  const dir = new THREE.Vector3(...to).sub(a);
  const L = dir.length();
  dir.normalize();
  const body = addMesh('exhaust', latheGeo(profileFn(L, r), 28));
  alignY(body, from, to);
  const tip = fixedMesh(rubberDark, new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.02, 16));
  tip.position.copy(a).addScaledVector(dir, L - 0.008);
  tip.quaternion.copy(body.quaternion);
}
const canProfile = (L, r) => [[0, 0], [r * 0.6, 0], [r, 0.04], [r, L - 0.08], [r * 0.85, L - 0.03], [r * 0.45, L], [0, L]];
const megaphoneProfile = (L, r) => [[0, 0], [0.028, 0], [0.03, 0.05], [r, L - 0.05], [r, L - 0.02], [r * 0.7, L], [0, L]];

// Final drive: front + rear sprocket loop, ~85 links as one InstancedMesh oriented along the run.
function chain(front, rf, rear, rr) {
  const pts = [];
  const seg = (ax, ay, bx, by, n) => {
    for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(ax + (bx - ax) * i / n, ay + (by - ay) * i / n, CHAIN_Z));
  };
  const arcPts = (c, r, a0, a1, n) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      pts.push(new THREE.Vector3(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, CHAIN_Z));
    }
  };
  seg(front[0], front[1] + rf, rear[0], rear[1] + rr, 6);
  arcPts(rear, rr, Math.PI / 2, Math.PI * 1.5, 10);
  seg(rear[0], rear[1] - rr, front[0], front[1] - rf, 6);
  arcPts(front, rf, -Math.PI / 2, Math.PI / 2, 8);
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const n = Math.round(curve.getLength() / CHAIN_PITCH);
  const links = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.012, 0.008), chainMat, n);
  const dummy = new THREE.Object3D();
  const X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    dummy.position.copy(curve.getPointAt(u));
    dummy.quaternion.setFromUnitVectors(X, curve.getTangentAt(u));
    dummy.updateMatrix();
    links.setMatrixAt(i, dummy.matrix);
  }
  links.castShadow = true;
  bike.add(links);
  // Front sprocket at the gearbox output
  addMesh('engine', latheGeo([[0.02, -0.004], [rf, -0.004], [rf, 0.004], [0.02, 0.004], [0.02, -0.004]], 24),
    new THREE.Vector3(front[0], front[1], CHAIN_Z), { x: Math.PI / 2, y: 0, z: 0 });
}

function clearBike() {
  while (bike.children.length) {
    const m = bike.children.pop();
    // Wheel pivots / engine pots are Groups — walk them so the meshes inside get disposed too
    m.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose(); // frees the instance matrix texture
    });
  }
  wheelPivots.length = 0;
  for (const name of Object.keys(parts)) parts[name].meshes = [];
}

Object.keys(DEFAULTS).forEach(partMaterial);

function buildBike(type) {
  clearBike();

  // --- Per-type dimensions (metres; wheelbase ~1.6, seat 0.70 / 0.85 / 0.78) ---
  const cfg = {
    cruiser: {
      frontTire: [0.245, 0.095, 1.0], rearTire: [0.245, 0.095, 1.3],
      frontX: 0.82, rearX: -0.8, head: [0.46, 0.88, 0],
      // tank: centre, length, half-width radius, vertical squash (top ~0.93, bottom sits on the heads)
      tank: { pos: [0.06, 0.815], len: 0.66, r: 0.19, sy: 0.6, rot: -0.06 },
      barY: 1.0, seatY: 0.70, pegX: 0.02, pegY: 0.36,
    },
    adv: {
      frontTire: [0.27, 0.075, 0.95], rearTire: [0.24, 0.09, 1.2],
      frontX: 0.84, rearX: -0.78, head: [0.48, 0.98, 0],
      tank: { pos: [0.1, 0.9], len: 0.54, r: 0.2, sy: 0.75, rot: -0.1 },
      barY: 1.14, seatY: 0.85, pegX: -0.05, pegY: 0.36,
    },
    cafe: {
      frontTire: [0.245, 0.09, 0.95], rearTire: [0.245, 0.09, 1.15],
      frontX: 0.8, rearX: -0.78, head: [0.48, 0.87, 0],
      tank: { pos: [0.05, 0.815], len: 0.62, r: 0.165, sy: 0.62, rot: -0.02 },
      barY: 0.9, seatY: 0.78, pegX: -0.3, pegY: 0.42, // rear-sets sit above the chain's top run
    },
  }[type];

  const HEAD = cfg.head;
  const S = cfg.seatY;
  const frontR = buildWheel(cfg.frontX, cfg.frontTire[0], cfg.frontTire[1], cfg.frontTire[2], 1);
  const rearR = buildWheel(cfg.rearX, cfg.rearTire[0], cfg.rearTire[1], cfg.rearTire[2], 1, true);
  const FRONT = [cfg.frontX, frontR, 0];
  const REAR = [cfg.rearX, rearR, 0];
  const backboneEnd = [-0.3, S + 0.01, 0];
  const frontW = cfg.frontTire[1] * cfg.frontTire[2] * 1.24; // tire section widths
  const rearW = cfg.rearTire[1] * cfg.rearTire[2] * 1.24;

  // --- Frame ---
  capsule('frame', HEAD, backboneEnd, 0.034);
  capsule('frame', HEAD, [0.34, 0.42, 0.05], 0.022);
  capsule('frame', HEAD, [0.34, 0.42, -0.05], 0.022);
  capsule('frame', [0.34, 0.42, 0.05], [-0.18, 0.4, 0.05], 0.022);
  capsule('frame', [0.34, 0.42, -0.05], [-0.18, 0.4, -0.05], 0.022);
  capsule('frame', [backboneEnd[0], backboneEnd[1], 0.04], [-0.76, S - 0.09, 0.04], 0.02);
  capsule('frame', [backboneEnd[0], backboneEnd[1], -0.04], [-0.76, S - 0.09, -0.04], 0.02);
  capsule('frame', [-0.18, 0.4, 0.04], [-0.5, S - 0.05, 0.04], 0.018);
  capsule('frame', [-0.18, 0.4, -0.04], [-0.5, S - 0.05, -0.04], 0.018);

  // Swingarm (outboard of the tire) + twin shocks with exposed coil springs
  capsule('frame', [-0.16, 0.4, 0.11], [REAR[0], REAR[1], 0.11], 0.02);
  capsule('frame', [-0.16, 0.4, -0.11], [REAR[0], REAR[1], -0.11], 0.02);
  capsule('frame', [-0.45, 0.38, 0.11], [-0.45, 0.38, -0.11], 0.018);
  [-1, 1].forEach((s) => {
    const top = [-0.6, S - 0.07, 0.135 * s];
    const bot = [REAR[0] + 0.02, REAR[1] + 0.04, 0.135 * s];
    capsule('frame', [-0.6, S - 0.07, 0.04 * s], top, 0.012); // top mount off the rail
    capsule('fork', top, bot, 0.016);                          // damper rod
    const lo = [top[0] + (bot[0] - top[0]) * 0.6, top[1] + (bot[1] - top[1]) * 0.6, top[2]];
    capsule('frame', lo, bot, 0.024);                          // damper body
    coilSpring('exhaust', [top[0] + (bot[0] - top[0]) * 0.1, top[1] + (bot[1] - top[1]) * 0.1, top[2]],
      [top[0] + (bot[0] - top[0]) * 0.72, top[1] + (bot[1] - top[1]) * 0.72, top[2]], 0.032, 10);
  });

  // --- Engine ---
  // Crankcase: low rounded block so the pots stand proud of it
  addMesh('engine', roundedBox(0.42, 0.2, 0.28, 0.07, 0.01), new THREE.Vector3(0.06, 0.43, 0));
  // Polished alloy side covers: shallow domes, bolted on the right (engine finish, not chrome —
  // big chrome discs bloom to white under the studio rig)
  addMesh('engine', latheGeo([[0, 0], [0.085, 0], [0.085, 0.012], [0.072, 0.028], [0.045, 0.036], [0, 0.038]], 32),
    new THREE.Vector3(0.06, 0.42, 0.148), { x: Math.PI / 2, y: 0, z: 0 });
  addMesh('engine', latheGeo([[0, 0], [0.07, 0], [0.07, 0.012], [0.058, 0.026], [0.035, 0.032], [0, 0.034]], 32),
    new THREE.Vector3(0.06, 0.42, -0.148), { x: -Math.PI / 2, y: 0, z: 0 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    fixedMesh(boltMat, new THREE.CylinderGeometry(0.005, 0.005, 0.006, 8),
      new THREE.Vector3(0.06 + Math.cos(a) * 0.062, 0.42 + Math.sin(a) * 0.062, 0.18), { x: Math.PI / 2, y: 0, z: 0 });
  }
  if (type === 'adv') {
    // Parallel twin: two upright pots
    engineCylinder(0.16, 0.62, -0.12);
    engineCylinder(0.0, 0.62, -0.12);
    // Skid plate
    addMesh('engine', new THREE.BoxGeometry(0.46, 0.03, 0.26), new THREE.Vector3(0.06, 0.31, 0));
  } else {
    // V-twin, round alloy air cleaner between the pots on the right
    engineCylinder(0.18, 0.62, -0.45);
    engineCylinder(-0.07, 0.62, 0.3);
    addMesh('engine', latheGeo([[0, 0], [0.07, 0], [0.075, 0.03], [0.07, 0.05], [0.05, 0.058], [0, 0.06]], 28),
      new THREE.Vector3(0.05, 0.63, 0.17), { x: Math.PI / 2, y: 0, z: 0 });
  }
  // Oil cooler ahead of the downtubes: dark core with 12 slats
  fixedMesh(rubberDark, new THREE.BoxGeometry(0.03, 0.12, 0.2), new THREE.Vector3(0.41, 0.56, 0));
  for (let i = 0; i < 12; i++) {
    fixedMesh(chainMat, new THREE.BoxGeometry(0.022, 0.11, 0.0025), new THREE.Vector3(0.43, 0.56, -0.088 + i * 0.016));
  }

  // --- Tank: revolved teardrop, axis along the bike, squashed to a flat oval section ---
  const tk = cfg.tank;
  // Profile (tail -> nose): rounded tail, long full-width body, blunt nose — not an egg
  const tankProf = (() => {
    const h = tk.len / 2, r = tk.r;
    return [
      [0, -h], [r * 0.35, -h + 0.005], [r * 0.55, -h + 0.03], [r * 0.7, -h + 0.09], [r * 0.82, -h * 0.4],
      [r * 0.92, -h * 0.1], [r * 0.98, h * 0.2], [r, h * 0.45], [r * 0.98, h * 0.65], [r * 0.9, h * 0.82],
      [r * 0.7, h * 0.94], [r * 0.4, h * 0.99], [0, h],
    ];
  })();
  const tankGeo = latheGeo(tankProf, 40);
  tankGeo.rotateZ(-Math.PI / 2); // profile axis y -> +x (nose forward)
  tankGeo.scale(1, tk.sy, 1.05); // flat oval section: wider than tall
  addMesh('tank', tankGeo, new THREE.Vector3(tk.pos[0], tk.pos[1], 0), { x: 0, y: 0, z: tk.rot });
  [-1, 1].forEach((s) => {
    // Café: rubber knee pads low on the flanks where the rider's knees tuck in
    if (type === 'cafe') {
      const kneeZ = profileRadiusAt(tankProf, -0.1) * 1.05 - 0.004;
      fixedMesh(rubberDark, roundedBox(0.12, 0.045, 0.004, 0.012, 0.002),
        new THREE.Vector3(tk.pos[0] - 0.1, tk.pos[1] - 0.01, kneeZ * s), { x: 0, y: -0.2 * s, z: 0 });
    }
    // Badge plate on each flank
    fixedMesh(badgeMat, new THREE.BoxGeometry(0.09, 0.03, 0.006),
      new THREE.Vector3(tk.pos[0] + 0.05, tk.pos[1] + 0.01, (profileRadiusAt(tankProf, 0.05) * 1.05 - 0.001) * s));
  });
  // Chrome filler cap + ring on the top crown
  const capY = tk.pos[1] + profileRadiusAt(tankProf, 0.07) * tk.sy - 0.004;
  addMesh('exhaust', new THREE.CylinderGeometry(0.03, 0.032, 0.016, 20), new THREE.Vector3(tk.pos[0] + 0.07, capY, 0));
  addMesh('exhaust', new THREE.TorusGeometry(0.036, 0.004, 8, 28),
    new THREE.Vector3(tk.pos[0] + 0.07, capY - 0.004, 0), { x: Math.PI / 2, y: 0, z: 0 });

  // --- Seat (per type) ---
  if (type === 'cafe') {
    seat([[-0.24, S + 0.02], [-0.32, S + 0.02], [-0.42, S + 0.015], [-0.5, S + 0.03], [-0.57, S + 0.1],
      [-0.63, S + 0.12], [-0.7, S + 0.09], [-0.74, S + 0.03]], 0.2, 0.05);
  } else if (type === 'adv') {
    seat([[-0.15, S + 0.03], [-0.3, S + 0.02], [-0.45, S + 0.02], [-0.6, S + 0.05], [-0.72, S + 0.07],
      [-0.8, S + 0.05], [-0.84, S + 0.01]], 0.22, 0.05);
  } else {
    seat([[-0.19, S + 0.02], [-0.28, S + 0.04], [-0.38, S + 0.005], [-0.48, S + 0.02], [-0.55, S + 0.07],
      [-0.62, S + 0.11], [-0.7, S + 0.11], [-0.77, S + 0.08], [-0.8, S + 0.03]], 0.26, 0.06);
  }

  // --- Tail: licence plate + signals hung off the rear fender end, taillight per type ---
  const rfArc = { cruiser: [1.05, 1.75], adv: [Math.PI / 2 - 0.5, 1.2], cafe: [Math.PI / 2 - 0.55, 0.9] }[type];
  const endA = rfArc[0] + rfArc[1];
  const fEnd = [REAR[0] + Math.cos(endA) * (rearR + 0.075), REAR[1] + Math.sin(endA) * (rearR + 0.075)];
  const plateP = [fEnd[0] - 0.03, fEnd[1] - 0.06];
  const plateRot = { x: 0, y: 0, z: Math.max(endA, 2.75) }; // face the plate rearward, never skyward
  capsule('frame', [fEnd[0] + 0.02, fEnd[1] + 0.01, 0], [plateP[0], plateP[1] + 0.03, 0], 0.008);
  fixedMesh(plateBorder, new THREE.BoxGeometry(0.004, 0.1, 0.15), new THREE.Vector3(plateP[0], plateP[1], 0), plateRot);
  fixedMesh(plateMat, new THREE.BoxGeometry(0.008, 0.088, 0.138), new THREE.Vector3(plateP[0], plateP[1], 0), plateRot);
  [-1, 1].forEach((s) => {
    capsule('frame', [plateP[0] + 0.02, plateP[1] + 0.02, 0.04 * s], [plateP[0] + 0.01, plateP[1] + 0.02, 0.13 * s], 0.005);
    const lens = new THREE.SphereGeometry(0.02, 14, 10);
    lens.scale(0.7, 0.8, 1.2);
    fixedMesh(amberLens, lens, new THREE.Vector3(plateP[0] + 0.01, plateP[1] + 0.02, 0.15 * s));
  });
  if (type === 'cruiser') {
    // Cruiser: lamp sits on the fender crown near its tip
    const a = endA - 0.12, r = rearR + 0.062;
    fixedMesh(taillightLens, new THREE.BoxGeometry(0.02, 0.045, 0.1),
      new THREE.Vector3(REAR[0] + Math.cos(a) * r, REAR[1] + Math.sin(a) * r, 0), { x: 0, y: 0, z: a });
  } else {
    const tl = type === 'adv' ? [-0.87, S] : [-0.77, S + 0.05]; // off the seat tail / under the hump
    fixedMesh(taillightLens, new THREE.BoxGeometry(0.02, 0.045, 0.1), new THREE.Vector3(tl[0], tl[1], 0));
  }

  // --- Fork: chrome stanchions, black lowers with axle clamps + brace ---
  const FZ = 0.105;
  const legDir = new THREE.Vector3(HEAD[0] + 0.02 - FRONT[0], HEAD[1] + 0.04 - FRONT[1], 0).normalize();
  const lowerTop = [FRONT[0] + legDir.x * 0.39, FRONT[1] + legDir.y * 0.39];
  [-1, 1].forEach((s) => {
    capsule('fork', [HEAD[0] + 0.02, HEAD[1] + 0.04, FZ * s], [lowerTop[0], lowerTop[1], FZ * s], 0.019);
    capsule('frame', [lowerTop[0], lowerTop[1], FZ * s], [FRONT[0], FRONT[1], FZ * s], 0.03);
    addMesh('frame', new THREE.BoxGeometry(0.06, 0.05, 0.05), new THREE.Vector3(FRONT[0], FRONT[1], FZ * s)); // axle clamp
    addMesh('frame', new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16),
      new THREE.Vector3(lowerTop[0], lowerTop[1], FZ * s), { x: 0, y: 0, z: Math.atan2(legDir.y, legDir.x) - Math.PI / 2 }); // dust seal
  });
  const braceP = [FRONT[0] + legDir.x * 0.355, FRONT[1] + legDir.y * 0.355];
  addMesh('frame', new THREE.BoxGeometry(0.03, 0.012, FZ * 2), new THREE.Vector3(braceP[0], braceP[1], 0),
    { x: 0, y: 0, z: Math.atan2(legDir.y, legDir.x) - Math.PI / 2 });
  addMesh('frame', roundedBox(0.09, 0.03, 0.27, 0.01, 0.003),
    new THREE.Vector3(HEAD[0] + 0.01, HEAD[1] + 0.05, 0), { x: 0, y: 0, z: -0.35 });
  addMesh('frame', roundedBox(0.08, 0.03, 0.27, 0.01, 0.003),
    new THREE.Vector3(HEAD[0] + 0.06, HEAD[1] - 0.06, 0), { x: 0, y: 0, z: -0.35 });

  // --- Headlight + front signals ---
  const lightR = type === 'cafe' ? 0.095 : 0.085;
  addMesh('handlebar', new THREE.CylinderGeometry(lightR, lightR - 0.01, 0.1, 24),
    new THREE.Vector3(HEAD[0] + 0.1, HEAD[1] - 0.01, 0), { x: 0, y: 0, z: Math.PI / 2 });
  addMesh('exhaust', new THREE.TorusGeometry(lightR - 0.004, 0.006, 8, 32),
    new THREE.Vector3(HEAD[0] + 0.152, HEAD[1] - 0.01, 0), { x: 0, y: Math.PI / 2, z: 0 }); // chrome bezel
  fixedMesh(headlightLens, new THREE.CylinderGeometry(lightR - 0.013, lightR - 0.013, 0.012, 24),
    new THREE.Vector3(HEAD[0] + 0.155, HEAD[1] - 0.01, 0), { x: 0, y: 0, z: Math.PI / 2 });
  [-1, 1].forEach((s) => {
    capsule('frame', [HEAD[0] + 0.05, HEAD[1] - 0.09, 0.08 * s], [HEAD[0] + 0.08, HEAD[1] - 0.1, 0.19 * s], 0.005);
    const lens = new THREE.SphereGeometry(0.02, 14, 10);
    lens.scale(0.7, 0.8, 1.2);
    fixedMesh(amberLens, lens, new THREE.Vector3(HEAD[0] + 0.09, HEAD[1] - 0.1, 0.21 * s));
  });

  // --- Handlebar (per type) + cables + brake line ---
  let brakeEnd, cableFrom;
  if (type === 'cafe') {
    // Clip-ons: two stubby bars dropping off the fork tops, bar-end mirrors
    [-1, 1].forEach((s) => {
      capsule('handlebar', [HEAD[0] + 0.01, HEAD[1] + 0.06, 0.1 * s], [HEAD[0] + 0.1, HEAD[1] + 0.02, 0.24 * s], 0.014);
      fixedMesh(rubberDark, new THREE.CylinderGeometry(0.019, 0.019, 0.1, 14),
        new THREE.Vector3(HEAD[0] + 0.11, HEAD[1] + 0.015, 0.27 * s), { x: Math.PI / 2, y: 0.35 * s, z: 0 });
      capsule('handlebar', [HEAD[0] + 0.1, HEAD[1] + 0.03, 0.3 * s], [HEAD[0] + 0.08, HEAD[1] + 0.1, 0.34 * s], 0.005);
      const m = new THREE.SphereGeometry(0.035, 16, 12);
      m.scale(0.45, 1, 1.3);
      fixedMesh(rubberDark, m, new THREE.Vector3(HEAD[0] + 0.08, HEAD[1] + 0.11, 0.34 * s));
    });
    brakeEnd = [HEAD[0] + 0.08, HEAD[1], 0.2];
    cableFrom = [HEAD[0] + 0.07, HEAD[1] + 0.02, 0.2];
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
    brakeEnd = [bx - 0.02, by - 0.06, 0.22];
    cableFrom = [bx + 0.02, by - 0.05, 0.22];
  }
  // Front brake line: caliper -> up the right fork leg -> master cylinder at the bar
  fixedCurveTube(rubberDark, [
    [FRONT[0] - 0.09, FRONT[1] - 0.02, 0.1], [FRONT[0] - 0.1, FRONT[1] + 0.15, 0.145],
    [HEAD[0] + 0.03, HEAD[1] - 0.1, 0.145], brakeEnd,
  ], 0.004);
  // Rear brake line along the outside of the swingarm to the pedal
  fixedCurveTube(rubberDark, [
    [REAR[0] + 0.08, REAR[1] + 0.15, 0.1], [-0.45, 0.42, 0.135], [-0.1, 0.38, 0.135],
  ], 0.004);
  // Throttle + clutch cables: bar -> under the tank nose -> engine, one each side
  [-1, 1].forEach((s) => {
    fixedCurveTube(rubberDark, [
      [cableFrom[0], cableFrom[1], cableFrom[2] * s], [HEAD[0] - 0.05, HEAD[1] - 0.12, 0.13 * s],
      [0.3, 0.62, 0.14 * s], [0.12, 0.6, 0.13 * s],
    ], 0.004);
  });

  // --- Exhaust (per type) ---
  if (type === 'adv') {
    // Twin headers off the parallel twin into a collector, high-mount upswept can
    curveTube('exhaust', [[0.24, 0.7, 0.06], [0.36, 0.5, 0.12], [0.34, 0.3, 0.14], [0.15, 0.27, 0.15]], 0.022);
    curveTube('exhaust', [[0.08, 0.7, 0.08], [0.3, 0.52, 0.13], [0.3, 0.32, 0.145], [0.15, 0.27, 0.15]], 0.022);
    curveTube('exhaust', [[0.15, 0.27, 0.15], [-0.25, 0.28, 0.16], [-0.5, 0.4, 0.16]], 0.028);
    heatShield([0.1, 0.27, 0.152], [-0.22, 0.28, 0.16], 0.042);
    muffler([-0.5, 0.4, 0.165], [-0.82, 0.62, 0.17], 0.05, canProfile);
  } else if (type === 'cafe') {
    // Both headers sweep low into one reverse-cone megaphone
    curveTube('exhaust', [[0.27, 0.66, 0.08], [0.42, 0.45, 0.12], [0.38, 0.27, 0.14], [-0.15, 0.24, 0.15]], 0.028);
    curveTube('exhaust', [[-0.12, 0.66, 0.1], [-0.2, 0.5, 0.15], [-0.22, 0.32, 0.15], [-0.15, 0.24, 0.15]], 0.026);
    heatShield([0.3, 0.26, 0.145], [-0.1, 0.24, 0.15], 0.042);
    muffler([-0.15, 0.24, 0.15], [-0.72, 0.29, 0.16], 0.06, megaphoneProfile);
  } else {
    curveTube('exhaust', [[0.27, 0.66, 0.08], [0.4, 0.44, 0.13], [0.4, 0.28, 0.15], [0.1, 0.23, 0.16], [-0.35, 0.26, 0.17]], 0.03);
    curveTube('exhaust', [[-0.12, 0.66, 0.1], [-0.2, 0.52, 0.16], [-0.24, 0.36, 0.17], [-0.35, 0.28, 0.175]], 0.024);
    heatShield([0.1, 0.23, 0.16], [-0.3, 0.255, 0.168], 0.044);
    muffler([-0.35, 0.27, 0.18], [-0.95, 0.36, 0.18], 0.055, canProfile);
  }

  // --- Final drive (left side) ---
  chain([-0.17, 0.42], 0.045, [REAR[0], REAR[1]], 0.093);

  // --- Fenders (per type): start angle, sweep, width. Front bolts to the fork lowers with
  // short tabs; rear hangs off struts to the frame under the seat ---
  const frontMount = { type: 'bracket', part: 'frame', angle: Math.atan2(legDir.y, legDir.x), z: FZ };
  const rearMount = { type: 'stays', part: 'frame', to: [-0.62, S - 0.1, 0.05] };
  if (type === 'adv') {
    fender(FRONT[0], frontR, Math.PI / 2 - 0.4, 1.0, frontW + 0.02, frontMount); // close hugger
    // Beak under the headlight: a wedge, deep at the root and thin at the tip
    const beak = new THREE.Shape();
    beak.moveTo(0, 0);
    beak.lineTo(0.3, 0.05);
    beak.lineTo(0.3, 0.06);
    beak.lineTo(0.02, 0.095);
    beak.lineTo(0, 0.09);
    beak.closePath();
    const beakGeo = new THREE.ExtrudeGeometry(beak, {
      depth: 0.12, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2,
    });
    beakGeo.translate(0, 0, -0.06);
    addMesh('fenders', beakGeo, new THREE.Vector3(HEAD[0] + 0.03, HEAD[1] - 0.24, 0), { x: 0, y: 0, z: 0.3 });
    fender(REAR[0], rearR, Math.PI / 2 - 0.5, 1.2, rearW + 0.04, rearMount);
  } else if (type === 'cafe') {
    fender(FRONT[0], frontR, Math.PI / 2 - 0.5, 1.0, frontW + 0.02, frontMount);
    fender(REAR[0], rearR, Math.PI / 2 - 0.55, 0.9, rearW + 0.04, rearMount);
  } else {
    fender(FRONT[0], frontR, Math.PI / 2 - 0.7, 1.6, frontW + 0.02, frontMount);
    fender(REAR[0], rearR, 1.05, 1.75, rearW + 0.04, rearMount);
  }

  // --- Rider details: footpegs with knurl rings, folded side-stand ---
  [-1, 1].forEach((s) => {
    capsule('frame', [cfg.pegX, cfg.pegY, 0.15 * s], [cfg.pegX, cfg.pegY, 0.26 * s], 0.012);
    for (let i = 0; i < 3; i++) {
      fixedMesh(rubberDark, new THREE.TorusGeometry(0.014, 0.004, 8, 18),
        new THREE.Vector3(cfg.pegX, cfg.pegY, (0.19 + i * 0.025) * s));
    }
  });
  capsule('frame', [-0.22, 0.38, -0.13], [-0.56, 0.31, -0.14], 0.01);
  fixedMesh(rubberDark, new THREE.BoxGeometry(0.05, 0.02, 0.03), new THREE.Vector3(-0.57, 0.31, -0.14));

  // --- Accessories (bolt-ons) ---
  // Rack anchor per type: the café hump peaks at S+0.12 around x=-0.63, so its rack sits
  // further back and higher; the ADV seat tail is 1cm taller than the cruiser's.
  const [rackX, rackY] = { cruiser: [-0.8, S + 0.08], adv: [-0.8, S + 0.09], cafe: [-0.86, S + 0.14] }[type];
  const needRack = accessories.rack || accessories.topbox;
  if (needRack) {
    addMesh('luggage', new THREE.BoxGeometry(0.26, 0.02, 0.26), new THREE.Vector3(rackX, rackY, 0));
    capsule('luggage', [rackX + 0.1, rackY - 0.01, 0.1], [rackX + 0.18, rackY - 0.1, 0.08], 0.01);
    capsule('luggage', [rackX + 0.1, rackY - 0.01, -0.1], [rackX + 0.18, rackY - 0.1, -0.08], 0.01);
  }
  if (accessories.topbox) {
    addMesh('luggage', new THREE.BoxGeometry(0.32, 0.24, 0.34), new THREE.Vector3(rackX - 0.02, rackY + 0.13, 0));
    fixedMesh(rubberDark, new THREE.BoxGeometry(0.33, 0.03, 0.1), new THREE.Vector3(rackX - 0.02, rackY + 0.23, 0));
  }
  if (accessories.panniers) {
    [-1, 1].forEach((s) => {
      addMesh('luggage', new THREE.BoxGeometry(0.3, 0.32, 0.13), new THREE.Vector3(-0.62, S - 0.22, 0.25 * s));
    });
  }
  if (accessories.windscreen) {
    const screenGeo = new THREE.CylinderGeometry(0.24, 0.26, type === 'adv' ? 0.34 : 0.26, 24, 1, true, -0.6, 1.2);
    const screen = new THREE.Mesh(screenGeo, screenGlass);
    // CylinderGeometry's arc is centred on +z; yaw it to face forward (+x), then rake the
    // top back toward the rider about the world z axis — hence the ZYX order.
    screen.rotation.order = 'ZYX';
    screen.rotation.set(0, Math.PI / 2, 0.32);
    // Arc surface sits just ahead of the headlight (radius 0.24 back from the centre)
    screen.position.set(HEAD[0] - 0.1, HEAD[1] + (type === 'adv' ? 0.24 : 0.2), 0);
    bike.add(screen);
  }
  if (accessories.crashbars) {
    [-1, 1].forEach((s) => {
      addMesh('exhaust', new THREE.TorusGeometry(0.17, 0.014, 10, 24, Math.PI),
        new THREE.Vector3(0.2, 0.48, 0.17 * s), { x: 0, y: 0, z: Math.PI / 2 + 0.2 });
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
  // Longer messages stay up longer: ~3 words/s reading rate plus a second to notice it, never under 3.5s
  const ms = Math.max(3500, 1000 + msg.split(/\s+/).length * 350);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// Inline icons — one Lucide-style family (24 viewBox, stroke 2, currentColor), decorative only
const ICON_PATHS = {
  check: 'M20 6 9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `ico ico-${name}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.appendChild(path);
  return svg;
}

// The chip rows are rebuilt from scratch on every change, which would drop keyboard focus on
// the floor. Remember which child had it, and hand it back to the same slot afterwards.
function focusedChildIndex(container) {
  return [...container.children].indexOf(document.activeElement);
}
function restoreFocus(container, index) {
  if (index > -1 && container.children[index]) container.children[index].focus();
}

// Arrow keys move focus along a radio row (parts, bike type, finish) AND check the radio they
// land on, as native radio groups do; each row keeps a single tab stop (the checked radio).
function wireArrowKeys(container, selector) {
  container.addEventListener('keydown', (e) => {
    const from = e.target.closest(selector);
    if (!from) return;
    const items = [...container.querySelectorAll(selector)];
    let i = items.indexOf(from);
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': i = (i + 1) % items.length; break;
      case 'ArrowLeft': case 'ArrowUp': i = (i - 1 + items.length) % items.length; break;
      case 'Home': i = 0; break;
      case 'End': i = items.length - 1; break;
      default: return;
    }
    e.preventDefault();
    items[i].focus();
    items[i].click(); // the row's own click handler selects; a no-op on the already-checked radio
  });
}

function updateEmissives() {
  for (const name of Object.keys(parts)) {
    const mat = parts[name].material;
    mat.emissiveIntensity = name === selected ? 0.07 : name === hovered ? 0.04 : 0;
  }
}

function renderPartList() {
  const hadFocus = partList.contains(document.activeElement);
  partList.innerHTML = '';
  for (const name of Object.keys(PART_LABELS)) {
    const on = name === selected;
    const btn = document.createElement('button');
    btn.className = 'part-btn' + (on ? ' active' : '');
    // One tab stop for the group (the selected part); arrows move between the others
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', on);
    btn.tabIndex = on ? 0 : -1;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = parts[name].state.color;
    const label = document.createElement('span');
    label.className = 'p-name';
    label.textContent = PART_LABELS[name];
    label.title = PART_LABELS[name];
    btn.append(sw, label);
    if (on) {
      const check = icon('check');
      check.dataset.trailing = '';
      btn.appendChild(check);
    }
    btn.onclick = () => selectPart(name);
    partList.appendChild(btn);
  }
  if (hadFocus) partList.querySelector('.part-btn.active').focus();
}

// Black or white glyph so the check reads on every swatch, from jet black to oyster white
function glyphColorFor(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#000' : '#fff';
}

function renderPresets() {
  const focusIdx = focusedChildIndex(presetRow);
  presetRow.innerHTML = '';
  const current = parts[selected].state.color.toLowerCase();
  for (const hex of PRESETS) {
    const on = hex.toLowerCase() === current;
    const b = document.createElement('button');
    b.className = 'preset' + (on ? ' active' : '');
    b.style.background = hex;
    b.title = hex;
    b.setAttribute('aria-label', `Set ${PART_LABELS[selected]} to ${hex}`);
    // Single-select, not a toggle: aria-current marks the colour in use, never aria-pressed
    if (on) b.setAttribute('aria-current', 'true');
    if (on) {
      const check = icon('check');
      check.style.color = glyphColorFor(hex);
      b.appendChild(check);
    }
    b.onclick = () => setColor(hex);
    presetRow.appendChild(b);
  }
  restoreFocus(presetRow, focusIdx);
}

function renderFinish() {
  const current = parts[selected].state.finish;
  finishSeg.querySelectorAll('.seg-btn').forEach((b) => {
    const on = b.dataset.finish === current;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on);
    b.tabIndex = on ? 0 : -1; // roving tabindex: only the checked radio is in the tab order
  });
}

function syncUI() {
  // Live region: only write when the part actually changes, or every colour-picker input
  // event would re-announce the (unchanged) part name.
  if (selectedLabel.textContent !== PART_LABELS[selected]) selectedLabel.textContent = PART_LABELS[selected];
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
  material.sheen = f.sheen;                   // metal-flake sparkle, metallic only
  material.sheenRoughness = f.sheenRoughness;
  material.envMapIntensity = f.envMapIntensity; // keeps chrome under the bloom threshold
  material.needsUpdate = true;
}

function setColor(hex) {
  parts[selected].state.color = hex;
  applyState(selected);
  syncUI();
  writeHash();
}

colorPicker.addEventListener('input', () => setColor(colorPicker.value));

finishSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  parts[selected].state.finish = btn.dataset.finish;
  applyState(selected);
  renderFinish();
  writeHash();
});

document.getElementById('resetBtn').onclick = () => {
  for (const name of Object.keys(DEFAULTS)) {
    parts[name].state = { ...DEFAULTS[name] };
    applyState(name);
  }
  syncUI();
  writeHash();
  toast('All parts reset to defaults');
};

// --- Bike type switcher ---
const typeSeg = document.getElementById('typeSeg');
function renderTypeSeg() {
  typeSeg.querySelectorAll('.seg-btn').forEach((b) => {
    const on = b.dataset.type === currentType;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on);
    b.tabIndex = on ? 0 : -1; // roving tabindex: only the checked radio is in the tab order
  });
}
typeSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn || btn.dataset.type === currentType) return;
  currentType = btn.dataset.type;
  buildBike(currentType);
  renderTypeSeg();
  writeHash();
  toast(`${TYPES[currentType].label} loaded — colors carried over`);
});

// --- Accessory toggles ---
const accList = document.getElementById('accList');
function renderAccList() {
  const focusIdx = focusedChildIndex(accList);
  accList.innerHTML = '';
  for (const def of ACC_DEFS) {
    const on = accessories[def.key];
    const btn = document.createElement('button');
    btn.className = 'part-btn' + (on ? ' active' : '');
    btn.setAttribute('aria-pressed', on);
    const label = document.createElement('span');
    label.className = 'p-name';
    label.textContent = def.label;
    label.title = def.label;
    btn.append(icon(on ? 'check' : 'plus'), label);
    btn.onclick = () => {
      accessories[def.key] = !accessories[def.key];
      buildBike(currentType);
      renderAccList();
      writeHash();
    };
    accList.appendChild(btn);
  }
  restoreFocus(accList, focusIdx);
}
wireArrowKeys(partList, '.part-btn');
wireArrowKeys(typeSeg, '.seg-btn');
wireArrowKeys(finishSeg, '.seg-btn');

// Raycast: hover highlight + click select
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pickPart(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  // Recursive: wheel meshes live inside pivot Groups. Groups never register a hit
  // themselves, so hits[0].object is always the mesh carrying userData.part.
  const hits = raycaster.intersectObjects(bike.children, true);
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
  writeHash();
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
    sw.setAttribute('aria-label', `Apply ${hex} to the selected part`);
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
// Save & share — the whole build round-trips through location.hash
// ---------------------------------------------------------------------------
// #t=adv&a=windscreen,panniers&n=My+Build&p=tank:c0392b:gloss,frame:16181d:matte,...
const HEX6 = /^[0-9a-f]{6}$/i;
const buildNameInput = document.getElementById('buildName');
const shareBtn = document.getElementById('shareBtn');
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function buildHash() {
  const q = new URLSearchParams();
  q.set('t', currentType);
  q.set('a', ACC_DEFS.filter((d) => accessories[d.key]).map((d) => d.key).join(','));
  q.set('n', buildNameInput.value.trim());
  q.set('p', Object.keys(PART_LABELS)
    .map((name) => `${name}:${parts[name].state.color.slice(1).toLowerCase()}:${parts[name].state.finish}`)
    .join(','));
  // URLSearchParams escapes ',' and ':' — put them back so the link stays readable
  return q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
}

let hashTimer = null;
function flushHash() {
  clearTimeout(hashTimer);
  hashTimer = null;
  const next = `#${buildHash()}`;
  if (location.hash === next) return;
  try {
    history.replaceState(null, '', next);
  } catch {
    location.replace(next); // some browsers refuse replaceState on file://
  }
}

// Debounced so a color-picker drag doesn't hammer the URL bar (and never spams history)
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(flushHash, 150);
}

// Restore state from the hash. Runs before the first buildBike so the opening frame
// already shows the shared build. Anything malformed is dropped silently.
// Returns true if at least one value was applied.
function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return false;
  const q = new URLSearchParams(raw);
  let applied = false;

  const t = q.get('t');
  if (t && hasOwn(TYPES, t)) { currentType = t; applied = true; }

  if (q.has('a')) {
    const on = new Set(q.get('a').split(','));
    for (const def of ACC_DEFS) accessories[def.key] = on.has(def.key);
    applied = true;
  }

  if (q.has('n')) { buildNameInput.value = q.get('n').slice(0, 80); applied = true; }

  for (const entry of (q.get('p') || '').split(',')) {
    const [name, hex, finish] = entry.split(':');
    if (!hasOwn(PART_LABELS, name) || !parts[name]) continue;
    if (hex && HEX6.test(hex)) { parts[name].state.color = `#${hex.toLowerCase()}`; applied = true; }
    if (finish && hasOwn(FINISHES, finish)) { parts[name].state.finish = finish; applied = true; }
  }
  return applied;
}

async function copyShareLink() {
  flushHash(); // make sure the URL carries the very latest change before we copy it
  const url = location.href;
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch {
    // No async clipboard (insecure origin / older browser): select a temp input and copy
    const tmp = document.createElement('input');
    tmp.value = url;
    tmp.readOnly = true;
    tmp.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(tmp);
    tmp.select();
    try { copied = document.execCommand('copy'); } catch { /* clipboard unavailable */ }
    tmp.remove();
  }
  // Never fail silently: the URL bar already holds the link, so point there
  toast(copied
    ? 'Link copied — anyone can open this exact build'
    : 'Could not copy — the link is in your address bar, copy it from there');
}
shareBtn.onclick = copyShareLink;
buildNameInput.addEventListener('input', writeHash);

// ---------------------------------------------------------------------------
// PDF spec sheet export
// ---------------------------------------------------------------------------
const VIEWS = [
  { name: 'Side',  pos: [0, 0.7, 3.2] },
  { name: 'Front', pos: [3.2, 0.7, 0] },
  { name: 'Top',   pos: [0.01, 3.4, 0.01] },
  { name: '3/4',   pos: [2.2, 1.5, 2.2] },
];

// One print renderer for the life of the page, created on the first export and reused.
// A fresh WebGLRenderer per export leaked its context — dispose() frees GPU resources but
// the off-DOM canvas keeps the context alive until GC, and Chrome caps a page at 16 live
// contexts, evicting the oldest: the main viewport's, which then rendered black for good.
// Reuse also means the bike's materials compile for the print context only once.
const PRINT_W = 640, PRINT_H = 480;
let printRenderer = null;
let printCam = null;
function getPrintRenderer() {
  if (!printRenderer) {
    printRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    printRenderer.setSize(PRINT_W, PRINT_H);
    printRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    printCam = new THREE.PerspectiveCamera(40, PRINT_W / PRINT_H, 0.1, 100);
  }
  return printRenderer;
}

function captureViews() {
  const pr = getPrintRenderer();
  const oldBg = scene.background;
  scene.background = new THREE.Color(0xffffff);
  stage.visible = false;

  // Print renders must not carry the selection/hover glow
  const savedEmissives = {};
  for (const name of Object.keys(parts)) {
    savedEmissives[name] = parts[name].material.emissiveIntensity;
    parts[name].material.emissiveIntensity = 0;
  }

  // Freeze the idle animation so the same build always exports the same pixels:
  // bike parked at the origin (no bob, no mid-intro offset), wheels at rest, headlight
  // at its display-range print colour (the HDR live value would clamp to paper white here).
  const savedBikePos = bike.position.clone();
  const savedWheelRot = wheelPivots.map((p) => p.rotation.z);
  const savedHeadlight = headlightLens.color.clone();
  bike.position.set(0, 0, 0);
  for (const p of wheelPivots) p.rotation.z = 0;
  headlightLens.color.copy(HEADLIGHT_PRINT);

  // Always put the live scene back, even if a render throws (lost WebGL context) — otherwise
  // the viewport is left white with the stage hidden and the bike parked.
  const shots = [];
  try {
    for (const v of VIEWS) {
      printCam.position.set(...v.pos);
      printCam.lookAt(0, 0.55, 0);
      pr.render(scene, printCam);
      shots.push({ name: v.name, dataUrl: pr.domElement.toDataURL('image/png') });
    }
  } finally {
    scene.background = oldBg;
    stage.visible = true;
    for (const name of Object.keys(parts)) {
      parts[name].material.emissiveIntensity = savedEmissives[name];
    }
    bike.position.copy(savedBikePos);
    wheelPivots.forEach((p, i) => { p.rotation.z = savedWheelRot[i]; });
    headlightLens.color.copy(savedHeadlight);
  }
  return shots;
}

const exportBtn = document.getElementById('exportBtn');
const exportLabel = exportBtn.querySelector('.btn-label');
const EXPORT_LABEL = exportLabel.textContent;
// Busy is signalled with aria-busy/aria-disabled, never `disabled`: a disabled button drops
// keyboard focus to <body> (the next Tab restarts from the top) and the UA dims the
// 'Generating…' label below readable contrast. Re-entry is guarded by this flag instead.
let exporting = false;
exportBtn.onclick = () => {
  if (exporting) return;
  exporting = true;
  exportBtn.setAttribute('aria-busy', 'true');
  exportBtn.setAttribute('aria-disabled', 'true');
  exportLabel.textContent = 'Generating…';
  // Let the busy state paint before the (brief, synchronous) capture work. One rAF fires
  // *before* the next paint, so it takes two: the first frame paints, the second does the work.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      buildPdf();
      toast('Spec sheet downloaded');
    } catch (err) {
      toast('Export failed — please try again');
      throw err; // keep the stack in the console
    } finally {
      exporting = false;
      exportBtn.removeAttribute('aria-busy');
      exportBtn.removeAttribute('aria-disabled');
      exportLabel.textContent = EXPORT_LABEL;
    }
  }));
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

  // Reference photo, if provided — on its own page. Page 1 is full by here (the table ends
  // ~y = 273), so the photo would otherwise print over the footer and run off the sheet.
  if (photoDataUrl) {
    doc.addPage();
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Customer reference photo', margin, 20);
    // Fit the photo inside the text column above the footer, keeping its aspect ratio.
    // The preview <img> carries the same data URL, so it knows the natural size.
    const maxW = pageW - margin * 2;
    const maxH = 240;
    const nw = photoPreview.naturalWidth, nh = photoPreview.naturalHeight;
    const aspect = nw && nh ? nw / nh : 4 / 3;
    let pw = maxW, ph = pw / aspect;
    if (ph > maxH) { ph = maxH; pw = ph * aspect; }
    try {
      doc.addImage(photoDataUrl, 'JPEG', margin, 23, pw, ph);
    } catch {
      try { doc.addImage(photoDataUrl, 'PNG', margin, 23, pw, ph); } catch { /* unsupported format */ }
    }
  }

  // Footer — on the last page only. The full share link is wrapped to the text column
  // (never truncated: a cut link is a dead link) and bottom-aligned so its last line sits at
  // y = 285.5, just above the standing note at y = 290. The whole block is a clickable annotation.
  flushHash();
  const link = location.href;
  const linkFont = 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(linkFont);
  doc.setTextColor(130);
  const linkLines = doc.splitTextToSize(`Build link: ${link}`, pageW - margin * 2);
  const lineH = (linkFont * doc.getLineHeightFactor()) / doc.internal.scaleFactor; // pt -> mm, incl. leading
  const linkTop = 285.5 - (linkLines.length - 1) * lineH; // baseline of the first line
  doc.text(linkLines, margin, linkTop);
  doc.link(margin, linkTop - linkFont / doc.internal.scaleFactor, pageW - margin * 2, linkLines.length * lineH, { url: link });
  doc.setFontSize(8);
  doc.text('Generated by ShraSquad Bike Customizer — hex values are authoritative; RAL codes are nearest matches for shop convenience.', margin, 290);

  doc.save(`${buildName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-spec.pdf`);
}

// ---------------------------------------------------------------------------
// Camera presets — framed shots with a smooth orbit tween
// ---------------------------------------------------------------------------
// Every position sits <= controls.maxDistance from its target and well above the
// floor. The tween interpolates the orbit (radius / azimuth / polar) around the target
// rather than the raw position, so the camera never cuts through the bike and the
// radius stays between the two endpoints (never past the zoom limit).
const CAM_VIEWS = {
  side:    { pos: [0, 0.75, 3.6],    target: [0, 0.6, 0] },
  front:   { pos: [3.4, 0.8, 0.3],   target: [0, 0.6, 0] },
  quarter: { pos: [2.1, 1.5, 3.1],   target: [0, 0.55, 0] },    // the opening shot
  rear:    { pos: [-3.2, 1.0, -1.6], target: [0, 0.6, 0] },
  tank:    { pos: [0.9, 1.35, 1.2],  target: [0.06, 0.85, 0] }, // close-up on the tank
};
const CAM_MIN_Y = 0.25; // never dip toward the floor slab

const camPresets = document.getElementById('camPresets');
const camBtns = [...camPresets.querySelectorAll('.cam-btn')]; // DOM order == keys 1–5
const camSph = new THREE.Spherical();
let activeCam = null;
let camTween = null;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Pull a destination back inside the orbit limits (radius + floor) around its target.
function clampCamPos(pos, target) {
  const offset = pos.clone().sub(target);
  offset.setLength(THREE.MathUtils.clamp(offset.length(), controls.minDistance, controls.maxDistance));
  pos.copy(target).add(offset);
  pos.y = Math.max(pos.y, CAM_MIN_Y);
  return pos;
}

function tweenCamera(toPos, toTarget, ms = 900) {
  // Flush any damping glide left over from a drag so it can't fight the tween — with
  // damping off, update() applies the residual once and zeroes it. Then freeze user
  // input (and the turntable) until we land.
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = true;
  controls.enabled = false;
  keepAwake();

  const fromTarget = controls.target.clone();
  const endTarget = toTarget.clone();
  const endPos = clampCamPos(toPos.clone(), endTarget);
  const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(fromTarget));
  const to = new THREE.Spherical().setFromVector3(endPos.sub(endTarget));
  // Take the short way round the bike
  let dTheta = to.theta - from.theta;
  if (dTheta > Math.PI) dTheta -= Math.PI * 2;
  if (dTheta < -Math.PI) dTheta += Math.PI * 2;
  to.theta = from.theta + dTheta;

  camTween = { fromTarget, toTarget: endTarget, from, to, start: performance.now(), ms };
}

// Per-frame, from the render loop (runs before controls.update()).
function updateCameraTween() {
  // The idle turntable has drifted the camera off the preset — drop the highlight
  if (activeCam && controls.autoRotate) setActiveCam(null);
  if (!camTween) return;

  const k = Math.min(1, (performance.now() - camTween.start) / camTween.ms);
  const e = easeInOutCubic(k);
  const { fromTarget, toTarget, from, to } = camTween;
  controls.target.lerpVectors(fromTarget, toTarget, e);
  camSph.set(
    THREE.MathUtils.lerp(from.radius, to.radius, e),
    THREE.MathUtils.lerp(from.phi, to.phi, e),
    THREE.MathUtils.lerp(from.theta, to.theta, e)
  );
  camera.position.setFromSpherical(camSph).add(controls.target);
  camera.lookAt(controls.target);

  if (k >= 1) {
    camTween = null;
    controls.enabled = true;
    keepAwake(); // idle countdown restarts from the landing, not from the click
  }
}

function setActiveCam(view) {
  activeCam = view;
  for (const b of camBtns) {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on);
    // Mutually exclusive views, not toggles: aria-current marks the one on screen (none after
    // a manual orbit). The auto-rotate .cam-toggle is the pill's only genuine aria-pressed button.
    if (on) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  }
}

function goToView(view) {
  const v = CAM_VIEWS[view];
  if (!v) return;
  const toPos = new THREE.Vector3(...v.pos);
  const toTarget = new THREE.Vector3(...v.target);
  if (REDUCED_MOTION) {
    // No tween for users who asked for less motion: cut straight to the framed shot.
    // (Never pass ms = 0 to tweenCamera — the progress divide would go NaN.)
    controls.enableDamping = false; // flush any drag glide so it can't drift us off the preset
    controls.update();
    controls.enableDamping = true;
    controls.target.copy(toTarget);
    camera.position.copy(clampCamPos(toPos, toTarget));
    camera.lookAt(controls.target);
    keepAwake();
    setActiveCam(view);
    return;
  }
  tweenCamera(toPos, toTarget);
  setActiveCam(view);
}

camPresets.addEventListener('click', (e) => {
  const btn = e.target.closest('.cam-btn');
  if (btn) goToView(btn.dataset.view);
});

// Any manual orbit / zoom / pan means we're no longer on the preset
controls.addEventListener('start', () => setActiveCam(null));

// Auto-rotate toggle (the .cam-toggle after the five views — never one of camBtns)
const autoRotateBtn = document.getElementById('autoRotateBtn');
function setAutoRotate(on) {
  autoRotateEnabled = on;
  autoRotateBtn.setAttribute('aria-pressed', on);
  autoRotateBtn.title = `Auto-rotate ${on ? 'on' : 'off'}`;
  keepAwake(); // off: parks the turntable now; on: the idle countdown starts from here
}
autoRotateBtn.addEventListener('click', () => setAutoRotate(!autoRotateEnabled));
setAutoRotate(autoRotateEnabled); // sync the button with the reduced-motion default

// Keys 1–5 jump between views unless the user is typing
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  const idx = e.key.length === 1 ? '12345'.indexOf(e.key) : -1;
  if (idx === -1 || !camBtns[idx]) return;
  e.preventDefault();
  goToView(camBtns[idx].dataset.view);
});

// ---------------------------------------------------------------------------
// Idle animation — wheel spin, suspension bob, headlight pulse, intro roll-in
// ---------------------------------------------------------------------------
// All driven from the render loop off one THREE.Clock, with no per-frame allocations.
// prefers-reduced-motion (REDUCED_MOTION, declared at the top of the file) gets a parked
// bike: no bob, no pulse, no intro, wheels still.
// (The OrbitControls turntable is pre-existing behaviour and is left as is.)
const clock = new THREE.Clock();
const WHEEL_IDLE_SPIN = REDUCED_MOTION ? 0 : (Math.PI * 2) / 6; // rad/s — one lazy dyno rev every 6s
const BOB_AMP = 0.006;                  // scene units — a barely-there suspension settle
const BOB_RATE = 1.6;                   // rad/s
const PULSE_RATE = Math.PI * 2 * 0.7;   // rad/s — the headlight breathes at 0.7 Hz
const INTRO_FROM_X = -1.6;              // the bike rolls in from stage left…
const INTRO_DUR = 1.4;                  // …over this many seconds, ease-out cubic
let introStart = null;                  // clock time the intro began; null once it has landed

function updateIdleAnimation(dt, t) {
  // Intro roll-in: x is eased straight to 0; the wheels then turn by the distance covered,
  // so they spin hard at the start and settle into the idle rate as the bike stops.
  let dx = 0;
  if (introStart !== null) {
    const k = Math.min(1, (t - introStart) / INTRO_DUR);
    const x = INTRO_FROM_X * Math.pow(1 - k, 3); // ease-out cubic toward 0
    dx = x - bike.position.x;
    bike.position.x = x;
    if (k >= 1) introStart = null;
  }

  // rotation.z decreasing == rolling toward +x, the way the bike faces
  for (let i = 0; i < wheelPivots.length; i++) {
    const pivot = wheelPivots[i];
    pivot.rotation.z -= WHEEL_IDLE_SPIN * dt + dx / pivot.userData.radius;
    if (pivot.rotation.z < -Math.PI * 2) pivot.rotation.z += Math.PI * 2; // keep the angle bounded
  }

  if (REDUCED_MOTION) return;
  bike.position.y = BOB_AMP * Math.sin(t * BOB_RATE);
  headlightLens.color.lerpColors(HEADLIGHT_DIM, HEADLIGHT_BASE, 0.5 + 0.5 * Math.sin(t * PULSE_RATE));
}

// ---------------------------------------------------------------------------
// Post-processing — bloom so the neon and the specular hits glow
// ---------------------------------------------------------------------------
// RenderPass draws linear HDR into the composer's half-float target, bloom lifts anything
// over the threshold, OutputPass applies the renderer's tone mapping + sRGB at the end.
// The PDF path (captureViews) keeps its own plain renderer so spec renders stay clean.
// The threshold sits above the paint's specular range: the neon core (#fff1ea x 1.35 ~ 1.23
// luma) and the headlight (x 1.6, ~1.24 at its dimmest) clear it; a body panel or a chrome
// pipe catching the key light does not — see envMapIntensity in FINISHES for the other half.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight)),
  0.35, // strength
  0.4,  // radius
  1.15  // threshold — only the neon core, the headlight and true point-like specular hits
);
// Cap what one pixel can feed the bloom. The key SpotLight mirrored in a chrome pipe is a
// near-delta of radiance in the hundreds; blurred, that is a white halo the width of the
// exhaust however high the threshold goes. Capped at 2.0 the neon core and headlight
// (1.2-1.5) pass untouched while a specular hit adds a soft sparkle instead of a bar.
// Patches the pinned r160 LuminosityHighPass source; a no-op if that line ever changes.
const highPass = bloomPass.materialHighPassFilter;
highPass.fragmentShader = highPass.fragmentShader.replace(
  'gl_FragColor = mix( outputColor, texel, alpha );',
  'gl_FragColor = mix( outputColor, min( texel, vec4( 2.0 ) ), alpha );'
);
highPass.needsUpdate = true;
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Resize + render loop
// ---------------------------------------------------------------------------
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  // Clamp dt so a tab that was backgrounded doesn't whip the wheels round on return
  const dt = Math.min(clock.getDelta(), 0.1);
  updateIdleAnimation(dt, clock.elapsedTime);
  updateCameraTween();
  controls.update();
  composer.render();
});

// Init
const restoredFromHash = readHash(); // before buildBike so the first frame is the shared build
buildBike(currentType);
renderTypeSeg();
renderAccList();
selectPart('tank');
setActiveCam('quarter'); // the opening camera is the ¾ preset
if (!REDUCED_MOTION) {
  // Kick off the roll-in; getElapsedTime() also starts the clock so the first frame's dt is tiny
  introStart = clock.getElapsedTime();
  bike.position.x = INTRO_FROM_X;
}
if (restoredFromHash) toast('Shared build loaded from link');
