# 🚲 ShraSquad Bike Customizer

Design a custom bike paint job in 3D, match colors from a real photo, and export a
print-ready **PDF spec sheet** you can hand to any paint shop for a real-world replica.

**100% client-side.** No server, no uploads, no build step — your photo never leaves the browser.

## Features

- **Procedural 3D bicycle** built from Three.js primitives — click any part to select it
- **Per-part customization** — color picker + finish (gloss / matte / metallic / chrome)
- **Photo color matching** — upload a photo of a real bike; a k-means palette extractor
  pulls its dominant paint colors so you can apply them to parts with one click
- **PDF spec sheet export** — 4 rendered views (side / front / top / 3-4), a paint table
  with hex values, nearest **RAL codes** (the language paint shops speak), and finish per
  part, plus your reference photo

## Run locally

Any static file server works:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

> Opening `index.html` directly via `file://` won't work — ES modules require HTTP.

## Deploy to GitHub Pages

Repo Settings → Pages → Source: *Deploy from a branch* → branch `master`, folder `/ (root)`.
No build pipeline needed; the app is plain HTML/CSS/JS with CDN-pinned dependencies.

## Stack

- [Three.js](https://threejs.org/) 0.160 (via CDN import map) — scene, materials, raycasting
- [jsPDF](https://github.com/parallax/jsPDF) 2.5 — client-side PDF generation
- Vanilla JS + Canvas API — k-means color extraction

## How the shop handoff works

Hex values are authoritative. RAL codes on the spec sheet are nearest-distance matches
(RGB Euclidean) from a curated set of common RAL classic colors, included because most
paint shops mix from RAL references rather than raw hex.

## Roadmap

- [ ] Part variants (drop bars / riser bars, saddle styles)
- [ ] Decal & text placement on the frame
- [ ] Motorbike template
- [ ] Save/load builds via URL hash
