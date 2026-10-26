# v327.1 — build plan for the review's decisions (docs/REVIEW-v327.md)

Decided with the author, October 2026, one at a time. Built now: 2, 3, 4 (draft wording), 5a-5c, 6, and 7a's trial
(outside the app). Waiting: 1 (the paper test; three Test strip PDFs sent), and with it 4's final words. Nothing for
8. Already on the branch: the shading lists' chevron on a phone, the key's "— not needed", a duplicate test seam.

## Order, and why

1. **6, one marker never both highlight and shadow** (45-shading `_ptChoose`): the smallest, and the only one that
   changes what the page says; first, so the measurements and tests after it see the final engine.
2. **5, the wording** (5a, 5b, 5c): text only, but it ripples into tests; before 4, whose line sits beside them.
3. **3, no routine message on the page step**.
4. **2, the Home button** (three places).
5. **4, the Shade it offer** (the most new code; last, on a settled base).
6. Tests, Help, What's new, docs, version; then the two debugging passes.
7. **7a's trial**, in the scratchpad (no app code): can run alongside 6.

## 6. One marker never both a section's highlight and its shadow

- `_ptChoose`'s `pairOf`: the shadow chosen from the candidates without the highlight chosen (as the experiment
  measured: 3 of 11 photos had any, 1-11 sections; 0 to −0.2). Two tone sets' pairs come from `pairOf` too.
- The markers added: their ranking looks at highlights and shadows separately; a marker that would only help as a
  shadow where it's already the highlight just ranks a little high. Harmless (the 1% rule still decides); noted.
- Held tones (a section with ink) keep what they were coloured with, even if an older guide had one marker as both.
- Test (unit, `test/photo-tones.test.mjs`): a scene whose best shadow is its best highlight: the shadow is another.

## 5. Wording

- **5a** (51-controls-plan, `#sfShEven`): "Shaded from the photo: N sections. M stay flat: tones wouldn't make them
  much closer to it." N: sections with photo tones (`ptGet().tone` not null), M: `nFlat`; singulars ("1 section",
  "1 stays"). Shown while photo tones are on, as now; N = 0 says "No section is shaded from the photo: tones
  wouldn't make any much closer to it." (Never seen in 34 runs, but possible.)
- **5b** (47-photo-page `ppHelpBody`): the match line by the pool, from `ppMadeFor()`, capitalised, its verb agreeing:
  "Your 392 markers match 97% of this photo." / "The full Ohuhu range matches …" (ranges: "match") / "Your palette's
  12 markers match …". `ppMadeFor()` learns the markers added by Try it with these: "your 36 markers and the 3 added"
  (it counted them in: "your 39 markers"), which the page step's "Made for …" line shows too. Use up to 48's line:
  "Some of this photo's colours aren't on the page: the page's 24 markers can't cover them all. Use up to 48
  markers".
- **5c** "From the photo" (45-shading's two label maps): the lists, the Undo wording (`planWhy`, from the maps), the
  tip; Help (the Shading glossary entry, twice); What's new's v327 line where it names it. Comments may keep the old
  name. Saved guides store the kind (`'photo'`), so nothing old changes.
- Tests: `photo-page-2` (two `Your markers match` regexes), `photo-tones` (the flat line, the Use up to 48 line).

## 3. No routine message on the page step

- `note()` (20-image-input) writes the guide's meta line and shows a toast. The page step's two calls of the routine
  line (47-photo-page: the first page, and a remake without edits) go through a quiet form: the meta line as now, no
  toast. Kept as toasts: `ppSaid()` (no clear subject; the subject finder not stored), "Page made again — tap Undo…",
  errors (which note() turns into cards anyway).
- `sayLive` still announces the page. No test reads that toast (checked).

## 2. A button for photo pages on Home

Three places, the same words, `data-start="ppage"` kept (its handlers and the tests' selectors stay):

- **Home's start area, phone layout and a guide in progress** (app.html `#homePPage`): from an underlined link to an
  outlined button, "Make a colouring page from any photo", full width under `#homeNew`; the line above (`.homesub`):
  "Turn a colouring page, or any photo, into a marker-by-number guide, built from the markers you own."
- **Home's hero card** (library.js, the iPad's): the same button straight under "Choose a colouring page", ahead of
  "or try the sample" and the PDF link (both stay links); its heading: "Turn a colouring page, or any photo, into a
  marker-by-number guide".
- **The Guide screen's start card** (95-mount `#sfStPp`): the same button in place of "Any other photo? Make a
  colouring page from it".
- How it works, step 1: "Photograph a page. Or open a PDF, or start from any photo." Help's Pictures line names the
  button.
- Checked at 390, 820 and 1180 wide, with and without a guide in progress, large text on: the button wraps to two
  lines rather than clipping; Home's cards move down about 40 px on a phone (the tester tasks row was below the fold
  already).
- Tests: `test/markers.test.mjs`'s Home markup check; e2e `home`/`home-2`/`shell` where they read the link (most use
  `[data-start="ppage"]`); one new e2e: the button at phone and iPad sizes opens the photo picker.

## 4. The Shade it offer

- **When:** a photo-made page's Build in this session (`markBuilt` with `ppOn()`), shading Off, nothing ticked, not
  the demo. A session flag on the guide (`_ppShadeOffer`), never saved: a reload, the Library, Remake page or another
  guide never show it.
- **Where:** in the queue under the tabs (51-controls-plan `ctlPlanHead`), after the held, pinned and low-marker
  lines and before the first-time tap line; while it shows, the tap line waits (one line at a time, as the queue's
  rule), coming back once the offer is gone.
- **Words (draft, final after decision 1):** "Shade it like the photo? A lighter and a darker tone in many sections,
  from the photo's own light. **Shade it** · ✕ (Not now)".
- **Shade it:** one Undo step (as tapping Photo is: `planUndo`'s step, then `ptStyleApply`), Shading opened,
  `renderControls` and `renderGuide`, and a toast "Shaded like the photo" with Undo. The offer goes, and Undo
  doesn't bring it back.
- **Gone** on Shade it, ✕, the first tick or step (`hasProgress()`), a remake, a new picture or guide opened.
- **Pressure points:** zones (Photo shades the zones on the Photo pattern only, as tapping it does); a small
  collection (it may add up to 4 markers, which the key's "+ N for shading" says, as now); the time Shade it takes
  (the same as tapping Photo: 0.4-0.9 s in the test browser, on the tap, not at Build).
- Tests (e2e `photo-tones`): shown after Build of a photo page and not of a colouring page; Shade it applies Photo,
  opens Shading, Undo takes it back and the offer stays gone; ✕ hides it; a tick hides it; reopened from the
  Library, not shown.

## 7a. "What's left?" trial (scratchpad, no app code)

- **Material:** the author's pair from v320 (a blank page and the same page coloured, photographed apart; kept in
  the scratchpad, never committed). A part-coloured page made from them: the blank photo laid into the coloured
  photo's own geometry (SIFT on the lines, as v320 did), and a known half of the sections taken from it, so it keeps
  the coloured photo's light and angle and the truth is known. Then the same with a real part-coloured photo from
  the author when there's one.
- **Steps, as the app would:** the guide from the blank page; the part-coloured photo found and straightened as Your
  page is (corners); laid over the guide (corners alone, then refined on the lines); each section read (its middle,
  away from the lines: lightness and colourfulness against the paper's own, from the photo's margins); coloured or
  not.
- **Measured:** how far the photo lines up (pixels off at the lines); sections right; the blank ones missed and the
  coloured ones called blank, by how pale their marker is (Y00 and light greys apart); time.
- **Bar to build it:** lines up within the line width on a straightened photo; 95% of sections right, apart from
  markers under L* 90 off the paper. Report either way.

## Tests, docs, release

- Unit: all, locally (`test/*.test.mjs`); e2e locally only what's touched: `photo-tones`, `photo-page`,
  `photo-page-2`, `home`, `home-2`, `shell`, in Chromium and WebKit; the rest on GitHub.
- Lint; Prettier on the changed `src/js` files.
- CHANGES (v327.1), What's new, Help (Pictures, Shading), DEVICE-TEST (the Home button on the iPad; the offer),
  REVIEW-v327's "As built".
- Version v327.1, cache `marker-studio-v327.1`; commit (no zz files, no photos); zip.
- Then a debugging pass with experienced eyes (the diff) and a fresh-eye one (the three sizes again, the printed
  key).

## Risks

1. **The offer and the first-time lines:** the queue's order is the risk (a photo page's first Build is where the tap
   line first shows too); tested both ways.
2. **Decision 1 can reword 4 and 5a:** words only, small rework.
3. **Home's markup is tested by text:** the tests move with it.
4. **Two buttons in the start card:** a newcomer with a photo of a colouring page might take the photo route; the page
   step shows the result straight away, and the colouring page button stays the filled, first one.

## As built

- **6** as planned; the unit test fails on v327's code (checked) and passes now.
- **5a:** with one section flat, "1 stays flat: tones wouldn't make it much closer to the photo." ("it … to it" read
  badly); the plural as decided. **5b:** `ppOwnN()` counts your own (or your palette's) markers for Made for.
- **3:** `note(m, quiet)`; `ppNote()` sends the routine line quietly, the rest (no clear subject, made again with
  edits, a one-colour photo) as toasts. The test fails on v327's behaviour (checked).
- **2:** the three places as planned (outlined: `homenew2`, `hcgo2`, `sfstpp`); with a guide in progress Home shows
  the outlined New guide and this button as a pair. Checked at 390, 820 and 1180 wide, with and without a guide.
- **4:** armed in the build (30-palette-assign) before the controls are drawn (armed after them, the first draw had
  missed it); offered in the demo too (no markers of your own yet: the page and its shading use the whole range),
  where the plan had copied the test strip line's "not the demo". One-at-a-time with the queue: the tap line and the
  test strip line wait for it.
- **7a trial** (scratchpad `wl/trial.py`, the author's v320 sample pair, 230 sections at the app's working size,
  half of the 228 coloured ones put back to paper, relit to the coloured photo's light): read against the paper's
  own light where each section is (a smooth surface fitted to the page's background), 100% right lined up, 99.6% at
  2 px off, 98% at 4 px, 89% at 8 px, 81% at 12 px (1 px here is about 0.23 mm on Letter); the 7 palest coloured
  sections (12-20 from the paper) found at up to 4 px. Reading is easy; **lining up is the work**: the bar (95%) needs
  the photo within about 4 px, which corners alone may not give on a curled sheet. Not yet tried: a real photo of a
  whole printed page, part-coloured (the author's), corners then a refinement on the lines; markers as pale as Y00
  (none on this page).
