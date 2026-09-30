# Fresh-eyes review (v264)

Five independent reviewers went through v263 after the guide screen was rebuilt:

- the guide screen;
- the app shell;
- the guide pipeline and saved data;
- UX, UI and accessibility, by actually using the app at phone, landscape, iPad and desktop sizes and at 1.3× and 1.6× text;
- code quality.

Every bug was reproduced in a browser before it was fixed. The fixes were made in four groups and each has a regression test:

- `e2e/review4-guide.test.mjs` (22 tests)
- `e2e/review4-data.test.mjs` (17 tests)
- `e2e/review4-shell.test.mjs` (21 tests)
- `test/review4.test.mjs` (6 unit tests)

Nothing here could be tested in Safari; the device checklist covers what needs a real iPhone or iPad.

## 1. Fixed: could lose or corrupt work

- **A second tab wiped Library entries.** Each tab now picks up the other's saves, and every save merges Library entries by id. Deletes are tracked per tab, so another tab can't empty a guide during its 6-second Undo.
- **Straightening a built guide wiped its progress.** Rotating, tilting, cropping, auto-cropping or straightening wiped ticks, pins, flat sections and part-done tones with no warning. It now asks first and keeps one Undo step that brings everything back.
- **Mark all done could clear ticks.** Tapping "✓ Mark all done" twice cleared all that marker's ticks, because the button becomes "Clear ticks" in the same place. The second tap is now ignored, and Clear ticks has an Undo.
- **Turning shading off turned part-done tones into "done"**, and Undo didn't bring them back. Now fixed.
- **Rebuilding a Random guide re-rolled every section,** coloured ones included. Rebuilding now keeps every existing section's marker, in every pattern.
- **The unsaved guide waiting behind the Resume card could be lost.** Starting a new guide overwrote it, and the card's Dismiss deleted it. Dismiss now only hides the card. Before a new guide replaces it, the old one is kept in the Library with a toast.
- **Changes made while a photo or guide was loading were dropped.**
- **A dry marker permanently rewrote saved guides,** done sections included. With every owned marker dry, a guide opened empty and the next change saved it empty. Substitutes are now only shown on screen until you change that section.
- **Restoring a backup of the open guide was undone** by the stale copy still on screen.
- **A failed first Save followed by opening something else** lost the guide silently.
- **Storage-full failures were hidden.** Palette Save said "Saved ✓", and ticking a marker showed the "storage full" message and then immediately an Undo toast. Both now roll back and say what happened.
- **One bad field in saved data threw away the whole collection.** A marker number out of range also half-started the app, leaving Match, Help and the welcome dead. Each field is now checked on its own, the original is copied aside first, and the three start-up scripts can no longer take each other down.
- **Smaller data fixes:**
  - The Photo pattern's photo was lost after switching pattern.
  - Import added broken guides to the Library.
  - A Split stroke that divided nothing left a permanent line.
  - The Library thumbnail could become the section editor's tints.
  - Back up missed the last second of changes.
  - Restoring twice made duplicate copies.
  - Settings leaked from the previous guide.
  - Unpin did nothing after reopening a guide.
  - Paint and the screen wake lock stayed on after opening something else.

## 2. Fixed: broken or wrong

**Guide screen**
- **After leaving the Guide tab and coming back,** the tabs pinned underneath the picture.
- **On short phones and at larger text,** the pinned tool row covered the bottom bar's buttons.
- **Colour along opened with its list below the screen,** and every stage change kept the old scroll position.
- **Closing a colour sheet lost keyboard focus.** Focus mode also wasn't modal for keyboard users.
- **The header changed height** after Surprise, rename or Save, which moved everything below it on Safari. It is now fixed-height.
- **Renaming:**
  - Escape while renaming was swallowed by an open tip.
  - The ⋯ menu showed the old name.
- **Double actions:**
  - One Escape could close a dialog and exit full screen at the same time.
  - Ctrl+Z undid changes behind an open sheet.
- **A press-and-hold in Colour along** could open a different row.
- **While a picker was open,** auto-save stored the unconfirmed colour.
- **Wording and small fixes:**
  - "1 markers".
  - The status text was cut mid-number.
  - Surprise squeezed the name at large text.
  - The Edit sections controls were shown twice.
  - Crop moved the page.
  - The bar sat 1px off the bottom.
  - Focus mode's zoom buttons were nearly invisible on pale pictures.

**App shell**
- **Photo palette, custom slots and Seed** ignored the "all markers" mode and dry markers.
- **Match a colour:**
  - It kept a stale hex error.
  - It ignored 3-digit hex codes.
  - It failed silently on an unreadable photo.
- **"Use in a guide" → Cancel** still saved a palette.
- **Backup:**
  - Backup failures from the Home reminder were silent.
  - The reminder nagged straight after a restore.
  - Restore asked "Replace your markers (0)…".
- **Blocked storage** was reported as "storage full" and skipped the welcome.
- **Toasts** followed you to other screens.
- **Library delete** couldn't be undone from the keyboard.
- **Names** lost `<` and `>` on Home.
- **Taps under 44px:** See all, Add markers, dialog ✕, toast Undo, and the + chips.
- **Help** had three names; it's now "Help" everywhere.
- **Small layout and labelling fixes:**
  - Low-contrast counts.
  - The unlabelled search box.
  - Clipped Match labels at large text.
  - The Palette code line running off the card.
- **The installed app** now checks for updates whenever it comes back into view.

## 3. Code

- **Dead code removed:** the functions, CSS and element ids left over from v260–v263, and 29 unused test hooks.
- **Lint** is at 0 errors and 0 warnings (from 216 errors and 125 warnings). The deliberate empty `catch` blocks are allowed by the lint config.
- **Duplicates merged:** one `openLibrary()`, and one block of CSS for the section tip.
- **Tests:** eight fixed waits in the auto-save tests now flush instead of sleeping, and stale names were fixed.
- **Still to do from the v259 cleanup plan** (all done by v268; see `CHANGES.md`):
  - Move the closure's opening and closing lines into the template, then format everything mechanically.
  - Rewrite `00-state.js` with one variable per line.
  - Build shared helpers: one dialog stack with one Escape handler, and one field list for a guide's style.
  - Split `renderControls` per tab.
  - Move inline styles into CSS.
  - Replace fixed sleeps in tests.
  - Name test files by feature rather than by release.

## 4. Decisions for Ben (ranked)

1. **Button heights across the app.** The global `button{height:54px}` rule gives Markers, Palette and Library buttons 44–54px, while the guide now uses 44px for actions and 40px for choices. Options:
   - (a) 44px everywhere;
   - (b) 44px standard and 52px for main calls to action;
   - (c) keep as is.

   **Recommend (b).**
2. **Home cards stacking.** Resume, What's new, Add to Home Screen and Back up can all show at once; on a small phone the backup card ends up far down. **Recommend** at most one prompt at a time, in the order Resume → Back up → Install → What's new.
3. **What's new stays until ✕ is tapped.** **Recommend** it disappears after it has been seen once, or after 7 days.
4. **Restore replaces all palettes.** So recovering your markers loses palettes saved since the backup. **Recommend** merging palettes by id and replacing only the markers, or offering Merge / Replace.
5. **One name for the shopping list.** Today it appears as the "To buy (4)" tab, a "Shopping list" heading, "+ List" in Match, "Add all to list", and "your shopping list" in toasts. **Recommend** "To buy" for the tab and heading and "+ To buy" on buttons, or "Shopping list" throughout.
6. **Brand badges "O" / "C"** on swatches are cryptic, and "O" reads like a zero. **Recommend** showing them only when both brands are in your collection.
7. **Random draw** (🎲 on Markers) is a leftover from the original picker. **Recommend** moving it off the main Markers row, into ⋯ or a Palette option.
8. **Palette screen vs the guide** both generate harmony palettes. Decide together with #5 whether Palette stays the one generator.
9. **Unreadable saved data** is now copied to a backup key before it's repaired, but nothing tells you. **Recommend** a one-time note: "Some saved settings couldn't be read and were reset; a copy was kept."
10. **Welcome's "Restore a backup"** opens the backup dialog with Back up as the main button. **Recommend** opening it with Restore first.
11. **Raised again: tapping a marker in Markers unticks it.** Release 1 settled this: it unticks in place with Undo, and press-and-hold shows details. I'd leave it.

## 5. Checked and working

- **Guide screen:** the picture sizes and shrink at eight screen sizes, tabs that never jump, sheet placement, tapping on to the next section while picking a colour, the Print summary, and Colour along's rows, press-and-hold and Done group.
- **Touch:** drag to scroll, pinch, and moving a zoomed-in picture.
- **Returning to the page:** Full screen, Focus mode and Reveal all come back to the same scroll position.
- **Saved data:** saving, reloading and reopening a guide loses nothing, backup → restore onto a fresh profile is exact, and 19 kinds of malformed import open safely.
- **Odd photos**, from 1×1 to 16000×400, don't crash anything.
- **Print:** the page count shown before printing matches the real PDF for every paper size and option.
- **Offline:** the app, fonts and icons load offline.
