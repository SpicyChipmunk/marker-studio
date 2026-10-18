// v318.15: specks in the blank paper round a drawing are made paper (a faint one up to 3 mm², grain lighter than the
// lines in the margin up to 10 mm², with the crumbs of paper a clump closes in); a dark dot in the margin and a speck
// inside a section stay. A binding or table along the
// edge of an uncoloured photo is found (edgeBandsOf) and Trim it is offered only then (trimOffer). Fails on v318.14.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const W = 800,
  H = 1040,
  M = 120;
// a page with a 120 px blank margin round a grid of lines (grey 30), and marks put on it
function page(marks) {
  const g = new Uint8Array(W * H).fill(245);
  for (let y = M; y < H - M; y++)
    for (let x = M; x < W - M; x++)
      if ((x - M) % 80 < 3 || (y - M) % 80 < 3 || x >= W - M - 3 || y >= H - M - 3) g[y * W + x] = 30;
  for (const [x0, y0, s, v] of marks)
    for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) g[y * W + x] = v;
  return g;
}
const MARKS = [
  [40, 40, 4, 190], // faint, in the margin: goes
  [60, 300, 5, 120], // lighter than the lines, in the margin: goes
  [40, 600, 5, 30], // as dark as the lines, in the margin: stays
  [300, 300, 4, 190], // faint, inside a section (not in the paper round the drawing): stays
  [660, 960, 8, 120], // a clump of grain in the margin ...
  [663, 963, 2, 245], // ... with a crumb of paper inside it: both go
];
function seg(g) {
  const app = createApp(),
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.segment();
  return t;
}
const what = (t, x, y) => {
  const l = t.labels[y * W + x];
  return l < 1 ? 'ink' : t.comps[l].bg ? 'paper' : 'section';
};

test('specks in the paper round a drawing: faint ones and grain lighter than the lines go; a dark dot stays', () => {
  const t = seg(page(MARKS));
  assert.equal(what(t, 41, 41), 'paper', 'faint speck');
  assert.equal(what(t, 61, 301), 'paper', 'light grain');
  assert.equal(what(t, 41, 601), 'ink', 'a dark dot in the margin stays');
  assert.equal(what(t, 301, 301), 'ink', 'a speck inside a section stays');
  assert.equal(what(t, 661, 961), 'paper', 'the clump');
  assert.equal(what(t, 663, 963), 'paper', 'the crumb inside it');
  // 16 + 25 + the clump's 60: what went, each pixel once
  assert.equal(t.speckGone, 16 + 25 + 60);
  // the paper round them is one section, and its area counts them
  const bg = t.labels[41 * W + 41];
  assert.equal(t.labels[601 * W + 61 - 300 * W], bg);
  const n = t.labels.reduce((s, v) => s + (v === bg), 0);
  assert.equal(t.comps[bg].area, n);
  // the lines are untouched
  assert.equal(what(t, M + 1, M + 40), 'ink');
});

test('the size limits are on the page: 3 mm² for a faint speck, 10 mm² in the margin (the picture as a Letter page)', () => {
  const t = seg(page([]));
  const mm2 = Math.pow(Math.max(W, H) / 279.4, 2);
  assert.ok(Math.abs(t.speckCap(3) / (3 * mm2) - 1) < 0.05, String(t.speckCap(3)));
  assert.ok(Math.abs(t.speckCap() / (10 * mm2) - 1) < 0.05, String(t.speckCap()));
  // a faint mark bigger than 3 mm² away from the margin's rule isn't a speck; one too big for 10 mm² stays anywhere
  const big = Math.ceil(Math.sqrt(t.speckCap())) + 2;
  const t2 = seg(page([[30, 400, big, 120]]));
  assert.equal(what(t2, 31, 401), 'ink');
  assert.equal(t2.speckGone, 0);
});

test('a page with no margin (edge to edge) keeps its marks: none of it is the paper round a drawing', () => {
  const g = new Uint8Array(W * H).fill(245);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 80 < 3 || y % 80 < 3) g[y * W + x] = 30;
  const t = seg(g);
  assert.equal(t.speckGone, 0);
});

// (the steps with a paint between them, segRun, are in e2e/v31815.test.mjs: the harness has no timers)

// an RGB picture w x h of paper (240) with bands put on it
function rgb(w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4,
        c = fill(x, y) || [240, 240, 236];
      d[j] = c[0];
      d[j + 1] = c[1];
      d[j + 2] = c[2];
      d[j + 3] = 255;
    }
  return d;
}

test('a binding or table along an edge: dark grey or brown bands are found, hatching and colour are not', () => {
  const t = createApp().__mstest,
    w = 600,
    h = 800;
  // a dark binding across the top 30 px, a brown table down the right 24 px
  const b = t.edgeBandsOf(
    rgb(w, h, (x, y) => (y < 30 ? [50, 50, 52] : x >= w - 24 ? [140, 110, 85] : null)),
    w,
    h,
  );
  assert.ok(b, 'found');
  assert.ok(Math.abs(b.t - 30 / h) < 0.003, 'top ' + b.t);
  assert.ok(Math.abs(b.r - 24 / w) < 0.003, 'right ' + b.r);
  assert.equal(b.l, 0);
  assert.equal(b.b, 0);
  // a binding's wire and holes: dark runs of 8 px with gaps, along a shadowed strip
  const wire = t.edgeBandsOf(
    rgb(w, h, (x, y) => (y < 20 ? (x % 14 < 8 ? [40, 40, 40] : [150, 150, 150]) : null)),
    w,
    h,
  );
  assert.ok(wire && wire.t > 0.02, 'wire ' + JSON.stringify(wire));
  // hatching at the edge (lines 2 px wide), a page of coloured pencil and a page with nothing: none
  assert.equal(
    t.edgeBandsOf(
      rgb(w, h, (x, y) => (y < 40 && x % 6 < 2 ? [30, 30, 30] : null)),
      w,
      h,
    ),
    null,
  );
  assert.equal(
    t.edgeBandsOf(
      rgb(w, h, (x, y) => (y < 40 ? [40, 90, 200] : null)),
      w,
      h,
    ),
    null,
  );
  assert.equal(
    t.edgeBandsOf(
      rgb(w, h, () => null),
      w,
      h,
    ),
    null,
  );
  // no more than 6% of the picture is taken
  const deep = t.edgeBandsOf(
    rgb(w, h, (x, y) => (y < 200 ? [50, 50, 52] : null)),
    w,
    h,
  );
  assert.ok(deep.t <= 0.06 + 1e-9, String(deep.t));
});

test('Trim it is offered for a photo as taken, not coloured in, with bands, when Auto crop would crop; not once cropped', () => {
  // (a drawing with a margin round it, which Auto crop would trim)
  const t = seg(page([]));
  assert.equal(t.edgeBands, null, 'a new picture starts without bands');
  assert.equal(t.trimOffer(), false);
  t.edgeBands = { t: 0.04, b: 0, l: 0, r: 0.02 };
  t.pgOrig = {};
  t.srcColour = 0.01;
  assert.equal(t.trimOffer(), true);
  t.srcColour = 0.2;
  assert.equal(t.trimOffer(), false, 'coloured in');
  t.srcColour = 0.01;
  t.cropRect = { x: 0, y: 0, w: 0.5, h: 0.5 };
  assert.equal(t.trimOffer(), false, 'cropped');
  t.cropRect = null;
  t.pgOrig = null;
  assert.equal(t.trimOffer(), false, 'not a photo taken now');
  // a drawing filling the page edge to edge: Auto crop would find nothing to trim, so it isn't offered
  const g = new Uint8Array(W * H).fill(245);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 80 < 3 || y % 80 < 3) g[y * W + x] = 30;
  const e = seg(g);
  e.edgeBands = { t: 0.015, b: 0, l: 0, r: 0 };
  e.pgOrig = {};
  e.srcColour = 0.01;
  assert.equal(e.trimOffer(), false, 'nothing to trim');
});
