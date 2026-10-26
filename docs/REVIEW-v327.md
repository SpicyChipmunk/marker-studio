# Review after v327: the photo engines, debugging, fit, and what would make it stand out

October 2026. Asked for: a deep pressure test of the photo-page and photo-tones engines (more accuracy, open-source
tools), a deep debugging pass (v327 first, then the rest), how photo pages fit the rest of the app, and premium
ideas. Done as several passes: an experienced pass (code read against the known architecture, a stricter lint, the
v327 diff), a fresh-eye pass (the whole photo flow used as a newcomer at phone, iPad and iPad-landscape sizes, the
printed key and Test strip read as a colourist would), and measurement passes in the browser on the author's photos
(8-photo subset, the author's 392 markers and Honolulu 72).

## Lead: the one thing that could undo v327's gain

**The Photo style's shadows are mostly light markers laid over darker ones.** The key and Test strip show it:
Denim Blue's shadow is YGY02 (a pale yellow-green) over it, Military Olive's WG01 (a pale warm grey), Chinese Orange's Y07. The
app models a marker laid over another as see-through ink (each lets through its share of the light, multiplied in
linear light), so a pale marker over a dark one comes out a little darker, which is what the photo's subtle shadows
want. Measured, with the shadow marker required to be at least as dark as the base:

| | Photo, as built | Shadow at least as dark as the base | ... plus a 2nd coat of the base |
|---|---|---|---|
| The author's 392 (8 photos, points over flat) | +3.8 | +0.7 | +1.2 |
| Honolulu 72 (photo 02) | +10.2 | +0.3 | +1.6 |

So nearly all of Photo's gain rests on the model being right about pale-over-dark. On paper it may not be: an
alcohol marker re-wets the dry layer under it, and a pale one carries little dye, so it may blend or even lift the
base rather than darken it. **This needs the author's paper test before the beta**, and the app already has the tool:
Share & print › Print › Test strip, on a Photo-style guide, prints each marker's H, B and "S over B" boxes with the
screen's colours under them, and a ×1/×2 box for the 2nd coat. Decision 1.

Nothing else found is a dealbreaker: no data loss, no crash, no wrong page.

## 1. The engines: how much accuracy is left

**Where the loss is** (the share of each section's photo pixels within ΔE 10, sampled, 4 photos, the author's
markers):

| Photo | Flat page | Photo tones, drawn | Best 3 tones per pixel (same pair) | Each section its own best pair | Any of the page's markers, per pixel | Any of your markers, per pixel |
|---|---|---|---|---|---|---|
| 02 | 57.8 | 62.0 | 69.3 | 84.0 | 90.9 | 98.1 |
| 07 | 71.6 | 79.5 | 88.2 | 94.9 | 97.5 | 100 |
| 11 | 61.4 | 69.1 | 72.1 | 78.7 | 77.4 | 82.2 |
| 15 | 68.1 | 71.7 | 74.2 | 84.7 | 85.4 | 96.8 |

Read across: the page's sections (3 mm smallest at Medium) cost the most (per-pixel marker choice would match
77-98%), then the 24-marker cap (2-11 points, which Use up to 48 already offers), then the tones. The per-pixel
ceilings looked like 10-15 points were there for the taking; in the drawn page they weren't:

**Tried in the browser, as the page is drawn (3-8 photos, the author's markers, points against v327):**

| Idea | Result |
|---|---|
| Each section its own hand-over points (where H and S start), chosen from its samples | +0.2 |
| Tones placed by the photo's colour (nearest of H, B, S) instead of its light | −0.2 to −0.8 |
| Each section its own best pair, placed by colour | −2.7 to +1.1, mostly lower |
| Each section's marker chosen again for its own colour after the merges | −0.2 |
| More smoothing before the page is grouped (4 passes) | −0.5 |
| Less smoothing (1 pass) | +0.1 |
| (v327 build) a 0 or 5% bar for flat sections, means or hit-counts for decisions, 400 samples, wider amounts | ≤ +0.1 |

The per-pixel gains are texture smaller than a section or a 1.5 mm tone patch, which nobody can colour; once tidied
and drawn they're gone. **The engines are at a tuned optimum for pages a person can colour.** What's left is in your
hands (Detail, Use up to 48) or on paper (below). No engine change proposed.

**Accuracy on paper** is the unmeasured part, and now the larger one: the markers' colours are the makers' published
charts (Help already says so), the glaze model is a textbook one never checked against these inks, and the
paper's white. The paper test (decision 1) checks the glaze model; if it's off, the fix is the model, not the page:
a spectral one (Scott Burns' reflectance curves from sRGB, published; spectral.js) or a single "how much a layer
darkens" factor fitted to the test strip.

## 2. Open-source tools (licences checked; the app is all rights reserved)

| Tool | Licence | Would it help? |
|---|---|---|
| Depth Anything V2 **Small** (25M parameters) | Apache-2.0 (Base, Large, Giant are CC-BY-NC-4.0: not usable) | Depth for a photo: could light Rounded shading or find a subject where U²-Net misses. The photo's own light already does better for tones. Not now. |
| BiRefNet | code MIT; weights' licence not stated | Sharper subject masks than U²-Net small, but the general models are large (Swin-L); the lite one is untested. Not now: unclear weights licence. |
| U²-Net (in use) | Apache-2.0 | Keep. |
| paintbynumbersgenerator (drake7707) | MIT, unmaintained | The same family as ours (k-means, facet reduction, border tracing, labels); nothing we lack. |
| Scott Burns, reflectance curves from sRGB | published method (no code licence needed to reimplement) | Spectral layering, if the paper test says the glaze model is off. |
| spectral.js | MIT (npm page couldn't be read here; check before use) | Kubelka-Munk for opaque paint mixing; layering see-through marker ink needs the transmittance form, so the Burns method fits better. |
| Mixbox | CC BY-NC | Not usable. |
| OpenCV.js | Apache-2.0 | Nothing the engines need. |

## 3. Debugging

**Experienced pass.** A stricter lint over the whole app (self-compares, loops whose condition never changes, unused
expressions, duplicate keys, promise executors) found only intended code (NaN checks, labelled breaks, comma
expressions) and one duplicate test seam (removed). The v327 diff read again: tidying, the held tones, the markers
added, Use up to 48, the saved fields; no bugs found beyond the two below. v325-v326 had their own two passes.

**Fresh-eye pass** (three sizes, the printed pages):

- **Fixed (v327.1):** on a phone, Highlights' and Shadows' lists ran "Matched to the photo" under the chevron (a
  more specific rule had taken away the room the lists keep for it; any long kind showed it). It now ends in "…".
- **Fixed (v327.1):** the printed key said "— base is the lightest" for a photo-toned marker with no highlight, and
  would have said "no shadow (already darkest)" for one with no shadow: with photo tones it's that none would be
  closer to the photo. It says "— not needed".
- Found and fixed in v327 already: the Shading note's "11 colours have no lighter marker" under Photo.

## 4. How photo pages fit the rest of the app

Seen as a newcomer:

- **The best feature is the hardest to find.** Home's start card is all about a photo *of a colouring page*; any
  photo is an underlined link under it (on a phone, "Or make a colouring page from any photo"; on iPad, at the
  card's foot). The phone's line above it says "Turn a photo into a marker-by-number colouring guide", which reads
  as this feature, then the button says colouring page. Someone without a colouring page to hand has nothing to
  start with. (v325 decided no fourth Home card; a second button inside the start card is a different, smaller
  change.)
- **The page step's toast covers Detail and Focus** for 3 seconds after every page is made ("Colouring page made:
  115 sections, 24 markers. Build guide when it looks right."), just when you'd change them; the count line under
  the picture says the same.
- **Shading starts Off on a photo page**, so Photo, its biggest likeness gain, is two taps away under a tab a
  newcomer may not open (after decision 1).
- **Wording:** "79 sections stay flat: their tones wouldn't be closer to the photo" reads as a failure (it's the
  even parts of the photo); Pattern's "Your markers match 97% of this photo" sits right above "24 markers can't cover
  them all" (97% is all your markers, the page uses 24); "Matched to the photo" doesn't fit a phone's list; Neuro's
  caption ("Neuro is for neurographic art…") shows under the row whatever's chosen, Off included.
- **One marker as both highlight and shadow** (WG01 for YGY18, in the key): legitimate by the model (alone it's
  lighter, over the base darker), but it reads as a mistake.
- Random names ("Koi Jig" for a cat) are fine; nothing to fix.

## 5. Ideas that would make it stand out (pressure-tested)

Marker Studio's ground is physical colouring with the markers you own; the digital colouring apps (Pigment, Lake,
Happy Color) colour on the screen, and marker-inventory apps stop at the list. Ideas, best first:

1. **"What's left?" from a photo of your page.** Photograph the page mid-way; the app already finds, straightens and
   lines up a finished page's photo (Your page), so it can say which sections still look like paper and offer to
   tick the rest. On a 115-400-section photo page, finding the missed bits is the real chore. Limits: the palest
   markers (Y00, light greys) can't be told from paper, so it only ever suggests, never ticks by itself. Medium effort,
   reuses what's there. Strongest.
2. **Time to colour.** "About 3 hours" from the sections and area, learnt from your own pace in Colour along (ticks
   aren't timed yet: a small addition). Cheap; sets expectations for a Very detailed page. Strong.
3. **Poster printing.** A photo page over 2 or 4 sheets, with overlaps and marks to join them: big pages are where
   photo pages shine and a Letter page cramps Detailed. Medium effort (the PDF's layout exists).
4. **Markers you use most.** From finished guides: which markers do the most work, which are never used, "E415 is in
   9 of your last 12 guides" (refill or buy a spare). Ink per area isn't known, so relative, not "running low". Cheap;
   pleasant, not essential.
5. **Blend sections** for smooth photo areas (a sky as one section, blended from one marker into the next, instead of
   bands): alcohol markers' signature move. It looks premium, but needs blend directions on the page and in the key,
   and the paper test first (blending is where the screen and paper differ most). Later.
6. **Starter pages** (a few public-domain line drawings and sample photos ready to go), so a new tester colours in
   minutes. Curation, not code; worth it for the beta's first minutes.

Left out after pressure-testing: naming a guide from its photo (needs a classifier, little value), calibrating marker
colours from a photo of swatches (tried before, needs a colour card), an account or sync (a different product).

## Decisions

1. **Paper test of the Photo style's shadows, then decide** (lead). Recommended: print the Test strip from two
   Photo-style guides (one of yours, one with Honolulu 72), colour the boxes on your marker paper, and compare the "S
   over B" boxes with the bars. If pale-over-dark darkens about as shown: keep. If it barely changes or lifts: shadows
   only from markers as dark as the base or a 2nd coat (Photo's gain falls to about +1; worth saying plainly in Help),
   or fit the model to the strip. Nothing built until then.
2. **A button for photo pages on Home's start card** (second, quieter, under the colouring-page one), and the phone's
   line above it saying both.
3. **No toast on the page step** (the count line says it; screen readers still hear it).
4. **Offer Photo shading on a photo page** (after 1): a one-tap line after Build, not on by default (shading is more
   colouring).
5. **Wording:** the flat count said the other way ("36 sections shaded from the photo; the rest are even"); Pattern's
   line "Your 392 markers match 97% of this photo; the page's 24, less"; "From the photo" for Matched to the photo;
   Neuro's caption only while Neuro is chosen.
6. **One marker never both a section's highlight and its shadow.**
7. **Which premium ideas to build**, if any, before or after the beta (1 and 2 recommended before).
8. No engine change for accuracy (for the record).

## As decided

- **1.** Left till the end (asked).
- **2. Agreed:** a second, outlined button in the start card, under Choose a colouring page / New guide from a
  colouring page: "Make a colouring page from any photo", the same on phone and iPad, and on the Guide screen's
  start card (in place of "Any other photo? Make a colouring page from it"). The phone's line: "Turn a colouring
  page, or any photo, into a marker-by-number guide, built from the markers you own."; the iPad card's heading
  likewise; How it works step 1: "Photograph a page. Or open a PDF, or start from any photo." The sample and PDF
  stay links.
- **3. Agreed:** the page step's routine "Colouring page made: … Build guide when it looks right." isn't shown (the
  count line says it; screen readers still hear "Your colouring page: …"). The others stay: no clear subject, the
  subject finder not stored, "Page made again — tap Undo…", errors.
- **4. Agreed (pressure-tested twice):** right after Build of a photo-made page, in that session only, a one-line
  offer in the line under the tabs (one note at a time; after an error or the kept-sections note): draft "Shade it
  like the photo? A lighter and a darker tone in many sections, from the photo's own light. Shade it · Not now"
  (words final after decision 1). Gone once tapped or dismissed, once a section is ticked, or on leaving the guide;
  never from the Library, a reload or Remake page; no saved state. Shade it applies the Photo style as one Undo step,
  opens Shading and says "Shaded like the photo · Undo"; Undo doesn't bring the offer back. Always shown for a fresh
  photo page (no tones worked out just to decide: the least gain measured was +0.4).
- **5. Agreed (pressure-tested twice):** (a) Shading under Photo: "Shaded from the photo: 36 sections. 79 stay flat:
  tones wouldn't make them much closer to it." (the Photo style's own counts); (b) the match line says whose markers,
  in the page step's words (ppMadeFor): "Your 392 markers match 97% of this photo." / "The full Ohuhu range matches
  …" / "Your markers and the 3 added match …" (a palette: "Your palette matches …%"), and "Some of this photo's
  colours aren't on the page: the page's 24 markers can't cover them all."; (c) "From the photo" for Matched to the
  photo, in the lists, Help, the tip and Undo's words (saved guides keep the kind); (d) dropped: Neuro's caption
  stays as v318.32 decided.
- **6. Agreed:** the shadow is never the marker chosen as the section's highlight (pairs, and Two tone sets' too):
  measured, it happened on 3 of 11 photos (1-11 sections) and costs 0 to −0.2; held tones unchanged.
- **7. Decided:** only 7a, as a trial first ("What's left?": whether a photo of a part-coloured page lines up with the
  guide and tells coloured sections from blank ones); 7b-7f not now.
- **8. Agreed:** no engine change for accuracy; if the paper test shows the layering model off, the fix is the model
  (a strength factor fitted to the Test strip, or spectral), not the page builder.
- **Built as v327.1** (2-6; `docs/PLAN-v327.1.md`, its As built); 7a's trial run (reading 98-100% right within 4 px;
  lining up a real photo still to try); 1 waits for the paper test.
