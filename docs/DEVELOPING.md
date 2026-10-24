# Working on Marker Studio

> **Internal.** Notes for maintaining the app: building, testing, how the code is laid out, how releases reach
> testers. Marker Studio is all rights reserved (see [LICENSE](../LICENSE)): the code is published to be read, not
> reused. For using the app, see the [README](../README.md).

The app ships as a single
self-contained `index.html` (offline-capable via a service worker), built from
readable source files in `src/`.

## Working on it

Edit files in `src/`, then rebuild `index.html`:

```sh
npm run build      # once
npm run dev        # rebuild on every save
```

Commit both `src/` and the rebuilt `index.html` — GitHub Pages serves
`index.html` as-is, with no build step on the server. The unit tests fail if
`index.html` doesn't match a fresh build, so the two can't drift apart.

Pages serves the `release` branch, not `main`: a commit reaches testers only
when the release workflow puts it there, after its tests have passed. See
[docs/RELEASING.md](RELEASING.md).

## Running the tests

```sh
npm test           # unit tests: Node's built-in runner, no install needed
npm install        # once, for the browser tests
npx playwright install chromium
npm run e2e        # browser tests: drives the real app in headless Chromium
```

GitHub Actions runs both on every push to any branch but `release`
(`.github/workflows/test.yml`):

- the unit tests, then the browser tests on Chromium in 2 parts side by side.
  These decide whether the run passes;
- (part 1, after its browser tests) the colour benchmark's gates, quick
  (`node scripts/bench/colour.mjs --quick`, about 2–5 minutes): a guide is
  always built, laying it again gives the same guide, Random never puts one
  marker on two sections the app sees touching, "keep touching sections clearly
  different" leaves no touching pair too alike, and a Gradient makes no twins.
  A gate that fails fails the run, listed on its page with each page's true
  section count (a page drawn differently on GitHub shows there as a truth
  change), and the report is kept. The bench's pages are kept between runs,
  drawn afresh when anything that draws them or finds their sections changes.
  These also decide whether the run passes;
- the same browser tests on WebKit (Safari's engine), in 10 parts side by side,
  one test file at a time. This job reports but doesn't fail the build. A failed
  test is run once more (`e2e/ci-retry.mjs`): one that then passes is reported
  as flaky, as a warning. If the browser's page process crashed during the test,
  the warning says so, with the machine's free memory at the time. Tests that
  can't pass on GitHub's WebKit at all are left out of that job, each with its
  reason (`notOnWebKit` in `e2e/helpers.mjs`).

`e2e/ci-parts.mjs` shares the files out so the parts take about as long
(`e2e/ci-durations.json`), and each part lists its results on the run's page.
The Chromium jobs keep their Playwright browser between runs (downloaded again
only when Playwright changes), and each install is stopped after 5 minutes and
tried again, up to 3 times (`e2e/ci-try.sh`), so one stalled download can't run
a job out of time. The WebKit jobs run in Playwright's own image
(`mcr.microsoft.com/playwright`, v323.1), which has WebKit and its system
libraries in it: no installs at all. Its tag must be the Playwright version
installed, so Playwright is pinned exactly in `package.json`; when you upgrade
Playwright, change the image's tag in `.github/workflows/test.yml` to match
(`e2e/ci-pw-image.mjs`, run by the WebKit jobs and by the unit tests, fails
until you do).
`E2E_BROWSER=webkit npm run e2e` runs the browser tests on WebKit locally.
Screenshots and PDFs from the browser tests land in `e2e/.artifacts/`
(ignored by git) so you can look at what the tests saw.

## Layout

- `index.html` — the built app (HTML, CSS, JS, the marker table and sample
  image, all inline). Generated — edit `src/` instead.
- `src/` — the source it's built from:
  - `index.template.html` — the page skeleton; `@@include(...)` lines pull in
    the pieces below, in order.
  - `css/` — styles, split by screen (`01-base` … `08-dialogs-match`).
  - `html/` — the page markup and the dialogs.
  - `js/` — the app script, split by area (`core`, `colour`, `state`,
    `picker`, `library`, `chrome`, `events`, `match`, `boot`, …). These share
    one global scope and are concatenated in the template's order.
    `layers.js` is the one place that opens and closes dialogs and decides
    what Escape closes. `colour.js` holds colour as the eye sees it
    (L\*C\*h°, CIEDE2000) and the six moods, used by the palette generator
    (`picker.js`) and the guide's gradient (`guide/30-palette-assign.js`).
  - `js/scan/` — Scan or type codes and the code reader it shares with the
    photo reader (`photo-read.js`), in the template's order: `10-read`
    (text → codes), `15-answer`, `20-list`, `30-pictures`, `35-waiting`,
    `40-gaps`, `50-handle`, `60-brands` (every brand and name rule), `65-codes`,
    `70-dialog`. Part of the one global script; their order matters only for
    code that runs at load (see docs/CODE-TOOLS.md, "Moving code").
  - `js/photo-read.js` and `js/ocr/` — the photo reader: the page's side
    (decoding, options, settling a photo's lines into codes) and the engine
    run in a worker (detect, zoom, recognise, a second look). A photo is read
    from a 2048-px copy; when the first detection finds its codes small (line
    height under 25 px) and the photo is bigger than 2560 px, the engine stops
    there and the page reads it again from a copy up to 4096 px with the
    detector at 3200 in 16 strips (v318.9; docs/READER-DETAIL.md).
  - `js/guide/` — the guide screen (`window.SF`). Its files are consecutive
    slices of one function, opened and closed by two lines in
    `index.template.html` around their includes (`99-close.js` holds the
    `SF` API it returns), so they share that function's variables. They aren't
    standalone modules; keep the numeric prefixes when adding files.
    `00-state.js` declares the shared variables (with the files that write
    each one), `05-style-fields.js` lists a guide's style settings once for
    saving, opening and Undo, and `50`–`53` draw the controls under the
    picture, one function per tab and stage. `03-jobs.js` is the guide's
    worker (`JOBS`): a Blob made from the page's own functions' source, so
    a job computes exactly what the page would. Its jobs: a PDF page packed,
    the saved image encoded, the section map encoded, a guide's label points,
    and (v318.36) a photographed page's corners (`pgFindCore`, 22-straighten)
    and a picture's ink, specks and sections up to the flood fill (`segWork`,
    10-segment: `segWorkerSrc` lists the functions copied in and the
    constants they read; add any new one there, or the worker's answer will
    differ from the page's and `e2e/speed-2.test.mjs` says so). A job
    that fails or gives no answer in time is done on the page instead.
  - `data/markers.json` — every marker (code, name, hex, family, brand), one
    per line.
  - `assets/sample-dual.png` — the built-in sample picture (v320: Ben's two
    jellyfish), and `assets/sample-dual-coloured.webp` his page of it coloured
    (photographed, lined up with the drawing, its paper evened): the start
    cards' "after", the welcome's picture and the empty Library's. The browser
    tests keep the single jellyfish of v284–v319 as the sample
    (`assets/sample-jellyfish.png`, with the app's own output from it,
    `sample-coloured.webp` and `sample-plain.webp`), unless a test sets
    `window.__MS_SAMPLE_NEW`.
- `scripts/build.mjs` — the build (no dependencies; `--check` and `--watch`).
- `scripts/launch.py` — v321: the iOS launch screens in `launch/` (the app's ground and the drop, one per screen size
  and orientation; v322: from `src/assets/intro/plain.png`, the drop uncoloured), and the `<link>` tags for
  `src/index.template.html` (Python with Pillow).
- `scripts/make-intro.mjs` — v322: the opening animation's markup (`src/html/intro.html`) and the launch screens'
  picture (`src/assets/intro/plain.png`) from `src/assets/icon.svg`; run it, then `launch.py`, after the icon changes
  (needs `npm install`).
- `scripts/make-icons.mjs` — renders the icon PNGs from `src/assets/icon.svg` and `icon-maskable.svg` (the
  source, drawn once) (needs `npm install`).
- `service-worker.js` — offline caching for the PWA. Bump the cache version
  (and the matching `v…` on Home in `src/html/app.html`) with each release.
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, `apple-touch-icon.png` — what makes it installable
  (Add to Home Screen / Install app).
- `docs/TESTERS.md` — the beta tester guide (the same as Help › Beta tester
  guide in the app).
- `docs/RELEASING.md` — how a tested commit reaches testers (the `release`
  branch, `.github/workflows/release.yml`), with the one-time Pages setup.
- `docs/DEVICE-TEST.md` — the internal pre-release checklist for real devices,
  covering what headless tests can't (real camera, share sheets, install). Not
  for testers.
- `.nojekyll` — tells GitHub Pages to serve the files as they are.
- `test/` — unit tests. `harness.mjs` loads the real built script into a
  sandboxed Node context with browser shims, so tests exercise the shipped
  code directly.
- `e2e/` — browser tests (Playwright + Node's test runner). `helpers.mjs`
  starts a local server and a fresh browser profile per test.

### Test coverage today

The suites run against the real shipped code. Since v320 the tests are organised **by feature**: each file is a
feature's (a big feature in parts, `palette.test.mjs`, `palette-2.test.mjs` …, each part under about 220 s on
Chromium, so the CI parts stay balanced). Inside a file, each block `{ … }` holds the tests that came from one older
file, under a `// ---- from <file> ----` line with that file's own header, its helpers beside them: the tests
themselves were moved word for word. A new test goes into its feature's file (the last part, or a new part when that
one is near the time limit), at the end of the block it belongs with or in a block of its own with a comment saying
which release or review it came from; never a file named after a release. `e2e/photo-gens.mjs` holds the made-up phone
photos several files draw. After adding or moving files, `e2e/ci-durations.json` gets the new names (timings from a
full run).

Unit tests (`npm test`), 14 files:

- `along.test.mjs` — Colour along, Focus mode, the share card.
- `app.test.mjs` — The app as a whole: build, CI, format, PWA, speed, text size, release, feedback.
- `colour.test.mjs` — Colour maths, matching and names.
- `data.test.mjs` — Saved state, backups, restore, style settings.
- `gradient.test.mjs` — The Gradient pattern’s engine.
- `markers.test.mjs` — Markers: filters, sets, finding, buying, Random.
- `palette.test.mjs` — The palette generator and the Palette screen’s logic.
- `pattern.test.mjs` — The guide’s patterns: Random, Balance, Blend, families, Leave white, themes.
- `scan.test.mjs` — Scan or type codes: reading text into markers.
- `scan-reader.test.mjs` — The photo reader’s readings and settling.
- `segmentation.test.mjs` — Finding sections: ink, specks, frames, hatching, coloured pages, small pictures.
- `shading.test.mjs` — Shading.
- `source-photo.test.mjs` — The picture kept with each guide.
- `zones.test.mjs` — Zones.

Browser tests (`npm run e2e`), 52 files:

- `along.test.mjs`, `along-2.test.mjs`, `along-3.test.mjs` — Colour along: the list, ticks, codes, run low, finding a marker.
- `data.test.mjs`, `data-2.test.mjs` — Backups, restore, storage, two tabs, unreadable data, deleting data.
- `finish-share.test.mjs`, `finish-share-2.test.mjs` — A finished page, Reveal, Save image, share, the photo of your page.
- `focus.test.mjs`, `focus-2.test.mjs` — Focus mode.
- `frame.test.mjs`, `frame-2.test.mjs` — The guide’s frame and layout: the picture’s sizes, text size, the header, phones and iPads.
- `guide-colours.test.mjs`, `guide-colours-2.test.mjs` — A guide’s colours: Mood, Colours from, filters, Change colour, pins, Paint, brand letters.
- `help.test.mjs` — Help, What’s new, wording, the beta tester tasks and feedback.
- `home.test.mjs`, `home-2.test.mjs` — Home: tiles, the Continue card, the latest guide, counts.
- `intake.test.mjs`, `intake-2.test.mjs`, `intake-3.test.mjs` — Getting a picture in: photos, scans, PDFs, straightening, sections found, specks, frames, hatching.
- `library.test.mjs`, `library-2.test.mjs` — The Library, saving and reopening guides, guide files.
- `markers.test.mjs`, `markers-2.test.mjs`, `markers-3.test.mjs` — Markers: the grid, details, sets, To buy, the swatch chart, dry and running low.
- `match.test.mjs` — Match a colour.
- `palette.test.mjs`, `palette-2.test.mjs`, `palette-3.test.mjs` — The Palette screen: harmonies, locks, sizes, saving, Use in a guide.
- `pattern.test.mjs`, `pattern-2.test.mjs`, `pattern-3.test.mjs` — A guide’s Pattern: Random, Blend, Gradient, Balance, Leave white.
- `photo-pattern.test.mjs` — The Photo pattern.
- `print.test.mjs`, `print-2.test.mjs` — Print and the PDF, the test strip.
- `scan.test.mjs`, `scan-2.test.mjs` — Markers › Scan or type codes: typed, pasted and Scan Text.
- `scan-reader.test.mjs`, `scan-reader-2.test.mjs` — Scan › Photograph your caps: the photo reader.
- `sections-editor.test.mjs`, `sections-editor-2.test.mjs` — Edit sections: merge, split, re-detect, Undo, Discard.
- `shading.test.mjs` — Shading.
- `shell.test.mjs`, `shell-2.test.mjs`, `shell-3.test.mjs` — The shell: tabs, sheets, buttons, Escape and Back, keyboard and screen readers, toasts, tap areas, installing.
- `source-photo.test.mjs` — The picture kept with each guide (Edit sections › Adjust photo after reopening).
- `speed.test.mjs`, `speed-2.test.mjs` — Speed and the worker: redraws, jobs, controls wiring.
- `undo.test.mjs` — Undo.
- `welcome.test.mjs`, `welcome-2.test.mjs` — The welcome (first run): sets, the steps, adding markers on the way in.
- `zones.test.mjs`, `zones-2.test.mjs` — Zones.

The section-finder core is reached through a small, additive **test-export
seam** in `index.html`: one block, guarded by `globalThis.__MS_TEST`, that
exposes the closure's functions and state to the harness. It is **inert in the
browser** (the flag is only ever set by the harness) and does not change app
behaviour. A second, read-only seam exposes the marker table (`COLORS`/`HS`) so the matching tests can pick targets and verify the closest pick; it is guarded the same way.

The harness includes a small, lossless canvas/Image polyfill so the label-map
encode and payload persistence run in Node. The full `openDesignObj` load
path (marker reassignment plus UI wiring) is covered by the browser tests
(resume after reload, restoring a guides backup).

## Notes on the content

- **Wording style (v323).** British English, and sentence case everywhere: buttons, labels, headings, tabs and
  menus capitalise only their first word ("Reveal & share", "Plan & keep", "Colour along"), never every word.
  Names keep their capitals wherever they fall: brands (Ohuhu, Copic), marker codes and names, products (Colorless
  Blender), and the app's own named features when referred to (Focus mode, Colour along). Group labels in a panel are
  grey sentence-case labels, not small capitals; a slider's row is its label on the left and its value on the right.
- **Motion (v323).** Short interface movements use the motion tokens in `src/css/01-base.css` (`--dur-quick`,
  `--dur-base`, `--dur-slow`, `--ease-out`, `--ease-spring`) rather than their own timings. Entrances are off
  under test (`html.ms-still`, unless a test sets `window.__MS_MOTION`) and with Reduce motion.
- **Marker sets.** The set lists (`OHUHU_SETS` in `src/js/events.js`) were
  checked against Ohuhu's official colour charts and copic.jp's set pages in
  September 2026. Colourless
  blenders that come in the box are not listed; they aren't colours.
