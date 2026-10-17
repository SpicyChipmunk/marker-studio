# The photo reader's closer read (v318.9), and what was measured on the way

Kept so the reasoning and the dead ends aren't lost. Measured on the maintainer's own photos (42 new photos of an
Ohuhu Honolulu 320 bag and a Copic case, iPad and phone, taken in daylight, warm light, dim light, at angles, whole
bag and close; and the 39 earlier photos the reader was tuned on). The photos and the transcriptions stay private;
the numbers are below. Every legible cap was transcribed at full size, and on the 25 hardest photos every code the
reader listed was checked against the cap it was read from.

## Why caps went unseen

The app read every photo from a copy at most 2048 px on its long side, and the detector looked at 1600 px. On a
photo of a whole bag a cap's code is then about 20 px tall in the image the recogniser reads from: half the caps read
as junk or were boxed together. 91% of the caps that a closer read recovers already had a box at 1600 — it's the
pixels and the boxes' quality, not text missed altogether.

Measured on the new photos (split by scene: TUNE, the photos changes were tried on; HELD, the rest, never tuned on):

| | Ohuhu HELD | Ohuhu TUNE | Copic HELD | Copic TUNE | wrong (42 photos) | time, whole bag | page's peak (Safari's engine) |
|---|---|---|---|---|---|---|---|
| v318.8 | 69.9% | 58.5% | 84.8% | 73.9% | 23 | 1× | 942–1072 MB |
| copy at 3072, detector as before | 86.8% | 70.1% | 87.5% | 76.6% | 15 | 1.15× | +9–16% |
| copy at 4096, detector 3200 in 16 strips, always | 93.0% | 75.9% | 90.8% | 87.9% | 16 | 2× | +22–35% |
| the same only when the codes are small (v318.9) | 93.2% | 75.9% | 87.8% | 85.8% | 19 | 2× (Copic case 3–4×) | +22–35% on those |

- Always reading closer made the earlier photos (closer shots, larger codes) slightly worse (12 fewer caps, 3 more
  wrong); reading closer only when the first look's line height is under 25 px leaves them exactly as before.
- The threshold: 24 sat on a cluster of photos 0.05–0.25 px below it, and the same photo's line height differs by up
  to 0.7 px between a desktop's one-strip detection and an iPad's four; recall is flat from 24 to 28. 25 was chosen.
- In 4 strips instead of 16 the detector at 3200 peaked 300 MB higher for the same results.
- A "third look" — the detector again at 2× only around boxes with no code read — was slower and found less than the
  whole photo detected at 3200 (a whole bag: 153 caps against 166; an angled Copic case: 30 against 53). Not pursued.

## Wrong reads

On the checked photos about 1.7% of the codes v318.8 listed were read off a cap printed with another code. On the
Ohuhu bag they are next-door codes of the same colour (YR11 for YR111, BG21 for BG211, CG24 for G24, B411 for R411);
on Copic caps mostly a lost first letter: the Y of YG, the B of BG, the R of RV and YR are printed apart, round the oval
cap's curve, outside the detector's box (G03 for YG03).

- **A cap-colour check, measured and dropped.** The cap's colour sampled round its code, calibrated per photo on the
  caps read for sure, compared with the candidates' swatches: Ohuhu's wrong reads are the same colour as the right
  ones, and at a threshold that leaves right reads alone (≤ 0.2% questioned) it would have caught 0–1 of 22 wrong
  reads; on Copic, catching 2 of 12 cost 5% of right reads turned into questions. The "clearly different colours"
  cases (a red cap read as B05) were 2–3 of 22, and the light varies too much to tell them reliably. Don't re-try
  without new evidence.
- **A Copic "prefix" re-read, not yet.** A code that is the tail of a longer one (G03 of YG03) read again with its box
  widened along the line, the longer code taken when it reads surely and exists: Copic wrong reads 12 → 9, but one
  real R20 read as YR20. With the closer read most of those caps read right anyway; to be measured again on top of
  v318.9 before it's designed.
- **The code-as-name fix (in v318.9).** Before reading, the shorter of two boxes one above the other is taken as the
  taller one's name; an Ohuhu cap's two-word name is often the taller, so a code read surely ended as a name. The
  engine already swapped them back for a zoomed box's lines; now for any pair. +11 caps on the new photos at 2048,
  +1 wrong; the earlier photos unchanged.

## How the closer read works (v318.9)

The page decodes the 2048 copy as before and sends it with `detailCheck: 25` (not when reading gently, nor for a
photo no bigger than 2560 px). The engine detects once; if the median height of the wide boxes is under 25 it returns
at once, nothing read, `detail: true`. The page lets the copy go, decodes the photo again at up to 4096 px and sends it
with the detector at 3200 in 16 strips. The busy mark is '2' during that read: if the page is ended mid-read (an iPad
short of memory), the next photo reads gently for a fortnight instead of crashing again. A memory failure caught in
the closer read reads the 2048 copy again, gently.
