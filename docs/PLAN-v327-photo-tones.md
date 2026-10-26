# v327 — photo tones, tidy tone patches, more markers for colourful photos: the plan as decided

Decided one at a time with measurements on the author's 17 photos (scratch only, never in the repo), in a throwaway
test version of the app (never committed). Two collections throughout: the author's (Honolulu 320 + Sketch 72 Set A,
392 markers) and Honolulu 72. "Match" is the share of the drawn page within ΔE 10 (CIEDE2000) of the photo under it,
measured on the canvas the app draws (shading, blends and glazes as drawn), off the lines. Nothing here is built yet.

Three parts, and the three rounds of pressure testing at the end (their changes are written into the parts): **A** an offer of more markers for very colourful photos; **B** photo tones (each marker's highlight and
shadow matched to the photo's own light and dark); **C** tidying small tone patches, for every kind of shading.

## A. "Use up to 48 markers" for very colourful photos

- **Why:** with a large collection the page's markers cap (PP_STEPS mk: 12/18/24/36/48) binds on most photos (the
  author's 392 suggest about 30 at Medium, up to 59). Raising it moves the average match little (+0.6 at 24 → 48),
  but on the busiest photos 24 markers lose small distinct objects altogether (a turquoise glass drawn grey, a pink
  figurine gone): 1–1.2% of the photo more than 15 off the page's markers that a marker you own matches within 10.
- **When it's offered (page step):** the page is at the step's cap, not set by hand (Markers in this guide), and the
  marker choice at twice the cap would bring back colours: lost colours (as above) at least 0.5% of the photo, or the
  photo's colours on average 0.45 closer. Measured: exactly photos 02, 05, 06 and 15 of 17 with the author's
  collection; never with 120 markers or fewer. Worked out after the page (in the 'ppfill' job's turn), about 0.15 s.
- **What it says:** "Some of this photo's colours aren't on the page: 24 markers can't cover them all. **Use up to 48
  markers**" (the step's own numbers: 18 and 36 at Simple). Made again with each Detail step's cap doubled (a mode, `pp.more`, saved, in the choice's key and the
  pages kept, Undo). After: "Up to 48 markers · **Back to 24**". The page still uses only what the photo suggests.
- **Interactions:** the finer step's count kept (`ppCountKey`) takes the mode too; Subject only checks the subject's
  colours; "Try it with these" and any marker the same; the markers-to-add line goes first when both show; the
  printed key with 45 rows is checked in the build.

## B. Photo tones

### 1. Companions per marker; two tone sets as an option

- **Default: one highlight and one shadow per marker of the page** (per marker and zone: a zone has its own amounts
  and kinds, as now), chosen for all its sections' light and dark parts together. The key, the page's tone numbers and Colour along work as now (they're per marker).
- **Option: "Two tone sets per marker (closer to the photo)"** (a checkbox under Highlights and Shadows when either is
  Matched to the photo): each marker up to two pairs, each section the one that fits it (or none). Measured on 17
  photos: the author's 74.8 → 75.3% (+0.5), Honolulu 72 57.5 → 59.0% (+1.5; photo 02 +6.2, 14 +5.0); per section
  without limit adds at most 0.7 more on any photo.
- **On paper with two sets:** a section on its marker's second set has a prime on its label (E415′), from the one
  label routine (`codeLayout`, screen, page 1 and the close-ups; measured with the prime, so it still fits, beside the
  brand tag and the same-code *); a screen reader says "second set". The key: the
  marker's row as now, its second pair on a line under it ("E415′  H … › B E415 › S … over the base"); with zones as
  well, a line for each zone and set that differs (named by zone, then ′). Colour along's
  marker list shows the two pairs as two lines; its steps are each section's own already.
- **Per section without limit: not built.** It needs codes inside the tone zones (about 65 sections a page).

### 2. Which markers

- The page's own markers, plus **up to 4** of your other markers, each only when it brings the page's tones closer by
  a clear margin (so 4 is rare). Measured (one pair per marker): page only +4.2 / +12.5; up to 2 +5.2 / +15.0; up to
  4 +5.4 / +15.4; the whole collection +5.8 / +15.6 with about 16 / 6 more pens. Today's Shading takes companions
  from the whole collection, so this is fewer pens than today.
- Chosen greedily: the marker whose adding lowers the page's tone error most, again while the gain is clear. Done on
  the parts' mean colours (fast), not per pixel.

### 3. The highlight and the shadow

- **Highlight:** a lighter marker (4 or more lighter) of the base's own colour family, or a close hue: the test today's
  Same colour highlights use (`_hueOK`, same family). Laid under the whole section, as now. (The strict rule first
  agreed — the base laid over it unchanged within 4, by multiplying the two — allowed no highlight at all: multiplying
  overstates how much an underlayer darkens the base.)
- **Shadow:** a marker laid over the base (a glaze, as Cooler and Grey are: `shadeGlaze`), the glaze 4 or more darker
  than the base; the key and the steps say "over the base".
- Each is the one nearest the photo's own light (or dark) part, and only where it's nearer than the base.
- **One way in to a section's tones:** every reader of them goes through one function (the section's photo tones, else
  today's): the drawing and its table (`shadeLUT`), `shadeSec` (focus, Colour along, popovers, coverage, print), the
  section's tip (`shadeTipHTML`), the key's glaze note (`shadeUse`), and Gradient's shading-aware picks (30-palette-
  assign; not on Photo zones, but through the same door). Otherwise a note or tip would describe Same colour tones while
  the page shows photo tones.

### 4. Sections left flat where tones don't help

- A section takes its tones only when they bring it closer to the photo by a clear margin (start: the toned parts at
  least 10% closer; tuned in the build to cost no more than 0.2 of the page's match). Otherwise one flat colour.
  40–55% of sections with one pair per marker. Never worse than flat on any photo (today's Same colour: worse on some).
- Not shaded: no tone numbers, no tone lines, no tone steps; a reason of their own (`shadeWhy` 'even': "Its tones
  wouldn't be closer to the photo — one flat colour"). Not added to Leave sections flat (your own list stays yours).
- The Shading panel says how many: "34 sections stay flat: their tones wouldn't be closer to the photo."
- Worked out again when its marker changes (a pin, a swap), as everything else. Tapping one shows its reason (the
  section's tip).

### 5. (see C) Tidy tone patches

### 6. Where it lives (photo-made pages)

- **Highlights and Shadows lists:** a new kind, **Matched to the photo**, in both; the default for both on a
  photo-made page (and for a new zone there). Mixed freely with the others (photo shadows with paper highlights).
- **The Shading row:** on a photo-made page with the light from the photo, **Photo** takes Rounded's place (Roundness
  isn't used with the photo's light): Off · Photo · Soft · Dramatic · Neuro. Soft and Dramatic set their amounts.
- **Light from the sun or the edges** (Neuro sets the edges): Matched to the photo needs the photo's light, so the
  lists use and show Same colour, and the row shows Rounded; the choice is kept for when the light is the photo again.
- Re-tested in the build (asked for).

### 7. Amounts

- **Photo chooses its amounts for the page:** it tries Shadows 0.65, 0.75, 0.85 and 1.0 and Highlights 0.5 and
  0.65, and keeps the pair that brings the page closest (the same check as 4); a few tenths of a second when Photo is
  tapped. Measured (6 photos, so the levels are high: see Measuring): the best fixed pair about Highlights 0.5,
  Shadows 0.85; each photo's own best Shadows amount +6.3 against +5.8 (the author's), +19.3 against +16.5
  (Honolulu 72; photo 07 falls from +9.8 to +0.4 as Shadows go 0.65 → 1.0).
- Fallback when it can't (no photo read yet): Highlights 0.5, Shadows 0.85. A slider moved makes it Custom.
- **While Photo is chosen** its amounts are chosen again when the page or the plan changes (a Detail step, a pin);
  Custom keeps the sliders' values. Tapping Photo is one Undo step.
- **Cheap:** the light field doesn't depend on the amounts (only where the tones hand over does), so the eight trials
  share one field; the companions are chosen on mean colours. Budget 0.5 s on an iPad (model); on the main thread
  after a frame with "Matching the photo…" if it's near that, else in chunks.
- **The heavier look:** Honolulu 72's best amounts can be Shadows 1.0, darker than the photo looks to some eyes (the
  cushion on photo 02). The report shows the pages, not only the numbers, so the range searched (up to 1.0) can be
  narrowed if they look heavy.
- Re-tested in the build against the best fixed pair (asked for).

### 8. Scope

- Photo-made pages only, and there only zones that use the Photo pattern (a zone with Gradient keeps Same colour).
  Leaving the Photo pattern (another pattern, Surprise) makes those tones Same colour; back to Photo, they return.
- Not ordinary guides with a photo lined up (the alignment is approximate, their section colours are the most common
  colour, not the average; nothing to measure on). Tidying (C) is for all shading.

### 9. Saving and opening

- Saved with the other shading settings (STYLE_FIELDS, the zones' `sh`): the kinds (`photo` added to both lists), two
  tone sets, the Photo style (its amounts as the sliders' values; the row shows Photo).
- **The choice is saved too:** each marker's pair (and second pair), which sections take which or none, the extras.
  On opening they're used while what they were chosen from is unchanged (the plan, the amounts, the kinds, the light,
  each marker still yours); else chosen afresh. Buying a marker doesn't reshuffle a guide being coloured.
- **Sections with ink keep their tones (`heldSh`, v285):** a section coloured with photo tones keeps the markers it
  was coloured with when the choice changes, as it keeps its kinds now (its held record carries its pair), by the same
  rule: its highlight once there's ink on it, its shadow once the shadow is on the paper (until then the shadow
  follows). Without it, moving a slider could change the shadow marker of a half-coloured section. A held pair that's
  no longer one of the marker's sets shows in the key as a line of its own ("as coloured") and in the section's tip.
- **Choosing again on purpose:** tapping Photo again chooses afresh from the markers you have now (the only way, other
  than a change to the plan, that bought markers come in), sections with ink keeping theirs.
- The saved choice's sections are renumbered as the guide opens (the section map), as Subject only's background is.
- The tone shapes come from the saved photo each time (reproducible; saving them would cost far more).
- **Until the photo is read:** a guide just opened reads its photo a moment later. Today, until then a photo-lit guide
  is shaded by the sun (on screen for a moment, and in a print or share made then). Instead it waits: the tones show
  once the photo is in, and Print and Share wait for it.
- An older copy of the app reads Matched to the photo as Same colour (`styleOne`) and ignores the rest.

## C. Tidy tone patches (all shading)

- A light or shadow patch smaller than **1.5 mm** across on the printed page (under 2.25 mm²) takes the tone round it.
  **On a photo-made page with the photo's light also** a patch thinner than about 0.9 mm (by 2·area / perimeter). Not
  the thin rule with the sun or the edges: Neuro's bands along the outline are thin by design (measured: the thin rule
  took them out of the small sections); nor on ordinary guides lit by a lined-up photo, where it wasn't measured.
- **The field as it was is kept:** tidying works on a copy, made again from the untidied field whenever the tones'
  handovers or the tones change (an amount, a kind, the plan). Tidying in place would leave patches merged for the old
  amounts. One more byte a pixel (3 MB for a 2000 × 1500 page).
- Measured: today's Dramatic from the photo 1,717 → 205 patches, tone lines −49%, match +0.4 (the author's;
  Honolulu 72 1,498 → 188, +0.2); photo tones 356 → 117, tone lines −14%, match ±0.01; the sun on the line-art sample
  327–401 → 187–212. 1.0 and 1.5 mm match the photo the same (12 of 12 runs within 0.1 for photo tones; 1.5 equal or
  better for today's); 2 mm starts to cost photo tones (−0.07).
- On the full page after the tones change (not while a slider is dragged: the preview skips it); scanning only the
  tone zones (the throwaway version took 20–70 ms on the sample, 568 × 1500).
- Old guides change look on opening (the author has none that matter).
- **Tests that change:** about 20 browser test files touch shading (Colour along's tone steps, print's tone numbers,
  frames, zones). Run early in the build; each changed expectation checked to be the tidying's doing, not a fault.

## Measuring

- The 8 photos that best stand for the 17 (01, 02, 04, 06, 07, 11, 12, 15; chosen on half the earlier comparisons,
  within 0.35 of the 17 on the other half) for comparisons while building; all 17 once for the report. (The 6 used
  for the quick tests, 02 05 07 11 15 17, read 1–2 points high for the author's collection, 3–5 for Honolulu 72.)
- **The bar (built anyway, reported against):** the Photo style at least +4 over flat with the author's collection,
  on all 17; never worse than flat on any photo, either collection; Soft, Dramatic, Rounded and Neuro no worse (tidying
  alone should help them); Photo about 0.5 s on an iPad (model) with its amounts, about 0.2 s after a later change.
- **Re-tests:** Photo against Dramatic (6); Photo's own amounts against the best fixed pair (7); 1.0 against 1.5 mm
  (C); two tone sets (1).
- **The author's test page on paper:** whether shadows over the base look as drawn, the highlights, 1.5 mm, the primes.

## Tests (made-up photos only)

- **Unit:** the choice per marker and per set; at most 4 extras, each with a clear gain; the highlight test; the shadow
  4 darker over the base; flat below the minimum gain; Photo's amounts; tidying (the size rule everywhere, the thin
  rule only with the photo's light); the saved choice reused only while nothing changed; `pp.more`.
- **Browser, both engines:** the lists and Photo in Rounded's place only where it should be; the sun and Neuro and
  back; the key's rows and the primes; Colour along's steps; print's tone numbers and waiting for the photo after
  opening; save and open; Undo; a marker bought without the tones reshuffling; a section with ink keeping its tones;
  Use up to 48 markers and Back to 24; an older copy's reading.

## Help, What's new, docs

- Help › Shading: Matched to the photo, the Photo style, two tone sets, sections left flat, tone patches tidied;
  Help › Pictures: Use up to 48 markers. What's new v327. CHANGES, DEVICE-TEST (a page coloured on paper), TESTERS.

## Pressure testing (two rounds)

**Round 1 (the plan against the code):** found and written in above —
1. Tones are read in eight places, five of them straight from `shadeTones(marker)`: one way in to a section's tones (B3).
2. Zones each have their own shading, so companions are per marker and zone (B1), and the key's extra lines by zone and set.
3. Sections with ink keep the kinds they were coloured with (`heldSh`); photo tones need them to keep the markers too (B9).
4. Until the photo is read on opening, today's photo-lit Shading falls back to the sun, on screen and in print (B9).
5. Photo's amounts: chosen again while it's chosen; one Undo step; the eight trials share one field (B7).
6. Leaving the Photo pattern, the step's numbers in A's text, the prime beside the tag and *, the saved sections
   renumbered, the flat section's tip.

**Round 2 (the whole feature, as used; what could go wrong):**
1. Tapping Photo works on the main thread for a moment: a budget and a fallback (B7).
2. The heavier look with Honolulu 72's best amounts: the report shows pages; the range can be narrowed (B7).
3. The amounts are chosen by the app's own check of the match, and the bar is measured the same way on the drawn page:
   the report also shows pages beside the photos, so a page that scores well and looks wrong is seen.
4. Recompute only on what it depends on (the plan, the amounts, the kinds, the light, the collection, the photo):
   never on a tick or a redraw.
5. Two tone sets with zones, extras and held sections: one choice per marker and zone; the extras shared by its sets;
   a held section keeps its own.
6. Small collections rarely have a lighter marker of the same family on the page: their gain is shadows; fine.
7. Nothing found that changes a decision.

**Round 3 (deeper: the code each part touches):**
1. Tidying in place would have broken: the shade field is kept and reused when only the amounts change, so merged
   patches would stay merged for amounts they were never merged for. Tidy a copy, from the untidied field (C).
2. The thin rule was measured only on photo-made pages: not on ordinary guides lit by a lined-up photo (C).
3. Held sections: the existing rule holds a section's highlight once it has ink and its shadow only once the shadow is
   on the paper; photo tones' held pair follows the same two steps. A held pair no longer among the marker's sets gets
   its own key line ("as coloured") (B9).
4. Bought markers come in only through a change to the plan or tapping Photo again; said in Help (B9).
5. About 20 browser test files touch shading, so tidying changes expectations well beyond photo tones: run them early,
   check each change (C).
6. Checked and fine: auto-flat sections need only their base step (`shadeReq` gives the base alone when a section isn't
   shaded); no shadow marker means no S in the key or steps (`noShadow`), not "2nd coat"; the key already runs onto a
   second page ("Colour key (continued)"), so two tone sets can't overflow it; the prime goes in the one label routine;
   the tone numbers, tone lines and Colour along's coverage checks all read the tidied field, so they agree.
7. Measured figures in B1 and B2 were taken before the highlight correction (shadows only); their comparisons stand,
   the levels will be higher. Final figures come from the build.

## As built (measured in the build)

- **Against the bar**, all 17 photos, the share of the drawn page within ΔE 10 of the photo, points over flat:

  | | Photo | Two tone sets | Today's Dramatic |
  |---|---|---|---|
  | The author's collection | +3.99 (least +0.4, most +9.9) | +4.79 | +2.11 (least −1.3) |
  | Honolulu 72 | +11.05 (least +0.7, most +29.9) | +12.95 | +2.30 (least −1.0) |

  The author's figure is at +4 to the tenth, a hundredth under; never worse than flat on any photo, either collection.
  Dramatic with tidying matches the prototype's tidied figures (02: 63.8, 07: 71.7), so tidying keeps its +0.1–1.0.
- **Below the prototype** (8 photos, +3.8 against +4.5): nearly all of it is the near-black rule. The prototype laid a
  shadow over near-black bases (a pale warm grey or a green over black: the glaze model darkens it, a real marker
  over black hardly would); the build keeps the app's rule, no shadow on a base darker than L* 28. On photo 11 the
  black and warm-grey-9 sections account for the whole 5.9 points; on photo 01, the black ones for all of its 2.0.
- **Re-tests** (8 photos, the author's / Honolulu 72): Photo's own amounts +3.83 / +10.99 against the best fixed pair
  +3.74 / +9.32; 1.0 and 1.5 mm the same to the tenth; the bar for each marker added at 0.5%, 1%, 2%: +3.84 / +11.04,
  +3.83 / +10.99, +3.49 / +10.14 (1% kept: fewer added for the same); flat-section bar 0, 5%, 10% within 0.2 (10%
  kept); deciding sections by means or by the share within 10 instead of by sample, more samples (400), and a wider
  range of amounts (Highlights 0.35, Shadows 0.5) no better.
- **Timing** (test browser): Dramatic's first tap 0.52 s (the photo light's field); Photo after it 0.42–0.55 s, of
  which choosing 0.06–0.12 s and its amounts 0.08–0.17 s; a later tap or change 0.25–0.29 s, as Soft. About two
  thirds of that on an iPad (model), within the 0.5 s budget, so no "Matching the photo…" message.
