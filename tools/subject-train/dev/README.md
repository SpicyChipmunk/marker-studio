# The subject model's own tools (for the repo, not the PC run)

How TRACER-TE0's stock file was exported (`vendor/subject/3/subject-te0.onnx` is round 3's A3, exported the same way by the kit's step 6), and how the training kit (the folder above, which Ben runs on his PC
as `ms-subject-train`) was put together and tested:

- `vendor.py <TRACER repo> <kit folder>`: copies TRACER's model code (github.com/Karel911/TRACER, Apache 2.0) into the
  kit's `tracer/` package with the changes listed in `tracer/NOTICE.md`, each one asserted.
- `equiv.py <kit> <TE0 weights> <onnx> [photo folder]`: the kit's model against an ONNX export of the upstream code with
  the same rewrites (to 1.3e-7 on noise, 4e-4 on real photos).
- `equiv_upstream.py <kit> <TRACER repo> <weights> <arch 0|2> [photo folder]`: the kit's model against TRACER's
  original code (an unchanged clone), both in PyTorch, at the arch's own size (TE-2: 2e-6 on real photos at 352).
- `export_stock.py <kit> <out.onnx> <TRACER-Efficient-0.pth> [arch]`: the app's stock file, made exactly as step 6 makes each
  candidate (ONNX opset 17, onnxslim, weights stored int8). TRACER's weights: the authors' v1.0 release,
  `TRACER-Efficient-0.pth`, SHA-256 1b5b222bc242fc59e77fae2464d5cf23e112d5b77b1fe6a6700c2a68d473dec6.
- `mock.py <kit> <folder> <weights>`: a small stand-in for Open Images, at its own paths, from scikit-image's public
  sample photos, to run the kit end to end without the internet (serve the folder, then set MS_KIT_BASE,
  MS_KIT_CONFIG, MS_KIT_WORK, MS_KIT_RESULTS and MS_KIT_CPU=1).

- `mock_round4.py <kit> <work> <results> [--after-safe]`: round 4's stand-in, on a finished round-3 stand-in run:
  before step 4, round 3's report set to "A3 shipped"; after step 4's first run (`--after-safe`), the free one-outline
  training photos given a case each (missed, wrong edge, too big; the Plant exception; group-of, person, inside and
  holding boxes; no box rows), then step 4 run again and compared. It also checks `classify()`, `box_checks()` and step
  6's routes (`s6_routes.route4`) for every outcome.
- `PLAN-round4.md`: round 4's plan as built (decisions 55–68).

Load weights with `weights_only=True`, and run Python on downloaded folders with `-I`.
- `check_route5.py <kit>`: round 5's routes (s6_routes.route5) on every outcome: candidate ships; veto hands over; a
  clearly-worse failure goes to -early, a short one or no gain to -wide (NOT FINAL until trained); C2's path after C1's.
- Round 5's stand-in (31 Oct): round 4's stand-in work folder with round 3's training list cut to 20 photos and 12 crops,
  CPU, batch 2, 3 passes (early = pass 2): 5-train (C1, C2), 6-results (NOT FINAL: C1-wide), 5b-train-wide (also carried
  on after a kill), 6-results again (cached: C1's section identical byte for byte; C1-wide judged, C2's path, NOT FINAL:
  C2-wide), and a forced ship (the app's file and full-size checks). TE4 on the processor needs more than 6 GB at
  batch 4: the cloud stand-in used batch 2 and MALLOC_ARENA_MAX=2.
