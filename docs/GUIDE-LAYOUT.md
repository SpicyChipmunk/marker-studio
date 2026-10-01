# Guide screen layout (Release 3, v263; updated v288)

Agreed with Ben on 27 Sept 2026, item by item, and tried in a clickable mockup. This is the build spec: every part of the build works from it. Numbers are CSS px at the default text size.

The stages are **Edit sections → Plan → Colour along**. "Plan" is the built guide with its tabs.

## Layouts

- **Portrait phones and iPad portrait**: one column. The page scrolls as a whole. The picture and its tool row are pinned at the top, the tab row (Plan only) is pinned under them, and the bottom bar is pinned at the bottom.
  - From v285, a portrait screen 700px wide or more (an iPad) uses its width: the guide is up to 92% of it (900px at most) instead of the phone's 600px column.
- **Side by side** (#1): the picture is on the left, and the header, tabs, controls and bar are on the right.
  - Applies when the screen is landscape and at least 640px wide, and at any width of 1100px or more (v285: 900px before, which put the 13" iPad in portrait side by side with a small picture and the bottom third of the screen empty). The same query is in `04-frame.css` and `SIDEQ` (72-frame.js).
  - iPad portrait stays one column, the 13" too.
  - The picture fits the screen below where it starts as the page opens (v285: before, it was the screen's height but started under the app's header, so its foot and tool row were off the bottom). Its column is as wide as the picture and its tools need, at most 60% of the width, the controls keeping at least 340px (and at most 560px); the two are centred. A very tall picture comes out a little smaller, but whole. On a landscape phone (under 600px tall) the header would leave too little, so there the picture is the screen's height, whole once the page is scrolled to it, as before. Its tool row is described under #4.
  - The app header (title and Home/Guide/Markers/Palette) scrolls away.
  - Left/right safe-area padding keeps content clear of the notch or Dynamic Island.
- **Unchanged**: Focus mode, Full screen and Reveal keep their own full-screen layouts. None of the pinning or shrinking below applies while they are open.

## #5 Header row (top of the guide card, scrolls away)

`[name ✎ / status line] [✨ Surprise] [⋯]`

- **Name**: one line, cut short with an ellipsis.
  - ✎ turns it into an input in place, which keeps the id `#sfGName`. Enter or blur saves; Escape cancels.
  - While renaming, the ⚄ suggest-a-name button (`#sfNameRoll`) sits inside the field.
  - Shows "New guide" when there is no name yet.
- **Status line** under the name. It replaces v262's status line above the bar.
  - "Saved in your Library ✓" or "Saving…" when the guide is in the Library. From v285 a guide goes into the Library by itself once it's built ("Saves itself from now on ✓" for a few seconds).
  - "Sample" for the sample until it's changed (then it's kept like any guide); a line under the tabs says so, with ✕.
  - "Removed from your Library" plus **Put back** (`#sfSave`) when it was deleted in the Library while open; nothing is saved until then.
  - A storage-full failure shows here in the warning colour; a guide not yet in the Library gets **Save** to try again.
  - The status line keeps one height: the longest states this guide can show are laid out unseen beside it (Put back and Save only when they can appear).
- **✨ Surprise** (`#sfSurprise`) appears in Plan only. At large text sizes (when the header would squeeze the name below about 140px, or the status line would wrap) and while the name is being edited, it becomes ✨ alone, keeping its label for screen readers.
- **⋯ menu**: a sheet, opened from the header. It is the only ⋯ on the screen.
  - **New:** Choose a photo, Try the sample, Open from Library, Import a guide.
  - **This guide:** Save a copy (Plan, and only once the guide is in the Library); Reset progress (Colour along).
  - **Help.**
- **Removed:** the "New or open" row (`#sfEntry`) and its "?" (`#sfHelpQ`), today's name row, and the save-status line above the bar. The start card, shown when no guide is open, keeps its own buttons and "?" (`#sfHelpQ0`).
- **By stage:**
  - Edit sections: no Surprise, and no Save until the guide is built.
  - Colour along: no Surprise.

## #3 Picture size (portrait, one column)

- **Plan and Edit sections:** the picture starts at **55%** of the screen height and shrinks in step with scrolling, down to a floor of **45%**, or **40%** on screens under 780px tall. It never gets smaller than the floor.
  - Example: on 390×844 it goes from 464 to 380px.
  - A picture whose width limits it to less than the floor doesn't shrink at all.
- **Colour along:** a fixed **55%**, or **45%** on screens under 780px tall. It never shrinks: the list scrolls underneath it.
- **iPad portrait (700px wide or more, v285):** 60% to start, 50% at the least, and 60% in Colour along.
- **How the shrink works:** the in-flow height stays at the full size, and the pinned block uses a negative sticky `top` of −(full − floor).
  - One wrapper holds the canvas and every picture overlay: sun, zones, anchor dots, photo overlay, outlines, tip anchor. That wrapper gets `translateY(d) scale((full−d)/full)` with its origin at top centre, where d is how far the block has scrolled past the top (clamped to full − floor).
  - Nothing below it moves, so the scroll position never jumps. Safari has no scroll anchoring, so this matters.
  - Update d from `scroll` with requestAnimationFrame. Hit-testing must go through `getBoundingClientRect` so the transform is included.
- **Switching tabs never moves anything.**
  - Each tab's content has a min-height that fills the space between the pinned tabs and the bar, so a short tab can't make the page shorter than the pinned position.
  - From v285 that min-height is the tallest tab's own height when that's less (`tabsTallest`): on an iPad in landscape, or any screen where every tab fits, the page then doesn't scroll into the empty space under a short tab, and switching still moves nothing.
  - If the tabs are pinned when you switch, the new tab opens at its top with the tabs still pinned.
- **The page ends at the card.** Nothing follows the guide card on this screen, so the sticky bottom bar can never lift off the bottom at the end of a short tab. This fixes the "floating bar" in v262.
- **Pinned height** (`--pinH`): the floor-size picture plus the tool row. It drives the tabs' sticky `top` and `scroll-padding-top`.
- **Drag to scroll:** when the picture isn't zoomed in and nothing needs a one-finger drag, it uses `touch-action: pan-y`, so dragging up or down on it scrolls the page. It uses `none` while:
  - zoomed in;
  - Paint is on;
  - a sheet is open;
  - an Edit sections tool that draws is active (Split, Add a loop);
  - a drag starts on the sun.

## #4 Tool row (pinned with the picture)

- **Portrait:** one 40px row directly under the picture, replacing the zoom row and the summary line.
  - **Left:**
    - ↶ **Undo** (`#sfPlanUndo`), only when there is something to undo. In Plan it's the plan undo. In Edit sections it's the section-edit undo, and the separate `#sfUndo` button in the edit controls goes. Colour along has none.
    - Then a **status**:
      - "166 sections · 16 markers" in Plan;
      - "166 sections" in Edit sections;
      - "12 of 166 coloured" in Colour along, with the progress as a thin line along the top edge of the row. This replaces `#sfProgBar` and `#sfProgText`.
    - The status shortens first when space is tight, and can disappear completely.
  - **Right:** icon buttons, 40px wide (34px visible, 44px tap area):
    - ◐ Photo (`#sfPhPeek`), in the Photo pattern only;
    - **codes on/off** (moved from Display; aria-pressed; replaces `#sfLabels`), in Plan and Colour along;
    - − (`#sfZout`) and + (`#sfZin`), on every device;
    - Fit (`#sfZrst`), only while zoomed in;
    - ⛶ Full screen (`#sfFull`).
  - **Words (v288):** where the tools are one horizontal row at least 700px wide (an iPad's one column), Codes, Greyscale (`#sfVals`, once Values) and Full screen show their word beside the icon (`sftw`). When the row is tight, the status's second part goes first, then the words, then the rest as before (planFit). Undo, −, + and Fit stay icons. Phones and the side-by-side strip keep icons only, with a one-time line under the tabs naming them ("Under the picture: …", or "Beside the picture: …" side by side; the tip queue below).
- **Side by side:** the same buttons go in the spare space beside or below the picture: a vertical stack if the column leaves at least 52px at the side, otherwise a row under it. They are never on the picture itself.
- **"Tap a section to change or pin its colour"** stops being a permanent line. It appears once per device as a one-time hint, and is in Help.

## #6 Bottom bar (pinned at the bottom)

- At most two buttons, in one row at every text size. They are 44px tall, with 8px padding, and the bottom padding is `max(8px, safe-area-inset-bottom)`, not added on top of the safe area.
  - **Edit sections (v288):** a new picture: **Build guide →** (`#sfBuild`). Back from the Plan with nothing edited: **← Plan** (`#sfToPlan`) as the one primary button, no rebuild. Once something is edited (sliders too): **← Plan** as a ghost (it asks Build again / Discard) and **Build again →**; a line says coloured sections are kept, when there are any. Undo back to no edits flips it back.
  - **Plan:** ← Edit sections (`#sfBack2`), then **Colour along** (`#sfColor`, primary). If both don't fit on one row, the back button reads "← Sections".
  - **Colour along:** ← Plan (`#sfDoneBtn`, "Back to the plan"; "Done colouring" until v284), then **⛶ Focus mode** (`#sfFocus`, primary). A finished page has **✨ Reveal & share** (`#sfAlongRev`) instead of Focus mode (v288).
- Save and Save a copy are not in the bar (see #5). `#sfSaveC` goes.

## Sheets (shared component)

- **The rule (v284):** a sheet belongs to the picture, which stays in use under it (tapping another section while Change colour is open moves the sheet there); anything else is a dialog. Both have the same title: the app's serif, one size.

- **Portrait:** a sheet sits from the bottom of the pinned picture block to the bottom of the screen, covering the tabs, controls and bar but never the picture.
- **Side by side:** it covers the controls column.
- **Parts:** a header (title, plus an optional field), a scrolling body, and a footer with its buttons.
- The page doesn't scroll while a sheet is open, but pinch and pan on the picture still work. Escape closes it; focus moves in when it opens and returns when it closes.
- **Used by:**
  - the ⋯ menu (#5);
  - Change colour, the Manual picker and the Paint brush picker (#2);
  - Blend's anchor menu (#2);
  - Print (#9).

## #2 Change colour and section menus

- **The small tip** (marker, then Change colour / Pin) stays next to the tapped section. It goes above the section, or below it when there's no room, and never covers it. It closes on scroll.
- **Change colour opens the sheet.**
  - If the picture isn't already pinned at the floor size, the page scrolls so it is. With the 45% floor the sheet gets about 420px on 390×844 and about 356px on an iPhone SE.
  - The tapped section gets the two-tone outline (white inside dark, the same thickness at any zoom, one pulse on arrival; steady with reduced motion). With **Everywhere**, every affected section is outlined too, lighter, on top of the live preview.
  - **Rows at the top (v288):** **Closest** (six owned markers nearest the current one: three lighter, three darker; not dry), **In this guide** (one sideways strip, lightest first), then **Recently used**, only the markers not already shown. The whole sheet fits 320×568.
  - **Pinned line (v288):** the first Change colour ever shows a line under the tabs, "Pinned — changes to the plan leave it as it is" with **Unpin** (Everywhere: Unpin them). Help's glossary has Pin (ring) and Kept (any ink, no ring).
  - Only this section / Everywhere (N sections) resets to "Only this section" each time.
- **Tapping another section while the sheet is open:**
  - the colour you picked for the current one is kept, as one Undo step;
  - the sheet moves to the new section, and the outline and header update;
  - scope resets;
  - screen readers hear which section is now being changed;
  - if nothing new was picked, nothing is saved.
- **Buttons:** Cancel undoes only the current section's preview. Confirm becomes **Done**.
- **Blend:** a tap while the anchor menu is open moves the menu to that section rather than adding an anchor.
- **Search box:** the code field is never focused automatically.

## #7 Tabs (Plan only, pinned under the tool row)

- **Colours · Pattern · Shading · Share**. They open on the last one used on this device (localStorage), or on Colours the first time. Buttons keep `.sftabbtn` with `data-t` = `colours|pattern|shading|share`.
- **Colours:** marker count, where the colours come from (Owned / Saved palette / Generate palette plus harmony), lean toward (Temperature, Intensity), and "Using N of M markers". Content is unchanged.
- **Pattern:**
  - the pattern chooser (Gradient Random Blend Photo Manual), on one row where it fits;
  - that pattern's options (flow and direction; Blend anchors hint; Photo options; Manual with Paint and brush);
  - then ↻ Shuffle and Pin colours side by side.
- **Shading:** Off / Shadows / Light & shadow, its sliders, tone guides, Leave sections flat, and the "richer with" line (#8). **Texture** goes at the bottom and is always shown. Since v281 the whole picture's settings come first (the mode, Light from, the ⓘ line, the "richer with" line, tone lines + Leave sections flat), then the chosen zone's own: with zones, the chips row and "☑ Shade Bell" (`.sfzshade`), then Roundness and the Highlights / Shadows pair (each its kind and amount), or for a flat zone one line saying so (`.sfzflat`). The chips sit right above what they choose for, as in Pattern and Colours; the tab keeps within #8's room besides the chips and the Shade line.
- **Share:** see #9.
- **Zones (v279):** without zones, the Pattern tab's first line is "Colour pattern" with **＋ Zone** on its right. With zones, Pattern and Colours start with one row of chips instead, **Main · each zone · ＋** (`.sfzrow`, `.sfzchip`, `data-z` = the zone's id, 0 for Main, `new` for ＋); the chip that's on is the zone those two tabs edit and shows ✎ (tap it again to edit the zone). The row scrolls sideways when the chips don't fit. Share is the whole guide's and has no chips; Shading has them, with shading on, above the zone's own settings (see Shading above). A line under the chips (`.sfznone`) says when the zone they edit has no sections. The zone editor (`.sfzed`: the name with Done beside it in `.sfzhead`, so Done is in sight without scrolling; then **Choose sections with the keys** (`#sfZoneKb`, v282), out of sight until Tab reaches it, which gives the picture the focus for the arrow keys and Space; the count; how to add sections; Delete zone last) takes the Pattern tab's place while it's open, and closes on another tab, Colour along, Edit sections or Escape. Tabs with the chips keep within #8's room besides that one row.
- **Random's Balance (v283):** under the pattern's row, Balance (Mixed | Main colour, `#sfBal`). With Main colour, a bar of the roles (`#sfBalBar`: `#sfBalM`, `#sfBalS`, `#sfBalA`, each a button about as wide as its share, in its markers' colours; the accent's shows just "10%"), then "Tap a colour to change it" with **↻ Other pairings** (`#sfBalPair`) beside it, and a line of what's used (`#sfBalNote`). From v284 each part is as wide as what's painted in its colours (measured over the zone's sections), its figure to the nearest 5 ("<5%" for a sliver), its name only where it fits whole (`balFit`); an accent of more than one colour is "Accents"; a note says when the shares miss by 8 points or more and why, and when one marker leads the main colour (with Add shades). A part of the bar opens a sheet (`.sfbalsh`) of Auto and your colour families, as strips of your markers with how many. Keep touching sections clearly different follows; with Mixed, No repeats (`#sfNoRep`) under it, with its note (`#sfNoRepNote`); the Colours tab's marker count then reads "one per section" and is greyed.
- **Radial's centre (v282):** with Gradient › Radial, a line under Flow (`#sfRadNote`) says where the rings start ("Centre: the middle", or "Centre: moved" with **Back to the middle**), and a ⊕ on the picture (`#sfRadC`, like the sun) moves it. It shows on the Pattern tab only, not in the zone editor, Colour along or Reveal.
- **Display is removed.** Texture moves to Shading and codes on/off to the tool row.

## #8 Keeping tabs short

- **Helper text** (explanations, not warnings or errors) shows in full the first time on this device, then as a one-line ⓘ that expands on tap. Remember what's been seen with one localStorage key, for example `ms-seen-hints`. This covers:
  - the shading explanation;
  - the Manual, Blend and Photo hints;
  - the colour-along instructions;
  - the one-time "tap a section" hint.
- **Shading's suggestions** (the 2nd-coat note and "Richer with" markers) collapse into one line such as "4 markers would make the shading richer · Show". Show expands them, and their Add buttons still work.
- **Pattern:** Shuffle and Pin sit side by side, and the pattern chooser stays on one row where it fits.

## #9 Share tab

- **Show it off:** ✨ Reveal & share (primary) and Save image.
- **Print:** a **Print…** button that opens the Print sheet. The sheet:
  - holds Pages, Labels, Paper, Darker labels and Include blend companions (the existing options and storage keys);
  - shows a one-line summary such as "2 pages · Letter · Numbers";
  - has Download PDF (`#sfPDF`) and Cancel;
  - is styled like the swatch-chart sheet.
- **Plan & keep:** ◐ Blend plan, Save as palette, Guide file.

## #10 Colour along

- **The list starts straight away.** The instructions are an ⓘ line (#8). There's no name box, Reset progress is in ⋯, and progress is in the tool row.
- **Closed rows** are one 48px line: swatch, code and name (ellipsis), and "3 of 9 done" or "All 9 done ✓". Shading's highlight → base → shadow line stays under each row when shading is on.
- **Tapping a row opens it in place,** one at a time. The open row holds:
  - **✓ Mark all done** (`#sfMarkAll`), which becomes **Clear ticks** once every section is done;
  - **Find next** (`#sfFindNext`);
  - **◐ Blends**, which shows the lighter and darker companions underneath.
- **Closing:** tapping the open row again closes it and shows all colours. This replaces Show all, Clear and the "Now colouring" panel.
- **The open row always scrolls fully into view** between the pinned picture and the bar, including when it was selected by press and hold on the picture.
- **Finished markers** stay in place, dimmed, while you colour. When Colour along is opened again, they're gathered in a collapsed "Done (n)" group at the bottom.
- **The drawing (v288, "as your paper"):** sections coloured (ticked, or any tone) in their marker, the rest pale (one tint shared with Home's Continue card, `PROG_PALE`). With a row open, its sections still to do are full colour and outlined, coloured ones softened (`PROG_SOFT`), the rest pale. Codes off shows the whole plan. Focus mode matches: done softened, the current section full with its ring, the rest pale.
- **Find next and Focus mode zoom only as far as needed:** if the section is on screen and at least ~44px, just pan; otherwise the least zoom that makes it ~44px, no further than 4× and never filling more than most of the view (fitZoom). One pulse of the outline on arrival.
- **The markers on this page:** "N markers on this page ›" in Colours opens a sheet listing them lightest first (swatch, code, name, sections), stand-ins "for X (dry)", To buy flagged, a For shading group; tapping one highlights its sections.
- **Focus mode** header: "Section N of M" (the bar shows the page's progress).

## Tip queue (v288)

- One line at a time under the tabs, and at most one new tip per visit, in this order: the kept-sections line, the pinned line, the sample's line, the first-time "Tap a section" hint, then the tool names on a phone. All are remembered in `ms-seen-hints`; a tip that waits shows on a later visit.

## Library (v288)

- **A full-screen dialog** (`#savedOverlay`), its content at the screens' one width (`--wrapW`), the whole page scrolling with the heading pinned; ✕ closes it and focus goes back to what opened it.
- **A grid of tiles:** two columns on a phone, as many ~176px columns as fit from 600px. A guide's tile is its page as coloured so far (homeArt 'prog'; its plan when not started), drawn when the tile comes into view (IntersectionObserver), at most 60 pictures cached; the stored thumbnail shows until then. Palettes and draws are their markers as bands.
- **Each tile:** the picture, name (three lines at most) and its line ("Guide · 16 markers · 5 of 122 sections coloured · Oct 1") open the item; **⋯** over the picture's corner opens Rename (in place) and Delete (at once, with Undo). Focus after a delete goes to the next tile's ⋯.
- **Below the tiles:** Import a guide, then Back up / Restore and "Markers & palettes as text", which opens Back up & restore. Markers' ⋯ › Back up & restore opens the Library here.
- **Opened from** Home's Library card, Home's "All guides (N) ›", the guide's ⋯, and Palette's ⋯ (palettes first there).

## How the decisions fit together

- #3's floor size is what makes room for #2's sheet, so the picture doesn't change size when the sheet opens.
- #3's tab min-height, the page ending at the card, and #6's sticky bar together make the bar sit on the bottom and stop tabs from jumping.
- #4 holds what used to be spread around: Undo, codes on/off from Display (#7), progress from Colour along (#10), and the zoom row.
- There's only one ⋯ (#5). #6's bar has no Save; Save for a new guide is next to its name (#5).
- #8's "full once, then ⓘ" rule covers #4's one-time hint and #10's instructions.
- Side by side (#1): sheets cover the controls column, and the tools sit in the spare space (#4).
- Drag to scroll (#3) is off whenever the picture needs one-finger drags: Paint, zoomed in, sheets, drawing tools, the sun.
- v262 features keep working in the new places:
  - auto-save's status sits in the header;
  - Undo keeps `#sfPlanUndo`;
  - Paint sits in Pattern → Manual;
  - the shopping Add buttons are inside the Shading line;
  - text size uses the `--t-*` and `--tpx` variables.
