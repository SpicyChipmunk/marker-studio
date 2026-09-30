# Fresh-eyes review (v259)

Six independent reviewers covered the whole app from different angles:

- bugs in the app shell (collection, palettes, Match, Library, backups, offline);
- bugs in the guide pipeline (photo, straightening, sections, saving and opening);
- bugs in the guide view (drawing, gestures, focus mode, Reveal, PDF, share);
- UI/UX, by driving the real app at 390, 360, landscape and desktop sizes, using Ben's photos;
- feature completeness;
- code quality.

Every bug below was reproduced in a browser before it was fixed. Each fix has a regression test, in `e2e/review3.test.mjs` or `e2e/straighten.test.mjs`.

## 1. Bugs fixed in v259

**Could lose or corrupt work**

- **A guide could be saved with scrambled colours.** This happened after going ← Sections and then re-detecting, rotating, tilting, cropping or straightening, and then opening something else. The app now refuses to save a guide whose sections changed underneath it. The last version from before going back is kept in the autosave.
- **Opening a guide lost its progress in one case.** If a new photo had been left unbuilt, opening a saved guide and pressing Build wiped all its progress.
- **Undo after an accidental re-detect didn't fully undo.** Build afterwards dropped progress, pins, flat sections and part-done tones.
- **Splitting or adding a section threw away part-done shading tones.**
- **Manual colours landed on unrelated shapes.** After a re-detect, they were carried over by section number.
- **Renaming a guide wasn't saved** unless you pressed Save.
- **A slow photo could replace the guide you'd just opened.** This happened when the photo finished loading after you had opened a guide from the Library.
- **Import added a broken guide to the Library** before finding out it couldn't open.
- **The Tilt slider and Apply crop with no box threw away section edits without asking.**
- **Reopening a photographed guide counted the paper margin as a section.**
- **Storage nearly full:**
  - opening Home tried to store a new thumbnail, failed, and every later save then failed too;
  - the failed thumbnail is now dropped quietly.

**Wrong or broken behaviour**

- **Reopening the open guide from the Library crashed** if the corner handles were open. With crop mode on, taps went nowhere.
- **Crop mode carried over into the next picture.**
- **Cancel in Adjust corners silently undid the straightening** and wiped section edits. Cancel now puts everything back exactly as it was.
- **Save PDF / Share image / Share card could do nothing on a phone.**
  - When the share sheet refused because the tap had "expired" while the file was being built, the error was swallowed.
  - Now a toast says "Your PDF is ready" with a Share button, and any other failure downloads the file.
- **The sun, the photo overlay and the sticky tabs were measured mid-animation.** They landed in the wrong place after full screen, focus mode or turning the phone.
- **Blend:**
  - a drag to pan added an anchor instead;
  - anchor dots showed in Reveal, the share card and the clip.
- **Right-click acted as a tap.** In Colour along it ticked the section.
- **Reveal problems:**
  - it played zoomed in if you were zoomed;
  - closing it just as it finished brought its bar back;
  - photo "rough matches" fading showed in it.
- **Guide controls:**
  - dragging the marker-count slider died if your finger paused;
  - keyboard focus was lost whenever the controls refreshed.
- **Find next did nothing at normal zoom.** It now zooms in and steps through the sections.
- **PDF page 1's subtitle and the share image's title ran off the edge** with long names.
- **Match a colour left the camera running** if you closed it while the camera was starting. Two quick starts leaked a stream.
- **Palette:**
  - Photo mode with no photo still let you save or export the previous palette, and showed it again after a reload;
  - Generate silently did nothing with too few markers; the button now says "Only 3 markers to choose from";
  - the Save button could get stuck on "Saved ✓".
- **Random draw: a Swap finishing after you removed a marker** replaced the wrong marker.
- **"Finish families" ignored the search box.**
- **Home didn't update** after restoring guides or renaming one in the Library.
- **Guide filters showed 0 for everything** before you'd added markers.
- **The page could be dragged sideways on Random and Palette** (the glow behind the swatch).
- **A "Detecting sections…" toast lingered** over a guide that was already built.
- **On the corner handles, Keep as is looked like the main button.**
- **Build guide stayed enabled with no sections.**

**Keyboard and screen reader**

- **Hidden toasts could still be tabbed to.** An invisible Undo could be triggered this way.
- **Focus jumped to nowhere after picking from the Library.**
- **Popovers, rows and buttons:**
  - the section colour picker now takes focus and closes with Escape;
  - rows in "Markers used" can be reached by keyboard;
  - "Clear" on the working-selection bar can be reached by keyboard;
  - palette locks announce whether they're on.

**Dead code removed:** unused bindings (`ownTools`, `unownWrap`, `cardCap`, `showMore`, `showFilters`, `pgInfo`), two leftover test hooks (`window.__noise`, `window.__speck`), and dead CSS (`.ocap`, `.orow`, `.sfshare`, `.hometitle`, `.homefoot`, the old `#onboard` rules).

## 2. UI/UX — decisions needed (ranked)

1. **Tapping a swatch in Markers removes it.**
   - It's the most common tap on that screen, it's destructive, the grid reflows, and there's no way to see a marker's details.
   - Proposal: a tap opens a small marker sheet (code, name, "In my collection" switch, "Find similar"), and removing happens there.
2. **Toasts sit over the controls you need at that moment** (Build guide, the Share tab). Proposal: show them at the top, under the header, or just above the sticky bar.
3. **Errors look like ordinary helper text** (bad files, bad hex codes). Proposal: use the existing amber warning card for every error, and keep it until the next action.
4. **Library rows are cramped.**
   - Names clip to "Compleme", and every generated palette is called "Complementary · Sep 27".
   - Tapping the name starts a rename instead of opening the item.
   - Proposal: tap anywhere opens it, a pencil renames it, the badge moves under the name, and palettes get generated names like guides do.
5. **The guide screen stacks a lot of chrome.** About 40% of a 390×844 screen is left for the controls. Proposal: shrink the pinned picture to a thumbnail once you scroll into Style/Display/Share, move "New or open" into a menu, and put the picture beside the controls in landscape.
6. **Changing one section's colour is hidden** behind Style → Colour pattern → Manual. Proposal: "Change colour" and "Pin" in the popup when you tap a section, and marker codes shown in the picker.
7. **Wording drifts for the same things:**
   - Add markers / Choose your sets / Add my markers;
   - Export / Download image / Share image;
   - Back up vs Backup;
   - "← Sections".
   Proposal: one word per idea, e.g. "Add markers", "Save image", "Download PDF", "Back up" (as the verb), "← Edit sections".
8. **Empty states disagree.** With no markers, Palette refuses to work but Guide quietly uses every marker. The "New or open" buttons are in a different order in two places.
9. **Colour-along rows are cryptic.** "◐ / Blends / 0/9" would read better as "0 of 9 done", with the tones spelled out once (highlight → base → shadow).
10. **Small but worth doing:**
    - zoom buttons are 38×32 (make them 44×44);
    - the accent colour's contrast is 4.35:1;
    - the Welcome set list hides that Copic sets exist below the fold;
    - "Split-comp" should be spelled out;
    - Letter/A4 belongs before Save PDF, not after it.

Kept deliberately (the reviewers called these out as good): Focus mode, the Welcome's three choices, Match a colour's "closer ones you could buy", the corner handles' note, the blend plan, the swatch card, Reveal, two-tap delete, and undo on marker removal.

## 3. Completeness — what's missing for the package to feel finished

Strongest parts:

- colouring along (Focus mode especially);
- automatic planning (sections, patterns, photo colours, shading);
- printing and sharing for showing off.

Ranked additions:

| # | Addition | Size |
|---|---|---|
| 1 | **iPhone safety.** Prompt Safari-tab users to Add to Home Screen, since Safari can clear a tab's storage after 7 days. Back up through the share sheet, not a hidden download. Remind anyone with a collection, not only after 2 guides. | S–M |
| 2 | **Undo on the guide screen.** Shuffle, Surprise, pattern and marker-count changes can't be undone today. Also add Undo toasts for Own all, Clear collection, Library delete and Reset progress. | M |
| 3 | **One save model.** Autosave into the Library entry, add "Save a copy", and show progress % in the Library. Today there are two models (the autosave slot and Save). | S–M |
| 4 | **Planning realistic colours by hand.** Paint by dragging in Manual, replace a marker everywhere, recent markers, and names in the picker. | M |
| 5 | **Print for real markers.** Light-grey or small labels, number labels (1–N), a "key and reference only" print, more paper sizes, and a default paper size from the locale. | S–M |
| 6 | **Help.** A three-card "how it works", tips for photographing a page, a glossary (section, pin, blend, H/B/S), About/privacy/feedback, and what's new. | S–M |
| 7 | **Swatch calibration.** A printable swatch chart of your collection, and an optional per-marker colour correction. | M |
| 8 | **One shopping list** gathering every "you could buy" suggestion. Mark markers dry or low so guides skip them. | S–M |
| 9 | **Text size that follows the phone's setting,** and a light theme. | M |
| 10 | **More brands,** by moving brands and sets into data and allowing a custom marker. | L |

Small items: self-host the fonts (works offline on the first launch, and nothing goes to Google), and a global "something went wrong" toast.

Could be cut or merged:

- Random draw mode, a leftover from the original picker.
- The duplicate photo palette and harmony generator: the Palette tab vs the guide.
- Four versions of "lighter/darker companions".
- The Display tab: fold it into Style.
- The four "Unowned order" modes: merge into one "Suggested next buys".

## 4. Code — current state and a cleanup plan

**Current state**

- About 500 KB of source on only about 2,800 lines, averaging 182 characters per line.
  - 24% of lines are over 200 characters.
  - 128 functions are written on a single line.
  - `renderControls` would be 1,132 lines if formatted.
- The guide is one closure with 207 shared variables. 85 of them are written from two or more files.
- 83 of 98 `try` blocks have empty catches.
- Duplicated helpers:
  - colour conversion (3–4 copies each);
  - image loading (4 paths);
  - "tap again to confirm" (5 copies);
  - filter chips (2 copies).
- Tests are strong for the guide maker (96 browser tests, 83 unit tests). They are thin for the Palette and Markers screens.

**Plan.** Each step leaves behaviour unchanged and is checked by the tests and by a fingerprint of the minified output.

1. Pin a formatter and linter, and add the fingerprint script.
2. Make each file parse on its own. This means moving the closure's opening and closing into the template.
3. Format all JS/CSS mechanically; this was checked to produce byte-identical minified output. Then choose one of:
   - **(a)** ship the formatted source: about +18 KB gzipped, and no build tools needed;
   - **(b)** add a whitespace minifier to the build: −13 KB gzipped against today, but it adds a dev dependency.
4. Rewrite `00-state.js` with one variable per line, grouped by topic, with a note of which files write each one.
5. Lint. Gate on undefined, unused and redeclared names first.
6. Remove the remaining dead code. Replace tests of the unused `nearest()` with tests of the real palette generator.
7. Extend v259's single `resetForNewPicture()` to cover everything.
8. Add small shared helpers: `on(id, event, fn)`, `armConfirm`, one set of colour conversions, one image loader, constants for storage keys and timeouts.
9. Split the biggest functions: `renderControls` per tab, then `openDesignObj`, `chrome`, `buildPDFPages`.
10. Move the 174 inline styles into CSS classes.
11. Error reporting instead of silent catches. Use `esc()` instead of stripping `<>` from names.
12. Test hygiene: replace fixed sleeps with state checks, and add Palette/Markers tests.

Steps 1–4 give most of the readability for about a day of work.
