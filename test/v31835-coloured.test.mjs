// v318.35: a page partly coloured in (Fable E1-3). Ink is dark AND colourless: on a page with colour on it, a pixel
// clearly coloured (chroma over COLOUR_CHROMA once the paper's tint is taken out) is paper to the ink unless it's as
// dark as a line, so a section filled with a mid or dark marker stays a section instead of reading as ink and
// vanishing. chromaOf gives null for a greyscale page (and for one under COLOUR_PAGE coloured), so those pages'
// sections are found exactly as before. colourSecs lists the sections coloured in, for the offer to mark them done
// (never automatic: `colored` stays zero after segment). Fails on v318.34 (no chromaOf; the filled cells vanish).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const W = 800,
  H = 1040,
  M = 120;
// a page with a 120 px blank margin round a grid of 80 px cells (lines grey 30), in RGBA; fills: [[col, row, rgb]]
// colours a cell (bleeding 1 px over its lines, as a marker does)
function page(fills) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 245;
    d[i * 4 + 3] = 255;
  }
  const put = (x, y, rgb) => {
    const j = (y * W + x) * 4;
    d[j] = rgb[0];
    d[j + 1] = rgb[1];
    d[j + 2] = rgb[2];
  };
  (fills || []).forEach(([cx, cy, rgb]) => {
    const x0 = M + cx * 80 + 2,
      y0 = M + cy * 80 + 2;
    for (let y = y0; y < y0 + 79; y++) for (let x = x0; x < x0 + 79; x++) put(x, y, rgb);
  });
  for (let y = M; y < H - M; y++)
    for (let x = M; x < W - M; x++)
      if ((x - M) % 80 < 3 || (y - M) % 80 < 3 || x >= W - M - 3 || y >= H - M - 3) put(x, y, [30, 30, 30]);
  return d;
}
function seg(d, o) {
  o = o || {};
  const app = createApp(),
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  const n = W * H,
    g = new Uint8Array(n);
  for (let i = 0; i < n; i++) g[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
  const colour = t.colourShare(d, n);
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.srcColour = colour;
  t.chroma = o.noChroma ? null : t.chromaOf(d, n, colour);
  t.srcDims = { w: W, h: H };
  t.minPos = t.minPosAuto();
  t.segment();
  return t;
}
const cellAt = (t, cx, cy) => {
  const l = t.labels[(M + cy * 80 + 40) * W + M + cx * 80 + 40];
  return l < 1 ? 'ink' : t.comps[l].bg ? 'paper' : 'section';
};
const cellLabel = (t, cx, cy) => t.labels[(M + cy * 80 + 40) * W + M + cx * 80 + 40];
const cellArea = (t, cx, cy) => {
  const l = cellLabel(t, cx, cy);
  return l > 0 ? t.comps[l].area : 0;
};
const counted = (t) => t.countedList().length;

// marker fills: a mid blue, a red, a green; a dark navy (as dark as a line)
const BLUE = [116, 168, 232],
  RED = [232, 96, 96],
  GREEN = [112, 192, 142],
  NAVY = [30, 36, 70];
const FILLS = [
  [1, 1, BLUE],
  [3, 2, RED],
  [5, 7, GREEN],
  [2, 5, BLUE],
];

test('sections filled with a mid marker stay sections, the same count as the plain page; on the grey alone they vanished', () => {
  const plain = seg(page()),
    t = seg(page(FILLS)),
    old = seg(page(FILLS), { noChroma: true });
  assert.ok(t.chroma, 'a page with colour on it has its chroma');
  assert.equal(counted(plain), 70, 'the grid: 7 x 10 cells');
  assert.equal(counted(t), counted(plain), 'the coloured page has every cell');
  const full = cellArea(plain, 0, 0);
  FILLS.forEach(([cx, cy]) => {
    assert.equal(cellAt(t, cx, cy), 'section', `cell ${cx},${cy} coloured in`);
    assert.equal(cellArea(t, cx, cy), full, `cell ${cx},${cy} whole, its fill paper`);
    // (on the grey alone the fill's rim is ink and the cell shrinks to a scrap in its middle, 400-825 px of 5,929)
    assert.ok(
      cellArea(old, cx, cy) < 0.2 * full,
      `cell ${cx},${cy} on the grey alone: ` + cellArea(old, cx, cy),
    );
  });
  // the lines round a fill still part it from its neighbours
  assert.notEqual(cellLabel(t, 1, 1), cellLabel(t, 2, 1));
  assert.notEqual(cellLabel(t, 1, 1), cellLabel(t, 1, 2));
  assert.ok(t.segWarn && t.segWarn.ok, JSON.stringify(t.segWarn));
  // offered, never marked by itself
  assert.equal([...t.colored].filter((x) => x).length, 0);
});

test('colourSecs lists the sections coloured in, by number, and nothing on a plain page', () => {
  const t = seg(page(FILLS));
  const secs = t.colourSecs();
  assert.equal(secs.length, FILLS.length, JSON.stringify(secs));
  FILLS.forEach(([cx, cy]) => assert.ok(secs.includes(cellLabel(t, cx, cy)), `cell ${cx},${cy}`));
  assert.equal(seg(page()).colourSecs().length, 0);
});

test('a greyscale page has no chroma and the same sections as before; a line pixel with colour smeared on it stays ink', () => {
  const d = page(),
    n = W * H,
    t = seg(d);
  assert.equal(t.chroma, null);
  assert.equal(t.chromaOf(d, n, 0.005), null, 'under COLOUR_PAGE: none');
  // a navy fill is barely coloured (chroma 40, under COLOUR_CHROMA): no colour read, the page as before
  const navy = seg(page([[1, 1, NAVY]]));
  assert.equal(navy.chroma, null);
  assert.equal(navy.srcColour, 0);
  // a JPEG smears a fill's colour onto the dark line beside it: the line pixel keeps its ink and the cells stay apart
  const sm = page([[1, 1, RED]]);
  for (let y = M + 80; y < M + 160; y++)
    for (let x = M + 160; x < M + 163; x++) {
      const j = (y * W + x) * 4;
      sm[j] = 90;
      sm[j + 1] = 10;
      sm[j + 2] = 10;
    }
  const ts = seg(sm);
  assert.notEqual(cellLabel(ts, 1, 1), cellLabel(ts, 2, 1), 'the smeared line still parts the cells');
  assert.equal(counted(ts), 70);
});

test('the warning for a page coloured in already says a partly coloured page works', () => {
  // (the condition itself is unchanged: many coloured specks for every section. Read off the words)
  const t = seg(page(FILLS));
  const src = String(t.segQuality);
  assert.match(src, /A partly coloured page works/);
  assert.match(src, /mark them done/);
});
