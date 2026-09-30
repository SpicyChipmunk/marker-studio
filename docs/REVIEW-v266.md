# Fresh-eyes review (v266)

Five independent reviewers went over v265: the guide screen, the app shell, the guide pipeline and saved data, UX/UI/accessibility, and code quality. Every bug was reproduced in a browser before it was fixed.

The fixes were made in four groups, each with regression tests that fail on v265:

- `e2e/review5-guide.test.mjs`
- `e2e/review5-data.test.mjs`
- `e2e/review5-shell.test.mjs`
- `e2e/review5-cleanup.test.mjs`
- `test/review5.test.mjs`

Nothing here could be tested in Safari; the device checklist covers what needs a real iPhone or iPad.

## 1. Fixed: could lose or corrupt work

- **Rebuilding a reopened guide could drop sections and their ticks.** Opening a guide worked out its background with the wrong trim, so ← Edit sections → Build lost sections even with nothing changed.
- **A Photo-pattern photo that finished loading late recoloured a different guide** that had been opened in the meantime, and saved it.
- **Two tabs on the same guide overwrote each other's progress.** A tab with nothing unsaved now reloads the other's save. A tab with its own changes merges the other's ticks and tones, and says so once.
- **A new guide in a second tab could be lost through the shared Resume slot.** The slot now records which tab owns it.
- **Sensitivity and Enhance wiped progress without asking.** They now ask, like rotating and cropping, and can be undone.
- **Section edits on a saved guide were never saved while the header said "Saved".** The status now says "Section edits not saved — Build guide to keep them". Opening something else asks Build / Discard / Cancel, and on page hide the edits are kept in the Resume slot. A different new guide can't overwrite them: they move to the Library as "(section edits)".
- **A saved Photo guide lost its photo** if a change was saved before the photo had decoded.
- **A small hostile guide file crashed the tab,** on import and again from the Library. Guides are now capped at 100,000 sections.
- **Restoring a backup:**
  - A restore with full storage said "Restored" but saved nothing, and marked the data as backed up. It now rolls back and says so.
  - A backup with no markers offered to empty your collection. It now just merges palettes and guides.
  - Broken guides in a backup were added and counted as restored. They're now checked like imports and reported, and duplicates are reported as "already here".
- **Undo didn't bring back part-done tones** after Change colour, Everywhere, Paint, Unpin or Fill.
- **Smaller data fixes:**
  - "Fill unpinned" recoloured sections already ticked done.
  - A section taken out and brought back lost its pin.
  - Back up left out the unsaved guide in the Resume slot.
  - "Use in a guide" and Library rename weren't rolled back when storage was full.
  - Unknown marker codes were counted but never shown; renamed codes are now mapped.
  - The copy of unreadable data was never deleted, so it could double the app's storage use.

## 2. Fixed: broken or wrong

**Guide screen**
- **Finishing a page** said "Tap Reveal & share", but that button was scrolled off the screen. The Page complete banner now comes into view.
- **Zoom, rotation and resizing:**
  - Zoomed in, rotating or resizing left a blank strip.
  - Rotating into landscape didn't pin the picture.
- **The screen wake lock** was lost after leaving the Guide tab and coming back to Colour along.
- **Toasts and sheets:**
  - Toasts sat over open sheets, and their Undo closed the sheet and dropped the colour you'd picked.
  - On iPad, sheets were wider than the guide card.
- **Keys and controls:**
  - Ctrl+Z did nothing in Edit sections.
  - Full screen was a dead button while cropping.
  - Leaving Focus mode closed the marker row you had open.
- **Duplicate messages:** crop and straightening repeated their instructions as toasts.
- **Text and size:** 5-character codes were cut to "YR1…" in the picker at large text, and Reveal & share wrapped at large text.
- **Accessibility:**
  - The Save pill and the ⓘ lines had taps under 44px.
  - Symbols were read aloud by screen readers.
  - Focus was lost after the Welcome's Try the sample.
- **Where shared files go:** the guide file, PDF, image and swatch chart now go to the share sheet on phones and download on computers, the same as the backup. Share › Guide file no longer does nothing when the share sheet refuses.

**Rest of the app**
- **Palette:**
  - The name overlapped the codes (badly at large text).
  - Save looked enabled while disabled, and Reset was enabled with nothing to reset.
  - The photo palette showed no size selected.
- **Home:**
  - The tiles left one orphaned at large text.
  - "Back up now" gave no confirmation and lost focus.
  - Names starting with "Guide" were replaced.
- **Match:** "Hex code" and "Camera" wrapped or broke mid-word, and "+ To buy" squeezed names to one letter.
- **The Welcome:**
  - Its buttons were below the fold on landscape or large text; they're now pinned.
  - The brand switch didn't match other switches.
  - Its file picker didn't accept `.txt`.
- **Markers:**
  - The heading always said "Matches".
  - "Own all shown" is now "Tick all shown".
  - Keyboard users weren't told Shift+F10 opens details.
  - The selected view wasn't announced.
- **The unreadable-data note** now says what was lost, with Restore a backup when everything was.
- **Smaller fixes:**
  - The top tabs got 44px taps.
  - "Bought ✓" gave the wrong message.
  - Toasts were half the screen width.
  - Error cards vanished mid-tap and could close their dialog.
  - Library caption and empty-state wording.
  - A few labels.

## 3. Code

- **One `handOver()`** replaces five separate share-or-download implementations. The "ready — Share" retry lives only there.
- **The one-time hint helpers** are shared by the guide and Markers.
- **Dead code and duplicate CSS removed:** 20 needless checks, two wrappers, unused variables and ids, and duplicate rules and keyframes.
- **Tests:**
  - The straighten test no longer flakes.
  - The "is gone" checks describe behaviour.
  - About 30 fixed waits became waits for the result.
- **Lint** is still 0.

## 4. Decisions for Ben (ranked)

All nine were settled and built in v267 (see `CHANGES.md`); for #9 Ben chose (a), with a minifier possible later.

1. **Brand letters when you own both brands.** Today a list that happens to be all one brand shows no letters, even when you own both. Example: Match's results come back all Copic, so "R16" there is ambiguous. **Recommend:** show letters when the view mixes brands *or* your collection does (the full range in demo mode). They'd be hidden only when everything in play is one brand. Exports stay as decided.
2. **Undo toasts in the guide.** The tool row already has ↶ Undo, which says what it will undo; the toasts repeat it and get in the way. **Recommend:** only show an Undo toast for actions without a visible Undo, such as Reset progress, Clear ticks and Library delete.
3. **Reset progress** clears every tick with only a short Undo toast. **Recommend** asking first when more than about 10 sections are ticked.
4. **Zoom carries over between stages** (Plan → Colour along → Edit sections), up to 8×. **Recommend** starting each stage at normal size.
5. **Colour along's first-time instructions** leave about one row visible on short phones (none at large text). **Recommend** capping them at two lines with "More".
6. **Keyboard access to sections on the picture.** The picture can't be focused, so keyboard users can't open Change colour or Pin. **Recommend** saying so in Help now, and later adding arrow keys to step through sections.
7. **Home: install card vs Back up.** On an iPhone in Safari, the install card comes back every 7 days and always outranks Back up. **Recommend** letting Back up come first when a guide isn't in any backup.
8. **Find lost guides.** If the Library list itself is ever lost, the guides' data is still stored in the browser but nothing points to it. **Recommend** a "Find lost guides" step in Help › Your data that relinks them.
9. **Code formatting.** Formatting the source mechanically (cleanup plan steps 2–3) makes future work much safer to review. The options:
   - (a) ship the formatted source, about +18 KB gzipped;
   - (b) add a minifier to the build (smaller than today, one more dev tool);
   - (c) not yet.

   **Recommend (b).**

## 5. Known limits (not bugs)

- **Two tabs on the same guide:** progress is merged by adding ticks together, so a tick you clear in one tab comes back if the other tab still has it.
- **Blocked storage:** Save and the failure messages point to Share › Guide file, but opening something else can still say "Saved to your Library" when only part of the browser's storage is blocked.
