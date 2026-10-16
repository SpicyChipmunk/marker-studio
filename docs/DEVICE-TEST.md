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
      (e.g. "v318.1 · Beta").
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

## New in this release: v318.7 (with v318.2 to v318.6)

The photo reader is more careful (a cap it can't read for sure is asked about, with its picture), and adding markers is
safer and quicker to check. Checked on captured reads of your photos and in Safari's engine; on a real iPad:

- [ ] ★ **Photograph your caps** with a tray of your markers (Markers › + Add markers) → every marker added is one in
      the photo; no "Which Y210?" on a photo of your current caps. Photograph the same tray again → its caps go green
      and the card says "… already in the list".
- [ ] ★ A **question** from a photo shows its cap in place of the "?". Tap the picture → shown larger with the question
      and its answers: tap an answer, "Not this cap" or "Not now". A tap on the picture or outside closes it; a tap on
      the card's text doesn't.
- [ ] ★ **The keyboard after answering:** with the keyboard down (after a photo), answer a question in the list → the
      keyboard stays down and the next question is ready. With AutoFill › Scan Text running, answer one → the keyboard
      (and Scan Text) stays.
- [ ] ★ **A Copic list pasted** (Ohuhu-only collection, the brand set for you) → read as Copic: all of it in as Copic,
      the card says "Read as Copic: its codes are plainly Copic's".
- [ ] ★ **Sweep a few Copic caps with Scan Text** (Ohuhu-only collection) → after two or three, the card says "Reading
      both brands: Copic caps were read" and a row at the top of the list has **Keep Ohuhu**; codes both brands use are
      asked "Ohuhu or Copic?". Tap Keep Ohuhu → back to Ohuhu. A sweep of your Ohuhu caps never shows that row.
- [ ] Type **R29** with Ohuhu set → asked "Which R29?" with Ohuhu YR47 (was R29) first and Copic R29, not "Another
      brand than the one chosen".
- [ ] Leave a question unanswered, tap Add, close the app fully (swipe it away) and open it again → Markers › + Add
      markers says "1 question still to answer · Answer them"; Answer them opens the list at it **without the keyboard**,
      and its picture comes back a moment later.
- [ ] Two photos in the list → a small heading over each ("Photo 1 · 58 markers"); still there after a reload.
- [ ] Photograph a set's tray with a cap or two hidden → the card names them: "Honolulu 120: all but 2 are here — …
      Not read, or not yours?". "Add these 2" puts them in the list, not your collection; "I don't have them" isn't
      asked again.
- [ ] Help › Your data › Delete all my data → nothing of Scan's list or pictures comes back after the reload.
- [ ] Photograph a cap of **R22 Ballet Pink** among others → R22 is added, not RV17 Pink.

## From v318.1

Most of v318.1 is fixes found by a deep review and checked in Chromium and Safari's engine. These are the parts only a
real iPad (or iPhone) can show.

- [ ] ★ **Test print first:** print the sample's PDF with **Page + key** (Share & print › Print or save PDF), colour
      a few of its smallest sections with your palest markers (light yellows, blush pinks) → the darker grey of the
      smallest codes doesn't show through. (If it does, say so: they go back to the lighter grey.) The same codes are
      easier to read than before.
- [ ] ★ **Colour along**, a marker's row open → tap a section of another marker → a small question beside it: **Open
      …** / **Tick it**; nothing ticked until you choose. Tap it again → it closes. A done one says **Untick it**. It
      feels right under a finger, not in the way.
- [ ] ★ **Taps on the picture:** tick sections quickly with a fingertip, a little carelessly → each tap ticks (a small
      roll of the finger no longer counts as a drag); zoomed in, small pans still move the picture.
- [ ] ★ **Scan with the keyboard up:** Markers › + Add markers › Scan or type codes, type a code and Enter → the "✓
      added" card and the count stay in view above the keyboard (the paste line and photo card put away while it's up).
      The same with the iPad on its side, and with AutoFill › Scan Text's camera.
- [ ] ★ **Back in a Safari tab** (not the Home Screen app): Markers, then swipe in from the left edge → Home, still in
      the app; once more → Safari's previous page. On the Plan, panning the picture near its left edge doesn't go Home.
      On the welcome: **I have a set**, then the swipe → back on the first step.
- [ ] ★ **Key + reference** with Codes, printed → page 1 is your picture in colour with dark codes you can read at arm's
      length beside the page you're colouring; small sections in close-ups after it, then the key. Labels **None** →
      one page, the picture beside the key.
- [ ] **Print or save PDF** in the Print sheet → the share sheet offers Print. A wide picture's page 1 prints on its
      side, and the sheet said "page 1 landscape".
- [ ] Delete a guide in the Library, wait past the Undo → **Recently deleted (1)** at the Library's foot → **Put
      back** → it's back with its ticks and page photo.
- [ ] **Surprise** in the Plan → its message sits over the foot of the picture, the tabs and controls clear, and it's
      short.
- [ ] Settings › Display › Text Size larger (on an iPhone, if you have one to try) → the Plan's picture is smaller and
      its controls have room.
- [ ] Home shows **Beta tester tasks** with the next task; it says "ready to send" when all six are answered.
- [ ] Some are missing (after adding a set on the welcome) → the chart shows just your markers, "Untick any you've
      lost".
- [ ] With a keyboard: **Edit sections › Crop**, then Escape → back as Cancel.

## Report back

Send the lines that failed, and anything that felt slow, confusing or jumpy, with **Send feedback** from the app.
