# Plan — "What's left?" (7a), gated on a real second photo

Status: **planned, not built; the gate passed (below).** Decided (decision 9, c): v327.2 ships the coloured-in offer's pale colours now; this
waits for one real check. Trials so far: `docs/PLAN-v327.1.md` (7a trial results).

## What it does

In Colour along, a photo of the page as it is now ticks what's been coloured since, as an offer: "6 sections look
coloured since last time. Mark them done", with those sections outlined (as v323's colOffer line). For someone who
colours on paper and doesn't tick as they go, it brings the guide up to date in one photo.

## The gate (before any app code)

- **The photo:** the same sketchbook page as `20261017_084730.jpg` (Documents › Drawings), photographed again after
  colouring 5–15 more sections, in different light if it happens that way; a hand or phone shadow is fine and useful.
  Saved to Drawings with any name.
- **The check:** the trial scripts (scratchpad `wl/real/`) run on it: lined up with the first photo's guide, then read
  as change from the first photo.
- **The bar:** lined up within the line width (edges a median 0–1 px off, 90% within 3 px); 95% of sections right;
  every newly coloured section found apart from markers under L* 90 against the paper (Y00 and the 0-series),
  reported by marker. Fewer than 5 blank sections called coloured.
- **If it misses:** report which part failed (lining up or reading) and what would fix it before deciding anything.

## How it works (from the trials)

1. **The reference:** the guide's own picture, kept on this device since v318.34 (the `src-<id>` record:
   `25-source-photo`), put through the same turn, tilt and crop (`srcRGBA`, v327.2). A guide without it (from before
   v318.34, from a file, or the sample) reads against the paper instead (`paperSecs`, v327.2): weaker at the pale
   sections by the page's coloured edges (decision 4 below).
2. **Found and straightened** as Your page is: `pgFind` corners, then warped to the guide's size.
3. **Lined up on the lines:** ECC on line maps at a quarter size, a translation then a homography; then a 6 × 4 grid
   of per-tile ECC translations, blended. Trials: corners alone a median 4–5 px off and up to 11–26 px; with this,
   0–1 px, even with a 12 px paper bend.
4. **Read as change:** each section's middle (2 px in from its lines), the new photo against the reference, with the
   light's difference between the two smoothed out over what hasn't changed. Trials: 40 of 40 newly coloured found;
   13–25 of 365 blank called changed in soft focus (small sections in the dense middle).
5. **Offered**, never ticked by itself; a section that now looks blank is never unticked.

Plain JS, in the existing JOBS worker (the main thread draws the picture and reads the result); no library (OpenCV.js
only as an on-demand fallback if a real photo shows plain JS can't cope; licences in `PLAN-v327.1.md`).

## Decisions to walk through once the gate passes

1. Where it lives: Colour along's toolbar (recommended: that's where you are when you come back to a page) or the
   guide's ⋯ menu.
2. Offer or tick: an offer with outlines, as the coloured-in offer (recommended).
3. Sections that look blank now but are ticked: leave them (recommended); never untick from a photo.
4. A guide without its picture: read against the paper with a note that it's less sure (recommended), or not offered.
5. The photo: used and dropped, never kept (recommended: storage, and nothing to manage).
6. The name: "What's left?" or "Update from a photo".
7. (added by the author) Un-colour: the same feature used to get a blank version of a coloured page, to print and
   colour again.

## Work, once decided

- ECC (translation, homography) and the tile shifts, in the worker: about 300 lines, with unit tests on made-up pages
  (shifted, turned, bent) and the trials' numbers as the bar.
- The change reading: about 100 lines beside `paperSecs`.
- The button, the picker, a progress line, the offer: about 150 lines; e2e on a made-up page coloured twice.
- About 3–4 days with the pressure tests, then the usual debugging pass and GitHub run.

## Risks

1. **A real second photo** has glare, ink sheen, a hand's shadow and different focus, which the made-up shots don't;
   that's why the gate.
2. **Very pale markers** (Y00, 0-series) can barely be seen by a camera on white paper; they may need a "pale markers
   may not show" note.
3. **Soft focus** spreads the lines' black into small sections; a "maybe" list for those may be better than counting
   them.
4. **Time on an iPad:** not yet timed in a browser (the trials used OpenCV in Python); timed first in the build, with
   a progress line meanwhile.

## The gate's result (26 Oct, the author's 9 photos in Documents › Overlay; scratchpad `ov/`, never committed)

- **The photos:** one sketchbook page, 3 shots before and a sideways one (glass table, two with soft shadows), then
  8 sections coloured, 5 shots after (two on a wooden table, one with a hard hand-and-phone shadow across the middle,
  two with soft shadows). Each opened in the app as a colouring page (corners found, straightened: `srcRGBA`); the
  guide is the cleanest before-shot (161015: 437 counted sections).
- **Lining up** (Canny edges against the guide's, median / 90th percentile, the binding left out): corners alone 1.9-5.5
  / 4.6-18 px; ECC homography at 1/8 then 1/4 size 0-1 / 1-1.9 px; with a 4 x 6 grid of tile shifts **0 / 1 px on
  all 8**, the sideways shot too (its turn found by trying the four). 1.3-2.8 s in Python (OpenCV).
- **Reading** (change from the guide's picture, the light's difference smoothed over what hasn't changed, each
  section's middle): a section is coloured since when its colour (a*, b*) moved 8 or more, or it went 25 or more
  darker; not the sections the guide's picture shows coloured already, nor the binding. **All 8 found in all 5
  after-shots (40 of 40) and nothing else in any of the 8 shots**, the hard shadow included. On the whole change (ΔE)
  instead, the hard shadow gave 23 false. The margin is narrow: the palest new one (a pale yellow) moved 9.4-12.6, the
  worst blank one 7.5. One page, 8 sections, none as pale as Y00: the rule was set on this data.
- **Found on the way, v327.2's paper reading** (not pushed): right in even light (3-6 sections off of about 107), but
  in the 4 shots with soft shadows it offered **28-67 blank sections**, and on the glass table 14-22 of the spiral
  binding's loops (sections in the guide; v327.1's reading offers 6-14 of them on 3 shots). A variant that grows the
  paper from section to neighbouring section across the lines (scratchpad `js/grow.py`) cut the shadows' false
  offers to 1-12 but lost section fragments inside fills; the palest sections are read differently shot to shot, so
  what's true there needs the author's eye.

## As decided

- **10** (a): v327.2 held, never pushed; v327.1's coloured-in offer stays; the pale-colour reading reworked with this
  build (the binding left out, the paper judged by its neighbours).
- **11.1** (b): a line under the Plan's tabs when the guide is opened again ("Coloured some on paper since? Tick them off
  from a photo ✕", worded by 11.6): not finished, nothing ticked the visit before, not straight after Build, one at a time with the other
  lines, ✕ until the next opening; and a quiet line always in Colour along under its hint ("Coloured on paper? Tick them off from a
  photo"). Widened by 11.4: any guide (a printout of it works without its picture). Mock-ups:
  `whats-left-mock-phone.jpg`, `whats-left-mock-ipad.jpg` (a link in the pinned bar was tried: 30 px more bar for
  everyone, always).
- **11.2** (a): offered, never ticked by itself: "8 sections look coloured since. Mark them done · Check them ✕", the
  sections outlined. **Check them** fits the page, says "Tap a section to add it or leave it out", and the bar becomes
  Cancel | Done (amended by 11.3: a draft, below); a marker's row open is closed, leaving Colour along, switching away
  or a reload discards the draft and applies nothing. Mark them done has Undo. The coloured-in offer (v318.35/v323) gets the same
  Check them. Tapping the offer straight on the picture (no step) was ruled out: a tap on an outlined section, meant
  as "yes, done", would leave it out, and the offer lasts across visits. Nothing new: "Nothing looks newly coloured.
  Very pale markers may not show in a photo." Not lined up: "This photo doesn't line up with your page. Try again
  with the whole page in view."
- **11.3** (b): ticks are never undone by a photo. In Check them, a ticked section that reads as plain paper in both
  photos (|a*b*| under 2.5 from the paper there and under 5 darker, in the guide's picture and the new one) and hasn't
  changed is dashed: "2 ticked sections don't look coloured here. Pale markers may not show." Check them is a draft: a
  tap flips whether a section will be done; Done (with "8 to tick · 2 to untick", or what applies) puts it all in
  place as one Undo step (markBack's saved states, unticks too); Cancel discards it. Measured on the 8 shots laid on the
  guide: no coloured section ever flagged; blank ones that would be caught if ticked by mistake 264-275 of 280-288 in
  even light, 115-227 in shadow (quiet, not wrong). Check them is for touch and mouse (Colour along's picture has no
  keyboard way through its sections); keyboard users have Mark them done.
- **11.4** (b): original pages and printouts. A printout's reference is the page redrawn from the guide (pdfArt, the
  printed page is the app's own line art from the sections, not the photo), drawn without its codes, numbers or tone
  marks, and the photo's thin dark marks left out of the reading (so the print settings needn't be known); the
  drawing found by its outer lines (a printer's Fit to page moves it), then lined up as the trial. Which it is: the
  photo against both references; asked once per guide when unsure ("Is this a printout from Marker Studio, or the page
  you photographed?"). An original page without its picture: not offered ("This guide's picture isn't on this device.
  What's left works with a printout of it."). About a day more. **A second gate first:** a printed Page + key (Codes)
  photographed blank, then 5-15 sections coloured (one or two small ones beside coloured ones, for bleed on printer
  paper), 3-4 shots.
- **11.5** (a): the photo is read on the device and dropped; never kept or sent. The offer (its sections) is saved
  with the guide. Comparing with the latest photo instead would carry a bad photo's shadows forward; the trial compared
  every shot with the first. A progress record of photos, or a photo sent with feedback, would be decisions of their
  own.
- **11.6**: **Tick off from a photo** (the name, the Check them step, Help); the lines "Coloured some on paper since?
  Tick them off from a photo ✕" (Plan) and "Coloured on paper? Tick them off from a photo" (Colour along); What's new
  "Coloured on paper? A photo of your page ticks off what you've done." Not "Update from a photo" (beside the Pattern
  tab it reads as the Photo pattern; "Updated to" is the app's update), not "Mark them done from a photo" (stacked under
  the coloured-in offer's own Mark them done), not "What's left?" (reads as a view of what's left). Help already says
  "tick sections off as you colour them". All fit Colour along's line on one line at 390 wide.
- **11.7, pressure test of c** (scratchpad `js/uncolour.py`, the guide 161015): a blank copy as the app prints it (b:
  the ink as one colour), with its edges softened (b+: the mask blurred half a pixel), and from the photo's own ink
  (c: its darkness against the section beside it, so a fill's colour is taken out). c's "line character" on a marker
  drawing is mostly the photo's: the pen's streaks, glare, paper texture and blur, printed as mottled grey lines, with
  rings where dark fills were; b and b+ keep the lines' shapes and weights (the ink mask is the photo's ink). b+ reads
  best enlarged. c would only help pencil or grey-toned lines. Comparison: `uncolour-b-vs-c.jpg`.
- **11.7** (b): **Blank page** in Print › Pages: one page, lines only, no codes or key; "Print a blank copy to colour
  again" in Help and the guide's ⋯ menu. The printed lines' edges softened (the ink mask blurred half a pixel) on every
  colouring page, Page + key too. Independent of Tick off from a photo; can ship first. Not the photo's own ink (c),
  not un-colouring a fully coloured page with no guide (d).

All of 10 and 11.1-11.7 decided. Still to do before the printout part is built: the second gate (a printed Page + key).

## Decision 12 (the print to colour on), as decided

- **a**: Print › Pages: **Page to colour** (the new default: the page with no labels, then the reference, the picture in
  colour with dark codes as Key + reference prints it, then close-ups and the key), **Labelled page** (today's Page
  + key), **For your own page** (today's Key + reference), **Test strip**. Under Page to colour, Labels offers Codes or
  Numbers (for the reference; None would leave no codes anywhere) and Darker labels is hidden; an **Only the page**
  tick prints the page alone (11.7's blank copy, which replaces a separate choice). "Print one-sided: markers soak
  through the paper." in the Print sheet. No margin marks for the close-ups (the reference shows their outlines and
  letters, the two sheets matching 1:1); add later if testers can't find them. A remembered Page + key stays as
  Labelled page.
- **Tone lines** stay on the page to colour (the Tone lines tick turns them off), between B and C of the tone line
  test (`tone-lines-coloured-over.jpg`, `Tone line test.pdf`): 0.5 pt thick, short dashes (1.5 pt on, 2.5 pt off),
  about 22% grey (today: 0.8 pt, 4 pt dashes, 41% grey). Checked on the author's printer with a strip of steps either
  side before it's fixed.

## As built (v328)

All of 10-12 in v328: `docs/PLAN-v328.md`'s As built and `CHANGES.md`. The tone grey is 18% (the author's grey-steps
print), not 22%. The printout photos (11.4) are measured on a simulation of the real PDF; the author's own printout
photos are a ★ DEVICE-TEST item.
