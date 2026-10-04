// v305 (sections): a frame drawn round the picture on the same paper. On a fresh scan, the paper inside it is left
// white (as a page without a frame leaves its paper), and so is anything whose middle is outside the frame (a
// watermark's letters); Colour it brings it back. The rule (findFrame, 10-segment): the biggest section is 8% of the
// picture or more, its box spans half the width and height, each edge of its box is at least 75% that section, and
// the sections outside its box add up to 0.5% of the picture at most. Pages drawn here in code: a lone figure in a
// frame triggers it; a framed sky over a ruled horizon, a board in the middle of a drawing and art breaking out of
// its frame don't. The flag goes through merges and the Undo snapshots. (Colour it, and guides opened again: e2e/v305-frame)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

const W = 800,
  H = 1000;
// a W x H white page with ink where ink(x, y), its sections found as on a fresh scan
function page(ink) {
  const g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) g[y * W + x] = 0;
  core.srcK = 1;
  core.W = W;
  core.H = H;
  core.gray = g;
  core.bgTrim = 50;
  core.minPos = 20;
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
// a frame 60 px in from the page's edges, 4 px thick
const frame = (x, y) => {
  const e = Math.min(x, y, W - 1 - x, H - 1 - y);
  return e >= 60 && e < 64;
};
const any =
  (...fs) =>
  (x, y) =>
    fs.some((f) => f(x, y));
const big = () => {
  let b = 0;
  for (let l = 1; l < core.comps.length; l++) {
    const c = core.comps[l];
    if (c && !c.merged && (!b || c.area > core.comps[b].area) && !c.bpx) b = l;
  }
  return b;
};
const framed = () => core.comps.findIndex((c) => c && !c.merged && c.framed);
// a lone figure: a flower of rings and a cross in the middle; a watermark's "O" below the frame
const figure = any(
  ring(400, 480, 200),
  ring(400, 480, 120),
  (x, y) => (Math.abs(x - 400) < 2 || Math.abs(y - 480) < 2) && Math.hypot(x - 400, y - 480) < 200,
);
const watermark = ring(700, 970, 18);

test('a lone figure in a frame: the paper inside is left white, and the watermark outside it; the figure is all there', () => {
  const cl = page(any(frame, figure, watermark));
  const p = big(),
    c = core.comps[p];
  assert.ok(c.area > 0.25 * W * H, 'the paper inside the frame is the biggest: ' + c.area);
  assert.equal(c.framed, true, 'found as a frame');
  assert.equal(c.bg, true);
  assert.ok(!cl.includes(p), 'left white');
  assert.equal(core.frameLeft(), p, 'the line to Colour it shows');
  // the watermark's "O" (its middle below the frame) is left white too
  const wm = core.labels[970 * W + 700];
  assert.ok(wm > 0 && core.comps[wm].bg && !cl.includes(wm), 'the watermark');
  // the figure's eight pieces are sections
  assert.equal(cl.length, 8, cl.length + ' sections');
  // saved as left out (so a guide opened again has it white too)
  core.assignData = { assign: {}, order: [], N: 0 };
  const ss = core.currentDesignObj(false, true).payload.secStates;
  assert.equal(ss[p], 2);
  assert.equal(ss[wm], 2);
  core.assignData = null;
});

test('not a frame: a framed sky over a ruled horizon, a board in the middle of a drawing, art breaking out of the frame', () => {
  // the sky (the biggest) spans the frame, but the ground below the horizon is outside its box
  page(
    any(
      frame,
      (x, y) => Math.abs(y - 600) < 2 && x > 60 && x < W - 60,
      ring(600, 220, 60),
      box(150, 700, 350, 880),
    ),
  );
  assert.equal(framed(), -1, 'sky over a horizon');
  // a big board with a drawing round it (no frame): the drawing is outside the board's box
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
  const b = big();
  assert.ok(core.comps[b].area > 0.08 * W * H, 'the board is big enough');
  assert.equal(framed(), -1, 'board in the middle');
  // a frame with a figure that breaks out of it on the left
  page(any(frame, figure, box(20, 300, 300, 700)));
  assert.equal(framed(), -1, 'art breaking out of the frame');
  // and plain paper with no frame: as before
  page(figure);
  assert.equal(framed(), -1);
  // (the same figure in a frame does count)
  page(any(frame, figure));
  assert.ok(framed() > 0);
});

test('the frame’s paper keeps its flag through a merge and the Undo snapshots', () => {
  const cl = page(any(frame, figure));
  const p = framed(),
    q = cl[0];
  // merged into another section: that one is the paper now
  core.mergeCellsSnap(q, p);
  assert.equal(core.comps[q].framed, true);
  core.restoreSnap();
  assert.equal(core.comps[p].framed, true, 'the Undo snapshot keeps it');
  assert.equal(core.comps[q].framed, undefined);
  core.applyBg();
  assert.equal(core.comps[p].bg, true, 'still white after the background is worked out again');
});
