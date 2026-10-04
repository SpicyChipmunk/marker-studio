// v306 (sections): the paper inside a drawn frame is saved with the guide (payload `frame`: its section number, left
// white or brought back), so a guide opened again has its line to Colour it. It follows a merge (the section the
// paper went into) and the Undo snapshots; a page without a frame saves none. Opening, Colour it's Undo step and the
// guides saved before: e2e/v306-frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

const W = 800,
  H = 1000;
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
const frame = (x, y) => {
  const e = Math.min(x, y, W - 1 - x, H - 1 - y);
  return e >= 60 && e < 64;
};
const any =
  (...fs) =>
  (x, y) =>
    fs.some((f) => f(x, y));
const figure = any(
  ring(400, 480, 200),
  ring(400, 480, 120),
  (x, y) => (Math.abs(x - 400) < 2 || Math.abs(y - 480) < 2) && Math.hypot(x - 400, y - 480) < 200,
);
const framed = () => core.comps.findIndex((c) => c && !c.merged && c.framed);
// the guide as saved (with section edits not built, so it needn't be built here), and as shared
const saved = (share) => {
  core.assignData = { assign: {}, order: [], N: 0 };
  const d = core.currentDesignObj(share, true);
  core.assignData = null;
  return d.payload;
};

test('the paper inside a frame is saved with the guide, left white or brought back; a page without one saves none', () => {
  page(any(frame, figure));
  const p = framed();
  assert.ok(p > 0, 'the frame is found');
  assert.equal(saved().frame, p, 'left white');
  assert.equal(saved(true).frame, p, 'in a guide file to share too');
  // brought back as a section (Colour it on Edit sections): still the frame's paper
  core.secState[p] = 1;
  assert.equal(saved().frame, p, 'brought back');
  // (in its place among the rest: after upk, before the section settings)
  const k = Object.keys(saved());
  assert.equal(k[k.indexOf('upk') + 1], 'frame');
  page(figure);
  assert.equal(framed(), -1);
  assert.equal(saved().frame, undefined, 'no frame');
});

test('the saved frame follows a merge and the Undo snapshots', () => {
  const cl = page(any(frame, figure));
  const p = framed(),
    q = cl[0];
  core.mergeCellsSnap(q, p);
  assert.equal(saved().frame, q, 'the section the paper went into');
  core.restoreSnap();
  assert.equal(saved().frame, p, 'back after Undo');
});
