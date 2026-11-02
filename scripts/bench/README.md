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

## The photo-to-page bench (`pp-*.mjs`, `pp_*.py`, `lib/pp.mjs`)

How well the photo-to-page builder (47-photo-page.js) follows real objects, on about 900 Open Images photos with every
object outlined (validation and test splits; CC BY 2.0 photos, CC BY 4.0 outlines; measuring only, never in the repo or
the app). Ben's PC fetches them once (`tools/subject-train/bench-photos.bat`); everything else runs here, outside the repo
(`--cache`), on the built index.html.

```
node scripts/bench/pp-prep.mjs --in <bench-photos> --out <cache>       # the app's own working pictures (Chromium)
python3 -I scripts/bench/pp_maps.py <cache> [model.onnx] [--tag name]   # subject maps as the app makes them
python3 -I scripts/bench/pp_masks.py <bench-photos> <cache>             # outlines at the guide's size
node scripts/bench/pp-mapcheck.mjs --in <bench-photos> --cache <cache> --ids <a few stressing photos>
# a baseline per set, from today's checkout (built); then each candidate from its own checkout, its own tag:
node scripts/bench/pp-bench.mjs --cache <cache> --photos <bench-photos> --set TUNE --tag base-TUNE --workers 2
node scripts/bench/pp-bench.mjs ... --set TUNE --tag <idea>-TUNE --compare base-TUNE
node scripts/bench/pp-bench.mjs ... --set TUNE --n 100 --seed <idea> --modes even --tag <idea>-q   # a quick look
node scripts/bench/pp-bench.mjs --cache <cache> --photos <bench-photos> --set HELD --tag base-HELD   # (today's)
node scripts/bench/pp-bench.mjs ... --set HELD --tag <idea>-HELD --compare base-HELD     # judged once: runs/LOG.md
node scripts/bench/pp-bench.mjs ... --set TUNE --n 60 --seed time --time --b <candidate checkout>   # build time
node scripts/bench/pp-ab.mjs --cache <cache> --photos <bench-photos> --b <candidate checkout> [--own-cache <c>] --out ab.html
node scripts/bench/pp-ab.mjs --score <answers.txt> --key <cache>/ab-key-ab.json                  # decision 99
```

A run folder (`<cache>/runs/<tag>`) belongs to the build and settings in its head.json: a tag made by another build or
other settings is refused, and the default tag carries the build. A comparison needs the same set, steps, modes, pool
(its colours too) and map (its model's SHA-256) as its baseline, refuses when a part of the app the bench copies has
changed (the step table, Focus settings, ppJobData/ppChoose/ppSig/ppCap, subMap's sampling, ppPrepare) and reports the
live ones that did (ppMmPx, ppFocusTargets, subMapUp); and neither run may fail the same-page-twice check or be partial.
pp_maps.py refuses a map tag made with another model; pp-prep.mjs records its ppPrepare and refuses to add to a cache
made by another. Each build gets its own pid: ppBuildCore's smoothing cache is kept by pid.

For experiments (FINDINGS-AP): `--x k=v,k=v` passes settings to the candidate's builder as `job.x` (the bench's job is a
frozen copy of ppJobData, so settings must come this way; they're in the tag and the head); `--accept-drift <slice>`
for a deliberate change to a slice the bench copies, made with lib/pp.mjs's copy updated in the same commit;
`--expect-same` fails unless every page equals the baseline's (the proof a change does nothing where it shouldn't);
`--compare a,b` compares with a (the gate) and b (attribution) from one run; a subset run (`--n`) compares with a
full-set baseline photo by photo, and a baseline's modes need only be among the run's. A HELD or FINAL run shows only
differences, never levels, unless `--show-levels`. pp-ab.mjs takes `--mode sharp|calm` (Focus-ready photos with a map)
and `--x` for the candidate. The verdict (decisions 109, 110, 112): better or worse only when the whole 95% interval is
more than 0.1 point beyond 0; each mode judged against the first baseline that has it, then one line across the modes;
any kind of photo worse by more than 1 point is named for Ben to look at before a HELD look. Measures also count stubs
(line beside fewer than two sections) and same-marker pairs (two touching sections with one marker).

Sets: TUNE (used freely), HELD (each finished change judged once), FINAL (once, before shipping), by the value of a hash
of each photo's id (a photo never moves between sets when the checks or numbers change). Rows: each Detail step (0-4)
for Even, Sharper subject and Simpler background (Focus rows only on photos with no big un-outlined object or stray
person outside the outlined boxes, step 4's rule). Measures: spill (the share of each object in sections that also
cover its outside), edge-following (the object's outline within 1 and 2 mm of a line on the printed page, leaving out
the outline within 1 mm of the photo's edge), both on objects big enough for the step; likeness (ΔE00 of each working
pixel to its section's marker), sections, line share, slivers, fiddly sections, median and largest section, slit pixels,
lines on the photo's edges, sections under the fragment size (today's builder leaves a few specks: a guard against
more, not none), wobble; Focus: the map against the outlines and sections near the 0.5 cut. A photo with no object big
enough has no spill or edge-following for that step and counts for the guards only. The rule and guards: pp-bench.mjs
`judge()`. The blind file's verdict (pp-ab `--score`): decision 99's 2:1 or 20 of 30, on 10 preferences or more and a
one-sided sign test under 0.1. A full set (300 photos, 15 rows) takes about 2 hours here on two workers.
