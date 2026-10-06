// v308 (getting a picture in): the warnings for a hatched page and a page coloured in already; a frame with corner
// ornaments; Auto crop to the largest ruled rectangle; "Ignore faint grey marks", offered only when the ink splits
// clearly into dark outlines and pale marks; and the paper's tint, used to find a page under a warm lamp. Pages are
// drawn here in code. (A tilt's corners, Straighten's corners, Merge and the browser side: e2e/v308-intake)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

const W = 800,
  H = 1000;
// a W x H white page, grey g(x, y) where it's drawn (0 black, 255 paper), its sections found as on a fresh picture
function page(ink, opts = {}) {
  const g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = ink(x, y);
      if (v !== false && v != null) g[y * W + x] = v === true ? 0 : v;
    }
  core.srcK = 1;
  core.W = W;
  core.H = H;
  core.gray = g;
  core.bgTrim = 50;
  core.minPos = 20;
  core.enhance = true;
  core.adaptC = 9;
  core.faintCut = opts.faintCut || 0;
  core.srcColour = null;
  core.assign.sfmode = 'review';
  core.assignData = null;
  core.segment();
  return core.countedList();
}
const ring =
  (cx, cy, r, w = 2) =>
  (x, y) =>
    Math.abs(Math.hypot(x - cx, y - cy) - r) < w;
const box =
  (x0, y0, x1, y1, w = 2) =>
  (x, y) =>
    x >= x0 - w &&
    x <= x1 + w &&
    y >= y0 - w &&
    y <= y1 + w &&
    (Math.abs(x - x0) <= w || Math.abs(x - x1) <= w || Math.abs(y - y0) <= w || Math.abs(y - y1) <= w);
const any =
  (...fs) =>
  (x, y) => {
    for (const f of fs) {
      const v = f(x, y);
      if (v !== false && v != null) return v;
    }
    return false;
  };
const grey = (v, f) => (x, y) => (f(x, y) ? v : false);
// a frame line `e0` to `e0 + 4` px in from the page's edges
const frameAt = (e0) => (x, y) => {
  const e = Math.min(x, y, W - 1 - x, H - 1 - y);
  return e >= e0 && e < e0 + 4;
};
const figure = any(
  ring(400, 480, 200),
  ring(400, 480, 120),
  (x, y) => (Math.abs(x - 400) < 2 || Math.abs(y - 480) < 2) && Math.hypot(x - 400, y - 480) < 200,
);
// a double frame (lines 40 and 60 px in) with a circle at each corner, cutting the strip between the lines in four
const corners = any(
  ring(52, 52, 22, 2),
  ring(W - 53, 52, 22, 2),
  ring(52, H - 53, 22, 2),
  ring(W - 53, H - 53, 22, 2),
);
const framed = () => core.comps.findIndex((c) => c && !c.merged && c.framed);

// ---- frames with corner ornaments ----
test('a double frame with corner circles is found: the strips between its lines and the circles are the frame’s own', () => {
  const cl = page(any(frameAt(40), frameAt(60), corners, figure));
  const p = framed();
  assert.ok(p > 0, 'found as a frame');
  assert.ok(core.comps[p].area > 0.4 * W * H, 'the paper inside the inner line');
  assert.ok(!cl.includes(p), 'left white');
  // and a double frame without the circles, a single frame with them: found, as before
  page(any(frameAt(40), frameAt(60), figure));
  assert.ok(framed() > 0, 'double frame');
  page(any(frameAt(60), corners, figure));
  assert.ok(framed() > 0, 'single frame with corner circles');
});

test('still not a frame: art breaking out of it, or a board in the middle of a drawing', () => {
  page(any(frameAt(60), figure, box(20, 300, 300, 700)));
  assert.equal(framed(), -1, 'art breaking out on the left');
  page(
    any(
      box(200, 200, 600, 800),
      ring(100, 100, 60),
      ring(700, 120, 60),
      ring(100, 900, 60),
      ring(700, 900, 60),
      (x, y) => Math.abs(x - 400) < 2 && y > 200 && y < 800,
    ),
  );
  assert.equal(framed(), -1, 'board in the middle');
});

// ---- Auto crop ----
// a screenshot: a grey browser bar with "text" across the top, the page's own frame, tab dots at the bottom
const bar = (x, y) => (y < 70 ? (y > 25 && y < 45 && x % 40 < 14 && x > 30 && x < 500 ? 0 : 200) : false);
const dots = any(
  ring(250, 960, 8, 3),
  ring(325, 960, 8, 3),
  ring(400, 960, 8, 3),
  ring(475, 960, 8, 3),
  ring(550, 960, 8, 3),
);
test('Auto crop: to the inside of the page’s own frame, padded 3%, in a screenshot with the browser round it', () => {
  page(any(bar, dots, box(100, 120, 700, 900, 2), figure));
  const b = core.autoCropBox();
  assert.ok(b && b.ruled, 'the ruled rectangle');
  // (the paper inside the frame, 103..697 x 123..897, and 3% of the picture round it)
  assert.ok(Math.abs(b.x0 - (103 - 24)) <= 2 && Math.abs(b.x1 - (697 + 24)) <= 2, `x ${b.x0}..${b.x1}`);
  assert.ok(Math.abs(b.y0 - (123 - 30)) <= 2 && Math.abs(b.y1 - (897 + 30)) <= 2, `y ${b.y0}..${b.y1}`);
});

test('Auto crop: a board in the middle of a drawing isn’t taken for the page; a page with ink to its edges has nothing to trim', () => {
  page(
    any(
      box(200, 200, 600, 800),
      ring(100, 100, 60),
      ring(700, 120, 60),
      ring(100, 900, 60),
      ring(700, 900, 60),
      (x, y) => Math.abs(x - 400) < 2 && y > 200 && y < 800,
    ),
  );
  const b = core.autoCropBox();
  assert.equal(b.ruled, false, 'where the ink is, as before');
  assert.ok(b.x0 < 50 && b.x1 > 750, 'the corner circles are kept');
  // ink right to the edges
  page(any(box(8, 8, W - 9, H - 9, 2), figure));
  const c = core.autoCropBox();
  assert.ok(c.x1 - c.x0 >= 0.97 * W && c.y1 - c.y0 >= 0.97 * H, 'nothing to trim');
});

// ---- faint grey marks ----
// pale grey (210) rings, as a watermark's letters, on the paper round the figure
const pale = any(
  grey(210, ring(650, 150, 40, 4)),
  grey(210, ring(150, 150, 40, 4)),
  grey(210, ring(650, 850, 40, 4)),
);
test('Ignore faint grey marks: offered on a clear split, and ticked, the pale marks are paper and the figure is whole', () => {
  const before = page(any(figure, pale));
  const T = core.faintOffer;
  assert.ok(T >= 160 && T <= 210, 'offered: ' + T);
  // the pale rings are outlines as they are: each ring's inside is a section
  const inside = () => core.labels[150 * W + 650];
  assert.ok(core.comps[inside()].area < 6000, 'a pale ring’s inside is a section of its own');
  const after = page(any(figure, pale), { faintCut: T });
  assert.equal(
    core.labels[150 * W + 720],
    core.labels[150 * W + 650],
    'the pale ring is gone: paper through it',
  );
  assert.equal(after.length, 8, 'the figure’s eight pieces: ' + after.length);
  assert.ok(before.length > after.length);
});

test('Ignore faint grey marks: not offered for clean line art, nor for a page drawn all in mid-grey', () => {
  page(figure);
  assert.equal(core.faintOffer, 0, 'clean line art');
  // the outlines mid-grey (120) and pale marks beside them: no dark outlines to keep
  page(any(grey(120, figure), pale));
  assert.equal(core.faintOffer, 0, 'mid-grey outlines');
  // pale marks a sliver of the ink: not a clear split
  page(any(figure, grey(210, ring(650, 150, 10, 1))));
  assert.equal(core.faintOffer, 0, 'too few pale marks');
});

// ---- hatched and coloured pages ----
// a made-up set of sections: `small` under 3x Min section size (10 px here), `big` over it, `specks` under it
function sections(small, big, specks) {
  const px = 1000000,
    L = new Int32Array(px).fill(1);
  for (let i = 0; i < 100000; i++) L[i] = -1;
  core.srcK = 1;
  core.minPos = 30;
  core.W = px;
  core.H = 1;
  core.labels = L;
  const comps = [null];
  for (let i = 0; i < small; i++) comps.push({ area: 25, merged: false });
  for (let i = 0; i < big; i++) comps.push({ area: 2000, merged: false });
  for (let i = 0; i < specks; i++) comps.push({ area: 4, merged: false });
  core.comps = comps;
}
test('a hatched page: 200 sections or more, over half of them under 3x Min section size', () => {
  core.srcColour = null;
  sections(720, 280, 0);
  assert.equal(core.segQuality().code, 'hatched', 'a hatched page, 72% slivers');
  sections(290, 710, 0);
  assert.equal(core.segQuality().ok, true, 'the most of any real page, 29%');
  sections(120, 60, 0);
  assert.equal(core.segQuality().ok, true, 'under 200 sections');
});

test('a page coloured in already: much of it coloured and broken into specks; checked only with the picture', () => {
  sections(10, 40, 1250);
  core.srcColour = 0.33;
  assert.equal(core.segQuality().code, 'coloured');
  core.srcColour = 0.004;
  assert.equal(core.segQuality().ok, true, 'a line-art page');
  core.srcColour = null;
  assert.equal(core.segQuality().ok, true, 'a guide opened again without its picture');
  core.srcColour = 0.33;
  sections(10, 400, 900);
  assert.equal(core.segQuality().ok, true, 'colour that isn’t specks');
  core.srcColour = null;
});

// ---- the paper's tint ----
// RGBA pixels: paper in colour p, with a share `ink` black and a share `col` magenta
function px(p, ink = 0.1, col = 0) {
  const n = 40000,
    d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const c = i % 100 < ink * 100 ? [20, 20, 20] : i % 100 < (ink + col) * 100 ? [220, 40, 200] : p;
    d.set([c[0], c[1], c[2], 255], i * 4);
  }
  return { d, n };
}
test('the paper’s tint: gains that make warm paper white, each at most x2; none for white paper', () => {
  const w = px([242, 209, 145]),
    g = core.paperGains(w.d, w.n, 1);
  assert.ok(g, 'warm paper');
  assert.ok(Math.abs(g[0] - 1) < 1e-6, 'red is the brightest');
  assert.ok(Math.abs(209 * g[1] - 242) < 1 && Math.abs(145 * g[2] - 242) < 1, g.join());
  const deep = core.paperGains(px([240, 150, 90]).d, 40000, 1);
  assert.equal(deep[2], 2, 'capped at x2');
  assert.equal(core.paperGains(px([246, 244, 240]).d, 40000, 1), null, 'near enough white');
});

test('how coloured a page is, the paper’s tint taken out: a warm line-art page is not; a coloured-in one is', () => {
  const warm = px([242, 209, 145]);
  assert.ok(core.colourShare(warm.d, warm.n) < 0.01, 'warm paper, black lines');
  const col = px([246, 244, 240], 0.1, 0.33);
  assert.ok(core.colourShare(col.d, col.n) > 0.3, 'a third coloured');
});
