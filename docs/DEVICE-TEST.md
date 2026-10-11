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
      (e.g. "v311.1 · Beta").
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

- [ ] ★ **Share › Download PDF** (Letter) → nothing cut off, the codes are readable, the key is tidy. Print it once in a
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

## New in this release: v312.1 (and v312's, if not checked yet)

- [ ] **Tester tasks:** answer one, **Send results** → a row in your results sheet within a minute; Home's foot says
      "Tester tasks · sent". Airplane mode on, send → it says it couldn't; off, send again → "2 (an update)".
- [ ] **Send feedback** from Home and from the guide's **⋯** → the box to write in; **Send** → a "Feedback" row.
      **Share it instead** → the share sheet, with what you wrote, for a screenshot.
- [ ] **Undo and a dry marker:** in a guide, change the Mood; in Markers mark one of its markers dry; back in the guide,
      ↶ Undo → its sections show a stand-in; mark it not dry → the marker is back in them.
- [ ] **Edit sections › Merge** two sections → the one they became is outlined for a moment.
- [ ] **Share › Print… › Download PDF** → the button under it says **Close**.

## Report back

Send the lines that failed, and anything that felt slow, confusing or jumpy, with **Send feedback** from the app.
