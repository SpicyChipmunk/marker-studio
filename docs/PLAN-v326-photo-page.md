# v326 — photo-made pages: the plan as decided

Five changes to the photo-made page (v325–v325.2), decided one at a time with measurements on the author's 17
photos (scratch only, never in the repo). Livelier colours was looked at and dropped (5). Nothing here is built yet.

## 1. The markers that would help this photo most

Replaces the small-collection note ("Only N of your markers suit this photo… Use the full range"), which never showed
for small sets (it counted markers within 23 of any colour, at least 8).

- **Measure:** coverage, the share of the photo's colours (the page's own ≤ 500 targets, by weight) within ΔE 10
  (CIEDE2000) of one of the markers the page may use (ppPool). ΔE 6 was too strict, 15 said nearly every photo was
  covered. With *Leave white areas white* on, the photo's white areas count as matched by the paper.
- **Which markers:** greedily, the catalogue marker that matches the most of what's left, again and again, while each
  adds **5 points or more**, at most **6**. Candidates: never a marker you own (any you own, set aside or not); from
  the brands ticked in *Brands I'd buy*, or when none are ticked, your own brands, with a second line for the other
  brand when its list would do **10 points better**. No grey or "line" exclusions (Plan's `photoWant` has them; a
  photo's greys are fur and shadow). Measured: Honolulu 24 gets 1–5 (median 4), Honolulu 72 0–4, Honolulu 216 0–3
  (both brands), the author's 392 none.
- **When it shows (Make page step):** when those markers together add **15 points or more**. Own brand: Honolulu 24
  15 of 17 photos, Honolulu 72 3, Honolulu 216 0, Ciao 24 17, the author's 392 0.
- **What it says:** "Your markers match 25% of this photo. Adding Copic E49, E47, Ohuhu E513 and W-6 would make it
  75%." Each marker a To buy chip (`wishChip`, why 'closer to your photo'). **Try it with these** makes the page with
  them added; **See it with any marker** (the full range, as now) stays as a small second link.
- **"Try it with these" is a mode, as full range is:** the markers added (`pp.add`, mkeys) are part of the pool
  (`ppPool` = the page's pool + them), of its key (`ppSig`) and of what's saved, kept in Undo and checked on opening.
  Its note, on the step and in Plan: "Made with your markers and 4 you don't own: [To buy chips] · Use only yours"
  (counted against what you own now, so it goes once they're bought).
- **Markers you don't own, marked (review: needed, v325's full range has the same gap):** the printed key's main
  rows always draw a marker as owned (`pdfSwatch(…, true, true)`; only blend companions get the dashed amber
  outline), and Colour along doesn't say either. Both mark them: the key's swatch dashed amber with "not yours yet"
  in its note line, Colour along's row a small To buy tag.
- **As made while its markers are there:** the page stays as made while every marker it was made with is still in
  the pool and the count is the same — the markers compared as a set, not as an ordered list. Removing or unticking
  one of them is a change (the remake offer, as now). New markers that would lift the figure 5 points or more:
  **Remake to use your new markers**.
- **Palettes and demo:** with a saved or generated palette, "Your palette matches X% of this photo", no markers to
  buy. Demo: no line.
- **Kept up to date:** the figure and the list follow the collection, *Brands I'd buy*, the palette and *Leave white*;
  worked out in the worker from the targets. The targets are saved with the page (`pp.tg`, rounded), so a reopened
  page has its line without reading the photo.
- **Speed:** each marker's matched targets once (lightness more than 20 apart skipped), then the greedy steps:
  33–64 ms in Node for ~500 targets and ~700 candidates. Run at the end of the page's own job (no second job queued
  behind it), and on its own only when the collection, Brands I'd buy, the palette or Leave white change.
- **Photo not kept** (a guide file from another device, an older guide): the figure still shows (the saved targets);
  every offer that remakes the page (Try it with these, any marker, Remake, Subject only, the crop) is replaced by
  "Its photo isn't kept with this guide, so it can't be made again" (v325 offered Remake and then failed).

## 2. The Make page step in its markers' colours

- On a photo-made page the step shows each section in the marker **Build will give it**, by the same check Build
  uses (one shared, side-effect-free function, `ppMadeAssign`, used by `ppMadeLay` and the step): pins and coloured
  sections keep theirs, the white sections are paper when *Leave white areas white* is on (else their light marker),
  sections made by Edit sections take the page's nearest marker (worked out when Edit sections closes).
- When Build would plan afresh (other markers, another count, another pattern, a zone with another pattern), the
  step shows the tints and says why, by Remake: "Shown as sections: your markers changed since this page was made.
  Remake it to see its colours."
- **Edit sections open:** the tints, as now, with a hint ("Shows each section in its own tint while you edit"). A
  split leaves two halves with one marker, and Merge's first pick is yellow: in colours neither would show.
- **Lines** as printed: light grey (`PP_LINE`), dark with *Darker lines*.
- Left-out sections show as paper in colours (as printed), magenta in the tints as now.
- **A tap on the step edits only with Edit sections open (review: needed, v325):** `ppRemade` sets editMode
  'toggle' and the step has no `#sfQuick`, so today any tap on a photo-made page's step leaves a section out, Edit
  sections closed or not. Closed: a tap says "To change the sections, open Edit sections", as the line-art step does.
- The colours worked out once per change (sections, pool, pins, Leave white), not on every draw.

## 3. One set of figures in both places

On a photo-made page (line-art pages with the Photo pattern unchanged):

- Plan's Photo panel shows decision 1's line (the same figure, the same markers to buy), in place of "N% of sections
  are a close match…" and "Closer with:", and shows the figure even with nothing to suggest ("Your markers match 97%
  of this photo").
- **Show the rough matches** becomes **Show the loose matches**: Match's word for further than 12.
- A section's photo colour is its **average** (what the page was made from), not its most common colour: one switch
  (`photoColours`, keyed by it) for the stats, the tap tip, the loose highlight (40-render's fade test too), a fresh
  plan, and decision 2's edited sections.
- No **Use N markers** on a photo-made page (the Remake offer covers it). **N left white** stays as its own line.
- The Photo pattern's "no colour in this photo" test (every section left white) isn't applied to a photo-made page:
  a black-and-white photo had every section turned white on any fresh plan (v325).

## 4. Subject only

- A fourth Focus choice, **Subject only**: "Leaves the background white, like a colouring book." Focus in two rows
  of two.
- **How (changed in review):** the background (the subject map under 0.5) is **kept apart in the builder**, not
  whitened in the photo first. After the smoothing, its pixels take a marker of their own (index K, the paper); the
  merge never makes it a home for a small region and never counts it small or narrow; the thin-parts pass neither
  gives it pixels nor takes its; its region is white. Whitening first (as decided) let the merge hand the subject's
  edge slivers to the background: 0.4–6.4% of the subject lost (the ammonite's top, the bird's branch); kept apart,
  0.0–0.1%. It also leaves the smoothing cache (`self._ppSm`, keyed by the photo only) right: a whitened copy would
  have been served the unwhitened smoothing. The markers are chosen from the subject's colours only, and the choice's
  key (`ck`) includes Subject only, or a choice made for the whole photo would be reused.
- **The background section:** not coloured, not counted, not numbered, out of the stats ("Background left white"),
  white whatever *Leave white areas white* says; teal in the tints (comps.bg), paper in colours. Saved with the page
  (`pp.bgs`) so a reopened page marks it again (97-open resets `bg`). Edit sections can't bring it back in Subject
  only (said, as Merge into the background is).
- **No clear subject:** under 5% of the photo → Even, and "No clear subject found in this photo, so the background
  stays." (The landscape, sunset, trees and flower bed; the poolside umbrella, 10%, gets through.)
- **Crop to the subject:** offered when the subject's box (its largest parts, with an 8% margin) is under half the
  photo; the existing crop, one tap, one Undo step. Not automatic. Measured at Medium: the subject's sections
  19 → 40 (the bird), 31 → 71 (the jars), 52 → 111 (the rose). **The map is cropped with the photo, not found
  again** (instant, and the subject stays the one you saw), and the last two photos' maps are kept, so Undo of the
  crop doesn't run the finder either. Checked on 6 photos: found again, the map agreed on 4 (overlap 0.93–0.99, no
  finer outline) and changed the subject on 2 (the bird lost its branch, the pizza its cloth). A quarter turn turns
  the map with the photo; any other change to the photo finds it again.
- More than one background section (background enclosed by the subject, the bird's wing): all of them (`pp.bgs`).
- A piece of the subject too small to colour with only background round it goes into the background (no speck left
  to colour: 1 on the bird, none on the cats, rose or ammonite at Medium).
- The count line leaves the background out: "This page: 19 sections, 9 markers · background left white".
- Decision 1's figure and markers from the subject's colours only.

## 5. Livelier colours — dropped

Measured: a section's average loses almost no chroma (18.2 → 17.1, 29.6 → 28.9), and the chosen markers are within
1–3 of it with the author's collection; a small collection's dullness is the collection (decision 1). A boost moved
markers off the photo and changed the section count by up to ±20%. Help gets one line: for a more vivid page, raise
the photo's saturation in your phone's editor first.

## 6. Detail pages already made

- Keep the pages made this session for the last three Detail steps, keyed by everything a page is made from (the
  photo prepared — its turn and crop —, the markers it may use and the count, Focus, Detail, the paper, the coarser
  steps' count it keeps to). Going back to a step seen is instant. Cleared by any change to those.
- Not made ahead of time (one worker, a job can't be stopped; on an iPad it could make a change slower). Revisited
  with the iPad's measured Detail time (Copy diagnostics: "Page made in the background").
- Test: a remembered page equals one made afresh (sections and markers) at every step.

## 7. Found in the review of the whole feature (v325–v325.2)

- **Delete all my data** leaves the subject finder (4.6 MB, `marker-studio-subject-1`) on the device: it deletes
  the photo reader's cache only (safety.js). It deletes both, and Help says "the photo reader and subject finder".
- **About's credits** name ONNX Runtime and PaddleOCR but not U²-Net (Apache License 2.0, vendored with its
  licence): added.
- **The iPad's own times are unmeasured.** Every gate was met on desktop engines (Chromium slowed 4× doesn't slow
  the worker). The author's Copy diagnostics from v325.2 on the iPad (the first page, a Detail change, the subject)
  before or during the build; decision 6's second half waits on it.

## 8. See the photo on the Make page step

- With the step in its markers' colours (2), comparing the page with its photo is how Detail, Focus and Try it with
  these are judged. Plan already has this: the **Photo** button under the picture (`#sfPhPeek`, 46-photo
  `positionPeekBtn` / `positionPhoto`) shows the photo on top, not see-through, while it's pressed in (a toggle,
  aria-pressed). It's shown only in Plan (`sfmode === 'guide'`) with the Photo pattern.
- **Decided: the same button on a photo-made page's step**, not a new hold gesture: one control that works one way
  in both places, by keyboard and screen reader too (a hold is awkward for both). The photo is the Photo pattern's
  copy, already lined up exactly (`photoXf`), so it sits over the page as it was made, following zoom.
- Off by itself when Edit sections opens, when the page is made again, and on leaving the step; taps on the picture
  while it shows do nothing (the photo is over the page). Subject only shows the whole photo, background and all.
- Checked, no change: the section counts don't depend on the order the Detail steps are visited (all 17 photos,
  each step made alone and in order: the same, in order); the printed codes stay legible at Medium; the payload
  stays small (≤ 500 sections' codes, the targets about 10 KB).

## 9. iPad times, modelled

Not measured on an iPad yet. Modelled from one portable bench (the page builder's worker source, a made-up photo at
the working size, the author's 392 markers' colours; the same 131 sections everywhere): run on this sandbox (Xeon,
Node and Chromium's V8, WebKit's JavaScriptCore) and on the author's MacBook Air (Apple M2 or later, in its Linux VM,
V8). The Apple core ran the builder about 2× this sandbox's; JavaScriptCore ran it about 0.75–0.8× the time of V8 on
the same machine. Scaled from the full e2e bench's WebKit times here (first page 3.4 s, a Detail change 1.2–2.0 s,
the subject 4 s), by those and by single-core scores relative to M2 (approximate, Geekbench 6):

| iPad chip (about) | First page | Detail change | Subject found |
|---|---|---|---|
| A12 (iPad 8, Air 3, mini 5) | 3.6 s | 1.2–2.0 s | 4.0 s |
| A13 (iPad 9) | 2.8 s | 0.9–1.5 s | 3.1 s |
| A14 (iPad 10, Air 4) | 2.3 s | 0.8–1.3 s | 2.5 s |
| A15 / M1 (mini 6, Air 5, Pro) | 2.0 s | 0.7–1.2 s | 2.2 s |
| A16 / M2 | 1.8 s | 0.6–1.0 s | 2.0 s |
| A17 Pro / M3 / M4 | 1.3–1.6 s | 0.4–0.9 s | 1.4–1.7 s |

If the Air is an M3 rather than an M2, every figure is about 1.17× higher (A12: 4.2 s, 1.4–2.3 s, 4.7 s). Low Power
Mode adds roughly 40%. The new work is small beside these: the markers to suggest 35–80 ms, the step's colours a
lookup a section, the cropped subject map instant.

**What it changes:** nothing. A Detail change stays under the 3 s gate on every likely iPad (A12 in Low Power Mode is
the edge), so making Detail steps ahead of time (6) stays out; remembering the steps seen stays in. The first page
is within 5 s except, possibly, an A12 iPad in Low Power Mode. The subject's 2–4.7 s, once a photo, is why the crop
reuses its map (4). The Device test line stays, to replace this table with measured times.

## Help, What's new, tests

- Help › Pictures: decision 1's line, Subject only, the loose matches; Known limits: faces untested; the vivid tip.
- Unit tests for each mode and rule above; e2e for the note, Try it with these, the step's colours, Subject only and
  its crop, and a reopened page.

## As built (v326)

- **1:** the line is rows: the figure; "Adding [chips] would make it M%"; the second list "From Ohuhu and Copic: …";
  the links "Try it with these 2 · Try it with these 4 · See it with any marker" (counts when there are two lists).
  Both lists carry the brands' letters when either mixes brands (an Ohuhu E19 and a Copic E19) or has a brand you
  don't have; the second list shown alone says whose ("From Copic: …"). Worked out in its own
  small worker job, `ppfill`, after the page; the line fills in when it comes (`ppHelpRefresh`). In Try it with these
  mode Plan shows the same note as the step. "Remake to use your new markers" compares the markers the page could
  use as made (read back from its key, `ppMadePoolKeys`) with those it can now; the first build compared the markers
  it used, so a page from a big set called its unused markers new (found in the debugging pass).
- **2:** Edit sections' note says the tints show while you edit. The colours are worked out as the step is drawn
  (`ppStepColours`, a lookup a section).
- **4:** the builder's change is three guards (merge, thin parts, white) and the background's marker index; the crop's
  box is the subject's parts over 2% of its largest on a quarter-size grid. The kept maps: the last two photos
  prepared (`_subKeep`), resampled for a crop inside one, turned for a quarter turn of a whole one.
- **6:** a kept page serves another coarser count when it was made at the first try with as many regions (Medium →
  Simple → Medium had missed: Simple's count became Medium's to keep to). Measured in WebKit here: back to a step seen
  0.43–0.47 s, against 1.8–2.0 s made.
- **8:** Plan's Photo button, shown on the step too, turned off on leaving the screen it was turned on in.
