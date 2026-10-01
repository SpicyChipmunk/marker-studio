# Fresh-eyes review (v288) and the next version

Four independent reviewers went over v288:

- the code: logic, saving and data;
- a hands-on bug hunt in a browser: whole sessions, reloads at awkward moments, two tabs, restores, many guides, rotating an iPad, large text, the keyboard;
- a hands-on UX walkthrough at iPad portrait (834×1194), iPad landscape (1194×834), phone (390×844), small phone (320×568) and large text;
- words, consistency and accessibility.

The clear bugs were reproduced, fixed and tested (`e2e/v289.test.mjs`); CHANGES.md lists them under v289. Below are the rest: the decisions, ranked, each with its recommendation (all built in v289 as recommended, #17 included; the Library as a screen of its own in #8 is still for later), then the known limits.

## Fixed (v289)

- Edit sections › ← Plan › Discard on section edits brought back by Resume kept the edited map on screen, and the next tick could save it over the guide as built.
- "New guide with it", then a photo that won't open: the open guide was switched to the new palette. The palette is now taken only once the photo has opened, and the sample takes it too.
- Discard with more section edits than Undo keeps could report success with merges still in the map, after which colouring wasn't saved.
- Palette › Use in a guide › Recolour from Colour along or Edit sections said "Recoloured" and changed nothing; it now goes back to the Plan first, and with section edits not built it says to build or discard them first.
- Change colour open as an iPad turns from landscape to portrait (or a window narrows to a phone): the sheet collapsed to one row, or its Done went off the screen.
- A backup restored over a guide deleted while open: the open guide kept showing unsaved ticks as "Saved"; it becomes the restored guide.
- Generate palette and Draw a marker dropped the keyboard's focus to the page.
- Edit sections on a phone: the tool buttons sat under the bar on the first screen.
- Going Home straight after colouring showed no Continue card for a moment; the guide now saves as you leave it.
- A colour only being tried in Change colour was kept as a pin by going to another screen (Cancel, Escape and a reload all discard it).
- "Removed from your Library" now shows over "Section edits not saved" when the open guide was deleted mid-edit.
- Narrow phones with large text: "Colours" and "Shading" were cut in the tab row.
- Focus mode's page progress for screen readers; ← Plan and Build's names; a palette band says what a tap does (and "locked"); "Tap a section…" no longer sits beside the kept or pinned line; the row outline frees its canvases.
- Words: "Kept 1 coloured section as it is"; the backup error points to the Library; the glossary's "Background / left out"; one pattern for tap-twice ("Untick 120 markers? Tap again"); "Couldn't copy", "Couldn't save", "That file isn't a Marker Studio guide"; "My collection" on the swatch chart; "Smouldering"; curly apostrophes; the pinned line isn't announced twice; the tool line says what Full screen does.

## Decisions (built in v289)

**Small phones and large text**

1. **The Plan's first screen has no choices on a small phone.** At 320×568 the first view is the picture, its tools and the bar; the tabs are a scroll away. At 390 with large text the tabs show but nothing under them. *Recommend:* on short screens start the picture smaller, so the tabs and their first row show; it still grows back as you scroll up. (M)
2. **Focus mode's Greyscale and zoom buttons sit on the picture on a phone.** They cover its bottom right corner. *Recommend:* a slim strip above the bottom bar, as iPad landscape already has them off the picture. (S)

**One thing, one count, one word**

3. **The marker count says three things.** After one Change colour the Plan shows "Markers in this guide 16", "Using 16 of 120 markers" and "17 markers on this page ›". *Recommend:* the slider keeps "Markers in this guide" (what you asked for), the button says what's on the page, and the line under it says where they come from ("From your 120 markers"). (S)
4. **Two lines under the tabs on the sample's first view:** "This sample isn't in your Library yet" over "Tap a section…". *Recommend:* "Tap a section…" first; the sample's line waits for the next tab or visit (it's one at a time everywhere else now). (S)
5. **Colour along's words:** "✓ Mark all done", "Clear ticks", "All 9 sections ticked", "Page complete", and "All caught up" when skipped sections are left. *Recommend:* "Mark all coloured", "Clear", "All 9 coloured", "Page finished", "Only skipped sections left". (S)
6. **Smaller words:** "Colour guide" as a default name → "Colouring guide"; Library's "Draw" → "Random draw"; "Use this palette" → "Use this palette in a guide?" with "Recolour this guide" (a long name made the button three lines); "Kept. Now changing…" in Change colour → "Done. Now changing…"; "Autoclose loops" → "Join the ends of a loop for me"; jargon: "Smooth my ramps", "Seed the palette", "Re-detected", "decode", "un-mark". *Recommend:* all of these. (S)

**Screens**

7. **Markers:** its ⋯ sits alone at the right below the last marker and its menu covers "Palette from these"; Random and Match a colour, tools rather than your collection, take the top as two big buttons. *Recommend:* ⋯ beside "Showing 120 markers · Copy codes"; Random and Match as smaller buttons. (S)
8. **Library:** its subtitle says "Tap a palette to load it" with no palettes; each tile's ⋯ sits over the picture; a guide's line reads "Guide · 16 markers · Oct 1" where Home says "today · not started". *Recommend:* a subtitle that fits what's there, ⋯ on the name's row, Home's words for progress and dates. (S) A Library that's a screen of its own (in the menu) rather than a dialog: later. (M)
9. **iPad Home:** a Library card, "All guides (3) ›" and Your guides all lead to the Library, and a large amber backup card shows on day one beside Continue. *Recommend:* once you have guides, "All guides ›" replaces the Library card; the backup card after the usual 14 days, one line. (S)
10. **Palette:** saved palettes are only reached through ⋯ › Library; "Seed: Random base" is jargon; on iPad "Custom" and "Photo" wrap onto a line of their own. *Recommend:* a "Saved palettes ›" link, "Start from" for Seed, Custom and Photo on their own row. (S)

**Safety and navigation**

11. **The browser's or Android's Back leaves the app** from Focus mode, a sheet or the Library (nothing is lost; Forward lands on Home). *Recommend:* Back closes what's open first (sheet, dialog, Library, Focus mode, Colour along), then leaves. (M)
12. **Home › New colouring guide with section edits not built:** the "Section edits not saved" question comes only after a photo is chosen, and Cancel throws that photo away. *Recommend:* with edits pending, New colouring guide goes to the Guide screen and asks first (iOS needs the picker opened from the tap, so it can't ask then open it). (S)
13. **Restore's "Replace my markers / Keep mine"** has no Cancel: Escape keeps your markers but still adds everything else. *Recommend:* a Cancel that restores nothing. (S)
14. **A restore that's newer than the open guide replaces it** (newer wins) and the summary doesn't say the open guide changed. *Recommend:* say so ("“Rose” was replaced by the backup's newer copy"). (S)

**Sheets**

15. **Change colour's In this guide strip** cuts its last swatch ("RV3…") with no sign there's more. *Recommend:* a soft fade at its edge. (S) **Print's Paper choices** start under the summary on a small phone. *Recommend:* a shorter summary there. (S)
16. **The markers list's title** ("16 markers on this page") doesn't count the "For shading" markers under it. *Recommend:* "16 markers on this page, 3 more for shading". (S)
17. **Change colour by keyboard** is 140 Tab stops. *Recommend:* arrow keys within each row and group, one Tab stop each. (M, low priority: Help says choosing a section needs touch or a mouse.)

## Known limits (not changed)

- The v287 list still applies (section edits not yet built and a reload a moment later; some chips keep their size with larger text; Focus mode's Colours sheet on a landscape phone; changes kept as the page goes and a renumbered section map; sections of an imported guide whose marker isn't known stay white; Save a copy within the autosave pause; restoring the same backup twice; a 12×12 picture's message).
- Find next on iPad portrait can leave the section near the frame's edge when it's near the page's edge (the picture doesn't pan past its own edge).
- Edit sections on a 320×568 phone: the tool buttons are still a scroll away (the picture's least size).
