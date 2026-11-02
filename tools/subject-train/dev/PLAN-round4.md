# Plan: subject model round 4 — v9 (build from this): decisions 55–68; after pressure tests 16–20 (FINDINGS-T…X)

## Decisions
- 55 Ship rule: a candidate ships if, on round 3's fresh test sets, it is reliably better than the benchmark on outline
  or small found (paired 95% low end > 0, however small) and passes every guard (58); otherwise the benchmark stays.
  Ben's 24 photos are the last check.
- 56 Round 4 trains on stock's failures ("disagree photos"), starting from the round-3 winner (the benchmark: A2plus or
  A3, by results-round3 under rule 55); no new downloads; before the beta.
- 57 Candidates: B1, named in advance; fallbacks by route (63, 65): B1 fails a guard, or fails both a guard and the gain
  → B1-early; B1 fails only the gain → B1-wide. If B1 passes it ships, even if a fallback looks better (reported for
  round 5). The candidates are an explicit config list (B1, B1-early, B1-wide): A2plus is never a candidate.
- 58 Guards: (a) round3_rule.guards against the benchmark; (b) round 2's rule vs stock (ship_rule via lines_for): a guard,
  decisive as in s6 (vs_ok in ok); only the benchmark's own replication vs stock is reported; (c) a fixed cap: false subjects on fresh empty crops ≤ A2plus + 1 point (stock is ~25%, so (b)'s
  "≤ stock + 1 point" can't hold it). Round 2's seen sets: reported only. People: a guard when n ≥ people_rule_min.
- 59 B1-wide = B1 with backbone blocks 8–15 trained (B1: 11–15). 59b: 8 passes each.
- 60 Round 3's agreeing photos keep their labels (Ub). Disagree photos: ONE outline only, plus the stricter box checks
  in D1, so agree and disagree photos never teach opposite things about a second object.
- 61 The cap's order: all missed photos (M-little, M-else) first, then wrong-edge photos by hash to the cap.
- 62 A3 ships in v329.2 (vendor/subject/3); it is the benchmark and B1's starting weights.
- 63 B1-early = B1's pass-5 EMA snapshot (not averaged), judged only if B1 fails a guard; B1-wide only if B1 fails to
  show a reliable gain. At most one fallback per route; both named in advance.
- 64 The small agreeing training photos are also shown twice a pass (B1 and B1-wide): small_agree.txt = round 3's
  train.txt ∩ one outline ∩ label share in [0.01, 0.05) (≈ 1,530: 1,564 agreeing one-outline 1–5% photos in no check set,
  less validation's; one outline, so no second object taught as background, as 60). Listed in small_agree.txt, checked
  in D4, copied in D6, counted in step4-counts, exercised in K2; pasted-subject sources are drawn from train.txt alone.
- 65 B1 fails both a guard and the gain → B1-early is judged (not B1-wide).
- 66 A preview group fails and is dropped → the cap is refilled with wrong-edge photos by hash (every kept missed photo
  is used either way); if the wrong-edge group fails, the missed photos are used alone, under the cap.
- 67 Background classes stay excluded as outlines at any size, except "Plant" outlines with all_share in [0.01, 0.05)
  (small generic plants), which are allowed, with every box check (another Plant box counts as a rival). "Tree" is the
  list's only other plant-like name; Houseplant, Flowerpot, Vase, Cactus and every flower class were never on it.
- 68 Disagree photos are shown twice a pass, whatever the pool's size (no 3× rule).

## Before building (done)
P1. Round 3's sort.csv, approximated (r, p from share, all_share, stock_iou; no box checks): not agreeing, outline ≥ 1%,
    not in a check set — one outline only: missed 7,318, wrong edge 9,696 (small 1–5%: 2,134 and 774). Stock found
    nothing in only 384: most misses are stock picking something else.

## Data (step 4)
D1. Disagree photos: training-pool photos, `not agree`, not reserved / val / SEEN / SEEN_TOPUP / any round-3 list,
    loose = 0, nmasks == 1, outline share ≥ 1%, the outline's class NOT in CFG['background'] (except Plant at 1–5%: 67) (35 classes: Table, Bed,
    Couch, Shelf … — 2,755 of 7,318 M photos have a ≥ 30% outline stock left: often furniture with the real subject on
    it), in the box table (hasbox), no person box, no IsGroupOf box of a non-background class outside the outline (read
    IsGroupOf and IsInside separately: today's b[5] is either), and no other box at least a quarter of the subject's
    box — boxes INSIDE the outline counted too (unlike outside(): 2,175 of 3,052 M-little photos are ≥ 30% outlines with
    stock's mark inside them, e.g. a car with a boxed dog in it), skipping the outline's own or parent box (box IoU ≥ 0.5,
    or ≥ 0.9 × its area) and background classes (a cat on a boxed bed stays). New: Boxes.rival_at(iid, masks, frac,
    skip, inside=True) and the train branch of Prep.one computing it. Label = the one outline at full size.
    Classified WITHOUT re-running stock, from round 3's sort.csv (one outline: r, p exact from share, all_share,
    stock_iou; err = agree_err(S, L) when r ≥ 0.5; rows within 0.005 of a boundary counted and reported):
    - M-little: r < 0.5 and (p ≥ 0.5 or stock share < 1%) — stock found little or nothing of it;
    - M-else: r < 0.5, p < 0.5, stock share ≥ 1% — stock picked something else (the riskiest labels);
    - B, wrong edge: r ≥ 0.5, p ≥ 0.5, err > 0.15;
    - O, too big: r ≥ 0.5, p < 0.5 — dropped.
    Step4-counts prints the pool by group, class (top 20), outline-size band and each filter's drop (the background
    rule's by class), before Ben's go-ahead.
D2. Cap = round(0.25 × len(train.txt)) unique disagree photos (20% of train + disagree: ≈ 8,833, before the 2× showing); order by decision 61 (all kept missed photos, then wrong-edge by hash; refill as 66); no group balancing; listed in disagree.txt (step 5 adds it
    after train.txt, twice). Floor: fewer than 1,500 → step 4 stops and says so.
D3. Validation of stock's failures (val_hard_small drawn from the D1-filtered M pool): val_hard = 400 held-out hv "subjects" photos with stock_iou < 0.85, not SEEN, by hash
    (829 qualify before SEEN; stock-free, all outlines); val_hard_small = ~300 M photos with a 1–5% outline, by hash,
    reserved before the training pick. Both logged per pass (overlap, outline; found).
D4. Step 4 asserts and prints empty intersections: disagree ∩ {round 3 train, val, val_small, test_*, val/test crops'
    photos, SEEN, SEEN_TOPUP, val_hard, val_hard_small}; the overlap with training crops' photos is reported, not
    forbidden (those crops are stock-quiet, outline-free regions: consistent with the label).
D5. Previews: 72 kept photos (after the cap and filters), stock's subject and the outline in two colours: 24 M-little
    (12 outlines ≥ 10%, 12 under), 24 M-else (the same split), 24 B zoomed to the subject's box at 320 px (edge errors are invisible at
    160). Stock is run on those 72 only. Pre-registered: a group stays only if ≥ 20 of its 24 look right to Ben; a
    failing group is dropped by re-running the list step: config disagree.drop lists the groups (M-little, M-else, B);
    `4-label.bat --lists-only` runs no stock and makes no new previews, rebuilds disagree.txt, val_hard_small.txt and
    their labels, re-marks .done-s4, and leaves runs/ and the other labels alone. If the drops take the pool under the
    1,500 floor, step 4 stops and says round 4 isn't worth training.
D6. round3_safe (idempotent, a done marker; called first by steps 4 and 6 when round ≥ 4) copies: lists/*.txt,
    crops.csv, sort.csv, ALL of work/labels, runs/A3/best.pt + history.json, results/report.json|md, step4-counts.txt.
    Step 4 restores the labels after its clear and LOADS round 3's lists (train, val, val_small, crops, test_*), adding
    disagree.txt, val_hard.txt, val_hard_small.txt and their labels.
D7. Residual risks, reported not fixed: the fresh small set's top-ups share the disagree photos' population (disjoint
    IDs); B-photo outline gains may partly fit Open Images' outline style, which the test outlines share; small-set
    "false beyond the outline" is reported only and worth watching; agree photos teach nearby second objects as
    background (5,548 of 36,850 agree photos; ≈ 1 point of overlap on the 21% of test photos with several outlines).
    Ben's 24 photos (benchmark and candidate side by side) are the real-world check for all of these.
    Round 3 showed the small-set population effect is real: A3 − A2plus small found +2.1 on fresh top-ups, +0.4 on seen
    top-ups, −1.1 on seen hand-checked (442). And people: training never sees a person (s2 leaves them out); people
    outline is below stock for both models (−0.013) and is B1's likeliest guard failure.
D8. Scenery: no set possible from this data (the kit's "scenery" photos are un-outlined subjects, not landscapes; Open
    Images segmentation has no mask-free photos). Empty crops stay the rule's proxy; s6 skips the scenery line when n = 0.
    Ben's 24 already include five landscapes (beach, sea path, street tree, lake, sunset): they're the scenery check.

## Training (step 5)
T1. B1: from the benchmark's weights (load_tracer(path); the pass-0 line names the warm start, and the pasted-subject
    warning compares with stock's own evaluation, not pass 0); A3's learning rates (5e-5 decoder, 1e-5 blocks 11–15); 8
    passes (a per-run passes setting, not n_passes); a 100-step linear warmup; disagree photos twice a pass (about a third
    of steps); zoom_out, paste_sources 16, EMA 0.999 as round 3; the kept model = the average of the last 3 passes.
T2. B1-wide: the same with blocks 8–15.
T3. Every pass's EMA snapshot saved (s5's last-K condition dropped); per-run passes clamp under --quick; nothing picked by validation except B1-early, named in advance (63).
T4. Per-pass log adds val_hard (overlap, outline, found); the start line evaluates stock and the benchmark on every
    validation set (val subjects, val_hard, val_small, crops).

## Step 6
S1. Models: stock, A2plus (work/round2, always: guard 58c needs it), A3 (work/round3, never via done('s5-A3')), B1,
    B1-early (runs/B1/ema-05.pt; its pasted-subjects guard reads the history entry with epoch == 5), B1-wide; benchmark = report.json's decision from round 3 (stops if it says stock). round4_rule: beat_outline 0,
    beat_small_found 0 (low end > 0), round3_rule.guards, crops_false_vs_A2plus 0.01, the benchmark's replication vs
    stock reported as a sanity check.
S2. Coded as routes, not s6's round-3 loop (there the LAST passing model wins: a passing B1-wide would override a
    passing B1): B1 judged by 55 with 58's guards; fails a guard → B1-early only; fails to show a gain → B1-wide only;
    both → B1-early (65); everything else reported, never decisive. The report's honesty line says two looks (≈ 1 in 20
    for a model no better than A3). To pass, B1 needs about outline +0.0025 or small found +1.1 points over A3.
S3. Reported (beside the decisive small line: round 2's seen hand-checked small, 442, paired): "where stock was right / wrong" for subjects and small, with 95% intervals, in the paired table too; the
    hand-checked-only paired line; round 2's seen sets; people.
S4. Ben's 24 photos, benchmark and candidate side by side (from the exported ONNX files, as round 3), then a dev build
    of the app with the winner on the iPad before K3.

## Kit and release
K1. config round 4 + round4_rule; round3_safe (copy of round2_safe); s6 BASE from the report; dead disagree_err removed;
    the step-4 histogram prints misses.
K2. Stand-in run on mock data, forcing each of step 6's four route outcomes (B1 passes; fails a guard; no gain; both)
    and checking the decision; pastes drawn from the original train list; a mock work/round3 (sort.csv, labels, report.json with a decision), a box table with
    IsGroupOf and IsInside, candidates with classes; step 4 run twice; zip ms-subject-train-round4.zip.
K3. If B1 or B1-wide wins: vendor/subject/2 on v329.2 (hash, size, README, cache), the v329.2 zip, merge into v329.3.

## Time
Build and stand-in test ≈ 1 day. Ben's PC: step 4 ≈ 5–10 min (no stock run) + previews; step 5 ≈ 3–3½ h (B1 ≈ 12 min a
pass × 8, B1-wide ≈ 13); step 6 ≈ 50 min (six models). Then the 24 photos and K3. About 2–3 days in all.
