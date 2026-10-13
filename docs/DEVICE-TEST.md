# Device test pass (about 20 minutes on the iPad)

> **Internal.** This is Ben's own pre-release checklist, not for beta testers: testers get
> [TESTERS.md](TESTERS.md) and the app's Tester tasks. See [RELEASING.md](RELEASING.md) for how a release reaches them.

**What this is for.** GitHub's tests (Chromium and Safari's engine) check the app's logic, wording and layout on every
push. This pass checks what they can't: a real iPad's touch, camera, Safari and Home Screen app, real photos, the share
sheet, paper, and how it feels.

**How to use it**

- Run the **★ lines** (about 10 minutes) for every release; all of it (about 20) for a release with new features.
- Then do **New in this release** at the end.
- Use the **Home Screen app** unless a line says otherwise, with your own collection and one of your own pages.
- Note only what fails or feels off, with a screenshot if you can. **Send feedback** fills in the device and version.
- Older releases' checks are in [DEVICE-TEST-archive.md](DEVICE-TEST-archive.md).

## 1. Update, install, offline (3 min)

- [ ] ★ Open the Home Screen app → "Marker Studio was updated" shows, **Reload** → Home's foot says the new version
      (e.g. "v318 · Beta").
- [ ] ★ Airplane mode on, close the app fully, reopen → it opens, your markers and guides are there; open a guide and
      make a PDF. Airplane mode off.
- [ ] In a Safari **Private** tab, open the app's address → the welcome shows; Share › Add to Home Screen → the icon is
      the three marker strokes, nothing cropped. (Close the tab; nothing there is kept.)

## 2. Adding markers (3 min)

- [ ] ★ **Markers › + Add markers › Add a set you own** → pick a set you don't have → the sheet closes, the toast says
      how many (and the Colorless Blender if it came too); **Undo** takes them out.
- [ ] ★ **+ Add markers › Scan or type codes** → hold a few caps up to the camera with Scan Text → each code is read
      cap after cap without reopening; **Add** adds them; ✕ comes back to Markers.
- [ ] **+ Add markers › Find it from 3 caps** → scan 3 caps of a set you own → the right set is offered first.
- [ ] **Tick colours on a chart** → the swatches are big enough to tap one at a time.

## 3. Photo to guide (4 min)

- [ ] ★ **Choose a photo** → take a fresh photo of a page at a slight angle, on the table → it straightens ("Page
      straightened"); the sections look like the drawing, not the table or specks. Rough time to sections: ____
- [ ] ★ **Build guide** → the guide appears within a few seconds and builds smoothly.
- [ ] A page with a hand or shadow on it, or a corner off the photo → the corner handles open; drag a corner (a
      magnifier shows under your finger) → **Straighten** works.
- [ ] **← Edit sections** → merge two sections, split one, ↶ then ↷ → each step does and undoes; **Build guide**.

## 4. The Plan (4 min)

- [ ] ★ **Colours › Mood** → the six pictures fill in shortly and scrolling stays smooth meanwhile; tap one → the guide
      becomes what its picture showed.
- [ ] ★ Turn the iPad round, both ways → nothing cut off; the picture and its tools stay on screen; switching tabs moves
      nothing.
- [ ] Pinch and drag the picture → it zooms and pans, not the page; at normal size, dragging on it scrolls the page.
- [ ] **Pattern › Gradient**, **Shuffle** a few times → it changes every time.
- [ ] **Shading › Light & shadow** → drag the sun with a finger → it follows smoothly, the page doesn't scroll.
- [ ] Tap a section → **Change colour** → pick one → it changes; **Pin** keeps it through Shuffle.
- [ ] **Pattern › Photo** with a colourful photo → one finger drags it, two fingers resize and turn it, the colours follow
      when you let go.

- [ ] *Every few releases:* **Pattern › Photo** with a photo of a coloured copy of the same page, taken at a slight
      angle → "Lined the photo up…" and most sections get the colour they have in the photo.

## 5. Colour along (3 min)

- [ ] ★ **Colour along** → tick a few sections → close the app at once (swipe it away) → reopen → the ticks are there,
      and Home's Continue card shows how far.
- [ ] ★ **Focus mode** → **✓ Done** moves to the next section without a pause; the bars clear Safari's toolbar and the
      home bar; Done is easy to hit with a thumb.
- [ ] Press and hold a section in Colour along → its marker opens in the list; the section isn't ticked.
- [ ] Finish a page (Mark all coloured on each row) → the whole page in colour, then **Reveal & share** plays smoothly.

## 6. Saving, Library, backup (2 min)

- [ ] ★ **Library › Back up** → the share sheet → **Save to Files** → the file is in Files.
- [ ] **Library › Restore** that file → it asks Replace my markers / Keep mine → your guides, palettes and markers are
      all there.
- [ ] The Library's pictures show each guide as coloured so far; scrolling a long Library stays smooth.

## 7. Share and print (2 min)

- [ ] ★ **Share & print › Print… › Download PDF** (Letter) → nothing cut off, the codes are readable, the key is tidy. Print it once in a
      while: the labels are readable on paper and light enough to colour over.
- [ ] **Save image** → the share sheet → Save Image → it's in Photos and looks right.
- [ ] **Reveal & share › Share** → opens in Messages uncropped; **Save clip** saves a video (note if it fails).
- [ ] **Markers › Print a swatch chart** → colour a few boxes on your paper → screen and paper colours are close enough
      to tell the markers apart.

## 8. Camera, Palette, Help (2 min)

- [ ] **Match a colour › Camera** → the back camera, the picture not stretched, the match follows as you move; close it →
      the camera indicator goes off.
- [ ] **Palette** → Generate a few → **Use in a guide** → the guide uses its markers.
- [ ] **Send feedback** (Home's foot) → the share sheet with a short report; **Help › About › Copy diagnostics** pastes
      a readable report into Notes.

## 9. Keyboard, larger text, feel (2 min, as you go)

- [ ] With the keyboard attached: Tab moves through a screen in order with a visible ring; Escape closes the top thing
      only (a sheet, then a dialog, then Focus mode).
- [ ] Settings › Display & Brightness › Text Size, two steps up → Home, Markers and a guide grow; nothing cut off or
      overlapping. Set it back.
- [ ] Nothing felt slow (over about a second with nothing happening), jumpy or confusing. Note what you tapped.
- [ ] Every few weeks: VoiceOver on, open a guide and Colour along → buttons are named sensibly, no emoji or arrows read
      out.

## New in this release: v318

**The photo reader's gate for the beta: a 2 GB iPad** (the 5th or 6th generation iPad, 2017–18, on iPadOS 16.4 or
later; older 2 GB iPads can't update that far and don't show the card), if you can borrow one; then your own iPad.
Write the times down.

- [ ] ★ **Markers › + Add markers › Photograph your caps** → Scan opens on the reader's card (no keyboard) → it says
      22 MB and that photos never leave the iPad → **Download the reader** on Wi-Fi → it counts up the MB → "The reader
      is ready". Time to download: ____
- [ ] ★ **Take or choose photos** → photograph **half a tray** from above, caps up → the photo shows, the bar moves,
      codes join the list as they're read, green boxes on the photo. Time to finished: ____ s. Nothing wrong in the
      list; amber boxes are the ones asked about.
- [ ] ★ A **whole tray** in one photo, then a **close-up** of a few caps → each finishes, no "too much for this device".
      If the app reloads itself part way (memory), open Scan and read the same photo again: it should read more gently
      and finish. Note which iPad.
- [ ] ★ **All your photos at once:** take a photo of each tray (or half-tray) in the Camera first, then **Read photos of
      your caps → Take or choose photos → Photo Library**, select them all → "Photo 1 of N…", one bar over all of them;
      at the end one summary and a line per photo. Total time: ____ for ____ photos. Compare the list with your
      collection: anything missing or wrong? Each marker is in the list once, however many photos it was in. On the
      2 GB iPad, at least ten photos in one go.
- [ ] **Stop** during a batch → it stops within a second or two; what was read stays. **Undo these photos** → all their
      codes go back out.
- [ ] One photo: **Stop** part way → it stops within a second or two, what was read stays in the list. **Undo this
      photo** → its codes go back out. **Read another photo** → straight to the camera or photos.
- [ ] Switch to another app while a batch is being read, then back → it carries on or has finished; nothing lost. Lock
      the iPad for a minute mid-batch, unlock → the same.
- [ ] Airplane mode on, close the app fully, reopen → **Read photos of your caps** works offline. In a Safari
      **Private** tab with Airplane mode on → the card says it needs the internet the first time; its button waits.
- [ ] **A set's name:** copy the text from a set's box (Live Text) or a shop's page (Honolulu 120) and paste it into
      Scan → the set is offered, added with a tap. **Open a list file** with a .csv from Files → read as a paste.
- [ ] On the welcome (in a Private tab) → **I bought them one by one** → **Photograph your caps** is first → it opens
      the reader; read a photo, **Done**, **Add to my collection** → the welcome says how many were added.
- [ ] On the welcome (in a Private tab), add a set → **Some are missing** → the chart with its markers ticked; untick
      two → they're left out.
- [ ] Help › **Adding markers by code** and About's credits read right.

## From v317

- [ ] ★ **A whole tray at once:** photograph a tray of caps with the iPad's Camera, open it in Photos, press and hold
      the text (Live Text) › Select All › Copy. Markers › Add markers › Scan or type codes → tap the box › Paste → the
      codes are read into the list. Colour names under their codes don't raise questions; the message doesn't say
      dozens of lines weren't read.
- [ ] Scan Text on the iPad as before: AutoFill › Scan Text, cap after cap with a beep, no Insert.
- [ ] Help › **Adding markers by code** reads right.
- [ ] (An Android tester) Scan's steps say Gboard › Scan text; photograph a cap, tap Insert → its code is read with
      a beep, no ✓ needed; ← for the next cap. If nothing is read: Help › About › Copy diagnostics and send it.

## Report back

Send the lines that failed, and anything that felt slow, confusing or jumpy, with **Send feedback** from the app.
