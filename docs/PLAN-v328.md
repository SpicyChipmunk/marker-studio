# Build plan — v328 (everything: the print to colour on, Check them, Tick off from a photo, printouts)

From v327.1 (2bcebaa; v327.2 held and dropped: its paper reading comes back only as decided below). Decisions:
`docs/PLAN-whats-left.md` (10, 11.1-11.7, 12). The author asked for all of it in one version.

## Decided before building

- **P1 (b):** the binding leaves the guide, the print and every reading through the Trim it offer. **P2 (a):** the
  pale-colour reading reworked now (v327.2's paper reading, paper grown from section to neighbouring section for
  shadows, the binding left out), Check them the safety net. **P3 (a):** soft line edges only where the drawing is
  enlarged onto the page (the print is already smooth elsewhere: 203 grey levels at a line's edge on the author's
  page). **P4:** the 18% short dashes on both pages coloured on (Page to colour, Labelled page), still kept off the
  codes; the shading map with all three choices when shaded. **P5 (c):** the shading map (below); the Tone lines tick
  worded as the choice between faint lines and the page's lines only. **Tone grey 18%** (the author's grey-steps
  print).
- **Found: the reference isn't placed exactly as the page to colour.** With shading on, its three-line header puts
  the drawing about 29 px (3.7 mm) lower and 0.1% smaller. Fix: every page that shows the drawing uses the same
  picture box.

## Found by the last pressure test

- **P6 (a, decided): both binding finders, Trim it offered.** The finder misses most of the author's photos: Run on their straightened pictures,
  `edgeBandsOf` found the binding on 3 of 9 (the two on the wooden table, the sideways one): on the glass table the
  spiral's loops are separated by paper and the table shows through, so no line along the edge is "off the paper"
  enough. A second finder that reads the sections (a row of 8 or more small, alike sections, evenly spaced, in a line
  within 8% of one edge, over 40% of its length) found it on 7 of 9, and nothing on the three test pages without a
  binding (letter page, mandala, mandala on a table); together, 9 of 9. Untested: a drawn border of repeated beads
  along an edge (it's an offer, so a wrong find is declined).
- **The finished-page photo's flow is reused, but needs a "what for":** `finRead`/`finFlatten`/`finEdit`/
  `finOrient` (24-page-photo) store the result as the finished photo (`finStore`). Tick off from a photo passes its
  own ending, and reads at the guide's own size (FIN_SIDE 1600 is less than the author's guide, 2149 tall).
- **The worker:** a new JOBS kind (`tick`: lining up and reading), with the page doing it itself when there's no
  worker, as every job does.
- **Saved with the guide (two fields):** the ticks made in the last visit (for 11.1's line) and the printout or
  original answer (11.4); `data.test`'s field counts move.
- **A remembered Labels › None under Page to colour** reads as Codes (None would leave no codes anywhere).
- **Time:** about 9-10 days with the additions (the shading map, the picture box, the reworked pale reading, the
  binding finder). Decided (P7, a): a checkpoint zip after A and B, without waiting for the author's input to finish the release: (the prints and Check them) for the author's iPad, not
  pushed, while C and D are built; v328 stays one release.

## Parts

### A. The print to colour on (12, 11.7)

1. Print › Pages: **Page to colour** (`colour`, the default where nothing is remembered), **Labelled page** (`page`,
   today's Page + key; a remembered `page` stays), **For your own page** (`ref`), **Test strip**.
2. Page to colour: page 1 the page with no labels (`pdfArt(false, sh, lines)`, as Labels › None prints it), then the
   reference as For your own page prints it (the picture in colour, dark codes, close-ups lettered on it), then the
   shading map (shaded guides, P5), then the close-ups and the key. Labelled page and For your own page get the
   shading map too, after their full-page sheet. Every page with the drawing in one picture box. Page 1's header names
   the pages as they now fall.
8. The shading map: the page's lines; highlight white, base 15% grey, shadow 40% grey; its title and a one-line
   legend; a **Shading map** tick (on); the key's shading note names the greys.
3. Under Page to colour: Labels Codes or Numbers (for the reference), Darker labels hidden, **Only the page** (page 1
   alone: 11.7's blank copy). The summary line and the Pages note say what prints.
4. "Print one-sided: markers soak through the paper." in the Print sheet, under Pages.
5. Tone lines (12, P4): 0.5 pt, dashes 1.5 pt on and 2.5 pt off, 18% grey (the author's choice from the grey-steps print). `shadeLinesDraw` takes an on/off pattern; the screen's lines unchanged.
6. Soft edges where the drawing is enlarged (P3).
7. The Print sheet's picture of page 1 (v320) follows the choice.

### B. The coloured-in offer (11.2, 11.3, P1, P2)

1. **Check them**: Colour along's line "60 sections look coloured in already. Mark them done · Check them ✕".
   Check them fits the page, says "Tap a section to add it or leave it out", outlines the offer; the bar becomes
   Cancel | Done with "8 to tick" (or what applies) above it. A draft: a tap flips a section; Done applies it as one
   Undo step (markBack's saved states); Cancel, Escape, leaving Colour along, a reload: nothing applied, the offer
   kept. A marker's row closed while it's open; Focus mode's button hidden. (No dashed "ticked but looks blank"
   sections here: that needs a later photo, C.)
2. The binding (P1, P6): both finders on the picture as straightened; found, Trim it is offered ("The spiral
   binding along the left edge was read as part of the page. Trim it"), and until it's trimmed its sections are left
   out of the offer and every reading.
3. The reworked pale-colour reading (P2) beside colourSecs, after the bloom.

### C. Tick off from a photo, original pages (11.1-11.6)

1. The lines: "Coloured some on paper since? Tick them off from a photo ✕" under the Plan's tabs when the guide is
   opened again (from Home or the Library, not within a visit), not finished, nothing ticked the visit before, not
   just after Build, one at a time with the other lines, ✕ until the next opening; "Coloured on paper? Tick them off
   from a photo" always under Colour along's hint. A visit's ticks counted per visit (saved with the guide: one
   field).
2. The photo: the finished-page photo's way in (24-page-photo, v314) reused: the picker, the page found and
   straightened when the finder is sure (`pgFind`, `pgWarp`, `pgRefFlat`), else the four corner handles. Nothing of
   the guide's own picture is touched. Drawn at the guide's size; the photo dropped after (11.5).
3. The reference: the guide's kept picture (`srcLoad`, 25-source-photo) put through the guide's turn, tilt and crop
   (`srcRGBA`, v327.2's, kept). None (an original page without it): "This guide's picture isn't on this device. Tick
   off from a photo works with a printout of it."
4. Lining up, in the JOBS worker, plain JS: the turn by trying the four; ECC translation then homography on line maps
   at 1/8 then 1/4 size; a 4 x 6 (or 6 x 4) grid of per-tile ECC translations, blended. Not lined up (too little
   agreement): "This photo doesn't line up with your page. Try again with the whole page in view."
5. The reading: each section's middle (2 px in); the light's difference between the two pictures smoothed over what
   hasn't changed; **offered only where the reference was plain paper** (|a*b*| under 2.5 from the paper there, under
   5 darker) **and the section has changed** (a*b* moved 8 or more, or 25 or more darker); the binding left out.
   Plain paper in the reference instead of "not coloured" keeps the pale-colour reading out of it: measured, no
   coloured section of the author's page was plain paper, 279 of its 288 blank ones were, and in a shadow it goes
   quiet, not wrong.
6. The offer: "8 sections look coloured since. Mark them done · Check them ✕" (B1's step), with 11.3's dashed ticked
   sections that read as plain paper in both pictures and haven't changed ("2 ticked sections don't look coloured
   here. Pale markers may not show."). Nothing new: "Nothing looks newly coloured. Very pale markers may not show in a
   photo."
7. A progress line while it works; timed on the iPad.

### D. Printouts (11.4)

1. The reference: the page redrawn from the guide (`pdfArt(false)`) with no labels and no tone lines.
2. The drawing found on the paper by its outer lines (a printer's Fit to page), then C4.
3. The photo's thin dark marks (codes, numbers, tone lines, close-up letters) left out of the reading (a black
   top-hat on the line map).
4. Which it is: the photo against both references after lining up; asked once per guide when unsure ("Is this a
   printout from Marker Studio, or your own copy of the page this guide was made from?"), the answer kept (one field).
5. Tested on the real PDF's page 1, rasterised, coloured by simulation and put through the trial's photo effects;
   the author's printout photos a ★ DEVICE-TEST item before the beta, measured when they come.

### E. Help, docs, tests

- Help: Print (the four Pages, Only the page, one-sided), Colour along (Check them, Tick off from a photo), What's new
  (leading with "Coloured on paper? A photo of your page ticks off what you've done."). CHANGES, DEVICE-TEST,
  REVIEW-v327's and PLAN-whats-left's "As built". Version v328, cache `marker-studio-v328`.
- Unit: ECC (shifted, turned, scaled, bent made-up pages: within 1 px), the tile shifts, the reading (made-up page
  coloured, relit, shadowed: right sections, nothing blank), the plain-paper test, the tone line pattern, the print's
  pages and names.
- e2e: Print (`print`, `print-2`: the new default and names, page kinds and counts, Only the page, Labels under Page
  to colour, the note), Check them (`intake-3`'s offer: add, leave out, Done, Cancel, Undo, reload), Tick off from a
  photo (a made-up page as the guide, the same page coloured and photographed by simulation: the line on reopening
  and not after a tick, the offer, Check them, nothing new, not lined up, no picture, a printout and the question).
  The author's photos never committed; measured locally.
- Prettier on changed files; lint; unit locally; e2e locally only what's touched, Chromium and WebKit; the rest on
  GitHub. A debugging pass with experienced eyes and a fresh-eye pass at three sizes before the zip.

## Order (each with its own tests before the next)

A (print) → B (Check them, the binding, the pale reading) → checkpoint zip → C4 (lining up, in the worker, unit-tested alone) → C5 (reading) → C1-C3, C6-C7 (the
flow) → D → E → passes → zip. About 9-10 days of work; the riskiest first inside C (lining up in plain JS).

## Risks

1. **Size.** The biggest version yet: a fault in one part holds the rest. Built and tested part by part, committed at
   each step; GitHub's run once at the end (the author runs it).
2. **Plain-JS ECC** matching OpenCV's in the trials: unit tests against the trial's numbers; OpenCV.js on demand only
   if it can't (licence fine).
3. **Memory on the iPad:** a 12-megapixel photo is 48 MB as RGBA; it's drawn down to the guide's size at once (as the
   finished-page photo is), the reference and the photo at the guide's size (about 15 MB each for the author's page).
4. **The reading's rule was set on one page's photos;** Check them is the safety net; the printouts untested on real
   paper until the author's photos.
5. **Tests that count things** (the payload's fields in `data.test`, print page counts, the line queue's order) move
   with it.
6. **The tone grey** may move after the author's grey-steps print: one constant.

## As built

- **A** as planned. Page 1 of Page to colour also names the markers ("16 Ohuhu markers"), as the reference does.
- **B** as planned. The spiral finder found 8 of the author's 9 photos (the prototype's 7); with `edgeBandsOf` on the
  straightened picture, 9. The pale reading: 1-9 blank sections offered on the author's photos (v327.2: 28-67 in soft
  shadows), 0-4 missed.
- **Checkpoint zip (P7):** folded into the release: C and D came together soon after B, so the one zip is v328 whole.
- **C** in plain JS, `26-tick.js`, in the worker (`tick`): lined up within about 1 px of OpenCV's trial on all 8 shots
  (median 0.05-0.84 px, 90th percentile under 1.2), 1-3 s on a desktop. The reading as the trial, with CIELAB worked
  out in full (labLut's 6 bits put a blank shadowed section at 9 instead of 7), the light taken out twice (σ 60 px,
  then 30 px without what looked changed) and kept to the light's own cast (TICK_CAST): 40 of 40, nothing else; the
  palest new one 8.5, the worst blank one 6.25. 3-4 s on a desktop.
- **D**: the drawing found on the sheet by its ink, below a header; thin marks by a black top-hat. The real PDF's page
  1 (letter page), 10 sections coloured by simulation, light falling off, blurred, noisy: 10 of 10 on Page to colour
  and on the Labelled page, nothing else. A big section coloured had made the light model take it for light (24
  false); kept to the light's cast, none.
- **Dashed** ticked-but-blank sections: the outline's ring broken into 45° dashes (84-popovers `paint`, `dash`).
- **The binding, after the review:** looked for only in photos of a page (straightened, kept as photographed, or with a
  camera's lens), no deeper than 5% of the edge (a drawn border of beads read as one, 7% deep); the band route only on
  pages not coloured in (as v318.15's Trim it), so 8 of the author's 9 photos, all part-coloured; Auto crop keeps to
  the bands, Trim it takes the binding too.
- **Not built:** a timing line on the iPad (a DEVICE-TEST ★ item instead).
- **Changed from the plan:** a visit's ticks are counted on this device (`ms-tick-visits`), not saved with the guide: a
  visit with nothing ticked isn't saved, so the guide's own count stayed at the visit before's.
- **After eight review rounds** (CHANGES.md lists the fixes): re-measured on the author's shots after the last, Tick
  off 40 of 40 and nothing else, 278 sections read as plain paper; the printout simulation 10 of 10 on both pages;
  in the app end to end (Ben's photo opened from Home, built, Check them, Done, then Tick off with a later photo, on an
  iPad's and a phone's screen): 107 offered, all coloured, the 14 missed being the binding's; 8 of 8 coloured since,
  nothing else. The offer also reads pages with no clear colour now, by colour only (pastels, not greys).
- **Known, not fixed:** a pale blue under a strong warm lamp, on a page with no other colour, may not be offered; a
  grey outline lighter than a dark fill beside it, Enhance off, leaves the fill's edge a little ink; large runs of
  touching pale fills (12 cells or more) can be taken for the light by Tick off (as before the review); a reference
  with a strongly blue daylight shadow leaves some of its sections unread by Tick off (missed, never offered wrongly);
  a hard, strongly blue daylight shadow on a page with no clear colour can be offered; photo tones not yet coloured
  are chosen again on reopening from the saved JPEG (1-7 of 61-67 sections had differed on test photos; B9 meant the
  choice saved, and now is as saved: the photo's pixels are its JPEG's from the page step on, unless Build is tapped
  in the moment before that JPEG is read back); the binding's loops print on Page to colour until Trim it is taken.
- **After a whole-app review** (eight reviewers, each a part of the app, old code included): about 70 findings, the
  confirmed ones fixed (CHANGES.md, "A whole-app review"); No repeats re-timed on a 10,000-section page (6 s to
  0.7 s, the same plan). Left: two tabs saving in the same moment; the crop box's keyboard.
- **After a whole-app review** (eight reviewers, each a part of the app, old code included): about 70 findings, the
  confirmed ones fixed (CHANGES.md, "A whole-app review"); No repeats re-timed on a 10,000-section page (6 s to
  0.7 s, the same plan). Left: two tabs saving in the same moment; the crop box's keyboard.
- **A second whole-app review**: six of round 1's fixes were wrong or slower (zones stuck, No repeats slower on
  ordinary pages, a set's size read as Black, Swap's focus, the close-ups' memory, "as coloured"): fixed, with the
  rest of its confirmed findings (CHANGES.md).
