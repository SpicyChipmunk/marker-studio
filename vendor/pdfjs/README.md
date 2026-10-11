# PDF.js (vendored)

Mozilla's PDF.js, used by the app to open a colouring page that came as a PDF (`src/js/guide/21-pdf.js`).

- Package: `pdfjs-dist` 6.3.289 from npm, unmodified, its `legacy` build (for Safari; PDF.js supports Safari 18+).
- npm integrity: `sha512-ZHjSVpDa3D6izMq8/04lvkhkATUmL9px6ChPaXc1k6nU2Mrhlg1/7F0bdUqCwUjw3NsPTfPZsMDUU6ZIcRaeQw==`
- Files: `legacy/build/pdf.min.mjs`, `legacy/build/pdf.worker.min.mjs`, and `wasm/` (`jbig2.wasm`, `openjpeg.wasm`,
  `qcms_bg.wasm`, for scanned pages and colour profiles, and `jbig2_nowasm_fallback.js` and
  `openjpeg_nowasm_fallback.js`, for a browser whose WebAssembly can't run those: Safari's engine in the tests can't run
  `openjpeg.wasm`'s relaxed SIMD) with their licence files.
- Licence: Apache License 2.0 (`LICENSE`); the wasm decoders are BSD and MIT licensed (`wasm/LICENSE_*`).

Each version has a folder of its own: the service worker keeps it in a cache named after the version, which a new
release of the app leaves alone, so it's downloaded once. To update, add the new version's folder, change
`PDFJS_VER` in `src/js/guide/21-pdf.js` and `PDFJS` in `service-worker.js`, and remove the old folder.
