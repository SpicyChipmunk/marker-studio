# The cap reader bench

How well Scan › Photograph your caps reads real photos of marker caps, and whether a change to the reader moved only
what it meant to. The photos and the recordings are their owners' own: they live outside the repo (point
`READER_BENCH` at the folder), and nothing here writes into the repo.

```
# once per photo set (slow, ~15 s a photo: the real OCR in the real app)
OUT="$READER_BENCH/lent/reads.jsonl" node scripts/bench/reader/record.mjs ~/Photos/caps/*.jpg

# every change (about a second a photo: the recorded lines through this build's reading, no OCR)
npm run build
node scripts/bench/reader/replay.mjs --out /tmp/after.jsonl "$READER_BENCH/lent/reads.jsonl"
node scripts/bench/reader/score.mjs /tmp/after.jsonl --caps "$READER_BENCH/lent/truth"
node scripts/bench/reader/compare.mjs "$READER_BENCH/lent/baseline.jsonl" /tmp/after.jsonl
```

- `record.mjs`: each photo through the app with the OCR; appends every line read (text, box, the name line it belongs
  to), the read copy's size and the list. Re-record when the OCR changes (engine, worker, detector, sizes).
- `replay.mjs`: the recorded lines through a build's end-of-photo reading (`ocrLine`, `ocrDone`), Scan's parser
  included. `--harness` points at another build's `test/harness.mjs` (its `index.html` beside `test/`) for "before".
- `score.mjs`: against transcriptions. `--caps DIR`: one `PHOTO.json` per photo, `{caps: [{code, name, brand?}]}`,
  every legible cap as printed (old or current code). `--keys FILE`: `{T: {photo: [keys]}, A: {...}}` the markers in
  each photo, `--split FILE` with `{TUNE, HELD}` reported apart.
- `compare.mjs`: two runs side by side, photo by photo: markers listed or questions asked by only one.

Rules of use: tune on TUNE photos, check on HELD ones, never pool them; a change that moves anything it shouldn't on
any photo (compare.mjs) is looked at cap by cap before it ships; report numbers in docs, never the photos or the
recordings.
