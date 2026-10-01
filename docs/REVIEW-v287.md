# Fresh-eyes review (v287) and the next version

Five independent reviewers went over v286:

- saving and data safety (code);
- the guide's logic and rendering (code);
- a stress test in a browser (rapid taps, odd pictures, large text, two tabs, 36-guide Library, backup and restore);
- a hands-on UX walkthrough at iPad portrait (834×1194), iPad landscape (1194×834) and phone (390×844);
- words, consistency and accessibility.

The clear bugs were reproduced, fixed and tested in v287; CHANGES.md lists them. Below are the rest: decisions for the next version, ranked, each with a recommendation, then the known limits.

## Decisions for the next version

1. **Colour along shows what you've coloured in colour.** Today finished sections turn pale with a ✓, and only the open marker's sections are solid, while Home's Continue card does the opposite. The screen never looks like your paper. *Recommend:* finished sections in their marker colour, the open marker's remaining sections highlighted, everything else pale. (M)
2. **The markers to pull out of the box.** The Plan says "16 markers", and the list only appears in Colour along. "Using 16 of 120 markers" looks like a link but does nothing. *Recommend:* that line opens a sheet of the guide's markers (swatch, code, name, how many sections, lightest first, To buy marked). (S–M)
3. **Edit sections says what it's for.** It has no heading, its random tints look like a colour plan, the tools sit under two sliders on a phone, and coming back from the Plan only offers "Build guide →". *Recommend:* a heading ("Check the sections"), the tools first, one neutral tint, and "← Plan" in the bar until something is edited, then "Build again (keeps your colouring)". (M)
4. **Not losing your place when zoomed.** Find next and Focus mode zoom to about 3× with nothing showing where you are; Find next's outline is thin; Focus mode's zoom buttons sit on the picture. *Recommend:* a high-contrast pulsing outline and the zoom buttons off the picture now; a small overview inset later if still needed. (M)
5. **Words on the tool row on iPad.** Codes, Values and Full screen are icons only, and their names are hover titles touch never shows; "Values" is jargon. *Recommend:* labels beside the icons at 700px and wider (there's room); a one-time tip on phones; consider "Greys" for Values. (S)
6. **New colouring guide goes straight to the photo picker** from Home (the card in between repeats Home). *Recommend:* yes; keep the card as the Guide tab's empty state. (S)
7. **One width on iPad.** Home and Guide are 731px wide, Markers and Palette 564px, so the menu jumps; the Library is a one-column modal with small thumbnails; progress reads "4% coloured" in the Library and "5 of 122 coloured" on Home. *Recommend:* one content width and one progress wording now; the Library as a full-screen grid on iPad later. (S, then M)
8. **Change colour shortcuts.** All 120 markers by family, nothing for the usual swaps. *Recommend:* "In this guide" and "Closest" rows at the top. (S–M)
9. **Pins explained.** Change colour pins the section without saying so; the ring is never explained. *Recommend:* a one-time line after Done ("Pinned: Shuffle won't change it · Unpin") and the ring in Help. (S)
10. **Balance's bar names.** "Browns · 60%" was filled with pinks and olives. *Recommend:* name the parts by role (Main, Second, Accent) with their swatches. (S)
11. **A finished page's bar.** It still offers Focus mode first. *Recommend:* "← Plan" and "Reveal & share" (or Print) once every section is done. (S)
12. **Markers screen safety.** "Untick all shown" is a full-width button styled like "Palette from these" (it has an Undo). Back up appears in two places. *Recommend:* Untick in a ⋯ menu; Back up in the Library only, with a link from Markers. (S)
13. **Print preview.** The Print sheet's choices are words only. *Recommend:* a small layout picture on each choice. (M)
14. **Smaller polish:**
    - the "Tap a section…" hint only on Colours and Pattern (not Shading and Share);
    - Reveal has both ✕ and Close: keep one;
    - Temperature's buttons are content-width while Mood's stretch: one style;
    - toasts can cover Reveal & share and Save image on the Share tab;
    - the palette's background glow stays on Home and Guide after visiting Palette (keep or limit to Palette?);
    - "Use in a guide" recolours whichever guide is open (Undo works): ask, or offer a new guide too;
    - Focus mode's "Section 1 of 11 · 0% of page" reads like the section's share of the page.
15. **Accessibility, structural:** a palette band's lock is a button inside a button; Match's source tabs are half a tabs pattern; four questions use the browser's OK/Cancel dialog (re-detect, rotate/crop, restore, a backup opened as a guide) instead of the app's dialog with real verbs; in Focus mode Values, zoom and Fit can't be reached by Tab.
16. **Wording, judgement calls:** "Reset progress" asks "Clear all N ticks?" and says "Progress reset" (one verb, and N counts part-done sections too); "Could not" and "Couldn't" both appear (about 30/25); "marker-by-number" and "paint-by-marker" both describe the app; "pool" in the Markers screen is never explained.

## Known limits (not changed)

- Section edits not yet built are kept when the page is hidden, but not when it's reloaded a moment after making them.
- With larger text some buttons and chips keep their size; at 2× on a 320px phone the Library list shows about one row.
- Focus mode's Colours sheet on a landscape phone scrolls without showing there's more.
- Changes kept as the page goes can't be put into a guide whose section map was renumbered on opening (merged or split sections, or a guide from another browser) until its first save after opening; they're dropped and the guide stays as last saved.
- Sections of an imported guide whose marker the app doesn't know stay white (it now says how many); they could take the nearest owned marker instead.
- "Save a copy" pressed within the autosave pause can put the last change into the original as well.
- Restoring the same backup twice says "36 guides were already here" (nothing changed); a 12×12 picture gets the general "couldn't find sections" message.
