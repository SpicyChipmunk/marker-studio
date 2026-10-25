# Plan: a colouring page from any photo (v325)

Status: decided and pressure-tested (October 2026); **v325 built stages 0–3 and 5** (Focus fixed on Even), **v325.1
stage 4** (Focus). Every
decision below was walked through one at a time; the spike that informs it ran outside the app, in Python, on 17 of the
author's photos (kept out of the repo). What the build changed or settled is under "As built (v325)" at the end.

## What it is

Any photo (a cat, a rose, a sunset) becomes a guide: the app draws a page of closed sections from the photo, each
section given one of your markers by the photo's own colours, then it's a guide like any other (Plan, Colour along,
Focus mode, Print). Paint-by-numbers, made from your markers.

The spike first tried an ML line-drawing model (Informative Drawings, MIT): it draws open strokes, not closed shapes,
and closing them broke the drawing, so a page from it couldn't be used in the app. Classic paint-by-numbers (group the
colours, split into areas, merge those too small or narrow to colour) gave closed sections on all 17 photos.

## The decisions

1. **Engine: classic, with an optional Focus.** One control, **Focus: Even / Sharper subject / Sharper subject, simpler
   background**. Even is classic and the default; the other two use a subject finder (U²-Net small, `u2netp`, 4.7 MB,
   Apache 2.0), downloaded the first time either is chosen, behind a consent card like the photo reader's (with ONNX
   Runtime Web, 14 MB, if the reader hasn't brought it already). Offline: it says so and stays on Even. SAM was tried
   and left out (stray straight lines, 100 MB, 20–25 s).
   - Focus **does not** keep the section count: it moves detail within Detail's limits (finer on the subject, never
     under the step's smallest width; coarser behind it for Simpler background). Forcing the count put the cormorant's
     waves back (194 → 188 sections: a subject in one dark marker can't take more). Measured at Medium: Sharper subject
     0 to +33% sections, Simpler background −40% to +10%.
2. **Detail: five steps** on a stepped slider (snaps; re-makes the page on release, not while dragging; the step's name
   beside it). Each step is a smallest section width on the printed page and a ceiling:

   | Step | Smallest section | At most about | Markers, at most (default) |
   |---|---|---|---|
   | Very simple | 6 mm | 60 sections | 12 |
   | Simple | 4 mm | 120 | 18 |
   | Medium (default) | 3 mm | 220 | 24 |
   | Detailed | 2 mm | 400 | 36 |
   | Very detailed | 1.5 mm | 700 | 48 |

   Under it: "This page: 95 sections, 18 markers" ("(set by you)" when Markers in this guide was moved). The ceilings
   are tuned on the bench; each step must give at least as many sections as the one before (the spike once gave 218
   then 204).
3. **The way in:** a link on Home's start card and the Guide screen's ("Or make a colouring page from any photo"; on
   iPad beside the PDF link: "Any other photo? Make a colouring page"), and an offer in the warnings a photo gets when
   opened the usual way ("looks like a photo", "couldn't find distinct sections", "looks coloured in already"): "Make a
   colouring page from it instead". The wording that says "photo" for a photo of a colouring page changes: "New guide
   from a colouring page", "Choose a colouring page". No fourth Home card (on a phone it sits alone on a second row,
   and it's an action among places).
4. **The plan colours from the photo**, and the page is **built in your markers' colours**: the photo is grouped by the
   markers that cover it best, so two touching sections never share a marker (15–58% of sections would have, with the
   full Ohuhu range; 43–75% with 36 markers), and Detail's counts are true of the page you get. The plan is the page
   builder's own ("as made"), not the Photo pattern sampling again. The page step says it's made for your markers
   ("Made for your 36 markers").
   - **How many markers:** the photo suggests it, with the Photo pattern's own "About N markers get as close as all
     your markers can", run on the photo before the page is made, and the same choice of which markers; Detail caps it
     (table above); **a hand-set Markers in this guide always wins**. The app chooses until you move the slider. All
     stays at the top of the slider (tested: 50–80 markers and up to four times the sections, likeness better by
     0.2–0.9 ΔE, under what the eye sees; near-twins side by side). Likeness levels off at 14–18 markers; gradients
     (a sunset) are where more markers show.
   - **Near-white** areas (white paws, bright sky) closer to the paper than to any marker are left white (Leave white).
   - **Small collections:** when few markers suit the photo, a note says so ("Only 3 of your markers suit this photo")
     with a choice to build from the full Ohuhu range, the missing markers going to To buy.
5. **The printed page:** light grey lines (about 0.3 mm, 60% grey) by default, so they all but go under the colour,
   with a **Darker lines** tick-box in the Print sheet for photo-made pages only. The page is made for the paper size
   set in Print (Letter, or A4 by default); a smaller paper chosen after says "Some sections are under 2 mm on Half
   Letter. Remake page for Half Letter?". The photo itself is printed small by the key, as a reference.

**After Build:** Detail and Focus live on the page step. Changing them after Build is **Remake page**, which asks first
if sections were edited or ticked; so do the hints when the collection, Markers in this guide or the paper size change
("Remake page for 12 markers?"). Nothing is remade by itself after Build. A remake is **one Undo step** (ticks and
edits come back with it; the old page is kept until Undo moves past it).

## How the pieces interact (pressure-tested)

- **Detail × markers:** both raise the section count (12 → 30 markers: +5–60% at the same step). Detail's caps keep the
  simple steps simple; the ceiling keeps the top steps finishable; the count line shows what came out.
- **Detail × Focus:** Focus can't take the subject under the step's width; at Very detailed the subject is at the width
  already, so Sharper subject does least there and most in the middle steps.
- **Focus × your markers:** the subject only gains sections where it has different marker colours; with 12 markers
  Focus barely changes a page (51 / 54 / 52). The count line shows it, and the small-collection note explains why.
- **Markers in this guide after Build:** the page was merged for the markers it was made with; fewer markers later can
  make same-marker neighbours again, and merged sections can't come apart: the Remake hint.
- **Other patterns:** Random, Gradient and the rest still work on a photo-made page, over its fewer, larger sections.

## Known limits (say them in Help)

- Eyes, whiskers and other small features are smoothed away at every step: a cat is a cat-shaped patchwork, not a
  portrait.
- Busy backgrounds (waves, leaves) become many small sections on Even; that's what Simpler background is for.
- A pale subject on a pale ground (the Siamese on a grey rug) loses some of its outline.

## Risks, biggest first

1. **Speed in the browser.** Mostly retired by the last pressure test: the spike's mean-shift smoothing was 80% of its
   time (2.3–3.3 s) and isn't needed. Three bilateral passes give the same pages (same counts within 10%, the same
   likeness) in 0.14 s; the rest of the builder took 0.6–0.8 s. The browser may be 2–5× slower than that, and the
   smoothing is done once per photo and kept, so a Detail or Focus change redoes only the grouping and merging.
   Measured in stage 0 before anything is built on it.
2. **iPad memory**: the working copy (900 px), label maps at the guide's size, and Undo. A Remake keeps the old page's
   section map (about 17 MB at 2400 × 1800) for Undo, so Undo keeps the last **two** remakes; older ones are dropped.
3. **ONNX Runtime Web and `u2netp`** (v325.x): the model has to run on the wasm backend with one thread (GitHub Pages
   can't isolate the page); checked in stage 0 on Chromium and WebKit against the spike's output.
4. **Same result every time**: the marker choice and grouping are seeded, so the same photo and settings give the same
   page (tests, Undo, Remake, a guide reopened).
5. **Test photos**: the author's 17 photos stay out of the repo. Tests use made-up scenes (shapes, gradients,
   texture and noise, made by a script in the repo) for the invariants; the 17 photos are the quality bench, run
   locally only.

## How a photo-made guide fits the app

- **Sections in the app's own form**: the builder's areas become a section map at the guide's size, with a line two
  pixels wide between sections (labelled as lines, as a photographed page's ink is). Everything after (label points,
  smooth outlines, Colour along, Focus mode, Edit sections, Save image, the PDF) works unchanged.
- **The picture under the guide** is the page the builder drew (paper and lines); the photo is the Photo pattern's
  reference, the same size, so it lines up exactly.
- **Crop and turn the photo first**: the page step offers the existing Crop and Turn on the photo before the page is
  made (the bananas photo wants its window cropped off). Straighten page, Enhance and Sensitivity don't apply and are
  hidden for photo-made guides.
- **Codes at the fine steps**: sections too small for their code are already handled (left off, with the note and the
  Numbers choice); at Very detailed that will be many, which Colour along and the key cover.

## Stage 0: the gates, run here and on GitHub (nothing needed from the author)

The builder is written as the real module (stage 1's first part, not a throwaway), then:

1. **Speed**: a bench script (`e2e/ci-photo-page.mjs`, like `ci-photo-timing.mjs`) opens made-up 12-megapixel photos
   in the app and times each step (smoothing, marker choice, grouping, merging, the section map) at all five Detail
   steps, in Chromium, Chromium slowed 4× (the stand-in for a slower device the project used for v324's Build
   pauses), and WebKit; and on GitHub's WebKit as a diagnostic step of the run, like Photo timing. Gate: Medium in
   5 s or less at 4×, a Detail change in 3 s or less, the screen never busy for more than 100 ms (the work is in the
   worker). Over that, a smaller working size comes first.
2. **Memory**: the builder's buffers counted as it goes (the largest held at once), against a 300 MB budget.
3. **The warnings' offer**: today's page reading run on the 17 photos (locally): how many get a warning, and how
   colourful the picture read (`srcColour`, which the "coloured in already" check uses). If too few photos get a
   warning, the offer also shows for a colourful picture with no warning.
4. **`u2netp`** (for v325.x): run on ONNX Runtime Web in Chromium and WebKit, its mask compared with the spike's and
   timed.

The author's iPad isn't a gate: the release's DEVICE-TEST gets a timing line, and the time a page took goes into Copy
diagnostics, so beta testers' reports carry it.

## Build stages

0. **Gates**, as above.
1. **Region builder** (`guide/47-photo-page.js`, worker job `ppage`): smoothing (kept per photo), the marker choice (the
   Photo pattern's suggestion code, on a few hundred of the photo's colours), grouping by marker, areas, merges (too
   small, too narrow, same marker), the ceiling, steps in order, near-white, the section map with its lines.
2. **Into the guide**: a photo-made guide (its photo, Detail, Focus, marker count, paper size kept with it, saved,
   exported and imported), the plan as made, Remake page as one Undo step (two kept), the hints, Crop and Turn first.
3. **Screens**: the links and the warnings' offer, the new wording, the page step (Detail slider, the count line, Made
   for your N markers, the small-collection note and To buy).
4. **Focus** (v325.x): `vendor/subject/1/` (README with sizes, hashes and licences, as `vendor/ocr/`), its own cache,
   the consent card, offline, the Focus control on the page step.
5. **Print**: light lines and Darker lines, the page made for the paper, the reference photo by the key.
6. **Tests and docs**: unit tests for the builder (same page each time, steps in order, widths, ceilings, no
   same-marker neighbours, near-white, lines between all sections), browser tests on both engines, the bench; Help
   (with the limits above), What's new, CHANGES, DEVICE-TEST, TESTERS.

The split: **v325** stages 0–3 and 5 (Focus fixed on Even), **v325.x** stage 4.

## As built (v325)

- **The marker choice runs in the page's job**, in the worker, with the page (`ppPickCore`, using the Photo pattern's
  own `_photoChoose`), on at most 500 of the photo's colours (bins of 3 L\*a\*b\* units, wider until there are 500 or
  fewer). Stage 0 found it on the page's thread at first: 4 000 colours and the Photo pattern's swaps held the screen
  2–5 s on every Detail change. Now a Detail change holds it 30–100 ms (putting the new page in place and drawing it).
- **Stage 0, measured** (`e2e/ci-photo-page.mjs`, a made-up 12-megapixel photo; GitHub's WebKit runs it as a
  diagnostic): Chromium here, the first page (Medium) in 2.5 s, a Detail change in 1.0–1.8 s; slowed 4×, 5.2–5.7 s and
  1.3–2.5 s; WebKit here 3.4 s and 1.2–2.0 s. The first page holds the screen about 0.3 s once (reading the photo, as
  any photo, and getting it ready: 0.14 s). Medium at 4× is just over its 5 s gate; Chromium's slow-down may not reach
  the worker, so the iPad's own time is a DEVICE-TEST line and goes into Copy diagnostics. The working size stays 900:
  at 750 Very detailed's 1.5 mm would be under 3 working pixels, about the smoothing's own scale. Memory, counted
  (the typed arrays, which Chromium's heap figure leaves out): about 90 MB on the page for a 2000 × 1500 page (the
  photo at working size, the section map, the canvas and its picture, the Photo pattern's copy) and about 50 MB more in
  the worker while it works (three maps at the guide's size), under the 300 MB budget.
- **The warnings' offer (gate 3)**: 10 of the 17 photos got one of the warnings named above, 2 the hatching warning and
  5 none. A colourful picture (`srcColour` 0.2 or more: a photo's 0.05–0.53, 18 colouring pages' 0.00, the author's
  partly coloured drawings with no warning up to 0.14) is offered it in the hatching warning, or in a line of its own
  ("Is this a photo rather than a colouring page?"): 13 of the 17 photos, no colouring page.
- **Undo** keeps remakes within Edit sections' own budget (25 steps, 64 MB), the same as a turn or crop of a
  photographed page, rather than a cap of two: a remake's step is the section map packed (about 2–4 MB at 2000 ×
  1500), so the budget holds a dozen or more.
- **The plan as made** while Markers in this guide is the count it was made for and the markers it may use are the
  same; a section split or added by Edit sections since takes the page's own marker nearest the photo under it, so an
  edit doesn't choose every marker afresh. Otherwise the Photo pattern chooses afresh, and the Pattern tab offers
  **Remake page for N markers**.
- **The photo by the key** is beside the coloured reference (under it when the reference is beside the key), never
  over it, and only ever making the reference smaller, so the key fits as it did.
- **The way in, with a guide open:** Home's link under New guide from a colouring page (the start card's is for no
  guide in progress). Not in the guide's ⋯ menu, as Open a PDF is: a ninth line made the menu scroll under the picture
  on an iPad held upright, and Open a PDF is there because a phone had no other way; this has Home's.
- **Focus (v325.1, gate 4):** `u2netp` on ONNX Runtime Web (the wasm backend, one thread) gives the spike's map
  (correlation 1.000 on three of the author's photos; the subject at 0.5 the same within 0.2–1% of the photo), in
  2.3–2.6 s in Chromium and about 4 s in WebKit here, starting ONNX Runtime included, in a worker of its own ended after.
  On a Medium page: Sharper subject +3% to +42% sections, Simpler background −36% to +34% (a big subject takes more
  than the background gives back).

