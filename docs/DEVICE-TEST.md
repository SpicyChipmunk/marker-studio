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
      (e.g. "v316 · Beta").
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

## New in this release: v316

- [ ] ★ **Markers:** each family runs lightest first (R16, R28, R38 … R514). **Order** shows in Owned, Unowned and All;
      tap it in Owned → the picker offers only **Lightest first** and **Code order** (iPad Safari had shown hidden
      choices before; check there are just two). Code order → families by code, and it's still Code order after closing
      the app. Owned has no "Your collection." line; **+ Add markers** is an outline button like the ones beside it.
- [ ] The ⋯ menus (the guide's, Markers', the Library's) have an icon before each item, lined up, in grey.
- [ ] ★ **Page finished** (tick every section of a short page): a dark card with a green edge, a sparkle over
      **Page finished!**, and the four buttons under the photo as pills. Save image → the key's title in the app's serif
      font, round swatches (Copic 0 or B60 still visible on the white), the dot note in grey under the key.
- [ ] A Gradient's **Start colour**: the slider's ring rides on the colour strip; at both ends it sits over the first and
      last colours, not off the strip. **Scatter** has the same ring on a thin grey line.
- [ ] Upright iPad, the **sample** jellyfish → the Plan's picture is smaller to start and Mood's pictures (and the
      Pattern tab's first row) are on the first screen; **Colour along** → the picture is bigger again and the first
      marker row shows fully above the bar, with **More** at the end of the tip's sentence. A Letter page starts as before.
- [ ] Chosen options (Codes, Greyscale, Plan choices, a marker row you've opened, Balance) are all one teal; Mood's ✓ is
      white. Green is left for done (Saves itself ✓, the progress bar, Page finished).
- [ ] Drop-downs (Markers' Order, the Library's sort, the guide's Saved palette) have the app's chevron.
- [ ] ★ **Home** on the iPad before you've made a guide (a fresh install, or a test profile) → three numbered steps
      under the cards. Gone once a guide is built. On Home's **Add a photo of your page**, the ✕ is a round button of its
      own.
- [ ] ★ **To buy › From your guides** (with a smaller set ticked, e.g. 24 or 48, and a few guides in the Library) →
      under your list: the markers that would complete every blend in your guides, each with why ("Darker than B115 ·
      2 of your 4 guides") and +. Tap + → on the list with "blend for …"; **Add all to To buy**. Mark a marker a guide
      uses as **dry** → it's offered too. With all your markers ticked → "Every blend … is complete". With 30 or more
      guides, To buy still opens at once.
- [ ] **Brands I'd buy › Only these** with one brand → the card offers only that brand.
- [ ] A **new** guide's Colour along strip: a marker's lighter and darker companions look like a step of the same colour
      (no orange as a dark brown's lighter, no Black Brown as a red's darker). A guide made before v316 shows the same
      companions as before.

## From v315

- [ ] ★ **A finished page on a light table:** photograph a coloured page on a light grey or light wood table → **Add a
      photo of your page** → it's straightened by itself. The message has **Adjust corners** → the corners as found.
- [ ] Photograph it with the phone held **sideways**, then **upside down** → kept the right way up. **Turn** in the
      panel turns it a quarter turn.
- [ ] On a **check or striped cloth** → the corners open to check, with a line about the table's pattern.
- [ ] **Plan and your page** for a **wide** page, and for a photo kept as is that's wider than the page → the two are
      one over the other or side by side, whichever shows both bigger; THE PLAN and MY PAGE are easy to read. On a
      phone held sideways, **Share** is on the screen.
- [ ] ★ **Focus mode** with the iPad **on its side** → finish a marker → the next-marker card sits beside the
      picture, not over it. On a phone held sideways too, clear of the zoom buttons; turn the phone with the card up →
      it moves to fit.
- [ ] A **new** Gradient of **24** markers on a page with a few huge sections → the Pattern tab's last line names a
      marker that only colours specks; **Show them** rings where. Tap the biggest section, change its colour, then
      change **Flow** → the other markers spread over the rest of the page.
- [ ] A new Gradient from your markers: no two markers in its key look the same (B111 and B112 aren't both used).
- [ ] Copic greys (if you have some): a grey's blend companions in Colour along are the same grey type (C-6 with C-5
      and C-7).
- [ ] Wording: Library (empty) says **Nothing yet…**; Home says **Page in a PDF? Open the PDF**; Help's glossary has
      **Your page**.
- [ ] A guide made before v315 looks exactly as it did, and its photo is still there.

## Report back

Send the lines that failed, and anything that felt slow, confusing or jumpy, with **Send feedback** from the app.
