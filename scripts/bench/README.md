# The guide benchmark (stage A: finding the sections; stage B: colouring them)

How well the app finds a colouring page's sections, measured on synthetic pages whose right answer is known exactly.
It runs the app's own code headless (`test/harness.mjs` on the built `index.html`), so build first.

```
npm run build
npm run bench:quick      # one size, no JPEG, one photo per set: about 5 minutes the first time, 1 after
npm run bench            # everything, 356 runs: 10-15 minutes the first time (pages, photos cached), 5 after
node scripts/bench/run.mjs --only t02,h02 --pics      # some pages, with pictures of every run
node scripts/bench/run.mjs --photos-only --only h17   # the photo rows alone (the page finder's gate)
node scripts/bench/run.mjs --compare                  # against bench/baseline.json, row by row
node scripts/bench/run.mjs --baseline                 # write bench/baseline.json from this run
npm run bench:colour     # stage B: ~9,900 builds on the pages' true sections, ~8 minutes (--quick: seconds)
```

Outputs (report.md, results.json, pictures, the page cache) go to `$BENCH_OUT`, else `<tmp>/marker-studio-bench`,
never into the repo. Chromium (Playwright, a dev dependency) draws the text in the app's own two fonts and does the
JPEG; nothing else needs it. The numbers are a pure function of the code: the same build gives the same digest.

## What is measured

- **Pages** (`pages.mjs`): 19 TUNE and 19 HELD pages in 12 families (neurographic edge to edge and with a margin,
  mandalas plain and framed with text, zentangle, botanical fine line, cartoon, tessellation, mosaic, doodles with a
  title and watermark, wave bands, stained glass, partly coloured). HELD's seeds and parameters both differ. Fixes are
  tried on TUNE and checked on HELD; the two are reported side by side, never pooled.
- **Paths**: a download or scan at widths 400/600/800/1200/2400 through the app's own size rules (enlarged to 1600 on
  the long side when smaller, held to 2400); Sensitivity 9 and 6; downloads saved as JPEG; photos on a table
  (straightened through the app's own pgFind / pgShapeOf / pgWarp, with and without the lens; and the photo as taken,
  where findPage has to find the page).
- **Truth** (`lib/design.mjs`): what the artist drew, closed as paper closes it; render-only marks (hatching, text,
  faint stray marks, specks, the gaps a pen leaves) are not in it. Near-tangent places are flagged and never counted
  as defects.
- **Classes** (`lib/score.mjs`), bucketed by Ben's answers:
  1. edge shapes are part of the drawing; only the paper margin is background;
  2. long faint lines that separate shapes are boundaries; isolated faint marks are ignored;
  3. a hatched patch is one section, letter holes aren't sections, each cell of a pattern fill is;
  4. on a partly coloured page the coloured shapes stay sections, marked done;
  5. paper inside a frame is background;
  6. neurographic pages round every junction.

Merges are attributed to the hazard whose pair they are, spurious sections to where they sit, and the warnings
(Ignore faint, hatched, coloured) are checked against the hazards they are meant to catch.

## Files

`run.mjs` (the runner), `pages.mjs` (the sets), `lib/raster.mjs` and `lib/styles.mjs` (drawing),
`lib/design.mjs` (truth, sizes), `lib/build.mjs` (pages, text, colouring in, the cache), `lib/photo.mjs` (photos),
`lib/app.mjs` (the app headless), `lib/score.mjs`, `lib/report.mjs`, `lib/png.mjs` (pictures),
`lib/browser.mjs` (Chromium). `bench/baseline.json` holds the numbers of the last accepted run; `bench/weights.json`
how often each kind of page and hazard is met, for ranking what to fix.

## Stage B, step 3: colouring (`colour.mjs`, `lib/colour.mjs`, `lib/colour-report.mjs`)

The app's own builds on each page's TRUE sections (so finding errors don't leak in), Math.random seeded, in five
collections (a large two-brand set like Ben's: Honolulu 320 + Copic Sketch 72 A and B; Honolulu 320, 120, 24;
Ciao 12): the Gradient's five shapes × looks Auto / Limited × Scatter 0 / 2,
moods and limits; Random mixed, "keep touching sections clearly different", Balance, No repeats, moods, limits;
Blend's three mixes. Each family is judged by what it is for: gates (deterministic; Random never gives sections the
app sees touching the same marker or twins; noAdj leaves no touching pair under ΔE 10; the Gradient makes no twins at
the neutral mood), and measures (rough steps and the flow's smoothness for the Gradient, close pairs and Balance's
shares for Random, mood adherence against what the pool allows, evenness). Touching is measured as the eye sees it
(across a line, every row and column) and as the app sees it. Stability: a fresh lay after one section is left out,
and the app's real edit path (split a section, build with the guide kept). One end-to-end row per page on the app's
own sections. The A/B pair list for session 1 (Gradient rough steps) goes to DIR/ab/. Numbers in
bench/colour-baseline.json.

## Steps 4 and 5: the printed set and the side-by-side comparisons

- `print.mjs` writes `DIR/print/marker-studio-test-pages.pdf`: 8 Letter sheets, each a bench page inside four
  registration squares (5 mm, a 2 mm white hole) with a page code along the bottom, and each sheet's truth.
- `photos.mjs --in <folder>` scores photos of the printed sheets: the squares register each photo to its sheet
  without the app's finder, the code says which sheet, then the app's photo path runs as in stage A (lens from the
  photo's EXIF, without it, and as taken). `--selftest` runs the same on stand-in photos made here. Photos are read
  where they are; nothing of them enters the repo.
- `ab.mjs` renders both guides of every pair in the A/B list (colour.mjs) and writes `DIR/ab/session1.html`, a page to
  publish as an artifact: blind (sides drawn at random, settings and measures hidden), answers kept in its own store.
