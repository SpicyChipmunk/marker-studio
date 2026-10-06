# Marker Studio

Marker Studio turns a colouring page into a **marker-by-number guide**, using
the Ohuhu and Copic alcohol markers you own. It finds the page's sections,
gives each one a marker from your collection, and walks you through colouring
it, one marker at a time.

**Open the app:** <https://spicychipmunk.github.io/marker-studio/>

- **In beta.** Testers: please read the [tester guide](docs/TESTERS.md) first
  (it's also in the app, under Help › Beta tester guide).
- **Made for the iPad** (Safari), and it works on phones and computers too. On
  an iPad or iPhone, add it to your Home Screen before you set up your markers.
- **Private and offline.** No account, no ads, no tracking: your markers,
  palettes, guides and photos stay on your device. The camera is used only to
  scan marker caps or match a colour.
- **Ohuhu and Copic only**, for now. Colours on screen are approximate.
- **Feedback:** tap **Send feedback** at the foot of Home.

Marker Studio isn't affiliated with or endorsed by Ohuhu or Copic.

---

The rest of this page is for working on the code. The app ships as a single
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

Pages serves the `release` branch, not `master`: a commit reaches testers only
when the release workflow puts it there, after its tests have passed. See
[docs/RELEASING.md](docs/RELEASING.md).

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
- the same browser tests on WebKit (Safari's engine), in 8 parts side by side,
  one test file at a time. This job reports but doesn't fail the build. A failed
  test is run once more (`e2e/ci-retry.mjs`): one that then passes is reported
  as flaky, as a warning. Tests that can't pass on GitHub's WebKit at all are
  left out of that job, each with its reason (`notOnWebKit` in
  `e2e/helpers.mjs`).

`e2e/ci-parts.mjs` shares the files out so the parts take about as long
(`e2e/ci-durations.json`), and each part lists its results on the run's page.
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
  - `js/guide/` — the guide screen (`window.SF`). Its files are consecutive
    slices of one function, opened and closed by two lines in
    `index.template.html` around their includes (`99-close.js` holds the
    `SF` API it returns), so they share that function's variables. They aren't
    standalone modules; keep the numeric prefixes when adding files.
    `00-state.js` declares the shared variables (with the files that write
    each one), `05-style-fields.js` lists a guide's style settings once for
    saving, opening and Undo, and `50`–`53` draw the controls under the
    picture, one function per tab and stage.
  - `data/markers.json` — every marker (code, name, hex, family, brand), one
    per line.
  - `assets/sample-jellyfish.png` — the built-in sample picture.
    `assets/sample-coloured.webp` (its guide, with codes, on the start cards)
    and `assets/sample-plain.webp` (without codes, on the welcome) are the
    app's own output from it.
- `scripts/build.mjs` — the build (no dependencies; `--check` and `--watch`).
- `scripts/make-icons.mjs` — draws the app icon and writes the icon PNGs and
  `src/assets/icon.svg` (needs `npm install`).
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

The suites run against the real shipped code. Each file is named for the
feature it tests; a regression test found in a review or release sits with the
feature it guards, under a comment saying where it came from.

Unit tests (`npm test`):

- `build.test.mjs` — `index.html` matches a fresh build of `src/`.
- `format.test.mjs` — `src/js` and `src/css` are formatted by the pinned
  Prettier (`npm run format` fixes it).
- `color.test.mjs` — pure colour/format helpers (`hexToLab`, `rgb`, `hsl`,
  `mix`, `hueDist`, `txt`, `normCode`), CIEDE2000 against the published test
  data, and the six moods.
- `palette-generator.test.mjs` — generated palettes: every scheme and size is
  full, clearly different (ΔE00 10; Monochrome 6), free of greys and on its
  hues; small collections relax and say so; locked colours, moods, re-rolling
  one colour, speed.
- `match-and-photo.test.mjs` — Match's ranking by eye, its labels and buy
  rule; From photo (full size, pairs at least 6 apart, no near-white); the
  paper patch and lighting correction.
- `photo-choice.test.mjs` — the Photo pattern's marker choice (the full search
  against the quick one used while the slider is dragged) and its suggested
  marker count.
- `colour-engines.test.mjs` — the CIEDE2000 split, the closest-by-eye
  lookup, Blend's three mixes, Warm/Cool on named markers, blend companions
  (direction, step, hue), neighbours across thick lines, Random's rule.
- `gradient.test.mjs` — the gradient's marker choice (never more than
  sections, coloured first, clearer ones when spare), loop or ramp, Look's
  band sizes, sharing by area, and speed on a big page.
- `matching.test.mjs` — `nearest` checked against an exact reimplementation of
  its cost function (exclude, the neutral fallback, `preferL`, determinism),
  plus `keyIdx` round-trips.
- `segmentation.test.mjs` — the section-finder core via the test seam:
  `segment`, `labelCells`, `otsu`, background-detection stability,
  snapshot/undo field preservation, and labels placed inside irregular sections.
- `quality-check.test.mjs` — `segQuality` flags blank, low-contrast, dark and
  over-segmented inputs, and passes clean (also dense) line art.
- `save-load.test.mjs` — the label map round-trips losslessly (`lmapURL`),
  `currentDesignObj` keeps settings and the generated palette, `esc`/`safeThumb`,
  and a file that isn't a guide changes nothing.
- `saved-state.test.mjs` — loading the saved state: one bad field costs only
  that field, unknown or out-of-range markers are dropped, unreadable state is
  copied and left alone, other tabs' Library entries are kept, and the one-time
  collection migrations and set fix run once. Each case boots a fresh app with
  an in-memory `localStorage` (`createApp()` / `memoryStorage()`).
- `backup-restore.test.mjs` — the backup reminder's at-risk count, and restoring
  with storage full or from a backup without markers.
- `sets.test.mjs` — every marker set has as many colours as its name, every code
  is known, the sets nest the way Ohuhu sells them, Copic sets resolve, and the
  set picker marks sets you already own.
- `filters.test.mjs` — marker filters: the first tap shows only that kind, more
  taps add, removing the last goes back to all.
- `names.test.mjs` — the guide and palette name generators and copy names.
- `focus-mode.test.mjs` — focus mode's walking order: every section once, light
  to dark, top section first, then a neighbour; "next" skips finished ones.
- `shading.test.mjs` — companion markers only from your collection, the shadow
  away from the sun, layered tones, 2nd coats, saving, the printed H/S marks,
  and colouring along with tones.
- `speed.test.mjs` — packed undo snapshots and the section-map signature.
- `style-fields.test.mjs` — the exact saved form of a guide's style settings.
- `text-size.test.mjs` — the text-size codemod, and CSS sizes on the type scale.
- `pwa.test.mjs` — the manifest, its icons, the precache and the version shown.

Browser tests (`npm run e2e`), by area:

- `guide-frame.test.mjs` — picture sizes and the scroll-linked shrink, tabs that
  never move anything, where a stage change lands, drag to scroll, side by side,
  one-time hints, overlays on the shrunk picture.
- `guide-header.test.mjs` — the name and where it is saved, renaming in place,
  the ⋯ menu, a header that keeps its height.
- `bar-and-tool-row.test.mjs` — the bottom bar on the bottom edge, and the tool
  row's contents and wording.
- `tabs.test.mjs` — Colours · Pattern · Shading · Share: what each holds, the
  remembered tab, helper text, the Print sheet.
- `sheet.test.mjs` — the section tip, and the shared sheet under the picture
  (Change colour, Manual, the Paint brush, Blend's menu) on phones and tablets.
- `controls-wiring.test.mjs` — every state of the guide's controls
  (`e2e/controls-states.mjs`) renders and wires each control.
- `pins-and-change-colour.test.mjs` — tap a section to change or pin its colour
  in every pattern, the marker picker, Pin mode, Fill unpinned.
- `paint.test.mjs` — Everywhere in the picker, and Paint in Manual (tap, drag,
  touch).
- `photo.test.mjs` — colour from a photo: matching, lining up (by hand and by
  itself), the marker cap, white areas, and keeping the photo.
- `photo-choice.test.mjs` — the Photo pattern's figures graded by eye in
  Match's words (summary, tips, "Closer with"), and the suggested marker count
  and its Use button.
- `shading.test.mjs` — the sun, rounder light, Highlight/Shadow, sections left
  flat, light from the photo, tones while colouring along, saving.
- `undo.test.mjs` — ↶ Undo and Ctrl+Z for every plan change, and the Undo toasts
  for Own all, Clear collection, Library delete and Reset progress.
- `style-fields.test.mjs` — every style setting saved, reopened, undone and read
  from odd files, against `e2e/fixtures/style-golden.json`.
- `sections-editor.test.mjs` — merge, split, add, include/exclude, the size
  slider, crop and rotate, Ctrl+Z.
- `rebuild-sections.test.mjs` — going back to a built guide's sections (re-detect,
  turn, Build again, sections left out, edits not built) keeps its work.
- `straighten.test.mjs` — a photographed page is found and flattened; unsure
  cases open the corner handles.
- `paper-and-background.test.mjs` — grainy paper, the table around the page and
  a drawn frame.
- `colour-along.test.mjs` — the marker rows, opening one in place, Clear ticks
  and Reset progress, press and hold, finishing the page.
- `focus-mode.test.mjs` — one section at a time, light to dark; its keyboard
  focus and leaving it.
- `reveal.test.mjs` — Reveal's bar, closing it, and its start.
- `autosave.test.mjs` — one Save, then every change saves itself; Save a copy;
  the Resume slot; failed saves.
- `switching-guides.test.mjs` — nothing carried over or lost when another guide
  or picture opens.
- `two-tabs.test.mjs` — two tabs sharing storage and guides.
- `storage-full.test.mjs` — full or blocked storage says so and keeps nothing.
- `unreadable-data.test.mjs` — bad saved data costs only what is bad, and Home's
  note about it.
- `lost-guides.test.mjs` — stored guides missing from the Library are offered
  back.
- `guide-files.test.mjs` — broken or hostile guide files are turned away.
- `backup.test.mjs` — making a backup (share sheet or download) and the
  reminder.
- `restore.test.mjs` — restoring markers, palettes and guides, and what it says.
- `welcome.test.mjs` — the first run.
- `home.test.mjs` — Home's names, tiles and one card at a time.
- `install-and-offline.test.mjs` — Add to Home Screen, the install prompt,
  persistent storage, bundled fonts.
- `library.test.mjs` — rows, renaming, names, progress, delete by keyboard, the
  Library picture.
- `markers.test.mjs` — the Markers screen and the marker sheet.
- `palette.test.mjs` — the Palette screen and the guide's Generate palette,
  the new sizes, and the "two colours are close" note.
- `random-and-blend.test.mjs` — Random keeps touching sections clearly
  different (checked against its own adjacency), neighbours across thick
  lines, and Blend's Mix (Soft · Vivid · Like paint), saved and undone.
- `gradient.test.mjs` — Look (Auto · Smooth · Light to dark) and Mood (Any ·
  Bright · Soft · Pastel · Deep · Earthy): saved, undone, set by Surprise; old
  guides open with their markers; Shuffle on a loop, a ramp and a saved palette.
- `match.test.mjs` — Match a colour from a photo, a hex code and the camera.
- `to-buy.test.mjs` — the To buy list from every suggestion, and ink (low, dry).
- `brand-letters.test.mjs` — brand letters on screen and in exports.
- `help.test.mjs` — How it works, the help sheet, What's new.
- `print.test.mjs` — the Print sheet's options and the PDF pages.
- `share-export.test.mjs` — guide files, images and PDFs: share sheet on a
  phone, download on a computer.
- `swatch-chart.test.mjs` — the printable swatch chart.
- `speed.test.mjs` — partial redraws match a full redraw; big photos are kept at
  working size.
- `text-size.test.mjs` — text follows the phone's text size without clipping or
  sideways scroll.
- `buttons.test.mjs` — one button height and 44px tap areas.
- `keyboard-and-screen-readers.test.mjs` — focus, Tab, Ctrl+Z and what screen
  readers hear.
- `escape-stack-guide.test.mjs` — Escape closes the guide's layers one at a
  time, and focus goes back.
- `escape-stack-shell.test.mjs` — Escape closes one dialog at a time, focus goes
  back, and Tab stays in the top dialog.
- `toasts-and-errors.test.mjs` — where toasts and error messages show and go.
- `wording.test.mjs` — one word per idea, and small wording.

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

- **Trademarks & colour data.** "Ohuhu" and "Copic" are trademarks of their
  respective owners; this project is not affiliated with or endorsed by them.
  Marker names, codes, and colour values are included only so the tool can match
  against markers people own.
- **Sample image.** The jellyfish line art (`src/assets/sample-jellyfish.png`)
  was drawn by the author and is covered by this repo's licence.
- **Marker sets.** The set lists (`OHUHU_SETS` in `src/js/events.js`) were
  checked against Ohuhu's official colour charts and copic.jp's set pages in
  September 2026. Colourless
  blenders that come in the box are not listed; they aren't colours.

## Licence

All rights reserved: the code is published to be read, not reused. See
[LICENSE](LICENSE). The fonts keep their SIL Open Font License, and the 31
Lucide icons (some derived from Feather) their ISC and MIT licences
(`src/assets/icons/LICENSE-Lucide-Feather.txt`).
