# ShraSquad Garage — Bike Customizer

Design a custom motorcycle paint job in 3D, match colors from a photo of a real bike,
and export a print-ready **PDF spec sheet** any paint shop can follow to build the replica.

**100% client-side.** No server, no accounts, no uploads, no build step. Your photo never
leaves the browser. Open the page and it works.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Quick start](#quick-start)
3. [Using the customizer](#using-the-customizer)
4. [The PDF spec sheet](#the-pdf-spec-sheet)
5. [Share links](#share-links)
6. [Keyboard & accessibility](#keyboard--accessibility)
7. [Deploying (GitHub Pages)](#deploying-github-pages)
8. [How it works — architecture](#how-it-works--architecture)
9. [Code map](#code-map)
10. [Extending it](#extending-it)
11. [Browser support & performance](#browser-support--performance)
12. [Roadmap](#roadmap)
13. [Contributing](#contributing)
14. [License & third-party notices](#license--third-party-notices)

---

## What it does

| Feature | Details |
| --- | --- |
| **3 motorcycle types** | Cruiser (V-twin, low seat, double low exhaust), ADV (parallel twin, tall stance, beak, upswept can), Café Racer (long flat tank, seat hump, clip-ons, megaphone). Fully procedural — built from Three.js geometry, no downloaded 3D assets. |
| **11 paintable parts** | Tank, Fenders, Frame, Seat, Engine, Exhaust, Fork, Handlebar, Rims, Tires, Luggage. Click a part in 3D or pick it from the panel. |
| **4 finishes** | Gloss (wet clearcoat), Matte, Metallic (flake sheen), Chrome. Physically-based materials, so chrome actually reflects the studio. |
| **5 accessories** | Windscreen, Panniers, Luggage rack, Top box, Crash bars — toggle on/off; they rebuild with the bike and repaint with the Luggage/Exhaust parts. |
| **Photo color matching** | Drop a photo of a real bike. A k-means palette extractor pulls its dominant colors and applies them automatically: most vivid → tank + fenders, second → frame, darkest → seat + tires. Swatches stay available for manual per-part tweaks. |
| **Studio stage** | Black void, warm key spotlight with a soft volumetric beam, cool kicker lights, wet-black reflective floor, bloom, and a floating neon **SHRASQUAD GARAGE** wordmark — MotoGP-launch style. |
| **Camera presets** | Side / Front / ¾ / Rear / Tank close-up with a smooth orbit tween. Keys `1`–`5`. |
| **Idle life** | Wheels spin slowly, subtle suspension bob, headlight pulse, one-time roll-in intro. Auto-rotate turntable with a pause control. Honors `prefers-reduced-motion`. |
| **PDF spec sheet** | 4 rendered views on white, paint table with hex + nearest **RAL code** + finish per part, model line, fitted accessories, your reference photo, and the share link. |
| **Share links** | The whole build lives in the URL hash. Copy, send to a shop, they open the exact configuration. |

---

## Quick start

Any static file server works. From the repo root:

```bash
npx serve .
```

or

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

> **Why a server?** The app uses ES modules and an import map. Browsers refuse to load
> modules from `file://`, so double-clicking `index.html` shows a blank page.

Dependencies load from CDNs at runtime (pinned versions, no install step):

- [Three.js](https://threejs.org/) 0.160 — via import map from jsDelivr
- [jsPDF](https://github.com/parallax/jsPDF) 2.5.1 — UMD script tag
- Google Fonts — Inter, Barlow Condensed, Space Grotesk

---

## Using the customizer

**Navigate the 3D view**
- Drag to orbit, scroll/pinch to zoom.
- Hover a part → it highlights. Click → it becomes the selected part.
- Leave it alone for 4 s → turntable auto-rotates. Touch it → stops. Pause button in the camera pill turns it off for good.

**Pick a model line** — *Bike type* segment: Cruiser, ADV, Café. Your paint scheme carries over when you switch.

**Paint a part**
1. Select the part (click it in 3D or tap its chip under *Parts*).
2. Pick a preset color square, or use the custom color picker (hex shown live).
3. Choose a finish: Gloss / Matte / Metallic / Chrome.

**Add accessories** — tap chips under *Accessories*. Top box implies a rack. Accessories are paintable via the *Luggage* part (bars/hardware follow *Exhaust*).

**Match a real bike** — drop a photo (or click *browse*) under *Match a real bike*. Colors apply instantly; six extracted swatches appear for manual use. Nothing uploads — all processing is `<canvas>` pixel math in your tab.

**Name it** — *Build name* goes on the PDF header and in the share link.

**Reset** — restores default paint for every part (does not change type/accessories).

---

## The PDF spec sheet

Press **Export Spec Sheet**. A file named `<build-name>-spec.pdf` downloads. Contents:

- **Header** — build name, model line (Cruiser / ADV / Café Racer), date.
- **Four renders** — Side, Front, Top, ¾ on a white background, no stage, no bloom, animation pose reset — so the images are clean and repeatable.
- **Paint & Finish table** — one row per part: hex value, swatch, nearest RAL code and name, finish.
- **Fitted accessories** — list or "None".
- **Build link** — the share URL in full (wrapped), so the shop can open the exact 3D build.
- **Page 2 (only if you attached a photo)** — your reference photo.

**About RAL codes.** Hex values are authoritative. RAL codes are nearest-distance matches
(RGB Euclidean) against a curated set of ~28 common RAL Classic colors, included because
most paint shops mix from RAL references rather than hex. If the RAL name looks off, trust the hex.

---

## Share links

Every state change rewrites `location.hash` (debounced, `history.replaceState` — no
back-button spam). Format:

```
#t=<type>&a=<acc1,acc2>&n=<build name>&p=tank:c0392b:gloss,frame:16181d:matte,...
```

- `t` — `cruiser` | `adv` | `cafe`
- `a` — comma-separated accessory keys: `windscreen`, `panniers`, `rack`, `topbox`, `crashbars`
- `n` — URL-encoded build name (max 80 chars)
- `p` — `part:hex:finish` triples for all 11 parts

**Copy share link** copies the current URL. Opening a link restores the build *before*
the first frame renders. Invalid values are ignored silently; the app never crashes on a
malformed hash.

---

## Keyboard & accessibility

| Key | Action |
| --- | --- |
| `1` `2` `3` `4` `5` | Camera presets: Side, Front, ¾, Rear, Tank |
| `←` `→` (on a part chip) | Move between parts |
| `Enter` / `Space` | Activate focused control |
| `Esc` | Blur the 3D canvas |

- Every control has a visible focus ring; segmented controls are `role="radiogroup"` with
  `aria-checked`; toggles use `aria-pressed`; the toast is `role="status"`.
- Active states never rely on color alone (check glyph / underline + accent).
- Touch targets are ≥44 px on mobile.
- `prefers-reduced-motion: reduce` disables the roll-in, bob, pulse, camera tween and
  defaults auto-rotate to off.
- Mobile (≤720 px): the panel becomes a bottom sheet; the camera pill moves to the top.

---

## Deploying (GitHub Pages)

The repo *is* the site — no build.

1. Repo → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)` → Save

Live at `https://<your-user>.github.io/shrasquad-bike-customizer/` within a minute or two.
Any other static host (Netlify, Vercel, S3, nginx) works the same way — upload the four files.

---

## How it works — architecture

```
index.html ─ layout + import map + jsPDF tag
style.css  ─ black MotoGP theme, one accent (#ff3b1f), responsive rules
main.js    ─ everything else, in sections:
             scene/camera/controls → lighting rig → stage (floor, reflector, beam, neon)
             → materials & part registry → motorcycle factory (buildBike) → selection/UI
             → photo palette → RAL → share hash → PDF export → camera presets
             → idle animation → post-processing (bloom) → render loop → init
```

**Rendering.** A `WebGLRenderer` draws the `Scene` through a `PerspectiveCamera` every frame
via `setAnimationLoop`. Post-processing runs through `EffectComposer`: `RenderPass` →
`UnrealBloomPass` (with a clamped high-pass so chrome specular hits don't smear) →
`OutputPass` (tone mapping + sRGB). The floor uses `Reflector` for true planar reflections.

**Lighting.** One warm `SpotLight` key (shadow-casting) aimed at the tank, two cool
`SpotLight` kickers from behind for silhouette separation, a faint `HemisphereLight` fill,
and `RoomEnvironment` through `PMREMGenerator` as the environment map so metals have
something to reflect. A shader-based additive cone fakes the visible light beam.

**Procedural motorcycle.** `buildBike(type)` clears the `bike` group and rebuilds it from
a per-type config (wheel sizes, steering head, tank profile, bar height, seat height). Helpers:

- `tube` / `capsule` — cylinder or capsule between two points (frame, fork, stays)
- `curveTube` — `TubeGeometry` swept along a `CatmullRomCurve3` (handlebar bend, exhaust)
- `LatheGeometry` — revolved profiles (tank, tires, rims, finned cylinders, mufflers)
- `ExtrudeGeometry` — 2D `Shape` + bevel (seat, lipped fenders, valve covers)
- `InstancedMesh` — chain links in one draw call
- Wheel meshes live under a `Group` pivot at the axle so the idle loop can spin them

**Materials as the paint registry.** `parts[name] = { material, meshes[], state:{color,finish} }`.
Every mesh of a part shares one `MeshPhysicalMaterial`; changing that material repaints the
part everywhere. Finishes are property presets (`roughness`, `metalness`, `clearcoat`,
`sheen`, `envMapIntensity`). Non-paintable details (rubber grips, lenses, glass) use fixed materials.

**Picking.** `Raycaster` from pointer NDC → `intersectObjects(bike.children, true)` → first hit's
`userData.part`. Hover and click share the code path; a drag over 6 px is not a click.

**Photo → colors.** Image downscaled to ≤80 px, alpha-filtered pixels, k-means (k=6, 10
iterations), clusters scored by saturation × mid-lightness × √frequency. Vivid → tank/fenders,
next distinct vivid → frame, darkest → seat/tires.

**PDF.** `captureViews()` hides the stage, sets a white background, resets the animation pose,
renders four camera positions with a plain reused `WebGLRenderer` (no bloom) and feeds the
PNGs plus the paint table into jsPDF. Everything on the sheet is derived from the same
`parts[]` state the 3D view uses, so what you see is what the shop gets.

---

## Code map

| Where (main.js section banner) | What lives there |
| --- | --- |
| *Scene setup* | renderer, camera, `OrbitControls`, idle-turntable timer (`keepAwake`) |
| *Lighting rig* | `keyLight`, kickers, hemisphere fill |
| *The stage* | floor, `Reflector` slab, beam shader, neon wordmark canvas, brand point light |
| *Materials & part registry* | `FINISHES`, `DEFAULTS`, `parts`, `partMaterial`, `addMesh`, `tube`, `capsule`, `curveTube` |
| *Procedural motorcycle factory* | `TYPES`, `ACC_DEFS`, `accessories`, `buildWheel`, `engineCylinder`, `fender`, `clearBike`, `buildBike` |
| *Selection, hover & customization* | `PART_LABELS`, `PRESETS`, `selectPart`, `applyState`, `setColor`, render functions, type/accessory handlers, raycast |
| *Photo upload + palette extraction* | dropzone wiring, `extractPalette`, `autoApplyPalette`, `renderPalette` |
| *RAL color matching* | `RAL` table, `nearestRal` |
| *Save & share* | `buildHash`, `readHash`, `writeHash`, `copyShareLink` |
| *PDF spec sheet export* | `VIEWS`, `captureViews`, `buildPdf` |
| *Camera presets* | `CAM_VIEWS`, `tweenCamera`, `goToView`, key handling |
| *Idle animation* | wheel spin, bob, headlight pulse, intro, reduced-motion flag |
| *Post-processing* | `composer`, `bloomPass` |
| *Resize + render loop*, *Init* | `resize`, `setAnimationLoop`, hash restore → `buildBike` → UI render |

---

## Extending it

**Add a color preset** — append a hex to `PRESETS`.

**Add a finish** — add a key to `FINISHES` with `roughness`, `metalness`, `clearcoat`,
`clearcoatRoughness`, `sheen`, `sheenRoughness`, `envMapIntensity`; add a `<button data-finish="…">`
in `#finishSeg`. The hash parser validates against `FINISHES` automatically.

**Add a paintable part** — add it to `DEFAULTS` and `PART_LABELS`, then register meshes with
`addMesh('yourpart', geometry, position)` (or `tube`/`capsule`/`curveTube`) inside `buildBike`.
It appears in the panel, the PDF table and the share hash with no other changes.

**Add an accessory** — add `{ key, label }` to `ACC_DEFS` and `key: false` to `accessories`,
then build its meshes inside `buildBike` under `if (accessories.key) { … }`.

**Add a bike type** — add an entry to `TYPES`, a per-type block in the `cfg` object inside
`buildBike` (wheel sizes, `head`, `tank`, `barY`, `seatY`), any `if (type === '…')` variants
you want (engine, seat, exhaust, fenders), and a `<button data-type="…">` in `#typeSeg`.

**Add a RAL color** — append `['RAL 0000', 'Name', '#hex']` to `RAL`.

**Swap in a real 3D model** — load a `.glb` with `GLTFLoader` in place of `buildBike`'s
geometry, and register each mesh with `parts[name].meshes.push(mesh); mesh.userData.part = name;
mesh.material = partMaterial(name)`. Everything downstream (paint, hash, PDF, picking) keeps working.

---

## Browser support & performance

- Any evergreen browser with WebGL2 (Chrome, Edge, Firefox, Safari 15+, mobile Safari/Chrome).
- Model + stage ≈ 100k triangles; chain is one instanced draw. Bloom and the reflector each
  add a scene pass, so on low-end phones expect ~30 fps — the app stays usable.
- `devicePixelRatio` is capped at 2. Shadows: one 2048² map on the key light only.
- The PDF renderer is created once and reused (no WebGL context leak per export).

---

## Roadmap

- [ ] Decals & text on the tank (`DecalGeometry`)
- [ ] Two-tone paint (upper/lower split per part)
- [ ] Optional HDRI environment
- [ ] AR preview via `<model-viewer>` / GLB export
- [ ] Rough price estimate on the spec sheet
- [ ] Smarter photo segmentation (ignore background walls)

---

## Contributing

Issues and pull requests welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Short version:
no build step, no dependencies, no third-party 3D assets, nothing leaves the browser.

---

## License & third-party notices

**Copyright © 2026 Shravan PV.** Released under the [MIT License](LICENSE) — use it, fork
it, ship it, commercially or not; keep the copyright notice.

Everything in this repository is original work: all code, the procedural motorcycle
geometry, the stage, the UI. No 3D models, textures or images were downloaded or bundled.

Runtime dependencies are loaded from CDNs and are **not** redistributed in this repo:

| Library / asset | License | Source |
| --- | --- | --- |
| Three.js 0.160 (core + addons: OrbitControls, RoomEnvironment, Reflector, EffectComposer, RenderPass, UnrealBloomPass, OutputPass) | MIT | https://github.com/mrdoob/three.js |
| jsPDF 2.5.1 | MIT | https://github.com/parallax/jsPDF |
| Inter, Barlow Condensed, Space Grotesk | SIL Open Font License 1.1 | https://fonts.google.com |

"RAL" is a trademark of RAL gGmbH. The RAL color values in `main.js` are approximate sRGB
conversions included for convenience only and are not certified color references.
"MotoGP" is referenced descriptively as a visual style; this project is unaffiliated.
