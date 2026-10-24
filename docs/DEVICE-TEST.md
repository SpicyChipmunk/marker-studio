# Device test pass (on the iPad)

> **Internal.** This is Ben's own pre-release checklist, not for beta testers: testers get
> [TESTERS.md](TESTERS.md) and the app's Tester tasks. See [RELEASING.md](RELEASING.md) for how a release reaches them.

**What this is for.** GitHub's tests (Chromium and Safari's engine) check the app's logic, wording and layout on every
push. This pass checks what they can't: a real iPad's touch, camera, Safari and Home Screen app, real photos, the share
sheet, paper, VoiceOver, and how it feels.

**How to use it**

- **Quick pass (about 15 minutes), every release:** the **★ lines** in Part A, then the release's own lines in Part C.
- **Full pass (about 1½ hours), before the beta and after big releases:** Before you start, all of Part A, Part B,
  then Part C. Part D when you have time.
- Use the **Home Screen app** unless a line says otherwise, with your own collection and one of your own pages.
- **The welcome and phone-width checks** go in a **Safari tab**: it keeps its own data, separate from the Home Screen
  app, so nothing there touches your collection. A **Private** tab starts fresh every time (the welcome shows). For
  a phone's width, put Safari in **Slide Over** (about as wide as a small iPhone).
- **Larger text:** Settings › Display & Brightness › Text Size, two steps up. Set it back afterwards.
- Note only what fails or feels off, with a screenshot if you can. **Send feedback** fills in the device and version.
- Older releases' checks are in [DEVICE-TEST-archive.md](DEVICE-TEST-archive.md).

## Before you start (5 min)

- [ ] Home's foot says the version you're testing (**v322 · Beta**). If not: "A new version of Marker Studio is
      ready" under Home's title → **Reload**.
- [ ] ★ **Library › Back up** → the share sheet → **Save to Files** → the file is in Files. (A1 needs it.)
- Have ready: a colouring page on the table to photograph; a PDF of a colouring page in Files; a few Ohuhu and Copic
  caps; paper and some markers; the keyboard if you use one.

## Part A — the core pass

### A1. Install, icon, offline (5 min)

- [ ] ★ **The new icon** (once, for v318.30): with the backup saved, press and hold the app's icon › **Remove App** ›
      **Delete App** (this deletes the Home Screen app's data too). In Safari, open the app's address › Share › **Add
      to Home Screen** → the ink-drop icon, crisp, nothing cropped, on the Home Screen and in the app switcher. Open it
      → the welcome › **Restore a backup** › your file → your markers, guides and palettes are all back.
- [ ] ★ Airplane mode on, close the app fully, reopen → it opens, your markers and guides are there; open a guide and
      make a PDF. Airplane mode off.
- [ ] *Next release only* (an update can't be checked on the release you're on): "A new version of Marker Studio is
      ready" under Home's title (a line over a guide's screen) → **Reload** → Home's foot says the new version, and a
      What's new card shows once.

### A2. Adding markers (6 min)

- [ ] ★ **Markers › + Add markers › Add a set you own** → pick a set you don't have → the sheet closes, the toast says
      how many (and the Colorless Blender if it came too) → **Undo** takes them out.
- [ ] ★ **+ Add markers › Scan or type codes** → tap the box › **AutoFill › Scan Text**, hold a few caps up one after
      another → each is read with a beep, no reopening; type one code and tap return → added; **Add** → in Markers.
- [ ] ★ **Photograph your caps** (+ Add markers, or its card in Scan): a tray from above, caps up, good light → most
      caps go straight into the list with green boxes; anything unsure is asked with its cap's picture.
- [ ] **+ Add markers › Find it from 3 caps** → scan 3 caps of a set you own → the right set is offered first.
- [ ] **Tick colours on a chart** → the swatches are big enough to tap one at a time.

### A3. Photo to guide (6 min)

- [ ] ★ Home › **New guide from a photo** (or Guide › Choose a photo) → a fresh photo of a page at a slight angle, on
      the table → the page's outline shows, then it's straightened ("Page straightened"); the sections follow the
      drawing, not the table or specks. Rough time to sections: ____
- [ ] ★ **Build guide** → the guide appears within a few seconds.
- [ ] A page with a hand or shadow on it, or a corner off the photo → the corner handles open; drag a corner (a
      magnifier under your finger) → **Straighten** works.
- [ ] **← Edit sections** → merge two sections, split one, ↶ then ↷ → each step does and undoes; **Build guide**.
- [ ] With a guide open, **⋯ › Open a PDF** → Files, PDFs only → a page of it → its sections.

### A4. The Plan (10 min)

- [ ] ★ **Colours › Mood** → the six pictures fill in shortly, scrolling stays smooth meanwhile; tap one → the guide
      becomes what its picture showed.
- [ ] ★ Turn the iPad round, both ways → nothing cut off; the picture and its tools stay on screen; anything drawn over
      the picture (rough-spot rings, zone outlines, the sun) sits where it should once the turn settles.
- [ ] Pinch and drag the picture → it zooms and pans, not the page; at normal size, dragging on it scrolls the page.
- [ ] **Pattern › Gradient**, **Shuffle** a few times → it changes every time. **Surprise** (✨) → a new look; **Undo**
      → back.
- [ ] ★ Tap a section → **Change colour** → pick one → it changes and is pinned; **Pin** keeps it through Shuffle. The
      **Skin tones** row is there if 3 or more of your markers are skin tones.
- [ ] ★ Tap a section → **Leave white** → it's white and out of the key; Shuffle, Mood and another pattern → still
      white. Tap it › **Colour it** → its marker is back. ↶ / ↷ both. The tap box's buttons fit.
- [ ] **Shading** → **Off · Soft · Dramatic · Rounded · Neuro**: each changes the picture. **Light from › The sun** →
      drag the sun with a finger → it follows smoothly, the page doesn't scroll.
- [ ] **Pattern › ＋ Zone** (at the end) → tap a few sections, Done → that zone gets its own pattern; its chip at the
      top of Pattern and Colours chooses it.
- [ ] If the Plan says "N rough spots · Smooth them": the rings sit on the lines between sections, not on a code.
      **Smooth them** → fewer or none; ↶ → back.
- [ ] **Pattern › Random**, 8 markers, **Keep touching sections clearly different** on → Shuffle 10 times → no two
      touching sections look alike, or a note under the box says how many couldn't be kept apart.
- [ ] **Pattern › Photo** with a colourful photo → one finger drags it, two fingers resize and turn it, the colours
      follow when you let go.

### A5. Colour along (6 min)

- [ ] ★ **Colour along** → tick a few sections → swipe up and close the app fully at once → reopen → the ticks are
      there, and Home's Continue card shows how far.
- [ ] ★ **Focus mode** → **✓ Done** moves to the next section without a pause; the bars clear the home bar; Done is
      easy to hit with a thumb.
- [ ] ★ A marker's row open → turn the iPad and back → the outlines sit on their sections.
- [ ] A marker's row open → tap a section of another marker → a small question beside it (**Open …** / **Tick it**);
      nothing ticked until you choose. A ticked section of the open marker: tap it again → unticked.
- [ ] Press and hold a section → its marker opens in the list; the section isn't ticked.
- [ ] Finish a page (**Mark all coloured** on each row) → the page in colour, then **Reveal & share** plays smoothly.

### A6. Saving, Library, backup (5 min)

- [ ] ★ **Library › Restore** your backup (A1 did this from the welcome; here from the Library) → it asks **Add the
      backup's … to mine** or **Use the backup's …** → either way your guides, palettes and markers are there.
- [ ] Rename a guide with an apostrophe typed on the iPad ("Ben's page") → it saves; the Library shows every guide
      with its picture, coloured so far; a long Library scrolls smoothly.
- [ ] A guide's **⋯** in the Library › **Duplicate** → "Name (2)", keeping its shading markers (its Home card says
      "+ N for shading" if the original's did).
- [ ] Delete a guide → **Undo** brings it back; delete it again and wait → **Recently deleted (1)** at the Library's
      foot → **Put back** → it's back with its ticks and page photo.

### A7. Share and print (6 min)

- [ ] ★ **Share & print › Print…** → rows **Pages, Paper, Labels**, then the pages in order as small shapes (Picture,
      Close-ups, Key); change Labels, Paper and What to print → the shapes and "N pages" follow, upright and sideways,
      without scrolling.
- [ ] ★ **Download PDF** (Letter, Page + key) → nothing cut off, codes readable, the key tidy. **Key + reference** →
      its file ends "-reference.pdf". **Test strip** → only its pages.
- [ ] Print once in a while: the labels readable on paper and light enough to colour over.
- [ ] **Save image** → the share sheet → Save Image → in Photos, looks right. **Reveal & share › Share** → Messages,
      uncropped; **Save clip** saves a video (note if it fails).
- [ ] **Markers › Print a swatch chart** → colour a few boxes → close enough on screen to tell the markers apart. Note
      any that look quite different on paper.

### A8. Markers, Palette, Help, feedback (8 min)

- [ ] ★ Markers: press and hold a marker → its details: **Blends with** a lighter and a darker one (tap one → its
      details, "← Back to …"), and **Find similar**.
- [ ] **Match a colour › Camera** → the back camera, not stretched, the match follows as you move; close it → the
      camera indicator goes off.
- [ ] ★ **Palette** → Generate a few → **Use in a guide** → the guide uses its markers. Complementary, then tap each
      band → it stays Complementary. **Rainbow**, started from one marker → "Rainbow · … base"; close and reopen the
      app → it still names the base.
- [ ] **Help** → **More you can do** and **If something goes wrong**: open each; spot-check that buttons it names are
      where it says.
- [ ] ★ **Send feedback** (Home's foot) → the box → write a line → **Send** → "Sent. Thank you!" (it should show in
      the results sheet). **Help › About › Copy diagnostics** → paste into Notes → a readable report.
- [ ] **Tester tasks** (Home's card) → answer one, then **Send results** → sent; the last questions are five plus your
      name.

### A9. Keyboard, larger text, VoiceOver, feel (as you go)

- [ ] With the keyboard: Tab moves through a screen in order with a visible ring; Escape closes the top thing only (a
      sheet, then a dialog, then Focus mode).
- [ ] Larger text (two steps up) → Home, Markers, Palette and a guide grow; nothing cut off or overlapping. Set it back.
- [ ] VoiceOver on: open a guide and Colour along → buttons named sensibly, no emoji or arrows read out. Shuffle, wait
      for the toast to fade, Shuffle again → both toasts are read.
- [ ] Nothing felt slow (over about a second with nothing happening), jumpy or confusing. Note what you tapped.

## Part B — the welcome and a phone's width (Safari, 15 min)

In a **Private** Safari tab (fresh each time). For "phone width", put that Safari in **Slide Over**.

- [ ] ★ **I have a set** › Honolulu 120 › Add → "120 markers added", no toast, an **Undo** link under "Anything
      else?" (takes them back out); Home's Markers card then says **120** (the blender not counted).
- [ ] Then **I have extra markers › Type or paste codes**, type **B000**, **R27**, **YG17** (return after each) →
      "Which R27?" offers **Copic R27** as well as Ohuhu's two; tap Copic → it's answered.
- [ ] ★ Phone width (Slide Over), fresh Private tab: **one by one › Type or paste codes** → the box is on the first
      screen, above Add, with a one-line hint for Scan Text. Type ten Copic codes with one typo (**R2T**) → **Add** →
      under "Anything else?": "1 still to choose: **Open** · **Undo**", and no toast over the buttons. **Open** → the
      question; answer it → Add.
- [ ] Phone width: **Scan caps one at a time** → the three steps as before.
- [ ] Phone width, larger text: Palette's colour sizes all visible (they may sit on a line under "Colours"); a guide's
      Plan, Print sheet (Pages, Paper, Labels) and Markers' ⋯ menu fit.
- [ ] **All Copic markers** added (Markers › Add a set) → Home's Markers card says **358**.

## Part C — new in recent releases (20 min)

What v318.22 to v318.30 changed that Parts A and B don't already cover.

**New in v322**

- [ ] ★ **Opening (installed on the iPad, Reduce motion off):** close Marker Studio fully (swipe it away), open it from
      the Home Screen → the drop shows uncoloured, its sections colour in top to bottom, then it fades into Home: about
      half a second, never a wait. If the launch screen still showed black, the drop appears and animates from there.
      Switching back to the app without closing it: no animation. With Reduce motion on: none. In a Safari tab: none.

**New in v321 (the premium pass, part 2)**

- [ ] ★ **The launch screen (installed on the iPad):** open Marker Studio from the Home Screen twice → while it
      starts, the app's dark ground with its icon in the middle, not a black screen. If it's still black, iOS read the
      launch screens when the app was added: only Back up › remove the app › add it again › Restore brings them in
      (the Library comes back from the backup, so back up first). Say which it took.
- [ ] ★ **Preview the pages:** a guide › Share & print › Print… → tap page 1's picture → each page as it will print,
      ‹ › and a swipe across the page; Download PDF from there writes the PDF; ✕ or a tap round it closes the preview
      and the Print sheet is still there.
- [ ] **Buttons press in** a little under your finger (Done, Colour along, the tabs); the ways back and on are
      chevrons ("‹ Plan", "‹ Back", "Skip ›", "Build guide ›"), not arrows.
- [ ] **Focus mode:** after each Done the next Done's tick draws itself in. Finish a page in Colour along → the card's
      numbers count up (not with Reduce motion).
- [ ] With a keyboard on the iPad: Tab → the ring round what has focus is light violet and fits it (Colour along's
      More: round its word only). Tapping never shows a ring.
- [ ] Home's Beta tester tasks card: grey like the tiles, the count in a ring that fills as tasks are answered; green
      once all six are.

**New in v320 (the premium pass)**

- [ ] ★ **Print a page (Ben's test print, before release):** a guide › Share & print › Print… → page 1 shows in the
      sheet as it will print → Download PDF → print it. Page 1: serif title, details on the right, a rule; the footer
      "Marker Studio · name · page 1 of N" over a hairline; the close-ups' lines lighter but every thin line still
      clearly there; the key's round swatches. Note anything that prints too faint.
- [ ] ★ **Codes on the iPad:** a guide's codes at the usual size and zoomed in read as well as before on every
      colour (compare with labels-outline-v320.png); the outline looks a little finer on big codes.
- [ ] ★ **A new photo:** choose one → it stays bright, the tabs say Guide at once, "Finding the page" then "Finding
      the sections" tick off, a slow light sweep over it; Straighten's corner handles pause the steps.
- [ ] ★ **Finish a page** in Colour along → the card: "Finished · today", the numbers, the markers as chips, Reveal &
      share and Add a photo; strokes flick in from the card's edges, not over its title. The bar: "← Plan | Share &
      print". With Reduce motion: no strokes.
- [ ] ★ **Held sideways, Focus mode:** the buttons in a column on the right, the picture the full height; Swap sides →
      the left, and it stays there next time; Colours' sheet and the next-marker card keep to the picture; turn the
      iPad upright → the bars as before.
- [ ] ★ **Tick sections** in Colour along and Focus mode → the colour spreads from your finger; quick taps never wait.
- [ ] The tab you're on: Home pink, Guide violet, Markers coral, Palette amber; Home's tiles coral, amber, blue; a
      chosen option (Your markers, Lightest first) a quiet grey, not teal.
- [ ] The page on the iPad sits like a sheet of paper with a shadow and a little room round it; zoomed in, no shadow
      grows; Edit sections draws to the edge as before.
- [ ] **Library:** covers with rings (violet part-way, green ✓ finished); a palette under "Palettes and draws"; "Not
      backed up yet" has Back up beside it. A fresh Safari tab: the empty Library shows the two pages and Choose a photo.
- [ ] **The sample** (a fresh Safari tab): the welcome's picture upright, the colour flooding down; Home's start card
      and (phone width) the short strip show the two jellyfish and Ben's coloured page; the sample guide has 311
      sections.
- [ ] Edit sections, change a section, Build → the plan blooms in again; change nothing, Build → no bloom.

**New in v319 (fixes from two debugging passes)**

- [ ] ★ A colouring page drawn with **coloured outlines** (red or blue lines; a PDF or download) → its sections are
      found as for black lines, with or without Enhance; colour a few cells in with dark markers and photograph it →
      still all its sections, and the coloured ones offered as done.
- [ ] ★ A guide from a photo → Edit sections › Crop it a little → build, close the app fully, reopen → Edit sections ›
      Adjust photo works (no "isn't kept" note).
- [ ] ★ A guide → ⋯ → tap the dimmed picture near the top → the menu closes, you stay in the guide (not Markers or
      Home), nothing else opens; tap again → the section's tip.
- [ ] Palette › Analogous + accent → lock the accent band → Generate → the other colours are still a fan round the
      opposite hue. Greys + accent › Start from a grey marker → one clear colour and the greys.
- [ ] A guide → Palette › A palette → Greys + accent (Include › Greys & black off) → the greys chip turns on and the
      palette is one colour and greys → ↶ Undo → the chip is off again and the scheme is as it was.
- [ ] Markers › Random → Remove this one → Draw → the Undo toast is gone.
- [ ] After updating from an older version → "What's new" lists each version since then.

**New in v318.36 (building without freezing)**

- [ ] ★ New guide from a big camera photo (12 MP) → while "Detecting sections…" shows, scroll and tap around: the
      screen keeps responding (no 2–3 s freeze). The guide looks the same as before. Drag Edit sections' Sensitivity
      slider quickly back and forth → it keeps up and settles on where you let go.
- [ ] Copy diagnostics after that → "Longest waits" are shorter than they were in v318.35.

**New in v318.35 (engine upgrades)**

- [ ] ★ **A page you've partly coloured in with mid or dark markers**, photographed → Edit sections: the coloured
      sections are whole sections (not holes or scraps), and there's no "coloured in already" warning. Build guide →
      after the bloom, a toast "N sections look coloured in already." with **Mark them done** → tap it → they're
      ticked, "Marked N sections done · Undo" → Undo puts the ticks back. A plain page gets no such toast.
- [ ] A page coloured in nearly all over (dark or scribbled) still gets the "coloured in already" warning, now saying a
      partly coloured page works.
- [ ] ★ A photo of a page on a **light desk** (white or pale grey table) → the app straightens it by itself; the page's
      margins are background (dark in Edit sections), not sections.
- [ ] A **scan or download of a hatched page** (zentangle, shading lines) → Edit sections shows "Treat hatching as
      one section" ticked and says how many patches it found; untick → the slivers come back; Undo. A photo of the
      same page → the box starts unticked.
- [ ] Share & print › a PDF with the reference picture → it opens in Files and looks as before (a smaller file).

**New in v318.34 (the five features)**

- [ ] ★ **A guide from one of your photos** → save it → open another guide → close the app fully → open the first
      guide → Edit sections › Adjust photo → "Getting the photo ready…", then turn, Adjust corners, crop, Enhance and
      Sensitivity all work as when you built it. After ticking a few sections, change the crop → it warns that
      progress clears; Undo brings the ticks back. Same with a guide from a PDF page.
- [ ] Library › Back up → "Include guide photos (bigger backup)" is unticked; back up both ways and compare the two
      files' sizes in Files. On a nearly full iPad, building and reopening guides still works.
- [ ] Save a copy of that guide → the copy's Adjust photo works too.
- [ ] ★ **A guide › Pattern › Random › Main colour** → a thin strip, then three rows "Main colour · pinks · about 60% ·
      Auto ›"; each opens its sheet; pick a family by hand → the row says "Your choice". Shuffle and ↻ Other pairings
      in one row with the line telling them apart; Pin colours below. With Larger Text, the rows wrap and stay
      tappable.
- [ ] ★ **Markers › 🎲 Random** → the line saying what it's for; draw five → Drawn right under the buttons, "Show the N
      left to draw" folded, grouped by family. Swap this one, Remove this one (Undo), Clear all (asks, Undo). Sideways:
      two columns. Use in a guide with two or more drawn. Markers › Draw from these → Random from those.
- [ ] Tick "Prefer markers you haven't used yet" → draws avoid markers in guides you've worked with (coloured,
      printed, shared, opened in Colour along); the line under it says how many are left unused; reload → still ticked.

**Harmonies and Colours from**

- [ ] Palette → the Harmony grid has twelve: **Light to shadow**, **Analogous + accent** and **Greys + accent** after
      Monochrome, three to a row, upright and sideways. Each makes a palette; the line under the grid says what it is.
- [ ] Monochrome or Analogous at 6 → the colours step evenly from light to dark (no two nearly the same lightness
      next to a big jump); Generate again → another even ramp.
- [ ] Greys + accent → one clear colour first, then greys light to dark; no "Some colours are greys" line. Filters →
      Saturation: Neutral off (or a selection without greys) → the button is greyed; a tap says "Needs 3 greys among
      your markers".
- [ ] A guide → Colours from › A palette → New palette's harmony menu has the three; Greys + accent gives a grey ramp
      with one accent. (v319) It is greyed "— needs Include › Greys & black on" until Expand › Include › Greys & black
      is on; chosen, then the chip off and a Mood tap → "Greys + accent needs Include › Greys & black on: Analogous +
      accent instead" under the menu, the card "Analogous + accent", Greys + accent still the one chosen; the chip on
      and a Mood tap → Greys + accent again, no note.
- [ ] (v319) Palette → Start from Ohuhu 120 Black → Greys + accent → lock the first colour (the accent) → Generate ×3
      → it stays first and locked. Markers › Random → Draw ×3 → Remove this one → tap a colour in the pile → "Removed
      …" with Undo → Undo puts that one back.
- [ ] (v318.37) Analogous + accent → lock the last colour (the accent) → Generate ×3 → the other colours stay a fan
      across the wheel from it, no "stray from the scheme" line. Light to shadow → lock the last → Generate → it
      stays the ramp's dark end.
- [ ] (v318.37) Start from a grey marker (a Cool Grey) → Greys + accent → one clear colour first, the grey among the
      greys at its lightness, "… base" under the name. Markers › select greys only › Palette from these → Greys +
      accent says "All greys: your markers in play don't have a clear colour for the accent."
- [ ] (v318.37) Markers › Random → draw three → Remove this one → Draw a marker → the Undo toast is gone; Remove,
      Undo at once → back. A guide › Colours from › a saved palette → delete it in the Library → the card says "From
      your Library (deleted)" and offers Save to Library.
- [ ] (Stage 3 F) Colours from is **Your markers | A palette**. A palette → a card: swatches, name, "8 markers · Made
      here", ✕; under it "A palette of 8: tick Expand for more", New palette + harmony, Change it in Palette ›, Save to
      Library. ✕ → Your markers; A palette again → the same palette back.
- [ ] Palette → make one → Use in a guide › Recolour → the card says "From Palette" with its name and scheme; Save to
      Library → "Saved to your Library as …", the card says "From your Library" and Save to Library goes.
- [ ] Choose a saved palette ▾ → the card shows it; delete that palette in the Library → the guide keeps its colours
      and its card (reopen it after a reload: still so). A guide saved before v318.34 whose palette was deleted reads
      "Palette deleted · Choose another".
- [ ] Change it in Palette › → the Palette screen with that palette (locks, re-roll a band) → Use in a guide ›
      Recolour → back in the guide with the change.
- [ ] With a saved or handed-over palette, ✨ Surprise → the colours stay the palette's; the toast starts "Kept your
      palette"; Undo brings the pattern back. With a palette made by New palette, Surprise makes a new one as before.
- [ ] Help › Glossary has "Colours from". Phone (390 wide): the card and the rows under it fit, nothing cut off.

**New in v318.33 (the design pass)**

- [ ] ★ Walk through Home, Markers, Palette, a guide's four tabs, Colour along and the Library, upright and sideways →
      nothing overlaps or is cut off; every button you'd tap is a comfortable size; chosen options look the same
      everywhere (teal inside a track). Repeat with Larger Text.
- [ ] Markers → Random, Match a colour, Add markers and Swatch chart in one row (two rows on a phone width).
- [ ] A guide → the tabs are underlined and stay pinned when you scroll; ⋯ → the picture dims behind the menu.
- [ ] Palette → the harmonies in an even grid; with Larger Text on a phone width, two columns, no word broken.
- [ ] The Library with nothing in it (a Private tab) → the icon in a ring above the text and Try the sample.

**New in v318.32**

- [ ] ★ **A guide from one of your own photos** (the Specks ones are good) → no clusters of tiny purple specks along
      the page's edge or in the margin at the Sensitivity it starts at (now 5). Edit sections › Adjust photo ›
      Sensitivity 1 → about the same number of sections.
- [ ] ★ **Focus mode** → the **Exit** pill leaves it; the next-marker card is always whole on screen, upright and
      sideways. Enter Focus upright → it zooms to the first section straight away (not the whole picture).
- [ ] ★ **Home** after building a guide you haven't coloured yet → "Your latest guide · not started · Open".
- [ ] **Edit sections › Adjust photo** on a phone-width Safari tab → the panel scrolls into view above Build guide.
- [ ] **Palette › Start from a marker…** upright → the colour cards are full cards, not grey slivers.
- [ ] A photo where the app isn't sure of the page → the note says to drag the yellow corners; with a sensible
      outline, **Straighten** is the main button.
- [ ] After updating, Home shows "Updated to v318.32 · What's new" once; it opens Help's own What's new section.
- [ ] Markers chart: tap a marker you own → "… unticked · Undo"; Undo ticks it again.
- [ ] Scan: copy a photo of caps in Photos, paste it into the box → it's read. Close Scan straight after choosing a
      photo, while "Starting the reader…" shows → reopen Scan and read a photo: it works.
- [ ] The welcome, Private tab: add a set › I have extra markers › one by one → a **Done** button.

**Markers and Scan**

- [ ] Markers: Ohuhu **RV33** and **RV34** side by side → two slightly different swatches; RV33 › Find similar → RV34
      near the top, not "Same colour" (v318.29).
- [ ] Search **skin tones** in Markers → them, lightest first; in **Owned**, "N more in All · Show" (v318.26, .28).
- [ ] Search **Rose Red** → Ohuhu R213 (older cap R6 Rose Red) (v318.26).
- [ ] **Add a set**: **6 Skin Tones** is in the Ohuhu list; **24 Portrait** comes with the blender (v318.27).
- [ ] Scan Text with a Copic grey cap held upside down (N-8 or W-3) → added as that grey (or asked, W-1/W-7). Type
      **6-13** → nothing (a date isn't a marker) (v318.24).
- [ ] Markers › **⋯** upright → the whole menu shows (v318.25).

**Guides and palettes**

- [ ] **Palette › Monochrome** started from a black (Ohuhu 120) → greys, not greens; tap a band → still greys. **From
      photo**, then back to a scheme, ↶ → the palettes from before the photo (v318.25, .28).
- [ ] Random, **Keep touching sections clearly different**, markers set to 2 → the note under the box says how many
      sections couldn't be kept apart (v318.27).
- [ ] Shuffle, then **Pin** a section within a few seconds, then the Shuffle toast's Undo → the toast is gone (only ↶
      undoes now) (v318.28).
- [ ] **Pattern › Manual › Paint**, drag across a section left white → it says how to colour it, nothing painted
      (v318.28).
- [ ] Open a big camera photo (12 MP) of a page, then **Help › About › Copy diagnostics** → it ends with "Longest
      waits, this visit:" and a few lines. **Send feedback** after it → the message ends the same way (v318.23, .26).
- [ ] A PDF with more than 60 pages, if you have one → "Pages 61–…" shows the rest (v318.28).

**Saving**

- [ ] Delete a guide you've coloured since your last backup, then restore that backup → the guide stays in Recently
      deleted, and "Name (from backup)" is in the Library (v318.25).

## Part D — every few releases, or when the reader changes

- [ ] **Photograph your caps**, about 12 photos one after another without closing Scan → every photo is read, no
      reload.
- [ ] **Look closer** under a photo with caps left without a box → "Looking closer…", then "Looked closer: N more
      added"; **Undo look closer** takes them out; **Stop** part way keeps what it read.
- [ ] A photo of the whole Ohuhu bag, then the Copic case → "reading the photo closer…" → finishes, no reload. Seconds:
      ___
- [ ] Put the app away during a closer read, come back → it finishes, or the next photo says it'll read more gently.
- [ ] Older caps (the lent collection's backup, in a separate Safari profile, never your own Home Screen app) →
      Markers shows the caps' codes (R6, YR170), **My cap says** switches one; a question's close-up has **Where in the
      photo?**.
- [ ] **Pattern › Photo** with a photo of a coloured copy of the same page, at a slight angle → "Lined the photo up…"
      and most sections get the colour they have in the photo.
- [ ] Test print: the sample's PDF (Page + key), colour its smallest sections with your palest markers → the codes'
      grey doesn't show through.

## Report back

Send the lines that failed, and anything that felt slow, confusing or jumpy, with **Send feedback** from the app.
