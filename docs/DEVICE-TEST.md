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

## New in this release: v318.21

Your own caps are all current, so try the older-cap checks with the lent collection's backup in a **separate Safari
profile** (Safari › Settings › Profiles), never in your own Home Screen app: a restore replaces your markers.

- [ ] ★ Your own app, after the update: nothing looks different. Markers, a guide, Colour along and the PDF key show the
      codes as they are now. Colour along asks nothing (it asks only with an Ohuhu marker of yours that has an older
      code and nothing known of its cap: answer **R213** once if it does).
- [ ] ★ Lent profile: restore the backup → Markers shows the older caps' codes (R6, YR170, CGII04), a marker's details
      say "now R213" and **My cap says** switches it; a guide's labels, Colour along and the PDF key show them too.
- [ ] Lent profile: a guide with RV17 (older cap R22) and the R22 of now → the older one's label has a **\***, the key
      and Colour along name both caps (Dark Blush, Ballet Pink).
- [ ] ★ **Photograph your caps** on an older tray: a question's close-up has **Where in the photo?** → the whole photo
      with the cap ringed and "Near the … · beside …"; tap the photo to go back. Close Scan, reopen: still there.
- [ ] Older tray: a code misread by one character ("5110" for E110) with its name read shows "read as “5110”" on its
      row, already listed.
- [ ] Markers › ⋯ → **Show the codes on older Ohuhu caps** (with Undo), **Forget what my caps say**.

## New in v318.19

- [ ] ★ **Markers › Add markers › Photograph your caps** on OLDER Ohuhu caps (old codes like R6, YR170, PB3, CGⅡ07,
      with their old names): most go straight into the list, few questions. Compare with how many v318.18 asked.
- [ ] The same on your newer Honolulu caps: nothing different from before.

Then v318.17 and v318.18's checks, if not done:

## v318.17 and v318.18

- [ ] ★ On iPhone, **Pattern** (Gradient) → the patterns, Flow (each with a small picture), Look, then **More
      options** (Direction, Start colour, Scatter), then Shuffle · Pin, then **＋ Zone** at the end. Do the Flow
      pictures read at a glance? On iPad nothing is folded.
- [ ] A mandala page → Pattern › Gradient › Radial → "Looks like a mandala" with Matching shapes alike and Try Around.
- [ ] ★ **Colours** › More options › **Theme** (v318.18): twelve chips, 3 across on iPhone, 4 on iPad, each with a
      strip of its colours. Tap a few → the picture takes those colours; tap it again → none. Does each strip and
      picture look like its name on your markers? Then **Warm** → Winter, Ocean (and others) greyed; with Ocean on,
      Warm turns it off and says so. A small set says "Few … colours: the nearest N added".
- [ ] ★ With a Colorless Blender in your markers: **Shading** › Highlights › **Blender (0)** → H on the guide is "0";
      the line says to put the 0 down first, then the base. Try it on paper: does the highlight come out?
- [ ] With a zone: choose the zone's chip in Shading › Highlights › **None** → that zone has no H, the rest keep
      theirs. **Undo** → back.

Then v318.16's checks, if not done:

## v318.16

- [ ] ★ **Shading** → one row: **Off · Soft · Dramatic · Rounded · Neuro**. Tap each → the picture's shading changes
      and that one is chosen. Move **Roundness** → none is chosen, and the line under the row says Custom. **Undo** →
      back to the style.
- [ ] **Highlights** › **None** → shadows only (no H in the guide, the PDF's key has no highlight column). Choose
      **Same colour** again → highlights back.
- [ ] ★ On iPhone: **Shading** and **Colours** each show **More options** under their main choices → tap it → the
      rest opens; tap again → shut. On iPad, upright and on its side, no More options bar: everything shows.
- [ ] With zones: a style changes every zone's shading; a zone's own sliders (under its chip) still change only it.
- [ ] Guide buttons feel easier to hit, and row labels (Flow, Light from…) easier to read. **Radial** › the Rings
      choice sits on one line beside its label.

Then v318.15's checks, if not done (its Style row is now the Shading row):

## v318.15

- [ ] ★ With a guide open, choose a new photo of a page → the new photo shows on the picture straight away (not the
      old guide), with the controls hidden until its sections are ready; then the controls come back as usual.
- [ ] ★ A photo of a printed page with a blank margin → the margin's specks of grain or dust aren't drawn as lines
      (zoom in on the margin in **Adjust photo**); a dark full stop or signature there stays.
- [ ] A sketchbook page photographed with its spiral binding (or a strip of table) along an edge, not coloured in →
      "Binding or table at the edge? · **Trim it**" shows above the sections → tap it → the crop leaves the binding out.
      **Undo** → back as it was, and the line is offered again.
- [ ] ★ **Shading** → **Style** › **Neurographic** → each section is darker along its lines and in its corners, lighter
      in its middle; **Light from** shows **The edges**. Move a slider → no Style chosen. **Undo** → back.
- [ ] **Shading** › **Light from** › **The sun** → as before, with the sun to drag.
- [ ] **Pattern** › **Gradient** › **Flow** › **Radial** › **Rings** › **Follow the drawing** → the colours step out from
      the section under the centre mark; drag the mark → they start from there. On iPhone, both rows fit on one line.
- [ ] On iPhone, **Shading** is taller now (Style and Light from): check it still feels fine to scroll.
- [ ] A mandala page → **Pattern** › **Gradient** → tick **Matching shapes alike** → each ring's matching petals or
      cells share one marker. Untick → as before. Pin one petal a colour first → its ring takes that colour.

Then v318.14's checks, if not done:

## v318.14

- [ ] ★ Choose a big photo of a page (from the camera, not a screenshot) → while "Detecting sections…" shows, the
      screen doesn't freeze: the status line and buttons around the picture still respond (the picture itself and its
      controls wait). The sections come out as before.
- [ ] In **Adjust photo**, drag **Sensitivity** a few steps quickly → the page stays smooth, and the sections match
      the last setting. **Undo** once → back to before.
- [ ] Turn or crop the photo → the same: no freeze, then the new sections.
- [ ] If you have Ohuhu markers: **Photograph your caps** on a tray with BG, BV, YG, YR or RV codes → their codes read
      whole (BG24, not G24).

Then v318.13's checks, if not done:

## v318.13

- [ ] ★ The first time you choose a photo after updating (Home's **Choose a photo** or **New colouring guide**) → a
      card of photo tips first → its **Choose a photo** opens the photo picker straight away. Choose a photo → the
      next time, straight to the picker.
- [ ] ★ Photograph one of your pages from right above → **Edit sections**: Min section size says "about 1 mm"; move
      Sensitivity (Adjust photo) from low to high → the section count stays about the same (no hundreds of specks).
- [ ] Photograph a page **at a steep angle** (about 45°) → in the sections' warning box: hold the phone flatter, with
      **Choose another photo** → it opens the picker. No toast.
- [ ] Photograph a page on a **marble or patterned** surface → if the corner handles open, they start near the
      photo's edges, not on a stray shape.
- [ ] Photograph a **busy but unhatched** page (a mandala or a detailed one) from right above → no "looks hatched"
      warning.
- [ ] On the Guide screen's start card, **Photo tips** → the card; the cross closes it without opening the picker.
- [ ] Open a guide you saved before this release → its sections as they were.

Then v318.12's checks, if not done:

## v318.12

- [ ] ★ Photograph one of your **sketchbook drawings** (line art, before colouring) from right above → no corner
      handles; the guide is built, and the shapes along the page's edges are sections (not left white).
- [ ] A **downloaded edge-to-edge** neurographic page → its edge shapes are sections. A page **with a white margin**
      → the margin stays white.
- [ ] Open a guide you saved before this release → its sections and background as they were.
- [ ] If you have Copic markers: **Photograph your caps** on a tray of YG, YR or BV markers → their codes read whole.

Then v318.11's checks, if not done:

## v318.11

- [ ] ★ A new **Gradient** with Mood **Pastel** → tap **Shuffle** 3 times → the guide changes every time (same
      colours, moved along).
- [ ] Photograph a page **at a steep angle** (about 45°) → it's straightened, then a tip to hold the phone flatter.
      Photograph it again from **right above** → no tip.

Then v318.10's checks, if not done:

## v318.10

New guides colour more cleanly (measured on the benchmark; nothing new to tap). On the iPad, with one of your pages:

- [ ] ★ A new **Gradient** guide with 32 markers, and one with Pastel → no two neighbouring sections in colours you
      can't tell apart.
- [ ] A new **Random** guide with No repeats → no two touching sections share a marker (unless a section touches more
      sections than you have markers).
- [ ] Open a guide saved before this release → it looks as it did.

Then v318.9's checks, if not done:

## v318.9

Photos whose codes are small are read again closer. On the iPad, with **Photograph your caps** (time each read; note
the seconds):

- [ ] ★ A photo of the **whole Ohuhu bag** → "The codes are small: reading the photo closer…", then "Reading closer ·
      …" → it finishes, no reload; far more caps than before. Seconds: ___
- [ ] ★ A photo of the **Copic case** → read closer too. Seconds: ___
- [ ] A **close-up of one pocket or tray** → no "closer"; as quick as before. Seconds: ___
- [ ] The same whole-bag photo **twice more** in one visit → each finishes, no reload.
- [ ] Put the app away (Home) **while** a whole-bag photo is being read closer, then come back → it carries on and
      finishes, or, if iPadOS ended the page, the next photo says "The last photo didn’t finish reading: reading more
      gently for a while…" and reads without "closer". (Whenever the page reloads on its own during a closer read, the
      next photo must say this.)

Then v318.8's smoke test, if not done:

## v318.8 (with v318.2 to v318.7)

v318.8 changes nothing you should see: the code for adding markers was reorganised (proved the same as v318.7's by the
build). A 2-minute smoke test first:

- [ ] Markers › + Add markers › Scan or type codes: type two codes and Enter, paste a short list, answer a question, Add
      → all as before. Photograph your caps with one tray → markers and questions as before.

Then, if v318.7's checks weren't done yet:


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
