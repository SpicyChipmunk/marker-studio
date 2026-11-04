# Build plan — v329.4: Fix the subject

From v329.3. Correct, or choose from scratch, what a photo-made page's Focus treats as the photo's subject, by tapping
and dragging over the photo. Before the beta (the author). Why: on the bench about half of the subject finder's
remaining error is the wrong subject altogether (an opinion or a wrong label, which no training fixes), and Focus is
then usable without the subject finder, offline, or where the finder fails. The bench can't judge it, so it's judged on
the author's own photos on the iPad.

## Decided before building

1. **Where:** a link under the Focus row on the page step when Focus uses the subject (Sharper subject, Simpler
   background, Subject only): "Fix the subject", or "Choose the subject" when the subject is empty (and under Even when
   Subject only went back to Even for want of one). Reached after Build through Remake page. Not an Edit sections tool.
2. **What you tap:** pieces of even size that follow the photo's edges, independent of the markers and Detail (SLIC,
   our own implementation from the paper; compactness 5, ten passes): coarse at full view (the long side / 30), fine
   zoomed in 2x or more (/ 75). The pixel under the first touch decides add or take away; a stroke makes every piece it
   touches wholly that. One finger fixes (a finger waits 110 ms or until it moves, as Paint), two fingers zoom and move,
   a Pencil is a finger. Faint piece outlines; the subject's outline in the accent; the background about a third bright.
   VoiceOver can't pick pieces: fixing is sighted only (the page works without it).
3. **What a fix changes:** one three-state layer (the finder's / in / out; the latest stroke wins) over the finder's
   map, kept in the photo's own frame (as first shown, at its tilt) at a grid of its own, read with the finder's map as
   one subject map everywhere (both Focus modes, Subject only, the markers' targets, the hints, the crop offer). A fresh
   combined map on every change; the layer's hash in the marker-choice and page-memory keys (a pid per subject).
   Parts added by hand are never dropped as strays.
4. **When the page updates:** the highlight at once; the page made again once, on Done ("Making the page with your
   subject…"); Cancel restores the subject as it was; the mode covers the step's other controls; the link disabled while
   a page is made; zoom and position kept between visits; Done with no change makes nothing.
5. **How long fixes last:** through Detail, Focus, Build and every remake; saved with the guide (payload.pp.fix: runs,
   the frame's grid, no photo id: a guide opened again binds it to its own photo); carried through crops and quarter
   turns; cleared with a note only by a change of tilt or photo. Undo stroke by stroke inside the mode, one step for
   the visit after Done (the Undo snapshot holds the runs).
6. **Section edits already made:** the app's own "Make the page again?" at Done (its Cancel returns to the mode); a
   quiet line in the mode when there are edits; strokes a draft until after the snapshot; the tool row's Undo and Redo
   and Cmd-Z act on the draft while the mode is open; a page that can't be made reverses the commit, keeps the draft
   and says so.
7. **No subject:** found nothing, not downloaded or declined, the finder failing this launch: each starts the mode
   empty; every empty start is saved complete (the finder never asked again for that photo); the download card's
   third button "Choose the subject by hand" (remembered for the launch, with "Download the subject finder" in the
   hint); failure notes end "Choose a Focus again to pick the subject by hand instead."; with the finder off this
   launch the Focus choices aren't greyed and open choosing; an empty start ending empty keeps Focus as it was. Use the
   finder's subject: back to the finder's map; for a subject chosen by hand, it asks the finder once if it's stored.
8. **Wording:** agreed line by line (Help, What's new and the mode's strings included).

Copy diagnostics and Send feedback say "Subject: found", "Subject: fixed by hand (N% of the photo changed)" or
"Subject: chosen by hand".

## Built (49-subject-fix.js)

- Pieces: `fixPieces` (SLIC) and `fixTidy`, in the JOBS worker ('fixp', `fixWorkerSrc`), each piece map handed back
  as a transferred buffer; on the page when there's no worker.
- Layer: `fixNew`, `fixFits`, `fixBase`, `fixCells`, `fixFoot` (each view pixel's cells, by their middles, so a stroke
  fills the layer however fine its grid), `fixRefine`, `fixView`, `fixCombine`, `fixAdded`, `fixEncode`/`fixDecode`,
  `fixKey`, `fixSave`/`fixLoad`.
- Hooks where the map is first set (never in a function the bench copies): `fixApply`, `fixSync` (ppMake, the Focus
  row), `fixOwnMap` (subMap, a subject chosen by hand); `subStrays` takes what was added.
- The mode: `fixEnter`/`fixOpen`/`fixExit`, strokes (80-input), drawing (10-segment render), the pane (50-controls),
  its Undo and Redo (87-undo), `fixDone` (okGeom, the snapshot, the commit, ppRemade; retried on failure),
  `fixChooseFor` (a pending Focus), `fixUseFinder`, `fixDiagLine`.
- 48-subject: `subGet` (the consent card, its third button and the failure notes), `subDlAsk`, ppSetFocus's ways to
  choosing by hand, the Focus row's hints.

## Tests

- Unit (made-up photos): test/subject-fix.test.mjs (pieces, the layer through a crop, a turn and an Undo, keys,
  the combined map and the strays rule).
- Browser: e2e/subject-fix.test.mjs (iPad width with the mouse, phone width with touch: strokes, the mode's Undo and
  Redo, Cancel, Done as one Undo step, Done with no change, the diagnostics line), e2e/subject-fix-2.test.mjs (found
  nothing, the finder off this launch, the card's third button, offline, Subject only's Choose the subject).
- On the author's iPad with his own photos: the wrong-subject cases, a subject chosen from empty, fine pieces along fur
  or hair, Pencil and finger, turning the iPad mid-fix, switching apps, the time to get the pieces ready, the outlines.

## Known limits

- VoiceOver can't fix the subject. Phones are checked by emulation only.
- A future subject model can shift the untouched parts of a fixed subject on a remake; a subject chosen by hand isn't
  affected.
