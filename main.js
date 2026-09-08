import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const viewport = document.getElementById('viewport');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(2.4, 1.4, 2.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.52;
controls.minDistance = 1.2;
controls.maxDistance = 8;

const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
dirLight.position.set(3, 5, 2);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -3;
dirLight.shadow.camera.right = 3;
dirLight.shadow.camera.top = 3;
dirLight.shadow.camera.bottom = -3;
scene.add(dirLight);
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30281e, 0.6));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(12, 24, 0x2c313a, 0x22262d);
grid.position.y = 0.001;
scene.add(grid);

// ---------------------------------------------------------------------------
// Materials & part registry
// ---------------------------------------------------------------------------
const FINISHES = {
  gloss:    { roughness: 0.15, metalness: 0.1, clearcoat: 1.0 },
  matte:    { roughness: 0.85, metalness: 0.05, clearcoat: 0.0 },
  metallic: { roughness: 0.35, metalness: 0.85, clearcoat: 0.6 },
  chrome:   { roughness: 0.05, metalness: 1.0, clearcoat: 1.0 },
};

const DEFAULTS = {
  frame:      { color: '#c0392b', finish: 'gloss' },
  fork:       { color: '#2c3e50', finish: 'gloss' },
  handlebar:  { color: '#8a9099', finish: 'metallic' },
  saddle:     { color: '#3d2b1f', finish: 'matte' },
  rims:       { color: '#c9ced6', finish: 'chrome' },
  tires:      { color: '#1a1a1a', finish: 'matte' },
  drivetrain: { color: '#9aa0a8', finish: 'metallic' },
};

const parts = {}; // name -> { material, meshes: [], state: {color, finish} }

function partMaterial(name) {
  if (!parts[name]) {
    const state = { ...DEFAULTS[name] };
    const mat = new THREE.MeshPhysicalMaterial({ color: state.color, ...FINISHES[state.finish] });
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

// ---------------------------------------------------------------------------
// Procedural bicycle
// ---------------------------------------------------------------------------
const bike = new THREE.Group();
scene.add(bike);

const WHEEL_R = 0.36;
const REAR = [-0.72, WHEEL_R, 0];
const FRONT = [0.72, WHEEL_R, 0];
const BB = [0, 0.32, 0];               // bottom bracket
const SEAT_TOP = [-0.24, 0.88, 0];     // seat tube top
const HEAD_TOP = [0.42, 0.94, 0];      // head tube top
const HEAD_BOT = [0.52, 0.72, 0];      // head tube bottom

function buildWheel(cx) {
  // Tire
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.045, 20, 48), partMaterial('tires'));
  tire.position.set(cx, WHEEL_R, 0);
  tire.castShadow = true;
  tire.userData.part = 'tires';
  parts.tires.meshes.push(tire);
  bike.add(tire);

  // Rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.05, 0.015, 12, 48), partMaterial('rims'));
  rim.position.set(cx, WHEEL_R, 0);
  rim.castShadow = true;
  rim.userData.part = 'rims';
  parts.rims.meshes.push(rim);
  bike.add(rim);

  // Hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 16), partMaterial('rims'));
  hub.position.set(cx, WHEEL_R, 0);
  hub.rotation.x = Math.PI / 2;
  hub.castShadow = true;
  hub.userData.part = 'rims';
  parts.rims.meshes.push(hub);
  bike.add(hub);

  // Spokes
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, (WHEEL_R - 0.05) * 2, 6),
      partMaterial('rims')
    );
    spoke.position.set(cx, WHEEL_R, 0);
    spoke.rotation.z = angle;
    spoke.userData.part = 'rims';
    parts.rims.meshes.push(spoke);
    bike.add(spoke);
  }
}

// Ensure part entries exist before wheel spokes reference them.
Object.keys(DEFAULTS).forEach(partMaterial);

buildWheel(REAR[0]);
buildWheel(FRONT[0]);

// Frame — classic diamond
tube('frame', BB, SEAT_TOP, 0.028);                       // seat tube
tube('frame', BB, HEAD_BOT, 0.030);                       // down tube
tube('frame', SEAT_TOP, HEAD_TOP, 0.026);                 // top tube
tube('frame', BB, [REAR[0], REAR[1], 0.05], 0.016);       // chainstay R
tube('frame', BB, [REAR[0], REAR[1], -0.05], 0.016);      // chainstay L
tube('frame', SEAT_TOP, [REAR[0], REAR[1], 0.05], 0.014); // seatstay R
tube('frame', SEAT_TOP, [REAR[0], REAR[1], -0.05], 0.014);// seatstay L

// Fork + head tube
tube('fork', HEAD_TOP, HEAD_BOT, 0.034);                  // head tube
tube('fork', HEAD_BOT, [FRONT[0] - 0.02, FRONT[1], 0.05], 0.016);
tube('fork', HEAD_BOT, [FRONT[0] - 0.02, FRONT[1], -0.05], 0.016);

// Handlebar
const STEM_TOP = [0.40, 1.04, 0];
tube('handlebar', HEAD_TOP, STEM_TOP, 0.02);              // stem riser
tube('handlebar', STEM_TOP, [STEM_TOP[0], STEM_TOP[1], 0.26], 0.016);
tube('handlebar', STEM_TOP, [STEM_TOP[0], STEM_TOP[1], -0.26], 0.016);
addMesh('handlebar', new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12),
  new THREE.Vector3(STEM_TOP[0], STEM_TOP[1], 0.3), { x: Math.PI / 2, y: 0, z: 0 });
addMesh('handlebar', new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12),
  new THREE.Vector3(STEM_TOP[0], STEM_TOP[1], -0.3), { x: Math.PI / 2, y: 0, z: 0 });

// Saddle + seatpost
tube('saddle', SEAT_TOP, [-0.28, 1.0, 0], 0.018);         // seatpost
const saddleGeo = new THREE.SphereGeometry(0.09, 24, 16);
saddleGeo.scale(1.9, 0.42, 0.75);
addMesh('saddle', saddleGeo, new THREE.Vector3(-0.30, 1.02, 0));

// Drivetrain — crank, pedals, chainring
addMesh('drivetrain', new THREE.CylinderGeometry(0.035, 0.035, 0.14, 16),
  new THREE.Vector3(...BB), { x: Math.PI / 2, y: 0, z: 0 });
addMesh('drivetrain', new THREE.TorusGeometry(0.11, 0.012, 10, 40),
  new THREE.Vector3(BB[0], BB[1], 0.085));
const crankR = addMesh('drivetrain', new THREE.BoxGeometry(0.03, 0.17, 0.02),
  new THREE.Vector3(BB[0] + 0.05, BB[1] - 0.06, 0.10), { x: 0, y: 0, z: 0.5 });
const crankL = addMesh('drivetrain', new THREE.BoxGeometry(0.03, 0.17, 0.02),
  new THREE.Vector3(BB[0] - 0.05, BB[1] + 0.06, -0.10), { x: 0, y: 0, z: 0.5 });
addMesh('drivetrain', new THREE.BoxGeometry(0.09, 0.015, 0.06),
  new THREE.Vector3(BB[0] + 0.1, BB[1] - 0.12, 0.14));
addMesh('drivetrain', new THREE.BoxGeometry(0.09, 0.015, 0.06),
  new THREE.Vector3(BB[0] - 0.1, BB[1] + 0.12, -0.14));

// ---------------------------------------------------------------------------
// Selection & customization
// ---------------------------------------------------------------------------
const PART_LABELS = {
  frame: 'Frame', fork: 'Fork', handlebar: 'Handlebar', saddle: 'Saddle',
  rims: 'Rims & Spokes', tires: 'Tires', drivetrain: 'Drivetrain',
};

let selected = 'frame';

const partList = document.getElementById('partList');
const selectedLabel = document.getElementById('selectedPart');
const colorPicker = document.getElementById('colorPicker');
const finishSelect = document.getElementById('finishSelect');

function renderPartList() {
  partList.innerHTML = '';
  for (const name of Object.keys(PART_LABELS)) {
    const btn = document.createElement('button');
    btn.className = 'part-btn' + (name === selected ? ' active' : '');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = parts[name].state.color;
    btn.appendChild(sw);
    btn.appendChild(document.createTextNode(PART_LABELS[name]));
    btn.onclick = () => selectPart(name);
    partList.appendChild(btn);
  }
}

function selectPart(name) {
  selected = name;
  selectedLabel.textContent = PART_LABELS[name];
  colorPicker.value = parts[name].state.color;
  finishSelect.value = parts[name].state.finish;
  flash(name);
  renderPartList();
}

function flash(name) {
  const mat = parts[name].material;
  mat.emissive = new THREE.Color(0xff6b35);
  mat.emissiveIntensity = 0.55;
  setTimeout(() => { mat.emissiveIntensity = 0; }, 450);
}

function applyState(name) {
  const { material, state } = parts[name];
  material.color.set(state.color);
  const f = FINISHES[state.finish];
  material.roughness = f.roughness;
  material.metalness = f.metalness;
  material.clearcoat = f.clearcoat;
  material.needsUpdate = true;
}

colorPicker.addEventListener('input', () => {
  parts[selected].state.color = colorPicker.value;
  applyState(selected);
  renderPartList();
});

finishSelect.addEventListener('change', () => {
  parts[selected].state.finish = finishSelect.value;
  applyState(selected);
});

document.getElementById('resetBtn').onclick = () => {
  for (const name of Object.keys(DEFAULTS)) {
    parts[name].state = { ...DEFAULTS[name] };
    applyState(name);
  }
  selectPart(selected);
};

// Click-to-select via raycast
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 6) return; // was a drag, not a click
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(bike.children, false);
  if (hits.length && hits[0].object.userData.part) selectPart(hits[0].object.userData.part);
});

// ---------------------------------------------------------------------------
// Photo upload + palette extraction (k-means, fully in-browser)
// ---------------------------------------------------------------------------
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const paletteDiv = document.getElementById('palette');
let photoDataUrl = null;

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    photoDataUrl = reader.result;
    photoPreview.src = photoDataUrl;
    photoPreview.hidden = false;
    const img = new Image();
    img.onload = () => renderPalette(extractPalette(img, 6));
    img.src = photoDataUrl;
  };
  reader.readAsDataURL(file);
});

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
  // k-means
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
  return centers.map((c2) => rgbToHex(c2[0], c2[1], c2[2]));
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
    const sw = document.createElement('div');
    sw.className = 'palette-swatch';
    sw.style.background = hex;
    sw.title = `${hex} — click to apply to ${PART_LABELS[selected]}`;
    sw.onclick = () => {
      parts[selected].state.color = hex;
      colorPicker.value = hex;
      applyState(selected);
      renderPartList();
    };
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
  grid.visible = false;
  ground.visible = false;

  const shots = [];
  for (const v of VIEWS) {
    printCam.position.set(...v.pos);
    printCam.lookAt(0, 0.55, 0);
    printRenderer.render(scene, printCam);
    shots.push({ name: v.name, dataUrl: printRenderer.domElement.toDataURL('image/png') });
  }

  scene.background = oldBg;
  grid.visible = true;
  ground.visible = true;
  printRenderer.dispose();
  return shots;
}

document.getElementById('exportBtn').onclick = () => {
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
  doc.text(`Build: ${buildName}   |   Date: ${new Date().toLocaleDateString()}`, margin, 19);

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
};

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

// Init UI
selectPart('frame');
