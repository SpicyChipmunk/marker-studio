# Older Ohuhu caps: the names printed on them (v318.19)

Ohuhu renamed its codes and its colours. A cap made before the change prints the OLD code with the name the colour had
then: "R6 Rose Red" is R213 Pomegranate now, "PB3 Cobalt Blue" is BV314 Lapis Lazuli (while "Cobalt Blue" is BV315's
name now), "CGⅡ07 Cool Grey Ⅱ 7" is BGY24. The app's marker data (src/data/markers.json) has each marker's old code but
only its name now, so a photo of older caps read the old code and a name that was another marker's, and asked about
nearly every other cap ("The code and the name read don't match"; "“R6 Rose Red” read: is it this one?").

## The data

`src/data/cap-names.json`: `{ "Ohuhu": { "<code now>": ["<name printed on its older cap>", ...] } }`, built into the
app by `src/index.template.html` as `COLORS[i].cap`: 309 markers, one old name each, all from the change list below.

Where the names come from:
- **The change list**: "Ohuhu Honolulu Markers - June 2025 Color Code + Name Changes" (a 13-page table of new code and
  name beside legacy code and name, shared on Scribd, document 936722436). Checked against the app's own data: its 363
  rows have exactly the app's old codes and names now for every Ohuhu marker (all but YR02 and 0, which it doesn't
  list; it has one the app hasn't, WG140 Peach Silk, old WG0.5). Ohuhu's own charts (ohuhu.com/pages/color-codes-index)
  give old and new codes only.
- **Real caps**, to check it: 20 photos of a lent collection of older Honolulu caps (used with the owner's permission;
  the photos and transcriptions stay private), 8 transcribed cap by cap. Of the 225 legible caps whose code is in the
  list, 216 print the list's old name. The other 9: numbers written 7 or 07 (the reader takes either), "Vermilion" for
  the list's "Vermillion" and "Yellow Ochre" for "Yellow Orche" (spellings), a name cut off, a new cap, and one GY8
  cap transcribed "Bud Green" (the list's GY3). The list takes priority: only its names are in the data.

Kept: a name that differs from the marker's name now; one-word names of five letters or more only (not Teal, Sand,
Clay, Moss, Pink, Flax, Brun); not a "name" that is a code (the list's B440 says BV013). Names are kept as printed,
misspellings too ("Pale Ocre", "Bettercup Yellow"): that's what the reader reads.

To add names: one line per marker, its code now as the key; never a name that is the marker's name now.

## How the reader uses them (src/js/scan/10-read.js)

Only WITH the marker's old code. A name read with a code as it is now, or alone, changes nothing (so a typed or pasted
"BV314 Cobalt Blue" is still asked about, as before).
- An old code read with one of its marker's cap names, whole (its numbers too, "Green Grey 02" as 2; "Cool Grey Ⅱ 5"
  with the Ⅱ read as II, 11, LL, or run into the word before it, "Greyll"): that marker, no question.
- On a photo, an old Ohuhu code that is a Copic code now (R21, Y13, R17, R11) stays Ohuhu's when its cap name is read
  with it; before, it was dropped as "another brand's" noise.
- A marker named now by words of the old code's cap name read (two words at least, or the whole one-word name) settles
  nothing more ("Cool Grey" with "CG5 Cool Grey Ⅱ 5" isn't a question about CG17 Cool Grey).
- A one-word cap name ("Pansy") counts only when no longer name with that word is read whole ("P4 Lavender Mist").
- A code that's one marker's now and another's old code (R16, G410): a word of the older cap's name that no name now
  of the code's markers has decides ("R16 Deep Violet" is RV316; "G410 Light Holly Green" is G24); a word both have
  ("G410 Green") leaves it the marker it is now, as before.
- The old grey codes' Ⅱ is also read as I, L, 1 or H ("CGI09", "CGlO7", "CGHo8"); none of these is a code.
- The photo reader's word list (names it recognises as name lines) includes the cap names. The words a misread word is
  put right to ("Yelliow") are the names now only.

## Measured (v318.18 → v318.19)

8 transcribed photos (651 legible caps; 3 held back while tuning): listed correctly 65% → 89%, questions 185 → 39,
wrong 7 → 7; the change list's names alone (none from the caps) give the same. All 20 photos: listed 1224 → 1695,
questions 536 → 88; every newly listed code is a marker seen in the transcriptions. The maintainer's own 81 bench photos (newer caps): the same list and questions, photo for photo
(recorded lines replayed through both builds; the 39 older bench photos read live too).

Still missed (~9%): a name line too far from its code to be joined to it, 5/E and F/E misreads (5110 for E110, F400
for E400), glare, and caps cut by the photo's edge.

## v318.21: a near-miss code put right by its name; the code on your cap

- A reading that is no code at all ("5110", "F400", "RVO70", "8114"), three characters or more, one look-alike
  character off a marker's code now or its old one (5 for E/S/G, F for E, 7 for 1, 8 for B, O for 0, A for 4…; a
  dropped or added character only in a code of four or more), with that marker's whole name (now, or its older cap's)
  read within about one cap: that marker, listed with "read as “5110”" on its row. Exactly one marker of the photo's
  brand must fit; names alone would mislead ("Cocoa Brown" is Copic E74's name too, "Sardonyx" Copic R21's).
  Measured on the recorded reads (scripts/bench/reader): the lent collection +18 caps listed (the 8 checked photos
  90.2% → 91.1%), Ben's 81 photos +6, none wrong; 10 questions settled. A Π read for the grey caps' Ⅱ is that Ⅱ.
- What a marker's cap says is remembered from how Scan read it (src/js/caps.js): an old code → its older cap; a code as
  it is now → the cap of now; a code that's one marker's now and another's old code (R22) only with its name read.
- Display names: an older cap's name from cap-names.json, else the short ones the reader leaves out
  (src/data/cap-shown.json: BG8 Teal, E220 Sand…), else the name now.

## v318.22: older caps' names, the Ⅱ greys, the blender, names misread

Each rule measured on its own on the recorded reads (scripts/bench/reader), and every change looked at: the lent
collection (20 photos, 1989 caps, six caps added to the transcriptions after checking by eye) listed 92.9% → 93.8%,
listed or asked 95.8% → 96.5%, wrong 9 → 9, questions 80 → 77; Ben's 81 photos HELD 93.6% (+1 cap), TUNE 81.5% →
81.6%, wrong and questions unchanged. The lent photos had all been looked at closely, so these are estimates, not a
held-out measure; Ben's photos (newer caps) guard against wrong markers.

- An older cap's old code that's another brand's code now (Y13, R11, R20, R22…, 14 of them), with a word of that cap's
  name read (five letters or more, no plain colour word, whole or all but two letters at an end, no word of the other
  brand's marker's name): that older cap. "Y13" with "Chestnut" is Ohuhu E515 (Chestnut Brown), not Copic Y13 Lemon
  Yellow; on a tray of Copic caps it stays Copic's. Also settles an old code read exactly whose older cap's name is
  read in part ("BG68 Turquoise" is BG05). Three characters or more.
- Ohuhu's CGⅡ/BGⅡ greys with the Ⅱ read as anything ("CGé08", "CGWO8", "cclo8", "BG期05"): C or B, a G (or 6; for C an
  E or C), one to three characters that aren't digits but 1 nor Y, and a two-character number only those caps have.
  CG: listed. BG: listed with "Blue Grey" or its number read, else asked (BGⅡ05 or BG05, a cap now). Not taken as the
  current code it makes once its junk is dropped ("BG期05" as BG05). Not with another number in its name, not on a
  Copic tray, not "Cocoa" (a digit at least) nor Cool Grey 07's name read as "Coo107".
- A cap whose name alone was read, its first line a word of the name ("Colorless" over "Blender"): asked by its name.
- The name fix (v318.21) takes a name misread by a letter (two in a word of seven or more) or without its plain colour
  words, only when no name is read whole; and a code whose last digit was read as its look-alike letter ("GYS" for GY5
  with "Absinthe"), three characters or more.
- Tried and dropped: asking instead of adding when two codes are read on one cap, when a two-character code is read
  unsure, or when a code is cut short ("G4."): each took out a few wrong markers but turned as many right ones or more
  into questions.
- Look closer (when asked, under a photo): the lines that didn't settle read again in squares from the photo decoded at
  2700, settled with the photo's own; a code only it read, with no name, asked about when every reading of it was unsure
  or the photo's own read had another code there. Ben's 81 photos: HELD +16 caps, TUNE +42, no new wrong (+115 and 8
  wrong without that rule). Its versions tried on 8 lent photos (all read every photo, automatically): squares at 4096
  +12/+6 caps (hard/easy) for 84% more time; a bit smaller +15/+6 (one wrong), 61%; at 2700 +16/+5, 68%; all in one
  read +17/+5, 77%; a lighter read +10/+3, 41%; six squares at most +5/+4, 52%; contrast boosted +12/+5 (one wrong),
  84%; codes only +10/+6, 74%. Too slow for every photo; Look closer when asked.

