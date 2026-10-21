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

- [ ] Home's foot says the version you're testing (**v318.31 · Beta**). If not: "A new version of Marker Studio is
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
