// v308 (output): the photo's debris left out of what's printed and saved (outDebris), on synthetic pictures: the black
// band of a table along an edge, the next page's dashed edge and specks go; the drawing's own lines, open strokes that
// touch it and decorations away from the edges stay, and a clean drawing loses nothing. Save image's least code size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a W x H picture: ink (-1) where ink(x, y), else section 1 (left) / 2 (right) inside the drawing's box, else
// background (3, not coloured)
function picture(W, H, ink, box) {
  const L = new Int32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const inBox = x > box[0] && x < box[2] && y > box[1] && y < box[3];
      L[y * W + x] = ink(x, y) ? -1 : inBox ? (x < (box[0] + box[2]) / 2 ? 1 : 2) : 3;
    }
  return L;
}
function load(t, W, H, L) {
  t.W = W;
  t.H = H;
  t.labels = L;
  t.comps = [
    null,
    { area: 1000, cx: 0, cy: 0 },
    { area: 1000, cx: 0, cy: 0 },
    { area: 1000, cx: 0, cy: 0, bg: true },
  ];
  const m = { mkey: 'Ohuhu:R46', hex: '#d98b8b', code: 'R46', brand: 'Ohuhu' };
  t.assignData = { assign: { 1: m, 2: m }, order: [1, 2], N: 2 };
  t.outDebrisReset();
}
// the drawing: a box (60..140 each way) with 4 px lines round it and down its middle
const BOX = [64, 64, 136, 136];
const drawing = (x, y) =>
  (x >= 60 && x <= 140 && y >= 60 && y <= 140 && (x < 64 || x > 136 || y < 64 || y > 136)) ||
  (x >= 98 && x <= 101 && y >= 60 && y <= 140);

test('a clean drawing loses nothing to the debris clean-up', () => {
  const app = createApp(),
    t = app.__mstest;
  // an open stroke touching it, and a ring away from the edges, outside the drawing's box
  const ring = (x, y) => {
    const d = Math.hypot(x - 35, y - 35);
    return d > 8 && d < 12;
  };
  load(
    t,
    200,
    200,
    picture(
      200,
      200,
      (x, y) => drawing(x, y) || (y >= 99 && y <= 102 && x > 140 && x < 185) || ring(x, y),
      BOX,
    ),
  );
  assert.ok(t.outDebris() === null, 'nothing left out');
});

test('the band along an edge, a dashed page edge and specks are left out; the drawing and what touches it stay', () => {
  const app = createApp(),
    t = app.__mstest,
    W = 200,
    H = 200;
  const band = (x, y) => y < 22 && x > 10 && x < 190,
    // (the drawing's middle line runs up into the band, as the lines of Ben's page run into the table's shadow)
    up = (x, y) => x >= 98 && x <= 101 && y < 60,
    dash = (x, y) => x >= 194 && x <= 196 && y % 10 < 5 && y > 30 && y < 180,
    speck = (x, y) => x >= 20 && x <= 21 && y >= 170 && y <= 171,
    stroke = (x, y) => y >= 99 && y <= 102 && x > 140 && x < 185;
  const L = picture(
    W,
    H,
    (x, y) => drawing(x, y) || band(x, y) || up(x, y) || dash(x, y) || speck(x, y) || stroke(x, y),
    BOX,
  );
  load(t, W, H, L);
  const m = t.outDebris();
  assert.ok(m !== null && m !== undefined, 'something to leave out');
  const at = (x, y) => m[y * W + x];
  assert.equal(at(195, 50), 1, 'the dashed edge');
  assert.equal(at(20, 170), 1, 'a speck');
  assert.equal(at(50, 5), 1, 'the band, away from the drawing');
  assert.equal(at(150, 10), 1);
  // the drawing's lines, the line up to the band and the stroke touching it: all kept
  for (const [x, y] of [
    [62, 100],
    [100, 100],
    [138, 62],
    [100, 40],
    [100, 25],
    [170, 100],
  ])
    assert.equal(at(x, y), 0, `kept: ${x},${y}`);
  // nothing that isn't ink is ever marked
  for (let p = 0; p < W * H; p++) if (m[p]) assert.equal(L[p], -1);
});

test('a thick frame drawn round the page stays (a band along three or four edges is the drawing’s, not a table’s)', () => {
  const app = createApp(),
    t = app.__mstest,
    W = 200,
    H = 200;
  const frame = (x, y) => x < 20 || y < 20 || x >= 180 || y >= 180;
  load(
    t,
    W,
    H,
    picture(W, H, (x, y) => drawing(x, y) || frame(x, y), BOX),
  );
  assert.ok(t.outDebris() === null, 'nothing left out');
});

test('Save image: codes no smaller than 10 px on the image as saved, more on a wide one', () => {
  const app = createApp(),
    t = app.__mstest;
  t.W = 600;
  assert.equal(t.exportMinPx(1), 10);
  t.W = 2400;
  assert.equal(t.exportMinPx(1), 15);
  assert.equal(t.exportMinPx(0.5), 10);
});
