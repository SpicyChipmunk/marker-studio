# Code tools

Steps 1–3 of the behaviour-preserving cleanup (docs/REVIEW-v259.md §4) are done: the tools are pinned, the guide closure's opening and closing lines live in the template, and all of `src/js` and `src/css` is formatted with Prettier. The formatted source ships as is (option (a) of step 3); there is no minifier in the build, though one may be added later. This page says how to use the tools, how the "formatting changes nothing" claim was checked, and what was measured.

All tools are pinned dev dependencies (exact versions): prettier 3.9.9, esbuild 0.28.2, eslint 9.39.5, globals 17.12.0. None of them is part of `npm run build`; `index.html` is still produced by `scripts/build.mjs` with no dependencies.

## Commands

| Command | What it does | Exit code |
|---|---|---|
| `npm run format` | `prettier --write` on `src/js/**/*.js` and `src/css/**/*.css`. Run it before committing JS or CSS, then `npm run build`. | 0 |
| `npm run format:check` | `prettier --check` on the same files | 1 if a file isn't formatted |
| `npm test` | the unit tests, which include the same format check (`test/format.test.mjs`, see below) | 1 on any failure |
| `npm run fingerprint` | SHA-256 of the app's JS and CSS after a whitespace-only minify (`scripts/fingerprint.mjs --all`) | 1 only if something can't be parsed |
| `npm run lint` | ESLint on the shipped script, messages mapped back to `src/` file:line (`scripts/lint.mjs`) | always 0 (informational) |
| `node scripts/controls-compare.mjs capture DIR` / `compare DIR1 DIR2` | records the guide's controls in a broad set of states and compares two recordings (see "Comparing the guide's controls" below) | `compare`: 1 on any difference |
| `node scripts/style-snapshot.mjs` | drives two builds of the app side by side and compares every element's computed style, and screenshots (see "Style snapshot") | 1 if anything differs |

Useful options (pass after `--`, e.g. `npm run lint -- --rule no-undef`):

- `scripts/fingerprint.mjs`: `--css`, `--shipped`, `--all`, `--includes`, `--json`, `--root DIR` (fingerprint another copy of the repo; it needs `DIR/src` and `DIR/scripts/build.mjs`), `--write DIR` (save the minified text so two runs can be diffed).
- `scripts/lint.mjs`: `--verbose` (every message), `--rule NAME` (only that rule, listed), `--json`, `--strict` (exit 1 on errors, for when CI is ready for it).

The format check runs in CI, because CI runs `npm test` (after `npm ci`). The fingerprint and lint don't run in CI.

### The format check in `npm test`

`test/format.test.mjs` does what `prettier --check` does, through Prettier's API: for every `.js` under `src/js` and `.css` under `src/css` it resolves `.prettierrc` and checks the file. It fails with the list of files that aren't formatted, and also if any of those files is in `.prettierignore` (so nothing can quietly opt out). Fix a failure with `npm run format`, then `npm run build`, since `index.html` must match `src/` too.

Formatting has no effect on what the page runs (see "Fingerprint"), so `npm run format` is always safe to run.

## Files

- `.prettierrc`: `singleQuote: true`, `quoteProps: "preserve"`, `printWidth: 110`, `endOfLine: "lf"`, `embeddedLanguageFormatting: "off"` (so template strings that look like HTML/CSS are never rewritten), and a `requirePragma` override for `*.html`/`*.md` so Prettier won't touch them even if pointed at them.
- `.prettierignore`: everything except `src/js` and `src/css` code (`index.html`, `service-worker.js`, HTML, Markdown, JSON, `src/html`, `src/data`, `src/assets`). Every file in `src/js` and `src/css` is formatted.
- `scripts/lib/bundle.mjs`: rebuilds each `<script>`/`<style>` block of the template the way `build.mjs` does and remembers which `src/` file each character came from. On every call it compares its result with a real `build()` of the same tree and throws if they differ, so it can't quietly drift from the build.
- `scripts/fingerprint.mjs`, `scripts/lint.mjs`, `eslint.config.mjs`: below.
- `test/format.test.mjs`: the format check above.

## Guide closure

`src/js/guide/*.js` are consecutive pieces of one function body, `window.SF=(function(){ … })();`. The function's first and last lines live in `src/index.template.html`, around the guide's includes:

```
@@include(js/guide-bridge.js)
window.SF=(function(){ /* guide module (window.SF): the js/guide files below share this one function scope */
@@include(js/guide/00-state.js)
...
@@include(js/guide/99-close.js)
})(); /* end of the guide module */
@@include(js/shopping.js)
```

So every slice holds only statements and Prettier formats each file on its own. The files still share the function's variables, and still aren't standalone modules. `99-close.js` ends with a bare `return {...}` (the `window.SF` API) at top level, which Prettier's parser accepts; esbuild or ESLint would not accept it in a file on its own, but neither ever sees it on its own. Moving that `return` into the template too would put code where Prettier doesn't check it, and rewriting it (say, into a variable returned by the template) would change the shipped code.

The move (the commit before formatting) changed nothing the browser runs: `JS shipped` stayed `d975ce25…`. In `index.html` the opening line now sits above `00-state.js`'s header comment instead of below it, and the closing comment's text changed.

## Fingerprint

The JS is assembled in template order exactly as the build splices it: each `@@include`'s file with one trailing newline dropped, joined by newlines, nested directives expanded (the `@@dataurl` in `guide/20-image-input.js` included). esbuild then reprints it with `minifyWhitespace` only: no renaming, no syntax minification, comments dropped. esbuild prints from its syntax tree, so indentation, line breaks, comments, semicolons, quote style and redundant parentheses all disappear, but any change to what the code says changes the hash. The `<script>` blocks are minified separately (they are separate elements) and hashed together.

There are two views of the JS:

- `JS shipped` (the default): each whole `<script>` block as it appears in `index.html`, template glue included: `const COLORS=@@json(...)`, the marker data, and the guide closure's opening and closing lines. This is the view to compare.
- `JS includes` (`--includes`): only the `@@include`d files, joined. It can't be computed any more, and that is expected: without the closure lines that now live in the template, the included files concatenated as one script aren't valid JS (the guide's `const root` and `palette` collide with the top-level ones, and the guide's `return` would sit at top level). The script says so and exits 1. The option is only useful with `--root` on a copy from before the move.

CSS (`--css`) goes through esbuild's CSS loader, also whitespace-only, and gets two hashes:

- `strict`: esbuild's output as is.
- `canonical`: the same output with the things evened out that esbuild keeps exactly as written and Prettier rewrites:
  - number spelling (`.5`, `0.5` and `0.50` are one number);
  - whitespace inside custom-property values and `var()` fallbacks (`--sub: rgba(244, 242, 236, 0.52)`, `var(--pinH, 0px)`); esbuild already removes that whitespace everywhere else;
  - spaces around `*` and `/` inside `calc()`, `min()`, `max()` and `clamp()` (`calc(12*var(--tpx))` → `calc(12 * var(--tpx))`). Only inside those functions: in a selector, ` * ` is a combinator and the universal selector, and is left alone. Spaces around `+` and `-` are required in CSS and are never touched;
  - the space after the colon in an `@supports` condition (`(font: -apple-system-body)`).

  Strings and `url()` are left alone. None of this affects what the browser computes, and no script reads a custom property back as text. The `calc()` and `@supports` rules were added with the formatting commit: the text-size work, after the v259 measurements, had brought in `calc(N*var(--tpx))` and an `@supports (font:-apple-system-body)` block, and without these rules the canonical hash differed for those 16 pieces only.

`--css` fingerprints the CSS includes; add `--shipped` (or use `--all`) for the whole `<style>` block too. The two differ only by the block's last newline.

Stability: repeated runs give identical hashes.

Sensitivity was checked with controls on a scratch copy (at v259). The fingerprint changed for `2400`→`2401`, `==`→`===`, CSS `.62`→`.63` and `html,body`→`body,html`. It stayed the same for a quote-style swap, an edited comment, added redundant parentheses, and `.62`→`0.620` (canonical CSS). For the new canonical rules: `calc(2*3px)`→`calc(2*4px)` changes it, and `.a * .b` keeps its spaces.

## Verification method

To check that a formatting-only change (or any change meant to be behaviour-free) is safe:

1. Run `npm run fingerprint` before the change and save the output (or run it with `--root` on a copy, e.g. `git archive <commit> src scripts | tar -x -C <dir>`).
2. Make the change, e.g. `npm run format`, and `npm run build`.
3. Run `npm run fingerprint` again and compare: `JS shipped` must be identical, and so must `CSS canonical`. `CSS strict` may differ, but only in the ways listed under "canonical" above; `--write DIR` saves the minified text of both runs for a diff.
4. Run `npm test` and `npm run e2e`. The unit tests load the built `index.html`, so they exercise the new code.

Compare `JS shipped`, not `JS includes` (see above). Since the canonical CSS rules grew with the formatting commit, a canonical hash from an older version of `scripts/fingerprint.mjs` can't be compared with a new one; fingerprint both trees with the same script, using `--root`.

## Comparing the guide's controls

The guide's controls (`src/js/guide/50-controls.js` and the `51`–`53` files split from it) are written as HTML into `#sfCtl` and wired afterwards, so a change meant to leave them alone can be checked exactly. `e2e/controls-states.mjs` drives the app through about 120 states (every stage, every Plan tab with every colour pattern and its options, the palette sources and filters, shading, pins and Paint, Colour along and focus mode, Edit sections, crop and the page-straightening editor, demo mode, a mixed Ohuhu + Copic collection, the one-line hints), with everything random seeded. `scripts/controls-compare.mjs capture DIR` records, in each state, at three screen sizes (phone, landscape side by side, iPad) and three text sizes (1, 1.3, 1.6):

- every string written into the controls and every listener added inside them, in order (the element, the event, the handler's source);
- the controls' markup and the bottom bar's, once the app is idle;
- with `--styles`, every computed style property of every element (and of its `::before` and `::after`) and each element's box;
- with `--shots` (a separate run, as a screenshot scrolls the page), a screenshot of the controls and of the bar.

`compare DIR1 DIR2` reports the first difference in each part and exits 1 if there is any; screenshots must be the same bytes or else the same pixels. For a change that moves inline styles into classes the markup differs by design: compare with `--no-markup`, and the styles, boxes and pixels must still match. `--root DIR` records another built checkout, so the "before" can be recorded from a copy of the older commit. `e2e/controls-wiring.test.mjs` runs the same states as a test: no page errors, and each drawing of the controls wires every control in it.

## Style snapshot

`scripts/style-snapshot.mjs` checks that a change to CSS or to where styles live (moving inline styles into classes, say) changes nothing on screen, which the fingerprint can't do since such a change rewrites the CSS and the markup. It serves a base `index.html` (by default HEAD's, or `--base REF`, `--base-html FILE`) and the current one from two local servers, opens each in a fresh headless Chromium profile, and walks both through the same scenarios step by step: the welcome, Home, Markers (each view, sets, filters, search, the details sheet, Random, Back up & restore with its text, the swatch chart), Match (photo, hex, copy and To buy toasts, camera; and with no markers), Palette (each harmony, a reference photo, Seed, Library, the export card), Help and How it works, the guide (start card, tip, each tab, shading, Blend plan, Colour along, Blends, page complete, Reveal as it plays and after), colour from a photo, the Section edits question, and Home with a resume card and recent guides. At every stop it reads `getComputedStyle` for every element in the page (all ~400 properties, sorted, hashed in the page) and reports any element whose properties differ, with the properties; it also compares:

- the elements listed in `TRACKED` under forced `:hover`, `:active`, `:focus` and `:focus-visible` (Chrome DevTools Protocol `CSS.forcePseudoState`), with everything inside them: an inline style beats every rule, a class can lose to a state rule;
- each element appended straight to `<body>` (toasts, the confetti canvas, Reveal's flash), read the moment it is added;
- for 39 stops per screen size, a screenshot, pixel for pixel, with both pages at the same scroll position: the full page on portrait screens, the viewport on landscape ones (a full-page screenshot lays the page out at its whole height, which turns it portrait, and the app reacts to that) and on the guide screen (whose picture follows the viewport's size). Differing pairs are saved to the output folder.

It runs at 390×844, 844×390, 820×1180 and 1280×800, each at text sizes 1×, 1.3× and 1.6× (the browser font size, as `openAtScale` in the e2e helpers sets it); `--configs phone@1,ipad@1.6` picks some, `--only guide,palette` some scenarios, `--jobs N` runs N configs at once (default 2), `--no-shots` skips screenshots. A full run takes about 75 minutes on two cores.

To make the two builds comparable, both get the same `Math.random` (seeded, and reseeded before every step), the same clock (starting at a fixed moment), and a fixed seed for the clock-seeded guide names; every stop waits for `idle()` and then finishes running animations and holds endless ones at their start. Run it against the same file on both sides (`--base-html F --new-html F`) to see that it reports nothing; what did differ in such runs was left out or evened out as above (the live camera's results are left out of that stop). A scroll position a few pixels apart after choosing a guide's photo is timing, not style: it is listed as a note and doesn't fail the run.

Moving the inline styles into classes (after v267) was checked with it against the commit before: 12 configs × 76 stops = 912 stops, 1,222,954 element readings, 6,280 forced-state readings, 180 added-to-body readings and 468 screenshot pairs, all identical. As a control, a copy with one moved margin changed by 1px, one moved rule given a weaker selector and one made hover-only was reported at every stop that shows them.

## Measured results

### Formatting commit (after v266)

Formatting all 45 JS files (including `guide/00-state.js` and `guide/99-close.js`, now that they parse alone) and all 13 CSS files grew `src/js` and `src/css` from 4,771 to 33,196 lines. Fingerprints of the tree before formatting (after the closure move) and after, both with the current script:

| | Before formatting | Formatted | Match |
|---|---|---|---|
| JS shipped, 45 files, 5 blocks | raw 760,231 B, min 660,088 B, `d975ce25…` | raw 959,383 B, min 660,088 B, `d975ce25…` | **yes, identical** |
| CSS strict, 13 files | raw 108,296 B, min 97,149 B, `15664456…` | raw 130,320 B, min 97,639 B, `29315008…` | no (expected) |
| CSS canonical | `72821ed3…` | `72821ed3…` | **yes, identical** |
| `npm test` | 102/102 | 104/104 (with the new format test and a text-size test for the formatted layout) | |
| `npm run e2e` | | 379/379 | |
| lint | 0 errors, 0 warnings | 0 errors, 0 warnings | |

`JS shipped` was also `d975ce25…` before the closure move (v266), so neither step changed the shipped code.

The strict CSS mismatch is entirely what the canonical view evens out. Of 5,122 minified declaration pieces, 403 differ: 349 only in number spelling (`.62` → `0.62`, `0.30` → `0.3`), 50 only in whitespace (33 in custom-property values or `var()` fallbacks, 16 around `*` or `/` in `calc()`/`min()`/`max()`/`clamp()`, 1 in the `@supports` condition), and 4 in both. Nothing else differs.

The shipped file, `index.html`:

| | Before | Formatted |
|---|---|---|
| raw | 897,554 B (0.90 MB) | 1,118,871 B (1.12 MB, 1,093 KiB) |
| gzip (level 6) | 291,283 B | 318,519 B (+27.2 KB) |
| lines | 4,870 | 33,297 |

That is more than the +18 KB gzipped the review estimated at v259, as the code has grown since. A whitespace minifier in the build would bring it back below the "before" size (step 3 option (b)).

### v259 (commit c515887), from the first trial run

Formatting the 35 JS files that parsed alone and all 8 CSS files, in a temporary copy, grew the source from 2,708 to 22,220 lines.

| | Original | Prettier-formatted copy | Match |
|---|---|---|---|
| JS includes, 37 files | raw 460,257 B, min 427,003 B, `8a322bf1…` | raw 600,974 B, min 427,003 B, `8a322bf1…` | **yes, identical** |
| JS shipped | raw 531,868 B, min 498,609 B, `4fa19c8a…` | raw 672,585 B, min 498,609 B, `4fa19c8a…` | **yes, identical** |
| CSS strict, 8 files | min 61,174 B, `10b49d04…` | min 61,524 B, `042c10ea…` | no (expected) |
| CSS canonical (script of that time) | `b4104b85…` | `b4104b85…` | **yes, identical** |
| `npm test` on the rebuilt copy | 83/83 | 83/83 | |

## Other tools and formatted code

- `scripts/textsize-codemod.mjs` works on the formatted source unchanged: its patterns allow line breaks after `=` and `+`, and Prettier never changes the text inside strings (`embeddedLanguageFormatting: "off"`). Checked by turning the type-scale sizes in `src/js` back into pixels in both the unformatted and the formatted tree: the codemod found them in the same 4 files, and its output minified to the same code. `test/text-size.test.mjs` covers the formatted layout too.
- `scripts/lint.mjs` maps messages by character offset, so it isn't affected by layout; checked with planted errors in `core.js` and `guide/99-close.js`. Messages on the template's own lines (the closure wrapper, `const COLORS=…`) are reported as "template glue".
- `scripts/build.mjs`: the `@@dataurl(...)` inside a string in `guide/20-image-input.js` is kept as is by Prettier and still expands.

## ESLint

`eslint.config.mjs` (flat config) lints the code as shipped: all `<script>` blocks joined into one text under the virtual path `bundle/app.js`, `sourceType: "script"`, `globals.browser` plus `SF`. `scripts/lint.mjs` maps every message back to its `src/` file and line.

Linting file by file would be misleading. The files share one global scope, and the guide slices share one function scope, so every cross-file name would show up as undefined and every helper used from another file as unused; and the guide closure's opening and closing lines are in the template. `src/**` is therefore in the config's `ignores`, so a plain `npx eslint .` doesn't produce that noise; it only picks up `scripts/`, `test/` and `e2e/`, with no rules enabled.

Rules: `no-undef`, `no-unused-vars` (with `caughtErrors: "none"`) and `no-redeclare` as errors, `no-empty` (with `allowEmptyCatch: true`) as a warning, `no-var` off. The empty `catch` blocks and their unused bindings are deliberate, so they are not reported.

Counts on v259, the same before and after formatting:

| Rule | Count | Notes |
|---|---|---|
| no-unused-vars | 114 | 96 unused `catch (e)` bindings; 16 local variables assigned but never read (e.g. `panning`, `selLock`, `sfsec`, `EMPTY`, and `on`/`off` in `chrome.js` and `guide-bridge.js`); 1 unused top-level function (`nearest` in `picker.js`); 1 unused argument |
| no-empty | 72 (warnings) | all 72 are empty `catch` blocks (deliberate "ignore failure" spots) |
| no-undef | 17 | element ids used as bare globals through the browser's named access on `window`: `savedOverlay` ×12, `mCollection` ×5. They work, but fragilely. Without `SF` declared as a global there would be 33 more. |
| no-redeclare | 3 | `status` in `core.js` shadows the built-in `window.status`; `_sp` and `_shl` are declared twice with `var` in `guide/50-controls.js` |

At v259 the config used ESLint's defaults for `no-unused-vars` and `no-empty`, so the catch blocks were counted. It now sets `caughtErrors: "none"` and `allowEmptyCatch: true`, and the real items above have been fixed: the report is 0 errors, 0 warnings, before and after formatting (`nearest` in `picker.js` is kept for `test/matching.test.mjs`, with a disable comment).

## Suggested next steps

1. Decide whether to add a whitespace minifier to the build (step 3 option (b)): the review estimated −13 KB gzipped against the unformatted file at v259, for a build-time dev dependency.
2. Rewrite `00-state.js` with one variable per line, grouped by topic (cleanup step 4). Check that `npm run fingerprint` still shows the same `JS shipped` hash.
3. Make `lint -- --strict` part of CI, then work through the rest of the cleanup plan, one behaviour change per commit (each one is expected to change the fingerprint).
