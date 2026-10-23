<!-- v234 to v289: docs/CHANGES-archive.md -->
# Changes — v290 (from v289's run on GitHub)

- Back closing what's open is left out in Safari's engine (iPhone, iPad, Safari on a Mac): an iPhone or iPad has no Back button, and WebKit can crash reloading a page twice once the page has made a history entry of its own (GitHub's WebKit tests found it; a three-line page reproduces it). There Back stays the browser's, as before v289. Android, Chrome and Firefox keep it.
- A Library tile's name on Safari's engine could run to a fourth line, cut off: the spacer that keeps the first line clear of ⋯ was laid out as a line of its own in a clamped box. The name now keeps to three lines as a plain block.
- The Chromium job's time limit on GitHub is 45 minutes (the browser tests now take about 26; v289's run was stopped at 25 with every test so far passing).
- Cache bumped to `marker-studio-v290`.

# Changes — v291 (from v290's run on GitHub)

- On a phone, as the Plan opened straight after Build, the picture first took its full size and then, a moment later once the tabs were laid out, shrank to leave the tabs room (v289). A tap in between could miss its section (two Chromium tests caught it on GitHub's busier machine). The Plan now starts at the size the tabs need, from the room they took last time or about what they need.
- Home's Continue card test waits for the card's next marker after a rename (it comes once the picture is read; GitHub's WebKit was slower).
- Cache bumped to `marker-studio-v291`.

# Changes — v292 (a way to try Back on an iPad; faster CI)

- `?back=1` at the end of the app's address turns on v289's Back (closing what's open first) in Safari's engine too, to try it on a real iPad: open the Library, reload twice, and use Safari's back swipe. Without it, Safari keeps the browser's Back as in v290.
- GitHub runs the Chromium tests in 2 parts side by side (unit tests in part 1), so results come in about half the time, and WebKit part 1 starts with a speed check: how fast GitHub's WebKit runs plain JavaScript, to see why turning a photo into sections takes minutes there.
- Cache bumped to `marker-studio-v292`.

# Changes — v293 (sharp codes when zoomed in; Back in Safari too)

- Zoomed in, the codes were blurry: the picture's canvas has one pixel per pixel of the page, and zooming only magnified them. Zoomed in, the codes are now drawn on a canvas of their own over the picture, with as many pixels as the screen shows (up to about 12 million, under Safari's limit), lined up with the picture through pan and zoom. Not in focus mode, nor over Edit sections, Crop or Straighten. `e2e/v293.test.mjs`.
- Back closing what's open first is on in Safari as well (left out from v290): tried on an iPad with `?back=1`, reloading twice and Safari's back swipe were fine. Only under test automation in Safari's engine is it left out, where Playwright's WebKit crashes reloading a page twice once the page has made a history entry of its own.
- A toast test waits for the sheet to move beside the picture after the window widens (GitHub's WebKit was a moment behind).
- Cache bumped to `marker-studio-v293`.

# Tests and CI (after v293)

- The photo tests run on WebKit again (60 of them, left out since v287): they weren't slow there. The tests keep themselves offline by stopping every request away from the app, and Playwright's WebKit sends the page's own `blob:` addresses through that too, so no photo ever opened ("That file couldn't be opened as a picture") and the tests waited for a Build that never came. `blob:` and `data:` addresses now go through; a photo builds in under a second there. One test stays left out on WebKit, with its reason: a made-up page painted exactly in 8 markers' colours comes out with a 9th marker for one section, as Safari's engine smooths a scaled picture differently.
- WebKit part 1 also times one photo from opening to Build (`e2e/ci-photo-timing.mjs`), next to the speed check (which found GitHub's WebKit draws only about 9 frames a second, at full JavaScript speed).
- The test files are shared out among the CI parts by how long they take (`e2e/ci-parts.mjs`, `e2e/ci-durations.json`): WebKit's six parts now finish within a few minutes of each other.
- Escape-stack's keyboard way into the backup dialog waits for the Library to put focus on Back up first (a race on GitHub).

# Changes — v294 (grainy photos in Safari's engine; GitHub run 36942766302)

- A photo is shrunk in halving steps before it's read (finding the page, the working-size copy of a very big photo, and the photo's colours), so its grain and camera noise even out in every browser. Playwright's WebKit shrinks in one go without averaging: on a grainy page photo with uneven light, the grain survived into the small copy the page finder looks at, the brighter half of the page was taken for a page running off the photo, and the corner check came up where Chrome goes straight to Build. Same answers in both now. (Real Safari on an iPad may already average; this makes it not matter.) `paper-and-background`'s grainy-paper test failed on this on GitHub.
- Speed test: Done repainting one section is checked by what it puts back on the picture (no whole redraw, under a fifth of the picture); the time against a full redraw only in Chromium, since GitHub's WebKit redraws the whole picture in about 50 ms.
- Flaky on GitHub's WebKit, now waited for: the picture shrinking to 50% after a scroll on the 13" iPad; Save fading back in after Draw. If the ⋯ menu ever doesn't open, the failure now says what was showing instead (once in Colour along, passed on a retry).
- The photo timing check reads the corner check from the page correctly (it never came up for its photo: Build in half a second). `e2e/ci-durations.json` refreshed from this run's slowest files (WebKit parts were 19 to 27 minutes).
- Cache bumped to `marker-studio-v294`.


# Changes — v295 (Photo pattern speed in Safari's engine; GitHub run 36948214640)

- Re-colouring a picture a part at a time put each changed part back on the canvas with its own `putImageData`. Each one costs Playwright's WebKit about as much as putting back the whole picture (10–20 ms at 1200 × 1600, however small the part), and lining up a Photo pattern re-colours thousands of small sections, so it took 35–65 s there (Chromium: a moment). More than 8 parts are now put back as one rectangle round them all (the codes inside it are redrawn, which is cheap): 1.8 s. Pixel for pixel the same as before. `straighten`'s Photo pattern test failed on this on GitHub, and passed in v293 only by finishing just in time. Real Safari may not pay the same price per call; it can only help there.
- Undo's Library-delete test taps the toast's Undo without waiting for it to hold still (Playwright waited 30 s once on GitHub's WebKit while the Library drew its pictures).
- Cache bumped to `marker-studio-v295`.

# Changes — v296 (Markers › Scan or type codes)

- **Scan or type codes**, under **Add a set you own** in Markers, for markers bought one at a time. Type codes and press Enter, paste a list (from notes or a spreadsheet), or, on an iPad or iPhone, tap the box, then **AutoFill › Scan Text** and hold each marker's cap in view. Scan Text puts what the camera reads into the box as you aim, so there's no Insert to tap: once the text has held still for 0.6 s it's read, a beep says so, the box clears, and you move to the next cap. (The page can't see the camera or Apple's text reading itself; tried first: a reader shipped in the app (Tesseract) read about 1 cap in 4 from Ben's photos even with each cap cut out and turned level, and Google Lens on a whole close-up read 66 of its 119 codes, with Live Text missing caps too, so one cap at a time it is.)
  - What's read goes into a list to check, each with its colour, brand and whether it's already yours; ✕ takes one off. **Add N to my collection** adds the new ones in one go, with Undo. The list is kept if the dialog is closed, until it's added or cleared.
  - Only real codes count, with the usual misreads put right (BO15 → B015, 8G011 → BG011, a code read in two pieces). The colour name, when Scan Text catches it, confirms the code and settles the 54 codes both brands use (B04, E19…); otherwise it asks which, or the brand chosen at the top (Either / Ohuhu / Copic) does. Only a name read: it asks ("Is it E49 Honey Brown?"). A code that's just a number (0, 120) counts only on its own or with its name.
  - A cap upside down comes through reversed and turned (E19 reads "6L3"): when nothing reads the right way up, each word is tried turned round, against the real codes. On Google Lens's text from Ben's photo this found 18 more codes, with 1 wrong (YR213 with its Y lost reads as R213), so where a turned-round code could also be a longer one, or two codes, it asks. Ones added this way say "read upside down" in the list.
  - Typing (a letter at a time) waits for Enter; a paste is read at once, keeping its lines. Beeps: two rising for a new marker, one low for one already listed or already yours, a buzz when Enter or a paste had no code.
  - `src/js/scan.js`, `src/css/11-scan.css`; `test/scan.test.mjs` (7) and `e2e/scan.test.mjs` (4).
- Palette: the line "Some colours stray from the scheme" showed now and then for a palette that keeps to it (about 1 Analogous 8 in 200 with the 120 set): the check tried the scheme's hues a whole degree apart, so a palette spread across 119.8° of the 120° Analogous allows could miss them all. It now allows the half degree between. (Seen as a flaky test on GitHub's WebKit, run 36952636480.)
- Tests: the side-by-side sheet test waits for the sheet to finish sliding in (GitHub's WebKit measured it 7 px down once). `guide-frame.test.mjs` is now two files (`guide-frame-2.test.mjs` the second half): on GitHub's WebKit the one file took 11½ minutes, near node's 12-minute limit for a file, and in run 36952636480 it gave no results until the retry ran all of it again (WebKit part 1 took 36 minutes). `e2e/ci-durations.json` has both halves and the new scan tests. The run summary now names a file the retry had to run again whole (no results the first time, or a failure outside any test) as a flaky file, a warning; before, it passed without a word.
- Cache bumped to `marker-studio-v296`.

# Changes — v297 (fresh-eyes sweep of v296: the marker scan pressure-tested, and fixes across the app)

Three reviews this time: the guide's code, everything else, and the new marker scan on its own (brute force over every marker: its code with its name, every one-character misread, every code turned upside down, the words of every name), then a review of the fixes themselves.

**Scan or type codes**
- **The colour name now has its say.** A code read with another marker's name (R4b with "Old Rose": the code reads as R48, the cap is R46) is asked about instead of taken as read; a misread is put right towards the reading the name agrees with (YG11 with "Dark Sand" is Ohuhu Y611). Names are matched as words in a row ("Cool Gray No.1", and short ones like Fig only as a word of their own), or run together when long enough. Over every marker's code with its name and one misread character (6,100 reads), the review's brute force found hundreds of wrong markers added without a question; now 3, each a code and a name that are both right for another marker (Copic RV11 Pink, Ohuhu RV17 Pink).
- **Ohuhu's old codes**, on the caps of older sets, are read (362 of them): as the marker they belong to now; where an old code is now another marker's code (26: R25 was Pale Blue Violet, now BV26; R25 is now Tender Pink), the name decides, or it asks.
- **Words aren't codes.** Misreads are put right only in a word with a digit, and upside-down reading only tried on one with a digit or a character only an upside-down read gives: "Egg" had been read as E66, "Bog" as B06, "No" (in Cool Gray No.3) as Copic N-0, "Sea" turned round as Y35. No code is made up across two words with a misread put right ("B63 T-1" had added BG311).
- **The brand chosen above the box isn't forced.** Another brand's code as read, or with its name, says "C-3 is a Copic code" (with a button to add it anyway) instead of being bent into the chosen brand's (Copic YG11 had become Ohuhu Y611; Copic E08 turned round into Ohuhu B03). The brand's name on a cap (Ohuhu, Honolulu, Copic, Sketch, Ciao) settles a code both brands use. Choosing a brand answers the questions between brands already waiting. The choice is remembered.
- **Questions wait in the list** (two brands' B04; "603": G03, or E09 upside down; the code and the name disagree; an old code), with the answers as buttons, so sweeping on loses none; a question isn't asked again once answered, or when one of its answers is already listed. Nothing waiting is counted for Add.
- **Quieter while sweeping:** one cap held in view (its text comes again each time the box clears) is said once, two caps held together likewise; a name read before its code is shown without a sound. Text with nothing to read in it is cleared a moment later, so it can't run into the next cap's.
- A pasted list is read a line at a time (one line's name can't settle another line's code) and said once ("37 added to the list"); a whole collection pasted at once is listed in a moment. Full-width characters, a dash on its own ("C - 3") and a name run on to its code ("B015Celadon") are read. Focus goes back to the box after answering a question or taking a row off (on an iPad the keyboard, and Scan Text, went with the button). The box has focus when the dialog opens.
- **Add** takes markers off the To buy list (bought, as its Bought button does), and its Undo puts them back and brings the list back too, to put right and add again. Add stays in reach at the bottom as the list grows.
- **The welcome** offers it: "Bought them one at a time? Scan or type their codes" opens Markers with it.
- Tests: `test/scan.test.mjs` 14 (+7), `e2e/scan.test.mjs` 9 (+5).

**Bugs**
- **← Plan › Discard edits opened the photo picker** (Edit sections, with an edit made): the button passed its click to the code as "this is Home's New guide". Picking a file there replaced the guide.
- **Unreadable saved data with storage full**: Home said "A copy of the original was kept" when the copy had failed for lack of room, and the next save wrote over the original. Now it says there wasn't room, the original is kept for Download the original until the app is closed, and later starts don't offer a download that can't work.
- **Palette Undo** went back to the palette before under the scheme and size chosen since (a Complementary 4 labelled Analogous, with 8 chosen, and the "stray" line); each palette's scheme is now kept beside it. A colour locked past a smaller size (8 → 4) was dropped; it now moves into a free place.
- **Zoomed in**, every tick and Paint stroke redrew the whole picture and every code (since v293's sharp codes); now a part at a time on both, the same as a full draw (tested). The sharp codes' canvas is handed back on leaving the guide, and drawn again on return.
- Codes off in Colour along left ticks in the old style where the picture was drawn a part at a time.
- A crop rounded past the photo's edge left its last column empty, read as a line of ink.
- Focus mode's outline, the export image, and the photo canvases of Straighten, Photo pattern, Palette's From photo and the paper spot weren't handed back (iPad Safari counts canvas memory until collected).
- A tab brought back from the browser's back/forward cache, or coming back into view, didn't read changes saved meanwhile by another tab before its next save could write old markers back.
- Match a colour kept a stale result when one marker was swapped for another (the same count) or marked dry in another tab.

**Engines**
- **Analogous and Monochrome from a chosen marker** were lopsided: the marker took the fan's end (Analogous) or the lightest step (Monochrome), so the other colours sat mostly on one side (Analogous 5: 293 above its hue, 160 below over 120 rolls). It now takes the target that fits it: 237 above, 243 below.
- The scheme line said "… base" for a marker that wasn't the base (the base the palette was built round isn't in it); it now names a base only for a marker chosen to start from.
- Palette's From photo, the paper spot's photo, Match's photo and the Photo pattern's flattened page are shrunk in halving steps too (Safari's engine doesn't average a big one-step shrink, so the colours read were noisy).
- Marker keys are looked up from a map (Library tiles, To buy, the swatch chart asked once per marker, through all 721).

**iPad and iPhone**
- Text fields under 16px (search, Library search and sort, Order, backup text, rename, the guide's selects, zone name) are 16px there, so Safari no longer zooms in on focus and stays zoomed.
- Dialogs keep clear of the status bar and home bar when installed; the welcome fits the height Safari shows. A marker held down no longer starts a text selection first.

Not changed, for now: Match's rows are a button with a To buy button inside it (a nested control for screen readers; making the copy action its own button changes the row's layout); an IME's composition text in the scan box is read like Scan Text's (Scan Text's text may arrive the same way, and ignoring it could stop the sweep).

- Cache bumped to `marker-studio-v297`.


# Changes — v298 (a second fresh-eyes sweep of v297)

Another full pass over the guide, the rest of the app and the marker scan, looking for what the first sweep missed. New tests: `test/v298.test.mjs` (7, six failing on v297) and `e2e/v298.test.mjs` (9, all failing on v297).

**Scan or type codes**
- **Two caps in view with one name read** (R46 and R48 with R46's "Old Rose"): the name was used against the other cap. R48 was asked about as "the code and the name don't match", and since R46 was already listed, the question was dropped and R48 was lost. A name another code in the text accounts for now settles nothing more.
- **A pasted list keeps every line.** A line with only a name, another brand's code or a code upside down was dropped whenever another line had a code; each is now a question in the list. The same code from two brands on two lines (B04 Copic, B04 Ohuhu) is two entries, not one.
- **The box no longer gets stuck.** When Scan Text swapped the text and then put the same text back, it stayed in the box for good. And after Enter, the same code from the next cap was ignored. Both are read and cleared now.
- **Android keyboards** send each letter as the whole word being composed, so a pause half-way through typing a code read what was there ("R1" for R14). A letter added to a word being composed now waits for Enter, as typing does.
- **Held in view:** another brand's code buzzed, and a name read on its own was said again, every time the text settled. Each is now said once. The card now reads "Copic C-3 Cool Gray No.3 · Another brand than the one chosen (Ohuhu)", not "a Ohuhu code".
- Rows' remove buttons are 44px wide, and a long list scrolls the card instead of squashing the box.

**Guide**
- **Ticks after Edit sections.** A merged-away section kept its tick, unseen, so a page could warn about losing colouring it didn't show. A merge of a ticked and an unticked section stayed ticked. A part split off a coloured section came back uncoloured. Ticks now follow the paper: a merged section stays ticked only when every part was, and each part of a split one keeps its tick. The line in Edit sections says so (it used to say merged and split sections start uncoloured, which wasn't so).
- **Zones:** touching sections either side of a zone's border could get the same marker, with No repeats, Main colour or "keep touching sections clearly different". Over 8 builds of the sample with a zone, none of the 160 touching pairs across the border now share one.
- **Undo after Change colour** on a section already coloured kept the new marker (a coloured section keeps its marker through Plan changes, and that rule caught Undo too). It now goes back.
- **Focus mode** now tells a screen reader each section as it comes ("E19 · Dried Sage. Section 2 of 5") and when the page is finished. Before, the bar changed silently.
- A guide file with a key like "constructor" failed to open, and the guide that had been open was cleared first.
- Ending Edit sections with nothing left to build, or with Discard, now also drops the copy of the edits kept for Resume, so Home no longer offers stale edits back. A save that started before a copy was kept aside for leaving the page no longer throws that copy away.
- A new photo starts with Enhance on and the middle line sensitivity, not the last photo's.
- A see-through PNG's clear parts were read as black when finding the page, and a picture under 8 pixels across read its padding as ink.
- The Photo pattern used more markers than asked for when none of yours was close to the photo's colours.
- More canvases are handed back as soon as they're done: the Library's thumbnails, the PDF's pictures and its zone outlines (iPad Safari counts canvas memory until it's collected).

**Elsewhere**
- **Copic 0 Colorless Blender** (#ffffff) was picked as a colour: in palettes, guides and From photo, and as Match's "closest marker" to white paper. It can still be owned, but is never picked as a colour.
- **Re-rolling one palette colour** again and again walked it off the scheme (each re-roll could move it 30° from the last). It is now aimed at the scheme hue nearest it: over 600 re-rolls of four schemes, none leave it.
- The "Some colours stray from the scheme" check now tests exactly the hues that matter, with no half-degree of slack either way.
- Markers › Add a set kept showing sets as yours after Clear collection, and the reverse after its Undo.
- Unreadable saved data with storage nearly full: the note about it is written before the copy of the original, so a copy that takes the last of the room can't leave the loss unsaid.
- A restored guide's name in the restore message is escaped. A saved palette with a broken time no longer shows "Invalid Date". Match says "None of your markers to use" when every one is marked dry, not "No markers in your collection yet". "1 distinct marker", not "markers".
- CI: a half-written line in the retry results no longer stops the retry report.

Not changed: Random with "keep touching sections clearly different" off still picks freely. That's what the option means.

- Cache bumped to `marker-studio-v298`.

# Changes — v299 (a third fresh-eyes sweep: v298's own fixes, and what the first two missed)

Four reviews ran side by side: v298's changes on their own, the marker scan (about 120,000 reads, brute force), the guide, and the rest of the app. Two of v298's fixes had bugs of their own; both are fixed. New tests: `test/v299.test.mjs` (6) and `e2e/v299.test.mjs` (11), all failing on v298.

**v298's own fixes, put right**
- **Section edits waiting for Resume could vanish.** If they came from an earlier visit, opening the same guide from the Library, going into Edit sections and back without a change deleted them without a word. Only this visit's own copy goes now; an earlier visit's is kept as "… (section edits)", as a save keeps it.
- **Undo of a merge after building lost ticks.** The build had taken them off the merged sections (v298). They now come back when the merge is undone in Edit sections.
- **The composed-letters rule for Android keyboards** (v298) is now Android only. On an iPad, Scan Text might show its reading the same way, and a cap would then not be read.

**Guide**
- **A part split off a coloured section** came out ticked but with a different marker, and often in another zone. It now keeps the section's marker, pin, flat shading and zone.
- **Ticks kept as the page went away were lost for any guide with merged sections.** On iPhone, ticks made just before leaving are kept aside, in case the page is stopped before they're saved. Opening the guide numbered its sections afresh, so at the next start those kept ticks no longer matched the guide and were thrown away. A guide now keeps its own section numbers.
- **Changes that couldn't be saved (storage full)** wait for Resume, but opening the guide from the Library or Continue opened the older stored copy, and its next save threw the newer one away. The newer one now opens, and is then saved.
- **Mark all coloured** (Colour along) and **Mark all … done** (Focus mode) have an Undo, as Clear had: a mis-tap lost which sections were really done. (Not when it finishes the page: "Page finished!" shows then, with nothing over it.)
- Two tabs on one guide: the message said "merged", though only ticks come across. It now says so.
- A guide made before v298 that used Copic 0 opened saying the marker was "no longer in your collection", though it's owned; it opens as it was. The build's message for a collection of only the blender says so, not "every marker is dry".
- A guide file with a nonsense start date said "started Invalid Date".

**Scan or type codes**
- **A stray digit was glued onto a code.** "E00 0" (Copic E00 with the blender beside it) added E000, and a count after a code in a pasted list ("BG21 1") added BG211. Two words join into one code only when neither is a code by itself, and only to a code as it is now (not an old Ohuhu one). "C - 0" is still C-0.
- **The brand on the cap is heeded.** "Ohuhu B04" with Copic chosen had added Copic B04 without a word; it now says it's another brand's. A code the cap's brand hasn't ("Ohuhu … 0") is asked about.
- **Copic 0, 100, 110 and Ohuhu 120** were lost whenever a word on the cap came with them ("Copic 0", "Ohuhu 120", "120 Brush"), and could turn into an "upside down" question. Words on every cap don't count now. Beside other codes ("E43 120": two caps in view) such a number is asked about, not dropped. A name's own number ("Cool Gray No.0") isn't taken for a code.
- **Another brand's cap read alongside the chosen brand's** ("E19 C-3", Ohuhu chosen) was dropped; it's now a question in the list.
- **A code both brands use** wasn't asked about once either brand's marker was in the list, so after Ohuhu B04, Copic B04's cap couldn't be added by its code. It's now asked about, except while the same cap is still in view (read again within a couple of seconds).
- A paste while Scan Text's text was waiting left that text in the box unread; it's read first now. A letter typed just after a read ran on from the old text ("R014E4"); it starts afresh. Choosing a brand drops a question whose answer is already listed.
- **Clear list** takes a second tap: one mis-tap lost a whole sweep. The question buttons, the card's Add button and Clear list are 44px tall.
- Brute force over the same reads as the review's: no silent wrong markers left except reads the app can't tell apart (one name read for two caps of the same code). Lost markers in two-cap reads with a number-only code went from about 1% to 0.1%.

**Palette and Markers**
- **Re-rolling one colour couldn't be undone**: the band's tap changed the palette in place. Each re-roll (and From photo's band swap) is now a step Undo takes back.
- **Re-rolling** a palette that sat loosely on its scheme still left it (v298 aimed at one of the other colours' hues). It now aims at the base that fits them best. Over 1,000 re-rolls of loosely fitting Triadic palettes, none leave the scheme.
- **"Some colours stray from the scheme"** didn't show for four blues called Complementary (with only blues to choose from). A scheme of set hues now has to use as many of them as it has colours for. Generated palettes still pass, all 960 tried.
- **"Palette from these" let dry markers back in**, and counted the Colorless Blender in "N colours". A selection leaves out dry markers (and the blender), and the count is what's in play. A saved selection holding the blender drops it.
- Random said "All drawn" with nothing to draw (a brand filtered out, or every marker dry); it says "No markers to draw".
- A saved draw from an edited backup could fail to open, leaving filters half-changed, or filter out every marker. Only filters the app knows are taken.
- **Match** no longer announces every frame of the camera or a drag to screen readers. It says the best match once the colour holds still, and not while the camera is live.
- Palettes on an iPad: at most 6 colours across, filling the card (12 had been one row of small tiles). A Library tile's name kept clear of ⋯ after the tile refreshed.

Not changed: Undo of re-detecting sections after a merge, and edits brought back by Resume, don't carry the merges' ticks (v298's behaviour before these fixes applies there). Two caps of the same code from different brands read with one name in a single read can't be told apart.

- Cache bumped to `marker-studio-v299`.

# Changes — v300 (polish: the iPad)

A screenshot tour of every screen on an iPad (upright and sideways, with Safari's bars) and a phone, then the iPad's rough edges, one at a time. No new features. New tests: `e2e/v300.test.mjs` (10); the guide-picture test fails on v299 in WebKit, and the finished-page and no-markers checks on v300 before their fixes.

**Home**
- **Two columns on an iPad in every state.** With no guide in progress, a start card (Choose a photo, or try the sample) takes the Continue card's place beside Markers, Palette and Library, instead of a narrow column in the middle. A phone keeps New colouring guide and one column.
- **Until there's a guide of your own**, the start card (and the Guide tab's) shows the sample page beside its finished guide, codes on it; tapping the picture opens the sample. Once a guide is saved, both cards are words only and Your guides moves up. Delete every guide and the picture comes back.
- **Guides' pictures show the whole page.** In Safari, the Continue card's and Your guides' pictures had the top and bottom of the page cut off (a picture can't take its height from a box whose height comes from the layout); they're now fitted inside their box.

**Guide**
- **The Guide tab's start card**: a serif heading, Choose a photo across the card, Try the sample, Library and Import a guide in a row under it; the picture beside it on an iPad, above it on a phone.
- **Held sideways, the guide card is as wide as the menu above it** when the picture and the controls fit (upright pages: Letter, A4, the sample), the controls taking the room; it had been wider than the menu, with empty space at its sides. A landscape page still gets a wider card, so its picture is as big as before. Sheets beside the picture end at the card's edge.
- **Edit sections' tools** (Leave out, Merge, Split, Add) are one even row across the controls, as Temperature and Mood are, rather than four small buttons of different widths.
- **"Page finished!"** is dark on its green (about 7:1); white was 2.3:1, hard to read.
- **A finished page kept an outline** round the sections of the marker row last open (after Focus mode). Finishing clears every outline.
- **Share's buttons all have their icon** (Save image, Print…, Save as palette, Guide file had none). **+ Zone**'s tap area is 44px tall.

**Palette and Markers**
- **Palette held sideways on an iPad**: the settings (scheme, size, seed, photo) in a column beside the palette, so Generate is on the first screen. Upright, the sizes are one row.
- **Palette held sideways**: Filters is with the other settings, in the column beside the palette, on the first screen (it had been under both columns, below it). Upright, on a phone, and in Markers and Random, it's where it was.
- Palette's lock buttons are clearer on a touch screen (no hover to bring them up), on pale colours too.
- **Markers on an iPad**: the search with Owned / Unowned / All / To buy beside it, then Random, Match a colour, the line about the view and Sets & swatch chart on the next row (Order under them, in Unowned). The markers start about 85px higher. A phone is as before.

**Found by the screenshot tour and a review of v300's own changes**
- With no markers owned (or after Clear collection), "Add a set you own" landed inside the iPad's new row of tools. It's above the row.
- Home on an iPad: its two columns start level (an empty note had pushed the right one down 16px), and its edges are the menu's. The headline doesn't break "marker-by- / number". The Guide tab's start card was wider than the menu when held sideways; its smaller buttons were bigger than Choose a photo and uneven.
- Markers' To buy has no search: Owned / Unowned / All / To buy had jumped to the left, from under the finger. It stays on the right.
- Deleting the only guide from the Library left the Guide tab's start card without its picture until the tab was left.
- On an iPad with no guide in progress, closing the last note on Home sent the focus to a hidden button; it goes to Choose a photo. The start cards' pictures are a tap target only, so screen readers don't hear "Try the sample" twice.
- Scan's brand choice is chosen in the app's green, as every other choice is. Help's sections open with a chevron, as the rest of the app's rows do. Scan's list no longer shows below its Add button, and its count ("3 markers · 2 new · 2 to choose") breaks only between its parts.
- Save image lost its new icon (and kept a stray space) after saving; it keeps both. On an iPad, Markers' Order sits clear of the row above it; To buy has no "Sets & swatch chart" link (its sets aren't there). Random with a selection has "Working from a selection" above "← Markers" again, as before v300. The Guide tab's start picture is shorter on a phone held sideways, and Edit sections' tools go onto two rows rather than run over at a large text size on a narrow phone.

**Last nits**
- **The guide's picture came back smaller after Focus mode** (and after anything else that measured it with the page scrolled down): its sticky picture's position counted the scroll. It's measured from the card now, so it stays the size it was; the finished page no longer "shrinks".
- On an iPad, the Change colour sheet (and the guide's other sheets held upright) is exactly as wide as the guide card, and Cancel and Done share its width, as the guide's own bar does; In this guide's row fades out more clearly where it scrolls on.
- Palette held sideways: up to 9 sizes on one row in the settings column (Triadic's 3–10 had made a 4×2 block).
- Home's Choose a photo (and Continue) are the app's main-button size, as on the Guide tab. Help's How it works has a chevron too.
- A palette of more than 8 colours (tiles) is as tall as its tiles: there had been 70px of empty card under two rows of them (150px beside the settings on an iPad held sideways). Each tile's code is at its foot, clear of its lock, which had covered it.
- **Smaller nits:** the Yellow family's dot (filters and Markers' headings) was an ochre, as brown as Orange's and Earth's: Yellow, Orange and Fluorescent have dots of their own clear colour (canary, orange, fluorescent pink; Fluorescent's had been Yellow-Green's green). Temperature lists Any first, as Mood under it does. Home's guide cards say "finished · today", in the Library's order. A palette's name keeps its line beside a long list of codes, which take more lines instead.
- Scan's "Ready" has a crosshair, not a dot that read as a stray speck. The welcome's list of sets fades at its foot, so it reads as going on (there are more sets below).

**Tests**
- The Pattern tab's Shuffle-and-Pin test waits for the tab to settle before measuring (once, under load, it measured mid-layout).

- Cache bumped to `marker-studio-v300`.

# Changes — v301 (a fix from v300's GitHub run)

GitHub's WebKit run of v300 failed one test, the same every time, not a flaky one: after the welcome's **Try the sample**, focus was left on the page instead of the guide's name (`e2e/welcome.test.mjs`). In Safari the welcome's button still had focus as the guide's header was first drawn, though the welcome had closed, and the guide took that as a choice of the user's to leave alone. A focused button no longer on screen doesn't count now. The test passes again in WebKit and Chromium; it passed on v299. No flaky tests in the run (no test failed once and passed on its retry).

- Cache bumped to `marker-studio-v301`.

# Changes — v302 (polish and housekeeping)

No new features. New tests: `e2e/v302.test.mjs` (4).

**Guide**
- **Colours from** (Owned, Saved palette, Generate palette) is a row across the controls, as Temperature and Mood are: even on an iPad; on a phone each as wide as its words, filling the row; on two rows rather than running over at a large text size.
- **Colour along**: an open marker's actions (Mark all coloured, Find next, Blends) are even; on a phone, two on a row and the third across under them, rather than ragged.
- **Codes on a finished page** in Colour along is off and can't be tapped: a coloured section shows no code, so there are none to show. It had looked on over a picture with none.
- **A tapped section's box points to it**, from the edge nearest the section, so it's clear which section it's about.
- The Colours tab's **Filters bar** lines up with the rows of choices above and below it (it was 2px in at each side).
- **Old codes with a Roman numeral** (eight of Ohuhu's, such as "CGⅡ00", which most fonts draw like "CGll00") are shown and searched as "CGII00". Scan already read them typed either way; the stored code is unchanged, so saved work from before Ohuhu's renaming still opens.
- **Pattern's rows** (Colour pattern, Flow, Direction, Look, and Random's Mix) and Shading's are even where they fit, as Temperature's and Mood's are; they had been as wide as their words.

**What's new** is in plain words: one short sentence or two for each, saying what you can do, without the app's inner workings. v301's line (a fix for keyboards and screen readers in Safari) is left out of it.

**Tests**
- v301's GitHub run passed, with one flaky test in WebKit (passed on its retry): a toast with a sheet open beside the picture (`e2e/toasts-and-errors.test.mjs`). It waited for the sheet to move beside the picture by its left edge being over 0, which since v300 is true before it moves; it waits for the side-by-side sheet itself now.

**Housekeeping**
- `CHANGES.md` starts at v290; v234–v289 are in `docs/CHANGES-archive.md`.
- Timed against v299 in Safari's engine: opening the app, the sample and a photo's guide take as long as before.
- `index.html` (1.8 MB, about 570 KB compressed) stays as it is, unminified: it's kept for offline use after the first load, and comments and indentation are about a fifth of it.

- Cache bumped to `marker-studio-v302`.

# Changes — v303 (small downloaded pages; polish and housekeeping)

New tests: `e2e/v303.test.mjs` (9), `e2e/v303-scan.test.mjs` (6), `test/v303.test.mjs` (5), `test/v303-scan.test.mjs` (10). v302's GitHub run passed in Chromium and WebKit with no failed or flaky tests.

**Photos and pages**
- **A small picture is enlarged before its sections are found.** A page downloaded from the internet is often only 400–800 pixels across, and at that size two lines close together run into one, so the sections between them were lost (a zentangle's flower centre came out as one section; an otter's face, muzzle and chest as one). A picture of the person's own under 1600 pixels on its long side is now enlarged to 1600 by bicubic interpolation of its greys, done in the app's own code so every browser finds the same sections. Checked on 14 downloaded colouring pages and photographed copies of them: the zentangle 1,120 → 1,423 sections, the otter 195 → 238, a paisley 369 → 402; clean pages (a fish, a dragon, tulips, roses, a tiling) the same as before. Phone photos (shrunk to 2400) and the sample are left as they are.
- **Min section size and the specks of ink cleared are measured on the picture as it came**, so enlarging finds the shapes its lines ran together over, not specks too small to colour (enlarged without this, the otter had 73 more, most about 1.5 mm across on paper). The guide remembers how much its picture was enlarged (`upk` in its file), so it opens with the same sections. So are the other sizes meant for the picture as it came: the codes and ticks on the screen and in Save image, a drawn Split or Add line, which sections are too small to shade, how close to a line the Photo pattern samples, the crumbs ignored when looking for the page's edge, which sections count as touching, the texture's darker rim along the lines and its streaks, and Shading's tone lines. Not the grain smoothing: measured and smoothed on the picture as it came, a downloaded page's JPEG grain called for a blur that ran close lines together again (the zentangle 1,423 sections → 1,040), so it's measured and smoothed on the enlarged picture as before. (An older copy of the app opening such a guide doesn't know `upk`: its codes there are smaller.)
- **The "a lot of tiny fragments" warning** counts only fragments that are in the guide: a clean scanned page whose specks Min section size already leaves out had been told it looked like a photo or textured image. Photos of things that aren't line art still get it. It's checked again when Min section size is let go and after an Undo that puts the picture back.

**Scan or type codes** (a close look at it: a review of the code path by path, and every marker's code, name and old code read through it in about 29,000 ways — typed, spaced, with prices and counts, misread as a camera would — before and after, every changed reading checked)
- **Numbers aren't markers**: a price ("$2.99", "3.5") is passed over, and a number beside other words isn't read as a code put right ("E19 Dried Sage $3.99" had added Ohuhu G112, the "99" read as its old code G9; "61" in a list's first column, G312). A count beside a code ("2x", "x2", "2 FB", "120 2") is just a count; a number after "No" isn't a code ("C-0 No.0"); a code without digits among other words isn't one ("the FB page"); "pack of 100" with Ohuhu chosen isn't Copic's 100.
- **Questions don't come back**: one answered (or taken off the list) isn't asked again while its cap is still in view; a question whose answers are all in the list isn't asked (a list pasted twice); a second cap with the same code (Copic B04 after Ohuhu B04) is asked about once the first has gone, rather than never; and a cap's name read with its code settles the question its code alone raised a moment before (the question had stayed, "1 to choose"). A pasted or typed line's own questions stay.
- **What's in the box isn't lost**: Add reads text left in the box (typed without Enter), and is on while there's some; Close reads it too, quietly. A card's **Add** (a name read alone, another brand's code) takes its text out of the box, which had run on into the next code typed ("Honey BrownB015").
- **A word of a name** read beside a code settles it rather than asking about another marker: "BG212 Green" is BG212 Teal Green, not a question about the marker named Green; "B21 Porcelain" is Ohuhu's B21. Words of a name another code in the text accounts for don't count.
- **The brand on the cap** narrows a code's choices before any question ("Copic R12" is Copic's R12, not a three-way question with two Ohuhu markers; "Ohuhu Y13" is Ohuhu E515 by its old code), and picks between two brands' markers of the same name ("Ohuhu Tahitian Blue"); a name both brands use, read alone, offers both rather than nothing.
- **Codes in pieces** are read whole and their pieces not again ("E 614" had added Copic G14 too; "B G05", "R V 17", "WG 05").
- **More misreads read**: | or ! for 1 ("B|12"), a T that could be 1 or 7 (asked: "E1T: E11 or E17?"), O for 0 in Copic's greys ("C-O"), Ohuhu's old code WG0.5, old codes with Ⅱ read as "ll" ("CGll00"), "Cool Gray 3" for Cool Gray No.3. A misread put right more than one way is asked about rather than the first taken.
- **Ohuhu's colourless blender, 0**, is in the data (Ohuhu sells it, "0 Colorless Blender"; not part of any set, and like Copic's never chosen as a colour). With both brands having a 0, the brand on the cap or the brand chosen says which.
- **The brand switch** answers what it can (a brand question, "another brand" for the brand now chosen or Either brand), narrows the others' choices (Either brand brings them back), says so, and goes back to the box.
- **Kept**: the list survives a reload (Safari can reload a tab put away mid-sweep). Several read at once that are all yours already say so, with the quieter sound. After Add into an empty collection, focus goes back to Scan or type codes (it went to the top tab), and Add a set's ticks and counts follow; Undo puts To buy markers back where they were in it, and doesn't list a marker twice. A composed keyboard (pinyin, Japanese) waits for Enter. The sound starts from the tap that opens the dialog. On a narrow screen or at a large text size, a row's code sits over its name.

**Polish**
- **Library**: a guide's or palette's line under its name is on two lines, what it is ("Guide · 16 markers") and then how far and when ("finished · today"), as Home has them; a narrow tile had left "· today" or a dot on a line of its own.
- **A marker's card** (Markers › Random): its brand line ("Ohuhu · Yellow-Red / Orange — was YR4") goes across the card, with the hex beside the last line; on a phone it had wrapped in 60% of the width.
- **Plan → Colour along on an iPad held sideways**: the picture no longer moves 4 px to the side. The tools beside it were a few pixels narrower in Colour along (its count shorter than "sections"); they're as wide in both.
- **A palette of 8 on a phone**: the codes are sized to their colours (11 px rather than 13) and no longer touch.
- **Focus mode**: with **Colours** open, the section you're on is framed above the sheet (it could sit under it); closed by its button, a tap on the picture or Back, the section is framed in the whole room again. The picture keeps its size either way.
- **Markers › All**: each family lists its markers brand by brand and by code; a few Ohuhu markers added to the data later (R12, R14, YR01…) had come after the Copic ones.
- **Library and Home pictures** are drawn at twice their size and shrunk smoothly, so their lines are whole rather than stepped and broken, and at the size the tile shows a tall page.
- **The bar under the guide** (Edit sections / Colour along) has a short fade above it, so what scrolls under it thins out rather than showing its edge just over the buttons.
- **Colour along, finished**: a colour with one section says "Coloured ✓", not "All 1 coloured ✓".
- **Filters**: a filter with nothing in it under the others is dimmed, as its count was; "Nothing chosen = all." keeps together on a line.
- Harmony's rows are left as they are: Custom and Photo on a row of their own is deliberate (v289), and tidy on every size.
- Left as they are, also deliberate: Palette's Colours sizes in two even rows of 4 on a phone when there are 8 (they don't fit one row beside their label at a finger's width), and Colour along's first-time tip with **More** on a line of its own.

**Housekeeping**
- The WebKit parts on GitHub are shared out by v302's real times (part 2 took 27 minutes, the others 18–21), and each part now lists every file's time, slowest first, so `e2e/ci-durations.json` can be refreshed from real times for every file.

- Cache bumped to `marker-studio-v303`.

# Changes — v304 (a review of the key engines)

Every key engine was reviewed in three passes: path by path with every constant checked; then stress and corpus tests on copies, before and after; then again by a fresh reviewer, who looked for what was missed and tried to break the fixes. Each product choice was then measured on its own and with the others before anything was built. New tests: `test/v304-segmentation` (7), `v304-colour` (8), `v304-assign` (9), `v304-shading` (8), `v304-photo` (3), `v304-persist` (5, with `test/fixtures/marker-order.json`), `v304-match` (6), `v304-finder` (12), `v304-buy` (4); `e2e/v304-segmentation` (12), `v304-assign` (1), `v304-shading` (2), `v304-photo` (15), `v304-persist` (10), `v304-match` (7), `v304-export` (9), `v304-finder` (6), `v304-buy` (5). Each fails on v303.

**Markers**
- **Search finds a code however it's typed**: "c3", "C-3" and "c 3" are C-3; "copic b04" is Copic's B04; old codes as printed (Ⅱ typed as "ll" too). "grey" and "gray", "colour" and "color", and curly apostrophes are the same, so "grey" finds both brands' greys and "colourless" the blenders. A brand's name finds its markers from four letters ("copi"). Codes match from their start, so "g05" is G05, not BG05 and YG05; a number alone ("22", "000") finds the codes with it. The code searched for comes first under **Best match**, markers that once had it next under **Old code**, and "isn't in your collection" names the code typed. Choosing a marker for a custom palette slot searches the same way. Search boxes no longer autocorrect or capitalise.
- **Tick all shown, Untick all shown, Copy codes and Palette from these act on what's on screen**: in Unowned › Ramp gaps they had acted on every unowned match (76 shown, 271 ticked). Copy codes copies in the order shown.
- **Untick all shown, armed, is let go when the search changes**: a second tap had removed whatever the new search showed (the whole collection, in a test).
- The custom slot picker shows every marker (it stopped at 400). Going to another scheme and back to Custom keeps all its markers (a 12-marker palette had come back with 8); a smaller size chosen in Custom still cuts it.
- The Colorless Blender is no longer a gap to fill, and owning one doesn't count as owning white. Palette from these is off with only a blender shown. "Your collection is empty" only in Owned. The grid doesn't animate in at each letter typed.

**Palette**
- The guide's Generate palette uses your markers, not a selection left on the Palette screen by Find (it had made palettes of markers you don't own).
- Palette › From photo: tapping a colour walks through the five nearest markers, clear of the other colours, then back to the first (it flipped between two).
- Tap the white paper no longer darkens a scan or a white page, and takes a cream paper's cast out.
- A palette from a mostly grey collection uses greys clearly different from each other. Re-rolling a colour keeps the palette on its scheme, and says so when nothing fits. A size, scheme, filter or base your markers can't fill says so (it kept the old palette silently); a filter changed mid-roll is applied after it.

**Sections**
- A Split or Add stroke can start on the outline: it cuts the section it crosses (it did nothing). The red line drawn is as wide as the cut.
- Turning or tilting, then changing Sensitivity straight away, keeps the turn; Undo after a Sensitivity or Enhance change puts the slider back; the warning about the picture follows Sensitivity, Enhance and Undo; a stroke the system cancels cuts nothing; a section picked to merge is let go when the sections are found again.
- A table photographed round the page stays background after the guide is reopened. The page's margin merged into a section stays the page.
- **Very dense pages**: above 3,000 sections Build asks first and offers to leave out the small ones; a page with more sections than a guide can keep can't be built until Min section size is raised; and very dense pages save with their tiny specks joined to the lines, so they always open again.

**Plan**
- Sections added or split, then built, no longer get the same marker as a section they touch (about one split in four did). Nor do sections moved between zones.
- With several zones laid at once, each zone's Gradient, Radial or Blend is laid over the zone itself, not the whole picture (it changed at the next tap).
- Touching sections don't get two markers that look the same (CIEDE2000 under 2.5: often two of one brand, or a Copic and its Ohuhu match). Random › Mixed with "clearly different" off no longer puts one marker on touching sections. Touching sections are found across porous lines.
- Removing the last Blend anchor brings back three in the zone ("Last anchor removed: Blend starts again from 3"; it had laid one marker everywhere).
- Gradient's Start colour and Random with hundreds of markers respond much faster. With one marker the count says "all (1)". A new picture, an opened guide or Undo don't show the last guide's Balance note.

**Shading**
- A page downloaded small shades as many sections as the same page at its full size (since v303 about half were left flat). Guides from v303 made from small downloads gain shading when opened; no ticks change.
- A big shape covering a quarter of the page or more is shaded; only the background that size stays flat, and its tip says "Background-sized — one flat colour" (it said "Too small to shade").
- Tone lines are dashed along the line: with the sun in a corner some had gone solid or vanished.
- **Print › Tone lines**: a Print option of its own (on unless unticked). The screen's Show tone lines stays the screen's.
- The Colorless Blender isn't suggested as a marker to buy. Highlights and Shadows respond faster.

**Photo pattern**
- The photo stays on the picture when it's turned, cropped (by hand or Auto) or tilted, and Undo puts it back exactly; after straightening, it's lined up again (or set to Fill to line up). Its colours had come from the wrong part of the photo.
- A photo of a page that isn't coloured yet leaves every section white and says so, instead of colouring it in greys and black; "Use grey markers for the grey parts" for pencil shading. A photo dragged off the drawing says so.
- With zones, "% close match" counts the Photo zones only. A tiny photo keeps its size when dragged. A photo picked quickly after another, or still loading after another pattern was chosen, no longer comes back. Very large photos are shrunk in steps an iPad can hold.

**Match**
- After pinching to zoom, the camera reads the colour under the ring (it read a spot up to 150 px away); a pinch doesn't move the ring.
- While the camera is live, taps on a row or + To buy work (about 1 in 14 did); the list stays put under the keyboard.
- The camera turns off when the app is put away or another app takes it, and Start camera works after an unanswered camera question. "Copied" only when it was, read out; Light says on only when it is.
- A photo is read from a little more than a dot, so grain matters less; the ring stays on the photo.
- **To buy** suggests your brands first; another brand's marker only when clearly closer, under "Closer in Copic" (or Ohuhu). Or only the brands chosen in Brands I'd buy.
- **Find similar** shows markers like the one you came from, under "Similar to …", not the marker itself; an identical colour is marked "Same colour"; none on the Colorless Blenders.

**Brands I'd buy** (new)
- Markers › **Brands I'd buy** (under Add a set you own and Scan or type codes, and in To buy) says which brands a marker you don't have is suggested from: in Match a colour, a guide's shading and blend plan, and the Photo pattern. **Your brands first** (another brand's marker only when it's clearly closer, or nothing of yours fits) or **Only these brands**. Kept with your collection and in backups; Match's heading names the brands when it leaves one out. A blend plan's markers to buy now come from your brands first (any brand before). A change made in another tab, to this or to your markers, shows at once in a guide open here (its notes had stayed as they were until drawn again).

**Save image, print and share**
- Save image's codes are placed so none overlap, shrinking as needed; sections with no room are left plain, with a line under the key saying so. The key is 2 columns on a narrow picture (names had been cut), 4 when it would be long, codes only past 150 markers; a guide with hundreds of markers still saves on an iPad.
- Save image no longer stays on "Preparing…" after a problem. One PDF at a time. Test strip pages are drawn one by one, and changing Paper meanwhile doesn't mix sizes. PDFs work on Safari before 16.4. The colour card with hundreds of markers fits an iPad. A second Share tap doesn't download; downloads wait longer for Safari's question.

**Backups and saving**
- **Restoring a backup** keeps a guide that's stored but missing from the Library (it's offered back on Home) and keeps your own newer changes to a guide as "… (before restore)"; a guide deleted a moment ago comes back as itself. The Welcome and Home restores say so too.
- When saving fails because Safari's storage stopped answering, it says to reload, not that storage is full.
- A backup that couldn't read some guides says so, and reminds you to back up again.
- In Safari on an iPhone or iPad, one **Keep your guide safe** card after you first colour a guide, and after 5 days or more away: back up, and add Marker Studio to the Home Screen.
- A test pins the order of markers.json, since saved palettes keep markers by position.

- From v304's GitHub run (every Chromium test and all but one WebKit test passed): an older test expected no backup card on an iPad's first day; in Safari's engine that is now the Keep your guide safe card by design, so the test checks the 14-day rule in Chrome, as it means to.
- Cache bumped to `marker-studio-v304`.

# Changes — v305 (a fresh-eye review, pressure-tested)

Four new reviewers looked at v304 as a first-time user and as Ben uses it: the guide flow; Markers, Palette and backups; the gradient on Ben's rainbow pages; and the finished picture. Each finding was then pressure-tested on 30 pages (16 downloaded, 14 photographed) in Chromium and WebKit, with prototypes, before anything was built; several fixes changed as a result, and Symmetric Radial was left out (its detection switched on for tile pages and missed photographed mandalas). New tests: `test/v305-photo` (5), `v305-restore` (4), `v305-finder` (2), `v305-guide` (4), `v305-gradient` (10), `v305-frame` (3), `v305-show` (5); `e2e/v305-tobuy` (5), `v305-restore` (2), `v305-small` (5), `v305-guide` (7), `v305-gradient` (3), `v305-frame` (4), `v305-show` (15). The tests for each change fail on v304. Saved guides open exactly as they were saved.

**Gradient**
- **Smoother gradients**: after a Gradient is laid, sections near each other along the flow swap markers where that makes touching sections clash less. Each marker stays near its place, the Start colour still starts the flow, each marker keeps its share of the picture, and pinned and coloured sections don't move. Over 30 pages, clashing between touching sections drops by about 30% at one marker per section (on Ben's page the worst pair goes from ΔE 56 to 39). It's the same every time on every device. Gradient only: Random keeps touching sections apart its own way.
- **Around**, a fifth Flow: the colours go round the centre like a colour wheel, clockwise from the top (drag the ⊕ to move the centre). With a warm or cool set they go out and back, so the ends match where they meet. About 75% less clashing than Radial on a mandala.
- **Framed pages**: on a new picture, the paper inside a frame drawn round the drawing is left white, as a page's paper always was, and so are watermark letters outside the frame (they had their own PDF close-ups). "Paper inside the frame is left white · Colour it" on Edit sections and in the Plan.

**Guide**
- **Redo** in the Plan: ↷ beside Undo while there's a step to redo, or Cmd/Ctrl+Shift+Z.
- A marker's outline in Colour along goes once its sections are all ticked; it had stayed on screen, and in Focus mode floated over the wrong part of the picture (also after zooming or turning).
- Photo before a photo is chosen says the picture keeps the pattern it had, with "Back to …" beside "Choose a photo…"; closing the picker without a photo goes back by itself.
- A new Blend's three anchors sit on the drawing (13 of 30 had been on the paper round it), in vivid markers nearest red, green and blue (with Ben's markers it had always started with a brown).
- Drop-downs are drawn dark, so Shading's Highlights and Shadows are readable in Safari.

**Markers and Palette**
- **From photo** picks a photo's real colours: it groups them in L\*a\*b\* and ranks them by share and colourfulness. Bright colours keep their hues (six clear blocks had lost orange to a grey-green; on a dark background, red, green and purple), a grey subject keeps a grey, a small bold colour is kept, and the same photo always gives the same palette.
- Ticking a marker as yours takes it off To buy (unless it's marked Running low or dry), and Undo puts it back. Markers you own that are still on the list say "already yours".
- **Restore › Keep mine** adds the backup's To buy list (not markers you own, unless marked low or dry), its Running low and dry marks for markers you own (yours win), and its Brands I'd buy if yours is automatic, and says what came in. It had dropped them.
- Ramp gaps leaves out fluorescents and blacks and only fills gaps within one hue (it had led with four fluorescents).
- Searching the start of a code ("E", "BG", "R2") shows "Codes starting …" first (an "E" search had started with reds).
- "Restore a file" and "Restore from text" (both were "Restore"). A part-typed hex code greys the last match and says what's expected. Scan starts on your one brand when all your markers are one brand, and says so; its choices say which is yours.
- Markers › Owned has no tick badges (every marker there is yours). Palette opens on a palette to look at, saved only when you lock, change, save or use it.

**Show it off**
- **Reveal & share** ends with your piece on its paper over a glow of its own colours, a sheen, then its title, what it took ("448 sections · 16 markers · finished 3 Oct 2026") and its markers as a ribbon (codes up to 16 markers). Share sends the same picture as a 1080 × 1350 card, made while it played so it's ready at once. Drawn without canvas filters, so Safari shows it the same.
- **The first Build of a new picture blooms**: the line art, then the colours flood out from where the gradient starts (round like a clock hand for Around), then the codes. About 1.2 s; a tap ends it and still reaches the section; not on Build again, reopening, the sample or with reduced motion. A device too slow to draw it smoothly gets the guide at once and no bloom from then on.
- **Save image** leaves the codes off once every section is ticked, and frames the picture as Reveal's card. Tick or untick the box to choose yourself.
- Save image's key goes by colour family, as the PDF's does. The PDF key's numbers look like the page's. Colour along's list can go Lightest first, Rainbow or By brand (Focus mode keeps lightest first).
- Ticks leave the picture a moment after ticking when the codes are on. The PDF's close-ups are lighter, with darker codes.

- Cache bumped to `marker-studio-v305`.

# Changes — v306 (left-out items, new ideas, Scatter, the welcome)

A pass over what v305 left out and a session as Ben for new ideas; Ben chose the list. Each item was pressure-tested on 30 pages in Chromium and WebKit before building, built on four branches, then given a debugging pass across the merged code. Snap to tick (photograph a page in progress to tick what's coloured) was prototyped on synthetic photos and waits for real ones. New tests: `test/v306-colour` (17), `v306-dbg-colour` (3), `v306-frame` (2), `v306-along` (6), `v306-home` (11), `v306-smalls` (5), `v306-welcome` (4); `e2e/v306-colour` (8), `v306-frame` (5), `v306-along` (11), `v306-home` (11), `v306-dbg-along` (3), `v306-dbg-home` (3), `v306-dbg-e2e` (2), `v306-smalls` (7), `v306-welcome` (8). The tests for each change fail on v305. Saved guides open exactly as they were saved.

**Gradient**
- **Scatter** (under Look): Polished (v305's gradient), Natural (without v305's smoothing pass), Textured (light and dark of each colour mixed, bands kept crisp), Sparkle (flecks of the next colour along) and Confetti (confetti close up, a rainbow from afar). The same markers and each marker's share of the picture at every stop; the Start colour, pinned and coloured sections stay. Shuffle from Textured up mixes again and keeps the Start colour. On Radial, matching petals scatter together. A new guide starts at Polished; it needs 9 or more markers. Kept per guide and per zone, with Undo.
- **Rough spots**: at Polished with the count at "all", touching sections that jump in colour are ringed, with "N rough spots · Smooth them" under the tabs. It swaps in clear markers you own that the guide doesn't use yet: never a grey, never the other brand of a code the guide (or its highlights and shadows) already uses, never a pinned, coloured or first section. Kept with the guide, so Shuffle keeps it; one Undo step.
- **Big pages**: "all" on a page with more sections than your clear markers uses the clear ones twice instead of greys and browns (Any and Bright moods), with no two touching sections sharing one; the count says "all · 268, some twice" or "all · 216 used".
- **Shading-aware picks**: with shading on, the Gradient prefers markers with lighter and darker partners (a 48-marker set: 8 → 14 of 16 shadeable); the shading note offers "Pick shadeable ones" as one Undo step.
- Blend: an anchor you add is a bright colour the blend hasn't got (it had been a fluorescent, then a beige).
- The Gradient lays the same guide from the same settings on any device: putting the markers in order no longer stopped after a set time (since v304), which on a slower or busy iPad could give a different guide or Rainbow palette.
- Colour it on the paper round the drawing, with a marker for every section, gives the paper a marker of its own; a pinned section's marker isn't repeated on another section. Smooth them in two Gradient zones never brings the same new marker into both.

**Framed pages**
- "Paper round the drawing is left white · Colour it" comes back when a guide is opened again (saved as `frame`; guides saved before v306 stay as they were). Colour it is one Undo step and keeps the Plan's earlier steps; a tick on the paper goes with it.

**Colour along and Focus**
- **Codes in both brands** (Ohuhu and Copic Y26 are different colours) are marked wherever you pick a marker up: "2 brands" on rows, a filled tag on labels and in the PDF key, "Not the Copic Y26" in Focus, a line in Change colour. Worked out from the guide, its zones and its highlights and shadows, so older guides get it too.
- **Find a marker by its code**: "Marker in your hand? Type its code" above the list. The line above the box says what matches; Return shows that marker's rows and opens it. Two brands ask which is in your hand; a code that's only a highlight or shadow says what it goes with. "/" goes to the box; Escape clears it. Switching Whole picture / Zone by zone keeps the search; press and hold a section the search isn't showing clears it.
- **Did any run low?** under Page finished and in Share: one tap marks a marker Running low and puts it on To buy, with Undo; "Another…" finds any of yours by code and says when one is already marked.
- Finishing in Focus: no toast over the art; short marker strokes fly up from the progress bar (none with reduced motion). The PDF close-ups' brand tags print in near-black and white.

**Home, Palette and Markers**
- **Your latest piece leads Home** once finished, with Reveal & share and Print… (Continue keeps priority; copies with section edits waiting are left out).
- **Palette › Rainbow**: 6–16 colours evenly round the wheel at similar lightness, picked as the Gradient picks them, so a Rainbow palette used in a guide gives the guide's markers. Shuffle in a guide's Generate palette rolls another.
- **The welcome** shows the sample page colouring itself (three times in 11 s, then it stays); beside the list on a landscape iPad, above it on a portrait screen; not on short screens; still with reduced motion. "You're all set" fans out the markers just added. The page behind isn't blurred while it moves (Safari had been redrawing the blur every frame).
- Search: an old code that only starts with what you typed goes under "Old codes starting …" ("Y26" no longer files Y39). Toasts fit one line: "Added Ohuhu B04 · taken off To buy", "Removed Copic BG0000". From photo: "Paper looks warm · Make it white" when the paper reads warm; never applied by itself.

- On a phone, Colour along's code box folds behind ⌕ at the end of the order row, so the first rows still show above the bar; ✕ folds it again. An iPad keeps it open.
- Cache bumped to `marker-studio-v306`.

# Changes — v307 (bugs, polish and speed)

A fresh-eye review of v306 by four reviewers (the Plan; Colour along to sharing; Markers, Palette, welcome and offline use; polish and speed), plus v306's GitHub run. Everything it found was built on four branches, then given a debugging pass across the merged code. No new features. New tests: `test/v307-guide` (8), `v307-along` (1), `v307-markers` (7), `v307-speed` (3), `v307-final` (4); `e2e/v307-guide` (6), `v307-along` (11), `v307-markers` (5), `v307-speed` (4), `v307-dbg-core` (3), `v307-dbg-ui` (1), `v307-final` (7). The tests for each change fail on v306. Saved guides open exactly as they were saved, and every guide lays the same markers as in v306 except where a fix below says otherwise.

**Bugs**
- A page finished in Focus mode stays in full colour after ✕ (it had faded to near-white under "Page finished!"): no row reopened, and no open-row fade on a finished page.
- Big pages at "all · 268, some twice" no longer give touching sections the same marker: a last pass moves one of each pair to a nearby marker the guide already uses (954 sections: 11 → 0; 1,423: 48 → 0). The waiting Photo pattern gets it too.
- Undo and Redo keep how the markers were picked with shading on, so the Start colour line stays right.
- Another tab saving the open guide keeps Colour along as it was: the code box's text, cursor and line, a search, the open row, the focus and the scroll.
- Shaded guides count their shading markers: "16 markers + 29 for shading" on Page finished, Focus's finish, Reveal's card, Home's latest piece and the PDF.
- Colour it on the paper round the drawing smooths its rough spots in the same step when Smooth them is on; the rough-spot count shows with the first-time tip.
- A code in both brands found by its code outlines both markers' sections, each in its own colour, until a row is tapped; the brand is a badge on screen and read out ("Ohuhu Y26") wherever a code is named.
- Smooth them never brings in a marker whose own highlight or shadow is the other brand of a code in the guide. The find line names zones where a code is a highlight in one and a shadow in another.
- The PDF key's three-digit order numbers ("162nd") clear the tick box; the two-brands tag is darker in print (the amber showed through pale yellow ink).
- A photo with no colour says "N sections · left white", and Colour along is off.
- A guide that opened (or reloaded from another tab) into Colour along with every section white showed a blank picture. Opening a guide just after pressing Build guide no longer takes it out of Colour along.

**Polish**
- From photo: a warm or dim photo with no paper in it, such as a tray of caps under a lamp, offers "Photo looks warm · Balance it" (the white labels become white; never applied by itself). "Tap something white" accepts a cap label; something already white says "That already looks white: nothing to correct."
- Help › Your data is written for iPhone and iPad: Safari's seven days, the Home Screen app's own storage, "Restore a file", and whether Safari has agreed to keep your data.
- Contrast at 4.5:1 or better: disabled buttons (pale fill, greyed words) including "Tick a set above", Scan's Add, "Page 2 of 3…" and "Building…"; brand letters and badges; the Print sheet's icons; Focus's disabled ←.
- "Saving…" shows only while saving; ticks fade out; one "Page finished" announcement; "Scatter: Polished" styled like the other labels; Undo's space kept in the tool row; smaller rough-spot rings on a phone; Home's latest piece keeps "+ 21 for shading" on one line.
- A hex code typed in Markers' search offers "Match this colour". Opening the app from an address with extra bits after it no longer stores another copy of the app.

**Speed** (same PDF bytes, same pixels, same markers)
- The PDF is drawn a page at a time ("Page 3 of 7…"), with packing and compression in a background worker; Save image and a new guide's first save are encoded in the worker; opening a guide works out its label points in the worker and keeps them for the session; Continue paints once; Home decodes a guide's picture before drawing it. In Safari's engine the longest freezes roughly halve (PDF 1.4–1.7 s → 0.7–1.0 s; opening 0.6–1.0 s → 0.4–0.5 s); total times are about the same, and Save image's is a little longer for its checks.
- If the worker stops answering, the app does the work itself after a few seconds, with the same result.

**Tests and CI**
- WebKit on GitHub runs in 8 parts (it had outgrown 6 × 30 minutes; three files had run only in the retry), timed from v306's run. The bloom test waits for the overlay's fade-out.

- Cache bumped to `marker-studio-v307`.

# Changes — v307.1 (fixes from v307's GitHub run)

- A new guide is in the Library straight after Build again, even if the page is reloaded or closed a moment later: v307 waited for the background worker before the first save. It now waits only while the Build bloom shows (as v305 did), then saves.
- The Print sheet opened again while its PDF is being made says the page it's on ("Page 2 of 4…"), and one PDF comes.
- A ticked ✓ no longer flashes back at full strength as it fades.
- The count of markers shading takes is kept on the Library row only, not in the saved guide.
- Tests: the storage-full reopen waits for the real reload; What's new is checked against the list's first four; the welcome test ignores finished animations; the tick-fade, "Saving…" and ✓-colour tests no longer depend on exact timing. New: `e2e/v307-hotfix` (3).
- Cache bumped to `marker-studio-v307.1`.

# Changes — v308 (beta-ready)

Everything from the eight-reviewer beta-readiness review of v307 (all major, minor and polish items, with Ben's decisions), built on six branches (beta, colour, intake, output, data, palette), merged, then given a cross-branch debugging pass by three reviewers and three follow-up fixes. New tests: `test/v308-beta` (14), `v308-colour` (11), `v308-intake` (10), `v308-output` (4), `v308-data` (9), `v308-toast` (1), `v308-markers` (8), `v308-palette` (15), `v308-merge` (1), `v308-merge-fa` (2); `e2e/v308-beta` (11), `v308-colour` (8), `v308-intake` (10), `v308-output` (14), `v308-restore` (8), `v308-library` (5), `v308-markers` (6), `v308-ticks` (2), `v308-palette` (11), `v308-handover` (2), `v308-specks` (1), `v308-merge-r2` (4), `v308-merge-r3` (2), `v308-merge-fa` (3). Saved guides open as they were saved; Surprise or a new palette moves an old guide onto v308's colour rules.

**For testers**
- Send feedback (foot of Home, the guide's ⋯ menu, beside errors): a short report of version, device, Home Screen or not, counts and the last errors, through the share sheet or copied; `FEEDBACK_EMAIL` in safety.js switches it to an email later. Copy details on errors (kept across reloads), Copy diagnostics in Help › About.
- What's new by version (only what's newer than you last saw), "· Beta" on Home, a thanks card, Help › Beta tester guide (also `docs/TESTERS.md`), a user-first README, correct icon credits (32 Lucide icons), "Not affiliated with Ohuhu or Copic".
- Delete all my data (type DELETE): clears every `ms-` key and the guides' database; other open tabs stop and reload.
- Release branch: `release.yml` and `docs/RELEASING.md` (testers get only what's merged into `release`), `.nojekyll`; the service worker fetches the app once per update.

**Colour**
- Gradient: an Include row (Browns, Greys & black, Fluorescents; Earthy turns Browns on, Deep leaves greys off), a stricter vivid set for Any and Bright, and lightness that follows hue, so "all" no longer goes muddy. "all" repeats markers; touching repeats are split only up to twice the set.
- The count: − and + (hold to run), tap to type, "24" / "all · 130"; the slider ends at what can be used.
- Rainbow starts at red with a real yellow; Surprise keeps the count and follows Include; mandalas suggest Around; Photo's Place it, Blend anchors' markers, rainbow guide names, "+ N for shading", Undo labels that match their controls.
- A palette from Palette's Use in a guide stays as it is (Mood greyed, Shuffle reorders only) until you ask for a new one; it isn't saved to the Library by itself.

**Getting a picture in**
- Tilt fills its corners as background; Straighten starts from the photo's own rectangle; pages under a warm lamp are found; frames with corner ornaments; Auto crop crops screenshots ("Nothing to trim" adds no Undo step); Faint marks; straightened photos start at Sensitivity 7; hatched or coloured-in pages warn; Merge refuses the background; one error message, not two; the bloom's "slow" flag lasts only the session; a note for PDF pages.

**Output**
- PDF key: the colour reference sized to the room left, the table continued on a second page, one NO. column in colouring order (also with Codes); the sun clear of labels, tone lines cut at labels, label halos; close-up letters clear of labels; dot-only sections numbered; names cut, never codes.
- Save image's codes 10px or larger; specks from a photo left out of the outputs (on Ben's page: 22 of 22), never the drawing's dots.
- Focus zooms about the section and shows a focus ring; Escape and Reveal go back to Colour along; the screen-on note in the tool row (a toast where the row is hidden); Print sheet options look choosable; dialogs keep Tab inside and open on their highlighted answer. The light's handle on the picture is see-through at rest, so a code under it reads; the ⋯ menu's Help group lost its heading, so the menu fits a phone.

**Data and Markers**
- Ticks made in the last moment before closing are kept in Chrome, Edge and Android.
- Restore: Keep mine is the default, plus Add the backup's markers, with Undo (kept 7 days); progress; no pointless copies; a newer version's file warns; damaged and truncated files say so and offer what can be done; importing a guide already there asks; Library Duplicate; file names keep non-Latin names; plain-text toasts.
- Unowned follows your brand and Brands I'd buy; Add a set has Undo; Copic fluorescent cap codes; Ohuhu's Blue Grey and Yellow Grey filed as greys; Running low list; "Which R14?"; Scan keeps its questions; the list-search hint; the Random pile; bigger tap targets.

**Palette**
- Size, scheme and filter changes can be undone; the first-visit preview follows your sets; saved palettes keep their scheme; opening one over Custom picks asks; empty filters say so; Save image uses the name; sizes capped to what your collection can make; Brands I'd buy with nothing owned; tiles show 16; From photo keeps hues apart, stops when colours run out ("about N colours") and sorts the bands; portrait keeps Save in view.

- Cache bumped to `marker-studio-v308`; `package.json` 308.0.0.

**From v308's first GitHub run**
- The ⋯ menu test expects the Help group without its heading. Leaving Focus mode on a finished page places the Page finished panel once more when the pinned picture has settled (it could be left under the picture: flaky in WebKit).
- The release workflow and its docs name `main`, the repository's branch. WebKit on GitHub runs in 10 parts (a part of 8 reached its 30-minute limit); every file's time is from this run.

# Changes — v308.1 (from the beta)

- On an iPad, Home keeps its Library card beside Your guides. Since v289 it was hidden there once any guide was saved (All guides led to the Library instead), so restoring a backup made it vanish, and with it the way to palettes and backups.
- On an iPad, a guide in progress makes Home's Continue card run across the page, its picture beside its words, with New colouring guide and the Markers, Palette and Library cards (three in a row) under it. Side by side, the tall picture had left an empty column beside the short cards. Phones, and Home before a guide is in progress, are as they were.
- While the Library or any dialog is open, the page under it stays still. On an iPad a swipe on a short Library could scroll Home behind it, moving Safari's bars and showing a strip of Home's guides at the foot. New: `e2e/v308-1` (2).
- Tests: guide-frame's picture-size test allows a pixel either way (flaky once in WebKit on v308's run).
- Cache bumped to `marker-studio-v308.1`.

# Changes — v308.2 (a debugging pass over v308.1)

Four fresh reviewers (Home, Library and data; Markers and Palette; intake and the Plan; colouring and output), in both engines at iPad sizes and 390. Each fix has a test that fails on v308.1. New: `e2e/v3081-d1` (1), `v3081-d2` (4), `v3081-d4` (3), `v3082` (2); `test/v3081-d3` (1).

- A dialog over a scrolled guide no longer moves the pinned picture and the bar under it (v308.1's page lock now holds only the page, as the guide's sheets do).
- Marking a marker Running low or Dry shows Owned's "Running low" chip straight away, and its count follows.
- Palette: Rainbow offers only the sizes your markers can fill (Ciao 12 had 14 and 16, with Generate greyed out); a size that no longer fits after the collection shrinks moves down before the controls are drawn. Save image's file takes the palette's name.
- With a small collection the marker count ends where "all" does (Ciao 12 ended at 7 while all laid 8, so 7 couldn't be chosen).
- Focus mode: "Mark all … done"'s Undo works after leaving Focus mode; the list's Mark all Undo redraws Focus mode if it's open. The finished page's Codes button and the colour chips' counts are readable (4.5:1 or better).
- Match: a hex code pasted with spaces is read; the same photo can be picked again after "Couldn't read that image".
- Restore's "Undo marker change" leaves the keyboard on the Library's Restore. Clear collection's "Tap again" keeps one timer.
- Tests: Mixed's No repeats allows one repeat where the last unused marker looks the same as a neighbour's (as designed; flaky about 1 in 250).
- Cache bumped to `marker-studio-v308.2`.

# Changes — v308.3 (Ben's decisions from the v308.1 debugging pass)

Seven decisions, each pressure-tested with measurements first, built on three branches. New: `test/v3083-blend` (2), `v3083-colour` (8), `v3083-data` (4); `e2e/v3083-blend` (6), `v3083-colour` (2), `v3083-data` (12). Each fails on v308.2.

- **Blend picks its markers from the blend itself.** The count is the most markers a blend may use, chosen to match its colours, with each anchor's marker always among them; fewer when the blend needs fewer. On the sample with 451 markers at 16: 16 markers used (was 8), about ΔE 1 from the full blend (was 27). The slider ends where "all" does, so each step changes the picture; anchor dots show the marker they give. Saved Blend guides open as saved.
- **Gradients keep every colour family your markers have** (Any and Bright): where the vivid filter dropped all of one family's markers, the most vivid one or two come back (Honolulu 24 keeps its violets V010 and V416: all · 14; Ciao 24 its violets and pinks). Palette's Rainbow too. Your 451 are as they were.
- **A marker added back by hand loses its Running low or Dry mark** (a tick in Markers or its details, Tick all shown, Add a set, Scan's Add), so it's back in palettes and guides and off To buy; Undo puts the mark back. Restoring a backup and Bought are as before.
- **Scan with Ohuhu chosen reads Copic's fluorescent cap codes** (FB2, FBG2, FYG2, FRV1, FV2, FY1, FYG1, FYR1) as another brand's markers to add. No other old code is opened up.
- **Markers' search knows the colour families.** No name matches but every word is in a family ("skin"): that family is shown, with a line saying so. Names match too ("red"): one line offers the family, its whole name preferred ("the Red family (69)"); tapping it turns its filter on. The Scan hint for a list of codes still wins.
- Ohuhu V013's name is "Violet".
- Focus mode: the 21 colour chips that neither dark nor white words read on at 4.5:1 (such as Ohuhu R413) get a soft outline round their words; the rest are unchanged.
- Cache bumped to `marker-studio-v308.3`.

# Changes — v308.4 (from the beta)

- Scan Text reads cap after cap again. v308.1's page lock under an open dialog held the page while Scan's box had the keyboard; on an iPad, Scan Text then stopped after the first cap until Scan was closed and opened again. The lock now lets go while a box in a dialog is being typed in (Scan's, Match's, the Library's search) and holds again when it's let go of. New: `e2e/v3084` (2).
- Cache bumped to `marker-studio-v308.4`.

# Changes — v308.5 (finding Scan Text's stop)

- v308.4 didn't fix Scan Text stopping after the first cap on Ben's iPad (Home Screen app: the camera stays open and reads, nothing more arrives in the box). Copy diagnostics now ends with a trace of what Scan's box was sent this visit (beforeinput, input with its kind, composition, focus and blur, each read and each clear by the app, with how much text), the last 120 events, to see what the iPad sends after the first cap. New: `e2e/v3085` (1).
- Cache bumped to `marker-studio-v308.5`.

# Changes — v308.6 (Scan Text on iPadOS 27)

- Scan Text reads cap after cap again. Ben's log from a test page (the Scan Text Bench, outside the app) showed iPadOS 27's Scan Text puts each cap's text in as a composition (insertCompositionText) and takes it out itself (deleteCompositionText) when the cap leaves view. Scan cleared the box after reading, mid-composition, and that stopped Scan Text for the rest of the visit: the camera read on, nothing more arrived. Of four ways of handling the box, the two that never clear it mid-composition kept reading. Now the box is never cleared by the app while a composition is open (after a read, nor text with no code after 1.5 s, nor on Add); Scan Text clears its own text and the next cap is read as it arrives. Without a composition (older iPadOS, a paste, typing) the box clears as before. New: `e2e/v3086` (3), which replays Ben's log.
- Cache bumped to `marker-studio-v308.6`.

# Changes — CI (after v308.6)

- The test run keeps Playwright's Chromium and WebKit between runs (actions/cache, keyed on the Playwright version), so a run downloads a browser only when Playwright changes. The browser and its system libraries are now installed in two steps, each stopped after 5 minutes and tried again, up to 3 times (`e2e/ci-try.sh`, with a warning on the run's page for each stopped try). A WebKit part's install had once stalled for 38 minutes and run the part out of time; installs usually take 30–60 s. No change to the app. New: `test/ci-install` (4), whose workflow test fails on the old workflow.

# Changes — v309 (a first collection without a set to tick)

Ben's choices from the onboarding ideas (1, 2 and 3, with the count only ranking sets, "anything else?" after every set, and the chart in Markers too), mocked up first. New: `test/v309-collection` (5), `test/v309-d2` (3); `e2e/v309-collection` (7), `v309-1` (6), `v309-d1` (2), `v309-d2` (3), `v309-d3` (3).

- **The welcome opens on three ways in:** I have a set (the set list, a step of its own with Back), I bought them one by one, and I'm not sure which set. I'll do this later and Restore a backup stay. The picture is beside the three on a landscape iPad, above them in portrait. Back, Escape or a tap beside the card go to the step before.
- **I'm not sure which set:** the brand and about how many markers (6 ranges), then Scan reads a few caps ("Scan 3 caps", its own list, the brand fixed, a line saying which set they fit so far), and Find my set shows the best match with a strip of its colours and the caps it has, the other matches a tap away. The count only ranks sets: a wrong guess still finds the set further down. Measured over every set, 100 random picks of 3 caps each: with the right count the set is first 98% of the time and in the first two always; with the count one range off, in the first three 98%. Caps no set has can be added on their own. Scan's own list for Add is left as it was.
- **I bought them one by one:** Scan the caps, Tick colours on a chart, or Type or paste codes, each over the welcome, which then goes on.
- **After markers are added** the welcome says how many and asks: extra markers (one by one), another set (the list, or find it from 3 caps), or That's all.
- **Tick colours on a chart** (new, also in Markers under Scan or type codes): a brand's markers as big swatches, one colour family at a time, yours ticked; Add, Remove or Save (+n −n) with Undo. Ticked here counts as added by hand: off To buy, and a Running low or Dry mark goes.
- **Scan:** the number read is big; on a touch screen the three Scan Text steps are boxes side by side in place of the paragraph.
- Existing tests that ticked the set list first open "I have a set" (`haveSet` in e2e/helpers.mjs); the welcome's layout tests follow the new first step.
- Cache bumped to `marker-studio-v309`.
- **From the pressure test** (three fresh reviewers, then follow-ups), before release:
  - Back puts the keyboard back on what led on, from any step (it fell to the page from "Anything else?" and the result).
  - A set already yours says so ("Nothing new to add"), not "0 more markers added".
  - The toast's Undo after an Add from the welcome (Scan or the chart) takes the welcome back to the ways to add; it had gone on saying "2 markers added". The chart's unticks are said as removed.
  - Finding a set: "All Copic markers" no longer comes first whenever no real set has every cap (it had offered 358 markers for "Up to 30"); a set with only some caps says "Has 2 of the 3 caps", not "Also matches"; a cap in no set (Ohuhu's Colorless Blender 0, a few colours sold singly) doesn't count against the sets, and the caps a set hasn't are named and added with it ("Yes, add these 120 markers and the other cap"); the strip's greys run light to dark.
  - Scan's "Fits so far" line is above the list (on a phone it was below, behind the pinned button).
  - The chart on a phone on its side keeps Save in the card; the chosen family's chip is in view after a brand switch or opening again; each family's dot is a colour of its own (Copic's Cool Grey was white).
- **Ben's answers after the pressure test:**
  - The Ohuhu sets come with a Colorless Blender (0), as Ohuhu's pages for the Honolulu small and large sets say: it's added with the set (48, 72, 104, 120, 168, 216, 320, Mid-tone, Pastels, Skin and Gray Tones; not the 24, sold only inside the 48, nor 24 Portrait). A set's size is its colours ("Add 120 markers", "120 markers and a Colorless Blender"), and the set shows as yours with all its colours, blender or not. The guide card's "Built from the N markers you own" counts colours; Home's count and the swatch chart include the blender, as they do a Copic one. Existing collections are left as they are: tick the blender in Markers if you have it.
  - Adding a set from the welcome (the list, or "Yes, add these") has Undo on its toast, as Markers' Add a set has; it takes the welcome back to where the set was added from.
  - "Is this your set?" fits a phone on its side: a wider card, no steps bar, Yes and No side by side.

# Changes — v309.1 (a full fresh-eyes debugging pass)

Four fresh reviewers, each a part of the app (making a guide; colouring, output and the Library; Markers and Palette; Home, the first run and the app as a whole, v309 hardest). New: `test/v3091-d3` (1); `e2e/v3091-d1` (1), `v3091-d2` (1), `v3091-d3` (2), `v3091-d4` (3). Each fails on v309.

- **A Copic set's Colorless Blender counts in its size again** (Ciao 36 Set B is 36, All Copic markers 358): v309 had left every blender out; only the blender an Ohuhu set comes with is uncounted (`setKeys`).
- **Palette with only a blender or dry markers** said "No markers match these filters · Clear filters" with no filter on (a dead end): it now says none of your markers lays down colour, with Add markers.
- **The welcome's Undo after it had moved on** (I have another set, Find it from 3 caps) left a stale "120 markers added" step behind Back and the keyboard on the page; and Scan's toast Open from the welcome now adds as the welcome's Scan, so "Anything else?" counts it. The chosen brand's small print on "Let's find your set" is 4.5:1.
- **Did any run low? › Another…** said "0 isn't one of your markers" for your Colorless Blender: it now says it's your blender, to mark in Markers.
- **The zone editor closed by Escape** from its own controls gives the keyboard to the zone's chip (or + Zone), not the page.
- Version v309.1; cache `marker-studio-v309.1`.

# Changes — v309.2 (Ben's decisions from the v309.1 pass)

Each pressure-tested one by one first. New: `e2e/v3092` (8), each failing on v309.1.

- **The blender a set brings is said:** "Honolulu 120 and its Colorless Blender are in your collection", so Home's count, which includes it (121), adds up; all of a set's colours already yours but not its blender: "Colorless Blender added". Home's guide card counts colours: "Built from your 120 colours."
- **What's new** for returning testers: v309 leads with the chart in Markers (they never see the welcome); v309.1 tells them the Ohuhu sets now come with their blender, to tick it if they have one.
- **Storage blocked:** the welcome says nothing will be kept (the page's banner is under it), before anything is added.
- **Back after "I'll do this later"** (and Escape), to the three ways in: "I'm not sure which set" is only there. (Find my set in Markers is noted for a later pass.)
- **The welcome's adds come off To buy and lose a Running low or Dry mark,** as Markers' Add a set; Undo puts both back.
- **Save image is named after the guide**, as its PDF: "sample-jellyfish.png", "sample-jellyfish-picture.png" without codes (it was always colour-guide.png).
- **Reveal:** the keyboard on its ✕ while it plays (it was on the page), then Share as before.
- **A very small picture** (under 100 px on its shorter side as it came, or under 200 px when it would otherwise get the fragments warning: Safari's own scaling down left a page at 120 px in fragments) is said to be too small, with what to do; it had been told to raise Min section size, which left 0 sections. Measured on a page scaled down: 24–48 px gave 0–11 sections of 125; 64, 24; 80, 55; 120, 70.
- Tests: the welcome helper `haveSet` waits for the welcome to be up (on a busy machine WebKit could still be opening it).
- **Scan's answer chips** wrap as one line, "already yours" with the words (it had become a column of its own at large text).
- Left as it is, by decision: the sample's first ticks on a force-quit within ~3 s.
- Version v309.2; cache `marker-studio-v309.2`.


# Changes — v310 (a simpler first guide, and Mood as pictures)

Pressure-tested first (30 real pages and photos to the section check: none raised a warning, and all looked right; laying a mood measured at 50–135 ms in desktop Chromium, 7–21 ms on a 1,423-section page laid alone), then built, then a fresh adversarial review. New: `e2e/v310-quick` (5), `e2e/v310-moodpics` (11), `e2e/v310-rv` (2).

- **The quick section check:** a new picture's first Build, when the sections raise no warning, asks only "Looks right?" ("We found 37 sections to colour, shown in pale colours. The teal is background: it stays white.") with **Fix sections** and **Build guide**. The lines that need a choice stay (Page straightened · Undo · Adjust corners, the paper round the drawing, Ignore faint grey marks), and so does the dense-page question on Build. A tap on the picture says to tap Fix sections. Fix sections opens the tools, and they stay from then on (`ms-sec-tools`). A warning brings the full step, which then stays for that picture; the Plan's ← Edit sections always opens the tools. At the first start of v310 anyone with a guide in their Library keeps the full step, so returning testers see no change. The tests start with the full step unless one asks (`'ms-sec-tools': '0'`).
- **Mood is six pictures of your page** (Any, Bright, Soft, Pastel, Deep, Earthy), first in the Colours tab: one row on an iPad, three a row in landscape's column, one row of six small ones on a phone (two rows of three when narrower or with larger text). The one in use is the guide itself; the others are made one at a time while nothing else is going on and the row is in view (not during a drag, a finger down, the first Build's bloom, a popover, Paint or Focus mode).
  - How (`js/guide/32-mood-pics.js`): the mood is laid from the guide as it is by exactly the steps a tap takes (`layPlan`, reassign's laying, now apart; `reassign`'s `how`), Math.random drawn from a seed, and everything laying can change put back. Then a check: the plan as Undo sees it and every value kept must be as before; if not, or if laying failed part way, the guide is put back as Undo would and no more pictures are made that visit (an error in the tests). Nothing is said, saved or made an Undo step meanwhile.
  - A tap lays what its picture showed (its seed), so Random and generated palettes give the picture you chose; ↶ Undo says "Mood: Bright" as before. The pictures are made again, with new seeds, after every change, so a mood left and come back to is a new roll, as before.
  - Where Mood stays as its buttons: zones, the Photo and Manual patterns (no Mood), a palette used as it is (greyed out, as before).
  - The tests make the pictures only where they look at them (`ms-test-moodpics`); `E2E_MOODPICS=1` makes them in every test, each checking itself (run on 22 files that use the Plan).
- **From the review:** no picture made during the first Build's bloom; a warning's full step no longer folds back to the quick check once the warning clears; the tick on the chosen picture isn't read out.
- Tests changed on purpose: Mood leads Colours, then the marker count (`e2e/tabs`); the Colours tab on a phone is allowed 56px more for the pictures (51px measured); Mood's layout check in `e2e/gradient` reads the pictures' names.
- `docs/DEVICE-TEST.md`: a v310 section for the iPad.
- Version v310; cache `marker-studio-v310`.

# Changes — v310.1 (an extra comprehensive fresh-eyes debugging pass)

Four fresh reviewers, each a part of the app (making a guide, v310 hardest; colouring, output and saved work, with a random-sequence check of 175 steps comparing the stored guide with what's open after each; Markers and Palette; the first run, Home and the app as a whole). New: `e2e/v3101-d1` (3), `v3101-d3` (2), `v3101-d4` (3), `v3101-me` (2), each failing on v310. Run with the Mood pictures on in every test (`E2E_MOODPICS=1`) on 28 more files: all passed.

- **The Mood picture in use** follows Change colour, Unpin and Fill (it was kept by the plan, which those change in place).
- **The dense-page question** never offers to leave out every section: a page of thousands of sections all much the same size had "Leave out the small ones" keep 0, leaving "We found 0 sections".
- **The quick check:** Colour it (the paper round the drawing) keeps the keyboard, on Build guide; the check is said to a screen reader once the sections are found ("Looks right? We found 122 sections to colour. Build guide, or Fix sections.").
- **A returning tester restoring a backup made before v310** on a new device keeps the full section step (the first start had found an empty Library); a v310 backup changes nothing, as for a new tester moving from a Safari tab to the Home Screen app. Unreadable saved data at the first start no longer decides it either.
- **Ctrl+Z from a Mood picture** (or another button without an id) keeps the keyboard there.
- **Mood pictures:** three a row, the bigger ones, in iPad landscape's column (v310 gave a phone's six small ones there); a picture slow to make (Random on a page of thousands of sections: 165–380 ms) leaves twice its time before the next.
- **Add a set you own** keeps up while open as markers are ticked or unticked (its counts and ✓ had waited for it to be opened again), and its toast says the Colorless Blender it brings ("Added 73 markers and a Colorless Blender · 1 off To buy"), so the count adds up; "1 off To buy" stays together on a phone.
- **Reveal's clip** is named after the guide ("sample-jellyfish-reveal.mp4"), as Save image and the PDF are.
- Version v310.1; cache `marker-studio-v310.1`.

# Changes — v310.2 (Ben's decisions from the v310.1 pass)

Each recommendation pressure-tested, then taken one by one. New: `e2e/v3102` (6): five fail on v310.1; the sixth checks a lock on a marker you can use stays.

- **An open guide follows Markers:** a marker marked dry, or unticked, while a guide is open does what opening the guide again does: sections still to colour show the closest marker you own, coloured ones keep theirs, the guide keeps the marker for them (saved as it was), and it's said once the guide shows ("1 marker is dry — sections still to colour show the closest you own…"). Ticked again, or the change undone, the marker is back in its sections. Not an Undo step: the plan's Undo baseline follows. Undo now keeps which sections show a stand-in, so going back to a plan with stand-ins keeps the markers the guide had for them (a re-laid plan had lost them, also for a guide reopened with stand-ins). "1 marker is no longer in your collection" (it lacked its "is"). Found on the way: **a coloured section kept its marker through a plan change only while that marker was in your collection**; one coloured with a marker since marked dry or unticked was laid afresh at the next change (Mood, pattern, count…). It now keeps it, as it's on the paper.
- **Palette:** a locked colour that can't be used (marked dry, no longer in your collection, or outside a selection) is unlocked on the next Generate, or a new scheme or size, with a word ("Unlocked YG113: it's marked dry."), as Generate's starting colour already was; a lock on a marker you have stays, whatever the filters.
- **Undo on "Page straightened"** leaves "Page kept as photographed · Straighten", as Cancel does, on the quick check and the full step (`e2e/straighten` changed on purpose).
- **Home's guide card** counts the colours guides use: "Built from your 118 colours (2 marked dry are left out)."; with every marker marked dry it says so.
- Left as they are, by decision: two tabs on the same guide both changing within 1.5 s (needs both on screen; switching tabs saves at once); the last 1.5 s of ticks of a guide deleted while open, then another opened, then Undo.
- Version v310.2; cache `marker-studio-v310.2`.

# Changes — v311 (one way to add markers; Redo in Edit sections)

Item 1 of the list (Find my set from 3 caps in Markers) grew, by decision, into one **Add markers** entry for all four ways, after a pressure test of the whole Markers screen. Items 6–10 are the smaller fixes. New: `e2e/v311-markers` (8) and `e2e/v311-fx` (8).

- **Add markers** (Markers): one button, **+ Add markers**, on the first screen beside Owned / Unowned / All / To buy (not in To buy, nor with no markers). It opens a sheet with the ways to add, each with Undo: **Add a set you own** (the sets list), **Scan or type codes**, **Tick colours on a chart**, and under them "Not sure which set you have? **Find it from 3 caps**". The sets list, Scan and the chart are the ones the welcome already uses; no second copy. The collapsible "Add a set you own" and the Scan and chart buttons at the foot of Markers are gone; **Brands I'd buy** stays there.
  - A set added, or a set found from 3 caps and taken, closes the sheet with the toast and Undo ("Added 24 markers to your collection", the Colorless Blender said when it comes too), and the keyboard goes back to + Add markers. A set you already have: "Honolulu 24 is already in your collection."
  - **None of these: other ways to add** (after 3 caps) goes back to the ways. Back from a first step, or Escape, goes back to the ways, then closes the sheet.
  - Scan or the chart, from the sheet, closes the sheet and opens over Markers; closing them gives the keyboard back to what opened them, or to + Add markers once the card it was on has gone.
  - **No markers yet:** a card at the top of Markers, "Add your markers", says that guides and palettes use every Ohuhu and Copic marker until you add yours, with the same ways in it. The first set added puts the collection's top in view, + Add markers keyboard-focused. The empty Owned list says "Add your markers above, or switch to All to tick single markers."
  - Markers' jump link is now "Swatch chart↓" whenever it shows.
- **Clear collection** moved into Markers' ⋯ menu (with Untick all shown and Back up & restore), shown while you have markers. It still takes a second tap ("Clear all 140 markers? Tap again", for 2.5 s; a double tap doesn't count), the menu staying open in between, and the toast has Undo.
- The welcome's set toast names the Colorless Blender too ("Added 120 markers and a Colorless Blender · 1 off To buy"), as Markers' does.
- **Redo in Edit sections:** ↷ beside ↶, and Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y, as in the Plan, for every kind of edit Undo takes back. A new edit clears it; Build, ← Plan and Discard end it. The last Undo or Redo by keyboard moves the keyboard to the other button.
- **A zone's name:** Escape puts the name back and keeps the keyboard in the field; a second Escape closes the editor.
- **The section step:** its heading gets the keyboard once per picture, and the whole step is said, as the quick check is.
- **Focus mode's Mark all … done:** its Undo is the list's (shading kept, list redrawn).
- Tests changed on purpose: the ways in are reached through `addFromMarkers` / `scanFromMarkers` / `chartFromMarkers` / `clearCollection` (`e2e/helpers.mjs`) in 20-odd files; the welcome's toast with the blender (`v3092`); `v3101-d4` accepts any later version (it named v310, so it failed from v310.1 on); `buttons` counts Mood's pictures (`.sfmp`, 44px+) as large by design (it failed from v310).
- Version v311; cache `marker-studio-v311`.

# Changes — v311.1 (from v311's run on GitHub)

- **Shuffle on a Gradient that loops round the colour wheel** always starts it at another of its markers. It turned the start 10–90% of the way round, which with 6 markers from the smoothest start landed on the same one about 1 Shuffle in 12, and nothing changed (since v306). `v308-handover` failed on it on GitHub (1 run in 6 locally). The style golden file follows: only Shuffle's saved start changed (`e2e/fixtures/style-golden.json`).
- **Mood's pictures in iPad landscape** are one row of six again, as on a phone and an iPad held upright (Ben's choice). v310.1's three bigger ones a row made the Colours tab longer than the screen on both the 11" and 13" iPads, the only tab to scroll, and the page moved switching tabs (`guide-frame-2` caught it; it wasn't run for v310.1). `v3101-me` changed on purpose, and now checks the 13" too.
- `v306-dbg-along`'s run-low test waits for the sample's first save before marking ink: on GitHub's WebKit, the save's "Saved in your Library" came after the ink's line, in the same live region, and was read instead.
- Version v311.1; cache `marker-studio-v311.1`.

# Changes — v312 (Tester tasks; Send feedback to a form; a new device checklist)

Ben's decisions: testers get tasks in the app, not a checklist (D1–D4); results go to a Google Form and its sheet.

- **Tester tasks** (beta only, `src/js/tester.js`): six things to try in the order people use the app (add your
  markers, make a guide, make the plan yours, colour along, come back to it, share or print), three more if there's
  time (Palette, Match a colour, Running low and To buy), and four last questions (what confused you, what you'd change
  first, whether colours on paper matched, whether you'd use it for your next page), with an optional name.
  - Each task: what to do, prompts that don't lead (always "Anything go wrong?"), **Easy / OK / Hard / Didn't try**
    and a note. A rating answers it; tapping it again takes it back. The first task still to answer opens.
  - Answers stay on the device (`ms-tester`) until **Send results**, at the top and the end. A send after a change is
    marked "2 (an update)" with the same tester code, so a tester can send at 3 of 6 and again later. Each answer
    keeps the version it was given on, said in the sheet when it isn't the current one.
  - Ways in: Home's foot, on a line of its own ("Tester tasks · 2 of 6", "ready to send" once all six are answered,
    "sent" after), the thanks card's **Tester tasks**, and the top of Help › Beta tester guide.
- **Where answers go:** a Google Form (`RESULTS_FORM` in `safety.js`, its pre-filled link), posted from the app with
  no sign-in; each send is a row in the form's sheet. `docs/tester-form-setup.gs` makes both in one run. With the form
  set, **Send feedback** opens a small dialog: what you write, sent with the device, version and last errors (Kind:
  Feedback), or **Share it instead** for a screenshot (the share sheet as before, with what was written first).
  Offline, nothing is lost: it says so, and Copy my answers (or Share) is there. With `RESULTS_FORM` empty, both use
  the share sheet (or copy) as Send feedback did. Help › Your data and the tester guide say what leaves the device.
- **The device checklist, rewritten** (`docs/DEVICE-TEST.md`): a 20-minute iPad pass of what GitHub's tests can't
  check (touch, camera, Safari and the Home Screen app, real photos, the share sheet, paper, feel), its ★ lines the
  10-minute pass for every release, and one "New in this release" section replaced each release. The old one, release
  by release since v264, is `docs/DEVICE-TEST-archive.md`.
- `docs/TESTERS.md`: "What to try" points to Tester tasks; reporting describes Send and Share it instead; the Scan path
  is Markers › + Add markers.
- `RESULTS_FORM` is set to Ben's form (made with `docs/tester-form-setup.gs`, which also keeps the link in the results
  sheet's Setup tab). Under test it's switched off (`e2e/helpers.mjs` sets `window.__MS_RESULTS_FORM` to '' unless a
  test sets its own), so no test posts to it; one test checks the shipped link has every field and catches its post.
- New: `e2e/v312-tester` (8).
- Version v312; cache `marker-studio-v312`.

# Changes — v312.1 (fable's reviews of v312, Ben's decisions D1–D4)

Two independent reviews by fable (a new tester's walkthrough, and a code review of v310 to v312), each finding checked
before it was brought to Ben. New: `e2e/v3121` (8), each failing on v312 (Back is left to the browser under test in Safari's engine).

- **Undo back past a marker marked dry** (major): a plan step from before the marker went dry had no record of it, so
  its sections took the closest marker you own for good: the guide was saved with the stand-in, and marking the marker
  usable again didn't bring it back. Undo (and Redo) now keep the guide's marker for them, as a guide reopened does.
- **A pinned, coloured section** whose marker was marked dry since kept it only until the next plan change; it now keeps
  it, as an unpinned coloured one already did (v310.2).
- **Back** (the browser's, Android's) closes Markers' Add markers sheet a step at a time, as every dialog; it had left
  the page. The welcome itself still makes no Back entry. The sheet is named "Add markers" for a screen reader (it was
  "Welcome to Marker Studio").
- **The guide's ⋯ › Send feedback** opens the dialog that sends to the form, as every other Send feedback does; it had
  opened the share sheet.
- **Send results** sends once (both its buttons are off while it sends; one tap on each had sent two rows), and gives
  up after 20 seconds on a stalled connection, saying so (it had said "Sending…" for good). Send feedback too.
- **Edit sections:** a merge outlines the section it made for a moment (the line between them stays on the paper, so
  nothing showed it), and a merge, split, add or leave-out says the new count for a screen reader.
- **Wording:** Add markers' Scan line ("Type codes from a receipt, or scan caps with Scan Text on an iPad or iPhone");
  Print's Cancel is Close once a PDF is made; To buy's empty list says to tap + To buy after Running low; tester task 3
  names Other pairings for Random.
- Looked at and left: in iPad landscape the count ("122 / sections") sits on two lines in the narrow tool column
  beside the picture, as designed (one line would widen the column and shrink the picture); Focus mode's empty band on
  a phone in a shaded guide is the two lines kept for its tips, so the bar doesn't change height (and move the
  picture) from section to section.
- Left as they are (D4): Colour along's paper view, the sample on a phone's Home, long toasts, the scroll to the guide
  after Build, Scan's unanswered codes kept for later.
- Version v312.1; cache `marker-studio-v312.1`.

# Changes — v313 (fable's look for improvements, Ben's decisions D1–D8, D10, D11)

An independent look by fable at the engines, the features and the screens, each idea pressure-tested alone and
together before Ben chose (D9, a photo of the finished page, is its own release later). New tests: `test/v313-family`
(6) and `e2e/v313-plan` (6), `v313-photo` (2), `v313-along` (3), `v313-focus` (2), `v313-polish` (7), `v313-pdf` (4),
each failing on v312.

- **Open a PDF** (D10): a colouring page that came as a PDF opens with Mozilla's PDF.js (`vendor/pdfjs/6.3.289/`, its
  legacy build, Apache-2.0, unmodified; `src/js/guide/21-pdf.js`). **Open the PDF** under Choose a photo, and "Page in
  a PDF? Open it" on Home's start card (the photo picker still takes pictures only). One page goes straight on, as a
  scan does (a PDF page is flat: no straightening); several pages ask which, with a small picture of each (up to 60).
  The page is drawn on white at the working size (2400 on its long side). A locked PDF, a page that comes out blank,
  or a browser that can't run PDF.js says to take a screenshot instead, as before. Tried on vector, Flate, JPEG, CCITT
  G4 and JPEG 2000 pages and several pages, in Chromium and Safari's engine (whose WebAssembly can't run the JPEG 2000
  decoder: its JavaScript version is kept beside it). The service worker keeps PDF.js in a cache of its own, named
  after its version, which a new release leaves alone, so its 2.9 MB are downloaded once. Help and About say so.
- **Colour along** (D1): on an iPad held upright the order chips and the code box share one row; on a phone, once the
  first-time instructions have been seen, Colour along opens with the order chips just under the picture's tool row,
  so three or four markers show above the bar (the picture keeps its size; the ⓘ line is a scroll up). A marker just
  finished lights up its row's "All 10 coloured ✓" for a moment.
- **Focus mode's hand-off card** (D2): moving on to the next marker (Done, Skip or Mark all on the last of one), a card
  says how the last went ("Y28 · all 10 coloured ✓", or "9 of 10 coloured") and which to pick up, with the picture
  zoomed out to all its sections still to colour, in colour with their codes; the card sits above or below them,
  whichever covers fewer. A second pass says "Back to Y28's shadows, now the first coat is dry", and a marker running
  low says so. Done, a tap anywhere (it ticks nothing) or Escape closes it and goes in to its first section; never
  between one section's tones. A double buzz where the device has one; no movement with Reduce Motion. Each marker now
  starts on its largest section (D11).
- **Marker families** (D3): a marker's family is its code's letters and first digit, as both brands number them (Ohuhu
  Y213 with Y26 to Y29; Copic B0000, B000, B00, B01 in that order), for blend companions and shading; a family
  companion is never more than 20 lighter or darker. Only for guides made since v313 (`famRule`, saved only when 1):
  one saved before keeps v312's rule for good, so the markers shown for a part-coloured page's tones never change.
  On Ben's 322 markers: companions more than 20 lighter or darker 18 → 1, about 7 of 620 shift hue 15–25°; on all of
  Copic 97 → 0.
- **Plan lines** (D4, D7), one at a time under the tabs: "R413 is running low · used on 24 sections · Swap it ✕" while
  a marker marked running low has sections still to colour (Swap it gives them the nearest marker you own that isn't
  low, dry or a blender: pinned, one Undo step; coloured ones keep theirs; ✕ is kept with the guide, `lowX`); "low" on
  its Colour along row and in the markers on the page (not the printed key). Once, after the first-time lines:
  "Screens and ink differ. Print a test strip of these 16 markers to see them on your paper", whose link opens Print
  with Test strip. The last tab is **Share & print** where it fits (Share on a small phone at larger text).
- **Photos under a lamp** (D6): the page finder no longer takes the bright half of an unevenly lit page for the page
  (the drawing runs across that outline, or the light changes gently there rather than in a step), and a drawing's own
  outline wins a tie only when it fits the drawing. When it isn't sure, **Keep as is** comes first and Straighten shows
  "Straightening the page…" before it does it. All 36 real photos (Ben's and downloaded) unchanged; 41 synthetic lamp
  photos better (none worse). `e2e/fixtures/lit-mandala*.png` are two of them.
- **Edit sections draws faster** (D5): the picture is redrawn through a table of each section's colour, the faint-marks
  figures come from the speck pass already made, and the integral image is 32-bit while it fits. Byte-identical
  sections and pictures on 71 test images.
- **Polish** (D11): Markers' line about the view under its row ("Your collection."); Palette's Undo, Clear, Save and ⋯
  on one row; the empty Library says what's kept there, with Try the sample, and has no search box; the guide's start
  card in Home's words; Edit sections' intro is one line; the Colour along and Reveal shimmer runs three times; the
  sample's ticks don't put it on Home's Continue card until it's printed (its page, not the test strip) or renamed
  (`smp`); Continue says "Last coloured 3 days ago" (`dates.l`).
- **Not changed** (D8): a cap on how much of a Gradient one huge section takes, and dropping ramp stops with under 1%
  of the page, were measured on 20 pages × 3 collections × 5 shapes × 3 counts: neither was clearly better (harsh
  neighbour jumps worse on several pages; dropping stops also gave far fewer markers than asked).
- Tests: v289's keyboard test settles before its tap (flaky on GitHub); tests that tick the sample and expect Continue
  take it as renamed; the test server serves `.mjs`, `.wasm` and `.pdf` with their types.
- Version v313; cache `marker-studio-v313`.

# Changes — v314 (Ben's decisions D9 and D8)

The two ideas from fable's look that v313 left for later. New tests: `e2e/v314-page-photo` (6) and `v314-gradient`
(1), `test/v314-gradient` (3), each failing on v313.

- **A photo of the finished page** (D9; `src/js/guide/24-page-photo.js`): **Add a photo of your page** in Colour
  along's Page finished panel, on Home's latest piece (until added, or put away with ✕ for that guide: `ms-finx`) and
  in the guide's ⋯ menu (Change your photo, Remove your photo, which asks first). The photo is found and straightened
  by itself when the page finder is sure, as a coloured reference photo is; otherwise four corner handles over it
  (a magnifier by the finger, the arrow keys too), with Straighten, Keep as is and Cancel. It's kept on the device
  beside its guide (`fin-<id>` in the guides' store: one JPEG, 1600 on its long side, about 0.3 MB), never uploaded.
  The panel shows it with Show beside the plan, Adjust corners (this visit) and Change. **Home's latest piece** shows
  it first, with **Your page | Plan** over the picture's foot (remembered for the guide: `ms-fin-view`); Library tiles
  keep the plan. **Reveal's end** has **With my page**: the plan beside the photo in Reveal's frame (side by side
  for a tall page, one over the other for a wide one), with Share. It's in the Library's backup (and counts as a
  change for the backup reminder until backed up), not in a guide file; restoring puts it back, for the guide here or
  one deleted. Deleting the guide deletes it once Undo has gone; Put back brings it back; Save a copy doesn't copy
  it; Reset progress keeps it, and says so. A new Lucide icon, camera (33 now).
- **Gradients on pages with a few huge sections** (D8): a guide made since v314 (`gradArea`, saved only when 1) laid
  as a Gradient in Polished or Natural shares its run of markers out by each section's area to the power 0.7, not
  its plain area, so one huge section no longer takes most of the run. Measured on 21 pages × 3 collections × 5
  shapes × 3 counts: clashing borders 10.7% → 10.3%, markers left as a speck (under 1% of the page) 1.7 → 1.0 a
  plan, about two plans better for each one worse; Ben's pages unchanged. Textured, Sparkle and Confetti keep the
  plain rule (more plans were worse there), and so does every guide saved before.
- Version v314; cache `marker-studio-v314`.

# Changes — v314.1 (fable's fresh-eyes review of v314)

Five independent reviews by fable (engineering, function, pressure test, UI, a new tester and the words), each
finding checked before it was brought to Ben, who chose to fix the clear ones now. New: `e2e/v3141` (9), each failing
on v314.

- **A photo record is checked whole** (data safety): a backup's photo of a finished page went into the page as an
  image's address after only its start was checked, so an edited backup file could run code when restored. The whole
  record must now be base64, as a plan's thumbnail must, and it's escaped where it's written into the page.
- **PDF page chooser**: a PDF of more than about 20 pages squashed every page's picture to a white strip; the pictures
  keep their size and the list scrolls (v313).
- **Reveal's end on a phone**: with With my page the end's buttons wrap to two rows, which covered the title and the
  marker codes; the piece and its caption are laid out again above the bar once they've lifted (v314).
- **Home's latest piece** (mocked first): Your page | Plan no longer resizes the picture and moves the card. The box
  keeps one shape for both, a straightened photo's (the plan on paper of that shape), else the page's (a photo kept as
  taken sits inside it), and the Library row keeps that shape (`fa`) so the box doesn't change when the photo comes.
  The switch and the Add photo pill sit centred on the picture's foot on an iPad (they hung off its bottom); on a page
  narrower than the pill, Add photo drops its camera, then sits under the picture.
- **The photo's corners**: when the page wasn't found, Keep as is is the main button and has the keyboard (a
  Straighten of the starting corners trimmed the photo and called it straightened), as the guide's own corners have
  since v313. The magnifier sits beside the top corners (it was under the finger). On a phone the three buttons are
  full width; the crossed-corners line keeps its room; the margin round the photo is the dialog's colour.
- **Focus mode**: Undo of Mark all closes the hand-off card, which went on saying the marker was finished. A marker
  with one section says "coloured ✓", not "all 1 coloured", there and in a zone's heading.
- **"Last coloured N days ago"** moved to now whenever a started guide was opened in Colour along; it moves only when
  the ticks change (v313).
- **Swap it** says which marker took the low one's place, with Undo ("Swapped R413 for R412 in 17 sections, pinned");
  the line under the tabs lost its stray "·", and Swap it and ✕ stay on its right on a phone.
- **Page finished panel**: the photo's thumbnail shows the whole page and opens the plan-and-page card; its links are
  44 px tall.
- Home's latest piece is drawn afresh after a restore (a photo put back for an unchanged guide didn't show until
  something else changed). The corner editor's canvas is freed when it closes.
- Correction to v314's notes: the stored photo is the straightened page as found in a copy of the photo 1600 on its
  long side, so usually 700–1000 px on its long side and 60–240 KB; and D8 on fable's 14 downloaded pages (420 plans)
  gave markers on specks 1.47 → 0.92 a plan but rough borders better in 195 plans and worse in 140, not two to one.
- Version v314.1; cache `marker-studio-v314.1`.

# Changes — v315

Ben's decisions after fable's reviews of v314.1 and its pressure tests of each plan, mocked first where it shows (the
card, the hand-off card, the specks line). New e2e files: `v315` (5), `v315-fixes` (4), `v315-gradient` (1),
`v315-specks` (1), `v315-card` (3), `v315-focus` (2); unit: `v315-family` (3), `v315-gradient` (5); each test fails on
v314.1.

- **A finished page on a light table is found** (Q3): a coloured page on a grey or light wood table had never been
  found in a photo of the finished page (the drawing's colours made a third mode in the paper view, so the whole photo
  passed as paper). The finder splits again for a finished page when the first split leaves nearly everything above
  it, kept only where the brightness has a clear valley. 531 made-up photos: found on tables up to 75% of the paper's
  brightness, nothing lost. Guide building's finder is unchanged.
- **A photo taken sideways or upside down is kept the right way up** (Q4), by comparing the drawing in it with the
  plan at the four quarter turns; the panel's **Turn** turns it by hand. The page takes the paper Print uses when it
  measures within 6% of it.
- **Adjust corners** (Q9) on the toast after a photo is straightened by itself, from Colour along or Home. On a
  **patterned cloth** a page found by itself has its corners shown to check (the table's flicker round the page: plain
  and wood 0.3–3.2, real photos 1.5–2.8, check cloths 15.6–22.6; threshold 10).
- **The plan-and-your-page card** (Q7) stays 1080 × 1350 and lays the two side by side or one over the other,
  whichever shows both pictures bigger (it was side by side only for a tall plan, so a wide plan over a tall photo, or a
  tall plan beside a panorama, were both small). THE PLAN and MY PAGE are at least 2% of its width. On a phone held
  sideways its dialog's Share stays on the screen.
- **Focus mode's hand-off card** (Q8) goes above, below, left or right of the next marker's sections, wherever it
  covers least of them, then lets them be biggest, then hides least of the picture, keeping its side unless another
  is clearly better. While it's up the picture is centred in the room it leaves; it never covers the zoom buttons or
  the bars; it's compact on short screens, placed again when the screen turns, and closes as the Colours sheet opens.
  On a phone held sideways it had covered most of the picture and the zoom buttons.
- **The Gradient's v315 rule** (Q5, Q11; new guides only, `gradArea` 2): the plain area split unless a marker would
  land only on specks (under 0.3% of the page), then softer and softer (area^0.85, 0.7, 0.55) until none does; a
  section you pinned that is bigger than one marker's share counts for nothing, so the others spread over the rest
  (not a section kept because it's coloured); and no two markers in the run within 5 (CIEDE2000) of each other while one
  further off is near (Ben's 16: B111 and B112). Measured on 765 plans: markers only on specks 1.02 → 0.35 a plan
  (v314's 0.7: 0.53), border clashes as with the plain rule, 76% of plans exactly as plain; runs with a near-identical
  pair 240 → 48. v314's 0.7 for everything had spoilt the vase page and moved clashes about. Guides made in v314 (1) and
  before (0) lay exactly as before (all 765 plans identical); an older app reads a 2 as the plain rule.
- **Specks line** (Q11): the Pattern tab, last, names a Gradient's markers seen only on specks of the page or zone
  ("Y29 only colours specks of this page. Fewer markers would spread the colours further. Show them"); Show them rings
  their sections. Not when scattered, nor when every section has its own marker, nor for a marker only on sections you
  pinned; more than three, a count.
- **Copic's greys in families** (Q10g; new guides only, `famRule` 2): written with a hyphen (C-00 … C-10, N-, T-, W-),
  they had no family, so a grey's blend companions and shading were found by eye across the grey types (C-6's darker
  companion was V28). Full Copic set: 61 of 1,428 picks change, all within the grey's type; Ben's markers: 2.
- **Fixes** (Q10): a photo of the finished page changed in another tab, or by a restore, shows when the tab comes back;
  a restore's newer photo replaces an older one here; the photo's record is read as a guide opens (Put back always
  has it), decoded only when shown; a PDF that finished opening after another picture was chosen is let go, and its
  page canvas freed; offline before the PDF reader was ever stored, opening a PDF says it needs the internet once;
  PDF.js's version is checked to match in the app, the service worker and the vendor folder (`test/pwa`).
- **Wording** (Q6): Reveal's **Plan and your page**; ⋯ **Change the photo of your page** / **Remove the photo of your
  page**; Reset progress says the photo shows again once the page is finished; What's new v314 says where; the
  Library's "Your guides and palettes are kept here." and, empty, "Nothing yet. A guide saves itself here once it's
  built; a palette is kept with Save."; Home's **Page in a PDF? Open the PDF**; tester task 6 adds the photo; Help's
  glossary has **Your page**.
- **From fable's fresh-eyes review of v315**: the specks' rings now go when you leave the Pattern tab (they stayed on
  the picture) and come back with it; Turn keeps the day the photo was added (it said "Added today"), turns the photo
  as taken while it's to hand so turning round loses nothing to JPEG, and Adjust corners after a Turn keeps the turn
  (it re-oriented it). The browser tests close each test's pages when it ends: under WebKit each page holds 0.6–1 GB,
  and a long file ran an 8 GB machine out of memory (v3141's Swap it test then timed out); `e2e/helpers.mjs`.
- Version v315; cache `marker-studio-v315`.

# Changes — v316

Ben's interface decisions after fable's UI, bug and premium reviews of v315 and its pressure tests of each idea,
mocked first. New e2e files: `v316` (5), `v316-tobuy` (4); unit: `v316-blend` (2); each fails on v315.

- **Page finished!** is a dark raised card like the rest of the app (it was the one solid mint block): a green edge
  and a soft green-to-purple wash, a sparkle over a Fraunces title, the summary in grey, the photo of your page at
  96 px in a cream frame with a shadow, its four links as pill buttons (Show beside the plan tinted as the main one),
  Add a photo as a green-tinted button; the finish flash is a green ring. Text 4.5:1 or better on the card.
- **Save image's key** is drawn in the app's fonts (the title in Fraunces, the brand line and key in Hanken; they were
  Arial), with round swatches and a faint edge (Copic 0, B60 and G00 had vanished into the white), and the dot note in
  grey under the key rather than between the brand line and the key. The fonts are loaded before it's drawn.
- **Markers' families run lightest first** (R16, R28, R38 … R514; by code they jumped R013 R014 R015 R16 R210).
  **Order** (Lightest first | Code order) shows in Owned, Unowned and All; Unowned keeps its three rankings after them.
  The options are rebuilt for each view, not hidden: iPad Safari's picker shows hidden options. A Code order saved
  before v316 (it was the only order) becomes Lightest first once (`ordLight1`); Code order chosen after that stays.
- **The ⋯ menus** (the guide's, Markers' and the Library's) have a line icon before each item, in grey. Three more
  Lucide icons (circle-help, message-square, square-minus): 36 credited in LICENSE, the icon licence file and
  index.html's notice.
- **The Gradient's sliders match**: Start colour's thumb is a hollow ring riding on its colour strip (it was a native
  slider on its own track under the strip), and Scatter's is the same ring on a thin grey line. Keyboard focus: an
  accent ring round the thumb.
- **One picked tint** (`--pick-bg`, `--pick-edge`): every chosen option uses the same teal, now as tokens; Codes and
  Greyscale, an open marker row and Balance's choice had used done's green or a grey, and Mood's ✓ is in ink. Green
  (`--ok`) is for done.
- **An upright iPad's Plan starts a narrow picture at its 50% floor** (the sample, a bookmark: narrower than 55% of the
  column at 60%), the size it shrinks to anyway, so each tab's first row is on the first screen (Mood's pictures were
  below the bar). A page-shaped picture keeps 60%; Colour along keeps 60% (at 50% the sample lost 12 of 91 codes).
- **Colour along's first marker row is on an upright iPad's first screen**, for any page: the find line takes no room
  while empty (24 px gone) and the first-time tip's **More** ends its sentence.
- **Polish**: Owned has no "Your collection." line and **+ Add markers** is an outline button like its neighbours; the
  app's chevron on drop-downs (Order, the Library's sort, the guide's Saved palette, Harmony and tone); a new user's Home
  on a wide screen has three numbered steps of how it works under the cards, until the first guide is made; Home's Add
  photo and its ✕ are a pill and a round button apart (they had read as a switch).
- **Blend companions closer to the colour** (new guides only, `famRule` 3): one from outside the marker's family is no
  more than 20 lighter or darker, as a family member may be, and a darker one keeps 35% of the colour's chroma.
  Before, the nearest by eye could be any distance away (Copic E29's lighter was YR07, 34 lighter; black's the pale
  grey C-3) and a red's darker a near grey (Ohuhu E515 Black Brown for R514 and R215). Over 11 collections (Honolulu
  24–216, Ciao 12/36/72, Ben's, all Ohuhu, all Copic) 79 of 3,540 picks change: 66 from a far-off marker you own to one
  to buy, 5 to none (V09 has nothing darker that keeps its colour); Ben's markers: 2. A guide saved before keeps its
  picks; an older app reads a 3 as 0.
- **To buy › From your guides**: after your list and Copy list, above Brands I'd buy, the markers your saved guides'
  blend plans would ask you to buy (the plan's "To complete every blend, add …"), across the Library without opening
  a guide, ranked by how many guides want each, with the reason ("Darker than B115 · 2 of your 4 guides"), and
  markers your guides use that are marked dry. + adds one with the plan's reason ("blend for B115"); Add all adds the
  rest. Eight rows, then Show all. With every blend complete it says so. 16 guides in 3–10 ms, 50 in 16 ms on WebKit.
  Each Library row now keeps its guide's family rule (`fr`); a row saved before v316 is read with v315's rule until the
  guide is saved again. Brands I'd buy says the card follows it.
- **From fable's fresh-eyes review of v316**: From your guides now asks for what each guide's plan does when a
  marker it was planned with isn't yours any more (its sections show the nearest of yours, a stand-in, and the plan
  asks for the stand-in's companions: the card had left those markers out, and could say every blend was complete);
  "both your guides" for two; Show all is 44 px tall; Save image's brand line sits clear of the title's descenders and
  the dot note is #777 (4.5:1); Markers' Order keeps one width in every view. New e2e test: the card against the open
  guide's own plan, with a smaller set (`v316-tobuy`, 4).
- Version v316; cache `marker-studio-v316`.

# Changes — v317

Scan on Android, and a whole tray at once on any device; built from fable's pressure-tested version. New e2e file:
`v317-scan` (4); unit: `v317-scan` (3).

- **Android's steps** (on an Android user agent): Scan's three boxes say Gboard's way — Tap the box (✓ after a typed
  code), Gboard › Scan text ("With Gboard (free on Google Play): open its tools (the four squares, left of its
  toolbar) and tap Scan text"), Snap, then Insert (← for the next cap). Before, Android showed the iPhone's AutoFill ›
  Scan Text, which it doesn't have. Samsung Keyboard's Extract text went in One UI 8.5. The iPad's and iPhone's steps
  are unchanged.
- **Android's box**: text arriving two or more characters at once (Gboard's Insert, committed or as a composition after
  its key 229, voice typing, a clipboard chip) is read after it holds still, without ✓; Chrome's re-sending of the same
  text as a composition ends no longer cancels the read. Typing a letter at a time, a correction or a suggestion tapped
  still wait for ✓. Text read during a composition the keyboard leaves in the box goes when the composition ends.
  Copic's two-character codes (W1, N1) count. How Gboard's Scan text puts its text in isn't documented: every way
  passes, and Copy diagnostics shows which one a tester's phone used. iPad: Scan Text's sequences (iPadOS 27's
  compositions included) give the same box, list, card and trace as v316, in Chromium and WebKit.
- **A whole tray at once** (every device): a line in Scan and a new Help section, **Adding markers by code** — copy the
  text from a photo of the caps (Live Text in Photos on an iPad or iPhone; Google Lens on Android, then long-press the
  box › Paste) and paste it; each line is read.
- **A pasted list is quieter**: a line with only a colour name that a code in the same paste accounts for ("E75" then
  "Light Rose Taupe"; "CG17 Cool Grey" then "Grey") is no question, and a name on the line after a code both brands
  use settles it ("B04" then "Tahitian Blue" is Copic's); lines of plain words beside codes aren't counted as not read.
  On text read from tray photos: 21 codes as before, 8 name questions → 0, "51 lines not read" → 11. Lists of names
  alone, codes alone or codes with names on one line read as before.
- Version v317; cache `marker-studio-v317`.

# Changes — v318

Read photos of your caps, and three quicker ways to add markers. New e2e files: `v318` (2), `v318-scan` (4),
`v318-ocr` (8); unit: `v318-sets` (4), `v318-ocr` (9).

- **Read photos of your caps** (Scan, under the steps; not in Find my set): photograph each tray from above, choose one
  photo or all of them, and the codes they read join Scan's list as they're read, over the photo green boxes for what's added and amber for what's to check.
  The reader runs on the device, in a worker: ONNX Runtime Web 1.30 (one thread) and PaddleOCR's models (PP-OCRv3
  detection, PP-OCRv6 tiny recognition, the text-direction classifier) in `vendor/ocr/1`, about 22 MB, downloaded once
  after a consent card ("your photos never leave it"), each file's size and SHA-256 checked, into a cache of its own
  (`marker-studio-ocr-1`) that the service worker and new releases leave alone. A cut-off download keeps what came and
  finishes on a second try; offline, the card says it needs the internet the first time. The worker ends as Scan
  closes, or as the page is hidden while it's idle, so its memory goes.
- **Where it's offered**: **Photograph your caps** first among the welcome's ways to add markers one by one, and after
  Add a set in Markers' Add markers (the sheet, and the card on an empty Markers), opening Scan straight on to the
  reader, in the same tap and without the keyboard; the welcome's "I bought them one by one" and "I have extra markers"
  name it, as does the tester task Add your markers and TESTERS.md. Only where the reader runs (Safari 16.4 or later);
  elsewhere everything reads as in v317.
- **Several photos at once** (a pressure test's suggestion, from Ben's question): chosen together, they're read in turn
  in the same view — "Photo 3 of 19 · Reading the caps…", one bar over them all, the worker kept between photos and
  each photo's pixels let go of once it's read. Scan's list already holds each marker once, so a cap in two photos is
  in it once, and a later photo answers an earlier one's question. At the end, one summary and a line per photo;
  **Undo these photos**; **Read more photos**. Stop ends the batch after what's read so far. A photo that can't be read
  is counted and skipped; a reader that can't start ends the batch, said. All 27 of Ben's close-ups in one batch:
  471 of his 471 markers, nothing wrong added, no questions (Chromium, the iPad's path; 470 and one question, Y210
  whose name read "Yelliow", on a desktop's).
- **How it reads**: the photo at 1600 px (iPhone and iPad in four strips overlapping by more than a code is long, so a
  code across a cut is whole in one; 1280 px after running out of memory once, read again gently by itself); tall boxes
  looked at again closer, and a squarish one that didn't come apart again closer still, turned a quarter (lines merged
  at an angle); each code's name paired with it, and again once read, a word just under or over a code; then a second look, the
  photo turned a quarter, at only what the first didn't read (always: on wide trays it finds about 11 more of 334;
  accuracy before time, as adding a collection is done once). A lone character is kept only when a name is paired with
  it. The worker lets its messages in every 60 ms of reading, so Stop lands within a fraction of a second, not at the
  end of a look (a minute on an iPad).
- **How it settles**: a code read for sure, of one marker, joins the list as it's read when a brand is chosen above
  the box or it's of the brand the photo's codes plainly show (five or more, four to one); the rest wait for the end of
  the photo and are read as a pasted list, each code with its names on one line, with the photo's brand. On a tray
  plainly of one brand, another brand's code read short (E71 beside E711) or unsure is left out, not asked about. So is
  one read short at its start (Y13 beside BGY13), and another brand's marker offered only by its name; a code both
  brands have is never another brand's (E81 beside E814). The same cap read twice is one line, with the names of both.
  A question every answer of which a later photo has put in the list goes (back with Undo). An
  old code that's now another marker's (R16) is settled by a name read with it. With a brand chosen above the box and a
  photo plainly of the other brand, its codes go in as the photo's brand, said, not as the chosen brand's or as dozens
  of questions. The photo's lines aren't read as if upside down (the reader tried both ways up already: a scrap of a
  line, "001", had become Ohuhu 100). Boxes are green for every code added, at once or at the end, each with its code
  over it where the photo's shown 500 px wide or more (an iPad held upright: the card widens to 760 px for the photo).
  **Undo this photo** takes out what it
  added; **Read another photo**; **Done** says on Scan's card how many came from the photo, the keyboard's place on
  Add (no keyboard over the list). On Ben's photos (Chromium; the iPad's path in brackets): Copic 137 of 137; Ohuhu
  close-ups 333 (334) of 334, the last a question, 2 (1) questions in all; wide Ohuhu trays 332 (331) of 334; nothing
  wrong added. A real iPad's speed and memory are untested: the device checklist's first lines. Measured memory
  (WebAssembly's, which never shrinks): about 180 MB on the iPad's path, 125 MB read gently; the page's peak in
  Chromium on the iPad's path 513–535 MB in four strips (576 in two, 720 in one).
- **When things go wrong**: out of memory, the photo is read again gently, and later photos are read gently for a
  fortnight. A stored reader that won't start has its files checked again; a damaged or missing one is let go of, and
  Read another photo downloads only it (not the whole reader, which offline couldn't come back). Photo numbers go on
  across Scan's openings, so Undo never takes out another photo's codes. Scan closed mid-read isn't taken for running
  out of memory. Screen readers hear each stage once, not the count as it climbs, from a live region kept across a
  batch's photos; focus stays on Stop or Cancel.
- **A set's name in pasted text** (its box, an order email, a shop's page): Scan offers its markers, asked first, a
  button for each set named; a name that doesn't say which (Ciao 36) lists its sets under a heading by what tells them
  apart. A set's size (a box's "120 COLORS") isn't read as a code, nor a price, an order number or a quantity. Find my
  set goes straight to the set named. A set's Colorless Blender is said apart when the list is added.
- **Open a list file** (.csv, .txt, .tsv), under Scan's steps: read as a paste. The line under the steps says so, in
  Android's and Find mode's own words.
- **Some are missing**: after adding a set on the welcome, a card opens the chart with its markers ticked, to untick the
  few lost or used up. The toast's Undo of a later addition puts back what Anything else? said.
- Help: **Adding markers by code** has the photo reader, set names and list files; About credits ONNX Runtime and
  PaddleOCR. `LICENSE` and `vendor/ocr/README.md` list the reader's files, sources and licences.
- Version v318; cache `marker-studio-v318`.

# Changes — v318.1 (a deep review of v318: three waves of fresh-eyes reviewers, an audit, and Ben's decisions)

Five reviewers' fixes after v318, then an audit of them, a second and a third wave (the guide end to end, the
proposals pressure-tested and prototyped), and Ben's twenty decisions (the last part of this section). The photo
reader's first fixes are folded into v318's section above (four strips, the closer second zoom, names paired once
read, the settling rules, labels, no keyboard after Done). Version v318.1; cache `marker-studio-v318.1`. New e2e
files: `v318-review-ux` (7), `v318-data` (11); unit: `v318-release` (3); more tests in `v318-scan`, `v318-sets`,
`v318-ocr`; and those listed below.

- **Scan** (v318.1): Find my set with a set's name typed but no Enter, and markers already on Scan's list, no longer
  ends in "Something went wrong". A tray's text with HONOLULU on the case and Ohuhu's Black cap (120) on lines of their
  own reads 120 as a code, not as Honolulu 120; "Honolulu B 120 Colors" is Honolulu 120. A question's answer that's a
  marker by its old code says so ("RV18 Bubblegum · Ohuhu · was R14", the old code with plain letters, CGII00), or
  "upside down".
- **Escape** leaves Crop and Adjust corners in Check the sections as their Cancel does, as it leaves the zone editor;
  only while the Guide screen shows (left open there, an Escape on Markers closes Markers' ⋯ menu, not the crop).
- **The browser's Back in the first-run welcome** (an iPad's swipe from the edge in a Safari tab, Android's Back) goes
  back a step, as its Back link does, instead of leaving the app; on its first step it still leaves.
- **Colour along**: with a marker's row open, a tap on a faded section (another marker's) asks first: see Ben's
  decisions below (it had ticked it unseen; a first fix ticked it and said so, with Undo).
- **Tester tasks**: Send results with nothing answered says so and sends nothing (it sent six "not yet"s). The answers
  go in a backup and come back with it (moving from a Safari tab to the Home Screen app had left them, and the tester's
  id, behind): all of them on a device with none, else only those not answered there.
- **Send feedback** and Help › Your data say all that's sent: the device and screen size, the version, how many markers,
  guides and palettes, a tester number made on this device (not your name) and the last few errors.
- **A guide that can't be read for want of memory** (Safari's canvas limit) isn't called damaged: "this device is short
  of memory. Your guide is still saved". Importing one, adding a lost guide back and restoring one say memory too, not
  "couldn't be read"; the lost guide is offered again. A restore over a guide called damaged keeps its stored copy as
  "… (before restore)" when that copy differs and is whole.
- **The browser's storage not answering**: a Library guide it doesn't give back says to reload, not that its stored
  copy is missing (which sent people to an older backup); an open of the database that never answers is given up after
  8 s, so a save says so instead of "Saving…" for good.
- **Back up** says a Library guide that isn't stored on this device at all by name, with what to do, apart from one it
  couldn't read; it no longer keeps Home's reminder due for good.
- A backup reminder's **Later**, or the install card's **Not now**, given while the device's clock was ahead rests a
  week, not until the clock catches up.
- On a phone, a PDF or photo that won't open from the Guide screen's start card has its message brought into view.
- **Random**'s Main colour places its accents in n log n: 29,000 sections 3.4 s → 0.75 s in Chrome. The style golden's
  three Random guides take other markers (Random isn't repeatable; no saved guide changes).
- Tests: the service worker's caches are checked against the version and the reader's folder (`v318-release`).
- **CI: a crash is named.** v318's and v318.1's GitHub runs each had one flaky WebKit test (`v310-moodpics`, then
  `v318-review-guide`), both "Target page, context or browser has been closed", both passing on the retry. Killing
  WebKit's page process mid-test gives exactly that error, so these were the browser's page process ending, not the
  tests (memory isn't short here: about 0.9 GB a page). A test whose page crashes is now noted in the CI record with the
  free memory then (`e2e/helpers.mjs`), and the run's summary and warning say "the browser's page process crashed, not
  the test" (`e2e/ci-summary.mjs`; unit: `ci-summary`, 2).

**The guide, checked end to end** (a second wave: Undo and Redo after some 60 changes, Library round-trips and every
count were exact; these were not):

- **Page finished's Add a photo of your page** is there on the tick that first saves a guide (the sample, finished in
  Colour along, had none until Colour along was left and opened again).
- **A finger's tap on the picture may drift 10 px** (a pencil's 6, a mouse's 4 as before): a tap that rolled 3 px across
  and 2 down had ticked nothing. Panning starts without a jump.
- **A wide picture prints on its side**: page 1 turns landscape when that prints the picture at least 10% bigger each
  way (a 4:3 picture had printed across the top half of an upright page); close-ups and the key stay upright, and the
  Print sheet's summary says "page 1 landscape". On an iPhone or iPad its button says **Print or save PDF** (the share
  sheet has Print in it).
- **Ticking is quicker on a big page**: a tick with a marker's row open redraws its outline only round the section
  ticked, and the tool row isn't fitted again unless something it depends on changed (839 sections: 606 → 163 ms over
  6 ticks in Chrome); a save no longer reads the whole section map twice (about 100 ms 1.5 s after every tick).
- **"Detecting sections…", "Building…" and "Straightening…"** are drawn before the work they name (they never showed:
  the work started in the same frame).
- **The Photo pattern**: the photo dragged and the Plan left within half a second finishes its colours and keeps the
  "Photo moved" Undo step; its lighting correction is saved as found (guides saved before open as before).
- **Saving**: a reload just as a new guide appears keeps it (the waiting save starts as the page goes, and the database
  writes are committed at once); a guide whose Resume note can't be written (storage full to the last byte) says so,
  once; why a stored copy couldn't be read is kept per guide (a thumbnail's load at the same time had reset it); a
  restore keeps a guide called damaged aside as "… (before restore)" only if that copy is whole, and says when Tester
  tasks answers came back. A screen reader hears "Page finished." before "Saved in your Library…".
- **Edit sections** is the one name for the section tools (the quick check had said Fix sections, its step Check the
  sections). **Smooth them** says how many markers it adds before the tap ("Smooth them (+1 marker)"). **Save image**
  with codes, for a narrow picture (the sample), is saved up to twice its size, so its codes are sharp.
- **Tap areas** of 44 px where the layout has room: Pattern's + Zone, the checkboxes on lines of their own (Codes on the
  saved image), Markers' Swatch chart ↓ (no longer under Add markers' bottom 12 px), Palette's colour counts (44 px wide
  on an iPad; on a phone 34 px, their tap areas meeting).

**Adding markers** (a third wave, each proposal prototyped and measured):

- **Some are missing** opens the chart on your markers only, titled "Untick any you've lost"; one unticked stays where
  it was, faded; **None are missing** closes it, **Show all colours** gives every colour back.
- **Scan the caps** says iPad or iPhone, and Gboard's Scan text on Android; the privacy lines (welcome, Help › About,
  README) say the camera is used to scan or photograph caps, and photos of caps are read on this device.
- **A set's name** found in Scan is a question in plain words: "Found a set: Ohuhu Honolulu 120 · Add all 120 of its
  markers to the list?". Copic Ciao 72 Set A and Set B is both sets. Read quietly by Scan Text (HONOLULU 120 on a box),
  it's the set's card with its size offered as a cap, not Ohuhu's 120 Black added unasked.
- **The photo reader has one name, Photograph your caps**, from its entry points to its sheet; its views open on their
  text (its own heading had stacked under the sheet's title on a phone). Its card widens to 760 px only when that shows
  the photo at least 500 px wide, for the code labels over the caps, and decides again as the screen turns. With the
  reader stored, its picker put away leaves you on the reader, not Scan's list. A batch stopped at its first photo says
  "No new codes read · stopped · the other 2 photos not read".
- **Scan's smaller fixes**: a brand tapped with nothing to answer says the brand now reading; Find mode says another
  brand's code, with no Add, and leaves it out of a list, said; focus after the toast's Open and Scan closed goes to Add
  markers or the welcome's step; a paste or list file over 200,000 characters is said, not read (a web page pasted froze
  it for seconds).

**The photo reader and data** (measured on Ben's photos on both paths, and on synthetic trays):

- **Read gently at 1600 px in four strips, never 1280 px**: at 1280 px it added wrong codes (6 on the Copic set) and
  saved no memory in Safari's engine; the photo itself is most of the peak. "Reading it again…" says the second try.
- **A part of a cap read as a code of its own is left out**: a box whose whole reading equals one half's drops a
  code-shaped other half; a code inside a longer code read in the same place is left out (or taken back out); a code
  added at once whose names are another marker's becomes Scan's question. Big photos are decoded straight to the
  2048 px read (`createImageBitmap`), where the browser applies the photo's rotation.
- **Delete all my data** also removes the reader's download (22 MB, no personal data); Help says so. Help › Your data
  says a private window deletes everything when it's closed. Back up & restore says the file holds the Tester tasks
  answers and name, and points to Share & print › Guide file to share one guide.

New e2e files: `v318-review-guide` (7), `v318-polish` (11), `v318-adding-2`, `-3`, `-8`, `-9`, `tap-areas`,
`rough-count`, `saved-image-size`, `v3181-backup-words`, `v3181-private`, `v3181-wipe`; unit: `v318-adding-9`,
`v3181-gentle`, `v3181-parts`.

**Ben's decisions** (each pressure-tested first; the options not taken are in the review's notes):

- **Colour along asks first.** With a marker's row open, a tap on another marker's section asks beside it: "YG611
  Mantis Green · not YG00", **Open YG611** or **Tick it** (**Untick it** when it's done, which had changed unseen). A
  second tap, Escape, scrolling or another row closes it; the zone is named when it's another. Nothing changes by a
  slip; the question goes as another guide opens.
- **Scan keeps what it read in view.** While the keyboard or Scan Text's camera is up (`visualViewport` shorter than
  the page by more than 150 px, the box focused), the paste line and the photo card are put away, and the steps too
  once the list has a marker, so the ✓ card and the count stay above the keyboard on an iPhone and a sideways iPad.
- **Back goes to Home first.** Guide, Markers and Palette are a Back step above Home (in a Safari tab or on Android
  Back had left the app); anything open on top closes first; Random goes back to Markers; Escape never changes tabs.
- **In the Plan, a toast sits over the foot of the picture**, not over the tabs and their controls (inside the
  picture's column on a sideways iPad; back in its old place if with very large text it would hide over half the
  picture). Surprise's says less: "Split complementary · Random: blues, with greens and a yellow accent · Bright · 16
  markers".
- **Larger text on a phone**: the Plan's pinned picture shrinks as the text grows (45% of the screen, 40% at 1.3×, 36%
  from 1.6×), so its controls have room (at 1.6×: 125 px of them on the first screen, from 55).
- **A Beta tester tasks card on Home** during the beta: "0/6 · Beta tester tasks · Next: 1 · Add your markers ›",
  "ready to send" once all six are answered, gone once sent.
- **Blend companions a clearer step away** (`famRule 4`, new guides only): a companion under 5 CIEDE2000 of its marker
  is swapped for a clearer one in its family, or within 10° of hue, where there is one; else it stays (none lost, none
  to buy that was owned). On Ben's markers 85 of 942 change (B111's darker B112 → B114).
- **Gradient smoothing keeps near-twins apart** (`gradArea 3`, new guides only): touching sections on markers under
  2.5 CIEDE2000 apart count as a clash (Ben's markers on the test pages: 1,025 → 468). The markers a run picks are as
  before.
- **The PDF's light labels under 6 pt are a darker grey** (#8a8a8a, from #a0a0a0), so the smallest can be read; the
  rest stay light, not to show through pale ink; close-ups' near-black labels as they were. A test print with pale
  markers decides whether it stays.
- **Key + reference is for colouring your own drawing**: with Codes or Numbers, page 1 is the picture in colour with
  near-black labels (as big as the page allows, its small sections in close-ups after it, as Page + key's), then the
  key; with Labels None, the one page of coloured reference beside the key as before (it had always printed that,
  Labels greyed out). Page + key keeps its light labels, to colour on. A line under What to print says what each choice
  prints; the Labels group is "Labels on the picture"; Darker labels is for Page + key only (Key + reference is always
  dark). Tests: `print` (Key + reference's picture, labels as Page + key's with Darker labels, in colour; the line under
  What to print), `tabs`, `v308-output` (one page with no labels).
- **Recently deleted**: a deleted guide, palette or drawing waits a week, through reloads, in Library › Recently
  deleted (N), with **Put back** (its progress and page photo too) and **Delete them now**; after the week it goes at
  the next start. The 6-second Undo stays.
- **Backup reminders count markers**: in a Safari tab, markers changed since the last backup bring the reminder after
  5 days away, as guides and palettes do.
- **Send feedback leaves out the Tester tasks name**; the tester number already links a note to the tester's results.
- Kept as they are after testing: no step bar, no words under the tool icons, no print previews (to look at again
  later), wide pictures printing on their side automatically, the reader's name check for a code read from part of a
  cap. For after the beta: the Library's thumbnails into IndexedDB (Safari's 5 MB localStorage holds about 220 guides
  once any name has a curly quote), and finding the page and sections in the worker (big photos hold the screen 2–3 s).

New e2e files: `back-tabs`, `v318-adding-1a`, `v3181-bin`, `v3181-markers-reminder`, `toast-spot`,
`large-text-frame`, `tasks-card`; unit: `v318-comp`, `v318-gradient-twins`.

# Changes — v318.2 (the photo reader adds no marker it can't stand behind)

A review of the reader's accuracy scored each photo against the caps actually in it, not against the whole collection.
Scored that way, v318.1 added 24 markers from other caps over 16 runs of Ben's photos (8 photo sets, each on the
desktop and the iPad path), shown as 0 before: a marker Ben owns counted as a hit wherever it came from. For a tester
with part of a set each is a marker added that they don't have. The rules below are settling only (the reader itself
is unchanged), each prototyped, measured and pressure-tested by a second reviewer. Over all 1,205 captured reads of the
real photos, each photo alone: markers added from another cap 531 → 60, caps found +272, questions 573 → 366. Over the 16
runs: 24 → 0, misses 19 → 15, questions 18 → 12. Version v318.2; cache `marker-studio-v318.2`. New unit tests:
`v3182-reader` (7).

- **Digits alone aren't bent into a code with letters** from a photo: "99" isn't G9 (Ohuhu's old code for G112), "63"
  isn't G3 (G311's): scraps of caps, 19 of the 24. Three digits or more are asked about ("808" read: is it this one?
  B08). Typed in Scan's box, as before.
- **A reading with letters that isn't the code as printed** (give or take O for 0, I, L or T for 1, S for 5, Z for 2)
  is asked about, not added: "W60g" had gone in as WG06, "Eg9" as E69. It no longer goes in at once either.
- **A photo plainly of the codes as they are now** (eight at least, an old code at most one in eight) drops a code
  that's only an old one ("GG1", a scrap of GG15, had added GG03), unless the name read with it is its marker's; a code
  that's one marker's now and another's old code is the one it is now ("Which Y210?" gone). A photo of an older set's
  caps, or of a mix, is read as before. Ben's decision: dropped rather than asked (a question about a scrap invites a
  wrong yes); once questions show the cap's photo they'll be asked.
- **R22 Ballet Pink** read "Pink Ballet", or "Pink" alone, had been added as RV17 Pink (R22 by its old code), in Ben's
  photos too: a name of two words or more read in any order is its marker's, a name that's only some of the words of
  another of the code's markers' names settles nothing (typed "R22 Pink" is asked about), and a cap's names are taken in
  reading order, the line nearest the code first.
- **A code read with a word of another marker's name and none of its own** is asked about ("B21" with "Sakura").
- **Questions that are noise go**: a name alone that's a word of two or more other names ("Grey"); another brand's
  code on a photo plainly of one brand that's the start or end of one of its codes (Copic BG11 by Ohuhu's BG114).
- **"Yellowish" isn't Copic Y06 Yellow**: YR20 Yellowish Shade read "Shade Yellowish" had been asked about against
  Y06, as had R30, Y23 and YG06 (and Copic Y21 Buttercup against Ohuhu Y06 Butter): a name found inside a longer word
  that's a word of another name doesn't count.
- Considered and left for v318.3, with the reasons in the review: the reader's second-choice readings, a cap whose name
  was read but not its code asked about, a crop of the cap beside each question, and fuzzy matching of misread names
  (only to choose between a code's own markers). Completing a code read short from its name: not done (it added wrong
  markers elsewhere and nothing in Ben's runs).

# Changes — v318.3 (released with v318.2: the reader finds more, and each question shows its cap)

Version v318.3; cache `marker-studio-v318.3`. Released together with v318.2 (above). New tests: unit `v3183-reader`
(3), e2e `v3183-crops` (2). Over the 1,205 captured reads of Ben's photos, each photo alone, from v318.1: markers added
from another cap 531 → 60, caps found +299; questions 573 → 580, each now with its cap's picture.

- **Each question from a photo shows the cap it's about**, cut from the photo while it's in memory and turned the way
  the reader read it, so it's the right way up (upside-down caps too), in place of the "?". A tap shows it larger
  over Scan, with the question; a tap, Escape or Back closes it, and focus goes back. The pictures are kept while Scan
  is open; after a reload a question still waiting shows "?" (they're not stored). On a synthetic tray a scrap read
  "R38 …nt Ochre", asked as R38 Rose Pink, shows a peach cap cut by the photo's edge: YR38 Burnt Ochre, plainly not.
- **On a photo of current codes, a code that's only an old one is asked about** with its picture (v318.2 left it out,
  as a question about a scrap invited a wrong yes): Ben's decision, once questions had pictures. About 5 more
  questions over the 16 runs.
- **A cap whose name was read but not its code is asked about** by its whole name ("Only its name was read"), never
  added unasked; not a name that's part of a longer one (Light Apricot of Light Apricot Pink), nor one word of five
  letters or one that's a word of another name ("Frost", "Grey"). In a whole session these are mostly caps that
  appear whole in another photo, so asked only when nothing else read them.
- **A line read as no code takes its next reading that is one**, read nearly as surely (at least 0.75, and 0.8 times
  the best): "61" → E19, "000A" → V000. The reader now sends every reading it tried, with its turn. Over the captured
  reads: +25 caps, no marker added from another cap.
- **A colour name misread by one letter** ("Yelliow", 5 letters or more, one name's word and no other's) chooses
  between a code's own markers only, from a photo: Y210 read with "Yelliow" is Y210 Pumpkin Yellow, not Y416 (once
  Y210). Typed text as before.

# Changes — v318.4 (a debugging pass on v318.2 and v318.3)

Two fresh-eyes reviewers, one on the settling rules and one on the questions' pictures, while v318.3's GitHub run
passed. Version v318.4; cache `marker-studio-v318.4`. New unit tests: `v3183-settle` (7); `v3183-crops` 2 → 5. The
replays of Ben's photos are unchanged (none of these cases is in them); each fix's test fails on v318.3.

- **Wrong markers added unasked** (now asked about):
  - With Copic chosen, Ohuhu's E711 read as it is had been taken as holding no code, so its next reading "E71" went in
    as Copic E71 (Ohuhu R014 as Copic R14). A next reading is taken in place of another brand's code only when it
    holds that code (Copic E51 read as Ohuhu E515 still works).
  - "C-3 Cool Gray No.5" (and the warm greys) went in as C-3: the any-order name rule had counted the code's own 3 as
    the name's number. A grey's number counts only after "No".
  - On a photo of current codes, "Y210" read with "Golden" (an old Golden Brown cap, now Y416) went in as Y210 Pumpkin
    Yellow: asked as the code and the name not matching, so Y210's own cap beside it doesn't drop the question.
- **Caps missed without a word** (now asked about):
  - With a brand chosen, a photo's one line left to settle (a cap's name alone, another brand's code) was shown as a
    card, and cards are muted while a photo settles: the photo's lines are always read as a list.
  - With Ohuhu chosen and no plain brand on the photo, Copic caps whose codes are the start or end of an Ohuhu code
    (63 of Copic's 358: E71, B41, G02, R00…) were left out as noise: only on a photo plainly of one brand now.
- **Questions**: one about a code read with another marker's whole name offers that marker too ("R29 Crimson", Copic
  RV29 read short, offers RV29); one about a code taken at once with another marker's name offers the photo's brand
  only.
- **The questions' pictures**: one about a code shows the cap read as that code first (G410's question had shown G24,
  read earlier); closing the larger view gives focus back to the picture tapped, not the box (on an iPad the keyboard
  came up); the larger view stays square with Close in view on a phone held sideways; each picture's canvases are let
  go at once (Safari counts them against its canvas memory).
- Left as they are (judgement calls, in the review's notes): a cap's name read in two lines with no code ("Pumpkin"
  over "Yellow") isn't asked about (joining them asked about 11 more true caps but 44 with no true answer); a name read
  alone can settle another line's code two markers answer to (usually the same cap's lines unpaired); pictures of caps
  cut by the photo's edge keep their black corner (moving the square into the photo centred a neighbour); with very
  many questions the list redraws more slowly (48 ms at 71 pictures in Safari's engine, fine at the usual 2–10).

# Changes — v318.5 (a second debugging pass: the v318.4 fixes, and the real reader run end to end)

Two more reviewers: one on v318.4's own fixes and how they meet, one driving the real reader (worker and models) end
to end on synthetic trays drawn or generated for the purpose, in Chromium and Safari's engine, at phone and iPad
widths, with a brand chosen or not, batches, Stop, Undo, Close and reload. Version v318.5; cache
`marker-studio-v318.5`. New tests: unit `v3184-settle` (5), e2e `v3184-flow` (8); each fails on v318.4. Over the
captured reads of Ben's photos, each photo alone, from v318.4: markers added from another cap 60 → 53, questions 580 →
411 (those with no right answer 241 → 116), caps found 81 fewer of 65,342 (cut by the photo's edge; in whole sessions
one, V414 in one run); on the synthetic photos, markers added from another cap 22 → 0 and no question without a right
answer. In whole sessions, with no brand, Ohuhu or Copic chosen: no marker added from another cap.

- **A cap cut by the photo's edge**, its code maybe read short ("/R312" of YR312 had gone in at once as R312; "G1
  Dusty", "G3", "Eg9", "R38 …nt Ochre" were asked about with no right answer): never taken at once, and left out
  unless a name read with it is one of its code's markers'; the next photo reads it whole. (Asking about these
  instead was measured: as many caps missed in whole sessions, and more questions.)
- **Another brand's cap with a code both brands have**, read with its name (Copic E81 "Ivory" with Ohuhu chosen; Ohuhu
  Y00, Y02, Y06 with Copic chosen): asked "Another brand than the one chosen", as Scan does typed. "RV29 Crimson" with
  Ohuhu chosen: asked as Copic's, sure or unsure (it had gone in as Ohuhu RV29 Plum Pink).
- **A cap read twice in one place** (by each look; nearly half the codes' lines on Ben's photos), its names beside one
  reading only: the twin without names goes with the reading asked about. It had kept the marker in, and the
  question, its answer then in the list, was dropped as answered: added unasked ("B21 Peacock", "C-3 Cool Gray
  No.5", "RV29 Crimson").
- **"Y210 Golden" read unsure** is asked about too, as read for sure (Y416 had gone in by its old code).
- **With a brand chosen, a photo of the other brand**: the questions it raised before the swap stay (one was lost, its
  cap missed).
- **Closing Scan, or a reload, mid-photo** takes that photo's unchecked adds back out, and they aren't stored while
  it's read (Copic R46, RV09 and B02 had stayed from an Ohuhu tray with Copic chosen).
- **A batch with a photo that won't open** no longer stops dead ("Cannot set properties of undefined"; Stop did
  nothing).
- **"R|ush"** (Blush, cut by the edge) is read as a word, not R1, Ohuhu's old code for R210.
- **The questions' pictures**: of the cap asked about, not one read the same that went in (12 replayed photos); a
  name read in either order finds its cap ("Shadow" then "Mauve"); a reading put right ("E1T: E11 or E17?") by that
  reading.
- **A batch's next photo** says "Photo 2 of 3" with its bar from the start, not "Opening the photo…" with an empty
  bar.
- Left for later, with the reviewers' notes: upside-down Copic greys ("8-N", "L-M") are still missed (Scan's own
  reading of turned dashes); another brand's code read with the chosen brand's whole name offers only the other brand;
  a name both brands use read alone with no brand chosen isn't asked about.

## v318.6

- **A question opened in the Library's first moments** (Restore's choices, as a backup's file was chosen just after
  the Library opened) lost the keyboard to the Library's Close a moment later, under the question, so Tab left it. A
  dialog no longer takes the keyboard back once another has opened over it. (A GitHub run failed on it, in Chromium
  and Safari's engine both; replayed and fixed, with a test.)

## v318.7

Adding markers, after four pressure tests of the plan and a debugging pass. Photo reader, measured on captured reads of
Ben's photos (each photo alone, held-out real): markers added from another cap 53 → 14, caps found 59,874 → 59,911,
questions with no right answer 111 → 70, with no brand, Ohuhu or Copic chosen; whole sessions 0 wrong adds.

- **The reader**: a code read unsure where another was read for sure is left out; a cut cap's whole name keeps it;
  readings asked about off a word, or digits off a code read in the same place, aren't; digits alone take the other
  look's code. Another brand's cap read whole with its name on a one-brand tray is asked about, not dropped. A photo
  whose reading failed takes back out what it added unchecked.
- **An old Ohuhu code that's a Copic code now** (R29, Y13, R20 …) with Ohuhu chosen is asked "Which R29?" with Ohuhu
  YR47 (was R29) first, not offered only as Copic R29. On photos, only a question that survives the photo's checks gains
  the Ohuhu marker.
- **A list read as its own brand**: a list purely of one brand's codes is read as that brand's (a Ciao 36 pasted with
  Ohuhu set for you had put 10 codes in as Ohuhu's); a line naming its brand is that brand's; a list of both brands asks
  the codes both have.
- **Sweeping another brand's caps** with the brand set for you: once the sweep plainly shows Copic (two caps read whole,
  three in a row, or a Copic photo or list), both brands are read, codes both have are asked, and a row at the top of
  the list offers **Keep Ohuhu**. A cap that could be an Ohuhu code read short or misread is a card, never evidence.
- **A tray photographed again**: its caps already in the list, read for sure, are green and counted ("· 69 already in
  the list").
- **After answering a question** the keyboard's place follows the keyboard: up for a Scan Text sweep, down after a
  photo (focus on the next question). **The larger view** of a cap answers its question (its answers, Not this cap, Not
  now), closing only on the picture, outside, Escape or Back.
- **Question pictures** are kept in their own small database until answered (60 at most), so a reload or reopening
  shows them; Delete all my data deletes it.
- **Questions waiting**: Add markers says "2 questions still to answer · Answer them"; a question whose answers are all
  yours is dropped (Undo after Add brings it back). **Per-photo headings** in the list, kept through a reload.
- **Which markers of a set weren't read**: when nearly all of a set is here, "Honolulu 120: all but 2 are here — B64
  and G1. Not read, or not yours?" with Add these 2 (to the list) and I don't have them; after a sweep, in Add's toast
  with Open. Never adds by itself; blenders never counted missing.
- **Fixes**: the Plan's bar kept across equal redraws, so a click isn't lost; scanRead three times faster on long lines again; Colour along's code box stays above
  the iPad keyboard (Safari's scroll-padding).

## v318.8

No change to what the app does. The code for adding markers was reorganised so the next changes to the reader and the
brand rules are safer to make and review: `src/js/scan.js` (3,658 lines) is now ten files in `src/js/scan/` in the same
order, and every brand and name rule, including those the photo reader shares, is in `src/js/scan/60-brands.js`
(`photo-read.js` 2,027 → 1,904 lines). Proved before release: the first step's shipped script minifies to the same
sha256 as v318.7's; the second's matches v318.7's function for function and in the order of everything that runs at
load (`scripts/move-check.mjs`, new; docs/CODE-TOOLS.md, "Moving code"). The photo replays give byte-identical results.

- Tests: the pictures' test holds the database with a request of its own (it didn't hold in WebKit on GitHub); a Plan
  height test waits for the picture to settle; the cap-picture test reads a picture back once more, a frame later,
  when a colour reads as neither (once in some hundreds, in WebKit), and says the pixels if it still does.


## v318.9

**Photographing your caps reads small codes closer.** A photo is read from a 2048-px copy as before; when the first
detection finds its codes small (line height under 25 px, a whole bag or a Copic case) and the photo is bigger than
2560 px, it is read again from a copy up to 4096 px with the detector at 3200 in 16 strips. On the maintainer's 42 new
photos (by scene; HELD = not tuned on): Ohuhu HELD 69.9% → 93.2% of legible caps, TUNE 58.5% → 75.9%; Copic HELD
84.8% → 87.8%, TUNE 73.9% → 85.8%; wrong 23 → 19 (read off another cap 20 → 12). The 39 earlier photos read exactly as
before. Such photos take about twice as long (a Copic case three to four times); the page's peak in Safari's engine is
22–35% higher on them. The measurements, the options and what was dropped: docs/READER-DETAIL.md.

- **A closer read that never finished** (the page ended, an iPad short of memory) makes the next photos read gently for
  a fortnight, said once; a memory failure caught in it reads the 2048 copy again, gently. The re-decode after a memory
  failure now replaces the copy's size with its pixels.
- **A code read surely as a name**: a cap's two-word name is often a taller box than its code, and the code had ended
  as its name; swapped back as a zoomed box's lines already were (+11 caps on the new photos, the earlier photos
  unchanged).
- **The parts rule reads an O as a 0**: "VO15" read at a cap's edge beside BV015 had stayed in as V015.
- The photo's pixels are let go of once its questions' pictures are cut, not kept while the questions are answered.
- Tests: test/v3189-detail (the engine's early word, the code-as-name swap, the page's closer read, Stop, the memory
  fallback, the unfinished read); e2e/v3189-detail on drawn trays in Chromium and WebKit.

## v318.10

**Colouring fixes found by the guide benchmark** (`npm run bench:colour`: 9,880 builds on the benchmark's synthetic
pages, five collections, their true sections; scripts/bench/README.md). New guides only where a guide's look changes;
a saved guide lays as it did.

- **Gradient never picks near twins** (gradArea 4, new guides): when every marker near a run's next step is close to one
  already picked, it no longer takes one under TWIN_DE (2.5 CIEDE2000) of a picked marker while another is among them.
  Honolulu 120 at 32 markers had picked a near twin on 33 of 38 pages (YR111 beside YR112, 2.41), laid side by side;
  now 0. Pastel on Honolulu 320 and the large two-brand set had too: touching near twins 12–13 a page → 0. Rough
  share and the markers used are unchanged; a guide saved at gradArea 3 or before lays as it did.
- **No repeats lays the most-connected sections first**, and its last resort is the least used marker that isn't on a
  neighbour before one that is (it had taken the least used whatever its neighbours). On Ciao 12 and Honolulu 24, 24
  guides had touching sections sharing a marker; now 0. Every marker is still used once before any twice, except where
  the unused ones are all twins of a neighbour's (as since v304).
- **Balance lays hubs first** (a section touching at least 12 others and 3 times the median), the rest biggest first as
  before: touching pairs on one marker 15 → 9, all on Ciao 12, where Balance's plan uses 7 markers and a tessellation's
  sections touch 12–13 others; the rest unchanged (markers used 15.8 → 15.6 on the large sets).
- Tests: test/v31810-colouring (each fix on drawn pages that fail on v318.9); the gradArea checks take 4.

## v318.11

- **Shuffle always changes a Gradient** (gradArea 5, new guides). A Gradient whose markers run light to dark (a
  ramp, not a loop round the colour wheel: often Pastel, sometimes Deep or Muted) had only near-equal markers for
  Shuffle to swap, and when the run was all of the Mood's markers, none: Shuffle gave the same guide back (Pastel on
  Honolulu 120: no section changed in 4 Shuffles). Shuffle now also moves where each marker hands over to the next
  along the flow (by at least a fifth of a band each time; the run's order and markers stay): 25–61% of the sections
  change per Shuffle on the pages measured. A loop, the first build, a saved or handed-over palette, Scatter, and a
  guide saved before lay as they did; the colour benchmark's digest is unchanged. Surprise, which draws its own
  Shuffle seed, lays a light-to-dark Gradient with its handovers moved too.
- **A tip after a steep photo.** When the page finder is sure of a page whose far edge is much shorter than its near
  edge (under 0.67 of it; the maintainer's flat photos 0.92–0.99, his 45° ones 0.57–0.62), a note after it's
  straightened: hold the phone flatter. On the guide benchmark's printed set, such photos lost about half their
  sections. Reading the far end from the full-size photo was measured and doesn't help (+1 point), so there's no fix
  beyond the tip.
- **Tests:** the pictures' WebKit test (`e2e/v3187-pics`) runs its "storage fails" step in a session of its own, with
  a check that the failure was met (on GitHub's WebKit the second setup script wasn't in force on the reload);
  test/v31811-shuffle; the steep-angle note in e2e/straighten.
- **Benchmark:** photo registration finds slanted sheets (41 of Ben's 42 photos, from 30; a misread page fixed);
  `photos.mjs --decode N` and `--list`; sections under 2 mm across lost to a photo's thicker lines are scored apart
  (info), not as defects.
- **README for people using the app:** getting started, photographing a page, adding markers, your data, what it
  covers, feedback. Building, testing and the code's layout moved to docs/DEVELOPING.md (internal), as the licence
  doesn't allow reuse.

## v318.12

- **An edge-to-edge drawing keeps its edge shapes** (bgRule 1, new guides). The background rule took the regions
  with the most of the picture's edge as background, right for a page with a margin, but on a drawing that runs off
  the page (neurographic pages) those are its own edge shapes, a sixth to a quarter of the page. A picture whose lines
  run off its edge at 12 or more points, whose edge is mostly paper (ink at most 15% of a ring just inside it) and
  where no region holds over a fifth of the edge, now has no background by that rule; a margin, a drawn frame and the
  page found in a photo still are. Guide benchmark: on the 6 edge-to-edge pages every edge shape kept (bgDropped:edge
  from 7–11 a page to 0; matched 89–96% to 98–100%), straightened photos of them too (92–95% to 95–100%); no other
  page or photo changed. A guide saved before opens with its background as it was (bgRule 0, also in bgByEdge).
- **A sketchbook page photographed from above isn't sent to the corner handles** when the only outline the finder
  could find, and wasn't sure of, is the drawing's own (not the paper's): it's built as taken, with Straighten on its
  line. Ben's line-only sketchbook pages: 2 of 3 had opened the corner handles; now none. (His coloured pages still
  can: the finder takes a light patch of colour for paper. Coloured pages are a known limit.) No photo in the
  benchmark changes.
- **Photograph your caps: a Copic code's lost first letter** (G03 for YG03, R20 for YR20, V04 for BV04): a code that
  is a longer one's tail is read again with its box grown by a character at the end it starts, and the longer code
  taken when it reads surely, its first character a letter and the rest the same. Such codes wait for that read
  rather than going in at once. Not when the brand chosen is Ohuhu. Ben's 16 Copic photos: wrong 9 to 6, 5 more caps
  read; no right code made longer. His 26 Ohuhu photos read exactly as before, in the same time. Ohuhu's own lost
  letters (39 such pairs, G24 with three: BG24, CG24, GG24) are for later.
- **Measured and not built:** closing pen gaps of 2–4 px everywhere (a radius-1 closing fixed half the gaps on the
  gap pages but cost 5 times the defects elsewhere: tessellations, mosaics, fine botanicals); the marble counter
  (the finder takes the stone's light veins for paper; the corner handles cover it).

## v318.13

Taking a photo of a page, from the point of view of someone doing it.

- **Min section size in real size.** A new photo's Min section size starts at about 1 mm across on the page (taking
  the picture's long side as a Letter page's: (L / 279.4)² pixels in the picture as it came), shown beside the slider
  ("about 1 mm"). It had been 10 px whatever the photo's size, so on a 12-megapixel photo Sensitivity turned paper
  grain and pen texture into hundreds of specks: Ben's jellyfish drawing went from 255 to 759 sections across the
  Sensitivity range, now 227–241; his scribble page 127–142. Moving the slider keeps the choice for that picture; a
  small download keeps the old default (1 mm under 10 px); the sample keeps Min section size as it was (a clean
  drawing at its own size, 166 sections); a guide saved before opens with its own. Checked at 1 mm against Ben's note
  that some markers are thinner than 1.5 mm (1.5 mm had been tried first). Guide benchmark: clean pages' matched
  share unchanged (98.41%); photos as taken much better (table pieces gone: t02 from 1,349 sections counted to 158,
  t19 91% matched to 98%), one hard photo a little worse (h17 77.3% to 75.0%). Ben's printed set: as taken, mean
  matched 83.5% to 90.3%, spurious sections 8,417 to 1,389; straightened 90.0% to 90.8%, spurious 9,812 to 2,956.
  A photo with a lot of table round the page still takes 1 mm of the photo, not of the page (a little smaller), and
  so does a picture cropped by hand to part of a page (1 mm of the crop). The "looks hatched" warning still counts
  slivers against the live Min section size: on the printed set it now fires on the zentangle (hatched, rightly) and
  one tessellation photo as taken (told "noisy" before), on no other photo.
- **The coloured-page warning** counts specks at the size it was tuned at (the old default), whatever Min section size
  is: with the bigger minimum, a line page photographed on a wooden table, as taken, had been told it was coloured in.
- **A busy surface's corner handles.** When the finder isn't sure and the surface round its outline flickers (marble,
  a grained table: over 5), the corner handles start at the photo's own rectangle 3% in rather than at its outline:
  on Ben's 6 marble photos the outline was 17–30% of the diagonal off, the rectangle 5–7%. The good unsure finds sit
  on tables flickering 3.8–4.3. When the finder is sure, it still straightens by itself.
- **The steep-angle note** is in the sections' warning box now (last of the warnings, as the others say more), not a
  toast, and stays while the photo does.
- **Choose another photo** in the warning box for a photo chosen now (small, faint, dark, coloured, noisy, steep): the
  picker opened in the tap. The faint warning's tip says "raise Sensitivity" when Enhance is on (it is for a new
  photo), not "turn on Enhance".
- **Photo tips.** The first time a photo is chosen on a device (Home, the welcome, the Guide screen and its ⋯ menu,
  a palette's Use in a new guide), a card of five tips comes first: flat, right above, even light with no shadow or
  glare, the whole page in the frame, and the original photo (one sent by message can come back smaller). Its Choose
  a photo opens the picker in its own tap (iOS); its close, Escape, Back or the backdrop open nothing. Once seen it
  doesn't come back by itself; **Photo tips** on the Guide screen's start card shows it again. Not for a PDF, the
  sample or the Photo pattern's photo. Stored on the device (ms-photo-tips).
- **Measured and not built:** warnings for a blurred photo, a shadow across the page and a page cut off by the frame.
  None of Ben's photos is clearly bad in those ways (paper light ratio 0.75–0.92 on the printed set; the sketchbook
  photos' numbers are confounded by colour and table strips), so there was nothing to set them against without
  false alarms. Deliberately bad photos would let them be tuned. The coloured-page warning was checked: it fires on
  his 5 fully coloured sketchbook pages and on none of the line-only ones.
- **Tests:** test/v31813-photo; e2e/v31813-photo (the tips, in Chromium and WebKit); e2e/straighten's steep test now
  expects the warning box and its Choose another photo; e2e/paper-and-background's grainy page has 20 sections (a
  sliver of about 0.8 mm² where two circles cross is under the new minimum).

## v318.14

- **A big photo no longer freezes the screen** while its sections are found. Finding them (the picture turned,
  cropped and put in grey, the lines, the specks, the flood fill, then the background and the page) ran in one go:
  on a 12-megapixel photo of a page filling the frame, the page was held for 0.65 s in Chromium here and 1.1 s in
  WebKit (Safari's engine), 2–3 s on Ben's iPad. Now the same steps, the same code, run with a paint between each
  (segRun, 10-segment): the longest hold is about 0.2 s in both (finding the page in the photo, or clearing specks on
  a dense page). The steps work on a picture of their own, put in place in one go at the end, so until then the open
  guide is whole as it was; a newer change (another Sensitivity, another photo, a guide opened) takes over from an
  older one before it puts anything in place. Meanwhile the picture and its controls can't be used (inert; for a new
  photo they're out of sight until it's ready; see below for Sensitivity), and Undo, Redo and Build wait. Changing Sensitivity: 0.38 s to
  0.16 s held in Chromium, 0.34 s to 0.15 s in WebKit. The photo is also decoded away from the page first
  (img.decode). Sections exactly as before: the guide benchmark's digest is unchanged (ffb1af238d03), and a test
  checks the steps against segment() in one go after a photo and after Sensitivity changes.
- **Measured and not built:** moving the work into the background worker (Fable's pressure test: the steps give most
  of the gain with none of the worker's risks; the code is now split so it can move later, step by step, if the iPad
  still shows a hold), and the page finder and the straightening (about 0.17 s and 0.1 s, each already a step of its
  own).
- **Photograph your caps: Ohuhu's lost first letters** too (G24 for BG24, CG24 or GG24; YR25, RV08, BV18, YG36 and 34
  more): as v318.12 did for Copic, a code that is the tail of a longer one of the same brand is read again with its
  box grown at its start. Whose codes: the brand chosen, else the only brand you own, else both; a code waits to go
  in exactly when it's read again. Ben's 26 Ohuhu photos: 2 more caps read right (a YR015 and a YR215 that were missed before), no new wrong reads, no time added (measured on a quiet machine); his 16 Copic photos read exactly as before. A small gain: most of his Ohuhu caps' first letters were read already.
- **The colour benchmark's gates on GitHub** (part 1 of the Chromium job, after its browser tests): a guide is
  always built, laying it again gives the same guide, Random never puts one marker on two sections the app sees
  touching, "keep touching sections clearly different" leaves no touching pair too alike, and a Gradient makes no
  twins. A failure fails the run, listed on its page with each page's true section count, and keeps the report. The
  bench's pages are kept between runs, keyed on what draws them and finds their sections. About 2 minutes with the
  pages kept, 4.5 without, here.
- **"Find my set from 3 caps" in Markers** was already there (Markers › Add markers › "Not sure which set you have?
  Find it from 3 caps", since v311): nothing built.
- **Keyboard and the Sensitivity slider:** while the sections are found again for a new Sensitivity (or Enhance, or
  Ignore faint marks), only the picture waits: the slider keeps going, by drag or keys, each change taking over (from
  Fable's review). For a picture that changes (turned, cropped, straightened), the controls wait too, and the keyboard
  goes back where it was after.
- **Fixed:** e2e/v308-beta still looked for v318.13's old Help wording ("above the page"; now "right above the
  page"): v318.13's GitHub run will have shown it failing.
- **Tests:** e2e/v31814-steps (the steps against one go; a newer change taking over; Undo, Build and the picture
  waiting; another picture opened meanwhile), test/v31814-widen. The tests' geoSet and autoCrop run the steps in one
  go (segSync), as before, so they can read the picture straight after.

## v318.15

From a debugging pass of Ben's new uncoloured drawings and printed pages through the whole app, and three of the
colouring ideas (pressure-tested by me, then by Fable).

- **A new photo shows straight away.** Choosing a photo with a guide open left that guide's picture on screen,
  under "Detecting sections…", until the new one's sections were in place. Now the photo is drawn on the picture as
  soon as it's opened (photoPreview), and the work starts after a paint, so the first hold is split in two: the
  longest hold here is about 0.17 s in Chromium. The controls and Build stay out of sight until it's ready, as in
  v318.14.
- **Specks in the blank paper go.** Grain, dust and a printer's specks round a page were too big for the old speck
  filter and were drawn as the line, printed with the guide. A blob that touches only the paper round the drawing
  (or crumbs of paper it closes in) becomes paper when it's faint (as Ignore faint grey marks counts faint) and under
  3 mm² on the page, or when it's in the margin, outside the box round the drawing, lighter than the lines and under
  10 mm². On Ben's photos of printed pages: 9,555 and 35,951 px cleared; on his drawings, 20–61 px. A full stop, a
  signature's dot or a caption's letter as dark as the drawing stays, and so do dark marks on a page's frame or
  squares in the margin (six on one printed page). Only for a new picture or Detect again: saved guides keep their
  sections. The guide benchmark: matched sections, defects and warnings all as before; how much ink is found moves
  by at most 0.13% on 46 of 356 runs.
- **Binding or table at the edge? · Trim it.** A sketchbook page photographed as it is kept its spiral binding or a
  strip of table, which Auto crop kept as ink. For a photo as taken, not coloured in (under 5% colour), a dark grey
  or brownish band along an edge (up to 6% of the picture) is found as it's prepared, and a line above the sections
  offers to crop it off; Undo puts it back and offers it again. Only offered, never done for you: on Ben's coloured
  sketchbook pages the colour ran into the bands. On his three line-only drawings it's offered on all three; one
  trims cleanly and two leave part of the binding at the top, so it's a suggestion to check.
- **Light from › The edges** (Shading): each section darker along its lines and into its corners, lighter in its
  middle, as neurographic drawings are rounded; Roundness sets how far in the shadow reaches, Highlights and Shadows
  work as with the sun. Saved as "the sun" to an older copy of the app.
- **Shading › Style:** Soft, Dramatic, Rounded and Neurographic set the mode, the light and the chosen zone's
  Roundness, Highlights and Shadows in one tap, shown as chosen while they all still match. One Undo step. With
  Light from now always shown, the Shading tab on a phone is 138 px taller (589 px, about two screens of room under
  the tabs; the tabs test allows for it).
- **Radial › Rings › Follow the drawing** (Gradient's Flow): out from the section under the centre mark, a step at a time through the sections
  touching it, so the colours follow the drawing's own rings rather than circles; a section cut off from the others
  takes the step after its nearest. A choice under Radial (Circles, as before, or Follow the drawing) rather than a sixth Flow, which didn't fit on a phone's row; saved as its own flow, so an older copy opens it as Serpentine. Judged by eye: on Ben's pages it jumps more than Radial on some and follows the
  drawing better on others.
- **Matching shapes alike** (a tick box under Flow and in Random's options, on a page that looks like a mandala):
  each ring's matching shapes (the same size and the same roundness, set evenly round) take one marker: a pinned or
  coloured one's, else the one most of them got. Saved only when on. On Ben's photographed mandala page: 15 groups, each one marker with Radial and Around.
- **The colour benchmark** is unchanged with the new options off (digest c49afc53b9ae, all gates pass).
- **From Fable's review:** Matching shapes alike now updates each section's own pattern marker too, so Unpin brings
  back the ring's marker, not the one from before; if a new photo fails to process, the open picture is drawn again
  (it stayed frozen on the photo); and Trim it is offered only when Auto crop would then crop (a thin band on a
  drawing that fills the page gave "Nothing to trim"). Specks cleared can only ever take away the Ignore faint grey
  marks offer, not add it (the benchmark's doodles-and-text page was offered it).
- **Tests:** test/v31815-specks, test/v31815-shading-flow; e2e/v31815 (the new photo shown at once, specks found in
  steps as in one go, Trim it and Undo, presets and The edges, Follow the drawing at phone width, Matching shapes
  alike), in Chromium and WebKit. e2e/straighten reads its own line, not Trim it (offered on its page square to the
  camera, with a strip of table round it); e2e/help's glossary has Matching shapes alike.

## v318.16

The guide's controls made calmer, from a UI pressure test of the whole guide (mine, then Fable's) and Ben's choices
from mock-ups.

- **Shading is one row:** Off · Soft · Dramatic · Rounded · Neuro. A style is the whole picture's look: it turns
  shading on and sets Main's and every zone's Roundness, Highlights and Shadows amounts (v318.15's presets set only the
  chosen zone's, from a row that looked global), and Light from between the sun and the edges; a photo's light is
  kept (Neuro is the edges, and a sun style after it is the sun). Move a slider and the line under the row says Custom (a line, not a sixth button: it
  didn't fit a phone's row, and can't be chosen). One Undo step each, named ("Shading: Dramatic").
- **Shadows only is Highlights › None** (the mode it always was: saved guides open unchanged, and an older copy reads
  it as before). With zones, a line says it's the whole picture's.
- **More options on a phone** (a screen whose short side is under 600 px: a phone either way round, or an iPad's
  narrow split view; iPads keep everything open): Shading keeps its row, Light from, the how-to and the shading note,
  and folds tone lines, Leave sections flat, the zones' own shading and texture; Colours keeps Mood, the marker count
  and Colours from, and folds Filters, Temperature, Include and the count of markers. Open or shut for the session;
  open by itself while Leave sections flat or the Filters panel is in use. On a 390 × 844 phone, Shading went from
  589 px to 309, and Colours from about 700 (everything open) to 431.
- **Radial's rings on one line** ("Rings [Circles] [Follow the drawing]"), the Undo step named "Rings: Follow the
  drawing", and the mandala tip shown with either kind of ring.
- **Words:** the "COLOUR PATTERN" and "SHADING" headings, which repeated the tab's own name, are heard by a screen
  reader but no longer shown; "· 0" after Pin colours and Leave sections flat is gone until there's one; the shading
  note is a plain line, not the guide's one dashed box; "All 120 markers you own" no longer sits above "36 of your
  markers" (the second is the one that counts); "Within your filters, lean towards…" is "Lean towards…";
  Neurographic is Neuro.
- **Easier to tap and read:** the guide's choices are 44 px tall (40 before, under Apple's 44), and row names and
  notes 13 px and a step clearer (12 px at 52%). Pattern is about 15 px taller on a phone for it.
- **Tests:** test/v31816-shading-row; e2e/v31816 (the row, Custom, Off and Undo; Highlights › None both ways; More
  options at 390 and not at 820; Rings on one line, 44 px), in Chromium and WebKit. The tests turn shading to a mode
  through the test seam (shadeTo, one Undo step, as the old buttons did), and open More options unless a test asks
  for the phone as it comes (moreShut). Height allowances: Shading's v318.15 140 px removed; Pattern 20 px.

## v318.17

Planned with Fable, then the plan pressure-tested again by a fresh reviewer (which found three things that would have
broken: coloured sections getting highlights back, the blender breaking Colour along's steps, and the new row breaking
Mood's fitting).

- **Pattern on a phone:** Look comes before Direction; Direction, Start colour and Scatter (with its speck line) fold
  under More options, as do Random's two tick boxes and Blend's Spread and Mix; Photo and Manual don't fold. On a
  390 × 844 phone the Gradient tab is about 425 px folded (678 before). **＋ Zone moves to the tab's end** with a line
  saying what it does; its heading is heard first, as before, zones or not.
- **Flow pictures:** each Flow button has a small picture of its path above its word (heard as the word).
- **A mandala page:** one group, "Looks like a mandala", with Matching shapes alike and, with Radial's rings, Try
  Around (the Around tip and the tick box were two separate lines).
- **Shadows only per zone:** with zones, Highlights › None is the chosen zone's own (no H there; the rest keep
  theirs); without zones it's the whole picture's, as before. A zone choosing a highlight while the whole picture is
  shadows only turns it on there alone: the other zones, and every section already coloured, stay without one.
  Sections coloured under Shadows only are held without a highlight, so turning highlights on later doesn't put one
  on paper that's already done (with shading off they're held as before). An older copy shows a zone's None as
  Main's kind of highlight, and forgets what a section coloured with None or the blender was held with (its shading
  then follows the settings).
- **Blender highlights:** with a Colorless Blender (0) in your markers, Highlights › Blender (0): the 0 on the
  highlight first, then the base over the whole section (it takes less there); while it's wet, touch the 0 again to
  lift more. The H is your blender (its own brand's first), shown as the base lifted; nothing to buy for it; Colour
  along has its step. Without one, a guide using it takes a lighter marker instead and says so. An older copy reads it
  as Same colour.
- **Themes in Lean towards** (Colours, was Temperature): Any · Cool · Warm · **Sunset · Forest · Candy**, a six-wide
  row as Mood's. A theme keeps your markers inside its hues (L*C*h° windows), and with fewer than 8 adds the nearest,
  with a line saying so. The full Ohuhu 320, Honolulu 120 and all-Copic sets have at least 6 inside each. Not in
  Surprise yet; an older copy reads a theme as Any. Random's Main colour chooses from the theme's markers too (the
  debugging pass found it took its colours from all of them).
- **Shading styles under the photo's light** no longer read Custom for a Roundness the photo doesn't use.
- **Tests:** test/v31817, e2e/v31817 (Chromium and WebKit); targeted e2e locally (the files that touch the guide's
  controls), the full suite on GitHub. Updated: e2e/help (Lean towards in the glossary), e2e/v308-colour (Try
  Around).

# Changes — v318.18 (Theme: twelve themes with colour strips)

- **Theme, its own choice** under Colours › Lean towards (Any · Cool · Warm again, three even buttons): twelve
  themes in a grid, **Blossom · Tropical · Autumn · Winter / Sunset · Desert · Forest · Ocean / Coral · Berry ·
  Galaxy · Twilight**, 3 across on a phone and 4 on an iPad. Each has a strip of the colours it takes from your
  markers; tap the chosen one again for none. Undo: "Theme: Coral" / "Theme off".
- **Tuned on the Ohuhu 120/320, Honolulu 48 and Copic sets** (Fable's study): Forest takes no lemon yellows, Sunset's
  violet sky no royal blues (its extra colours are taken by fit, not the collection's order), Ocean has them; Winter
  is icy blues and lilacs with silver at most a third; Coral is coral, peach and pink with a little teal; Twilight
  lavender, periwinkle, mauve and indigo. Candy is gone (a v318.17 guide's Candy opens as Blossom). The order keeps
  Twilight away from Winter and Blossom.
- **With Cool or Warm** a theme takes that temperature's markers (Warm + Tropical: its pinks, oranges and lime),
  widened within them; its strip shows those, and a theme with next to none is greyed. Tapping Cool or Warm with such
  a theme on turns it off in the same step, and a line says so.
- **Saving**: a new `theme` setting, written only when one is chosen (a guide without saves exactly as before). A
  v318.17 guide's Sunset or Forest (saved in `palette`) opens as the theme with Any; zones too. An older copy reads a
  theme as Any, and loses it if it saves the guide again.
- The pool line names the theme ("… of your markers in Coral"); Random's Main colour's Auto says "an ocean colour,
  from the theme"; Blend's anchors and the rough-spots line notice a theme change. The Photo pattern takes no theme.
- More options' Lean towards and Theme rows are fitted when the fold opens (they were fitted only while shown).
- **Tests:** test/v31818, e2e/v31818 (Chromium and WebKit). Updated: test/v31817, test/style-fields, test/zones,
  e2e/v31817, e2e/style-fields, e2e/controls-wiring. Targeted e2e locally; the full suite on GitHub.
- **From the v318.15–17 run on GitHub (WebKit part 1):** on a phone in Safari's engine, the first change of tab to
  Shading moved the page up 14px. Every tab is held at the tallest tab's height, measured by laying each out without
  that minimum; the short Shading tab (v318.16) made the page shorter for that moment, and Safari's engine pulled the
  scroll up with it. The page now keeps its height while the tabs are measured (e2e/guide-frame). And
  e2e/rough-count's big-collection test waits up to 90 s for its line (it once missed 30 s there, then passed).
- **From the v318.18 run on GitHub (Chromium part 1, WebKit part 8):** on an 11" iPad on its side with a portrait page,
  the controls column beside the picture is about 380px wide, and Theme's grid made Colours taller than the screen
  (the page changed height between tabs, and Colours needed ~300px of scrolling). There, Colours now folds under
  **More options** as on a phone (Ben's choice): where that column is under 420px. Shading and Pattern stay open; a
  12.9" or a wider page keeps everything open. e2e/guide-frame-2 checks the fold, opens with More options shut as the
  app starts, and checks the tallest tab's scroll is its own content (Colours may no longer be the tallest).
- Cache bumped to `marker-studio-v318.18`.

# Changes — v318.19 (older Ohuhu caps: the names printed on them)

- **Photograph your caps reads older Ohuhu caps** (old codes, with the colour names they had then: "R6 Rose Red" is
  R213 Pomegranate now). The app knew each marker's old code but not its old name, so it asked about nearly every
  other cap. It now knows the old names of 309 markers (src/data/cap-names.json: the June 2025 change list, which takes
  priority, checked against the app's codes and against real older caps; docs/READER-CAP-NAMES.md) and counts one only together with
  its old code. On 8 transcribed photos of a lent collection: listed correctly 65% → 89%, questions 185 → 39, wrong
  reads unchanged; on all 20 photos, questions 536 → 88.
- A code that's one marker's now and another's old code (R16, G410) goes by the older cap's words only it has
  ("R16 Deep Violet" is RV316); a word both have leaves it as before.
- An old Ohuhu code that is a Copic code now (R21, Y13, R17, R11), read with its cap's name, is the Ohuhu marker; it
  had been dropped on a photo as another brand's.
- The older grey caps' Ⅱ read as I, l, 1 or H ("CGI09", "CGlO7") is understood, as is "Greyll" for "Grey Ⅱ".
- Unchanged: typed and pasted text with codes as they are now, and the maintainer's 81 bench photos (newer caps), photo
  for photo.
- **Tests:** test/v31819 (old code + cap name, shared codes, current code + cap name, a pasted list, a photo of older
  caps, the data). Noted, not changed: the change list has WG140 Peach Silk (old WG0.5), which the app's markers lack. Reader suites and the full unit suite; e2e for the scan and photo files.
- Cache bumped to `marker-studio-v318.19`.

# Changes — v318.20 (cap reader: a debugging pass)

- An old Ohuhu code read with its older cap's whole name made only of everyday words ("Y11 Brown Grey", "BG2 Deep
  Green", "Y13 Chestnut Brown") was missed on a photo: the photo's own check of a name leaves out words every family
  has. It now takes an older cap's whole name (ocrCapNamed, 60-brands.js).
- A name line read unsure that is itself a code ("e030" and "e020)" on a turned E400 Cocoa Brown cap) is no longer
  read as part of the cap's text: E030 and E020 had gone in unasked as YR45 and YR05.
- Measured: the lent collection's 8 checked photos, listed 89% → 90%, wrong 7 → 5, questions 39; Ben's 81 bench photos
  (recorded reads replayed): 3 questions now listed, all three right; nothing else changed.
- Looked at and left: asking when two unsure readings of one cap disagree removed 2 wrong reads here but turned 10
  right reads of Ben's photos into questions; a cut-at-the-edge check for old codes dropped 8 reads at photos' edges.
- **Tests:** test/v31819 (both). Cache bumped to `marker-studio-v318.20`.

# Changes — v318.21 (the code on your cap; the reader puts near-misses right; where a question's cap is)

- **The code on your cap.** Ohuhu renamed 362 markers in June 2025 (R6 Rose Red is R213 Pomegranate now) and older
  caps still say the old code. Each marker now remembers what its cap says, from how it came in: a code read by Scan
  (photo, typed or pasted: an old code is an older cap, a code as it is now the cap of now; a code that's one marker's
  now and another's old code, R22, only with its name), **Bought ✓** on To buy (a new pen: the cap of now), or **My cap
  says** in the marker's details. What's known nothing of follows one setting, **Markers › ⋯ › Show the codes on older
  Ohuhu caps**, asked once at the top of Colour along ("Does this cap say R213 Pomegranate or R6 Rose Red?", with
  Some of each and I don't have it), and offered once by Scan's Add when most caps read are the other kind. The code
  and name shown are then your cap's, with "now R213" beside, in Markers, the marker's details, palettes, the guide's
  labels and tips, Colour along (whose search finds either code), Focus, Change colour, the blend plan, the PDF and
  image keys, swatch charts and cards, Match and Scan's own rows and answers; the shopping list leads with the code
  sold now ("your cap: R6"). Saved collections, guides and backups keep the codes as they are now; backups carry what
  caps say (a restore replacing your markers takes it, one adding merges, yours win; v318.20's put-back still
  works). **Forget what my caps say** in ⋯. src/js/caps.js; src/data/cap-shown.json (seven short old names).
- **Two markers that show the same code.** 16 old codes are another Ohuhu marker's code now: an older cap's R22 (RV17
  now) and the R22 of now can be in one guide. v306's same-code marks now go by the codes shown: the older cap's labels
  carry a *, counted in the label's width, and the key, Colour along ("2 caps"), Focus and Change colour name both by
  their caps' names ("R22* Dark Blush cap"); a codes-only key keeps such pairs' names.
- **Photograph your caps: a code misread by one character, put right by its name.** "5110" with "Dark Suntan" read
  beside it is E110 (YR312's older cap), "F400" with "Cocoa Brown" E400, "8114" with "Cerulean Blue" B114: only a
  reading that's no code, one look-alike character off, exactly one marker of the photo's brand, its whole name read
  within about a cap. Listed with "read as “5110”" on its row. A Π read for the grey caps' Ⅱ ("CG∏04") is that Ⅱ.
  Measured on recorded reads: the lent collection +18 caps listed, Ben's 81 photos +6, none wrong.
- **Where in the photo?** Under a question's close-up: the whole photo (as shown, about 100–150 KB) with that cap
  ringed, and "Near the top left · beside YR2 and R10"; a tap on the photo goes back. Kept with its questions in Scan's
  picture store, through reloads, at most 30 photos, gone with the last question of each.
- **The reader bench** (scripts/bench/reader: record, replay, score, compare): recorded OCR reads replayed through any
  build in about a second a photo, the photos and recordings kept outside the repo.
- **Debugging pass** (two reviewers, one who knew the plan and one who didn't), fixed:
  - A section's * went stale when another section changed (the picture's redraw didn't look at the label drawn):
    the label as drawn is now part of what tells a section changed.
  - Another tab's change of what caps say, and a restore's put-back, didn't reach an open guide.
  - Add with nothing new but caps to note closed Scan over a question the box's text had just raised; an Add's Undo
    left the one-time offer used up.
  - Bought ✓ redrew only the guide (Markers and palettes kept the old code); Change colour's code filter didn't find
    an older cap's marker by its code now; running-low chips chose their brand letter by the code now.
  - A code read upside down, and a card's answer by an old code, told nothing of the cap; a cap read again now tells
    its latest read.
  - "I don't have it" now asks about another of your markers (three such and it's asked no more); the keyboard goes
    to the next question or the list when the card goes. Backups and the put-back carry the offer and the question.
  - Smaller: the photos kept after a reload let the newest go first at 30; the palette line's base marker by its cap's
    name; the * left out of Colour along's search suggestions; wording "whose caps aren't known".
- **Tests:** test/v31821-reader, test/v31821-caps, e2e/v31821-reader, e2e/v31821-caps, e2e/v31821-where; v306-along,
  v311-markers, v3187-brands and v318-scan updated (sameCodeScan's {b, s}; answers by an old code as their caps say
  them, "now YR47"). Cache bumped to `marker-studio-v318.21`.

# Changes — v318.22 (cap reader: Look closer, older caps' names, the Ⅱ greys; Chrome reads on past ten photos)

- **Look closer**, under a photo read (or a batch): the caps without a box read again from the photo decoded larger
  (2700 px on its long side, its text about a third bigger than in the 2048 copy: bigger still read worse), in squares
  round the lines that didn't settle into a marker, and settled with the photo's own lines as one read. What that adds
  goes in under the photo's number; a question the photo had asked, a marker taken off the list since, or a question
  about a marker already listed are left as they are; a code only it read, with no name of its own, is asked about
  rather than added when every reading of it was unsure or the photo's own read had another code on that cap. Stop keeps
  what it has read; **Undo look closer** takes it back. Only when asked: it takes about a fifth to a half again as long
  as the photo did on the bench, too long for every photo. Not for a photo read closer already, read gently, or no
  bigger than its copy; a page that ended while it looked doesn't offer it again that visit.
  Measured (recorded reads plus the closer squares read live): Ben's 81 photos HELD 93.6% → 94.1% (+16 caps), TUNE
  81.6% → 83.2% (+42), no new wrong marker; 77 more questions, 74 of them offering a marker not otherwise found (without
  the asking rule above it listed +115 but added 8 wrong). Eight lent photos: listed 91.2% → 93.7%, wrong 6 → 5.

- **Photograph your caps reads more older Ohuhu caps.** Measured on the recorded reads (scripts/bench/reader): the lent
  collection listed 92.9% → 93.8%, listed or asked 95.8% → 96.5%, wrong 9 → 9, questions 80 → 77; Ben's 81 photos the
  same as v318.21 (+1 and +2 caps, no new wrong marker or question). docs/READER-CAP-NAMES.md has each rule.
  - An older cap's code that's another brand's code now, told by a word of that cap's name: "Y13" with "Chestnut" is
    Ohuhu E515, not Copic Y13 (on a Copic tray it stays Copic's).
  - The CGⅡ/BGⅡ greys with the Ⅱ misread ("CGé08", "cclo8", "BG期05"): CG listed, BG with its name, else asked; never
    taken for BG05 as read.
  - A cap whose name alone was read, its first line a word of it: the Colorless Blender is asked about by name.
  - The near-miss fix takes a name misread by a letter, and a code whose last digit was read as a letter ("GYS").
- **Chrome stopped reading after about ten photos** (reading ended, or the page crashed): Chrome kept every photo's
  full-size decode in its image cache when createImageBitmap resized it (~48 MB a 12 MP photo), and every photo's shown
  copy and box canvases after they'd gone. In Chrome the photo is now decoded whole into a bitmap of its own and shrunk
  on a canvas, and the photo's canvases are emptied as the view changes: 40 reads in one page, memory flat. Safari's
  decode is unchanged (its memory was flat already).
- **The photo hint** says how: "Caps without a box weren't read. Half a tray at a time, with no glare on the caps,
  reads best." (A hint only for photos read badly was tried and dropped: what the reader can count of a photo's misses
  is as high on good photos as on bad ones.)
- **Tried and not built:** asking instead of adding in three doubtful cases (each took out a few wrong markers but turned
  as many right ones or more into questions); the closer read for every photo, automatically (the first trial: +13 caps
  on the four hard photos, the bar was 15, for 60-140% more reading time; seven more versions tried, none both found
  enough and kept the time down, so it's Look closer, when asked).
- **Reader bench:** six caps the transcriptions had missed added after checking by eye (the reader had them right); the
  recorder opens a fresh page every 5 photos and stops on a photo that wasn't read.
- **Debugging pass across the whole app** (five reviewers: Scan and the reader twice, one who knew the plan and one who
  didn't; the guide; data and the app shell; the interface), fixed:
  - The Ⅱ-grey rule by brand: with Copic chosen and too few caps to tell the photo's brand, "BG期05" was neither listed
    nor asked (Copic's BG05 before); a stop or dash in a code ("BG.05") isn't a Ⅱ; a BG cap of now with its own name
    read beside it is that cap.
  - Clear list in Scan's Find mode renumbered the photos of the list kept for Add (the next photo shared "Photo 1" with
    the first tray, and its Undo took that tray's markers out too) and ended the Add list's switch to both brands.
  - Undo this photo could put back a question an earlier, cleared photo had answered (the answered questions were kept
    all visit, with their pictures); they go with a new batch, Clear list and the photo view.
  - Scan closed while the reader was starting left a worker running beside the next (its memory with it), whose
    'ready' could be taken for the next one's ("The reader stopped with a problem"). A photo still opening when Scan
    closed went on into a view no longer there.
  - A pasted list, after a reload, counted as caps read: the older-codes offer could come from an order email.
  - Change colour and the low-marker swap between an older cap's R22 and the R22 of now said "Replaced R22 with R22";
    both are named by their caps now. VoiceOver read the * as "star" on section and swatch labels: "your older cap".
  - A restore that failed for room left the cap question's and offer's flags changed, and the Tester answers merged.
  - On a phone held sideways, Where in the photo?'s ring sat 37 px below its cap (the picture's box stretched).
  - Colour along's cap question toasts: "markers whose caps aren't known" when Scan has told some; Scan or type codes
    where the photo reader doesn't run.
  - Look closer (a review of its own): a worker that crashed while it read a square left it waiting for good; a failed
    worker was kept for the next photo; an error in its settling left it unoffered for the visit; Stop part way through
    a photo marked it done; × while the photo decoded started a worker for nobody; Done's count left out what it added;
    nothing it said was heard (Scan's status line is hidden under the photo); its other-brand question named the wrong
    brand as chosen; offered for a photo with nothing to look at.
  - **Second full pass** (five more reviewers: photo reading end to end, the app driven in a browser, the guide engine,
    data across versions, words against behaviour with keyboard and screen reader), fixed:
    - Look closer hung for good when the iPad app was put away while it read (the reader was ended when the app went
      out of view, and the square it waited on never came back): the reader stays while it reads, and an ended reader
      ends a closer look waiting on it. Stop now stops the square being read too.
    - Look closer could switch a photo's brand (Copic chosen, the first read not plainly one brand's), saying its own
      caps again as new: it reads under the brand the photo's own read found. What it answered stays out of the photo's
      counts; the words under the photo (counts, the hint, now naming Look closer) are said again after it and its Undo;
      Stop before it read anything says so.
    - A larger decode failing after × was taken for the next photo's failure, its codes taken out.
    - Another tab still on a version before v318.21 saving made this one forget every cap known; a restore's Undo left
      the caps offer as the restore set it; the update toast in a tab out of view was never seen.
    - Plan › Blend: a pinch ending with one finger down threw the picture back; a touch the system took back opened an
      anchor's picker.
    - "Where in the photo?" was read as "Back to the close-up, pressed"; "Codes as they are now for now" reworded.
  - **Then, pressure-tested one at a time**, two of the calls left open above were taken:
    - **A typed code of the other brand that could be one of yours misread is asked in the list**, not only on a card.
      With Ohuhu set for you, typing a Copic code that sits near an Ohuhu one (RV10, beside RV18/RV19) showed a card
      and put nothing in the list, so the next code typed replaced the card and RV10 was lost without a word — while a
      Copic code with no near Ohuhu neighbour (E000) became a list question. The card was meant for the camera, where
      you hold the cap still and it's read again; typed, there's no cap to hold. The same code typed again says it's
      waiting in the list. The camera's reads keep their card, as they should.
    - **Fields only a newer version wrote live through this version's save.** A save rebuilds the stored state from the
      fields it knows, so a tab on an older version — a second device on a stale cache, or this app before it reloads —
      wiped a setting a newer one had written. Those fields are now kept as they were. It costs no extra reading: the
      stored state is already read at every save. A field this version gave up writing is not put back.
  - **Third full pass** (six more reviewers: the Palette and colour engine, what Markers makes, the guide after it's
    built, the app's saved data, Scan's typing, and the flows the browser hadn't been driven through; each fix tried on
    a copy first and pressure-tested), fixed:
    - **The fields a newer version wrote were kept only up to 4 KB each**, so one with an entry per marker — as caps
      are — was dropped for a collection of more than about 216 markers: the loss the change above was made to stop.
      No limit now: a field goes back exactly as it was read, so it can't grow.
    - **Codes typed into Scan kept:** one typed and left in the box as Scan is closed (no Enter) is asked in the list,
      not shown on a card as Scan closes; with a brand tapped above the box, another brand's code typed is a question
      in the list that names its marker ("Copic C-3 Cool Gray No.3: add it? Another brand than the one chosen (Ohuhu)"), where its
      card had stayed in the box and the next code typed ran into it ("RV10Y06", both lost); a question about another
      brand's marker goes once that marker is in the list (after Keep Ohuhu it had been asked twice).
    - **Tick colours on a chart** asks before its ticks are thrown away — a tap beside the card, Escape, Back or × —
      with Add, Discard or Keep ticking; Save changes only what was ticked or unticked there (a marker another tab added
      while it was open had been removed); with older codes set, markers not ticked yet show the code their caps would
      (an older cap's R23, R38 now, had shown as today's R23, a different marker).
    - **Your caps' codes everywhere:** Markers' search finds the name on an older cap ("Dark Blush"); To buy's From your
      guides and the reason it keeps say "Lighter than R6", not R213; the swatch chart's and Markers' Code order is the
      order of the codes shown; two boxes on a swatch chart with one code (an older cap's R22 and the R22 of now) have
      the older cap's marked *, said under the title.
    - **Palette:** with a colour locked, Generate keeps the scheme round it: each Generate had moved it on from the last
      palette's first colour, so an Analogous five ended as four greens 94–115° from the violet locked (38 runs in 40;
      none now). A Rainbow without six clear colours in play says so ("try fewer colours" had been said at its
      smallest); one built from a marker names that base wherever its hue puts it.
    - **The guide:** a section coloured with the stand-in for a marker gone dry is saved as the stand-in (it reopened
      as the dry marker, and went back to it when the marker was refilled); a section pinned to a marker that goes dry
      keeps its pin's marker when saved (it was lost for good); Undo of a new zone's first sections after Done takes the
      empty zone away (it stayed, selected, and no Undo removed it), while in the zone's editor Undo of a mis-tap still
      leaves the editor open on it.
    - **Colour along keeps the open row clear of Mark all's toast:** the list has room for the toast after its last row,
      and the open row is kept above it. With the open row at the foot of the list the toast's Undo had sat over its
      Clear and Blends at every size, and took the tap meant for Blends.
    - **Look closer's caps are boxed on the photo** where they were read, in place of what the photo had read there, one
      box a cap; Undo look closer takes the boxes back. And the photo's boxes at Done are drawn as every later drawing
      is: on older caps a code listed by its old code had been boxed amber with what was read ("R21" with R16 listed).
    - **The keyboard kept off the page:** after To buy's Bought ✓ and ×, Palette's Clear, Library's Duplicate and Delete
      zone; Full screen takes the keyboard to its X, keeps Tab to what it shows — the guide's header (its name and ⋯,
      reached behind full screen as before), the picture's controls and a section's tip — where it had gone on to the
      Plan's controls hidden under the picture, and gives it back to Full screen.
    - Smaller: Tester answers given in two tabs no longer wipe each other's; a page opened with a hard reload is told of
      an update; "Also: the Red family" shows that family only; Match says your cap's code; a copy of "Garden (2024)" is
      "Garden (2024) (2)".
  - **Fourth full pass**, of this round's changes (four more reviewers, told to measure every limit against real data,
    as the 4 KB one should have been, and to say which new tests would pass with the bug still in), fixed:
    - **A count limit of 20 on the fields kept for a newer version**: the 21st and later were dropped, about five weeks
      of releases at this autumn's pace. No limit of count or size now; a test keeps 40.
    - **Undo this photo lost a question about another brand's marker that the photo took** (a code typed and asked
      about, or an earlier photo's question): the question goes once its marker is in only for what's typed; a photo's
      own pass keeps it for its Undo.
    - **Look closer's boxes at real spacing**: whether two boxes were one cap's was tested square to the photo, so with
      caps 60–80 px apart and codes read upright or slanted a neighbour counted, and a cap read closer, or a neighbour the
      photo had read, was drawn with no box. Now tested along and across the code's own line; a box the photo placed as
      another marker is never replaced; a second Look closer after Stop numbers its lines after the first's.
    - **To buy's From your guides kept an old code after a cap changed**, until the collection did: what caps say is
      part of when it's worked out again.
    - **Undo deleted an empty zone you kept** (its sections taken by another zone's editor) at any step, and Redo didn't
      bring it back: only the zone a step was taken in the middle of making goes. **A section pinned to a dry marker's
      stand-in** went back to the marker when it was refilled, its pin still on the stand-in: it keeps the stand-in.
    - **Full screen's Tab** counted Undo and Full screen, there but hidden, so the keyboard stayed on the X; and the
      first version made the guide's header inert, which full screen had always let you reach (renaming the guide and
      its ⋯ behind full screen). Now as above.
    - **A page that already had the new release from a hard reload was told to reload** when its new version took over:
      not when the version that took over is its own.
    - Smaller: Palette's Clear in Custom left the keyboard on the page; a Rainbow made before a marker in it was chosen
      to build from said it was that base after Undo; with no filter on, "loosen the filters" was said (now "add markers
      with more colours"); "Kew (1759)" copied as "Kew (2)"; the swatch chart's * note had been cut off on A5 and Half
      Letter (a line of its own now); Tick colours on a chart showed two swatches "R23" in one family with your new R23
      and an older cap's (the older one's marked *).
  - Left as they are: Undo this photo keeps a switch to both brands it made (switching back changes other entries);
    a set's name left in the box at Add; marker codes a newer version wrote in another tab are still dropped by this
    one's next save, as codes no longer in the data are (the two can't be told apart), and so are a guide's own payload
    fields when an older version autosaves a guide a newer one saved.
  - Measured and deliberately not built: **a code alone that Copic shares on an Ohuhu tray is still dropped.** Asking
    about it was in the plan. Measured on the 20-photo set: of 85 caps printed with one of the 14 shared codes, 74 are
    listed and 6 asked about; each of the 5 missed had something read as its name, so asking when no name is read
    gains no cap. Where that rule would fire it fires 9 times on that set (each on a photo where the cap is listed from
    another read) and 23 times on a set with no older caps, where they are misreads. The 5 are missed because their
    names were read in part or upside down ("Brown", "Bro", "nestnut", "UMOIg"), one code was never read, and one Copic
    cap's name was garbled: matching names by a letter or two more would gain one.
- **Tests:** test/v31822-reader (the rules), test/v31822-debug, test/v31822-closer (Look closer), test/v31822-third
  (the third pass), and in test/v3187-brands the typed other-brand code kept in the list; e2e/v31822-third (the third
  pass in the browser); e2e/scan and e2e/v3083-data answer a typed other-brand code in the list now; e2e/v31822-reader (the canvases emptied, the hint, the ring sideways, Find mode's Clear list, Look closer and its
  Undo); e2e/v318-polish's decode
  test (whole in Chrome). Cache bumped to
  `marker-studio-v318.22`.


# Changes — v318.23 (storage that holds more, shorter waits on a photo, the update said until reloaded)

The three engineering items from the beta list, each pressure-tested (measured, then a plan, then the plan
pressure-tested again) before it was built. "Find my set from 3 caps" in Markers, also on the list, was already there
(Markers › Add markers › "Not sure which set you have?", since v311).

- **The Library holds twice as much in Safari when a name has a curly quote.** Safari counts a stored string at
  2 bytes a character once any character in it is past U+00FF, and the app keeps its markers, palettes and Library
  rows (with each guide's small stored picture) in one: one ’ in one guide's name (iPadOS types ’ for ') halved the
  room, from about 440 guides to about 220, and past half full, a rename to "Ben’s page" failed with "storage full",
  and a restored guide with a curly name could be left out of the Library. What's written is now plain ASCII, wider
  characters as `\uXXXX`, which JSON reads as before (older versions too). Measured in WebKit through the app's own
  save: 93 → 186 guides with 28K-character pictures and one ’; the stored copy counted at 1 byte a character after a
  restart too. Found on the way, in WebKit: a string made from a wide one stays wide inside however plain it reads, so
  escaping alone left it at 2 bytes (2.62M characters at most); a TextEncoder → TextDecoder round trip makes it narrow.
  It costs about 1 ms a save at a usual 100–300K characters, 30–45 ms at a full 5M.
- **Storage full: the oldest stored pictures make way.** A save that doesn't fit leaves out the Library's stored
  pictures, oldest first (by when each guide was saved), 1, then 2, 4… at a time, until it fits; nothing else goes, and
  the Library draws them again from the guides as they come into view. If even that doesn't fit, they're all put back
  and it fails as before, and that isn't tried again until a save works (it would cost about 1 s a save). A picture
  being stored again never pushes another out. Restored guides keep their old dates, so theirs go first: they're
  redrawn the same way.
- **Smaller stored pictures**: the long side at most 144 px (they were 140 wide whatever the height: a tall page's
  was 140 × 370, 23K characters). Square pages as before, Letter pages about 40% smaller, tall ones about 5×. They show
  only until the tile is drawn again (at up to 480 px); 128 looked blocky at 2×. Pictures already stored stay as they
  are until they're drawn again.
- **Shorter waits while a photo's sections are found.** The ink's blur, the longest single wait (0.48–0.6 s a pass in
  WebKit, up to two passes on a grainy photo), now walks the picture in memory order (a third quicker, the same sums
  and division, so the same pixels) and each pass is a step of its own with a paint between. WebKit's longest wait
  there: about 1.15 s → 0.4 s. Sections exactly as before: the guide benchmark's digest is unchanged (49e9f9dacdc7,
  all 356 rows identical), and a test checks steps against one go on photos needing no blur, one pass and two.
- **The page's outline shows before it's straightened** (WebKit): the straightening waited 60 ms, not for a paint,
  so in Safari's engine finding and straightening ran as one wait with the outline never drawn. Now after a paint,
  stopped by a newer photo or guide (its own corner editor and picture checked, not only that one is open). WebKit's
  longest wait opening a photo of a page: about 0.84 s → 0.57 s.
- **Build**: the texture's distances and the mood pictures' lines (they depend on the sections alone) are worked out
  in a task of their own before Build's, so its own wait is shorter (estimated a quarter at 4× slowed CPU; not
  measured on the iPad). Not during the bloom: it's drawn frame by frame, and work there makes it stutter or switch
  itself off. Profiled (Chromium, CPU slowed 4×, a 12 MP page): Build 1.5 s — the plan 0.2, drawing the guide 0.74
  (texture 0.28, pixels 0.27), the controls 0.49 (the mood pictures 0.3).
- **The longest waits, in Copy diagnostics and Copy details**: the 8 longest pieces of work this visit (each step of
  finding a photo's page and sections, Sensitivity, straightening, Build), with the picture's size, so an iPad's own
  numbers can be seen ("New photo: smooth 412 ms (2400×1800)"). In memory only: not saved, not in Send feedback.
- **A new version is said until you reload**: a banner under the title ("A new version of Marker Studio is ready.
  Reload ✕"), not a 15-second toast that the next Undo toast replaced. ✕ hides it until the page next comes back to
  the screen. On a guide's screen a banner above the picture would move it (Safari keeps no scroll place: 49 px), so
  there it's the toast, not over an Undo, and again each time the page comes back; leaving the guide's screen shows
  the banner. (It shows from the release after this one: v318.22 says this one's update the old way.)
- **A guide's settings from a newer version are kept by an older tab's autosave.** With the app open in two windows
  on one browser, one updated and one not, the older one's next save of a guide dropped the settings it didn't know
  (measured: a style key, a top-level key). Its autosave (and the copy kept as a page goes away) now carries any key it
  doesn't write, at the top, in style and in style.shade, from the stored guide, while the sections are the same (the
  same section map: a key per section would be wrong after Edit sections or a rebuild). Not a restore (it puts the
  backup back as it was), a copy, or a guide file. Every key this version writes, those written only when used too
  (held, dates, zones, matchAlike…), is in its list, checked against currentDesignObj's own text by a test, so one
  cleared isn't brought back. A key a later version stops writing goes in PL_GONE (none yet).
- **Not built, measured or decided:** moving the page and section finding into the worker (a prototype gave the same
  sections with no wait, but takes away 3 of about 8 waits; decide on the iPad's own numbers, now in Copy diagnostics);
  the straightening in bands (identical pixels, but in WebKit most of it is one draw and read that can't be split:
  0.17–0.38 s); the Library's stored pictures in IndexedDB (2–3 days for what the two changes above give); settings a
  newer version wrote with values this one can't read (put back to their defaults as the guide opens, before any save:
  a new Palette value, say), keys inside zones and photo, and a guide whose sections were renumbered; a version stamp
  or a forced reload; marker codes a newer version added (D1, as in v318.22).
- **Tests:** test/v31823 (10: the stored text, storage full, picture sizes, the waits, the carried keys and the list of
  known ones), e2e/v31823 (6: the update banner and toast, a page that already is the new version, a curly-named
  Library past half of Safari's 5 MB, the ink in steps with 0/1/2 blur passes, a newer version's keys through ticks and
  the autosave). **A flaky test on GitHub's WebKit** (v318.22's run): v307-markers measured the Print sheet's Numbers
  icon part-way through its 250 ms fade-in (4.32:1 for an 8.1:1 icon); the contrast helper (and v307-dbg-ui's) now
  waits for a fade on the element or behind it to finish. The run's two other retries were WebKit's page process
  crashing, not the tests. Cache bumped to `marker-studio-v318.23`.

# Changes — v318.24 (the pages in order in Print; Copic greys read upside down in Scan's box)

From the list after v318.23, each planned and pressure-tested before it was built.

- **Print shows the pages in order**, under its choices: a small page shape for each page, in the paper's shape (page
  1 on its side when it prints so), a run of one kind under one word: Picture, Close-ups, Key, Picture + key (Key +
  reference with no labels), Test strip. It changes with each choice, from the same layout the "N pages" count already
  made on every tap (no layout of its own; the PDF byte for byte as before, measured on six option sets). A screen
  reader hears one line ("Page 1: your picture with codes; pages 2–3: close-ups; page 4: the colour key."), not in the
  count's live region, so it isn't read out on every tap. It sits under Paper, which it doesn't move: in the foot it
  would have taken 51–76 px from a phone's sheet. (The lighter version of v318.1's page previews; drawing each page
  took 0.3–0.5 s on a big guide.) Found on the way, for later: on a phone the Paper choices are already 9–149 px below
  the sheet's first screen (v289 had them on it), and at 320 × 568 with 1.6× text "Download PDF" wraps inside its
  button.
- **Scan's box reads a Copic grey upside down**: "8-N" is N-8, "01-N" N-10, "00-M" W-00, "E-C" C-3, and "L-M" is W-1 or
  W-7 (a turned 7 reads as L: asked); a dash of another kind or with spaces round it ("8 – N") too. Only that shape,
  and only a grey: a date, a time or a range ("6-13", "9-10", "123-456") is still nothing. The photo reader is
  unchanged (it reads each line both ways up itself and never takes Scan's upside-down guesses).
- **A number read upside down as one marker is asked, not added**: typed or pasted on its own, "1100" had gone in as
  Ohuhu GG11 and "123" as Copic E21, against v318.2's rule that digits bent into a code are asked. A grey's shape with
  no digit ("S-M", a size) is asked too. "00000" no longer asks about Copic G0000 (a turned G0000 reads "00009", which
  still does).
- **Tests:** test/v31824 (4), e2e/v31824 (2: the pages in order and their count through the choices; a 320 px phone at
  1× and 1.6× text, Paper not moved, nothing past the sheet's edge). Cache bumped to `marker-studio-v318.24`.

# Changes — v318.25 (a deep debugging pass of the whole app)

Eight reviewers, one per area (Markers; Scan and photos; Palette; making a guide; using a guide; saving, versions and
offline; output, help and testers; layout, keyboard and screen readers), then four more who reproduced every finding
on v318.24 before fixing it, with a test for each that fails on v318.24. 36 findings: 1 must-fix, 19 should-fix, 15
minor, 1 deliberate (E3: each "Mark all" toast repeats its own button's words). Where a fix was a choice, the option
that loses nothing was built and the other is named.

**Saving and versions**
- **Ticks made while a save was running were lost if the page was then stopped** (must-fix): the copy kept aside as the
  iPad was put away failed its own check at the next start (the save that landed meanwhile looked like another tab's)
  and was thrown away. The copy now knows which page made it, and that page's own saves move its starting point on;
  another tab's save still wins. (Measured: ticks A and B, B lost before, kept now.)
- **A backup restored over a guide in Recently deleted** replaced it with the backup's older copy and took it out of
  Recently deleted. Now, if the stored guide differs from the backup's, it stays in Recently deleted (Put back brings it
  back as it was) and the backup's copy comes in as "Name (from backup)", said in the toast. (Choice: keep only one of
  them.) One the same as the backup's, or still within its 6-second Undo, comes back as itself, as before.
- A "(before restore)" copy taken out while another tab saved could come back as an empty row.
- The new-version banner: ✕ now hides it until the page comes back to the screen (a screen change had brought it back),
  and a banner showing as a guide opens gives way to the toast there (it had stayed above the picture).
- An older tab no longer lowers the version last seen, so a dismissed What's new card doesn't come back.
- Home's Tester tasks card follows answers given in another tab.

**Markers**
- Find my set: a scanned Ohuhu Colorless Blender cap counted against the sets, so a Honolulu 24 with a blender bought
  apart showed the 48, 72 and 120 and not the 24.
- ⋯ › Untick all shown asked "Untick 722 markers?" and unticked 121: it counts yours, and is off when none are shown.
- Unowned's "biggest gaps" and "complete" orders said "Showing 601 markers" over 295 or 239.
- Copy on a marker (and Copy codes) copies the code on your cap, as the details show (R6, not R213).

**Scan and photos**
- Past 60 questions, a reload deleted the rest's cap pictures for good. Every question keeps its picture now (200
  pictures measured at 6 MB in IndexedDB); the 30-photo limit stays.
- Add with another brand's code left in the box could add an unanswered question's marker unseen (reading the box
  turned both brands on). Scan stays open with the card when that happens; a second Add adds.
- A pasted list over 20,000 characters lost its brand (357 questions for a shop's list of every Copic marker): the
  brand is decided from its first 20,000 characters, cut at a line end.
- A Copic grey typed upside down with Ohuhu chosen found nothing: it's asked as another brand's, as upright.
- A photo's canvases are emptied when its view closes, not only when the next opens.

**Palette**
- Monochrome from a black gave the black and four greens (Ohuhu 120), violets (Copic 100) or reds (Copic 110): a black's
  hue means nothing. From a near-grey, greys only, from the grey family with most markers in play when the base's own
  family hasn't enough (blacks never do). The guide's Generate palette too.
- Undo after From photo landed in Photo, which had no Undo, so earlier palettes couldn't be reached: Photo has Undo,
  one step at a time, back to the scheme's palette.
- A scheme's palette showed a marker since marked dry or removed as if it were fine: the warning sign and "N not in
  play", as Custom has.
- Save, Use in a guide and Save image recorded the scheme selected, not the palette's own (a Complementary palette left
  on the card when a Rainbow couldn't be made was saved as "Rainbow").
- Rainbow's note counted the palette left on the card, not your clear colours; "try fewer colours" isn't said at a
  scheme's smallest size; a lock with no room at a smaller size is said ("Unlocked B08: no room for it at 4 colours.");
  Monochrome from your base says "your base first, then light to dark".

**Making and using a guide; output**
- Turn, crop or tilt while the sections were being found again for a new Sensitivity left an Undo step with the new
  Sensitivity over the old sections, and an Undo that did nothing visible. One Undo now goes back to both as they were.
- A PDF page drawn in mid or light grey lines was refused as "came out blank" (it counted only pixels darker than
  50% grey).
- Focus mode's next-marker card covered most of that marker's sections on a small phone with large text (9 of 20 at
  375 × 667 with 1.6× text; all of them at 320 × 568) while saying they were "shown on the picture": a shorter card,
  beside the picture when that keeps them clear.
- Finishing the page again after unticking a section is said and celebrated again.
- A PDF is named for the Pages choice it was made with (a change while it was written renamed it).

**Layout, keyboard, screen readers**
- The Markers ⋯ menu ran off a phone's left edge (from 375 px wide; almost wholly off at larger text): it fits.
- How it works scrolled sideways at 320 px wide with 1.6× text.
- Library › Back up from the keyboard put focus back on the page's start; it stays on the button.
- Markers' search says how many it found, once typing stops.
- "Saved in your Library" when leaving a guide by the main tabs is a toast (it went to a hidden screen-reader line).
- A copy that falls back to selecting text gives the focus back where it was.

- **Tests:** test/v31825-x1, -x2 (9), e2e/v31825-x1 … -x4 (28); changed on purpose: e2e/v3187-pics (pictures kept
  past 60), test/v3187-brands (a long list keeps its brand), test/v304-colour (the wording at the smallest size).
  Cache bumped to `marker-studio-v318.25`.

# Changes — v318.26 (Leave white, Blends with, skin tones, the beta's polish and questions)

Ben's choices from the list after v318.25, each planned and pressure-tested (three testers) before three builders built
them; then merged and tested together.

- **Leave white.** Tap a section, then **Leave white**: it stays the paper (as the Photo pattern's white does) through
  Shuffle, Surprise, Mood and its pictures, every pattern, Blend, zones laid again, and is out of the key, Colour along,
  Focus mode, the PDF and the counts. Its tick goes with it and Undo brings both back ("Section left white"). Tapped,
  a white section says **Left white · Colour it**: its marker comes back (the closest you own if it's gone). Not the
  last section with a marker. In the Manual pattern it's a link in Change colour beside "Unpin (allow fill)". Kept as
  its own set (`white`: section → the marker it had), not as a kind of pin: a pin-shaped one needed guards in 84 places
  and older versions showed it as a pin. Older versions (v318.23–25) open such a guide with those sections white; their
  next Shuffle colours them, and the guide then opens coloured here too (a white kept only where the section is still
  paper). A white section taken out in Edit sections and brought back comes back coloured. A part split off a white
  section stays white. The tap box's buttons wrap to a second row when three don't fit (the third was clipped at every
  width). In tests, a white section given a marker by any path throws, so a missed path shows at once.
- **Blends with** in a marker's details (press and hold it in Markers, or tap it in To buy): the lighter and darker
  markers it blends with, as a guide made now picks them from your markers (not dry), each with "you have it", "dry"
  or "not yours", the brand named when it's the other one's. Tap one for its details, with "← Back to …".
- **Skin tones**: a row in Change colour (with 3 or more in play), and Markers' search "skin", "skin tones" shows them,
  lightest first, with the Earth / Skin / Brown family as a link. Ohuhu's are its own 36 Skin Tones set; Copic's are 36
  picked: 21 from Copic's own skin sets and its colouring-faces guide (Ciao 6 Skin, the Skin/Portrait 12, "How to
  Color Faces"), 15 the nearest Copic markers to Ohuhu's set (ΔE2000 ≤ 5.7). Before, "skin" showed the Earth family,
  which holds 14 of Ohuhu's 36 and 41 browns, and missed every deep skin tone with a colour-range rule.
- **Tester tasks**: the colours question asks which markers looked most different; two new last questions (other marker
  brands you use; what you colour most). The app sends to the form as it is (27 fields: the new answers in Message,
  which Results rows leave empty) or to the new one (29) once its link is in; any other link warns in the console and
  falls back to sharing. For Ben: add "Other brands" and "Colour most" at the END of the form as Paragraph questions,
  NOT required (a rejected send can't be seen by the app, so older versions' sends would be lost), then send a
  pre-filled link with every field "x" (docs/tester-form-setup.gs).
- **Send feedback carries this visit's longest waits** (times and picture sizes only), in the form and when shared,
  by Ben's decision (v318.23 kept them out). Details go first; the note is cut to fit the form's 4,000 characters.
  Said in the dialog, Help (How to report, Your data) and TESTERS.md.
- **The welcome's Undo** is a link under "Anything else?" after adding markers there, not a toast over the step's
  buttons (it covered them on phones); reverses v309.1's toast for the welcome only. Markers' Add a set and Scan keep
  theirs.
- **Markers' search finds an older cap's printed name** with today's codes shown ("Rose Red" finds Ohuhu R213, older
  cap R6 Rose Red), when what's typed reaches the name's last word, so "light" or "dark" alone add nothing; the
  marker's label says "older cap R6 Rose Red".
- Smaller: Send feedback can't fail on an error kept without a time; a batch's Done says "N not read" (and "None of the
  N photos could be read"), its Undo counts the photos read; Focus mode's back button reads "← Back"; "Plan" in the
  Help glossary, "Back to the Plan" everywhere; the Tester card says "Next to answer"; the welcome's "Scan caps one at
  a time"; Print's paper name in the summary is a link to the Paper choices (on a phone they're below the first
  screen); "Download PDF" no longer wraps at 320 × 568 with 1.6× text (v318.24's note said so; it did still wrap).
- **v318.25's run on GitHub** (both engines): three failures, none flaky, all from this week's changes. The Print
  sheet's page numbers were 10 px (the app's smallest text is 12: now 12). A backup restored over a guide deleted while
  open now leaves that guide as it was (v318.25's rule); e2e/v289 expected the old way and was changed. And Random's
  "Keep touching sections clearly different" check failed because v318.25 drew a random number as the page loaded,
  moving the test's seeded rolls on to one with two alike pairs: the page's own id no longer uses Math.random. That roll
  shows Random's rule isn't absolute (2 alike pairs on one roll in about 10 tried; the others none): noted for later.
- **Tests:** test/v31826-w1 (5), -w2 (4), -w3 (10); e2e/v31826-w1 (8), -w2 (8), -w3 (6); changed on purpose, each
  for the new words or behaviour: tasks-card, v31825-x3, colour-along, help, v318-ocr, v31823, tabs, v309-1, v3092,
  v318, v3091-d4, v3083-data, pins-and-change-colour, paint, v289, test/style-fields, test/v31822-third. Cache bumped to
  `marker-studio-v318.26`.

# Changes — v318.27 (Random keeps touching sections apart; the skin sets; Print's Paper on a phone)

The rest of the list after v318.26, planned and pressure-tested, then built by two builders and merged.

- **Random's "Keep touching sections clearly different" now holds roll after roll.** Measured (100 rolls a page, the
  app's own adjacency; a clash = two touching sections with one marker or under ΔE2000 10): Main colour left alike
  pairs on 74 of 100 rolls of the sample at 16 markers and on every roll at 8; No repeats on up to every roll of a big
  page; Mixed only at 8 markers (≤ 3%). The e2e passed on a lucky seed. The cause was the order the markers are laid in
  painting itself into a corner. A repair after the laying puts right any section left alike to one it touches (the
  least-used marker clear of all its neighbours, or a one-step swap), in Mixed, Main colour (within its role first; an
  accent's marker never goes to a Main or Second section) and No repeats: 0 clashing rolls in 10,500 tried on the
  benchmark's pages, Main colour's share unchanged. It runs only when a section was laid with no clear marker, so a
  roll that already kept the rule, or the rule off, lays exactly as before (colour benchmark: every row identical,
  digest b8237b31ced3). Where too few different markers make it impossible, a note under the box says how many
  sections, and More options reads "Mostly kept apart". (bench/colour-baseline.json was already out of date at
  v318.26 — 751 of 9,880 rows — before this; to be refreshed as its own reviewed step, with rows for the rule on in
  Main colour and No repeats.)
- **Ohuhu's 6 Skin Tones set** (YR00, YR05, YR06, YR312, YR55, E614; Dick Blick's "EG14" is E614: Ohuhu's own
  old-code pages), in the set list, Find my set, Help, README and TESTERS. **24 Portrait** checked against Dick Blick's
  list (all 24, same order) and Ohuhu's old/new code pages (15 of 24): right; it comes with a Colorless Blender, now
  added with it (owners from before: tick it). Scan reads Ohuhu's shop name "Honolulu 24 Skin Tone Colors" as 24
  Portrait (it had added Honolulu 24's markers), and "6 Skin Tone" as the new set.
- **Print on a phone**: the rows are Pages, Paper, Labels, and the close-ups count moved from the foot's summary to
  under the Pages line, so Paper's buttons are on the sheet's first screen at 390 × 844 and 375 × 667, also at 1.6×
  text (at 320 × 568 its label and the summary's link are). Screen readers no longer hear the close-ups count on each
  tap (the summary line still is).
- **One marker count**: Home's Markers card counts colours, the blender aside (120 with Honolulu 120 and its blender),
  as the guide and the welcome do; reverses v309.2, which counted it there. Counts of what's stored, shown, printed or
  cleared stay as they are.
- Home's button reads **New guide from a photo** (what it does once a guide is in progress, phone or iPad); the guide's
  ⋯ menu has **Open a PDF** (a phone with guides made had no way to open one).
- **v318.26's run on GitHub**: v310-moodpics and straighten failed in both engines because they expected the toast's
  element to exist: it's made by the first toast, and since v318.26 the welcome shows none. The app was right; the
  tests now allow for it. One WebKit test (v3189-detail's Stop during a closer read, a 120 s out-of-memory simulation)
  passed on its retry: slowness on GitHub, no app fault found.
- **Tests:** test/v31827-v1 (5), -v2 (5); e2e/v31827-v1 (3), -v2 (3); changed on purpose: tabs, v289, print,
  guide-header, v3092 (120 markers), home (a set found by name), test/sets, v310-moodpics, straighten. Cache bumped to
  `marker-studio-v318.27`.

# Changes — v318.28 (a second debugging pass)

Eight reviewers went over the whole app again (markers, Scan, palettes, making and using a guide, saving, output,
layout and screen readers); 31 findings, each checked on v318.27 by one of four fixers, 29 fixed with a test that fails
on v318.27, one not a bug, one left for data.

- **Markers.** Home's count uses the set's own markers, so Copic's 0 counts (all Copic: 358, as the set list and the
  welcome say; Ohuhu's Colorless Blender still apart: Honolulu 120 is 120). Searching "skin tones" in Owned says how
  many more are in All, not "none elsewhere". Tick all shown is greyed when every marker shown is already yours. A
  number searched with other words ("copic 0") matches a name only as the whole number. Not changed: Ohuhu RV33 and RV34
  still share one colour (#efd4e7): no published source; needs a swatch.
- **Scan.** A long pasted list (over 20,000 characters) with both brands reads its end too, so the second brand isn't
  lost (a v318.25 regression: 357 Copic lines became questions). "Honolulu 72 Colors + 6 Skin Tones" finds both sets;
  "Markers - 120 Colors" (a dash with spaces) reads as a size; Find mode's or Scan's brand turns on that brand's set
  names when the text names neither ("6 Skin Tones" with Ohuhu chosen); Ohuhu's blender is said apart in "N added to the
  list". A photo read stopped and replaced no longer lets the old photo's error show on the new one. A batch that ended
  early says "From 2 of 5 photos"; Undo's toast counts the photos read.
- **Palettes.** Tapping a band re-rolls it under the palette's own scheme (Rainbow chosen but not makeable had taken the
  band over); Monochrome from a black keeps its grey family on a band tap; a palette that had to use greys says so; a
  Rainbow's base marker stays named after a band tap (not across a reload); From photo's bands work after a scheme.
- **Making a guide.** A PDF with more than 60 pages shows them 60 at a time with "Pages 61–120" (it showed only the
  first 60). Sections left white are out of the counts that guide the marker slider, the Gradient counts, "Every section
  has its own marker" and Main colour's note (balance percentages are now of the coloured area).
- **Random, found while testing this pass:** with Keep touching sections clearly different on, v318.27's repair could
  move sections from the second colour to the main one past its share (Main colour 62% for 57% asked, about 1 roll in
  75 of a small palette; a unit test failed 1 run in 20). It now moves a section across only while both stay within 4.5
  points: no roll past 5 in 300, as many sections kept apart as before (381 left vs 378 in 300 rolls of 8 markers on
  210 sections). test/balance has a seeded test for it.
- **Using a guide.** A plan step's toast Undo undoes only that step, while it's the newest (it could undo a later Pin);
  lowSwap's Undo too, also at the 30-step limit. Paint on a white section says how to colour it.
- **Saving and output.** A guide only put away no longer reads "not in a backup" after a restart; Duplicate keeps
  "+ N for shading"; a restore with an unfinished delete leaves the guide in the Library, not a "Recently deleted" it
  isn't in. Key + reference's PDF is "…-reference.pdf" (it had Page + key's name). Tester tasks list the details sent.
- **Layout and screen readers.** The colour sizes wrap under "Colours" when they don't fit (320 px, and 360 px at 1.6×,
  had cut 7, 8 and 16). Screen readers hear every toast and the update banner (a status region there from the start; a
  faded toast had left the accessibility tree); dismissing the update banner leaves the focus on the mode button.
  Markers' Order drop-down fits the column; the Change colour scope buttons wrap their words at 320 px 1.6×. Checked and
  fine: the inline link's tap area (51 × 44).
- **Choices left for you:** Paint could colour a white section instead of explaining (changes what Leave white means);
  at 320 px the colour sizes now sit under their label; the Change colour sheet's heading still truncates at 320 px 1.6×
  (a header row shared by other sheets).
- **v318.27's run on GitHub** passed; two WebKit flakes: v3189-detail (a long wait ran out at 5–9× its usual time, two
  runs in a row: a stalled read on GitHub; not reproduced in five loaded runs here; the test now prints what was sent
  to the reader and what came back if it times out) and v3101-d1 (WebKit's page process crashed).
- **Tests:** test/v31828-y1 (5), -y2 (4), balance (+1); e2e/v31828-y1 (6), -y2 (4), -y3 (7), -y4 (5); changed on purpose:
  test/v31827-v1 (Home's count), e2e/v318-scan ("120 and a Colorless Blender added"), v31823 (the banner's words in the
  status region), v3189-detail (diagnostics). Cache bumped to `marker-studio-v318.28`.

# Changes — v318.29 (a new tester's first hour on an iPhone; Ohuhu RV33 and RV34 apart)

Two checkers used the app as brand-new testers on iPhone-sized screens in Safari's engine (390 × 844, and 375 × 667 with
Larger Text), touch: the welcome, adding markers, a first guide, Colour along, Print, the Library, backup, Tester tasks
and Send feedback. Nothing stopped either. Then two fixers checked each finding on v318.28.

- **"Which R27?" offers Copic R27 too.** Adding an Ohuhu set, then typing a Copic code Ohuhu also uses (R27), then a
  Copic-only one (YG17): the question already waiting offered only Ohuhu's two R27s, and choosing Copic left it
  unanswered. When Scan switches to reading both brands, questions already waiting now gain the other brand's markers
  of that code (Keep Ohuhu takes them off again), so choosing Copic answers it. Scan's box, paste, Scan Text and the
  photo reader go through the same switch.
- **The welcome's typed codes, Scan and photos: the Undo is a link in the step, not a toast.** The toast "Added 10
  markers · Undo" sat over "Look around first" on a small phone at Larger Text (a tap there would undo them). As
  v318.26 did for a set and the chart: "Undo: take these 10 markers back out" under "Anything else?". A toast still
  says what's left to do (questions to choose, lines not read), without Undo. Scan from Markers keeps its toast.
- **One count of a guide's markers.** A section changed to a marker outside the palette: the Colours tab said "all · 3"
  while the button under it said "4 markers on this page". The tab now says the guide's own count, as an opened guide's
  does ("all · 4").
- **Rough spots' rings on the line, not on a code.** A shape inside another meets it all the way round, so the middle
  of their line was the shape's own middle, where its code is ("V◯16"). The ring now goes on the line, at the point of
  it nearest that middle.
- **Ohuhu RV33 Thistle and RV34 Faded Lilac** shared one colour (#efd4e7). Ohuhu's own colour chart (Honolulu & Honolulu
  B, 344 colours) has #efd4e7 as RV34's chip (0.7 ΔE2000 from it, the app's colours being that chart's, slightly
  lighter: RV25 1.1, V14 1.6), so the list had RV34's colour on RV33 too. RV33 is now its own chip on that chart,
  lightened as RV34's is: #edd5e5, 1.4 from RV34. Ben's scanned swatch card (1.25 apart) and Ohuhu's photo of a
  hand-swatched chart (2.2) agree they're that close; they disagree on which way RV33 leans. The tests that used them
  as the "Same colour" example make a twin for the test. No two inked markers now share a colour.
- Found while measuring, not changed: Ben's scan disagrees with the app's colours by 2–11 for 14 neighbouring markers
  (RV25 Rosy Lilac 11, RV57 8, RV04 7), scattered in every direction. The app's colours are Ohuhu's own chart's: screen
  colours, not measured ink. Measuring ink is for after the beta.
- **Not reproduced:** Colour along's highlight outlines left offset after turning the phone sideways and back (seen
  once by a checker, once more in eight tries by a fixer, never reliably). A settle pass after the last resize is the
  candidate fix; it needs an iPhone to confirm first. **Left for the form link:** with no form, Send feedback copies the
  report and says to paste it, without saying where.
- **Benchmarks:** guide digest unchanged (49e9f9dacdc7). Colour benchmark: digest 9300c532c0e5 (was b8237b31ced3,
  which RV33's old colour alone gives back): 15 of 9,880 rows differ, all with Honolulu 320 or Large mixed (which hold
  RV33): 14 fewer rough pairs over 13 rows, 2 more low-contrast pairs over 2 rows.
- **Tests:** test/v31829 (2), v31829-z1 (1); e2e/v31829-z1 (2), -z2 (1); changed on purpose: test/v304-match,
  e2e/v304-match (a twin made for the test), e2e/v309-1, v3091-d4, v318-scan (the welcome's Undo link). Cache bumped to
  `marker-studio-v318.29`.

# Changes — v318.30 (a new icon; Help's More you can do and If something goes wrong)

- **A new app icon**: an ink drop drawn like a colouring page, its 12 sections in 11 colours of their own (one from each
  colour family, at its most vivid; the closest two 15.5 apart in ΔE2000, touching ones at least 32) and one left
  white to colour, on the dark ground of the old one. Chosen by Ben from rounds of options (brush, gem, drop; fan,
  stained glass, swirl, rings, leaf, flower inside it). src/assets/icon.svg is now the source, drawn once, and
  scripts/make-icons.mjs renders the PNGs from it; the maskable one is the art at 86%, inside Android's 80% safe circle.
  iOS keeps the icon it saw when the app was added to the Home Screen: testers who added it before see the new one
  only after adding it again.
- **Help › More you can do**: Leave white and Pin, zones, Paint, Shading and Greyscale, Focus mode and Reveal & share,
  Print's three kinds and Guide file, a marker's details (Blends with, Find similar), Match a colour, To buy, the swatch
  chart, and the Library's Duplicate and Recently deleted: what each is for and where it is.
- **Help › If something goes wrong**: wrong sections, a colour that doesn't match your marker, markers or guides
  missing (the Home Screen app and a tab keep their own; Safari's seven days), a slow big photo, a change by mistake, a
  stuck screen or an error, the update line. The README has both lists too.
- **Colours on screen**: README, the tester guide and Help now say they're Ohuhu's and Copic's own published colours,
  and that some markers look quite different on paper (v318.29's measuring), with the swatch chart to compare.
- The README and tester guide: designed for the iPad and checked on iPhone-sized screens (v318.29's check); "a few last
  questions" (five and a name: it said six).
- **The welcome's Type or paste codes**: on a small phone with Larger Text, Scan opened with "1 · Tap the box" while the
  box was below the Photograph card, off the first screen (v318.29's iPhone check). From the welcome's Type, on touch
  screens, Scan's three steps fold into one line (typing, and Scan Text on an iPhone or Gboard's Scan text on Android)
  and the box is scrolled into view above Add. The welcome's Scan caps one at a time and Markers' Scan are as before.
- **The welcome's leftover toast**: after typed, scanned or photographed markers are added with something still to do
  (questions to choose, lines not read, a set's missing markers, the older-codes offer), it's said in the "Anything
  else?" step's own line with Open and Undo ("1 still to choose: Open · Undo"), not in a 10 s toast over its buttons.
  Open reopens Scan as the welcome's. Markers' Scan keeps its toast.
- **After the screen turns or resizes**: the picture's overlays (Colour along's outlines, rough-spot rings, zones,
  specks, the tap box, the sun) are measured again 250 ms after the last resize, turn or visual-viewport change, not
  only when the picture's resize animation ends, which Safari doesn't always report when a phone turns (v318.29's
  checker saw Colour along's outlines left offset). Nothing is redrawn when nothing changed; it waits while a finger
  is down or the iPad keyboard is up.
- **Rainbow's base after a reload**: "Rainbow · Ohuhu Shamrock Green base" (v318.28 kept it across band taps) now
  survives a reload: saved beside the palettes' schemes (palB), dropped where the palette no longer holds that marker.
  Versions before v318.22 ignore it; v318.22–29 carry it unchanged.
- **Tests:** test/v31830 (4: the sections' place, every label they name is one on screen, the colour line in all
  four places, the icon); e2e/v31830-w1 (4: the typed layout at four sizes, Android's words, the leftover line, Markers'
  toast kept), -w2 (7: overlays after a turn in Colour along, Focus mode and the Plan at two sizes, Rainbow's base after
  a reload); changed on purpose: e2e/help and e2e/v308-beta (the Help sections' list), e2e/v3091-d4 (the step's Open),
  e2e/helpers (openApp's touch option). Cache bumped to `marker-studio-v318.30`.

# Changes — v318.31 (a fix from v318.30's run on GitHub)

- **The settle pass after a resize (v318.30) armed itself again every 250 ms while the iPad's keyboard was up over a
  guide's code box** (and while a finger stayed down), a timer that never ended until the keyboard went: on GitHub,
  v306-along's "the keyboard up over the code box" timed out waiting for the page to go idle, in Chromium and WebKit.
  It now waits without a timer: the finger lifted (pointerup, pointercancel) or the keyboard going down (focusout, the
  visual viewport's resize) brings it back. That test fails on v318.30 and passes now; e2e/v31830-w2 still passes in
  both engines.
- Cache bumped to `marker-studio-v318.31`.

# Changes — v318.32 (the photo specks; Ben's iPad findings; fixes from Fable's review round)

- **Phantom specks in a guide from a photo** (Ben: purple specks unless Sensitivity was slid to 1). Two parts:
  - **Sensitivity starts at 5 for a straightened photo** (was 7; SENS_PHOTO adaptC 6 → 9). On Ben's 36 printed-page
    photos specks fell 295 → 226 and spurious sections 474 → 380, matched 92.65% → 92.71%; on his 5 zentangle photos
    matched 77.8% → 77.2% (fine detail likes a higher Sensitivity: raising it brings that back). Below 5 there were no
    fewer specks and more splits.
  - **crumbClean** (10-segment.js, its own step after the sections are drawn): the paper between grain dots, and a
    photographed page edge in shadow pocked with holes, become paper. Away from the edge band a crumb must be under
    3 mm² on the page and lie between two or more pieces of ink, so a small shape drawn on its own (a ring, a bead, a
    flower's petal, a letter's hole) keeps its section; its limits come from the page's size, never the user's Min
    section size; the edge band goes only when it's a solid strip of small holes (lace or hatching along an edge keeps
    its ink). Fable's pressure test found the first version deleted such shapes (a dotted mandala lost all 682
    sections): those drawings are now tests. On Ben's Specks photos the default now gives what Sensitivity 1 gave
    (IMG_0070 225/225, 0069 102/103, 0071 234/232; 0068 437/431, its extra specks in the table outside the page).
  - The "coloured in already" warning counts only the small crumbs it took (a clean photo with a shaded edge had been
    told it was coloured), and the count travels with the detection (Undo).
- **Focus mode**: an **Exit** pill; the next-marker card never runs off screen or under the bars, and on a small phone
  at large text a side that would clip it loses to one that shows it whole; it reframes once the bars have measured.
- **Home** features your newest unfinished guide, started or not ("Your latest guide · not started · Open").
- **Edit sections after a guide is opened again**: Adjust photo says the photo isn't kept with a saved guide and offers
  Choose the photo again (keeping it is planned for v318.34). Opening Adjust photo scrolls it into view above the
  Build bar.
- **Palette › Start from** on an iPad held upright: the colour cards were 2 px slivers in Safari (grid rows sized to
  nothing in the first layout). The button reads "Start from a marker… (random)".
- **Guide › Pattern › Random**: Balance's row fills like the others, with a line saying what it does; the role bar is
  a named group for screen readers; No repeats' note is plainer; Colours says why its count is greyed.
- **The browser tab's icon** is the new one.
- **The welcome**: Done in "Add your markers one by one". **Straightening when the app isn't sure of the page**: the
  note says to drag the yellow corners; with a sensible outline Straighten is the main button. **What's new** has its
  own Help section, and after an update Home says so once. **Markers chart**: "… unticked · Undo". **Shading**: hints
  for Marker texture and Neuro. **Gradient**: "Matching shapes get the same colour (mandalas)". **Home's tester card**:
  the footer's Tester tasks link hides while the card shows; its › no longer wraps alone.
- **Scan**: closing it while the reader was starting left the read waiting for good, holding the photo's pixels; a list
  file saved as Unicode (UTF-16, Excel's Unicode Text) was read as UTF-8 and added the wrong markers; a reload in the
  middle of a read was taken for a memory failure and read gently for 14 days; a photo pasted into the box is now read.
- **The service worker** stores only the app's own files. **No repeats**' bookkeeping can't drop a marker if a pool
  ever held one twice.
- **Fable's review round** (eight checkers: the plan, the speck fix, debugging passes of the reader, the guide engine
  and the shell, UI, engine and design reviews) found no bug in the guide engine and none in saving, the keyboard
  settle pass or Focus; its findings are in docs/PLAN-v31832.md, built over v318.32–v318.36.
- **Benchmarks:** guide digest 847270804501 (was 49e9f9dacdc7): every clean row as v318.31; photo rows t17 better
  (matched 88.1% → 90.5%), h08 zentangle 61.8% → 56.8% (Sensitivity 5), others within one spurious section. Photo
  benchmark as above. Colour benchmark: 0 gate failures.
- **Tests:** test/v31832-crumbs (12), v31832-fixes (3); e2e/v31832-g1…g4, -fixes, -ocr-start, -ui-wins; changed on
  purpose: e2e/balance, home, v306-home, v308-intake (Sensitivity 5), v313-photo, help, v308-beta, tasks-card, v306-smalls,
  v3083-data, v305-tobuy, v31832-g1; test/v306-smalls, v31830 (Help's order), v307-markers (the worker's origin).
  Cache bumped to `marker-studio-v318.32`.

# Changes — v318.33 (the design pass: a design system and screen polish)

From Fable's design review (round R32, V1), built in two parts and compared screen by screen before and after (phone
390×844, iPad 820×1180 and 1180×820 in Safari's engine, Larger text 1.3).

- **Tokens** (src/css/01-base.css): spacing --s1…--s6 (4, 8, 12, 16, 24, 32), heights --h-ctl 44 (buttons and fields),
  --h-seg 40 (a choice inside a 3 px track), --h-sm 36, line heights --lh-tight 1.2 and --lh 1.45. The shared rules use
  them: rows 12 apart, groups 16; the search box 48 → 44, Markers' Order 40 → 44, the top tabs 38 → 40.
- **Corners**: one rule — 6 badges, 8 nested segments, 12 every standalone control (the button default was 16), 16
  cards, tracks and sheets (sheets were 18).
- **One "chosen" look**: the white pill only for where you are (the main tabs); every setting is a teal choice inside
  a track (Colours from, Lean towards, Mood words, Light from, Fit, Shading presets, Pattern's family, Look, Direction,
  Mix and Balance, the edit tools, Colour along's order); cards only where there's a picture (Mood, Flow, Theme).
- **Palette › Harmony** is a grid of three columns (two at Larger text on a phone, so "Complementary" is never broken
  mid-word); on a phone the label sits above it.
- **Markers**: Random, Match a colour, Add markers and Swatch chart are one row of matching buttons (Swatch chart was
  an underlined link, Add markers a bigger button of its own): the first swatch is 70 px higher on a phone.
- **A guide**: Colours / Pattern / Shading / Share & print are underline tabs (they looked like a second copy of the
  main tabs), 44 px, still pinned when you scroll; the picture dims behind the guide's sheets (the ⋯ menu, Change
  colour): taps pass through as before; the guide's name is in the title font (Fraunces).
- **The Library, empty**: its icon in a tinted ring above the text and Try the sample.
- **Found on the way**: Focus mode's Exit pill was 40 px with no 44 px tap area (fixed); Colour along's order row as a
  track had pushed the first row under the bar at 375×667 (fixed); the ⋯ menu doesn't close on a tap outside it (as in
  v318.31; left as is, and the backdrop lets those taps through).
- **Tests:** e2e/v31833-design (5), v31833-polish (5); changed on purpose: e2e/buttons (tool heights, the tabs 44, a
  second guide in its fixture so Your guides shows), e2e/markers (Swatch chart without ↓). Chromium 290/291 then the
  last fixed; WebKit 113 pass, 6 skipped by design. Cache bumped to `marker-studio-v318.33`.

# Changes — v318.34 (the five features: the photo kept with each guide, three harmonies, Colours from, Random's rows, Markers › Random)

- **Edit sections after a guide is opened again keeps Adjust photo** (Ben's finding; plan C, decisions 3a–3e): the
  picture a guide was built from — a photo as taken, a scan, a download or a PDF page, at the size it was built at
  (up to 2400 px; JPEG q 0.9, PNG for line art when smaller) — is kept on this device in a record of its own
  (`src-<id>`, src/js/guide/25-source-photo.js), and its settings (corners, page shape, turn, tilt, crop, Enhance,
  Sensitivity, faint marks) in the guide itself (`src`), so the two can never disagree. Nothing is read when a guide
  opens; Adjust photo says "Getting the photo ready…" and then works as on the first build. Changing it after
  colouring has started warns that progress is cleared, with Undo, as on a first build. Save a copy, "(section
  edits)" copies and Duplicate carry it; it goes with the guide when deleted for good, and stays through Recently
  deleted. Backups leave these pictures out unless "Include guide photos (bigger backup)" is ticked (off by default:
  restoring a big backup is done all in memory); finished-page photos are in backups as before. A picture that can't
  be kept (storage full) never stops the guide saving: it says so once, and Edit sections shows v318.32's note. Not
  in shared guide files. Guides from before v318.34 have no picture kept and show that note.
- **Three new harmonies** (plan D, decisions 4a–4e), after Monochrome in Palette and in a guide's New palette:
  **Light to shadow** (one ramp from the base's lightest to a hue 90–120° away at the dark end, turning toward blue-
  violet, as shadows do), **Analogous + accent** (a fan round the base and one accent from across the wheel) and
  **Greys + accent** (greys in a lightness ramp, from one family where it can, and one clear colour). Greys + accent
  needs 3 greys among the markers in play: below that its button is greyed with the reason, Surprise never picks it,
  and a guide whose greys drop below 3 makes Analogous + accent instead, with a note. One definition of grey
  everywhere (chroma under 12). On sets under 72 markers the three go up to 6 colours, 8 from 72.
- **Evenly stepped ramps** (E1-4): Monochrome, Analogous, Light to shadow and Greys + accent's greys now choose their
  ramp as a whole (the most even steps the markers allow, a little randomness among the best), not one colour at a
  time. Median ratio of the biggest to the smallest lightness step over 60 rolls: Honolulu 320 Monochrome 6 6.8 → 1.8,
  8 8.3 → 2.8, Analogous 6 8.6 → 1.6; Honolulu 120 Monochrome 6 → 2.3. Saved palettes keep their markers.
- **Guide › Colours › Colours from: Your markers | A palette** (plan F, decisions 5b, 5c). A palette shows as a card:
  its swatches, name, how many markers, its scheme and where it came from (Made here, From Palette, From your
  Library), ✕ back to your markers. Under it: New palette (with its harmony), Change it in Palette › (opens it in
  Palette; Use in a guide › Recolour comes back), Choose a saved palette…, and Save to Library (keeps the palette on
  the card). When the palette holds fewer markers than the guide asks for: "A palette of 8: tick Expand for more".
  Choosing a saved palette now copies its markers into the guide, so deleting it from the Library changes nothing;
  a guide from before whose palette was deleted says "Palette deleted · Choose another". Surprise keeps a palette
  you chose and surprises the rest ("Kept your palette"). Help's Glossary has Colours from; the tester task mentions
  the guide's own way.


- **Markers › Random, tidied (plan G1–G9):** a line says what it's for ("A marker you wouldn't have picked: draw one
  at random, as a prompt or a challenge"), with a Help bullet under More you can do. A shorter card (about 200 px on
  an iPad upright, 160 on a phone), no empty band under an undrawn card, the back control at the left. The buttons
  say what they act on: Draw a marker · Swap this one · Remove this one · Clear all (armed). The Drawn pile sits
  right under the buttons; the markers left to draw are folded away ("Show the N left to draw"), grouped by family,
  lightest first. Held sideways on an iPad, two columns: the card and buttons, then the pile, count, Filters and the
  fold (chrome.js rndSidePlace, as Palette's palFiltersPlace). The count takes every drawn marker ("5 drawn, 138
  left to draw · 2 not in the filter"; state.js counts() d/out). Use in a guide for a draw of two or more (handed
  over as a palette of chosen markers); Remove this one and Clear all have Undo. Markers' tools: "Draw from these"
  beside "Palette from these" (Random from the markers shown, as a selection).
- **Prefer markers you haven't used yet** (remembered: state.rndFresh): a draw leaves out the markers of every guide
  you've worked with — the guide row's additive flag `wk` (guide-bridge guideMeta, library.js guideWorked), set on a
  tick or tone (at the guide's save: done/tn), Colour along, Focus mode, Print, Save image, Share (guide file, Reveal
  clip) and a finished photo; older rows count with done > 0, tn > 0 or fn (state.js usedKeys). When every marker
  left has been used it says so and draws from all. A line under the box says how many of those left are unused.
- **Guide › Pattern › Random, the roles as rows (plan E, decision 5a):** with Main colour, a thin strip of the
  shares and then a 44 px row for each role, "Main colour · pinks · about 60% · Auto ›" (or "Your choice" for a
  family picked by hand), each opening the role's sheet as before; a screen reader hears "Main colour: pinks, about
  60%, Auto. Change". The bar of three coloured buttons it replaces dropped the accent's name where it didn't fit and
  had no word for Auto. Random's own action row holds Shuffle and, with Main colour laid, ↻ Other pairings, with a
  line telling them apart ("Shuffle lays the same colours again · Other pairings picks new colours for the roles on
  Auto"); Pin colours stays below, shared by every pattern (e2e/tabs updated: Shuffle is no longer beside Pin for
  Random).
- **Tests:** e2e/v31834-source-photo (5), -harmonies (3), -colours-from (5), -balance-rows (3), -random (7);
  test/v31834-source-photo (2), -harmonies (5), -random (4). Changed on purpose: e2e/v31832-g2 (the A3 note is for an
  older guide now), palette, style-fields, gradient, held, v308-colour, controls-wiring, v308-handover, v310-moodpics,
  v306-dbg-home, v31833-design (12 harmonies), balance, tabs, v31832-g4; test/style-fields (`src` after `frame`),
  palette-generator; e2e/fixtures/style-golden.json regenerated (the saved-palette copy; Surprise's ramp). Cache
  bumped to `marker-studio-v318.34`.

# Changes — v318.35 (engine upgrades: the page finder, part-coloured pages, hatching, smaller PDFs)

- **The page finder's edge fallback (Fable E1-1, plan Stage 4 › 1; 22-straighten pgEdges):** a page on a desk nearly
  as bright as the paper (a light grey or white table, the light falling off across the photo) had no paper/table
  split the block views could find: the paper candidate "filled" and nothing was offered (bench HELD h17 "medium RGB"
  found none, corners 55% off; TUNE t07 unsure on a wrong outline, t08 none). Now, when no candidate is sure, the
  gradient of the white-balanced grey on the 720 px copy is thinned to its ridges, each ridge that is a step (not a
  drawn line: 4 px past it either way the dark side stays dark) votes for the lines through it running its own way,
  the strongest few lines per side whose step rises inward make the quads, and a quad with every side at least half
  covered by its ridge goes to pgJudge as any other candidate (its step measured at the edge itself, since the page as a
  whole hardly stands out there). A page cut off by the photo's edge has no line along it and gets no quad. Bench photo
  rows: h17 found sure (corners 0.4% off; matched 75.0 → 85.1%, defects 20 → 13), t07 sure (0.25%; 86.1 → 100%,
  defects 52 → 0), h08 sure (0.12%, was unsure at 0.69%), t08 sure (0.26%, was none); every other row unchanged. The
  fallback costs about 75–110 ms on the 720 px copy (it does not run when a candidate is already sure).
  `node scripts/bench/run.mjs --photos-only` runs the photo rows alone. Tests: test/v31835-page-edges (5: a light page
  on a light desk under falling light, a shadowed edge, a page turned 22°, a page cut off by the photo's edge, a grid
  drawn to the edge of a plain copy). The quad found this way is set 3 px (on the 720 px copy) inside its edges, onto
  the paper: on Ben's IMG_0071 the warped page had kept a frame of the desk's shadow as ink, closing in its margins as
  sections to colour.
- **Part-coloured pages (Fable E1-3):** on a page with colour in it (colourShare over 1%), ink is now dark AND
  colourless (each pixel's spread of R, G, B after the paper's white balance, `chroma`): a section coloured in with a
  mid or dark marker stays a section instead of being read as ink and lost. A greyscale page runs exactly as before.
  After Build guide, sections already coloured on the page (half or more of their pixels clearly coloured) get an
  offer, never a tick by itself: "N sections look coloured in already · Mark them done", with Undo. The "coloured in
  already" warning now says a partly coloured page works. Guide bench: the coloured pages at 1,200 px h17 84.1% →
  100% (defects 14 → 0), t17 91.7% → 100%; photographed, t17 90.5% → 98.8%, h17 as taken 75.0% → 97.5%; every
  greyscale page identical.
- **Hatching as one section (Fable E1-2):** close parallel shading lines, and cross-hatching, had left every gap between
  the lines a section of its own (the bench's zentangle page: 1,594 "hatch slivers" at 1,200 px). A step of its own
  after the crumbs (`hatchMerge`) merges each hatched patch into one section, its lines kept: gaps under 1.5 mm on the
  page and over four times as long as wide (or small cells both ways, for cross-hatching), side by side across one of
  the patch's own lines, running the same way (±15°), six or more, evenly spaced. Wide stripes, a five-rung ladder and
  a patch beside one hatched alike across a thicker outline stay apart. Edit sections has "Treat hatching as one
  section" (one Undo step to change, as Sensitivity). It starts **on for a scan, a download or a PDF page and off for a
  camera photo** (straightened, lens known, or kept as photographed): on Ben's photographed zentangle pages it took real
  cells together (54–61 merged sections a page), while on clean pages it lost no match. Guide bench, clean zentangle
  pages: spurious 1,594 → 131 at 1,200 px (1,605 → 76 at 2,400), matched 99.3% → 99.8–100%.
- **Smaller PDFs (Fable E1-8):** pages carrying the picture in colour (the key page with the reference, Key +
  reference, their close-ups) are stored as JPEG (q 0.9) where that's smaller than the lossless copy; the colouring
  page stays lossless. The sample's Key + reference 2.13 → 1.36 MB, Page + key 1.68 → 1.56 MB.
- **Measured and not shipped:** the reader on several threads (cross-origin isolation from the service worker): two
  threads read a tray 0.5–0.7× as fast in Chromium on this machine and stalled in WebKit, and isolation would block the
  tester form's send on an iPad. Guards on the Copic lost-first-letter re-read (docs/READER-DETAIL.md): on the 16
  bench photos with Copic caps, the same wrong reads and 2 caps fewer found. A 2-opt pass on Limited gradients' order:
  as many builds rougher as smoother (their rough steps are where one band meets the next, not within a band).
- **Benchmarks:** guide benchmark at 1,200 px, all pages: tuning set matched 98.4% → 99.0%, defects 31 → 16, spurious
  1,664 → 172; held-out set 98.0% → 98.8%, 36 → 21, 680 → 161 (digest a4e6b091e901). Colour benchmark: 0 gate failures (digest 5d6964ea83ca). Of 348 rows, 54 better, 293 the
  same, 1 worse (the zentangle page at 400 px, one defect: its hatched patch is one section the scorer counts as
  missed). Ben's printed-page photos: see the CHANGES line under the finder (matched 92.7% → 93.4% on the 36
  non-zentangle photos; zentangle 77.2% → 78.1%); two photos score lower now that the finder straightens them (a
  faint page far away in the frame, IMG_0047 botanical 74% → 59%; IMG_0048 zentangle 57% → 56%).

# Changes — v318.36 (Stage 5: the sections found off the page)

- **A photo's sections found in the worker (plan Stage 5, decision 8.9; 03-jobs, 10-segment, 22-straighten):** a big
  photo froze the screen while it loaded (Ben's note, Oct 2026: 2–3 s on an iPad). The steps that take the time and
  read nothing of the page — the page finder's finding on the 720 px copy (pgFindCore), then the ink, its smoothing,
  the specks and the flood fill — now run in the guide's JOBS worker (jobs 'pgf' and 'seg'), the page only painting
  meanwhile; the steps that need the page (the background, page and frame; the crumbs; the hatching) stay on it, with
  a paint between them as before. The worker runs the page's own functions, copied in with the same constants and the
  detection settings sent with each job, on the same picture, so the sections, their figures, the faint-marks and
  speck findings and the page's corners are exactly what the page would find (e2e `v31836-worker`: the same on a
  1800 × 2400 grainy photo with colour, the fixtures and the sample, at another Sensitivity and with faint marks
  ignored; the guide benchmark runs the page's own path and is unchanged). A new picture's grey and colour are handed
  over to the worker and back, not copied (the page makes them again from the photo should the worker lose them);
  when the sections are found again on the open picture, its grey stays in place and the worker gets a copy (a few
  ms). The labels and the ink blobs come back handed over too. A newer run takes over in the worker as well: the older
  job stops at its next step (the thread is free between steps) and is dropped, so a Sensitivity slider dragged
  quickly costs no more than its last position. Where there's no worker, or it fails or gives no answer in time
  ('seg' is given 4 s and 2 s more per million pixels), the page does the steps itself, as before, said nowhere. On the
  test machine the page's longest hold while a 1800 × 2400 photo opened fell from 225 ms (the page finder; the blur
  150, specks 119, sections 109) to 150 ms (the photo prepared from its canvas, which only the page can read) in
  Chromium, and from 376 ms (the blur; the page finder 243) to 322 ms (prepared) in WebKit.
- A test hook: `jobs.hang(ms, kind)` makes only jobs of one kind go unanswered. `e2e/v307-final`: a new photo's first
  job is now the page finder's, so that is the one that times out when the worker never answers.

- **A test fixed from v318.35:** e2e/v307-speed's "the same file byte for byte" built its reference PDF without the
  JPEG choice exportPDF now makes for pages in colour (v318.35's smaller PDFs); it now passes the same choice.
- **The page finder's edge fallback (v318.35) took a thick drawn line for a page edge:** a download with a grid drawn
  in 24 px lines had its inner lines taken for the page, and the guide kept 16 of its 48 boxes (e2e random-and-blend).
  A page edge's step now has to last: 12 and 24 px past it on the 720 px copy the desk is still darker than the paper,
  where a drawn line ends and the paper comes back.
- **Home's Tester tasks line stays** while the tester card shows (v318.32 had put it away, V1-8): it's the one way
  into the tasks that's always there and opens them at the top, and a dozen tester flows rely on it.
- **A full local run of every browser test** (Chromium, 1,561 tests in two halves side by side) for the beta, which
  the releases since v318.32 had only run in part, found tests left behind by those releases, now brought up to date:
  e2e/help (the Glossary's Colours from, v318.34), toasts-and-errors (the untick toast's words, v318.32), v302 (two
  Colours from segments, a track, v318.33–34), v304-segmentation (its dense pages of tiny cells are cross-hatching to
  Treat hatching as one section, so those tests untick it, v318.35), v315 (guide building now finds the page on a grey
  table too, with the right corners, v318.35); and the tester-flow files (v312-tester, v3121, v318-review-ux,
  v31826-w2, v31828-y3) pass again with the line back. e2e/v31836-worker's timing claim is "less", not "15% less":
  under two runs side by side it held 332 against 375 ms.
- Cache bumped to `marker-studio-v318.36`.

# Changes — v319, the beta (fixes from Fable's debugging passes R36 and R37)

- **Coloured outlines (v318.35's regression):** the part-coloured-pages rule took ink in colour for marker fill, so a
  page drawn in red, blue or green lines lost every section whenever Enhance was off or the page had a dark area (a
  black title). inkLinesColoured now asks first whether the page's thin ink, its lines, is the coloured ink; when it
  is, no colour cut and no mark-done offer for that picture. Black-line pages with coloured fills keep v318.35's gain.
- **A cropped guide kept its photo but couldn't use it (v318.34):** the crop and corners were saved rounded to 1/100,
  so the picture rebuilt on reopening came out a few pixels off the saved sections and was refused ("isn't kept").
  They're saved exactly now; a picture within 2 px of the saved size is fitted to it, so guides saved by v318.34–36
  with a crop mostly recover. Two rare first-save paths (another tab adopting the guide; a picture changed during the
  first save) now keep the photo too. The worker's queue no longer stretches a hung job's timeout behind superseded
  ones.
- **Palette:** a colour locked in Analogous + accent or Light to shadow keeps its place in the scheme (the base had
  been taken from the locked colour's own hue: lock the accent and Generate made five greens). Greys + accent started
  from a grey puts the grey on the ramp and finds an accent; with no clear colour among your markers it says so. The
  guide's Greys + accent fallback note goes with Undo; a guide's palette deleted from the Library says so on its card
  and can be saved again.
- **Markers › Random:** the Undo after Remove this one or Clear all goes as soon as you draw again, and can't undo a
  later draw.
- **Hatching:** the switch works after Keep as is on a scan or download (only a camera photo waits for straightening,
  and the note says so); "Found N hatched patches" no longer carries over to the next guide; Undo of a re-detection
  shows the right wording; a cross-hatched page with the switch off is told to try it, not that it's "a photo or
  textured image"; Undo's memory budget counts the colour copy.
- **The ⋯ menu's dim (Ben's decision):** a tap on it closes the menu and nothing else; the colour picker still lets
  taps reach the picture.
- **What's new (Ben's decision):** after an update, Help lists every version since the one last seen (up to 8).
- **Tap areas:** checkbox rows in the guide, Colour along's More, the Library's search and sort, and the guide's
  drop-downs reach 44 px; Home's three cards line up at 320 px.
- **Tests:** test/v31837-segment (10), v31837-palettes (6), v31837-jobs (3); e2e/v31837-coloured-lines (1),
  v31837-src-crop (6), v31837-palettes (9), v31837-shell (5). Changed on purpose: test/v31835-hatching (a lens-less
  kept picture merges), e2e/v31833-polish and sheet (the dim takes taps), v31832-ui-wins (the tester line stays; What's
  new since), v31834-colours-from (deleted palette), v31836-worker (its timing measured twice when close).
- **From the second pass (R37):**
  - **Coloured ink, decided per patch (replaces v318.37's page-wide verdict):** a page with coloured outlines lost every
    section once about five cells were coloured with a dark marker, or when its lines were 2 mm or thicker. Coloured
    ink is now cut as fill only where it is a patch bordered mostly by black ink (a fill in an outlined cell); coloured
    ink running along open paper is a line and stays, however many cells are coloured in. Paper gaps under 1 mm inside
    a coloured patch are closed first, so a fill coloured in strokes with gaps stays one fill. The picture's colour is
    never dropped, so the mark-done offer and later re-detections keep it. About 0.25 s more per detection at 2400 px,
    in the worker. Guide benchmark rows on the coloured, hatched and plain pages: identical.
  - **The dim's tap (v318.37's own):** on a touch screen the tap that closed the menu went on to click whatever the
    page scrolled under the finger as the menu closed (the Markers tab). The dim now swallows the touch's click and
    stays, unseen, until it lands (or 350 ms).
  - A camera photo's "kept as photographed" state no longer carries over to the sample or an older guide; the dry
    hatching check runs once per detection, not on every Min section size change.
  - Palette: Greys + accent from a grey with the accent locked keeps the lock. In a guide, choosing Greys + accent
    while Include › Greys & black is off turns the greys on with it (one Undo step, and Undo says so); it is greyed,
    with its reason, only when the set has too few greys. With the greys turned off afterwards it falls back to
    Analogous + accent per palette made, not for good, and pale tints no longer stand in for greys. Random: a tap on a
    pile cell gives its own Undo.
  - Help's What's new over several versions with the last seen unknown is headed "What's new". A guide saved by
    v318.34–36 with a crop recovers its photo when the rebuilt picture is within 1% of the saved size (97–100% of
    simulated crops; v319 saves exactly and marks it). A photo too big to keep says so rather than blaming storage.
  - **Tests:** test/v319-colour-ink (7), v319-palettes (4), v319-src-fit (2); e2e/v319-colour-ink (1), v319-palettes (6),
    v319-scrim-tap (5), v319-shell (3), v319-src-fit (6). Changed on purpose: test/v31837-segment, e2e/v31837-coloured-
    lines, v31837-src-crop, v31834-harmonies, v31837-palettes, palette.
- **GitHub's test run (no change to the app):** run #66 lost three parts before any test ran, each stuck installing the
  browser's system libraries from a slow package server. apt now gives up on a stalled download after 30 s and tries
  it again (up to 5 times), the library install gets a 4th try, each next try waits a little first (30 s, then 60 s,
  then 90 s; e2e/ci-try.sh), and the jobs have 10 more minutes to allow for it.
- Cache bumped to `marker-studio-v319`.
