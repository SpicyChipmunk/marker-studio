# Marker Studio

A phone-first Progressive Web App that turns a photo of line art into a
**marker-by-number colouring guide**, matched to the markers you actually own
(Ohuhu, Copic). It segments the drawing into sections, assigns each a marker
from your collection, and walks you through colouring it in.

> Status: graduating from a personal tool toward something shareable. The app
> itself is a single self-contained `index.html` (offline-capable via a service
> worker). This repo adds the project scaffolding and an automated test suite so
> the code can change safely.

## Running the tests

No dependencies — uses Node's built-in test runner.

```sh
node --test
```

## Layout

- `index.html` — the entire application (HTML, CSS, JS, embedded sample images).
- `service-worker.js` — offline caching for the PWA.
- `test/harness.mjs` — loads the real app script into a sandboxed Node context
  with browser shims, so tests exercise the shipped code directly (no copies).
- `test/*.test.mjs` — the test suites.

### Test coverage today

The suites run against the real shipped code:

- `color.test.mjs` — pure colour/format helpers (`hexToLab`, `rgb`, `hsl`,
  `mix`, `hueDist`, `txt`, `normCode`).
- `core.test.mjs` — the section-finder core via the test seam: segmentation
  (`segment`, `labelCells`), background-detection stability, and snapshot/undo
  field-preservation. Two of these are regression tests that pin fixes made
  during hardening.
- `save-load.test.mjs` — guide persistence: the label-map encode (`lmapURL`)
  round-trips losslessly through a canvas/Image polyfill (including labels above
  255), and `currentDesignObj` persists Toggle state and settings.
- `robustness.test.mjs` — input-quality detection (`segQuality`): flags blank,
  low-contrast, dark/photo, and over-segmented inputs so the app can warn the
  user instead of producing a bad guide, while passing clean line art.
- `matching.test.mjs` — the colour-matching subsystem: `nearest` is checked
  against an exact reimplementation of its cost function (pool control via
  `setPool`), covering exclude, the neutral-pool fallback, `preferL`, and
  determinism, plus `keyIdx` round-trips.
- `design.test.mjs` — label placement (labels land inside irregular sections,
  e.g. a C-shape whose centroid is outside it), the set picker's "already
  owned" marking, and the guide-backup reminder's at-risk count.
- `fixes.test.mjs` — regressions from the v234 review: one-time collection
  migrations don't re-run on every launch, an emptied collection stays empty,
  library entries from files/backups are sanitised (ids, thumbnails, keys),
  `esc`/`safeThumb`, and generated-palette guides persist their palette.
  Persistence tests boot a fresh app per case via `createApp()` with an
  in-memory `localStorage` (`memoryStorage()` in the harness).

The section-finder core is reached through a small, additive **test-export
seam** in `index.html`: one block, guarded by `globalThis.__MS_TEST`, that
exposes the closure's functions and state to the harness. It is **inert in the
browser** (the flag is only ever set by the harness) and does not change app
behaviour. A second, read-only seam exposes the marker table (`COLORS`/`HS`) so the matching tests can pick targets and verify the closest pick; it is guarded the same way.

The harness includes a small, lossless canvas/Image polyfill so the label-map
encode and payload persistence run in Node. Not yet covered: the *full*
`openDesignObj` load path (marker reassignment plus UI wiring) is too DOM- and
collection-coupled to run headless — that's browser-tier.

## Notes for contributors / re-use

- **Trademarks & colour data.** "Ohuhu" and "Copic" are trademarks of their
  respective owners; this project is not affiliated with or endorsed by them.
  Marker names, codes, and colour values are included only so the tool can match
  against markers people own.
- **Sample images.** Any bundled sample line art must be original or under a
  licence that permits redistribution before this repo is published publicly.

## License

MIT — see [LICENSE](LICENSE).
