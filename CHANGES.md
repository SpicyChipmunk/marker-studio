# Changes — v234 (review fixes)

The data-loss, security and main UI bugs were reproduced in headless Chromium against v233 and re-checked after the fix. The robustness items were found in code review.

**Data loss / correctness**
- Collection edits to 34 markers were silently reverted on every launch: the one-time migration flags (`copicAdd1`, `libAdj1`) were never saved, so they re-ran each load (re-adding 20 Copics + 12 Ohuhus and removing Copic E09/E21). Flags now persist.
- Emptying your collection reset it to the built-in default on the next launch. An empty collection now stays empty; the default applies only to a brand-new install.
- Colouring progress in normal (non-focus) colour mode never marked the guide as changed, so the Home "Resume your last session?" card didn't appear and unsaved progress was effectively lost. Taps and Reset progress now mark it dirty, and the autosave is flushed when the app is backgrounded or closed.
- Guides using **Generate palette** saved their palette as `[]` (keys were treated as indices). Reopening then re-coloured with a different random palette on the next tweak. Now saved and restored as marker keys.

**Security**
- Importing a shared guide file, a guides backup, or a pasted collection backup could run script (unescaped `id`, `thumb` and name attributes in Library/Home). Entries are now sanitised on import and on load, and rendered through `esc()` / `safeThumb()`.

**UI bugs**
- Home → "Import a guide" did nothing until the Guide tab had been opened once. It now has its own file input.
- Library and Home thumbnails for imported/restored guides were drawn from the raw label-map PNG (dark red noise). They are now rendered in the guide's actual colours.
- Library showed a guide's *section* count as "markers" (e.g. "168 markers" for an 8-marker guide), and the Markers sort used it. It now shows "8 markers · 168 sections".
- Library caption showed literal `’` / `—`.
- Deleting from the Library was instant and permanent (guides are removed from IndexedDB). It now asks for a second tap ("Delete?"), matching the other destructive actions.
- The export card still said "OHUHU HONOLULU B · 320" and "Marker picker · Honolulu B 320", and showed codes without a brand, which is ambiguous because Ohuhu and Copic share codes like B04. It is now branded Marker Studio and shows the brand on each row/tile. Filenames are `marker-studio-*.png`. "Copy codes" prefixes the brand when the list mixes brands.
- Brand All/None in the main filters didn't regenerate the palette the way every other filter does.
- Escape now closes the top-most overlay.

**Robustness**
- Undo after split/merge now drops the adjacency/texture caches built from the edited label map.
- Guide files missing `W`/`H` fall back to the label-map image size.
- The service worker no longer caches error responses (404/500) permanently. Cache bumped to `marker-studio-v234`.

**Tests**
- New `test/fixes.test.mjs` (6 tests; 5 fail on v233, all pass now). Harness gains `createApp(overrides)` + `memoryStorage()` for relaunch-style persistence tests. The seam exposes `genPal`.

# Changes — v235 (design pass)

**First run & defaults**
- New installs start with an **empty collection** instead of the author's personal one. Existing installs keep their collection, and very old (pre-v2) saved state still migrates as before.
- One welcome flow replaces the two back-to-back pop-ups. Step 1 is a set picker ("Tick the sets you have"), with "I'll do this later" and "Restore a backup". Step 2 offers "Try the sample guide", "Make a guide from my photo" or "Look around first".
- With no markers yet, the Guide tab runs in **demo mode** on the full Ohuhu + Copic range, with a clear "add yours" link. Palette and Draw show a "No markers yet → Add my markers" card, and the Home Markers card is highlighted with "Set up your markers".
- The Guide now defaults to **16 markers** instead of every marker you own.
- "Reset to default" in the set picker became "Clear collection", since the default is now empty.

**Guide screen**
- The picture stays **pinned** at the top while you scroll the controls (about 40–44% of the screen height on phones).
- Controls are in **tabs**: Colours, Style, Display and Share. Save and export actions live together under Share.
- A sticky bottom bar: Review has **Build guide**. Guide has **← Sections, Save, Colour along**. Colour mode has **Done, Save, Focus mode**.
- Desktop (≥900px) uses a two-column layout: the picture on the left, the controls on the right.
- **Labels** are placed at the most "inside" point of each section and shrink to fit it. Before, they sat at the centroid, which can fall outside the section (for example a C-shape). Print and PDF use the same placement with a larger minimum size. Canvas text uses Hanken Grotesk; before it asked for Inter, which was never loaded.
- **Tap a section** in the guide to see its marker: code, name and brand.
- Fixed: the name dice (⚄) did nothing in guide mode because it was never wired up.
- Fixed: opening a saved guide reused the previous image's texture/edge data (stale shading, and black pixels if the new image was larger).

**Editing & findability**
- **Split and Add work while zoomed in**: one finger draws, two fingers pinch and pan together. On desktop, ctrl/⌘ + scroll (or a trackpad pinch) zooms at the pointer, and scrolling pans once zoomed.
- "Add a set you own" appears in **every** Markers view, and each set shows how much of it you already own (✓ 24, or 12/24). It sits collapsed at the bottom next to "Back up collection". When the collection is empty it moves to the top and opens automatically.
- One name everywhere: **Library** (was also "View saved guides" and "Saved guides").

**Durability & accessibility**
- After the first guide save, the app asks the browser to keep its storage (`navigator.storage.persist()`).
- A Home reminder appears when you have 2 or more guides that have changed since your last backup and it's been over 14 days (Later snoozes it for 7 days). The Library shows "Last guide backup … · N not in a backup".
- Keyboard: swatches, palette bands, lock toggles, Library rows and the filter bar are focusable and work with Enter/Space. Pop-ups are dialogs: focus moves in, Tab stays inside, and Esc returns focus to where you were. There's a visible focus ring, labels on icon-only buttons (zoom, delete, blend, name dice, swatches), and `aria-current` on the section tabs.
- Scroll padding keeps focused controls clear of the pinned picture and the bottom bar.
- Service worker cache bumped to `marker-studio-v235`.

# Changes — v236 (guide screen polish + print)

- **Surprise me** moved out of the Colours tab. It now sits under the guide name, since it changes both colours and style. After it runs, a one-line note says what it picked, e.g. "Split-comp palette · Serpentine · Vivid · 10 markers".
- **Share tab** grouped into three sections:
  - Show it off: Reveal & share, Share image
  - Print: Save PDF, Letter/A4, and "Include blend companions", moved here from Display
  - Plan & keep: Blend plan, Save as palette, and one Guide file button (share or download)

  Paper size and the companions choice are remembered.
- **PDF export rebuilt** at print resolution (200 dpi) on real Letter or A4 pages:
  - Page 1 is the colouring page: the outline with marker codes, scaled to fill the page.
  - Page 2 is the colour key: a coloured preview, then a table grouped by colour family (swatch · brand · code · full name · sections).
  - With blend companions, it adds Lighter and Darker columns. Shades you don't own are marked "buy", and a "To complete every blend" list follows.
  - The preview grows to use spare room when the whole key fits on page 2. Long keys continue onto extra pages with the column headings repeated. Every page has a footer with page numbers.
- **Share image** key no longer overflows between columns; names are shortened to fit.
- **Pinned picture no longer changes size while scrolling on phones.** It's sized from the stable viewport height (`svh`), and only recalculates when the width changes (e.g. rotating the phone). On phones the address bar showing and hiding changed the height and resized the picture.
- Service worker cache bumped to `marker-studio-v236`.
