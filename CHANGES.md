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
