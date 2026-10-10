# Device test pass: the old checklist (v264 to v311)

> **Archive.** Replaced in v312 by [DEVICE-TEST.md](DEVICE-TEST.md). Kept for reference: what each release asked to be
> checked by hand, release by release. Many lines describe screens that have changed since.

## 1. Install and first run (3 min)

- [ ] **iPhone:** Share → Add to Home Screen. The icon shows three coloured marker strokes on a dark background, not a blank page or a screenshot.
- [ ] **Android:** the ⋮ menu offers **Install app** (not only "Add shortcut"). The installed icon shows the same strokes, with nothing cropped at the edges.
- [ ] Launch from the home-screen icon. The app opens full screen with no browser bar, and the status bar is dark.
- [ ] The welcome screen appears. Pick a set (e.g. 24). Markers → collection shows that set, and the header says that set's brand (e.g. "Ohuhu · your collection").
- [ ] Turn on airplane mode and relaunch. The app still opens and your collection is still there. Turn airplane mode off.

## 2. Guide screen: pinned picture (4 min)

Tap **New colouring guide → Try the sample**. It opens as a finished guide (no sections editor).

- [ ] The picture stays pinned at the top while you scroll the tabs and controls.
- [ ] The picture stays the same size the whole way down and back up (no shrinking or jumping).
- [ ] Rotate to landscape and back. The picture isn't cut off and the controls are still reachable.
- [ ] **iPhone:** when the URL bar collapses or expands during scroll, the picture doesn't jump in size.
- [ ] Pinch-zoom on the picture zooms the picture, not the whole page. The − / + / ⤢ buttons sit in a row **under** the picture (not on top of it) and are easy to hit.
- [ ] **⛶ Full screen** fills the screen with the picture; pinch and tap still work; the **✕** (top right) brings it back to normal.
- [ ] **Colours** starts with "Markers in this guide"; **Style** starts with **Shading**, then "Colour pattern".
- [ ] Tap a section. It highlights and shows its marker. Colour mode: mark a few sections done, leave the app, come back — progress is kept.

## 2b. Focus mode (4 min)

On the guide, tap **Colour along**, then **⛶ Focus mode**.

- [ ] It zooms to one section with a yellow outline, centred between the top and bottom bars. The top bar shows the marker and "Section 1 of N".
- [ ] **✓ Done** ticks it off and glides to the next section of the same marker, usually nearby.
- [ ] Tapping the outlined section also ticks it off. Tapping a *different* section just moves the outline there — it doesn't tick anything.
- [ ] **←** goes back to where you just were, and shows **↺ Undo** for a section you've already done.
- [ ] Drag and pinch move the picture freely without it snapping away. **⤢** brings the outlined section back to the centre.
- [ ] **Colours** opens the list: jump to another marker, or "Mark all … done".
- [ ] Rotate to landscape: the picture still has most of the screen and the outline stays centred.
- [ ] The Done button is easy to hit with your thumb; nothing is hidden behind Safari's toolbar or the home bar.
- [ ] Finish a page (or use "Mark all" per colour): it zooms out to the whole picture in full colour, with **Reveal & share**.

## 2c. Shading (3 min)

On a guide, open **Style** and set **Shading** to **Light & shadow**.

- [ ] A small sun appears over the picture. Drag it with your finger: it follows smoothly and the shadows swing to the far side of each shape.
- [ ] While you drag the sun, the page doesn't scroll and the picture doesn't pan.
- [ ] Tap a section: the tip lists its tones (H highlight › B base › S shadow, or "S 2nd coat").
- [ ] The note under the controls makes sense for your collection ("Richer with: …" lists markers of your brand).
- [ ] **Roundness** slider: sliding it feels responsive, not stuck. At the high end, rounded shapes look like pebbles: light along the edge facing the sun, shadow along the far edge; long shapes (tentacles) shade along their sides.
- [ ] **Highlight** and **Shadow** sliders: more/less of each shape gets the lighter / darker marker.
- [ ] **Leave sections flat**: tap a few small sections (e.g. eyes); they lose their tones and the button counts them. Tap again to shade them. **Done choosing** ends it.
- [ ] In a **Photo** guide with shading on: **Light from → The photo** is chosen, the sun disappears, and tones follow the photo's own light and dark (flat areas of the photo stay flat). **The sun ☀** brings the sun back.
- [ ] Save, close the app, reopen the guide: shading and the sun position are as you left them.
- [ ] With shading on, **Share → Download PDF**: page 1 has faint dashed tone lines, small H/S circles and a ☀; the key lists each colour's H · B · S markers (or "2nd coat"). Print it: the dashed lines are visible but light enough to colour over.
- [ ] **Save image** shows the shaded version.
- [ ] **Colour along** with shading on: each colour in the list shows its tones; **Focus mode** shows the section's tones in the top bar and one **Done** finishes the section.
- [ ] In Focus mode the small H/S circles over the zoomed section stay sharp when you pinch-zoom.
- [ ] Colour along: **long-press** a section — its colour lights up and scrolls into view in the list, and the section is *not* ticked.
- [ ] In Focus mode, **Colours → Step through each tone**: the bar names one tone at a time and outlines just that part (the shadow for 3). On the shadow or highlight step the section's code is faded and only that step's S or H circle is bright.
- [ ] Switch shading **Off**: the sun disappears and the guide looks exactly as before.

## 2i. Release 1 polish (3 min)

- [ ] **Markers → Owned:** tap a marker: it dims in place (the grid doesn't jump) and Undo appears. Tap it again to tick it back. Press and hold a marker: its details open (name, colour, "In my collection", Find similar, Copy code).
- [ ] Toasts appear just above the bottom buttons and don't block taps; nothing says "Preparing…" in a toast.
- [ ] Library → Restore with a wrong file: an amber card under the buttons says what went wrong; tapping anywhere clears it.
- [ ] Match a colour → Hex code: typing letters that aren't a colour says "Enter 6 hex digits".
- [ ] Before adding markers, Palette works and a line at the top says it's using every marker.
- [ ] Welcome: the Copic tab jumps to the Copic sets; the button says "Add 24 markers" (etc.).
- [ ] Guide: "← Edit sections", "Download PDF" after Letter/A4, "Save image", "← Plan"; colour-along rows say "0 of 9 done".

## 2j. Release 2 (3 min)

- [ ] **Library:** tapping a row's name opens it; ✎ renames (Enter saves, tapping away saves); long names show on two lines; guides show "40% coloured" once partly coloured and saved; a newly saved palette gets a colour name, not a date.
- [ ] **Guide:** tap a section → its marker with **Change colour** and **Pin**. Change colour → pick → Confirm: the section changes and stays that colour after **Shuffle**. Unpin gives it back.
- [ ] The picker shows codes under each swatch, grouped by colour, with **Recently used** at the top the next time.
- [ ] **Blend:** a tap still adds an anchor; press and hold a section shows Change colour / Pin. **Manual:** a tap opens the picker.
- [ ] **Style → Pin colours:** taps pin and unpin sections directly.

## 3m. v311 on the iPad (6 min)

- [ ] **Markers › + Add markers** (top, beside To buy's row): the sheet lists Add a set you own, Scan or type codes, Tick colours on a chart, and Find it from 3 caps. Add a set you don't have: the sheet closes, the toast says how many, Undo takes them out.
- [ ] **Find it from 3 caps** from the sheet with Scan Text: it reads cap after cap; Yes adds the set and closes; None of these goes back to the ways.
- [ ] Scan or the chart from the sheet, then ✕: you're back on Markers with + Add markers highlighted for the keyboard (with a keyboard attached).
- [ ] In a Safari **Private** tab: Markers shows the "Add your markers" card at the top; add a set: the top of your collection stays in view.
- [ ] **⋯ › Clear collection**: first tap asks, second clears, Undo puts everything back.
- [ ] **Edit sections:** Leave out a section, ↶, then ↷: it's left out again.

## 3l. v310 on the iPad (8 min)

- [ ] **Mood pictures:** open a guide, Colours tab. Under "Mood", six small pictures of your page fill in a moment after the Plan settles (one row on the iPad, two rows of three in Slide Over). Scrolling and tapping stay smooth while they fill in.
- [ ] Tap **Bright**: the guide changes to exactly what its small picture showed; ↶ Undo says "Mood: Bright". Do the same with Pattern › Random and with Colours from › Generate palette.
- [ ] Random: Bright → Any → Bright again gives a different Bright (the pictures are made afresh after each change).
- [ ] With a zone, or a saved palette used as it is, Mood is the row of buttons as before.
- [ ] **Quick section check:** only someone new sees it. To try it without touching your own copy, open the app's web address in a Safari **Private** tab, add a set, and pick a page photo: only "Looks right?" with **Fix sections** and **Build guide** shows; a tap on the picture says to tap Fix sections. Fix sections opens the tools, and every later picture in that tab shows them.
- [ ] Your own copy (with guides in the Library) shows **Check the sections** as before.

## 3k. v308 on the iPad (12 min)

- [ ] **Home:** "v308 · Beta"; **Send feedback** at the foot opens the share sheet with a short report.
- [ ] **Gradient at all:** on one of your 216-section pages, Gradient · all: no tan or grey band; Include › Browns on brings browns in. − / + step, hold runs, tapping the count lets you type.
- [ ] **Rainbow** at 8 starts at red and has a real yellow.
- [ ] **Photo:** photograph a page, Straighten: corners start on the page, not the drawing; Tilt 1° doesn't add sections.
- [ ] **PDF** with shading on: the key's colour reference is a good size, one NO. column, the sun doesn't hide a code; no specks from the photo.
- [ ] **Restore** an older backup: Keep mine is highlighted; after it, Undo puts things back.
- [ ] **Palette:** Use in a guide, then tap a Mood: the palette's markers stay.
- [ ] **Help › About › Copy diagnostics** pastes a readable report into Notes.

## 3j. v307 on the iPad (8 min)

- [ ] **Finish in Focus:** finish a page in Focus mode, tap ✕: the page stays in full colour.
- [ ] **PDF:** Download PDF on a big page: the button counts "Page 2 of 7…" and the app keeps responding; the PDF looks as before.
- [ ] **Save image** and **opening a guide** feel quicker to respond; a new guide saves and reopens.
- [ ] **Two tabs:** type a code in Colour along's box, save from another tab: your text and open row stay.
- [ ] **Shading:** a shaded guide's finish line says "N markers + M for shading".
- [ ] **From photo:** a photo of your marker trays under a lamp offers "Photo looks warm · Balance it"; it brings back the blues and violets.
- [ ] **Help › Your data** reads clearly on the iPad.
- [ ] **Offline:** in airplane mode, open the Home Screen app, open a guide, make a PDF.

## 3i. v306 on the iPad (12 min)

On your iPad in Safari, with your own collection.

- [ ] **Welcome** (use a private tab to see it fresh): the jellyfish colours itself from the bell down, three times, then stays coloured; smooth, not stepped. Turn the iPad sideways: it stands beside the list. "You're all set" fans out your markers.
- [ ] **Scatter:** on your page, Gradient, one per section: try each stop, Polished → Confetti. Each looks clearly different from the last (Polished and Natural only slightly). Shuffle at Sparkle mixes again but the Start colour stays. On a mandala with Radial, matching petals mostly match.
- [ ] **Rough spots:** at Polished with "all", rings and "N rough spots · Smooth them" under the tabs; Smooth them clears them without greys; Undo brings them back.
- [ ] **Two brands:** a guide that uses both Ohuhu and Copic Y26 (or another shared code) shows "2 brands" in Colour along and "Not the … Y26" in Focus.
- [ ] **Find by code:** in Colour along type a code, press Go: its rows show and its sections are pointed out. With the on-screen keyboard up, the line above the box stays visible.
- [ ] **Finish** a page in Focus: marker strokes fly up from the progress bar, no box over the picture. Under Page finished, tap a "Did any run low?" chip: it goes on To buy (Undo takes it off).
- [ ] **Home:** with nothing in progress and a finished guide, it leads Home; Reveal & share and Print… work from there. Choose a photo is still on screen.
- [ ] **Framed page:** Colour it, then Undo and Redo; save, close and reopen: the line is still there.
- [ ] **Palette › Rainbow** gives an even rainbow; Generate gives another.

## 3h. The v305 review, on the iPad (10 min)

On your iPad in Safari, with your own collection and one downloaded mandala plus one of your own pages.

- [ ] **Build bloom:** pick a new picture and Build. The line art shows, then the colours flood out (round like a clock hand with Around), then the codes. It should look smooth, not stepped; note if it stutters. A tap during it picks the section tapped. Build again, Edit sections and reopening don't bloom. (If it ever ended at once by itself, the iPad was judged too slow and it stays off: say so.)
- [ ] **Gradient:** on the mandala, try Flow › **Around**; with a warm or cool Temperature the colours go out and back with no hard seam. At one marker per section, neighbours look smoother than before.
- [ ] **Framed page:** a page with a frame drawn round it keeps the paper inside the frame white, with "Paper round the drawing is left white · Colour it" under the picture; Colour it brings it back.
- [ ] **Reveal & share:** finish a page (Mark all coloured), Reveal: the piece lifts onto its paper over a soft glow, then its title, the line ("… sections · … markers · finished …") and the ribbon. Share at once: the card is the same picture, tall (4:5), and opens in Messages uncropped. Long title: stays on the card. Turn the iPad sideways: nothing squashed.
- [ ] **Save image** on a finished page: no codes, framed like the card. Untick or tick Codes and it does as you chose.
- [ ] **Redo:** in the Plan, Surprise then Undo: ↷ appears beside Undo and takes you forward again.
- [ ] **Shading drop-downs** (Highlights, Shadows) are readable.
- [ ] **From photo** (Palette): a colourful photo gives its real colours, not browns and greys.
- [ ] **To buy:** tick a marker that's on To buy in the Markers grid: it leaves the list (Undo puts it back).

## 3g. The v288 review's decisions, v289 (12 min)

On your phone (and an iPhone SE-size screen if you have one) and your iPad, with one of your own photographed pages.

- [ ] **Back (Android's, Safari's back swipe, or a computer's browser):** open the Library, a sheet (⋯), Focus mode: each Back closes one; from Colour along, Back goes to the Plan; with nothing open, Back leaves as before. Closing things with their own buttons, then Back, doesn't leave a Back that does nothing.
- [ ] **Phone Plan:** with a tall picture, the tabs and their first row are on the first screen; scrolling still shrinks the picture to the same size as before.
- [ ] **Focus mode on the phone:** Greyscale, −, + and Fit are in a strip above the bottom bar, never over the picture.
- [ ] **Sample, first view:** only "Tap a section…" under the tabs; change tab and the sample's line appears instead.
- [ ] **Words:** Colour along says Mark all coloured, Clear, "All 9 coloured", Page finished; the Colours line says where markers come from ("From your 120 markers").
- [ ] **Markers:** ⋯ is beside Copy codes and its menu covers nothing; Random and Match a colour are small.
- [ ] **Library:** ⋯ on the name's row; lines read "not started", "yesterday"; the line under the title fits what's there.
- [ ] **iPad Home:** with guides, no Library card (All guides goes there); no backup card in the first two weeks.
- [ ] **Palette:** "Saved palettes ›" at the top opens the Library with palettes first; Custom and Photo on their own row; "Start from".
- [ ] **New colouring guide with section edits not built:** the Guide screen asks first (Build again / Discard edits / Cancel); afterwards New colouring guide opens the picker.
- [ ] **Restore** with different markers: Cancel (or Escape) restores nothing; restoring a backup with a newer copy of the open guide says so.
- [ ] **Change colour:** the In this guide and Closest rows fade at their edge when there's more; the markers list's title counts the shading markers; Print's summary is short on a small phone. With a keyboard (iPad), Tab goes row to row and the arrows move within one.

## 3f. Colour along as your paper, the Library grid, v288 (12 min)

On your iPad (both ways round) and your phone, with one of your own photographed pages part-way coloured.

- [ ] **Colour along:** what you've coloured shows in its colours, the rest pale, like your paper; open a row: its sections still to do are full colour and outlined. Codes off shows the whole plan. Focus mode looks the same way.
- [ ] **Find next / Focus mode on a tiny section:** it zooms only until the section is easy to tap, with a bold outline that shows on a light marker and a dark one; a big section just pans.
- [ ] **Markers on this page:** "N markers on this page ›" lists them lightest first; tapping one lights up its sections.
- [ ] **Change colour:** Closest and In this guide at the top; the first time, a Pinned line under the tabs with Unpin. On an iPhone SE-size screen the whole sheet fits.
- [ ] **Edit sections:** back from the Plan with nothing changed, the bar says ← Plan; change something and it says Build again.
- [ ] **iPad tool row:** Codes, Greyscale and Full screen have their words; at the largest text size nothing is cut. On the phone, a one-time line names them (after the first guide).
- [ ] **One width:** on the iPad, Home, Guide, Markers and Palette have the same width menu, both ways round.
- [ ] **Home:** with guides made, New colouring guide opens the photo picker straight away; cancel it and Home stays as it was.
- [ ] **Library:** a grid of pictures, each guide as coloured so far; ⋯ renames and deletes (Undo puts it back); scrolling 30+ guides stays smooth. Markers' ⋯ › Back up & restore opens it at the backup buttons.
- [ ] **Questions:** re-detect, rotate or crop after building, restore ("Replace my markers" / "Keep mine") and Use in a guide ("Recolour" / "New guide with it") use the app's own buttons.
- [ ] **Print:** each Pages and Labels choice has a small picture of the printed sheet.

## 3e. Home, saving, iPad and icons, v285 (12 min)

On your iPad (both ways round) and your phone, with one of your own photographed pages.

- [ ] **Saving:** choose a photo and build it: it's in the Library without pressing anything ("Saves itself from now on ✓", then "Saved in your Library ✓"). The sample says **Sample** with a line under the tabs; look around (codes, zoom, tabs, Colour along) and it stays out of the Library; change anything (or rename it) and it's kept as "Sample jellyfish" (the next one "Sample jellyfish 2").
- [ ] **Put back:** delete the open guide in the Library and wait for its Undo to go: the header says "Removed from your Library" with **Put back**; tick a section: still not in the Library; **Put back**: it's back, with the tick.
- [ ] **Home:** with a guide part-way coloured, the Continue card shows it as coloured so far (the rest pale), how far, and the marker to pick up next; **Continue** opens Colour along at that marker. New colouring guide and the three cards sit beside it on the iPad, under it on the phone; Your guides is a grid on the iPad and a sideways strip on the phone.
- [ ] **iPad portrait:** the guide uses the screen's width; the picture is bigger and shrinks as you scroll to the controls; Colour along's picture is bigger too.
- [ ] **iPad landscape:** the picture and its tools are fully on screen as the guide opens, with nothing to scroll on the Colours tab; switching tabs moves nothing; turn the iPad round mid-colouring and it re-lays out cleanly.
- [ ] **Icons:** line icons everywhere (Surprise's sparkles, ⋯, close ✕, the tool row, Home's tiles in marker colours); at the largest text size they grow with their words and nothing is cut.
- [ ] **Shading hold:** with Light & shadow, colour one section's base tone only, go back to the plan and change Shadows: its highlight stays, its shadow follows; colour its shadow tone and change Shadows again: it keeps it.
- [ ] **Straighten:** a photo straight from your phone that wasn't straightened says "Page kept as photographed · Straighten"; Straighten starts with its corners where the app guessed them.
- [ ] **Blend › Mix:** each choice has a line saying what it does.
- [ ] **Closing straight away (v286):** tick two sections and close the tab or swipe the app away at once; open it again: both ticks are there (on the Continue card and in the guide).

## 3d. Usability release, v284 (10 min)

On one of your own photographed pages; tick a few sections first where it says.

- [ ] **Coloured sections keep their markers:** in Colour along, tick 5–10 sections (and colour one tone of a shaded one). Go **← Plan** and tap **Shuffle**: the ticked ones keep their markers, the rest change, a line under the tabs says "Kept 8 coloured sections as they are · Recolour them too", and they flash outlined. Close it (✕) and Shuffle again: not said again. **Undo**: the ticked ones still keep theirs. Change **Shading › Shadows**: the ticked ones keep their tones.
- [ ] **Recolour them too:** after a change, tap it on that line: those sections get new markers and are unticked. One **Undo** puts the ticks and markers back.
- [ ] **Balance:** Pattern › Random › Main colour with a saved palette of 4–5 colours (two of one family, the rest scattered): the bar's figures are what's painted (to the nearest 5); a colour far from the others is in **Accents**. A 2-colour palette lays 70/30 and says one marker leads the main colour, with **Add shades**.
- [ ] **Codes button in Colour along:** off shows every section in its colour, ✓ on the ones you've done; on again, done ones go pale. Finish a page (Mark all done on each row): the whole picture shows in colour, and the banner says "166 sections · 16 markers · coloured today".
- [ ] **Reopen** a part-coloured guide from Home or the Library: it opens in Colour along; its Home card says "12% coloured".
- [ ] **Focus mode** with shading: the highlight, base and shadow are chips under the name, the step you're on lit (Colours › Step through each tone); the tip line under them isn't cut off. The picture sits in the middle when it all fits, with no black band above it.
- [ ] **Find next** zooms to fit the section, outlines it, and a screen reader hears "Next section to colour: 3 of 9 left".
- [ ] **Codes on the picture** in sections that nearly hold one are readable at normal zoom; zoom in and they redraw a moment later, still readable.
- [ ] **Print** (Share › Print…, Codes): no two labels on the colouring page overlap; small sections have a dot and a lettered dashed box; the box's letter sits in a corner clear of the labels; the close-up pages show them magnified with their codes, none cut by a close-up's edge. The key has a box to tick and an ORDER column (1st, 2nd …). Try Numbers: fewer close-ups.
- [ ] **The rest:** "← Plan" in Colour along; Save on a new guide says "Saves itself from now on ✓" in the header (no toast); a toast with Undo stays while your finger rests on Undo; Blend's Mix says Muted; Filters say Warm only / Cool only; Keep as is when straightening leaves "Page kept as photographed · Straighten"; the tool row fits on your phone in Photo zoomed in; Library's delete is a bin; Markers search says when more are in All; Palette's card shows the name it saves under.

## 3c. Random's Balance, v283 (5 min)

On one of your own photographed pages, then the sample.

- [ ] **Main colour:** Pattern › Random. Balance shows **Main colour** on, and a bar of three colours ("Greens · 60%", "Teals · 30%", "10%"). The picture is mostly the first colour, a third the second, and small bright accents spread over it (none on the biggest sections). The line under it says what's used.
- [ ] **Choosing colours:** tap the first part of the bar: a sheet of Auto and your colour families as strips of your markers. Pick one: the picture changes, Undo says "Main colour: …", and Colours › Temperature greys out ("Main colour sets this"). Pick, for the main colour, the family the second has: they swap.
- [ ] **Other pairings** gives a different pairing each time; **Shuffle** keeps the colours and moves them about.
- [ ] **Does it look good?** Try three or four pairings on your page. Do the accents read as accents (not sprinkles, not blobs)? Is 60/30/10 about right, or would you want the main colour stronger or weaker?
- [ ] **Mixed** looks like Random did before. Tick **No repeats**: every section a different marker; Colours says "one per section".
- [ ] **Surprise** a few times: now and then it picks Random with a main colour, and its message says so.
- [ ] **A zone:** make a small zone on Random › Main colour: its line says it's too small for an accent.
- [ ] **Save, leave, reopen:** the colours are as they were. An older guide on Random opens on Mixed, unchanged.
- [ ] **The Print sheet** (Share › Print…): it sits right under the picture, with no gap between them (the fix for the flaky WebKit test).

## 3b. Test strip, Radial's centre and zones, v282 (6 min)

On the sample, then on one of your own photographed pages.

- [ ] **Test strip:** Share › Print › Pages › **Test strip**. Labels and Darker labels grey out. Download: a page of boxes, one row per marker numbered as the key is, each with a ×1/×2 box and a thin bar in the screen's colour under it. With shading on (Light & shadow): a long box in thirds, "H … · B … · S …". A grey or cooler shadow says "S … over B"; paper-white highlights say "H: paper". With a zone shaded differently: rows "1a in Main", "1b in Bell". Print it on your usual paper, colour a few rows and let them dry: does the "over B" third come out darker than the base? Does the paper say which marker is which clearly enough? The app should reopen on Page + key next time, not the strip.
- [ ] **Radial's centre:** Pattern › Gradient › Flow › **Radial**: a ⊕ sits in the middle of the picture and the line under Flow says "Centre: in the middle". Drag the ⊕ to a corner with a finger: the rings follow while you drag, and one Undo takes it all back ("Radial centre moved"). **Back to the middle** puts it back. Switch to Colours or Shading: the ⊕ goes. Make a zone: its ⊕ starts in the zone's middle, and moving it doesn't move Main's.
- [ ] **Paint in a zone:** in a zone set to Manual, turn on Paint and drag across the whole picture: only the zone's sections change, and a message says how many in other zones were left. In Manual, tap a section of Main: its tip says "Zone: Main" with **Edit this zone** (no marker picker).
- [ ] **Greys:** Colours › Random (or Blend) with 6–10 markers: no black and no greys unless you've chosen a grey-heavy Temperature. At 12 or more, at most one grey.
- [ ] **Glazes:** Shading › Shadows › Grey (or Cooler). Colour along, focus mode: each section's base first, and then a second pass for the shadows ("over the base once it’s dry"), counted "section 1 of …" again. The highlight and shadow of one colour are never the same marker.
- [ ] **Focus mode, zone by zone:** Colour along › Zone by zone › focus mode › Colours: the chips name their zone ("R38 · Bell"), Main's first; a Bell chip goes to that marker's Bell sections.
- [ ] **Keyboard** (a Mac, or an iPad with a keyboard): open a zone's editor, then Tab until **Choose sections with the keys** shows, and press Enter. The arrow keys move a yellow ring between sections; Space adds the ringed one or takes it out, and the count under the name changes. Escape closes the editor. With VoiceOver on, each move says the section's marker and zone.

## 3a. Shading per zone, v281 (5 min)

On the sample: Shading › Light & shadow, then a zone "Bell" of the bell's sections (2y).

- [ ] **The Shading tab:** Off / Shadows / Light & shadow, the note, "Show tone lines" and "Leave sections flat" at the top; then the chips **Main · Bell ✎ · ＋**, **☑ Shade Bell**, Roundness, and Highlights and Shadows side by side. Tap **Main**: it reads "Shade Main", and Pattern and Colours are on Main too.
- [ ] **Bell's own:** with Bell chosen, set Highlights to Paper white, drag Roundness and the Shadow amount: only the bell's shading changes; the tentacles keep theirs. Undo's label names the zone ("Bell: Roundness changed").
- [ ] **Flat:** untick **Shade Bell**: the bell's sections are one colour each, and the controls under it say "Bell is flat". Tap a bell section: the tip says "Bell is flat". **Leave sections flat**, then tap a bell section: a message says it's flat already.
- [ ] **Colour along:** a marker used in both Main and Bell shows both highlights ("H … / paper"); open its row: a line for Main and one for Bell. Zone by zone: Bell's rows (if Bell is flat) have no H/B/S line.
- [ ] **Print:** Share › Print: the key has an "in Bell" line under a marker shaded differently there, and prints fine.
- [ ] **The light:** with a zone on the Photo pattern (and its photo in place), Shading shows **Light from: The sun / The photo**. Switch the chips: the light doesn't change. Tap The photo: parts of the picture the photo doesn't cover stay flat, and a line says how many.
- [ ] **Main flat:** tick off "Shade Main", then delete Bell: the whole picture is shaded again.
- [ ] **Save, leave, reopen** from the Library: each zone's shading is as it was.

## 2z. Zones after the review, v280 (3 min)

On the sample, with a zone "Bell" of a few top sections (2y).

- [ ] **Random stays put:** set Main to Random, then open Bell's editor and tap two more sections. After Done, Main's colours are exactly as they were.
- [ ] **Sensitivity twice:** ← Edit sections, drag the Sensitivity slider through two or three stops, Build guide: Bell is still the bell, not scattered sections elsewhere. ← Edit sections, Undo, Build guide: Bell is on its old sections again.
- [ ] **Turning:** ← Edit sections, ↻ turn the picture, Build guide: a message says the zones were cleared. ← Edit sections, Undo, Build guide: Bell is back.
- [ ] **Focus mode zone by zone:** Colour along › Zone by zone, open one of Main's markers that Bell uses too, Focus mode: "Section 1 of n" counts Main's only, and Colours › Mark all done ticks only Main's. Back in the list, switch to Whole picture and back: the Done group is still there, and its rows say "· Main" or "· Bell".

## 2y. Zones, v279 (6 min)

Use the sample jellyfish, then one of your own drawings.

- [ ] **Making a zone:** Pattern tab, **＋ Zone** beside "Colour pattern". The Pattern tab becomes the zone editor (the name with **Done** beside it, "No sections yet", Delete zone) and the picture fades to almost white. The keyboard doesn't come up by itself. Tap the bell: it comes back in colour and the count says 1 section. Drag a finger across the tentacles: every section the finger crosses comes into the zone, and the page doesn't scroll while you drag. Start a drag on a section already in the zone: that drag takes sections out instead. Two fingers still move and zoom the picture.
- [ ] **Name it:** tap the name field, type "Bell" and tap Done on the keyboard. **Done** beside the name: the Pattern tab comes back with chips at the top, **Main · Bell ✎ · ＋**, Bell on.
- [ ] **Its own pattern:** with Bell on, tap Random, then Blend, then Gradient › Radial: only the bell's sections change; the rest of the jellyfish keeps its colours every time. Tap **Main**: its sections flash with a yellow outline, and the Pattern tab shows Main's settings; change Main's pattern and the bell keeps its colours.
- [ ] **Colours tab:** the same chips at the top, "Markers in this zone", and the marker count and Mood change only the chosen zone.
- [ ] **Blend in a zone:** its anchors appear only in its part of the picture; tapping a section in Main says "That section is in Main…".
- [ ] **A section's tip** (tap a section in Main while Bell is chosen, or the other way round): it says "Zone: …" with **Edit this zone**, which switches to that zone.
- [ ] **Undo** after each of these takes back just that step, and its label names the zone (e.g. "Bell: Pattern: Random", "Bell: 3 sections added", "Zone renamed: Bell").
- [ ] **Edit the zone again:** tap Bell's chip while it's on (✎): the editor opens. **Delete zone** puts its sections back in Main; Undo brings it back. **＋** with no sections then Done leaves no empty zone behind (a message says so).
- [ ] **Save, leave and reopen the guide from the Library:** the zones, their names and patterns are all there, and every section has the colour it had.
- [ ] **Colour along:** "Whole picture / Zone by zone" above the list. Zone by zone: each zone's markers under its name; opening a row lights only that zone's sections; Mark all done ticks only those; focus mode finishes Main before Bell.
- [ ] **← Edit sections**, leave a bell section out, Build guide, bring it back, Build guide: it's back in Bell.
- [ ] **Everything in a zone:** in Bell's editor, drag over the whole jellyfish until Main has nothing left, Done, tap **Main**: a line under the chips says Main has none to colour.
- [ ] At the narrowest width (Slide Over), the chips scroll sideways if they don't fit, and nothing overlaps.

## 2x. Values, Colour along's order and Find next, v278 (2 min)

- [ ] **The tool row under the picture** has a new button with three grey bars (Values). Tap it: the picture turns grey, the button shows as on, and everything else (the sun, tips, the outline of a tapped section) keeps its colour. It stays on in Colour along and focus mode, is gone on ← Edit sections, and is back (still on) after Build guide. Tap it again: colours back. The row still fits without the "· N markers" part of the count being cut mid-word.
- [ ] **Colour along's list** starts with the lightest marker and ends with the darkest.
- [ ] **Find next:** open a marker with several sections and tap Find next a few times: it starts at the top of the picture and moves to the nearest section each time, the same way focus mode goes.
- [ ] **← Edit sections**, move the Min section size slider one notch and back: no orange "Section edits not saved" line. Drag it well to the right: the line appears.

## 2w. Start colour, Highlights and Shadows, smallest section, v277 (4 min)

Use the sample jellyfish, then one of your own drawings, with your whole collection.

- [ ] **The sample** opens with **166 sections** in the tool row. **← Edit sections**: the Min section size slider starts about a third of the way along; dragging it all the way left changes nothing on the sample, and dragging right drops the small sections a few at a time (not most of them in the first quarter).
- [ ] **One of your own photos:** its sections look as clean as before (no new specks or slivers counted as sections). If some appear, say how many and where.
- [ ] **Pattern › Gradient, Start colour** (with Temperature on Any): the strip above the slider shows your markers round the colour wheel. Dragging it moves which colour the flow starts with, and the colours follow a moment after; the label names the colour, and once moved, a line under it names the biggest colour step. **Reversed** keeps that colour at the start. With **Warm**, Start colour isn't there.
- [ ] **Shading › Light & shadow:** Highlights and Shadows sit side by side, each with its Amount slider under it; Show tone lines and Leave sections flat share a row (in Slide Over they may stack).
- [ ] **Shadows › Cooler:** shadows turn towards blue and violet but still read as darker, not brighter. Tap a section: the tip names the shadow marker. **Grey:** shadows look duller, like the colour in shade.
- [ ] **Highlights › Warmer:** highlights turn towards yellow and peach. **Paper white:** a small white patch on the lit side of each section, fading into the colour; Colour along says to leave it white.
- [ ] **Undo** after each of these takes it back, and its label says what it takes back (e.g. "Shadows: Cooler").
- [ ] Do the cooler and grey shadows look like what your markers would do over each other? Note any that look wrong (a shadow that looks brighter, or the wrong colour).

## 2v. Keyboard in Safari, v273 (1 min, needs a keyboard: a Mac, or an iPad with one)

- [ ] **Markers:** Tab to a marker, then press Shift+F10: its details open (the long press still does too).

## 2u. Photo pattern figures and marker count, v272 (4 min)

Use one of your own photos over one of your own drawings, with your whole collection.

- [ ] **The figures under the photo** say "x% of sections are a close match to the photo or better" and "N are only a rough or loose match". Tap a few sections: the tip's word (near-exact, very close, close, rough, loose) matches what Match says for that colour.
- [ ] **Show the rough matches** fades only sections that look clearly off.
- [ ] **Closer with:** each suggested marker, looked up in Match on that section’s colour, is clearly closer than the best of yours.
- [ ] **The suggested count:** a line such as "About 17 markers get as close as all your markers can. Use 17" appears shortly after the photo is placed (not with a photo of one of your coloured pages, where every marker still helps a little). Tap Use: the slider moves to that number and the line goes; Undo puts the count back.
- [ ] **Dragging the marker slider** stays smooth; when you let go, a few sections may switch marker as the fuller search finishes.
- [ ] **Lining up with Fill on the iPad (full width):** drag the photo where it shows beside your drawing, not only over it: it moves every time, and the colours follow a moment after you let go. Switch to the Colours tab and back: lining up has finished (no see-through photo).
- [ ] **Safari (iPad in Slide Over, or iPhone), Colour along:** open a row near the bottom of the list, and press and hold a section whose marker is far down: the open row ends up fully above the bottom bar.
- [ ] **Safari, ✓ Mark all done:** a quick double tap ticks everything and does not clear it again.
- [ ] **Safari at the narrowest width (Slide Over):** Colours › Mood shows every label in full (one row of six is right when they fit); Share's ✨ Reveal & share and Save image are each on one line (stacked if they don't fit side by side).

## 2t. Readable labels, v271 (2 min)

- [ ] **A guide with blues and teals** (for example Ohuhu B111, BG011, BG212): their codes on the picture are dark text now, and easy to read on your phone.
- [ ] **Markers** and **Palette:** codes on blue and purple swatches are readable.

## 2s. Colour engines second pass, v270 (6 min)

- [ ] **Match › Photo:** photograph a marker swatch on white paper, tap **Tap the white paper**, then the paper: "Lighting corrected" shows and the match changes; ✕ removes it. Try once in daylight and once under a lamp.
- [ ] **Match labels:** a marker you own matches itself as Near-exact; "Closer ones you could buy" only appears when one is clearly closer.
- [ ] **Palette › From photo** on one of your photos: no two colours look the same; the size you asked for; Tap the white paper re-picks the colours.
- [ ] **Photo pattern** with a photo of one of your coloured pages: "Lighting corrected from the paper" shows; areas you left white stay white; turning it off and Undo work.
- [ ] **Random** with "Keep touching sections clearly different": no two touching sections look alike.
- [ ] **Blend › Mix:** Muted, Vivid and Like paint each redraw; blue and yellow anchors meet in green with Like paint.
- [ ] **Brand tags:** with Ohuhu and Copic in your collection, every code has a small tag (Ohuhu dark, Copic pale grey); readable on your phone at normal zoom; the PDF shows grey tags.
- [ ] **Colour along:** each marker's lighter and darker companions really are lighter and darker.

## 2r. Colour engines, v269 (6 min)

Use your own collection and one of your own pages.

- [ ] **Gradient, many markers:** Pattern › Gradient, marker count up to the maximum. The line under Colours says "Using N of M: one per section" when there are fewer sections than markers. No greys or blacks in the picture; neighbouring sections look related.
- [ ] **Look:** Auto, Smooth and Light to dark each redraw at once; the line under the row says what Auto is doing. Undo takes a change back. Save, reopen: the Look is kept.
- [ ] **Mood** (Colours tab): six choices, two rows of three on a phone. Pastel looks light, Deep dark, Earthy soft and brown-leaning. With a saved palette it's greyed out.
- [ ] **A monochrome or analogous palette** (Generate palette) runs from one end to the other with no seam; Shuffle gives a new palette of the same kind.
- [ ] **Palette screen:** Analogous goes up to 8 colours, Tetradic to 12 (shown as a grid); no two look the same. With a small collection the line "Two colours are close…" appears.
- [ ] **Old guides** from before v269 open with exactly the colours they had.
- [ ] **Photo pattern** on a photo of a coloured page lines up the right way round.

## 2q. After the code cleanup, v268 (3 min)

Nothing should look or work differently. A quick pass:

- [ ] **Screens look the same:** Home, Markers, Palette, Library, Match, Help and a guide (each tab, Colour along, Edit sections) look as they did in v267, including at a larger text size.
- [ ] **Dialogs:** open and close Library, Help and Back up & restore by tapping outside them and with their ✕.
- [ ] **iPad with a keyboard:** Escape closes the top thing only — a dialog, then the marker picker, then a sheet, then the section tip, then focus mode, Reveal and full screen, one per press. Escape while renaming a guide cancels the rename (even in full screen).
- [ ] **A saved guide** with shading, a generated palette and pins reopens exactly as it was; Undo after changing its pattern and shading brings each step back.
- [ ] **Sideways at a large text size:** Library › Back up & restore › Markers & palettes as text: the box opens, the dialog scrolls, and tapping the link again hides it.

## 2p. v267 decisions (4 min)

- [ ] **Brand letters:** own only Ohuhu? Markers › Owned shows no O/C letters. Add one Copic: letters appear everywhere, including Match's results and on the guide picture.
- [ ] **Undo in the guide:** Shuffle or change the pattern: no Undo toast, and ↶ Undo in the tool row takes it back. Surprise still offers Undo in a toast.
- [ ] **Reset progress** (in Colour along, ⋯ › Reset progress) with some ticks: it asks "Clear all N ticks?". Cancel keeps them. With nothing ticked it's greyed out.
- [ ] **Zoom:** zoom in on Plan, then open Colour along: it starts at the full picture. Same going back.
- [ ] **Colour along the first time** (try it in a private tab): two lines and More; opening the first marker folds them away.
- [ ] **Home on an iPhone in Safari** with a guide not backed up: Back up shows before Add to Home Screen.
- [ ] **Help › Your data › Find lost guides:** says nothing was found (on a healthy device).

## 2o. Review 5 checks (5 min)

- [ ] **Section edits:** Save a guide, ← Edit sections, merge two sections: the header says "Section edits not saved". Tap ⋯ › Try the sample: it asks Build / Discard / Cancel.
- [ ] **Two tabs** (iPad or computer): open the same guide in two tabs, tick in both, reload: ticks from both are there.
- [ ] **Sensitivity** on a coloured guide (Edit sections › Adjust photo) asks first.
- [ ] **Finish a page** in Colour along (Mark all done on every marker): the Page complete banner with Reveal & share comes into view.
- [ ] **Zoom in, then rotate the phone:** no blank strip in the picture.
- [ ] **Sharing:** Share › Guide file, Download PDF and Save image open the share sheet on the phone; on a computer they download.
- [ ] **Welcome at a large text size or sideways:** Add markers and Restore a backup are always visible.
- [ ] **Palette at a large text size:** the harmony name and the codes don't overlap.

## 2n. v265 decisions (4 min)

- [ ] **Buttons:** Home, Markers, Palette, Library and Match buttons are all the same height as the guide's (44px); choices (Owned/Unowned/All/To buy, harmonies) are a little shorter. Nothing is cut off at a larger text size.
- [ ] **Home:** at most one card under the three tiles (Add to Home Screen, then Back up, then What's new). Tapping Not now / Later / ✕ shows the next one. Help › About lists What's new.
- [ ] **Welcome › Restore a backup** (on a fresh install or in a private tab): the file picker opens straight away; Cancel leaves you on the welcome; a backup lands you on Home with "Restored … markers, … palettes and … guides".
- [ ] **Restore on a device with its own palettes:** your palettes are still there afterwards, with the backup's added.
- [ ] **To buy:** every add button says "+ To buy"; the Markers tab says "To buy".
- [ ] **Brand letters:** if you own only Ohuhu, Markers › Owned shows no O/C letters; All shows them. A printed guide says "Ohuhu markers" at the top of its key.
- [ ] **Markers hint:** the first visit explains tap vs press and hold; afterwards it's one ⓘ line.

## 2m. Review 4 checks (4 min)

- [ ] **Two tabs** (iPad or computer): open the app in two tabs, save a guide in one, tick a marker in the other, reload both: the guide is still in the Library.
- [ ] **Straighten a coloured guide:** tick a few sections, ← Edit sections → Adjust photo → rotate: it asks first. Say yes, then Undo: the ticks come back.
- [ ] **Short phone or large text:** at the top of a guide the bottom buttons are fully visible (not under the picture's tool row).
- [ ] **Leave and come back:** scroll down in a guide, tap Home, tap Guide, scroll: the tabs sit under the picture, not behind it.
- [ ] **Colour along** opens with its list visible; tapping ✓ Mark all done twice quickly doesn't clear the ticks.
- [ ] **Keyboard (iPad with keyboard):** Focus mode keeps Tab inside it; tabs switch with the arrow keys.

## 2l. Guide screen (Release 3) (8 min)

Use the sample guide on your phone, then again on the iPad.

- [ ] **Header:** the name with ✎, "Saved in your Library ✓" (or "Sample" for the sample until it's changed), ✨ Surprise and ⋯. ⋯ opens a sheet: New, Save a copy, Help.
- [ ] **Picture:** it starts big and shrinks smoothly as you scroll into the tabs, stopping at a size it never goes below. It doesn't judder or jump while scrolling, including a fast flick.
- [ ] **Switching tabs** (Colours, Pattern, Shading, Share) never moves the picture or the tabs. The app reopens on the last tab you used.
- [ ] **Bottom bar:** it always sits on the bottom edge, including at the end of Share. It's one row of two buttons, and nothing hides under the home indicator.
- [ ] **Tool row:** Undo appears after a change. Codes on/off, − and + work, Fit appears only when zoomed in, and Full screen works.
- [ ] **Drag to scroll:** with the picture at normal size, dragging up and down on it scrolls the page; pinching zooms it. In Paint, dragging paints.
- [ ] **Change colour:** tap a section → Change colour. The sheet opens under the picture, which stays fully visible. Pick a colour, then tap another section: the first one keeps its colour and the sheet moves on. Everywhere outlines every section it changes. Done closes it.
- [ ] **Print:** Share → Print… opens a sheet with the options and a line like "2 pages · Letter · Codes". Download PDF works.
- [ ] **Colour along:** the list starts right under the picture. Tap a marker to open it (Mark all done, Find next, Blends); tap it again to close it. Press and hold a section: its marker opens and scrolls into view. Finish a marker, leave and come back: it's under "Done (1)".
- [ ] **Sideways (phone and iPad):** the picture sits beside the controls, the tools sit next to the picture (not on it), nothing hides under the camera cut-out, and sheets cover the controls side.
- [ ] **Larger text** (Settings → Display → Text Size): the header, tabs and bar still fit, and the bar stays one row.
- [ ] Focus mode, Full screen and Reveal look and work as before.

## 2k. Completeness release (6 min)

- [ ] **Auto-save:** open the sample, Save once, then Shuffle and tick a few sections. "Saved in your Library ✓" appears. Close the app completely, reopen, open the guide from the Library: the changes are there. **Save a copy** makes "(copy)".
- [ ] **Undo:** Shuffle twice, then ↶ Undo twice: back to the start. Delete a guide in the Library: Undo in the toast brings it back.
- [ ] **Replace everywhere:** tap a section → Change colour → pick a marker → **Everywhere** → Confirm: every section with that marker changes; one Undo reverts all.
- [ ] **Paint:** Style → Manual → Paint. Drag a finger across several sections: they fill smoothly. Two fingers still zoom and don't paint.
- [ ] **Print:** Share → Print options → Numbers + Key only → Download PDF looks right; the paper size defaulted to Letter (US).
- [ ] **Swatch chart:** Markers → Print a swatch chart → Download. Print it and colour a few boxes; the boxes fit a brush nib.
- [ ] **To buy:** in Match a colour, add a suggestion; it's under Markers → To buy. Press and hold one of your markers → Dry: new guides leave it out.
- [ ] **Help:** tap ? on the guide screen: How it works, photo tips and glossary read well. What's new showed once on Home after updating.
- [ ] **iPhone in Safari (not the Home Screen app):** the Add to Home Screen card appears; **Back up** opens the share sheet and Save to Files works.
- [ ] **Text size:** Settings → Display (iPhone: Display & Brightness → Text Size; Android: Font size) to a larger step, and one Accessibility size on iPhone. Home, Markers, the guide's colour-along and Help grow and nothing is cut off. Back at the normal size, the app looks as before. Change the size while the app is open in the background and come back: the picture and bar sit correctly.

## 2d. Filters, Reveal and backup (3 min)

- [ ] **Markers → Filters:** tap **Pale** — only pale markers show and the chip gets a ✓. Tap **Light** — pale and light show. **Clear** brings back everything.
- [ ] **Share → Reveal & share:** the buttons (Share · Save clip · Replay · Close) sit in a solid bar under the picture, readable in any light. The **✕** top right also closes it.
- [ ] **Library → Back up** downloads one file (markers, palettes and guides). On a second device or a fresh install, **Restore** that file: markers, palettes and guides all come back.
- [ ] An older backup file (from before this version) still restores from the same **Restore** button.

## 2f. Colour from a photo (4 min)

On a guide, open **Style → Colour pattern → Photo** and pick a colourful photo (a sunset, a painting, fabric).

- [ ] The photo appears see-through over the picture, covering the artwork. The guide recolours in the photo's colours within a second or two.
- [ ] One finger drags the photo; two fingers resize and turn it. When you let go, the colours follow (e.g. drag the sky down and more sections turn blue).
- [ ] **Fill / Fit / Stretch** re-place it; the **See-through** slider changes how strongly it shows.
- [ ] **Done lining up** hides the photo and shows just the guide. **Line up photo** brings it back.
- [ ] **Colours → Markers in this guide** starts at 24 for a photo; lowering it (e.g. to 6) keeps the main colours of the photo, not a random 6.
- [ ] Pin a section (Style → Pin colours), move the photo: the pinned section keeps its marker.
- [ ] Save, close the app, reopen the guide from the Library: same colours, and **Line up photo** shows the photo where you left it.
- [ ] Take a photo of a coloured version of the same page (or a coloured example of it) and choose it: "Checking whether this is a coloured version…" shows next to the photo, then it lines itself up ("Lined the photo up…") and most sections get the right colour. A photo taken at a slight angle may need a nudge.
- [ ] Choose an unrelated photo (a sunset): it stays where Fill put it, with no message. **Line up automatically** on it says it couldn't match.
- [ ] Photo now sits between Blend and Manual in Colour pattern.
- [ ] The line under the photo says what share of sections are a close match, how many are left white, and how many are only rough. **Show the rough matches** fades the good ones so the rough ones stand out. "Closer with:" lists markers you don't own.
- [ ] Use a photo with white in it (clouds, paper, a white shirt): those sections stay white with no label. Tapping one says to leave it white. Colour along and Focus mode skip them; the PDF key says how many stay white. Untick **Leave white areas of the photo white** and they get markers.
- [ ] **◐ Photo** (under the picture, also in full screen) shows the photo on top to compare; tap again to go back.
- [ ] Tap a section: the tip shows the photo's colour there and how close the marker is.

## 2e. Speed with your own photo (3 min)

Take a fresh photo of a real colouring page with the phone camera (full size, not a screenshot) and make a guide from it.

- [ ] **Build guide** shows "Building…" straight away. Note roughly how long until the guide appears.
- [ ] Turn **Shading** on, then drag the sun around: the preview follows your finger (it may look a little soft while dragging and sharpens when you let go).
- [ ] **Colour along → Focus mode:** each **✓ Done** moves on without a noticeable pause.
- [ ] Tick a few sections, leave the app, come back: progress is kept (autosave still works).
- [ ] In the sections editor, split or merge a few sections and tap **Undo** several times: each undo works.
- [ ] Photograph a page with some table showing around it, on grainy or textured paper if you have some: the sections editor shows the drawing's sections, not the blank margin, the table or a scatter of crumbs.
- [ ] Anything that still felt slow: note what you tapped and roughly how long it took.

## 2h. Straightening a photographed page (4 min)

Take these with the phone camera (not screenshots), then **New colouring guide → Make a guide from my photo**.

- [ ] A page lying on a table, photographed at an angle: the photo shows a yellow outline round the page for a moment ("Straightening the page…"), then the sections appear flat and square. The line "✓ Page straightened · Undo · Adjust corners" sits above Adjust photo.
- [ ] **Undo** goes back to the photo as taken; **Adjust photo → Straighten page** brings the corners back.
- [ ] The same page from straight above, filling the photo: nothing happens and nothing is said.
- [ ] A scan or screenshot of line art (even one with a printed border): nothing happens.
- [ ] Your hand resting on the page, or one corner off the photo: the corner handles open with a note saying why. Drag a corner: a magnifier shows under-finger detail. **Straighten** or **Keep as is** both work.
- [ ] In the corner handles, **Page shape → Letter / A4 / Square** changes the shape of the result.
- [ ] Round shapes in the drawing (circles, dots) still look round after straightening, not oval.
- [ ] **Photo colour pattern:** photograph a coloured copy of a page at an angle (or turned sideways) and choose it: it says "Straightened the page in the photo and lined it up with the picture", and the colours land on the right sections.
- [ ] Rough time from choosing the photo to seeing the sections: ______

## 2g. Palette sizes (1 min)

- [ ] **Palette → Tetradic**: sizes 4–8, all on one row; 8 gives two markers per hue. **Triadic / Split complementary** go to 7, **Complementary / Analogous** to 6, **Monochrome** to 8.
- [ ] **Photo**: pick a photo; sizes 4 · 6 · 8 · 10 · 12 · 16. With a small collection, a high size may say "16 colours pulled → 11 distinct markers you own".

## 3. Match a colour (3 min)

- [ ] Open **Match a colour**. It starts on **Photo**.
- [ ] Pick a photo, tap a spot. The best-match card shows a swatch and marker code and is readable.
- [ ] Switch to **Camera** and allow access. The **back** camera is used (not the selfie camera).
- [ ] The live picture fills the frame without stretching. The crosshair sits over what you're pointing at, and the match changes as you move.
- [ ] Buttons over the camera image are readable in bright and dark scenes.
- [ ] Close the dialog. The camera light / indicator turns off.

## 4. Share and print (3 min)

On a finished guide, open the **Share** tab.

- [ ] **Show it off → image:** the share sheet opens (Messages, Photos / Save Image, etc.). The saved image looks right.
- [ ] **Reveal clip:** it records and plays back. **iPhone:** note whether it shares as a video, saves to Photos, or fails.
- [ ] **Print → PDF (Letter)** opens or shares a PDF. Open it: the page isn't cut off, labels are readable, and the key is tidy.
- [ ] Switch to **A4** and generate again. The PDF is A4 (check in the Files app info, or by the page shape).
- [ ] With **blend companions** on, the key still reads cleanly.
- [ ] **Plan & keep → Save.** The guide appears in Library with a thumbnail.

## 5. Storage survives (2 min)

- [ ] Save a guide and a palette. Swipe the app away completely, reopen: **Library** on Home shows the count, and both are in it.
- [ ] Start a new guide, change a few colours, *don't* save, and swipe the app away. Reopen: you're offered to resume it.
- [ ] **Library → Import a guide** opens the file picker. **Library → Back up** produces one .json file you can find in Files / Downloads.
- [ ] **iPhone only:** if you haven't opened the app for a week or more, check that your collection and guides are still there. Safari can clear site storage for home-screen apps that go unused; the backup is your safety net.

## 6. General feel (as you go)

- [ ] No button is too small to hit reliably with a thumb.
- [ ] No text is cut off or overlapping, on the smallest phone you have.
- [ ] Dark mode looks intentional everywhere, with no white flashes between screens.
- [ ] Anything that felt slow (more than ~1 s with no feedback). Note what you tapped.

## Report back

Send the ❌ lines, plus anything in focus mode that felt slow, confusing or jumpy.
