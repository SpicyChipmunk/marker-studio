# Plan: an opt-in Scan log (deferred)

Status: planned for v318.9, pressure-tested, then **deferred** (October 2026). Build it when photos come from more
than one person, or when real iPad sessions are needed as test cases. At the time of deferring, the author was the
only one photographing caps and their collection was already in the app, so the log's "answers and Add as ground
truth" would have given little: with markers already owned, Add commits nothing. Truth for new photos is transcribed
from the photos instead.

Purpose: turn real sessions on a device into exact replays of the photo reader and Scan, with the user's answers as a
seed for ground truth. Records codes, words and decisions only, never images. Off by default; nothing leaves the device
unless the user saves the file.

## Findings that changed the first plan (summary)

1. **Exact replay needs the reader's stream**, not only its final lines: the app feeds ocrLine the streamed lines,
   which can differ from the final ones (dropped single characters and low-confidence lines; names paired later), and
   an item taken at once from the stream is kept. Record the stream as a small diff (1–4 KB a photo).
2. **Size**: about 31 KB per photo on real trays (up to 69 KB); cap the store by bytes as well as by session count,
   and store one record per photo.
3. **Privacy**: text pasted into Scan's box can be an order email (name, address, order number). Blank every word
   that isn't a code, colour-name word, brand, cap or set word, or a short number (letters to x, digits to 7: not 0,
   which reads as an upside-down code). Prototyped: 9 of 9 pastes read identically after blanking.
4. **A session needs its starting state**: the list before it (with each entry's flags), the brand state (chosen,
   automatic, the switch to both brands), photo numbering, and which touched markers are owned; box reads also need
   their times (several rules depend on seconds since).
5. **Hooks**: many actions are anonymous handlers; record them with one capture-phase observer plus list snapshots
   after each draw, rather than editing each handler.
6. **Never during reading**: keep references while a photo is read; serialise and write once at its end.
7. **Events not to miss**: a failed photo's gentle retry (two streams), Stop, closing mid-photo, the box flushed at
   close, the switch to both brands and why, a set taken, Find mode, Undo of Add from the toast after close.
8. **Answers + Add are a seed, not truth**: owned markers hide wrong reads; an unchecked Add blesses them; per-photo
   truth needs the "already in the list" key set; × and "Not this cap" are evidence of a wrong read.
9. **Estimate**: 2–3 days (not half a day). Risk to behaviour low (records only, proved by replays being byte-identical
   with the log on and off).

Side finding (not the log): pasting "00000" into Scan's box asks "Upside down: which one?" offering Copic G0000 (the
upside-down rule for a lost first letter, on a digits-only word). Harmless (asked, never added); worth a small fix.

## The pressure test's report (the corrected plan in full)

Worktree read: v318.8 (e787cf2). Probes in `pt-scratch/` (analyse.mjs, redact.mjs, proto-session.json); the worktree is clean (no zz files, index.html unchanged).

## 1. Verdict: go with changes

The idea is sound and cheap in risk (records only), but the plan as written would not give an *exact* replay, under-estimates size ~3×, leaks pasted order emails, and hooks the wrong things (several actions it names live in anonymous click closures). The corrected plan below keeps the purpose and fixes those. Realistic cost 2–3 days, not half a day.

## 2. Problems, ranked (with evidence)

1. **"Each photo object is directly usable by replay3/perphoto3" is true but not "replays exactly".** Both tools feed the *done* lines to `ocrLine` and `ocrDone`; the app feeds `ocrLine` the *streamed* `line` messages (worker.js `hooks.line`), which differ from the done lines: measured on two drawn trays in Chromium (real reader): 5/91 and 1/87 streamed items are absent from the done lines (single characters and low-confidence lines `order()` drops, engine.js:450), and `nameOf` differs on 19/91 and 5/87 (the stream is pre-`latePair`, so a cap's name arrives as a code candidate). The app keeps a streamed-only item that went in at once (`ocrSettle`: `r.taken.forEach(id => !items.has(id) && r.items.has(id) && items.set(...))`), so a done-only replay can diverge. On the two synthetic photos both replays matched the app's list exactly (0 differences); on the author's real trays (230–500 lines) it is unmeasured because the captures hold only done lines. Fix: record the stream too, as a diff (ids in order; a full item only where it differs from the done line of that id) — measured 1.1–3.8 KB per photo — and teach the replay (a new `replay-session` or a `STREAM=1` mode) to use it. The log then carries the app's own outcome, so every saved log self-checks.
2. **Size estimate is ~3× low.** the author's real photos (hfin iOS captures, 39 photos) in the production line shape (`id,look,text,conf,unsure,nameOf,alts,turn,box`, compact JSON): median 31 KB, max 69 KB per photo (close-ups: 502 lines), not 12–20 KB. A 19-photo Ohuhu session ≈ 0.6–1.3 MB; 5 such sessions ≈ 3–6 MB. Fine for IndexedDB, but put a byte cap on the store (e.g. 24 MB, oldest sessions dropped) rather than trusting a count, and store one record per photo (see below) so a 19-photo session isn't rewritten whole 19 times.
3. **Privacy: a pasted order email or a list file carries a name, address, email and order number**; the plan says "capped" only. The existing Copy-diagnostics trace keeps 18 characters; a log keeps the whole thing. Fix (prototyped): redact box text before it is kept — every token that isn't a code (as read or put right), an old code, a word of a marker's name, a brand/cap word, a set word, or a number of ≤4 digits becomes x's (letters) and 7's (digits) of the same length, punctuation and lines kept. Through `scanHandle` in the harness, 9/9 made-up pastes (order email with name/address/zip/tracking, Live Text tray, Copic list with brand words, set box, Cool Gray No.3, Ciao 72 Set A and B, stray-number line) read to the same list, questions, cards and set offers as the raw text (only a card's quoted text differs). Digits must become 7, not 0: "00000" reads as Copic G0000 upside down (scanTurned's lost-first-letter rule — an app quirk worth a look in its own right: paste "00000" and Scan asks "Upside down: which one?"). Photo lines are OCR of caps and are kept raw; say so in Help ("the words it reads off the photo").
4. **The replay has no starting state.** Photo decisions depend on: the list before the photo (entries' `photo`, `how`, `auto/autoAt/flip/whole/held/pasted` flags; questions' `opts/how/opts0`), `scanBrand`, `scanBrandChosen`, `scanAutoB` (→ `scanAuto()`), `scanSw` (`on/off/autoOnly/whole/other/seq` — it lives for the page, not the visit, so a session can start switched), `ocrPhotos`, `ocrAnswered`, `state.owned` for `scanNew()`/Add/`scanDropOwned`/"already yours". The plan records brand and a collection *count*: Add and the owned-question drop can't be replayed. Box reads additionally depend on the clock (`scanAsk` 4 s/2.5 s windows, `scanTake` 6 s/10 s, `scanCardAgain`/`scanLastMany` 6 s): a faithful sweep replay needs event times and a scripted `Date.now` in the harness (createApp can take a fake `Date`).
5. **The hooks named don't exist as functions.** Brand taps, Keep Ohuhu/×, ×-off-the-list, Clear list, the card's choice buttons, Undo of Add (`scanUndoAdd` is a closure inside `scanAdd`) and Undo this photo are anonymous handlers in `70-dialog.js`, `15-answer.js` (zoom) and `photo-read.js ocrButtons`. Hooking each would mean edits inside ten closures — exactly where "can't change behaviour" is hardest to show. Better: observe (a capture-phase click listener of the recorder's own; it can't change behaviour unless it throws, and it is wrapped) plus list snapshots after every draw; name the action from the target's class/id and let the diff say what the app did.
6. **"Not during reading" is only half the story.** Writes aside, nothing may *copy* per line: push references (the app never mutates streamed items; `ocrNoPipes`/`ocrAlt` make new objects) and serialize once at the photo's end. Also a batch's next photo starts decoding right after `ocrQueueOn`; an IndexedDB put there is async and fine, but only if it is one small record, not the whole session.
7. **Missing events:** `ocrFailed` (memory → gentle retry resets `r.items`, so a photo can have *two* streams; a failed photo), Stop (`aborted`), `ocrClose` mid-photo (entries taken back out), `scanFlushBox` at close (text read muted on the way out), `scanSwitchOn('paste'|'read'|'photo')`, `scanReread` (another tab replaced the list between sessions — the session-start snapshot covers it), a set added by name (`scanSetTake`), Find mode (separate list; record with `mode:'find'` or skip), and Undo of Add arriving *after* close via the toast (the recorder must keep the last session open for it).
8. **Ground truth from answers + Add is a seed, not truth.** Besides misses (admitted): (a) with a collection already owned, Add commits nothing (`scanNew()` excludes owned) and a wrong read that lands on an owned marker is invisible; (b) a tester who taps Add without checking blesses wrong reads; (c) a marker read in photos 1 and 2 is listed once with photo 1, so per-photo T needs `r.listed` (keys, not the count) — the plan's "already in the list" must be the key set; (d) a × on a row or Not this cap is evidence of a wrong read/ask (replay3's `askBad`), which the plan doesn't use; (e) codes typed right after a photo are probably its misses but can't be attributed. The converter should emit `T` per photo with a provenance sidecar (added / answered / listed / removed / rejected / typed-after) and an `A` of []; the author edits from there.
9. **Estimate.** Recorder (~250 lines incl. an IDB store copied from `scanPics`), redaction, snapshots/diffs, observer, Help switch + Save/Clear + wording, wipe, converter + round-trip checker, unit + e2e (Chromium and WebKit), README/CODE-TOOLS/CHANGES/What's new/DEVICE-TEST lines: 2–3 days. Risk low–medium: the code path is read-only; the places that can bite are the share path (handled by `handOver`'s "tap expired" toast) and the Help UI.

### Answers to the plan's questions

- **Photo record complete enough?** With: the stream diff (1), `turn` and `alts` (already in the worker's `ser`, same shape replay3 makes from `dbg.all` — no reconstruction needed), `r.img.w/h` (ocrCut's edges), the `read` message's options (`detTiles` = device/gentle; `maxSide`), the photo number `r.n`, `r.gentle` retries, `aborted`, and the starting state (4). `scanGen`/`r.brand` are derived from the lines; record them as outcomes to check against, not inputs. A session replay also needs earlier photos' entries (they're the list snapshot), box reads in between (with times), and owned status — but only for markers the session touched (flag entries `y`), which is enough for `scanNew`, `scanDropOwned` and labels; `scanSetGaps`' "all but 2 are here" card isn't a list decision and can be skipped.
- **Near ground truth sound?** As a seed with provenance, yes (8). Misses and owned-masked wrongs are not in it.
- **Where to hook, and how to prove nothing changes.** One-line calls at: `photo-read.js ocrLine` (entry, push the item), `ocrDone` (entry, keep `m`), `ocrGo` (before `postMessage`: n, w, h, options, gentle), `ocrFailed`, `ocrSettle` end (write the photo's record), `scan/50-handle.js scanHandle` (entry: text, loud, `scanIme`, time), `scan/70-dialog.js openScan`/`closeScan` (session start snapshot / end), `scanRender` (list snapshot → diff; skipped while `ocrRun && !ocrRun.done`), `scanAdd` after `keep()` and in `scanUndoAdd` (keys), `safety.js wipeAllData` (delete + lock). Everything else by the observer. Proof: (i) replay3/perphoto3 over the 20 hfin/sfin captures with `PRE` switching the recorder on vs off → out JSON byte-identical (the "reader gates unchanged" test, run once per release); (ii) a unit test that every recorder entry point leaves `JSON.stringify` of `scanList`, `state.owned`, `ocrRun` (minus `soon`) and `scanSw` unchanged and never throws, with the harness's stub IndexedDB; (iii) an e2e spy on `IDBDatabase.prototype.transaction` asserting none opens while `ocrRun && !ocrRun.done`; (iv) a `cpuMs` bound on 500 `ocrLine` hooks. move-check will flag the edited functions; that's expected and not the proof.
- **Storage/wipe/two tabs/Private Browsing/share sheet.** IDB `ms-scan-log`, stores `s` (session headers, key = session id) and `p` (photo records, key = `[session, n]`), open timeout/quiet failure/wipe flag as `scanPics`; prune by session count (5) *and* bytes (24 MB) in the same readwrite tx as the put. Two tabs each write their own sessions (keys don't collide; IDB serializes). Private Browsing: quiet failure; Save says "No Scan log kept on this device" when the store is empty. Wipe: `delDb('ms-scan-log')` beside `ms-scan-pics`, `scanLogWipe()` first so nothing is written after; the switch key `ms-scan-log` goes with the `ms-` sweep. Share: the same `handOver` as Back up — on iPadOS the sheet offers Save to Files, AirDrop, Mail (DEVICE-TEST §6 already checks Back up this way); headless WebKit can only stub `navigator.share`, so this is inferred from Back up, not measured; add a DEVICE-TEST line.
- **Leaks.** Pasted/typed/opened text (3); the collection (record ownership only for touched markers); file names (keep name, size, type — `IMG_1234.jpg` is harmless); cap photos never (no pixels, no crops; questions' `crop` data URLs must be stripped from snapshots — they're on the same list entries). Help wording below.

## 3. Corrected plan

**Scope.** A recorder (`src/js/scan/25-log.js`, before `50-handle`; a `const scanLog = (function(){…})()` object with `on`, `start/end/line/done/go/fail/photo/text/list/add/undoAdd/wipe/save/clear`), one-line calls at the sites above, an observer listener, the Help switch, a converter and a round-trip checker in `scripts/`.

**Recorded, per session** (`openScan` → `closeScan`, plus a 15 s grace for the toast's Undo):
- `meta`: `v` (appVerShown), `at` (ISO), `dev` (iPad/iPhone/other via `isIOSDevice`+UA), `standalone`, `brand`, `chosen`, `auto` (scanAutoB), `sw` {on, off, autoOnly, whole:[keys], other:[keys], seq}, `photos` (ocrPhotos), `owned` (count), `mode` ('scan'|'find').
- `list0`: the list at open, entries as `{k, how, p, y, auto, autoAt, flip, whole, pasted}` / `{ask, title, opts:[{k,how}], opts0, p, y:[bools], held, whole}` (never `crop`; `y` = owned now).
- `events[]`, each `{t: ms since open, k: kind, …}`:
  - `text` {text (redacted, ≤20 KB, ≤200 KB per session), loud, ime}
  - `act` {what: answer|not|x|brand|keep|swoff|clear|add|close|undoPhoto|done|stop|card|set|file|undoAdd, n, key, how, label}
  - `list` {add:[entries], del:[entry keys/asks], brand, sw:on} — the diff since the last snapshot, written after every draw outside a photo read, attributed to the last `act`/`text`/`photo`
  - `add` {keys}, `undoAdd` {keys}
  - `switch` {why}
  - `photo` {n} (start) — the photo's body is its own record.
- **Per photo** (record `[session, n]`): `n`, `file` {name,size,type}, `w,h`, `o` {detTiles, maxSide, gentle}, `stream` (ids in order; a full item where it differs from the done line of that id; a second array after a gentle retry), `done` (the raw `done` message: lines, stat, ms, aborted), `fail` {memory, note} if any, `out` {taken ids, gen, brand, added keys, asked keys, listed keys, same, switched, ms}, `list` diff after settle, `t0/t1`.

**File format** (Save): `{ app, made, format: 1, sessions: [{ meta, list0, events, photos: [...] }] }`, name `marker-studio-scan-log-<date>.json`, via `handOver` (title "Scan log", what "Scan log"). Compact JSON (a session can be MBs).

**Converter** `scripts/scan-log-convert.mjs <log.json> <outdir>`: per session writes `res/<tag>.jsonl` (one line per photo: `{file:['s<k>-p<n>.jpg'], ios, ms, stat, lines: done.lines, stream, list0, brand, sw, txt}`), `dims.json` (`s<k>-p<n>: [w,h]`), `truth-seed.json` (`T` per photo from `out.added ∪ answers ∪ listed` at session end minus `del`, `A: []`, plus `provenance`), and `session.json` (the event timeline). `scripts/scan-log-check.mjs <log.json>` replays each photo (stream → `ocrLine`, done → `ocrDone`, from `list0`+diffs, owned from `y`, brand/sw/photos from meta) through `index.html` in `test/harness.mjs` and reports per photo whether `taken`, `gen`, `brand` and the list diff match `out` — the fidelity test on real photos, run on every saved log. A `STREAM=1` env for replay3/perphoto3 (private, scratchpad) to prefer `stream` when present is a 3-line change.

**Storage/wipe/privacy.** As answered above. Switch `ms-scan-log` = '1'. "Clear Scan log" deletes the DB. Nothing in Send feedback/Send results.

**Wording.** Help › Your data, after the backup line: a switch **Keep a Scan log** with: "Keeps your last five Scan sessions on this device, for finding reading mistakes: the codes and words the photo reader read off your caps (never the photos), what the box was sent with words that aren't codes or colour names blanked, and what you chose. Nothing leaves this device unless you tap Save Scan log." Buttons **Save Scan log** · **Clear Scan log** (shown while on; Save says "No Scan log kept on this device yet" when empty). The data bullet gains: "With Keep a Scan log on, the last five Scan sessions are kept here too (below)." Delete all my data's line: "…and the Scan log."

**Tests.**
- Unit (`test/v3189-scanlog.test.mjs`): recorder from made-up lines/answers builds the expected session (list0, diffs, photo record, stream diff); redaction rule (the 9 pastes above read the same; digits → 7); every entry point leaves state JSON-identical and never throws with the stub IDB; the converter on a fixture log writes jsonl/dims/truth-seed with the right provenance; `scan-log-check` passes on a fixture log recorded by the e2e below; `cpuMs` bound on 500 line hooks.
- e2e (`e2e/v3189-scanlog.test.mjs`, Chromium + WebKit): switch on → real reader on a drawn tray + answer + × + brand tap + Add + toast Undo → Save gives a file (download; share stub as backup.test.mjs) with the expected structure and the check script passes on it; switch off records nothing (IDB absent); 6 sessions keep 5 and a byte cap drops the oldest; Delete all my data removes DB and switch and nothing is written after; two tabs; no transaction during a read (spy); Private-Browsing-like failure (IDB.open throwing) is quiet and Save says so.
- Release gate: replay3 + perphoto3 over hfin/sfin with the recorder on vs off, byte-identical outputs.

**Time and risk.** 2–3 days. Risk: low for behaviour (read-only, wrapped, observer-based); medium that the first real logs show replay differences on the author's trays — which is the point, and the checker makes them visible.

## 4. What the prototypes showed

Measured:
- Real reader, two drawn 24-cap Ohuhu trays, Chromium (16 s): stream vs done — 5/91 and 1/87 streamed items not in the done lines; `nameOf` differs 19/91 and 5/87; no other field differs; no id streamed twice. Replaying from the done lines (replay3's way) and from the stream both reproduced the app's list, taken ids, gen and brand exactly. Bytes per photo: done lines 12.0 KB (9.3 KB without alts), stream 12.9 KB, stream as a diff 3.8 KB and 1.1 KB.
- the author's real photos (39 hfin iOS captures): 52–504 lines; production line shape compact JSON 6.9 / 31 / 69 KB (min/median/max).
- Redaction (letters → x, digits → 7, codes/name words/brand/cap/set words/≤4-digit numbers kept): 9/9 pastes read to the same list, questions and cards through `scanHandle`; with digits → 0, two differed ("00000" asked as Copic G0000 upside down).

Inferred (not measured here): the iOS share sheet's Save to Files/AirDrop for a `.json` (from Back up, device-tested in DEVICE-TEST §6; headless WebKit can only stub `navigator.share`); stream/done divergence on real trays (captures have no stream); IndexedDB behaviour in Safari Private Browsing.
