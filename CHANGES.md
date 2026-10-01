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

# Changes — v237 (Match a colour)

- Rebuilt as a proper panel: solid card, a small ✕, and one short subtitle.
- **One source at a time:** a Photo · Camera · Hex code switch, plus Screen where the browser supports it. It opens on Photo. Camera and Screen only appear when the device supports them.
  - **Photo:** a "Choose a photo" area, then the photo (at most 44% of the screen height) with the sampling ring and a "Change photo" link.
  - **Camera:** starts when you pick the tab and stops when you leave it or close the panel. The live view has a fixed height. Freeze/Go live and Light sit over the bottom of the video, a LIVE/FROZEN badge in the corner, and Stop camera in the hint line. Sampling accounts for how the video is cropped to fit, so the ring samples exactly where it sits.
  - **Hex code:** a large colour picker next to a hex field.
- **Best match right under the source**, updating as you drag: a You | Marker split swatch, match quality ("Very close match"), code, name, brand and a Copy button.
- Below it: **Also in your collection** (the next 4) and **Closer ones you could buy** (read-only, only shown when they beat your best owned match). Tap any row to copy it; the ΔE number moved into a tooltip.
- A clear empty state, and a message when you have no markers yet.
- Service worker cache bumped to `marker-studio-v237`.

# Changes — v238 (fresh-eyes bug pass)

A three-part review (code, UI walkthrough, robustness) found the issues below. Each was reproduced in headless Chromium and re-checked after the fix.

**Data loss**
- **Resume never worked:** the autosave holds the label map under `payload`, but the Resume button passed the unflattened object, so it always failed with an invisible error. Now fixed, and a resumed guide stays marked unsaved so it can be resumed again.
- **Unsaved work was silently discarded** when you chose a new photo, loaded the sample or opened a Library guide. It's now saved to the Library first, with a toast. Re-opening the guide that's already open just returns to it.
- **Rebuilding a saved guide** (← Sections → Build guide) wiped its colouring progress and saved a duplicate. It now keeps the progress and the same Library entry.
- **A new photo after opening a saved guide** kept that guide's id, so Save would have overwritten it. A new photo now starts a new guide.
- **Storage full:** a failed guide save left a phantom Library entry that made every later save fail for the whole session. It now retries without the thumbnail, then rolls back cleanly and tells you. Any failed save shows a "storage is full" toast.

**Wrong results / broken features**
- **Style changes brought back excluded and too-small sections** (140 → 168). Guide mode now reuses the sections chosen at build time.
- **Guide status messages were invisible** once a photo was open ("Not enough sections", save and PDF errors, "replaced N markers"…). They now appear as a toast, and Save in colour mode confirms "Saved ✓".
- **Opening a saved guide inherited the previous photo's editing state:** Undo restored another image and crashed, and Rotate or Enhance replaced the guide. The editing state is now reset, and photo adjustments are hidden for guides opened from the Library.
- **Library palettes did nothing unless you were already in Palette,** and were cut to 8 colours. They now open in Palette at full length (up to 16).
- **Tapping empty space under a photo palette replaced it with a random harmony.**
- **Generate palette, Regenerate and Surprise me did nothing in demo mode** (no markers owned).
- **Match a colour showed stale results** after your collection changed, or after a camera error. The empty message now matches the selected source.
- **The Reveal bar could stay on screen after leaving the Guide.** The reveal clip is now recorded at most 1080px (it was the full canvas, e.g. 2400², at about 5 fps).
- **Restoring a guides backup reset every guide's date** and made them all look un-backed-up. Backups now include dates (with a file-level fallback for older backups).
- **Surprise me's gradient offset was always a no-op** (an integer seed).
- **The Library "PALETTE" badge stretched about 350px tall**: the badge class collided with the `.palette` component.
- **PDF:** a "to buy" list that spills onto a new page no longer draws table headers or loses its line position. Filenames are capped at 80 characters.
- **The quality warning called clean, dense line art "noisy"** (anything over about 2,000 sections). Fragments are now judged by absolute size.

**Robustness & polish**
- **Service worker:** installs now bypass the HTTP cache (`cache:'reload'`), so hosts that cache HTML (e.g. GitHub Pages' `max-age=600`) can't pin an old version. An "updated — Reload" toast appears when a new version takes over.
- **Faster label drawing:** cached text widths cut the biggest cost of building large guides.
- **Share image** ignores repeat taps while it renders.
- **Markers:** "Own/Un-own all shown" are disabled when nothing is shown, and an empty search says what it searched for.
- **Welcome:** skipping set-up no longer says "You're all set".
- **Dialogs on phones** no longer pop the keyboard by focusing a search box on open.
- Service worker cache bumped to `marker-studio-v238`.

# Changes — v239 (design pass 2)

1. **Guide screen space**
   - The pinned picture shrinks to a 132px strip once you scroll into the controls, and grows back when you scroll up or tap the strip.
   - Name, ⚄ and ✨ Surprise now share one row.
   - The picture takes 40% of the screen height (34% on short phones), and the bottom bar is a little shorter. On a 390×844 screen the tabs now sit above the bottom bar instead of under it.
2. **One primary button style:** solid accent purple for Build guide, Colour along (it keeps its shine but drops the rainbow, which made white text hard to read), Generate palette / Draw a marker, Use in a guide, Reveal & share and the welcome buttons.
3. **Dialogs are cards with a ✕ at the top right:** Library, Blend plan, Collection backup, Seed picker and Swatch card. The bottom "Close" buttons are gone.
4. **Markers**
   - "Random marker" and "Match a colour" sit side by side in one compact row.
   - One tap adds or removes a marker, with an **Undo** toast (replaces "tap twice to remove").
   - The Unowned order is a dropdown: Code order / Fill the biggest gaps / Smooth my ramps / Finish families.
5. **Fewer randomise buttons:** Surprise, the name dice, and one "↻ Shuffle" per style. For a generated palette, Shuffle also generates a new palette, replacing the separate "Regenerate" button.
6. **Lean-toward rows:** Hue/Saturation are kept, relabelled under "Within your filters, lean toward…" as **Temperature** (Cool · Warm · Any) and **Intensity** (Vivid · Soft · Any). A live count reads "Using 109 of 155 markers" and flags when there are too few markers for Intensity to change anything. For saved or generated palettes it explains that Intensity only applies with "Expand with nearby markers".
7. **Names and shortcuts**
   - Harmonies read Split-comp / Monochrome everywhere.
   - Home → "New colouring guide" opens the photo picker straight away.
   - "Use in a guide" shows a "Using “palette name”" banner (with ✕ to clear) on the guide start card, or a toast when it recolours an open guide.
8. **Tap targets:** zoom buttons are 44px, guide tabs 42px, the blend ◐ toggles 44px, and palette locks 30px with a 44px hit area.
9. **Collection backup:** leads with **Download backup** (now a .json file) and **Restore from file**, which asks before replacing your collection and confirms afterwards. The raw text sits behind "Show as text (copy / paste)".
- Service worker cache bumped to `marker-studio-v239`.

# Changes — v240 (guide names)

- **Rewrote the name generator.** The old one averaged every colour into a single hue, so teal + coral came out "Sage…", deep reds "Blush…", and navy + gold only "Azure…". It now reads the palette and picks a style:
  - **One colour family:** mood + colour, colour + vibe, or colour + place ("Candlelit Garnet", "Black Cherry Muse", "Plum Tide").
  - **Two families:** both colours ("Saffron & Sea Glass", "Marine-Kissed Gold", "Poppy & Turquoise").
  - **Wide spread:** a spectrum word ("Vermilion Confetti", "Kaleidoscope Temptation").
  - **Greys and neutrals:** neutral words ("Smoke & Pearl", "Midnight Onyx").
- **Colour words match how light or dark the colours are.** Deep reds get Garnet/Merlot/Oxblood, pale ones Blush/Rosé. Soft pastels still count as colour rather than grey.
- **Vocabulary grew from about 90 words to about 360**, keeping the sultry, luxe tone: Tryst, Rendezvous, Afterglow, Nightcap, Boudoir, Candlelit, Smoldering…
- **Names stay short and clean:** at most 24 characters, no repeated words. 1,500 random palettes produce more than 1,200 distinct names.
- **No duplicate names:** the ⚄ dice and auto-naming skip names already used by guides in your Library.
- New `test/names.test.mjs` (8 tests).
- Service worker cache bumped to `marker-studio-v240`.

# Changes — v241 (installable + device test)

- The app can now be installed. `index.html` already linked `manifest.webmanifest` and `icon-192.png`, but neither file existed (both returned 404), so Chrome offered only "Add shortcut" and iOS used a screenshot as the icon. Added the manifest and original 192/512 icons (three marker strokes on the app's dark background, kept inside the maskable safe zone). Headless Chromium now reports no installability errors and no 404s.
- Home shows the build number (e.g. `v241`) at the bottom, so you can tell which version a phone is running. A test keeps it in step with the service-worker cache name.
- New `docs/DEVICE-TEST.md`: a 15-minute pass for iPhone and Android.
- New `test/pwa.test.mjs` (3 tests).
- Cache bumped to `marker-studio-v241`.

# Changes — v242 (focus mode rebuilt, Home, pinned picture)

**Focus mode now goes one section at a time.** Before, it grouped nearby same-colour sections into "areas", and those chained together until each area was usually a whole colour (on the sample: 16 areas for 16 markers), so it never really zoomed in on anything.
- It zooms to a single section, outlined in yellow and centred between the top and bottom bars. Only that section shows its code; the colour's other open sections get a light tint.
- Order: markers light → dark (the usual alcohol-marker order), and within a marker from its top-most section to the nearest remaining one, so each step is a short glide.
- Bottom bar within thumb reach: **←** (back to where you just were), **✓ Done**, **Skip →**. Tapping the outlined section also ticks it off.
- Fixed: tapping any other section used to mark its whole group done, including sections of a different colour. It now just moves the outline there.
- Fixed: the smallest drag or pinch snapped the view back to the picture's edge, and pressing a zoom button could scroll the picture out from under the view. Panning is now free (the ⤢ button re-centres the target) and the view can't be scrolled by focus changes, which also affected the normal guide view.
- The top bar is one row (✕, marker swatch and name, "Section 3 of 9 · 42% of page", **Colours**) instead of ~35% of a portrait screen and ~85% of a landscape one. **Colours** opens a list to jump to another marker or "Mark all … done".
- Finishing zooms out to the whole picture in full colour with **Reveal & share** (the old screen still said "Now colouring … Undo" and Reveal wasn't reachable). The normal colour view's "Page complete!" banner gets the same button.
- Keyboard: → skip, ← back, Enter/Space done, Esc exit.
- Uses the full screen height on iOS Safari instead of `100vh`.

**Home.** Library is now a third card beside Markers and Palette, with a count ("3 saved"). "Pick up where you left off" has **See all →**. Import moved into the Library window as **Import a guide file**.

**Guide screen.** Removed the automatic shrink/grow of the pinned picture; it stays one size while you scroll.

- New `test/focus.test.mjs` (4 tests). Test seam exposes the focus order.
- Cache bumped to `marker-studio-v242`.

# Changes — v243 (source split, build, browser tests)

No change to how the app looks or behaves, apart from one small fix below. The shipped `index.html` is now built from `src/`; the first build was byte-for-byte identical to the hand-edited v242 file.

- **Source in `src/`**: the ~460 KB file is now about 45 files: styles by screen, markup, the app script by area, the guide screen in numbered slices, the marker table as JSON (one marker per line), and the sample picture as a real PNG (so it's easy to replace).
- **`npm run build`** writes `index.html` (no dependencies). `npm run dev` rebuilds on save. A unit test fails if `index.html` doesn't match `src/`.
- **Browser tests** (`npm run e2e`, Playwright): 16 tests over first run, Home and Library, both backups, building/saving/resuming/printing a guide, focus mode, and Match a colour (photo, hex, fake camera). They replace the one-off scripts used during the reviews. About 45 s.
- **GitHub Actions** runs the unit and browser tests on every push.
- Fix: in Match a colour, a typed hex code now matches as soon as it's 6 digits; before, nothing happened until you pressed Enter or left the field.
- `npm test` now runs only `test/*.test.mjs` (the harness is no longer counted as a test file). Needs Node 18+; the browser tests need `npm install` and `npx playwright install chromium` once.
- Cache bumped to `marker-studio-v243`.

# Changes — v244 (set lists, icon)

**Marker sets.** Four sets were one colour short. Checked against Ohuhu's official colour charts (ohuhu.com, Color Codes Index):
- Honolulu 120 was missing **BV38** (it's one of the 72 core colours).
- Honolulu 168 was missing **YR06** (from the 48 Sweetness pastels).
- Honolulu 216 was missing **R23** (from the 48 Mid-tones).
- 36 Skin Tones was missing **Y210**.
All other sets matched the charts. If you already added one of these sets (you own every other colour in it), the missing colour is added once, automatically. If you later remove it, it stays removed.
New `test/sets.test.mjs` checks counts and how the sets combine; two new tests in `fixes.test.mjs` cover the one-time top-up.

**More Copic sets.** Added the main Copic boxes, with codes from copic.jp's set pages: Ciao 12, Ciao 24, Ciao 72 Set A and Set B, Sketch 12, Sketch 24 Manga, Sketch 36, and Sketch 72 Sets A–E. The five Ciao 36 sets already listed match copic.jp exactly. A test checks that every Copic set finds exactly as many markers as its name says.

**App icon.** A new icon: six rainbow marker strokes side by side, overlapping slightly like layered ink, in one swoosh that tapers to a flick, on the app's dark violet background. Separate versions for Android (maskable, kept inside the safe zone) and iPhone (`apple-touch-icon.png`, 180 px). The page also has a favicon now. The icon is drawn by `scripts/make-icons.mjs`.

**Sample image.** Noted in the README that Ben drew the jellyfish, so it ships under the repo's licence.

- Cache bumped to `marker-studio-v244`.

# Changes — v245 (shading, stage 1)

Shading inside sections, as planned: **Style → Shading** (Off / Shadows / Light & shadow). Off by default.
- **Layered tones**, the way alcohol markers are used: the lighter marker covers the whole section, the base marker goes over the middle and the shadow, the darker marker only in the shadow. The picture shows a blended preview with faint dashed lines where each tone starts (**Display → Show where each tone goes**).
- **The sun**: drag the ☀ over the picture (or focus it and use the arrow keys). Each section's shadow falls on its side away from the sun. **Roundness** mixes flat directional light with rounded, darker edges.
- **Only markers you own.** A lighter/darker companion must be a clear step (not a huge jump) in the same colour family or a very close hue, so a pink is never shaded with a brown. With no darker match, the shadow is a **2nd coat** of the base marker; with no lighter match, the section starts at the base. In demo mode (no collection) it uses the whole catalogue.
- The note under the controls says how many colours fall back to a 2nd coat and lists same-brand markers that would make the shading richer. Nothing you don't own goes into the plan.
- Tap a section to see its tones (1 › 2 › 3). Very small sections and background-sized areas stay one flat colour.
- Saved with the guide (mode, sun position, roundness, tone lines). Reveal & share (the animation and its card) shows the shaded version; Share image, the PDF and Colour along stay flat for now (next stages).
- Tests: `test/shading.test.mjs` (7) and `e2e/shading.test.mjs` (3).
- Cache bumped to `marker-studio-v245`.

# Changes — v246 (shading, stage 2: print and share)

With shading on, what you print and share now carries the tones.
- **PDF, colouring page:** faint grey dashed lines where each tone starts, small circled numbers (2 for the base where there's a lighter tone, 3 for the shadow) in zones big enough to hold them, kept clear of the marker labels, and a small ☀ where the light comes from.
- **PDF, colour key:** a one-line how-to ("colour the whole section with 1, add 2 over the middle and the shadow, then 3 in the shadow…"); the reference picture is the shaded version; each colour lists its 1 lighter · 2 base · 3 darker markers, or "2nd coat of …" when you don't own a darker one. In Shadows mode the lighter column is left out. A "For richer shading, add N markers" list replaces the blend shopping list.
- The Share tab says the PDF follows the shading when it's on (the separate "blend companions" option only applies with shading off).
- **Share image:** shaded.
- Colour along and focus mode still use flat colours (stage 3).
- Tests: +1 unit test (printed tone numbers) and +1 browser test (PDF pages, share image, real download with shading on).
- Cache bumped to `marker-studio-v246`.

# Changes — v247 (shading, stage 3: colouring along)

Colour along and focus mode now follow the shading plan.
- **Order:** colour by colour (light to dark), and each section is finished before moving on — 1, then 2, then 3 while the ink is wet — so blends stay soft and you only have one colour's markers out. Colours whose shadow is a **2nd coat** do the base on every section first and the 2nd coat as a later pass, so the first coat has time to dry.
- **One tap per section** (default): the focus bar lists the section's tones ("1 E69 › 2 E713 › 3 R215"), the zoomed section shows its tone lines and small 2/3 numbers, and one **Done** finishes it. Reminders ride along in the bar: blend the shadow's edge while wet; big areas: work in patches; 2nd coat: is the first coat dry?
- **Step through each tone** (Focus → Colours): a tap per tone instead, with the outline around just that tone's part (the shadow for 3). The setting is remembered on the device.
- **Colour along list:** each colour shows its tones under it (the blend-companion toggle hides while shading is on); the "Now colouring" card shows them too.
- **Progress** stays one tick per section; a section part-way through its tones remembers which are done, and that's saved with the guide. Old guides and flat guides work as before.
- **Near-black colours get no shadow step** (nothing darker to add; a 2nd coat changes nothing). The PDF key says so.
- Tests: +3 unit tests and +1 browser test.
- Cache bumped to `marker-studio-v247`.

# Changes — v248 (fresh-eyes fixes: saved work, shading labels, long-press)

**Saved work** (all reproduced in a browser before fixing):
- Undo in the sections editor after building (then Build again) no longer wipes colouring progress; progress belongs to the guide, not the undo snapshot.
- Restore guides never overwrites a newer version of a guide: the backup's older copy comes back as "… (from backup)" and a message says so.
- If the open guide can't be saved (e.g. storage full), switching to another guide, photo or the sample is stopped and it stays open, with a message on what to do.
- Changing shading (mode, sun, roundness, tone lines) or the texture slider now counts as an unsaved change, so it's autosaved and offered on resume.
- Rebuilding keeps part-done tones and pinned colours that still exist.
- Switching shading off after part-doing a section no longer leaves it impossible to finish.
- Rebuilding a Manual-style guide respects merged, excluded and newly included sections.
- "Mark all done" clears part-done tones.
- A dropped storage connection is reopened instead of breaking every later save (can happen on iPhone after backgrounding).
- Opening a file that isn't a real guide is turned away before anything changes; a guide only takes over the "current guide" slot once it has fully opened; odd data in the resume card no longer throws.
- The sun follows the picture when the screen rotates.

**Shading labels**
- Tones are named by role, not number: **H** highlight (lighter marker) › **B** base (the section's marker) › **S** shadow (darker marker or 2nd coat), laid light to dark. No more "starts at 2" when there's no lighter marker.
- Printed pages and focus mode mark where the highlight shows (H) and where the shadow goes (S); the base is everything else.
- Focus mode's header shows the marker name first and its tones underneath; reminders appear less often.
- The H/S markers over a zoomed section are drawn on top of the picture, so they stay sharp at any zoom.

**Brand tags**
- Tone lists, tips and focus mode show the O / C tag when a guide mixes brands. When a guide uses only one brand, labels drop the tiny tag that read like a degree sign ("E713°").

**Colour along**
- Long-press (or right-click) a section to highlight its colour and scroll to it in the marker list. It doesn't tick the section.

- Tests: +3 unit tests, new `e2e/safety.test.mjs` (5 browser tests).
- Cache bumped to `marker-studio-v248`.

# Changes — v249 (speed with real phone photos)

Measured on a 12-megapixel phone photo (4032 × 3024 JPEG of line art, about 3,500 sections) in Chromium with the CPU slowed 4×, which is roughly a mid-range phone. The numbers are the longest freeze (ms), before → after.

| Action | v248 | v249 |
|---|---|---|
| Build guide | 3,780 | 1,910 (now shows "Building…" first) |
| Turn shading on | 2,520 | 1,200 |
| Enter colour along | 1,140 | 720 |
| Enter focus mode | 2,050 | 670 |
| Focus mode ✓ Done | 590–1,180 | under 60 |
| Autosave after a change | 570 | under 70 (no re-encode) |
| Drag the sun (slow frames) | ~350 per frame, 2,000 on release | ~140 per frame, 1,040 on release |
| PDF pages | 2,660 | 1,250 |

**How**
- Redraws repaint only the sections whose look changed (a tick, the next section in focus mode) and redraw just the labels that overlap them, one plain rectangle at a time. Anything else that draws on the picture forces a full redraw next time. Browser tests check that partial redraws match a full redraw pixel for pixel, including pinned colours whose markers stick out of their section.
- Label font sizes snap to half pixels. Thousands of slightly different sizes made text drawing several times slower.
- The section map PNG is only re-encoded when the sections change (checked with a hash), and an autosave that would store the same thing is skipped.
- One pass over the picture now gives label points, section boxes, centres, areas and the edge distances that shading needs. Shading no longer repeats that work.
- Shading colours and tone zones come from small lookup tables instead of being blended per pixel. The PDF uses them too.
- While you drag the sun or the roundness slider, the preview works at about 160k pixels.
- H/S markers are worked out one section at a time and cached against that section's tones, so switching the shading mode or a marker refreshes them. Focus mode only computes the current section, and the PDF skips sections too small for a marker.
- Photos bigger than the working size (2400 px) are scaled down once on load, instead of the full-size photo being kept in memory (a 48 MP photo is ~190 MB decoded). They are read via an object URL, not a data URL.
- Undo snapshots store the section map run-length packed (~1–2 MB instead of 17 MB for a 2400 × 1800 map). The undo memory budget is halved to 64 MB and still fits many more steps.
- Focus mode updates its top bar before drawing, so the outline and framing use the bar's final height.
- When the app comes back from the background (or the browser restores a dropped canvas), the picture is redrawn whole, since the browser may have discarded its pixels.

**Not changed:** loading and detecting sections (~2 s on the slowed test) and building (~2 s) are still the slowest steps. What remains is the section detection and the edge-distance pass themselves.

- Tests: +2 unit tests (`test/speed.test.mjs`), new `e2e/speed.test.mjs` (7 browser tests: partial vs full redraw across colour along, focus, tone steps and colour switches; a 4000 × 3000 photo kept at working size, Done repainting one section and autosave not re-encoding; per-section H/S markers matching the whole-picture calculation; section map re-encoded only on change; packed undo restoring exactly; pinned colours redrawn exactly; H/S markers following the shading mode).
- Cache bumped to `marker-studio-v249`.

# Changes — v250 (UX polish)

From the fresh-eyes review, re-checked on v249 at 390 and 360 px wide. Ben chose the four design calls (Shading at the top of Style; zoom row under the picture plus full screen; filters "tap = show only this"; one backup file).

**Guide screen**
- The − / + / ⤢ buttons moved to a slim row **under** the picture, so they no longer cover its corner. The row also has **⛶ Full screen**: the picture fills the screen (pinch, pan and taps still work), and ✕ or Escape closes it.
- **Colours** starts with "Markers in this guide", the setting that changes the guide most. It used to be last, under the bottom bar. "Colours from" labels the Owned / Saved / Generate choice.
- **Style** starts with **Shading**, then "Colour pattern" (Gradient / Random / Blend / Manual).
- **Try the sample** opens a finished guide. ← Sections still opens the editor.
- In the sections editor, "Toggle" is now **Include / exclude** (matching its hint), and Undo sits in the tool row.

**Reveal**
- The actions sit in a solid bar under the picture: **Share · Save clip · Replay · Close**. They used to be white text over the artwork. The picture is sized to stop above the bar.
- A ✕ in the corner and **Escape** close it. The zoom buttons no longer show through.

**Filters (Markers, Palette and the guide's Filters)**
- Tap a chip to show **only** that kind; tap more to add them; tap a chosen one to remove it. Nothing chosen = every marker. Chosen chips are teal with a ✓, and **Clear** appears on a group while it's filtered. This replaces tap-to-hide with All/None. Saved filter settings carry over unchanged.

**Backup**
- One file (`marker-studio-backup-YYYY-MM-DD.json`) holds markers, saved palettes and guides. It is reached from **Library → Back up** and **Markers → Back up & restore** (the same dialog), and the Home reminder offers **Back up now**.
- **Restore** takes that file or any older one (a collection backup, a guides backup, or one shared guide). It asks before replacing your markers and palettes, and only when they differ; guides are added, and a guide that's newer on this device is kept, with the backup's copy added as "(from backup)". The copy-and-paste text box still works for markers and palettes.

**Consistency**
- One rule for "selected": a white pill for where you are (pages, tabs), teal for a setting you picked, and teal with a ✓ for a filter. The palette size, harmony and Owned / Unowned / All controls moved from white to teal.
- Clearer wording:
  - colour-along "Done" is now **Stop colouring**, and Reveal's "Done" is now **Close**;
  - the same names everywhere: **New colouring guide**, **Try the sample**, **Import a guide**.
- Sliders and checkboxes use the app's purple.
- Only one purple button per screen: "Use in a guide" (Palette) and "Reveal & share" (Share tab) are now outlined.
- The ✓ on owned swatches sits on a dark badge, so it shows on pale colours, and swatch codes are 11 px.
- Palette's Export button matches its neighbours' height.
- At 360 px wide, "Reveal & share" fits and the Reveal bar stays on one row.
- Opening the Library clears a leftover "Saved…" message, and that message is shorter.

- Tests: +3 unit tests (`test/filters.test.mjs`), new `e2e/polish.test.mjs` (5 browser tests: sample opens built, zoom row doesn't cover the picture and the sticky tabs clear it, full screen open/close, Shading and marker count first, Reveal bar/✕/Escape, one backup restoring everything into a fresh install, older backup files still restoring). The e2e helper no longer taps Build for the sample.
- Cache bumped to `marker-studio-v250`.

# Changes — v251 (colour from a photo, phase 1)

**New: Style → Colour pattern → Photo.** Pick any photo, such as a sunset, a painting, a fabric or a coloured version of the picture. The guide takes its colours from it, using only markers you own.
- **Placing the photo.** It's laid see-through over the picture, filled over the artwork to start. One finger drags it and two fingers resize and turn it; on a computer, scroll resizes and Shift + scroll turns. **Fill / Fit / Stretch** re-place it, and **See-through** sets how strongly it shows. The colours update when you let go.
- **How each section gets its colour:**
  - It samples up to 160 points inside the section, kept away from its edges, so a slightly-off photo and the black lines don't leak in.
  - It takes the most common colour there rather than the average, so a blue section with a white highlight stays blue.
  - Outside the photo, the nearest edge colour is used.
- **Picking the markers.** "Markers in this guide" picks the N markers that together cover the photo best. Each step adds the marker that reduces the total colour difference most, weighted by section size and capped so one odd section can't pull in a marker by itself. The count starts at 24 for a photo, and a smaller number keeps the photo's main colours.
- **Choosing a different source.** Colours → Owned / Saved palette / Generate still chooses which markers it can use. "Lean toward" is hidden for photos, since the photo decides.
- **Pins, tap-to-change, shading, colour along, focus mode and the PDF** all work as with the other patterns.
- **Saving.** The photo (up to 1000 px JPEG, typically 100–250 KB) and its placement are saved with the guide and in backups, so you can re-line it up or change the marker count later. A new picture or the sample starts without it.
- **Speed.** On the 12 MP phone-photo test (3,500 sections, CPU slowed 4×), re-colouring after a drag takes about 0.8 s, the same as a full redraw. Near-identical section colours are merged, and markers far from every colour are skipped before the search.

**Coming in phase 2:** switching between the photo and the result, flagging loose matches with "closer markers you could buy", and leaving white or paper-coloured areas uncoloured.

- Tests: new `e2e/photo.test.mjs` (4 browser tests). They check that sections match the photo above and below a colour split (over 95%), that dragging moves the colours, that pins stay, Stretch, that a 2-marker cap still picks one blue and one red, save → reopen (same colours, placement and photo), and the covering choice (it picks one of two near-identical reds, not both).
- Cache bumped to `marker-studio-v251`.

# Changes — v252 (colour from a photo, phase 2)

- **Photo now sits before Manual** in Colour pattern: Gradient · Random · Blend · Photo · Manual.
- **How close it is.** Under the photo, a line gives the share of sections that are a close match, how many are left white, and how many are only a rough match. It uses the same words as Match a colour: rough means 10 or more apart, on the same scale Match a colour uses.
  - **Show the rough matches** fades the good ones so the rough ones stand out.
  - **Closer with:** lists up to 6 markers you don't own, in your collection's brands, that would bring the rough sections closest. They're chosen together, so they don't overlap.
- **White stays white.** Where the photo is near-white (very light and hardly any colour), sections are left uncoloured and unlabelled.
  - Colour along, focus mode and the section count skip them, and the PDF key says how many stay white. Tapping one says to leave it white.
  - Pinned sections are never left white. **Leave white areas of the photo white** (on by default) turns this off.
  - The white sections are saved with the guide and restored when it's reopened. Switching to another pattern colours them again.
- **Compare.** **◐ Photo** in the row under the picture (also in full screen) shows the photo on top, fully opaque. Tap again to go back.
- **Tip.** Tapping a section in a photo guide shows the photo's colour there and how close its marker is (near-exact / very close / close / rough / loose).
- On phones narrower than 420 px, the Full screen button shows just ⛶ so the row fits.

- Tests: +3 browser tests in `e2e/photo.test.mjs`:
  - white areas left white only where the photo is white, drawn as paper, kept after reopening, and coloured when the option is off;
  - rough matches counted, suggestions only of markers you don't own, and the rough view fading the close ones;
  - ◐ Photo compare, and Photo before Manual.
- Cache bumped to `marker-studio-v252`.

# Changes — v253 (hardening)

No new features; this makes the older parts of the app safer to change.

- **New browser tests for the oldest parts** (`e2e/editor.test.mjs`, 7 tests):
  - the sections editor by touch: merge, split with a line, add a section with a loop, include / exclude, undo back to the exact starting sections, and the minimum-size slider;
  - rotate and crop;
  - Save when storage is full ("Save failed", nothing half-saved, still marked unsaved);
  - the collection when settings storage is full (one warning, saves again once there's room);
  - a **48-megapixel photo** (8000 × 6000 JPEG): it loads, is kept at 2400 px, and builds a guide.
- **Safari's engine in CI.** The same browser tests now also run on WebKit, Safari's engine, as a separate GitHub Actions job. For now it reports problems without failing the build, because this environment can't run WebKit, so the first run is also the first look. The fake-camera test is skipped there.
- **iPhone canvas memory.** Safari counts a canvas's memory until it's garbage-collected and refuses new canvases past a limit. Helper canvases are now emptied straight after use: PDF pages once they're in the file, the saved section map, thumbnails, the photo working copy and the rotate/crop step.
- Removed an unused helper. The CI time limit went from 15 to 25 minutes, since the full browser suite is now about 3 minutes locally.
- Cache bumped to `marker-studio-v253`.

# Changes — v254 (shading, finished)

- **Rounder light.** Each bit of a shape's edge is lit or shadowed by which way it faces the sun. The edge facing the sun gets the highlight and the far edge gets the shadow, fading toward the middle. So pebbles look round, and long shapes like tentacles shade along their sides instead of from one end to the other.
  - **Roundness** mixes this with the old straight gradient: 0 is a plain gradient across each shape.
  - How each edge faces is worked out from a softened edge-distance map, so it turns smoothly rather than flipping along each shape's middle line. It's computed once per set of sections, at half size.
  - Guides you shaded before will look rounder when reopened.
- **Highlight and Shadow sliders** set how much of each shape gets the lighter and the darker marker, by moving the tone hand-over points. At 50% they match the old fixed values. The preview, the PDF tone lines and H/S markers, focus mode and step-by-step all follow.
- **Leave sections flat.** A pick mode like Pin colours: tap sections (eyes, tiny details) to stop them being shaded, and tap again to undo. Flat sections get just their base marker everywhere (preview, PDF, colour along), and the choice is saved with the guide.
- **Light from the photo.** In a Photo guide, shading can take its light from the photo itself, and this is the default there.
  - Where the photo is lighter than a section's own colour, that part gets H; darker gets S; where the photo is even, the section stays flat.
  - The photo's lightness is softened first, so texture and noise don't speckle the tones.
  - The sun is hidden. **Light from → The sun ☀** switches back.
  - The PDF key says the light and shadow follow your photo, and no ☀ is drawn.
- Saved with the guide: Highlight, Shadow, light source and flat sections.
- **Speed**, on the 12 MP phone-photo test with the CPU slowed 4×: turning shading on takes about 1.8 s, up from 1.2 s, because of the one-off edge-direction map. Letting go of the sun takes about 1.3 s, up from 1.0 s. Dragging the sun is unchanged.

- Tests: new `e2e/shading-more.test.mjs` (4 browser tests):
  - the sun-facing edge is lighter than the far edge, and flat light is still a gradient;
  - both sliders change the tone shares;
  - a flat section has no tones, the count shows, and it survives reopening along with the slider values;
  - photo light shadows the dark part of sections that cross a light/dark split, keeps one-sided sections even, hides the sun, and switches back to the sun.
- Cache bumped to `marker-studio-v254`.

# Changes — v255 (automatic lining-up, second full review)

**Automatic lining-up.** When you choose a photo that's a coloured version of the same page, such as a coloured example or a photo of your own finished page, it now lines itself up with the picture. That covers turned by any quarter turn plus a few degrees, a different size, and off-centre on a bigger sheet.
- It finds where the drawing sits in the photo, tries each quarter turn at a few sizes around that, and then refines on finer grids.
- It only moves the photo when the match is clear, meaning both:
  - the photo's edges line up well with the picture's lines;
  - moving the photo by an eighth of the drawing loses most of that match.
- Stripes, grids and unrelated photos are turned away, and so are drawings with very few lines.
- "Checking whether this is a coloured version of your picture…" shows next to the photo while it looks: about 0.2 s here, up to about 0.7 s on the 12 MP test with the CPU slowed 4×.
- **Line up automatically** tries again on demand and says when it can't match.
- It handles size, turn and position, not perspective, so a page photographed at an angle may still need a nudge by hand.

**Fixed (all reproduced first, each now has a browser test in `e2e/review2.test.mjs`)**
- Restoring someone else's newer backup no longer marks this device's own guides as backed up. Each guide now remembers when a backup last held it.
- A re-save that fails partway (settings storage full) puts the guide's previous saved data back, instead of leaving the new data under the old name and thumbnail.
- Re-detecting the sections (rotate, crop, sensitivity) numbers them afresh. Pins, flat sections and colouring progress from before no longer land on unrelated shapes; they're cleared.
- Flat sections no longer carry into the next sample or photo. A guide file without its own settings opens with default shading.
- Reopening a guide lit from its photo draws the photo light as soon as the photo loads (no sun, no sun shading).
- "Leave sections flat" works in the Blend pattern; a tap no longer adds an anchor instead.
- Back in the sections editor, the sun and any open colour picker are hidden, and the sun can't paint guide colours over the section map.
- Pin colours, Leave sections flat and Line up photo switch each other off, so a tap always goes where the button says.

**Polish from the review**
- On shorter phones (under 780 px tall) the pinned picture is a little shorter, so the guide tabs show without scrolling. The tabs now sit flush under the picture's zoom row, with no gap for scrolled text to show through.
- Step-by-step focus leads with the part: "Shadow · E19 Dried Sage", with "the side away from the light · section 2 of 5" underneath, instead of cutting off the word "shadow".
- The shading note says, for example, "YR04 has no lighter marker in your collection, so its highlight stays the base colour."
- Colour-along rows show the brand badge only when a guide mixes brands (the faint "o" read like a typo), and the ◐ button is labelled **Blends**.
- The toast's Undo is a proper button. "🎲 Random marker" is "🎲 Random", so it fits at 360 px. A long guide name ends in "…". The Filters label uses the app's font.
- The "On a computer: scroll…" hint is hidden on touch screens.
- From Home, **New colouring guide** with a guide already open also opens the **New or open** choices, so cancelling the photo picker isn't a dead end.
- The printed key tries a smaller preview and then slightly tighter rows before running onto another sheet. A 16-marker shaded guide is now 2 pages, down from 3.

**Seen but not changed:** a photographed paper background with heavy grain can still be detected as a section (untick it in the sections editor). Very rarely, a partial redraw differs from a full one by a few colour levels around a pinned label; that's too small to see.

- Tests: 83 unit and 65 browser tests. New: automatic lining-up in `e2e/photo.test.mjs`, and `e2e/review2.test.mjs` (8 tests).
- Cache bumped to `marker-studio-v255`.

# Changes — v256 (review leftovers)

**Photos of real pages**
- Grainy paper and camera noise no longer read as ink. The app measures how much the paper's pixels jitter and smooths just enough before finding lines (clean line art measures near zero and is untouched). Tiny ink specks are also dropped. A grainy test page that used to give 144 sections and a "lots of tiny fragments" warning now gives its 20 drawn sections and no warning.
- A photo that shows the table around the page: the page's blank margin (one big region ringing the drawing on all four sides, brighter than what's outside it) and the table are now background, not a huge section. A frame drawn on plain paper isn't mistaken for the page edge, so the area inside it stays a section.

**Smaller fixes**
- Partial redraws now match a full redraw exactly around pinned labels: labels are redrawn whole instead of clipped.
- Palette → Colours shows only the sizes the chosen scheme allows (no greyed-out 8). Monochrome and Custom, which already allowed up to 8, gain the missing 7. The per-scheme maximums are unchanged.
- Home names the app once (the header), not twice.
- The header names the brands you own ("Ohuhu · your collection"); both only when you own both, and "full range" before you add markers.
- Stepping through tones: on the highlight or shadow step, the base marker's code in the section is faded, and only this step's H or S marker is bright.

- Tests: 83 unit and 72 browser tests. New: `e2e/leftovers.test.mjs` (7 tests).
- Cache bumped to `marker-studio-v256`.

# Changes — v257 (palette sizes)

Each scheme's largest palette was re-checked by generating 300 palettes per size from the 24, 120 and 320 Ohuhu sets and counting how often two markers in a palette are hard to tell apart (ΔE under 8).
- **Tetradic** now goes up to 8 (two markers per hue): near-pairs stay at 3–8%, about what it had at 6.
- **Triadic** and **Split-comp** go up to 7 (12–15% near-pairs at 7, versus 2–11% at 6).
- **Complementary** and **Analogous** stay at 6: at 7 and 8 a third to a half of palettes had a near-pair.
- **Monochrome** stays at 8: its close steps are intended, for blending within one colour family.
- **Photo** keeps 4–16 and gains **10**. On nine real photos, the 120 and 320 sets kept getting closer to the photo up to 16 (87% and 77% of the possible improvement over 4 colours), with little more at 20 or 24; 10 was a clear step up from 8 (75% vs 60% with the 120 set). A 24-marker collection is already at 95% by 8, and some low-colour photos return fewer markers than asked for (the note under the photo says so).

- Tests: the palette-size test covers every scheme's sizes, that the new sizes make full palettes, and Photo's own sizes.
- Cache bumped to `marker-studio-v257`.

# Changes — v258 (straightening photographed pages)

**The drawing you make a guide from**
- A page photographed at an angle is found and flattened before its sections are detected. When the app is sure, it shows the page outlined for a moment ("Straightening the page…") and carries on; a line above Adjust photo says "✓ Page straightened · Undo · Adjust corners".
- When it isn't sure, it opens corner handles on its best guess and says why: part of the page is outside the photo, or an edge is hidden or bent (a hand on the page). **Straighten** or **Keep as is**. A magnifier shows what's under your finger while you drag a corner.
- Scans, screenshots, a page already square to the camera, and a white page on a white table are left alone, with nothing said. **Adjust photo → Straighten page** is always there to do it by hand.
- The page's true shape comes from the corners and the phone's lens (read from the photo's camera data); circles stay round. Without lens data it settles on Letter, A4 or square when within 3%. **Page shape** in the corner handles can set it.
- A busy drawing that fills its page (zentangle, mandala) is straightened to the drawing's own edges; a drawing with white margins is straightened to the paper's edges. A spiral pad's blank facing page isn't mistaken for part of the page.
- The old "Straighten" slider (small turns) is now called **Tilt**.

**Photo colour pattern**
- A coloured version photographed at an angle (or sideways, or upside down) is straightened the same way, turned the right way up by matching its lines to the picture, and lined up by itself. This works on busy drawings, where lining up by outline alone couldn't.

**Checked on**
- Nine phone photos of a real colouring pad (Galaxy S24+): seven straightened automatically; the one with a hand on the page and the one with a corner off the photo opened the corner handles. The page's measured shape agreed to within 1% across all the photos. Every straightened photo used as a coloured version lined up by itself, the right way round.
- Loading a photo takes no longer than before: the flat page is smaller than the photo, which pays for finding and flattening it.

- Tests: 83 unit and 78 browser tests. New: `e2e/straighten.test.mjs` (6 tests).
- Cache bumped to `marker-studio-v258`.

# Changes — v259 (fresh-eyes review)

A full review by six independent reviewers (bugs in three areas, UI/UX, completeness, code). The full findings, the UX and feature proposals that need a decision, and the code clean-up plan are in `docs/REVIEW-v259.md`.

**Fixed (each reproduced first; regression tests in `e2e/review3.test.mjs` and `e2e/straighten.test.mjs`)**
- A guide could be saved with scrambled colours after re-detecting / rotating / tilting / cropping / straightening its sections and then opening something else. A guide whose sections changed under it is no longer saved; the version from before is kept in the autosave.
- Opening a saved guide after leaving a new photo unbuilt wiped its progress on Build. Undo after an accidental re-detect now restores progress, pins, flat sections and part-done tones. Splitting or adding a section keeps part-done tones. Manual colours aren't carried onto different shapes after re-detecting. Renames are saved.
- A slow-loading photo, sample or guide no longer replaces what you opened meanwhile. Import checks a guide file before adding it to the Library. Tilt and Apply crop (with no box) ask before discarding section edits. Reopened photo guides remember the paper margin.
- Reopening the open guide while the corner handles or crop were up crashed or ignored taps; crop mode leaked into the next picture; Cancel in Adjust corners undid the straightening and section edits.
- Share: when the phone refuses to share because the tap has expired, a "ready" toast offers a Share button; other failures download the file.
- Overlays (sun, photo) and the sticky tabs are measured again once the picture has finished resizing. Blend: dragging pans (no stray anchor); anchors no longer show in Reveal. Right-click no longer ticks sections. Reveal resets zoom and can't bring its bar back after closing. Slider drags survive the controls refreshing; keyboard focus stays put. Find next zooms in and steps through sections. Long names no longer run off the PDF or share image.
- Match a colour stops a camera that finishes starting after the dialog closed. Palette: Photo mode without a photo has nothing to save; Generate explains when there are too few markers; the Save label always returns. Random: Swap replaces the right marker. Finish families follows the search. Home refreshes after restore and rename. Guide filters count correctly before markers are added. Background thumbnail saves no longer break saving when storage is nearly full. No sideways page drag.
- Keyboard and screen reader: hidden toasts can't be tabbed to; focus returns somewhere sensible after dialogs; the section colour picker takes focus and closes with Escape; "Markers used" rows and "Clear" are reachable; palette locks announce their state.
- Small: stale "Detecting sections…" toast cleared; the corner handles' main button is Straighten; Build guide is off with fewer than two sections.
- Removed dead code and CSS (see the review).

- Tests: 83 unit and 96 browser tests. New: `e2e/review3.test.mjs` (17 tests).
- Cache bumped to `marker-studio-v259`.

# Changes — v260 (UX release 1)

From the review's UX list (`docs/REVIEW-v259.md`, items 1, 2, 3, 7, 8, 9, 10).
- **Markers:** tapping a marker ticks or unticks it in place — it dims instead of disappearing, so the grid never shifts under your finger; the list tidies up on the next search, filter or view change. Press and hold (or right-click) a marker for its details: name, colour, family, old code, an "In my collection" switch, **Find similar** (opens Match a colour on it) and **Copy code**.
- **Toasts** sit just above whichever bar is at the bottom of the screen and let taps through to what's under them (only their Undo / Share buttons catch taps). Progress ("Preparing PDF…", "Detecting sections…") shows on the button or the status line instead of a toast.
- **Errors** appear where they happened, as an amber card that stays until your next tap: a wrong backup file, a backup that couldn't be saved, a guide file or photo that can't be opened. Match a colour's hex box says "Enter 6 hex digits" and greys out the old result while the code isn't a colour.
- **One word per idea:** Add markers, Save image, Download PDF (after Letter / A4), Guide file, ← Edit sections, Done colouring, Split complementary, ✓ Mark all done.
- **Empty states:** before any markers are added, Palette and Random use every marker, as guides do, with a line at the top saying so. The guide's start buttons use the same order everywhere: Choose a photo · Try the sample · Library · Import a guide.
- **Colour along:** rows read "0 of 9 done" / "All 9 done ✓" with a labelled ◐ Blends chip; the hint explains the steps and spells out highlight / base / shadow.
- **Small:** zoom-row buttons have 44 px tap areas (without making the row taller) and Full screen is labelled on phones too; white-text buttons use a slightly deeper purple (contrast 4.35 → 5.1:1); the welcome has Ohuhu / Copic tabs that jump the set list, and its button says "Tick a set above" / "Add 24 markers".
- **Code tools** (no change to the app): pinned prettier / esbuild / eslint, `npm run fingerprint` (proves formatting-only changes leave the shipped code identical), `npm run lint` (reports, never fails yet), `npm run format:check`. See `docs/CODE-TOOLS.md`.

- Tests: 83 unit and 102 browser tests. New: `e2e/release1.test.mjs` (6 tests).
- Cache bumped to `marker-studio-v260`.

# Changes — v261 (UX release 2)

From the review's UX list (items 4 and 6).

**Library rows**
- Tap anywhere on a row to open it; the ✎ pencil renames it in place (Enter or tapping away saves, Escape cancels). ✕ still needs a second tap to delete.
- Names get up to two lines instead of being cut to "Compleme". The PALETTE / GUIDE badge is gone; the line underneath says it instead: "Palette · 5 markers · Sep 27", "Guide · 16 markers · 40% coloured · Sep 27".
- New palettes get a name made from their colours (like guides do), instead of "Complementary · Sep 27". Existing names are left alone.
- The list uses the dialog's full height, with room under the last row.
- Fixed: renaming a guide in the Library while it was open was undone by the next save.

**Changing one section's colour**
- In a guide, tap a section: its marker shows with **Change colour** and **Pin** / **Unpin**. Change colour opens the marker picker; the choice is kept as a pin, so it survives Shuffle, Surprise and pattern changes, in every colour pattern. Unpin gives the section back to the pattern.
- Blend: a tap still places anchors; press and hold a section for Change colour / Pin. Manual: a tap still opens the picker straight away.
- Pin mode (Style → Pin colours): a tap pins or unpins a section directly.
- The marker picker shows each marker's code, grouped by colour family, with a **Recently used** row at the top (remembered on this device), and Confirm is the main button. Cancel or Escape puts things back.
- The section's marker (and whether it's pinned) is announced to screen readers.

- Tests: 85 unit and 124 browser tests. New: `e2e/release2-library.test.mjs` (12 tests), `e2e/release2-section.test.mjs` (10 tests).
- Cache bumped to `marker-studio-v261`.

# Changes — v262 (completeness release)

From the review's completeness list (items 1–9, apart from the light theme, colour correction and more brands).

**Saving and safety**
- **Guides in your Library save themselves.** A new guide still needs one Save; after that every change (colours, pattern, ticks, name) is kept in that Library entry a moment later, when the app is put away, and before something else opens. A quiet "Saved in your Library ✓" line shows it. Save becomes **Save a copy**, which makes "<name> (copy)" and switches to it. Deleting the open guide from the Library stops it saving (Undo brings it back). If storage fills up you're told once and nothing is lost.
- **iPhone safety.** Safari users get a card suggesting Add to Home Screen (Safari can clear a tab's storage after 7 days of not using it). The app asks the browser to keep its storage once there is something worth keeping. Backups go through the share sheet on phones (Save to Files, AirDrop, Mail) and download on computers. The backup reminder now covers anyone with markers or palettes, not only after two guides, and repeats every 14 days while there are changes.
- **Fonts are part of the app** (Fraunces and Hanken Grotesk, open licences), so it looks right offline on the very first launch and nothing is fetched from Google.
- A "Something went wrong" toast catches unexpected errors instead of failing silently.

**Undo**
- **↶ Undo on the guide screen** (and Ctrl/Cmd+Z) for Shuffle, Surprise, pattern, marker count and colour changes, up to 30 steps; dragging a slider is one step.
- Undo toasts for Own all, Un-own all, Clear collection and Reset progress. Deleting from the Library is now one tap with a 6-second Undo.

**Choosing colours by hand**
- **Replace everywhere:** Change colour's picker offers "Only this section / Everywhere (N sections)" when other sections use the same marker. Everywhere pins them all as one Undo step. Sections already ticked done keep their marker, since that ink is on the paper.
- **Paint mode** in Manual: pick a brush marker, then tap or drag across the picture to fill and pin sections. Two fingers still move and zoom. Each stroke is one Undo step. Paint turns off when you leave Manual or the Style tab.
- Paint strokes don't raise a toast each time (↶ Undo is in the zoom row); screen readers still hear what was painted.
- Gradient's Shuffle always gives a clearly different result.

**Printing**
- **Print for real markers:** Print options for Pages (page + key, or key + reference only), Labels (codes, numbers 1–N, or none), Darker labels, and Paper (Letter, A4, A5, Half letter; the default follows your region).
- **Swatch chart:** Markers → Print a swatch chart. A PDF with a numbered box per marker to colour in next to the on-screen colour, for your collection, your To buy list or a whole brand, by colour family or code. Shows the page count first.

**Shopping list and dry markers**
- Every "you could buy" suggestion (Match a colour, the marker sheet, blend plans, shading notes, photo "closer with") has an Add button. **To buy (N)** in Markers gathers them.
- Mark a marker dry or low from its details sheet; guides and palettes skip dry markers. Both are in backups.

**Help**
- A **?** on the guide screen and Home opens Help: how it works (three cards), tips for photographing a page, a glossary (section, pin, blend, H/B/S), your data, and About. What's new appears once on Home after an update. (The Feedback link stays hidden until an address is set in `src/js/help.js`.)

**Readability**
- **Text follows your phone's text size** (iOS Dynamic Type; Android Chrome 146+ via `<meta name="text-scale">`), up to 1.6×. At the normal setting nothing changes except that the smallest labels are now at least 12px. Buttons and tabs grow a little less so rows still fit; the Home cards, marker grid and guide buttons re-flow at large sizes.
- Fixed: the Home "Set up your markers" card spilled out of its box.

**Other fixes**
- Closing a dialog gives keyboard focus back to what opened it (Chromium kept it on the hidden Close button).

- Tests: 90 unit and 193 browser tests. New: `e2e/safety2.test.mjs` (12), `e2e/undo.test.mjs` (13), `e2e/print.test.mjs` (6), `e2e/help.test.mjs` (5), `e2e/shopping.test.mjs` (7), `e2e/autosave.test.mjs` (8), `e2e/paint.test.mjs` (6), `e2e/swatch-chart.test.mjs` (5), `e2e/textsize.test.mjs` (6), `test/textsize.test.mjs` (4), plus copy naming in `test/names.test.mjs`.
- New tools: `scripts/textsize-codemod.mjs` (`--check`) keeps inline font sizes on the text-size scale.
- New devDependencies: `@fontsource-variable/fraunces`, `@fontsource-variable/hanken-grotesk` (source of the bundled fonts) — run `npm install`.
- Cache bumped to `marker-studio-v262`.

# Changes — v263 (Release 3: the guide screen)

The review's UX item 5. Designed with Ben item by item and tried in a clickable mockup first; the spec is `docs/GUIDE-LAYOUT.md`.

**Frame**
- **Header row:** the guide's name with ✎ to rename it, where it's saved ("Saved in your Library ✓", "Saving…", or "Not saved yet" with **Save** for a new guide), ✨ Surprise, and ⋯. The ⋯ sheet holds New (photo, sample, Library, import), Save a copy, Reset progress and Help. The "New or open" row, the name box and the save line above the bar are gone.
- **Picture:** starts at 55% of the screen and shrinks smoothly as you scroll into the tabs, down to 45% (40% on short phones) and never smaller. In Colour along it stays at 55% (45% on short phones). Switching tabs never moves the picture or the tabs.
- **Tool row** under the picture replaces the zoom row and the summary line: ↶ Undo, the status (or "12 of 143 done" with a progress line in Colour along), ◐ Photo, codes on/off, −, +, Fit (only when zoomed in) and Full screen. In Edit sections its Undo undoes section edits.
- **Bottom bar:** at most two buttons, one row at every text size, slimmer. Fixed: it lifted off the bottom of the screen at the end of short tabs, and on short phones it was pushed partly off the screen at the top of the page.
- **Side by side** on landscape phones (640px wide and up) and wide screens: the picture beside the controls, tools in the spare space next to it.
- **Drag to scroll:** at normal size, dragging up or down on the picture scrolls the page (not while painting, zoomed in, drawing sections, dragging the sun, or with a sheet open).
- The "tap a section" instruction shows once instead of on every guide.

**Sheets and section menus**
- Change colour, Manual's picker, the Paint brush and Blend's menu open in a sheet under the picture, which stays fully visible. A pulsing outline shows the section being changed (every affected section with Everywhere).
- Tap another section while the sheet is open: your pick is kept (one Undo step) and the sheet moves on. Cancel undoes only the current section; Confirm is now **Done**.
- The section tip keeps its size, sits above or below the section without covering it, and closes when you scroll.

**Tabs**
- **Colours · Pattern · Shading · Share**, reopening on the last one you used. Display is gone: texture and the tone guide moved to Shading, codes on/off to the tool row.
- Pattern has the chooser on one row and Shuffle and Pin side by side; Paint and its brush live under Manual.
- Helper text shows in full the first time, then as a one-line ⓘ. Shading's suggestions fold into one line ("4 markers would make the shading richer · Show").
- Share is a short list. **Print…** opens a sheet with the options and a live summary ("2 pages · Letter · Numbers") worked out from the real page layout.

**Colour along**
- The list starts right under the picture, one 48px row per marker. Tap a marker to open it in place: ✓ Mark all done (Clear ticks once done), Find next, ◐ Blends. Tap it again to see all colours. This replaces "Now colouring", Show all and Clear.
- The open row always scrolls into view, including after press and hold on the picture. Finished markers stay put while you colour and gather in a collapsed "Done (n)" group next time.

- Tests: 90 unit and 234 browser tests. New: `e2e/layout.test.mjs`, `e2e/sheet.test.mjs`, `e2e/tabs.test.mjs`, `e2e/along.test.mjs`; most other browser tests updated to the new controls with the same intent.
- Cache bumped to `marker-studio-v263`.

# Changes — v264 (fresh-eyes review 4)

Five reviewers went over v263; every bug was reproduced in a browser before it was fixed. The full list, and the decisions left open, are in `docs/REVIEW-v264.md`.

**Could lose or corrupt work**
- A second tab or window no longer wipes Library entries: tabs pick up each other's saves and every save merges the Library by id.
- Straightening, rotating, tilting or cropping a built guide asks first and can be undone; it used to wipe progress, pins and part-done tones silently.
- Tapping "✓ Mark all done" twice no longer clears the ticks (the second tap is ignored; Clear ticks has an Undo).
- Turning shading off (or flat sections) no longer turns part-done tones into "done"; Undo restores them.
- Rebuilding a guide keeps every section's marker (Random was re-rolled, coloured sections included).
- The unsaved guide behind "Resume your last session?" is kept in the Library instead of being overwritten by the next new guide; Dismiss only hides the card.
- Changes made while something loads, a failed first Save, and a restore of the open guide no longer lose work.
- Dry markers no longer rewrite saved guides; substitutes are only shown until you change that section.
- Storage-full failures roll back and say so (no more "Saved ✓" or Undo toast after a failed save). One bad field in saved data no longer resets the collection or half-starts the app.
- Also: the Photo pattern keeps its photo, import checks files before adding them, a Split that divides nothing is taken back, backups include the last second of changes, restoring twice doesn't duplicate guides, Unpin works after reopening, and Paint and the screen wake lock turn off when you open something else.

**Guide screen**
- Fixed: tabs pinned under the picture after coming back to the Guide tab; the tool row covering the bottom bar on short phones and at large text; Colour along opening with its list off-screen (every stage change now starts at the top); focus lost after closing a colour sheet; the header changing height (it moved the page on Safari); Escape and ⋯ while renaming; one Escape doing two things; Ctrl+Z behind a sheet; auto-save storing an unconfirmed colour; "1 markers"; status text cut mid-number.
- Focus mode is modal for keyboards and its zoom buttons are visible on pale pictures. Tabs work with arrow keys; segmented choices announce which is selected.
- The "Tap a section" hint sits under the tabs; Edit sections shows Adjust corners and the section count once; stray 54px buttons in the guide are gone.

**Rest of the app**
- Fixed: photo palette, custom slots and Seed ignoring "all markers" and dry markers; Match's stale hex error, 3-digit hex, and silent unreadable photos; "Use in a guide" → Cancel still saving; silent backup failures from Home; the reminder nagging after a restore; blocked storage reported as "storage full".
- Toasts no longer follow you to other screens. Library delete can be undone from the keyboard. 44px tap areas for See all, Add markers, dialog ✕, toast Undo and the + chips. "Help" is called Help everywhere. The installed app checks for updates when it comes back into view.

**Code**
- Dead code from v260–v263 removed (including 29 unused test hooks); lint at 0 errors; one `openLibrary()`; one block of tip CSS; faster auto-save tests.

- Tests: 96 unit and 294 browser tests. New: `e2e/review4-guide.test.mjs` (22), `e2e/review4-data.test.mjs` (17), `e2e/review4-shell.test.mjs` (21), `test/review4.test.mjs` (6).
- Cache bumped to `marker-studio-v264`.

# Changes — v265 (decisions from review 4)

Decided with Ben item by item (`docs/REVIEW-v264.md` §4).

- **One button size:** action buttons are 44px everywhere and choices 40px (44px tap areas), replacing the global 54px rule and its patches. Main buttons stand out by colour, as in the guide. Buttons grow with larger text instead of clipping.
- **Home shows one reminder at a time:** Resume stays above New colouring guide; under the tiles at most one of Add to Home Screen → Back up → What's new, the next appearing when one is dismissed.
- **What's new** goes away 7 days after it first appears (or on ✕), and Help › About lists it.
- **Unreadable saved data:** when markers, palettes or Library entries had to be left out (or nothing could be read), Home shows a one-time note with **Save a copy** of the original.
- **Welcome › Restore a backup** opens the file picker straight away; cancelling keeps the welcome; success lands on Home with "Restored … markers, … palettes and … guides".
- **Restore merges palettes:** markers are still replaced after asking ("Replace your 120 markers with the backup’s 96? Palettes and guides in the file are added to yours."); palettes are always added, never deleted.
- **"To buy" everywhere:** the tab, heading, "+ To buy" / "✓ To buy" buttons, "Add all to To buy", "your To buy list".
- **Brand letters (O/C)** only where the screen mixes brands; exports always name the brand (once in the header for one brand, per line with the key when mixed). Screen readers keep full brand names.
- **The guide's Generate palette** lists harmonies in the Palette screen's order and respects the per-harmony maximums from v257 (extra markers come from Expand, as before); Surprise too.
- **Markers:** a one-time hint explains tap to tick vs press and hold (right-click with a mouse) for details; the per-view line no longer repeats it.

- Tests: 97 unit and 312 browser tests. New: `e2e/buttons.test.mjs`, `e2e/v265-home.test.mjs`, `e2e/v265-names.test.mjs`.
- Cache bumped to `marker-studio-v265`.

# Changes — v266 (fresh-eyes review 5)

Five reviewers went over v265; every bug was reproduced in a browser before it was fixed. The full list and the decisions left open are in `docs/REVIEW-v266.md`.

**Could lose or corrupt work**
- Rebuilding a reopened guide no longer drops sections (the guide's own background trim is used on open).
- A Photo-pattern photo that loads late can no longer recolour and save a different guide; a saved Photo guide keeps its photo even if changed before it decodes.
- Two tabs on one guide: a tab with nothing unsaved reloads the other's save; one with its own changes merges ticks and tones and says so. The Resume slot knows which tab owns it.
- Sensitivity and Enhance ask first on a coloured guide, and can be undone. Each rotate, crop and straighten is its own Undo step.
- Unbuilt section edits are never lost: the header says so, opening something else asks Build / Discard / Cancel, page hide keeps them in the Resume slot, and a new guide can't overwrite them.
- Restores: storage-full restores roll back and say so; a backup with no markers doesn't empty your collection; broken guides are skipped and reported; duplicates say "already here".
- Undo brings back part-done tones; Fill skips ticked sections; sections taken out and brought back keep their pin; Back up includes the unsaved guide; hostile guide files are refused before they can crash the tab.

**Guide screen**
- Finishing a page brings the Page complete banner (with Reveal & share) into view. No blank strip after rotating while zoomed. The wake lock returns with Colour along. Toasts no longer cover sheets. Sheets fit the card on iPad. Ctrl+Z works in Edit sections. Leaving Focus mode keeps your marker open. Codes in the picker are never cut at large text.
- Shared files (guide file, PDF, image, swatch chart) go to the share sheet on phones and download on computers, like the backup; one `handOver()` does it all.

**Rest of the app**
- Palette's name and codes no longer overlap; disabled buttons look disabled. Home tiles become rows at large text. Match's tabs and "+ To buy" fit at large text. The Welcome's buttons are always visible and it accepts .txt backups. Markers says "Tick all shown" and "Showing N markers". The unreadable-data note says what was lost. Error cards no longer vanish mid-tap; toasts use the full width.

- Tests: 102 unit and 379 browser tests. New: `e2e/review5-guide.test.mjs`, `e2e/review5-data.test.mjs`, `e2e/review5-shell.test.mjs`, `e2e/review5-cleanup.test.mjs`, `test/review5.test.mjs`.
- Cache bumped to `marker-studio-v266`.

# Changes — v267 (v266 decisions, formatted source)

The decisions from `docs/REVIEW-v266.md` §4, as settled.

**Source formatting**
- All of `src/js` and `src/css` is now formatted by a pinned Prettier (3.9.9); `npm run format` fixes it and `npm test` checks it. The guide's closure now opens and closes in `index.template.html`. The shipped JavaScript is unchanged token for token (`scripts/fingerprint.mjs`), and so is the CSS. `index.html` is about 27 KB bigger gzipped (318 KB); a minifier can be added to the build later without touching the source.

**Guide**
- **Brand letters (O/C)** show on screen whenever the view mixes brands *or* your collection does (the full range in demo mode): Markers, Palette, Match, the pickers, the guide's picture labels, Colour along and the blend plan. Exports still go by their own markers. Screen readers hear the brand's name.
- **Undo toasts** only where there's no ↶ Undo to tap: Plan steps say what ↶ Undo will take back instead. ✨ Surprise, Reset progress, Clear ticks and Library delete keep their toast.
- **Reset progress** asks first ("Clear all N ticks?"), and is greyed out with nothing ticked.
- **Each stage** (Plan, Colour along, Edit sections) starts at the full picture.
- **Colour along's first-time instructions** are two lines and More, folding into the ⓘ line once a marker is opened.

**Home and Help**
- **Back up comes before Add to Home Screen** when a guide isn't in any backup.
- **Lost guides:** a guide whose data is still stored but missing from the Library list is offered back on Home (Add them back / Not now), inside the unreadable-data note when that's about guides. Help › Your data › Find lost guides looks any time. Guides being saved by another tab, still being deleted, or in the Resume slot are never offered. Deletes now stay recorded until the stored data is really gone.
- **Help › Keyboard and screen readers** says what needs touch or a mouse and how to use Colour along's list instead.

- Tests: 104 unit and 396 browser tests. New: `test/format.test.mjs`, `e2e/v267-guide.test.mjs`, `e2e/v267-home.test.mjs`.
- Cache bumped to `marker-studio-v267`.

# Changes — v268 (code cleanup)

The rest of the cleanup plan (docs/REVIEW-v259.md §4 and docs/REVIEW-v264.md §3). Nothing is meant to look or work differently, and each step was checked against the code before it; docs/CODE-TOOLS.md has the tools.

- **The guide's shared variables** (`00-state.js`): one per line, grouped, each noting which files write it. Checked by comparing the declarations' syntax before and after.
- **One list of a guide's style settings** (`05-style-fields.js`): saving, opening, resetting the shading and each Undo step go through it, instead of five hand-written copies. 49 saved guides captured before the change are byte-identical after it; an independent check opened 300 deliberately malformed saved guides in v267 and v268 with identical results, and replayed 55 Undo steps identically.
- **One place for dialogs and Escape** (`layers.js`): one ordered list of what Escape closes (dialog, marker picker, sheet, section tip, focus mode, Reveal, full screen) and one listener, replacing seven; dialogs open and close through `openDialog()`/`closeDialog()`. 31 tests recorded the old behaviour first. One fix: Escape while renaming a guide in full screen used to leave full screen and keep the half-typed name; now it cancels the rename.
- **The guide's controls** are drawn by one function per tab and stage (`50`–`53`), instead of one 1,100-line function. The markup, every listener and every computed style were identical in 122 states × 3 screen sizes × 3 text sizes.
- **Inline styles into CSS:** about 90 moved; show/hide states that scripts toggle, and colours from data, stay inline. Every computed style and ~1,800 screenshots were identical before and after (`scripts/style-snapshot.mjs`, `scripts/controls-compare.mjs`).
- **Tests wait for results, not fixed pauses:** all 1,222 fixed sleeps are gone (`idle()`, `until()`, `frames()` in `e2e/helpers.mjs`); the few that remain are time windows the app itself measures, each with its reason. About 17% faster, and one test that only passed because a pause stepped over a 400 ms double-tap window now waits properly.
- **Test files named by feature** (e.g. `colour-along`, `restore`, `two-tabs`, `lost-guides`) instead of by release or review; every test kept once, unchanged.
- **New test:** How it works never opens by itself over another dialog.

**Two bugs found by the checks, fixed**
- A guide whose saved palette had been deleted was quietly switched to the first palette in the list as soon as it opened, so its next change recoloured it from that palette. The picker now says "Palette deleted — choose another" and nothing changes until you choose.
- Back up & restore on a sideways phone at a large text size squashed the "as text" link to nothing once the text box was open, so it couldn't be tapped; the dialog now scrolls instead.

- Tests: 109 unit and 445 browser tests.
- Cache bumped to `marker-studio-v268`.

# Changes — v269 (colour engines)

The palette generator and the guide's gradient were measured on Ben's own drawing (205 sections) and collection, then rebuilt. Both now judge colour as the eye sees it (L\*C\*h° and CIEDE2000, in `colour.js`) instead of screen HSL. The measurements and the decisions behind them are in the "Marker Studio Colour Engines" comparison.

**Gradients**
- **Which markers:** never more markers than the guide has sections; clearly coloured markers first (greys only when you ask for more markers than you have colours); with markers to spare, the clearer mid-range ones. The line under Colours says what's in use, e.g. "Using 205 of 451 markers: one per section".
- **Look (new, Pattern › Gradient): Auto · Smooth · Light to dark.** Smooth runs colour along the gradient in its smoothest order. Light to dark groups markers by hue into bands, each running light to dark across the gradient (the light side faces the Shading sun when Shading is on). Auto moves gradually from Smooth to Light to dark as each marker gets its own section, and says which it's doing.
- **Loop or ramp:** colours that go round the wheel run as a loop (Shuffle turns where it starts, with no seam); a palette that doesn't (Monochrome, analogous, warm only) runs from one end to the other. Shuffle on a ramp picks different markers, or a new palette of the same kind; a saved palette's ramp is flipped with Direction instead.
- **Shared by area:** each marker gets about the same share of the page, not the same number of sections.
- On Ben's drawing with his 451 markers, touching sections that clash (ΔE00 over 25) fell from 18–39% to 1–12%, and grey sections from 32–54 to none.

**Mood replaces Intensity** (Colours tab): Any · Bright · Soft · Pastel · Deep · Earthy. It shapes which of your markers are used in every pattern, and the palettes Generate palette makes; when a mood has too few markers it widens to the nearest and says so. Saved guides keep their setting (Vivid is now Bright, Muted is Soft). Greyed out for a saved palette.

**Generated palettes** (Palette screen, Generate palette, Surprise)
- Every pair of colours is clearly different (ΔE00 at least 10; Monochrome 6), on the scheme's hues, with no greys. Before, 72–86% of 6-colour palettes held two colours closer than 10 and 41% held a grey.
- Bigger sizes: analogous and complementary up to 8, split and triadic 10, tetradic 12, monochrome 10. When your markers can't fill one cleanly, the rule relaxes a step at a time and the Palette screen says "Two colours are close: your markers don't have N clearly different colours for this scheme."
- Re-rolling one colour keeps it clearly different from the rest.

**Also**
- Photo pattern: lining up a photo of a page coloured with smooth gradients no longer turns it upside down (it compares the best of each quarter turn more closely).

- Tests: 136 unit and 461 browser tests. New: `test/palette-generator.test.mjs`, `test/gradient.test.mjs`, `e2e/gradient.test.mjs`; the saved-guide fixture was re-recorded (only the new `look` key and new generated palettes differ).
- Cache bumped to `marker-studio-v269`.

# Changes — v270 (colour engines, second pass)

Every colour comparison in the app now judges colour as the eye sees it (CIEDE2000), with one meaning per threshold: 10 = clearly different, 6 = related but not twins (photo palettes), 2 = visibly better. Measured on Ben's 451 markers, his drawing, five of his photos and three photos of his coloured pages.

**Match a colour**
- Ranked by eye: the top pick was not the closest by eye for about 36% of colours before.
- Labels on the eye's scale: Near-exact under 2, Very close under 4, Close under 7, Rough under 12, then Loose.
- "Closer ones you could buy" only lists markers at least 2 closer than your best (before, two times in three it listed near-ties).
- **Tap the white paper** (photo tab): corrects the photo's lighting from the paper; "Lighting corrected ✕" removes it. The camera tab says a photo gives the truest match.
- Fixed: a photo loaded after a tall one was drawn about 98 px wide.

**Palette › From photo**
- The photo's main colours are found as before; each is given your closest marker by eye, every pair at least 6 apart, no near-white, and always the size you asked for. On 13 real photos: pairs you can't tell apart 21 → 0, short palettes 3 → 0, the photo covered as closely as before.
- **Tap the white paper** here too (never automatic: a sunset's glow is the picture).

**Guide**
- **Photo pattern:** a photo that looks like a page is corrected from its paper before its colours are read (from the page's own uncoloured parts once a coloured version lines up). "Leave white areas white" now judges white against the photo's paper: on Ben's photos 0% of the paper counted as white before, 90–98% now. Switchable, saved with the guide; older guides reopen with it off. Photos of scenes are left alone.
- **Closest marker by eye** for Blend, the Photo pattern, stand-ins for dry or missing markers, and Expand with nearby markers (Character keeps its meaning).
- **Random:** touching sections are found across lines of any thickness (on Ben's drawing the old check saw fewer than half of them), and the option is now "Keep touching sections clearly different" (at least 10 apart, relaxing only when it must).
- **Blend's Mix:** Soft (as before) · Vivid (round the colour wheel the shorter way; the old Vivid could swing the long way) · Like paint (how layered ink mixes: blue and yellow make green). Replaces the Vivid tick box; guides saved with Vivid open as Vivid.
- **Warm / Cool:** every colour is in exactly one (yellow-greens were in neither, one marker in both); greys follow their undertone, neutral greys and black count as both.
- **Blend companions** (Colour along, the printed key): a "lighter" or "darker" companion now really is, by a visible step, keeping its hue — before, 34 of Ben's lookups went the wrong way. So fewer "buy this to complete the blend" suggestions.
- **Brand tags:** when your collection mixes brands, every code on the picture carries its brand as a small tag instead of a raised letter that read like a degree sign: Ohuhu a filled dark tag, Copic an outlined pale grey one. On screen, in the saved image and the PDF (grey tags there). Labels in narrow sections are about 11% smaller to make room.

- Tests: 153 unit and 475 browser tests. New: `test/match-and-photo.test.mjs`, `test/colour-engines.test.mjs`, `e2e/random-and-blend.test.mjs`; more in `e2e/match.test.mjs`, `e2e/palette.test.mjs`, `e2e/photo.test.mjs`, `e2e/brand-letters.test.mjs`. The saved-guide fixture was re-recorded (only `blendMix` and the photo's `light` added).
- Cache bumped to `marker-studio-v270`.

# Changes — v271 (readable labels)

- **Label text by contrast.** Codes on the picture, on swatches (Markers, Palette, Match, the export card) and in the PDF take dark or white text, whichever contrasts more with the marker's colour (WCAG contrast ratio). The old brightness rule chose the less readable one for 79 of the 721 markers (white on blue B111 at 2.9:1, where dark reads at 6.4:1). Markers with text under 3:1: 7 → 0; under 4.5:1: 90 → 7.
- **Photo pattern:** the search for the markers that cover a photo best now measures by eye too (reach unchanged: 23 by eye is as far as the old 40).
- Shading's highlight and shadow picks were checked the same way and left as they are: measured by eye, the change made 108 picks drift more and only 41 less.
- Tests: a test photo's camera noise is now seeded, so a section on the edge of "white" can't flip between runs.
- Tests: 154 unit and 475 browser tests. The saved-guide fixture was re-recorded: only its six Photo-pattern captures changed. Cache bumped to `marker-studio-v271`.
- **CI, WebKit job:** on GitHub it ran out of its 30 minutes and was cancelled before reporting anything (the main Chromium job passes in about 8). It now runs in 3 parts side by side (`--test-shard`), a hung test fails after 3 minutes instead of using up the run, and each part puts its failures, any test files that never finished, and its slowest tests on the run's summary page (`e2e/ci-report.mjs`, `e2e/ci-summary.mjs`). Still informational: it doesn't fail the build.
- **CI, first WebKit results** (run 8): the main job's unit tests failed on GitHub although they pass here. The only way to make them fail was running several test files at once on a busy machine, which is what CI does: three speed checks (the gradient's colour differences and layout, and a palette roll) timed the clock, which other test files slow down. They now time processor time (`cpuMs` in `test/harness.mjs`), and pass four at a time on two processors. The WebKit job's 3-minute limit also applied to each test file as a whole, cutting off slow files: it is now 12 minutes. The Paint-with-touch tests and the touch part of "drag to scroll" drive touch through Chromium's own protocol and are skipped on WebKit. Unit and Chromium results go on the run's page too, and failures are grouped by file into annotations, which anyone can see without signing in.

# Changes — v272 (Photo pattern: graded by eye, a fuller marker search, a suggested count)

Measured on Ben's drawing (205 sections) and collection (451 markers), with his five photos, two photos of his coloured pages, and fake photos of the drawing coloured with 12, 24 or 40 known markers and made photo-like (soft focus, warm uneven light, marker streaks, noise, JPEG).

- **Graded by eye, in Match's words.** The figures under the photo, the tip on a tapped section, "Show the rough matches" and "Closer with" measured plain L\*a\*b\* distance with older limits, while Match (v270) and the Photo pattern's own choice (v271) go by eye. The tip's word differed from Match's for 27–68% of sections; the beech-forest photo read "15% close" when 68% of it is Close or better by eye. Now: "x% of sections are a close match to the photo or better" (under 7 by eye), "N are only a rough or loose match" (7 and over), and the tip uses Match's words. "Closer with" follows Match's rule for markers to buy: only markers at least 2 closer by eye (about the smallest difference you can see), found from a short list per section, and measured against the best marker you own rather than the one the guide uses: with a low marker count a section can be a rough match while a marker you own would do, and "Closer with" used to suggest buying one.
- **A fuller marker search.** After the greedy choice (each step adds the marker that helps most), each chosen marker is swapped for any other in the pool while that brings the total down. On the fake photos at the true count, sections given exactly the right marker: 66% → 91% (24 markers), 93% → 97% (another 24), 81% → 89% (12), 89% → 91% (40); on the coloured pages 2–8% closer on average; on real photos usually 0–3%. It adds about 40–110 ms to a rebuild, so while the marker slider is being dragged the quick choice is used, and the full one when it is let go (the same result every time for the same photo).
- **A suggested marker count.** Under the figures: "About N markers get as close as all your markers can" with a Use N button (an Undo step), shown when it differs from what the guide uses by 2 or more. N is the fewest markers that are within 2 by eye of each colour's best in your collection on 95% of the picture. On the fake photos it suggests 12, 22 and 32 for 12, 24 and 40 markers (the ones left out are within a just-noticeable step of others); on Ben's photos 17 (misty sunrise), 36 (sunset sky), 7 (beech forest), 20 (turquoise pools) and 21 (beach and rock); none for his coloured pages, where every marker still helps a little. It is worked out after the guide is drawn, a step at a time, and kept for the same photo placement, white areas and markers.
- **Safari fixes, found by the WebKit job and confirmed on Ben's iPad:**
  - **Colour along:** the open row could end up partly under the bottom bar. The scroll to it is smooth, the pinned picture changes size as the page scrolls, and Safari stops a smooth scroll when anything else scrolls the page; half a second later the row is now checked again and put right at once (unless you've touched, scrolled or pressed a key since; finishing the page cancels it too, so "Page complete!" stays in view).
  - **✓ Mark all done, double tapped,** cleared the ticks again: the second tap is ignored when it comes within 600 ms of the first, but the time was taken when each tap was handled, and the redraw after the first tap on a big guide stretched the gap. Now it's the time each tap happened (and a click the browser counts as a double click is ignored too).
  - **Share's Reveal & share / Save image pair** never stacked on narrow screens in Safari, so "✨ Reveal & share" wrapped onto two lines: a button that centres its label overflows on both sides, and Safari doesn't count that in scrollWidth. The label text is now measured too (Mood's six choices use the same measure; checked in WebKitGTK's MiniBrowser: two rows of three at 300 and 340 wide, one row at 390).
- **Lining up a photo (from Ben on his iPad):**
  - **Grab the photo anywhere it shows.** Only the drawing itself took the drag, so with Fill, where the photo reaches past the drawing's sides (a portrait drawing on a wide screen), a drag there did nothing — "only sometimes works in Fill". Now the whole picture area takes it while lining up.
  - **Leaving the Pattern tab finishes lining up** (as Done lining up does): the see-through photo goes and a drag on the picture scrolls the page again. Coming back doesn't start it again.
  - **Quicker to follow:** after the photo is let go the colours follow with the quick marker choice, and the full choice comes once it has been left alone for half a second (one Undo step for the move). The see-through photo is its own layer, so moving it repaints nothing else.
  - A photo coloured with too few markers (the count carried over from before) now shows the suggested count under the figures, with Use.
- Tests: `test/photo-choice.test.mjs` (the in-between-marker trap the swaps get out of; the full choice never worse than the quick one; the suggestion on photos of 8 and 5 markers, and none for a smooth run of colours) and `e2e/photo-choice.test.mjs` (the figures, tips and "Closer with" by eye; a photo of the sample coloured with 8 markers: "About 8", Use 8 gives back exactly those 8, Undo). 157 unit and 478 browser tests. Cache bumped to `marker-studio-v272`.
- **CI after v272 (tests only, no app change):** the main job failed on GitHub on one speed check (a 3,600-section gradient laid out in 1.6 s against a 1.5 s limit; about 0.7 s here). GitHub's runners are 2-3 times slower than ours, so the speed limits now catch a slowdown of several times rather than the difference between machines: layout and colour differences 4 s, a palette roll 60 ms, the gradient's tour its budget plus 1.5 s. And when an earlier step fails, the browser tests' summary now says "Not run" instead of listing every file as stopped part-way.

# Changes — v273 (Safari: keyboard way to a marker's details; a WebKit job you can trust)

- **Markers, keyboard:** Shift+F10 (or the menu key) on a focused marker opens its details. The app waited for the contextmenu event browsers make from those keys, and Safari's engine doesn't make one, so there was no keyboard way to the details there. The keys are now taken directly. Found by the WebKit job, confirmed in WebKit's own browser (WebKitGTK's MiniBrowser): nothing opened before, the details open now.
- **The WebKit job** (informational) was red on every run, and nearly all of it was how GitHub runs WebKit rather than Safari: turning a picture into sections or colours takes minutes there (about 2 s in WebKit itself), a second tab in the background doesn't run its animations, text measures differently with its fonts, focus settles later than the tests wait, it has no navigator.storage, and touch can't be made up in desktop WebKit. Each behaviour was replayed in WebKit's own browser first (focus after the sample opens, turning a phone sideways, the tool row, Mood's rows, Colour along's press and hold). The tests that fail only for those reasons are now left out of the WebKit job, each with its reason (`notOnWebKit(WK.…)` in `e2e/helpers.mjs`); Chromium still runs them all. The real Safari bugs this job and Ben's iPad found are fixed (v272: Colour along's open row, the Mark all done double tap, lining up with Fill, Share's pair; v273: the keyboard way to details). The error-message test now expects the error in the page's log at least once, as Safari words and reports it differently.
- **CI annotations:** one per failing test (10 as errors, then warnings, then notices), each on one line, so a run's failures can be read in full from its page.
- Cache bumped to `marker-studio-v273`.

# Changes — v274 (the WebKit job's last CI-only failures)

The first run with v273's list (run 13) left 10 failures on the WebKit job, each now readable in full. Each was replayed in WebKit's own browser (WebKitGTK's MiniBrowser):
- **GitHub's WebKit doesn't always draw a frame.** Animations then never finish (Palette's Draw, a toast's Undo that never becomes clickable), scroll events never come (a section's tip didn't close on scroll) and scroll-linked sizes don't follow (the pinned picture, 464 px at the top of the page against 380 px). In WebKit itself all of these are right: the animations finish, the tip closes, and the picture is 464, 404, 380, 404, 464 px scrolling down and back; the ⋯ sheet sits over the controls column side by side. Those tests (Palette's buttons, To buy's blend plan note, two tabs, the tip, the pinned picture, side by side) are left out of the WebKit job with that reason (`WK.frames`).
- **Photo:** the Pattern chooser test and "every state of the controls" choose a photo: left out with the photo reason.
- **Colour along's long press:** the press-and-hold timer runs late there (works in WebKit itself): left out.
- **The error-message test:** exact error counts in Chromium, at least one in WebKit, which words and reports errors differently.
- **Closing a dialog** with nothing to go back to (Safari doesn't focus a button that's clicked, so the opener is often the page itself) could leave focus on the closed dialog's Close button in GitHub's WebKit, so Tab would start from inside a hidden dialog. It's now let go. WebKit itself already moved focus off it, so this is a safeguard.
- 64 tests are left out of the WebKit job in all, each with its reason; Chromium runs all 478. Cache bumped to `marker-studio-v274`.
- **After v274 (tests only):** run 14 left 2 WebKit failures, both the same frame stall: a hidden toast still "visible" (its visibility changes at the end of a 0.2 s transition) and the sun's place after full screen. In WebKit itself the toast is hidden and the sun is 0 px off before, in and after full screen. Left out with that reason: 66 in all.
- **CI upkeep (no app change):** GitHub's actions moved to their Node 24 versions (checkout, setup-node and upload-artifact v4 → v7; their breaking changes don't touch this workflow), which ends the "Node.js 20 is deprecated" warnings; and the runners are pinned to Ubuntu 24.04, as ubuntu-latest becomes Ubuntu 26 from 19 October 2026 and the browsers this Playwright version installs are built for 24.04.
- **WebKit job, flaky rather than broken (tests only):** runs 15–17 each failed a few WebKit tests, nearly all different ones each time and most of them passing the run before: sizes and positions a few pixels off, or a banner not yet scrolled to, because a frame or a scroll event came late. Leaving each one out would never end. Instead each WebKit part now runs one test file at a time (they ran three at once on a four-core machine), in 6 parts instead of 3, and a failed test is run once more by its exact name (`e2e/ci-retry.mjs`; a whole file when it gave no results). A test that then passes is reported as flaky, as a warning on the run's page; one that fails again is a failure. The summary merges the two runs (`E2E_RETRY`). The 13 tests left out for frames and timing are back in the WebKit job; left out now are only causes that fail every time there (photos, fonts, touch, storage, speed): 53 tests.
- **The first retry run (run 19):** 5 of 6 WebKit parts passed, with one flaky test caught and reported as a warning ("while a marker picker is open", passed on its retry). Part 4 still showed a red "exit code 1" from the first pass, although the retry had passed: failed tests no longer fail that step, and the retry step (which now always runs after the tests) decides. Part 1 failed twice on the ⋯ sheet's place side by side at 1280 × 800 (at 667 × 375 in an earlier run): in WebKit itself it's in place at both sizes, so the test now waits up to 15 s for the sheet to arrive rather than assuming its slide has ended when the page goes idle.

# Changes — v275 (How it works always starts on Next)

- **How it works, opened over Help:** the main (Chromium) job failed once on GitHub (run 21) with focus on the dialog's ✕ instead of Next. Two things give a newly opened dialog focus: the dialog layer (layers.js) puts it on the first control 30 ms after the dialog opens, unless focus is already inside, and How it works puts it on Next itself. On a busy machine the layer can come first and choose ✕. A dialog can now name its first control (`data-first`), which the layer chooses too, so How it works starts on Next either way. It passed six runs in a row here; the change makes the order not matter.
- **The WebKit job's first all-green run (run 21):** all 6 parts passed, with one test flaky (failed, then passed on its retry). With one file at a time, the 13 tests that had been left out for frames and timing all passed. Both flaky tests seen so far were looked into:
  - **A picker's Done announcement (a real bug, for screen readers on a slow phone).** After Done, a screen reader should hear "B03 → Y315 …, 1 section"; the Undo step recorded straight after it announced its own vaguer "Section colour changed" unless it came less than 100 ms later. A slow redraw in between (a busy phone, or GitHub's WebKit, run 19) let it through. The step now leaves an announcement made in the same task alone however long the redraw took (`sayLive.now`). Checked with a clock made to run slow: the old code says "Section colour changed", the new one the picker's words.
  - **Turning a phone into side by side** (run 21): the picture's foot was still below the screen when the test measured. The resize reaches the page a frame or two later there; in WebKit's own browser the layout settles within a second. The test now waits (up to 5 s) for the new layout instead of assuming it's there when the page goes idle.
- **Run 20's flaky tests** (all 6 WebKit parts passed there too, with 3 tests flaky):
  - **Turning a phone into side by side:** the same as run 21's (above).
  - **Changing shading counts as an unsaved change:** the guide still read as unsaved just after Save. In WebKit's own browser the save finishes about 70 ms after the tap and nothing marks the guide changed again for the next 5 s; on GitHub's WebKit a late frame held the save past the page going idle. The test now waits for "Saved in your Library" (up to 10 s), and catches the shading change as it happens rather than after the page goes idle (the auto-save 1.5 s later would clear it again).
  - **The Change colour sheet at 375 × 667:** measured mid-slide. It now waits (up to 15 s) for the sheet to arrive, as the side-by-side ⋯ sheet check does.
- Cache bumped to `marker-studio-v275`.
- **Run 22's flaky tests (tests only):** all green again, with 2 flaky, both checked in WebKit's own browser: the ⋯ menu on an iPad in portrait is at the bottom (bottom 1024 px, 401 px tall), and Reveal reaches its Close button after about 5.7 s. On GitHub's WebKit the menu was measured mid-slide (the test now waits up to 15 s for it to arrive), and Reveal's animation, which draws the whole picture every frame, sometimes took longer than the test's 15 s (now 30 s).

# Changes — v276 (How it works keeps the card you chose)

- **How it works, on a busy device (a real bug, found by run 23's flaky test).** Next, Back, a dot or an arrow key glides the cards to the one chosen. The track also works out which card a swipe left it on, 90 ms after its scrolling stops; a pause in the glide (a busy phone, or GitHub's WebKit) let that check run half-way and put the dots back on the card before, so a quick second Next went to the same card again. While a chosen card glides into view that check now leaves it alone (until the glide arrives, or 1.5 s at most); a swipe of the track itself still counts at once. New test: the glide held still, a scroll event, the dots stay on the chosen card and a second Next goes on (it fails on v275).
- **Run 23's other flaky tests (tests only):** the ⋯ sheet in portrait and the sun after full screen were both measured before the page had caught up on GitHub's WebKit (the sheet mid-slide; the picture still easing to its new size, when the app places the sun again). Both now wait up to 15 s for the sheet at the bottom and the sun on the picture, as the other sheet checks do.
- Cache bumped to `marker-studio-v276`.

# Changes — v277 (Start colour, Highlights and Shadows, smallest section)

- **Pattern › Gradient, Start colour.** When the gradient goes right round the colour wheel, a slider chooses which colour its flow starts with. The strip above it shows the loop's markers, each under the slider's stop for it, and the label names the colour ("Start colour: R16 Light Salmon"). Once it's moved from the smoothest start, a line under it names the biggest colour step, which then falls inside the picture (all the way left keeps it at the two ends, where it always was). It's the setting Shuffle turns (`gradSeed`), so it's saved with the guide, Shuffle moves the slider, and Undo takes it back ("Start colour: …"). Direction keeps the chosen colour where the flow starts. A gradient that runs as an open ramp (Warm, Cool, a saved palette's ramp) has no Start colour. The picture follows the slider a moment after, as the marker count does.
- **Shading › Shadows: Same colour, Cooler or Grey.** Same colour is the shadow as before. **Cooler** takes a marker you own turned 8–40° round the colour wheel the cool way (reds and oranges towards red-violet, yellows towards yellow-green, greens towards blue-green, blues towards violet, violets towards blue-violet). **Grey** takes a marker from a grey family (Cool, Warm, Green, Neutral or Toner Grey, and Ohuhu's BGY and YGY), warm under a warm colour and cool under a cool one. Either is laid over the base, and alcohol ink is see-through, so the shadow is shown as that glaze (the two inks' light multiplied), not as the marker's own colour; the marker is chosen so the glaze is a clear step darker and not much stronger in colour than the base (two inks of near the same hue glaze to a stronger colour, which reads as brighter, not darker). Colour along's shadow step says "over the base".
- **Shading › Highlights (Light & shadow): Same colour, Warmer or Paper white.** **Warmer** takes a lighter marker turned 8–40° the warm way (always the opposite way to Cooler for the same colour). **Paper white** leaves the brightest part of the lit side white instead of using a lighter marker: it's about half the size of a marker highlight (the Highlight slider still sets it), fades into the base, has no step of its own in Colour along ("all but the lit side: leave it white, soften its edge"), prints as "— leave the paper white" in the key, and has its own how-to line.
- **The Shading tab's layout:** Highlights and Shadows sit side by side, each a choice of kind above its Amount slider (the Highlight and Shadow sliders, as before; with Shadows only, just the shadow's), under Roundness; "Show where each tone goes" is now "Show tone lines", on one row with Leave sections flat. That keeps the tab within one and a half screens at 390 × 844 with the two new choices.
- **Fallbacks:** a colour with no cooler, grey or warmer marker in your collection gets the same-colour shadow or highlight, as before; the note under the shading controls says which, and "Richer with" suggests a marker of the chosen kind to buy. Both settings are saved with the guide and taken back by Undo ("Shadows: Cooler", "Highlights: Paper white"), and an older guide opens with Same colour for both.
- **Min section size (Sections screen) starts lower, on a better scale.** It was 137 px (in the working picture's pixels), which dropped the sample jellyfish's 23 smallest sections (143 of 166). It's now 10 px, which keeps all 166 and still drops the specks of a few pixels a photo of a page leaves (on one of Ben's pages: 216 sections against 205, with 18 specks under 8 px still left out). The slider ran from 2 to 2,000 px by the square of its place, so almost all of it removed real sections; it now runs from 2 to 400 px evenly by ratio (each step the same share bigger). A guide saved before keeps the size it was built with: it's saved as `minSize` now, with `minPos` still written on the old scale for older copies of the app, and a file with only `minPos` is read on the old scale (26 opens as 80, the same 137 px).
- **Photo pattern, slivers:** with the smaller smallest section a picture can have slivers only a pixel or two wide, whose colour in a photo is partly line. A section narrower than 2 px from its middle to a line (`PH_THIN`) no longer chooses the Photo pattern's markers; it takes the nearest of those chosen, as a section too thin to sample already did. (On the sample coloured with 8 markers, a 10 px sliver had asked for a 9th.)
- **Help:** the glossary's H/B/S entry names Highlights and Shadows; What's new has a line for this release. Device checklist 2w.
- Tests: `e2e/gradient-start.test.mjs` (3) and `e2e/shading-styles.test.mjs` (5) are new; the style-fields tests and fixture cover both new shading settings and `minSize` (the fixture was re-recorded: the sample has 166 sections now, and two captures were added). With the jellyfish's 23 smallest sections back, the Photo pattern's line-up tests measure on the 143 sections big enough to read in their shrunk "photos" (the 23 are a few pixels across there), and the grainy-paper tests expect 21 sections: the 21st is a drawn sliver of about 40 px where two circles cross (the same size and place at both grains and with the table; the grain's specks are 1–3 px and still left out).
- **CI run 24 (v276) was all green**, with one WebKit test flaky: full screen's layout test measured the picture at 389 px while it was still easing back to 380 px. It now waits (up to 15 s) for the picture to reach its size after full screen and after focus mode, as the other layout checks do.
- Cache bumped to `marker-studio-v277`.

# Changes — v278 (Values, Colour along's order, Find next, the section-edits line)

- **Values** (the button with three grey bars in the tool row under the picture): shows the guide in greys, to judge its light and dark without the colours, the classic artist's check. It's a view only: not saved with the guide, not an Undo step, not in prints or shared pictures, and the sun, tips and outlines keep their colours. It's there on the guide, in Colour along and focus mode, and not in Edit sections (whose colours are a map of the sections, not the guide); it stays on until turned off. Greys are the browser's own (CSS `grayscale`), close enough to how light or dark each colour reads.
- **Colour along lists its markers lightest first** (then most sections first), as focus mode already goes through them: lighter inks down before darker ones beside them, which could bleed into them. Finished markers still gather at the bottom.
- **Find next goes through a marker the way focus mode does:** its topmost section first, then each time the nearest one not yet ticked (`markerPath`, shared by both). It used to follow the pattern's own order, so on a Random or Blend guide it jumped about the page.
- **The Sections screen's "Section edits not saved" line** came up when the Min section size slider was only nudged, although the same sections were kept (a notch either side of the default keeps all 166 of the sample's). It now comes up only when the slider changes which sections are kept.
- Help: the glossary has Values; What's new has a line for this release. Device checklist 2x.
- Tests: `e2e/values-and-order.test.mjs` (3).
- Cache bumped to `marker-studio-v278`.

# Changes — v279 (Zones)

- **Zones: part of the picture with its own pattern and colours.** Pattern tab › **＋ Zone** (beside "Colour pattern") opens the zone editor in the Pattern tab's place: the zone's name with **Done** beside it, how many sections it has, and **Delete zone**. The picture shows the zone's sections in their colours and fades the rest. A tap on a section, or a drag across several, adds them; starting on a section already in the zone takes sections out instead (back to Main). Two fingers still move and zoom, and the page doesn't scroll under a finger meanwhile. Each tap or drag is one Undo step, and the zone's pattern is laid again over its sections as they change. The keyboard doesn't come up by itself (it would cover the picture on a phone); opened from the keyboard, the name field takes the focus. Done, another tab, Colour along, Edit sections or Escape closes the editor; a new zone that got no sections isn't kept, and says so.
- **The chips.** With zones, Pattern and Colours start with a row of chips, **Main · each zone · ＋** (up to 8 zones besides Main). The chip that's on is the zone those two tabs edit; tapping another switches to it and its sections flash on the picture. Tapping the one that's on (✎) opens its editor again. Shading and Share are the whole guide's and have no chips. When the chosen zone has no sections (Main, once every section is in a zone), a line under the chips says so.
- **What a zone has of its own:** its pattern (Gradient, Random, Blend, Photo or Manual, with their settings), its colours (marker count, Colours from, filters, Temperature and Mood) and its Surprise. A new zone starts with the settings of the zone that was chosen. Each section is in exactly one zone; Main holds the rest and can't be deleted. Pins win over zones. A gradient's flow, Radial's middle and the bands run over the zone's own part of the picture; Blend's anchors are the zone's own, seeded inside it (a tap on a section in another zone says which zone that is). The Photo pattern takes colours from the guide's one photo in any zone that uses it, and a shared guide file keeps the photo when a zone uses it. A marker can be used in more than one zone; the guide's totals, the key and Colour along's whole-picture list count it once.
- **A tapped section's tip** says which zone it's in, with **Edit this zone** when that isn't the one chosen.
- **Colour along: Whole picture / Zone by zone** (with zones). Zone by zone lists each zone's markers under its name with how many are done; opening a row lights, ticks and finds only that zone's sections, and focus mode finishes one zone before the next. Within each, lightest first, and the top-then-nearest path from v278. The choice is remembered on this device.
- **Undo and saving:** Undo takes back zone changes like any other step, with labels that name the zone ("New zone: …", "Bell: 3 sections added", "Zone renamed: Bell", "Zone deleted: Bell", "Bell: Pattern: Random"). Zones are saved with the guide (older copies of the app open it with Main's settings, as before). Zones don't show on the print, which keeps one key.
- **Edit sections keeps zones:** a section left out and brought back returns to its zone; sections found again (Enhance) join the zone most of their pixels were in; a section made by splitting or merging joins the zone of most of its neighbours. If the picture's size changes, the zones go, and a message says so.
- Help: the glossary has Zone; What's new has a line; Keyboard and screen readers says choosing a zone's sections needs touch or a mouse. Device checklist 2y. GUIDE-LAYOUT has the chips and the editor.
- Tests: `e2e/zones.test.mjs` (14), `test/zones.test.mjs` (4). The seam exposes the zone model.
- Cache bumped to `marker-studio-v279`.

# Changes — v280 (Zones: what a fresh-eyes review found)

Two independent reviews of v279's Zones (one on saving, section edits and Undo; one on colouring, print and interaction) each reproduced what they found with a test. All of it is fixed, with tests that fail on v279 (9 in the browser, 2 unit tests).

**Zones on the wrong sections (Edit sections)**
- Sections found again twice before Build guide (dragging Sensitivity through a couple of stops; Enhance then Sensitivity; or a Build that failed in between) put the zones on unrelated sections, with no message. Where the zones were is now captured once, before the first re-detection since the guide was built, and kept until a build succeeds (`zonePixCapture`, `zoneBuilt`).
- Turning the picture 90° scrambled the zones instead of clearing them (a turn keeps the number of pixels, so the size check passed). Any change to the picture itself (turn, crop, straighten) now marks the zones as not placeable (`zoneGeoLost`), so Build guide clears them and says so ("turning, straightening or cropping").
- Undo in Edit sections brought back the sections and the guide's colours, but not the zones. The Undo step now keeps them (`zoneKeep` / `zoneUnkeep`), so zones cleared by a turn come back too, with their settings.
- Section edits kept while the page was hidden, right after a re-detection, saved the zones with the old section numbers, so on Resume they landed on the wrong sections. They're now saved where Build guide will place them (`zonePlace`), or left out when they can't be placed.
- Build guide with no edits moved a white (paper) section of Main, or one whose marker wasn't found on opening, into a zone around it. Those count as in the guide already (`zoneAfterEdit`).

**Colours that changed when they shouldn't**
- A tap in the zone editor rolled a Random Main again (or any Random zone a section left or joined), against "a Random zone keeps its colours". Sections that stay in a Random zone now keep their markers; only the sections that moved get new ones (`zoneStayRandom`). The re-roll was also why each tap repainted most of the picture.
- The "markers you can use changed" check started empty, so the first filter change after opening a guide only re-coloured the zone chosen, and the others kept markers now left out. After Undo of a filter change it went the other way: the next change to one zone re-rolled all of them. The check is now set whenever the zones are all as they were laid (Build guide, opening, Undo), and a zone that can't be laid no longer stops the others being drawn.

**Colour along and focus mode, zone by zone**
- Focus mode's "✓ Mark all … done" ticked the marker in every zone; it now ticks the zone's only. "Section x of y" counts the zone's sections.
- Switching Whole picture / Zone by zone emptied the Done group until Colour along was entered again; it's gathered again at once. In the Done group, zone by zone, each row now says its zone ("G410 Grass Green · Bell").

**Smaller**
- The Undo label for a section taken from another zone named that zone ("Bell: 1 section taken out"); it now names the zone being edited ("Foot: 1 section added").
- Renaming a new zone that never got sections was an Undo step, so after Done dropped the zone, Undo brought back an empty one. A zone with no sections is renamed without a step.
- A file made by hand could open an empty "ghost" zone (section numbers like "__proto__"). Only whole section numbers the picture has count now. (Nothing unsafe got in: names were already escaped everywhere.)

**Checked and sound:** print and PDF (one key, a marker in two zones counted once, section counts add up, nothing of zones on the page), shared pictures, the share card, HTML in zone names, save and reopen, plan Undo across zone steps, pointer handling (mouse, touch delay, pinch, cancel), touch-action restored on every exit, and speed (building every zone of 8 takes about 1 ms).

**Left as it is (a design choice):** Manual's tap and Paint can change a section in another zone, and "Pin colours · N" counts pins in the whole guide, whereas Blend's anchors and Fill stay in their zone. That fits "pins win over zones".

- Device checklist 2z. Tests: `e2e/zones-edits.test.mjs` (9), `test/zones.test.mjs` (+2).
- Cache bumped to `marker-studio-v280`.

# Changes — v281 (shading per zone)

- **Each zone has its own shading.** With shading on, the Shading tab has the zone chips too, right above the zone's own settings: **☑ Shade Bell** (a zone shaded, or left flat), **Roundness**, and **Highlights** and **Shadows**, each its kind (same colour / warmer / paper white; same colour / cooler / grey) and amount. A glossy bell can take paper-white highlights and be rounder while the tentacles stay softer, or a background zone can stay flat under a shaded subject. Main's are the guide's own settings (Shade Main beside other zones). The chips choose the zone for Pattern, Colours and Shading alike. Tapping the chosen chip (✎) or ＋ opens the zone editor on the Pattern tab, as before.
- **The whole picture's:** Off / Shadows / Light & shadow, where the light comes from and the sun's place, the tone lines, Leave sections flat, and texture: one light for the whole picture. These come first in the tab, then the chips and the zone's own; without zones the tab is as before, except that the tone-lines row and the "richer with" note now sit above Roundness.
- **Light from: one light, chosen, never switched by itself.** With a zone on the Photo pattern, Shading offers **Light from: The sun / The photo**, for every zone. It used to follow whichever zone's chip was chosen, so choosing a chip could switch the whole picture between the photo's light and the sun (a v279/v280 bug). Until you choose, it's the photo only when Main uses the Photo pattern (as a guide without zones always was), else the sun; a guide saved before v281 opens as it looked. With the light from the photo, sections the photo doesn't cover stay flat (they used to be shaded from its edge pixels, smeared across), and a line says how many.
- **A flat zone** is as sections left flat are: one colour each, one step in Colour along and focus mode, no tone marks in print. A section's tip says why it isn't shaded: "Bell is flat", "Left flat", "Outside the photo" or "Too small to shade" (it used to say "Too small" for a section you'd left flat). Leave sections flat on a section of a flat zone says it's flat already. With nothing shaded at all, there's no "Step through each tone", no how-to or tone columns in the print, and the note says every section is flat.
- **A new zone copies the chosen zone's shading, flat included**, as it copies its pattern and colours.
- **Gradient bands face the sun only where it lights them:** in a flat zone, or with the light from the photo, they run light at the top, as without shading.
- **One marker, other companions in another zone:** Colour along's row shows both ("H Y26 / paper · B G410 · S G46", then "+1 more"), wrapping onto a second line rather than being cut off, and opening the row lists each zone's; a screen reader hears each option ("highlight Y26 or the paper left white, …", a glazed shadow "over the base", "none" for a zone with no highlight). Focus mode and the tip show a section's own. In the printed key, such a marker has a line for each zone ("in Main", "in Bell", "in Foot", each with its highlight and shadow), and those zones are outlined on the key's picture, each in its colour with its name, so the lines can be followed on paper (Main is the rest; a guide whose zones all shade alike prints no outlines, as before). The page count allows for the lines. The how-to line says "a lighter marker, or the paper left white where the key says so" when zones differ. The "richer with" note, the to-buy list and the brand letters take in every zone's tones, and a marker whose sections are all flat has none of them.
- **Undo** names the zone ("Bell: Highlights: Paper white", "Bell: Shading: Flat", "Main: Roundness changed").
- **Saving:** each zone's shading is saved with it; Main's stay the guide's own, so older copies of the app open the guide with Main's shading everywhere (they don't know zones). A zone saved by v279/v280 opens with Main's shading, as it had then. `light` is still written for older copies (the sun only when it's chosen, else their own default); `lightSrc` is the choice. Deleting the last zone makes Main shaded again (there'd be no control left to turn it back).
- The Shading tab's ⓘ line mentions dragging the sun only when the sun lights something; with every section flat, the note says how to shade a zone again. A screen reader hears the zone's settings as a group ("Bell's shading"). Off / Shadows / Light & shadow and Light from keep the keyboard's focus on the button chosen (it went to the page).
- **Fixed while here:**
  - The printed and focus-mode H and S circles stayed where they were when the Highlight or Shadow amount changed (kept from before the change).
  - A section's photo tip went missing while another zone's chip was chosen.
- Opening another picture clears the zones only after any change still waiting to be saved has gone into its guide (in practice the save before it already did; now it can't depend on that).
- Help: the glossary's Zone and Shading; What's new. Device checklist 3a. GUIDE-LAYOUT: the Shading tab's order.
- The sun is hidden while choosing a zone's sections: a drag that started on it moved the light instead of picking sections (found trying this on a photographed page, where the sun sat over the drawing).
- A fresh-eyes review before release found, and this release fixes: "Shade Main" not coming back with the zones after Undo in Edit sections; a guide opening with no zones left keeping Main flat, so the next zone made Main flat; a section finished by the photo's light being un-ticked on reopening until the photo had loaded; Gradient zones not turning when the light changed by itself (Main's pattern to or from Photo under auto); the brand letters' cache not following the light.
- Tried end to end on two of Ben's photographed pages as well as the sample (216 sections each: zones by drag, per-zone shading, a flat zone, Colour along, focus mode, the printed key, save and reopen).
- Tests: `e2e/zones-shading.test.mjs` (12), `test/zones.test.mjs` (+4), `test/style-fields.test.mjs` (+1); the style golden re-recorded (only the new `lightSrc` and `main`; everything else saved exactly as before); the zones height test covers Shading.
- Cache bumped to `marker-studio-v281`.

# Changes — v282 (test strip, Radial's centre, zone follow-ups)

- **Test strip** (Share › Print › Pages › **Test strip**). The app can only predict how a marker looks on your paper, and how a layered or glazed shadow comes out. This prints a page to find out:
  - A row per line of the key, numbered as the key is: 7a, 7b where zones shade a marker differently, with "in Bell" in the zone's colour.
  - Each marker gets a box to colour once and then again on its right half (×1/×2), once however many rows it has.
  - With shading, a long box in thirds shows the highlight, base and shadow as the guide lays them. "S … over B" is a glaze, "S: B again" a 2nd coat, "H: paper" white paper, and "flat, no tones" a marker whose sections are all flat.
  - With blend companions and no shading: lighter, colour, darker, only markers you own.
  - Under each box, a thin bar in the screen's colour, a little apart so ink doesn't creep into it.
  - The page also has a word-wrapped how-to, "Paper: ___ Date: ___", and the swatch chart's corner marks.
  - It follows Letter/A4/A5/Half; the pocket sizes get a column a page.
  - Labels and Darker labels grey out, as they have nothing to label, and the shading note under them describes the strip.
  - The file is named "…-test-strip.pdf". The choice isn't stored, so the app opens next time on Page + key or Key + reference, whichever you used before.
- **Radial's centre.** With Gradient › Radial:
  - A ⊕ on the picture marks where the rings start. Drag it (the rings follow as you drag; the whole drag is one Undo step, "Radial centre moved") or move it with the arrow keys, a twentieth of the picture per press.
  - The line under Flow says "Centre: the middle" or "Centre: moved", with **Back to the middle**.
  - The ⊕ is on the Pattern tab only: not in the zone editor, Colour along or Reveal.
  - Each zone has its own centre, and a new zone's rings start in its own middle rather than at a point moved for another zone.
  - It's saved with the guide (`radC`, and in each zone's style). Older copies of the app ignore it and use the middle.
- **Greys in Random, Blend and Manual.** Their markers are thinned from your collection by spreading picks round the colour wheel, so greys came in as often as they're in your collection: black among 6 markers, two greys among 8 covering a third of the picture. Now:
  - Colours come first.
  - One grey (a mid one, not the black) joins at 12 markers or more.
  - Greys fill the rest only when the Temperature and Mood leave mostly greys.
  - "Grey" here means the grey families, black and near-whites. Pastels and dark browns, though low in chroma, are colours.
  - A saved palette you chose keeps its greys, thinned as before.
- **A colour's highlight and shadow are never the same marker.** A light cooler marker could be both a colour's highlight and, laid over it, its shadow. The shadow now takes the next cooler or grey one, or the same colour's darker one.
- **A cooler or grey shadow (a glaze) is laid once the base is dry.** Colour along and focus mode now treat it like a 2nd coat: the base on each section, then a second pass for the shadows. Its step says the shadow goes "over the base once it’s dry", and so do the how-to and Colour along's tips, when some shadow is a glaze.
- **Zones:**
  - **Paint colours only the zone being edited.** A stroke across the picture leaves other zones' sections as their own pattern made them, and a message says how many it left.
  - **Manual:** a tap on another zone's section opens its tip ("Zone: Main", **Edit this zone**) instead of this zone's marker picker.
  - **Focus mode, zone by zone:** the Colours sheet has a chip for each marker in each zone, naming the zone, in zone order. A chip goes to that zone's sections.
  - **By keyboard:** in the zone editor, Tab reaches **Choose sections with the keys**, which stays out of sight until then. It gives the picture the focus: the arrow keys move a ring to the nearest section in that direction, and Space or Enter adds it to the zone or takes it out (one Undo step each). A screen reader hears the ringed section's marker and zone, and each change with the new count. When zoomed in, the ring stays in view. Escape closes the editor and returns the focus to the zone's chip. Help's keyboard note says how.
  - The glossary's Zone example is a flower against its background (it was the sample's bell).
- **Licence.** From v282 the code is all rights reserved: published to be read, not reused (LICENSE, README, package.json `UNLICENSED`, and a line in Help › About). The fonts keep their SIL Open Font License.
- A fresh-eyes review before release found, and this release fixes:
  - A marker you own (the highlight) was suggested as a shadow to buy when it was the only fitting cooler or grey.
  - The ⊕ didn't follow the picture when zooming, panning, going full screen or resizing unless shading had been used.
  - A tap in the zone editor put the keyboard's ring on the picture. The ring is now for keyboard focus only, and a tap clears it.
  - Undo back past a zone's making left the picture in keyboard mode: arrows and Space scrolled the page.
  - A second finger lifting during a ⊕ drag split it into several Undo steps.
  - A moved centre carried over to a new picture.
  - The test strip split a marker's rows (4a, 4b) across pages, clipped long tone labels, and could drop how-to lines. A marker's rows now stay in one column, "over B" has a line of its own, and the how-to takes the lines it needs.
  - Focus mode's second pass (2nd coats and glazes) said "section 5 of 5" at every step. It now counts its own sections.
  - The glaze notes went by the kind of shadow chosen rather than whether any shadow is one.
  - The picture's keyboard label didn't follow a rename.
  - Clearer wording: the Paint message, "Radial centre back to the middle", "Centre: in the middle".
- Help: What's new; the keyboard note. Device checklist 3b. GUIDE-LAYOUT: the zone editor's keyboard button, Radial's line and ⊕.
- Tests:
  - New e2e files: `e2e/test-strip.test.mjs` (3), `e2e/radial-centre.test.mjs` (2) and `e2e/zones-colouring.test.mjs` (4).
  - Unit tests: `test/gradient.test.mjs` (+1, greys), `test/shading.test.mjs` (+2, highlight ≠ shadow and glazes as a second pass), `test/style-fields.test.mjs` and `test/zones.test.mjs` (`radC`).
  - The style golden was re-recorded: with `radC` taken out, all 53 captures hash exactly as before.
- Cache bumped to `marker-studio-v282`.

# Changes — v283 (Random's Balance)

- **Balance** (Pattern › Random): **Mixed | Main colour**.
  - **Main colour** lays one colour family over about 60% of the picture, a second over 30% and an accent over 10%, by area. A bar shows the three roles in their markers' colours ("Greens · 60%", "Teals · 30%", "10%").
  - Tap a part of the bar to choose its colour: a sheet lists Auto and your colour families as strips of your own markers, with how many you have. **↻ Other pairings** rolls the roles left on Auto for a different pairing. A line under the bar says what's used ("9 greens, 5 teals and 2 violets of yours").
  - **Mixed** is Random as it always was, now with **No repeats**: every section gets a different marker. With fewer markers than sections, each marker is used once before any is used twice, with repeats kept apart. The marker count then reads "one per section".
- **How Main colour chooses:**
  - **Colour families go by how a marker looks, not its code.** Hues are measured the Oklab way, which keeps saturated blues apart from violets; browns and beiges, and greys, have their own families.
  - **The marker count is shared** about half to the main colour, a third to the second, and 1–2 accents, each role spread from light to dark. With shading on, markers nearer the middle are taken, so each still has lighter and darker companions.
  - **Auto:**
    - The main colour is a family of the Temperature's. Any family can be used if none of those can, or once you've chosen a role yourself; Temperature then greys out ("Main colour sets this").
    - The accent is the family most across the colour wheel, with bright markers. With the Pastel mood, it's the one whose lightness stands out most. Any bright colour can be the accent for greys.
    - The second is a family next to the main colour, or browns with a warm one.
    - A family with too few markers borrows the nearest in hue from next to it, and the line says so ("1 red, with 1 pink and 1 orange"). One role that can't be filled leaves two (70/30).
  - **A saved or generated palette** is used whole: its biggest colour leads and its other colours join the role nearest them.
  - **Choosing a family another role has** swaps them. Families that can't fill a role are greyed in the sheet.
- **Laying it out:**
  - Roles go by area. Accents go on middling sections spread over the picture, never the biggest nor slivers too small to colour.
  - A zone of fewer than 10 sections has no accent.
  - Pinned sections keep their markers and count towards their role's share.
  - "Keep touching sections clearly different" holds in Main colour too, taking another role's marker where a role's own all look alike.
  - Shuffle lays it again with the same colours.
- **Defaults:** a guide that switches to Random now starts on Main colour, with a first pairing that varies from guide to guide. A Random guide saved before v283 opens on Mixed, exactly as it looked. Each zone has its own Balance.
- **Surprise** picks Random with a main colour about one time in three, its roles the generated palette's own colours. Its message says so ("Triadic palette · Random, main colour yellows, with oranges and a violet accent · …"). The random numbers for the palette are drawn as before, so a Gradient Surprise comes out as it did.
- **Undo** names each change: "Balance: Main colour", "Main colour: Blues", "Accent: Auto", "Other pairings", "No repeats on".
- **Fixed:** the Print sheet could sit a few pixels below the picture in Safari. The app placed it before WebKit had finished the scroll that pins the picture, and only moved it when the picture changed size. It's now placed again a frame later, and on every scroll. This was the WebKit flaky test (tabs.test.mjs).
- **Found by a fresh-eyes review before release, and fixed:**
  - Speed: accents were chosen in time that grew with the square of the number of accents, 4–5 s on 3,600 sections. It's now about 0.2 s. No repeats took 10–15 s with Keep touching sections different on; it's now about 0.7 s.
  - No repeats could put the same marker on touching sections with few markers.
  - Temperature could stop Main colour altogether.
  - The accent vanished on pictures with very many small sections.
  - Lemon yellows were counted as yellow-greens.
  - Bar labels could have poor contrast and hide their percentage.
  - The notes were wrong in several cases: No repeats with few markers, small zones, palettes, borrowed markers.
  - "They swap" didn't swap when the other role was on Auto.
  - Other pairings could repeat the same pairing, and now says so when there's no other.
  - Showing No repeats' note made a generated palette.
- Help: the glossary's Random; What's new. Device checklist 3c. GUIDE-LAYOUT: Balance.
- **Tests:**
  - `test/balance.test.mjs` (10): families, Auto, by hand, thin families, areas, pins, palettes, No repeats, neighbours, speed.
  - `e2e/balance.test.mjs` (7).
  - The Random "keep touching sections different" test covers Main colour too.
  - The style tests and golden now include the six new settings. With them taken out, only the three Random states changed (Random now starts on Main colour); the other 50 are as before.
- Cache bumped to `marker-studio-v283`.

# Changes — v284 (usability: Plan, Colour along and Print)

From a usability review (four reviewers on phone and iPad), a pressure test of its 26 recommendations against the code, and a check of how the changes interact. Saving on a guide's first change, the Resume card, the iPad layout and a full icon set are for v285.

**What you've coloured stays put**
- **Sections with ink on the paper keep their markers** through any change to the plan: Shuffle, Surprise, a pattern, a marker count, a palette. That's ticked sections and part-done ones (a tone ticked). They're pinned only while the plan is laid, so nothing is saved as a pin, there's no pin ring and no "Section pinned" step. Undo leaves them as they are too. Before, they were recoloured and stayed ticked, so the guide no longer matched the paper.
- **Their shading keeps too:** a coloured section keeps the Shadows and Highlights it was coloured with when those change (the whole section's, so its tones still match). Saved with the guide where they differ.
- **A line under the tabs says so** when a change would have recoloured them: "Kept 8 coloured sections as they are · Recolour them too ✕", and those sections flash outlined on the picture. Once per visit to the plan, and again when more are kept; it stays until it's used, closed or undone, following any change made meanwhile. (Not a toast: a toast sits where Shuffle and Pin colours are, and a tap meant for them could have recoloured the sections.) **Recolour them too** lays them again, unticked, as one Undo step that puts the ticks back.
- **A part-coloured guide opens in Colour along** (from Home or the Library); new and finished ones open in the plan. Home's cards say how far each is coloured.
- Choosing a saved palette no longer asks "This will re-map the current guide"; it's one Undo step.

**Balance (Pattern › Random)**, fixed (v283 mislabelled parts and showed fixed figures)
- **The bar shows what's painted:** each part as wide as the area in its markers, its figure to the nearest 5. In v283 a part labelled 10% could cover half the picture.
- **The cause:** where a part's own markers were all on neighbouring sections, the least-used marker of any part was taken, and that was always an accent's. Now every section is laid biggest first, to whichever of the main colour and the second is further short, and a part borrows from the other of those two, then (only on a section no bigger than an accent) an accent's.
- **A palette's other colours** join a part only within 60° of hue of its own markers; one further from them all is an accent, and an accent of two colours or more is "Accents", with 15% of the picture instead of 10%.
- **One marker can lead a palette's main colour** (a 2-colour palette lays 70/30); a note says touching sections will merge, with **Add shades** (turns on Expand with nearby markers).
- When a part misses what was asked by 8 points or more, a note says why (the sections' sizes, or too few markers to keep touching sections apart).
- Tested on six pages (both of Ben's, the sample, a mandala and two made-up ones) with several collections and palettes, 576 layouts: the gap between asked and painted averaged 13.5 points before and 3.8 now; colours far from their part's hue on the main or second colour: in 119 layouts before, none now.

**Colour along and Focus**
- **The Codes button works in Colour along** (it did nothing there): off, every section shows in its colour and the done ones keep a ✓. **A finished page** shows the picture in its colours, and the banner says what was coloured and when ("166 sections · 16 markers · started 12 Sep, finished today"; the dates are saved from v284; a page coloured before then gives none).
- **"Done colouring" is "← Plan"** ("Back to the plan"), like the plan's "← Edit sections".
- **Find next** goes to the section's label point (always inside it), zooms to fit it (as focus mode does, always in a little), outlines it, and says "Next section to colour: 3 of 9 left".
- **Focus mode:** a picture that fits sits in the middle of the space between the bars (before, a big section near the top left a black band above the picture); one that doesn't fit fills it, the section off-centre near an edge. With shading, the highlight, base and shadow are chips on a line of their own, the step being coloured lit; the tips are on the line under them, no longer cut off with "…".
- **Codes on the picture** are never under 6 screen pixels at the zoom they're seen at (their sizes went by the photo's own pixels, so on a phone many came to 2–4 pixels). A section too small for one shows a dot until you zoom in (in focus mode, its code always). They redraw in steps as you zoom.
- The first time Colour along keeps the screen on, a toast says so.
- **Save image** has "Codes on the saved image" to tick off.

**Print**
- **Labels on the colouring page never overlap.** Placed biggest section first: a code shrinks to the least size, then the marker's key number is tried (the key then has its numbers column), and a section with room for neither gets a dot and a place in a close-up. On Ben's pages about 45 of 216 sections go to close-ups with Codes, about 30 with Numbers; before, they printed on top of each other.
- **Close-ups:** up to 3 pages after the colouring page, each a part of the picture magnified (1.75–3×) with its labels, its own small sections labelled first and every label inside its edge. Each is lettered A, B… with a light dashed box on the colouring page, the letter in a corner of the box clear of the labels. The Print sheet says how many sections are on how many close-up pages, and that Numbers would fit more of them on the colouring page. Any that still have only a dot (a very busy picture) are counted there and under the last close-up: "14 more small sections have only a dot on page 1: see them in the app, or print with Numbers."
- **The key** has a box to tick for each marker and an ORDER column (1st, 2nd … lightest first, as Colour along goes, so it can't be taken for the numbers beside it); it keeps its colour-family order and numbers. Its code column is as wide as the longest code, so names keep more room.
- **A tall picture's reference** sits beside the key in Page + key too, when the key fits that column (it was a sliver across the top).

**Plan and the rest**
- Edit sections: each slider says what turning it up does ("Higher: small specks left out of the guide"). After **Keep as is** on a page the finder wasn't sure of, "Page kept as photographed · Straighten" stays offered. (Prompting whenever the finder rejects an outline was tried and dropped: on the test pages it fired for clean digital line art, and not for Ben's photos.)
- **The tool row fits at 375px** in its busiest case (Photo, zoomed in, Undo showing): a last step narrows its buttons. Its buttons' tap areas also cover the 4px between them.
- **Toasts:** one with a button lasts 8 s and stays while it's pointed at or has the keyboard's focus. The first Save says "Saves itself from now on ✓" in the header instead of a toast over the tabs.
- **Words:** Blend's Mix is Muted · Vivid · Like paint (Soft is Mood's); Filters' shortcuts say Warm only / Cool only (Temperature only leans).
- **Markers:** a search in Owned or Unowned says how many more are in All, with Show ("R23 isn't in your collection"); a ✕ clears it. Unowned markers in All show their true colour with a dashed edge. A link at the top jumps to the sets, swatch chart and backup. Tick/Untick all shown are spaced from the grid at full contrast.
- **Match:** a result's rating is muted text after four dots filled by closeness, not a bold word that looked like a Close button.
- **Palette:** the card shows the name the Library saves it under, the scheme under it; Photo before a photo has its own empty card; a line under Harmony says what each does; Library and Save image are in a ⋯ menu beside Save; Reset is Clear.
- **Library:** delete is a bin, not a ✕ like Close.
- **Screen readers:** an h1 (the app's name), the main menu as navigation, the main landmark, each screen's name as a heading, dialog and sheet titles as h2s, the guide's group labels as h3s.
- **Look:** sheet titles are set as dialog titles are (the serif, one size); one focus-ring colour (white over the picture); the two 12px text sizes have one name; "Within your filters, lean toward…" is no longer in capitals.
- **Fixed before release** (from a fresh review of v284): Blend's anchors and Spread, a light-to-dark Gradient turning to the light, and the Photo pattern's photo kept coloured sections too, as every other change does; Recolour them too can't lose ticks with no Undo step; Undo after Clear ticks, or after editing sections, keeps the kept shading and the dates; the finish date follows a page ticked complete again; the palette's "Using…" toast no longer covers the kept-sections line; a finished page shows at fit; Photo's waiting pattern is kept per zone; the Find next outline goes with the next tap; the Print page's labels are measured by their ink, not a box twice its height; the line under the title can't run into the picture. Focus mode's header fits a 320 px screen at a big text size, and Filters' Warm only / Cool only stay on one line there.
- Help's What's new; device checklist 3d; GUIDE-LAYOUT: the sheet/dialog rule and Balance's bar.
- **Tests:** `e2e/held.test.mjs` (5), `e2e/finish-and-codes.test.mjs` (5), `e2e/v284-polish.test.mjs` (4); Balance (`test/balance.test.mjs` +2, `e2e/balance.test.mjs` +1), print (+1, and its checks follow the close-ups and their letters), Markers, Match and Palette (+11); the style golden re-recorded (only the Random states changed).
- Cache bumped to `marker-studio-v284`.

# Changes — v285 (Home, saving, iPad and icons)

Every decision was pressure-tested twice (each on its own, then together) and the layouts were chosen from screenshots of working prototypes on an 11" iPad, a 13" iPad and a phone, with a page-shaped picture as well as the tall sample.

**Saving**
- **A guide from your photo goes into the Library by itself once it's built** ("Saves itself from now on ✓", then "Saved in your Library ✓"); no Save to press. A guide saved as built, with nothing coloured, isn't counted by the backup reminder until it changes.
- **The sample joins the Library only once you change it** (a tick, a pattern, a rename…): until then the header says **Sample**, with a line under the tabs ("This sample isn't in your Library yet. Change anything to keep it.", ✕ to close), and nothing is kept, not even for Resume. Looking around (codes, zoom, tabs, Colour along, the menu) isn't a change. It's kept as "Sample jellyfish", the next as "Sample jellyfish 2", and so on.
- **A guide deleted in the Library while it's open stays out** (nothing saved, not even to the autosave slot) and the header says "Removed from your Library" with **Put back**, which puts it back as the same entry, with any changes made meanwhile.
- **A first save that fails** (storage full) says so once, offers Share › Guide file, keeps the guide for Resume, and gives the header a **Save** to try again; the next change tries again too.

**Home**
- **The Continue card:** the newest guide part-way coloured, drawn as you've coloured it (the rest of the plan pale), how far ("72 of 216 coloured"), and the marker to pick up next. **Continue** opens Colour along at that marker (one part-way done, else the next lightest), its row open.
- **New colouring guide** and the three cards sit beside the Continue card on an iPad and under it on a phone; New colouring guide is the second choice there (outlined). **Your guides** are the others: a grid of pictures on an iPad (three, four on a wide screen), a sideways strip on a phone, each drawn from its sections. The intro line shows only before there are any guides.
- Home's cards have line icons on soft tiles in marker colours.

**iPad**
- **Portrait** stays one column on every iPad (the 13" was side by side, with a small picture and the bottom third empty) and uses the screen's width (up to 900px, not the phone's 600px column). The picture starts at 60% of the height and shrinks to 50% as you scroll; Colour along's is 60%.
- **Landscape:** the picture fits the screen below where it starts as the page opens (before, it was sized to the whole screen but started under the app's header, so its foot and the tool row were off the bottom), and its column is as wide as the picture and its tools need (at most 60%, the controls keeping 340–560px), centred. A very tall picture comes out a little smaller, but whole. (Landscape phones, under 600px tall, keep the picture the screen's height.)
- **Tabs** are as tall as the tallest one when that's less than the screen: on an iPad in landscape the page no longer scrolls 260px into empty space under a short tab, and switching tabs still moves nothing.

**Icons**
- Line icons (Lucide, credited with Feather in `src/assets/icons/LICENSE-Lucide-Feather.txt`) replace the emoji and the symbols on buttons: Surprise and Reveal's sparkles, ⋯, ✕, Undo, rename, zones' ＋, Shuffle, Other pairings, Blends, Focus mode, the sun, the radial centre, Random and Match, warnings, Done's chevron, Turn left/right. The tool row's own Codes and Values are redrawn to match. ✓ and the arrows in words ("← Plan") stay as text. One sprite in the page (`src/html/icons.html`), drawn with `ic()`.

**Colouring**
- **Shading on part-coloured sections:** the highlight stays once anything in a section is coloured; the shadow stays once its shadow tone is coloured or the section is ticked (the shadow always comes last). Until then a section's shadow follows the Shadows setting. Guides saved by v284 keep their sections' shading as saved.
- **Blend › Mix** has a line saying what the chosen mix does ("Colours mix as layers of ink do: blue and yellow make green.").
- **Straighten:** a photo from a camera (it says what lens took it) that the page finder left as it was now gets "Page kept as photographed · Straighten" (not for a page already square to the camera, or one that fills the photo); Straighten starts with the corners where the finder guessed them. Digital art and scans carry no lens, so it stays quiet for them as before. (A proper rebuild of the finder waits for about 30 real page photos to tune it on.)

**Found by the pre-release review (each reproduced first; tests in `e2e/v285-review.test.mjs`)**
- Home's two columns never showed on an iPad: an older rule kept Home to the phone's 440px column. It now uses the width as designed.
- Narrow landscape phones (640–667px wide, an iPhone SE/8) cut off the right of the controls column; the two columns now give way so both fit.
- A name half-typed when the guide saved itself for the first time was saved, and Escape didn't take it back. The automatic save now leaves a name being typed alone.
- Put back could lose the guide's stored picture and progress if the Library's delayed delete landed while it was being written; Put back now cancels that delete first.
- Home redrew the Continue card's picture after every save while you coloured (and kept each one): it's drawn only while Home shows, one per guide. It now follows a Library rename too, and never adds "next …" twice.
- The marker sets' caret turned back into a ▸ after the first tap; the sun hint read "Drag the on the picture" to a screen reader; the warning icon on a palette swatch had no words for one.
- Continue could leave a flag on, so a later reload of a guide jumped to a marker; it now applies to the one open it was for.
- For a guide coloured zone by zone the card could name a marker Colour along doesn't open at; it doesn't name one there.
- A sample whose build stopped short (every marker dry, say) never counted as changed afterwards, so its colouring wasn't kept.
- Whether the sample has changed is worked out at most every 400ms for the status line (it builds the whole guide), afresh for every save.
- The header now makes room for "Not saved — use Share › Guide file" when the browser blocks storage; Save stays in place (saying Saving…) while it tries again; a failed page finder no longer offers Straighten; sheets' buttons keep a button's size on a wide iPad sheet.

**Tests and docs**
- `saveGuide(page)` and `letterGuide(page)` helpers (a Letter-shaped line-art page drawn for the tests, `e2e/fixtures/letter-page.png`); the Save-button tests rewritten for the new model; new tests for the sample, Put back, failed first saves, the Continue card, Home with no guides, the iPad layouts and the shading hold.
- GUIDE-LAYOUT: the side-by-side query, iPad picture sizes, tab heights, the status line. Device checklist 3e. Help's What's new.
- Cache bumped to `marker-studio-v285`.
- Full run: 184 unit tests and 581 browser tests pass (one palette test made steady: the small test collection could draw the saved palette again).

# Changes — v286 (a fresh-eyes bug review of v285)

Three independent reviewers went over v285 after it was finished: one on saving and data safety, one on the guide screen's logic, one using the app in a browser at phone and iPad sizes. Each fix below was reproduced first and has a browser test in `e2e/v285-review2.test.mjs`.

**Saving**
- **Changes in the last moment before a reload or closing the tab were lost** (about the last 1.5 s: ticks, a pattern change), because the browser drops a database write started as the page goes. They're now kept in the browser's small storage at once and put into the guide at the next start, unless another tab saved it since. A phone switching apps saves straight away too.
- A guide's section edits left for Resume by an earlier visit were deleted when the same guide was opened another way (from Home or the Library) and changed; they're now kept as "… (section edits)" first, as when a new guide takes Resume's place.
- A guide deleted from the Library while open, with section edits not built, came back through Resume when the page was hidden. It stays out.
- With storage blocked, opening something else after changing a guide just failed again and again. It now asks: Cancel (then Share › Guide file keeps it) or Open anyway.
- Discard edits on section edits brought back by Resume now leaves the Library guide untouched and drops the copy kept for Resume; discarded edits of a guide not in the Library aren't offered for Resume again.
- A guide that failed to open removed itself from the Library if it had been imported earlier in the same visit; only a guide just imported, that never opened, is taken out again.
- Another tab's save went unseen while this tab waited to save nothing; it now reloads it.
- A guide whose stored copy is missing says so, not "the file isn't a Marker Studio guide".

**Home and Library**
- Continue opened Colour along with the marker's row scrolled away again by the change of stage; the row is now on screen, clear of the picture and the bar.
- The Continue card doesn't name a next marker that's dry or not owned (the guide shows its stand-in there), and a screen reader hears the next marker.
- The Library said "All guides are in a backup" when none had been made (guides saved as built aren't counted as at risk); it says "Not backed up yet".

**Guide screen**
- Reveal: a section's tip left open went with it, so the first Escape closed the hidden tip; switching tabs or opening Reveal now closes the tip. The keyboard goes into Reveal's bar and back to Reveal & share when it closes.
- Adjust photo's ▸ is a line icon now, and it and Add a set you own say whether they're open.
- A renamed zone's chip has its new name for a screen reader too.
- Singular wording: "1 marker", "1 anchor", "Editing Main: 1 section", "The R23 section ticked".

**Welcome**
- On a landscape phone the marker sets were a list scrolling inside another scrolling area, showing only a sliver; it's one scrolling area now.

**Noted, not changed**
- Section edits not built yet are kept when the page is hidden (a phone switching apps), but not when the page is reloaded within a moment of making them.
- With larger text, some buttons and chips keep their size while the text around them grows.

**Tests and docs**
- Cache bumped to `marker-studio-v286`.
- Full run: 184 unit tests and 592 browser tests pass.

# Changes — v287 (a second fresh-eyes review: bugs fixed, the next version mapped)

Five independent reviewers went over v286: saving and data (code), the guide's logic (code), a stress test in a browser, a hands-on UX walkthrough at iPad and phone sizes, and words, consistency and accessibility. Each fix below was reproduced first and has a browser test in `e2e/v287-review.test.mjs` (all 11 fail on v286). What's left for decisions is in `docs/REVIEW-v287.md`.

**Saving**
- v286's "kept as the page goes" had problems of its own: it could keep a colour only being tried in the picker (and a later start would save it), it changed the Library row at once (so this tab, or another one open on the guide, took it for another tab's save: a false "merged" message, or the other tab reloading the old copy and later saving over the kept changes), and when it couldn't be put into the guide the row still showed the changes. Now nothing is kept aside while the picker is trying a colour, the row is left alone, and it's updated only once the kept changes are in the guide (with a new time, so another tab open on it reloads it). A save that lands meanwhile makes them unneeded, and they're dropped.
- A new guide from a photo was lost if the page was reloaded or closed within about 2 seconds of Build; it now goes into the Library straight away.

**Guide screen**
- Zooming in Edit sections (or into Crop or Straighten) repainted the plan's colours over the sections 160 ms later; so did coming back from Markers or Palette after a Reveal earlier in the visit (which also redrew and moved the keyboard each time the guide was left).
- A Temperature none of your markers have (a warm-only collection, then Cool) showed the old choice while using the new one, was saved, and later stopped Build guide with nowhere to change it. It now stays as it was and says "None of your markers are cool — choose another Temperature"; a build after the collection changed falls back to Any.
- Reveal: the page behind it is inert, so Tab can't reach (and change) the controls hidden under it; a recording stopped by Close or Replay can't come back late, and its capture stream ends.
- Focus mode: ticks there now stamp when the page was started (it was stamped on leaving, so a page started and finished in one go read "today"); leaving after moving on opens the marker it was on, on screen, not the one it started from (left at once, the row stays as it was).
- Everywhere and Fill in Change colour no longer recolour a section with some of its tones coloured (any ink on the paper keeps its marker, as everywhere else since v284).
- A picture wider than about 3:1 was stretched on a phone (a 4:1 picture drawn 36% too tall); it keeps its shape, in the middle of the frame.
- 320×568 with large text: the tool row ran 30 px under the bottom bar; the picture's least size gives way there (down to 100 px).
- The zone tip's "Edit this zone" from Shading or Share switches tab before taking you to the zone, so the keyboard lands on its chip.
- Print › PDF shows "Preparing…" while it draws.

**Words**
- Every marker dry: "Every marker you own is marked dry — un-mark some in Markers", not "No markers in your collection".
- Sections of an imported guide whose marker the app doesn't know: it says how many stay white. A guide file with no markers at all is refused.
- Singulars: "1 marker", "1 section" on printed pages and the saved image, "Only 1 marker close enough", "The one marker you own", "1 colour" in the selection bar, shading's "with a second coat".
- "None of your markers match the filters", "towards", "make one in Palette, or use Share › Save as palette", "Min section size" (as the slider says), "Enhance (under Adjust photo)", "section edits" (not "manual edits"), "Press and hold", "blend companions", "JPEG or PNG" and "couldn't be opened as a picture", "Couldn't find the drawing — use Crop to choose it", "Couldn't load the sample. Try again" (it showed nowhere before), "›" in Help's paths, "+ Zone" and "Focus mode" in What's new, the unreadable-data note's "Download the original" (it was "Save a copy", like the guide's), and the restore question says what OK and Cancel do.
- On the start card, only the brands you have ("120 markers from your collection (Ohuhu)").

**Accessibility**
- The Blend plan's colour groups were divs: closed, with no way to open them by keyboard or screen reader. They're buttons that say whether they're open, with line-icon chevrons and a full-size tap.
- Names for the Saved palette and Harmony dropdowns, the Palette and Markers choice rows (Harmony, Colours, Show), the selection's Clear, Auto crop, each palette band's lock ("Lock R46"), and Delete in the Library; "← Edit sections" says its own words; dialogs read their question; the ink choice is pressed buttons like every other row; Adjust photo's caret is a line icon with its state; the finished page's Reveal & share has a full-size tap.

**Tests and docs**
- `e2e/v287-review.test.mjs` (11 tests); tests updated for the new wording.
- `docs/REVIEW-v287.md`: the review, what was fixed, and the next version mapped.
- Cache bumped to `marker-studio-v287`.
- Full run: 184 unit tests and 603 browser tests pass.

# Changes — v288 (the next version from the v287 review)

The decisions in `docs/REVIEW-v287.md`, pressure-tested before building. New browser tests in `e2e/v288.test.mjs`; tests that described the old behaviour were updated.

**Colour along looks like your paper**
- What you've coloured (ticked, or any tone) shows in its marker's colour and the rest pale, as on Home's Continue card (one shared tint). With a row open, its sections still to do are full colour and outlined, coloured ones softened, the rest very pale. Codes off still shows the whole plan (with a row open, the rest softened rather than gone). Focus mode matches, with the current section in full colour and its ring.
- Find next and Focus mode zoom only as far as a section needs (about 44px across, keeping as much of the page as possible), with a bold two-tone outline that shows on any colour and pulses once on arrival.
- "N markers on this page ›" opens a list (Done closes it) of the page's markers, lightest first, with how many sections each, stand-ins ("for R46 (dry)"), To buy and the shading markers; tapping one lights up its sections.
- A finished page's bar offers ← Plan and Reveal & share; Reveal has one ✕ (top left).
- Focus mode's header is "Section 1 of 11" (the bar shows the page's progress).

**Plan**
- Change colour starts with Closest (three lighter and three darker markers you own) and In this guide; Recently used follows with only markers not already shown. The first time, a line under the tabs says the section is pinned, with Unpin. Help explains Pin and Kept.
- Balance names its parts Main, Second and Accent, with the family in the sheet's title.
- The tool row on an iPad has words (Codes, Greyscale, Full screen); on a phone a one-time line names them. Values is now Greyscale.
- Temperature's and Mood's buttons are one style; toasts on the Share tab sit under the tool row, clear of its buttons; "Tap a section…" shows only on Colours and Pattern.

**Edit sections**
- A heading ("Check the sections") and one line; the tools above the sliders; lighter tints; "Leave out" for excluding. Back from the Plan with nothing changed, the bar says ← Plan (no rebuild); once something is edited, Build again, with a line about coloured sections kept. Merge's first section is outlined.

**Home, Library and Markers**
- New colouring guide opens the photo picker straight from Home once you have guides (the first time, the Guide screen's card); Home stays until a photo is chosen. A palette chosen for the next guide shows under the button.
- The Library is a full-screen grid of pictures (two columns on a phone): each guide as coloured so far, palettes as their markers; ⋯ on each renames or deletes (with Undo). Home's "All guides (N) ›" opens it; from Palette, palettes come first. Back up & restore lives in the Library, with the markers-and-palettes text there too.
- Markers' Untick all shown and Back up & restore are in a ⋯ menu.
- Progress reads the same everywhere: "5 of 122 coloured", "finished", "not started".
- On an iPad every screen has the same width.
- Use in a guide asks: recolour the open guide (keeping what you've coloured) or start a new guide with the palette.
- The palette's glow stays on the Palette screen.

**Questions in the app's own dialog**
- Detect the sections again, rebuilding after a rotate or crop, restoring ("Replace my markers" / "Keep mine") and a backup opened as a guide no longer use the browser's OK / Cancel.

**Print**
- Each Pages and Labels choice has a small drawing of the printed sheet.

**Words**
- "Couldn't" throughout; "marker-by-number"; Reset progress asks "Reset progress?" ("This clears what you've coloured on N sections"); Random says "left to draw" and "put it back" instead of "pool".

**Accessibility**
- A palette band and its lock are two sibling buttons (not a button inside a button); Match's sources are pressed buttons; Focus mode's Greyscale, zoom and Fit are reachable by Tab.

**Found by two fresh-eyes reviews of the new code (a code read and a hands-on bug hunt in a browser), fixed before release**
- Focus mode: the picture took no taps once its tool row was made reachable by keyboard; Tab now goes top bar, picture, Greyscale, −, +, Fit, bottom bar.
- "New guide with it" no longer changes the open guide's palette (the palette waits for the new guide; deleted meanwhile, it's let go), and it opens the photo picker within the tap (iOS).
- ← Plan › Discard works for section edits brought back by Resume; a double tap can't cancel a question it just opened or untick every marker at once.
- On a wide screen the tools stack beside the picture again; Find next measures the room in the frame, not around the picture; the In this guide strip never widens the sheet.
- The markers list has Done; its shading markers aren't buttons that light nothing up. Toasts stay put in Colour along after the Share tab. Renamed Library tiles keep their picture; pictures draw one at a time and free their memory; a tap beside an open ⋯ menu only closes it.

**Tests and docs**
- `e2e/v288.test.mjs` (7 tests); tests updated for the new bar, rows, dialogs, wording and Library.
- `docs/GUIDE-LAYOUT.md` (#2, #4, #6, #10, the tip queue and the Library), `docs/DEVICE-TEST.md` 3f.
- Cache bumped to `marker-studio-v288`.
- Full run: 184 unit tests and 611 browser tests pass.

# Changes — v289 (a fresh-eyes review of v288, and its decisions)

Four reviewers went over v288 (code, a hands-on bug hunt, a hands-on UX walkthrough on iPad and phone sizes, and words and accessibility); `docs/REVIEW-v288.md` has what they found. The clear bugs were reproduced and fixed, and the decisions were built as recommended. New browser tests in `e2e/v289.test.mjs`; tests that described the old behaviour were updated.

**Bugs fixed**
- Edit sections › ← Plan › Discard on section edits brought back by Resume kept the edited map on screen, and the next autosave could save it over the guide as built. Discard with more edits than Undo keeps no longer reports success with merges left in the map.
- "New guide with it", then a photo that won't open, switched the open guide to the new palette. The palette is taken only once the photo has opened (the sample takes it too).
- Palette › Use in a guide › Recolour from Colour along or Edit sections said "Recoloured" and changed nothing. It goes back to the Plan first; with section edits not built it says to build or discard them first.
- Change colour open while an iPad turned from landscape to portrait (or a window narrowed) collapsed to one row or lost its Done.
- A backup restored over a guide deleted while open left the open guide showing unsaved ticks as "Saved"; it becomes the restored guide.
- Generate palette and Draw a marker dropped the keyboard's focus. Going Home straight after colouring showed no Continue card for a moment (the guide now saves as you leave it). A colour only being tried in Change colour was kept as a pin by going to another screen.
- Focus mode: taps on the picture did nothing after its tool row was made reachable by keyboard (v288's inert bug).
- "Removed from your Library" shows over "Section edits not saved" when the open guide was deleted mid-edit. Narrow phones with large text cut "Colours" and "Shading" in the tab row. Codes are redrawn at the right size when the picture changes size between stages.

**Small phones and large text**
- A phone's Plan starts a tall picture smaller where it must, so the tabs and their first row are on the first screen (never below the size it shrinks to as you scroll).
- Focus mode on a phone keeps Greyscale, −, + and Fit in a strip above the bottom bar, off the picture.

**One thing, one count, one word**
- The Colours line says where the markers come from ("From your 120 markers"); the slider says how many you asked for and the button how many are on the page.
- On the sample's first view, "Tap a section…" comes first; the sample's line follows at the next tab.
- Colour along: "Mark all coloured", "Clear", "All 9 coloured", "Page finished", "Only skipped sections left".
- "Colouring guide" as a default name; "Random draw"; "Use this palette in a guide?" with "Recolour this guide"; "Done. Now changing…"; "Join the ends of a loop for me"; "Start the palette from" and "Start from"; "Sections detected again"; "mark some as not dry"; "Couldn't read that guide."

**Screens**
- Markers: ⋯ beside "Showing 120 markers · Copy codes" (its menu covers nothing); Random and Match a colour are small buttons.
- Library: a line under the title that fits what's there; ⋯ on the name's row, not over the picture; Home's words for progress and when ("not started", "yesterday", then the date).
- iPad Home: once Your guides shows with All guides, no Library card; the backup reminder comes after the usual 14 days (not on day one with two guides) and is one short line.
- Palette: a "Saved palettes (N) ›" link at the top; Custom and Photo on a row of their own.

**Safety and navigation**
- Back (Android's, or Chrome's and Firefox's) closes what's open first, one each: a dialog or the Library, a sheet, Focus mode, Reveal, full screen, then Colour along; then it leaves as before.
- Home › New colouring guide with section edits not built goes to the Guide screen and asks first (Build again, Discard edits, Cancel).
- Restore's "Replace my markers / Keep mine" has Cancel, and Escape is Cancel too: nothing is restored. A restore that replaces the open guide with the backup's newer copy says so.

**Sheets and the keyboard**
- Change colour's Closest and In this guide rows fade at their edge while there's more; the markers list's title counts the shading markers ("16 markers on this page, 3 more for shading"); Print's summary is short on a small phone.
- Change colour by keyboard: one Tab stop per row or group, the arrow keys within it (Help says so).
- Accessibility and words from the review: Focus mode's page progress for screen readers, ← Plan and Build's names, a palette band says what a tap does (and "locked"), the row outline frees its canvases, one pattern for tap-twice ("Untick 120 markers? Tap again"), "Couldn't copy", "Couldn't save", "That file isn't a Marker Studio guide", "My collection" on the swatch chart.

**Tests, CI and docs**
- `e2e/v289.test.mjs`; tests updated for the new words, sizes and layouts.
- WebKit on GitHub: tests that turn a photo into a guide are left out there (it takes minutes on GitHub's WebKit, about 2 s in WebKit itself), and the toast tests start with the one-time screen-stays-on note told (Safari grants the wake lock). Failure screenshots are now kept (the upload skipped the hidden `e2e/.artifacts` folder).
- `docs/GUIDE-LAYOUT.md` (#3, #10, the tip queue, the Library, Back), `docs/DEVICE-TEST.md` 3g, `docs/REVIEW-v288.md`.
- Cache bumped to `marker-studio-v289`.

# Changes — v290 (from v289's run on GitHub)

- Back closing what's open is left out in Safari's engine (iPhone, iPad, Safari on a Mac): an iPhone or iPad has no Back button, and WebKit can crash reloading a page twice once the page has made a history entry of its own (GitHub's WebKit tests found it; a three-line page reproduces it). There Back stays the browser's, as before v289. Android, Chrome and Firefox keep it.
- A Library tile's name on Safari's engine could run to a fourth line, cut off: the spacer that keeps the first line clear of ⋯ was laid out as a line of its own in a clamped box. The name now keeps to three lines as a plain block.
- The Chromium job's time limit on GitHub is 45 minutes (the browser tests now take about 26; v289's run was stopped at 25 with every test so far passing).
- Cache bumped to `marker-studio-v290`.

# Changes — v291 (from v290's run on GitHub)

- On a phone, as the Plan opened straight after Build, the picture first took its full size and then, a moment later once the tabs were laid out, shrank to leave the tabs room (v289). A tap in between could miss its section (two Chromium tests caught it on GitHub's busier machine). The Plan now starts at the size the tabs need, from the room they took last time or about what they need.
- Home's Continue card test waits for the card's next marker after a rename (it comes once the picture is read; GitHub's WebKit was slower).
- Cache bumped to `marker-studio-v291`.

# Changes — v292 (a way to try Back on an iPad; faster CI)

- `?back=1` at the end of the app's address turns on v289's Back (closing what's open first) in Safari's engine too, to try it on a real iPad: open the Library, reload twice, and use Safari's back swipe. Without it, Safari keeps the browser's Back as in v290.
- GitHub runs the Chromium tests in 2 parts side by side (unit tests in part 1), so results come in about half the time, and WebKit part 1 starts with a speed check: how fast GitHub's WebKit runs plain JavaScript, to see why turning a photo into sections takes minutes there.
- Cache bumped to `marker-studio-v292`.

