# Contributing

Thanks for your interest. This is a small, dependency-free project — keeping it that way
is a feature.

## Ground rules

- **No build step, no npm dependencies.** The app is `index.html` + `style.css` + `main.js`
  and loads Three.js / jsPDF from pinned CDN URLs via the import map. Please don't add a
  bundler, framework, or package manager.
- **No third-party 3D assets.** The motorcycle is procedural. If you want to add a real
  `.glb`, open an issue first so we can agree on licensing and file size.
- **Nothing leaves the browser.** No analytics, no uploads, no external API calls at runtime
  beyond the pinned CDN scripts and Google Fonts.

## Running locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. ES modules don't load from `file://`.

## Making changes

1. Fork, branch from `main`.
2. Keep the existing style: 2-space indent, single quotes, section banner comments in
   `main.js`. Match the vocabulary already in the file (`parts`, `buildBike`, `applyState`…).
3. `node --check main.js` must pass.
4. Test in the browser at 375 px (phone), 768 px, and a desktop width. Check the console is
   clean, a part can be clicked and painted, type switching works, and **Export Spec Sheet**
   produces a PDF.
5. If you touch anything paint-related, confirm the PDF table and the share link still
   reflect it — both are derived from the same `parts[]` state.
6. Open a pull request with a short description and, for visual changes, a screenshot.

## Where things live

See the **Code map** and **Extending it** sections of the README — adding a color preset,
finish, part, accessory or bike type is described there step by step.

## Reporting bugs

Open an issue with: browser + OS, what you did, what you expected, what happened, and a
share link (`Copy share link`) that reproduces the build if relevant. No personal photos
please — describe the photo instead.

## License

By contributing you agree your contributions are licensed under the project's
[MIT License](LICENSE).
