// (v319) The colour cut patch by patch (inkColourCut) after Fable's Y1 review: a page drawn in coloured outlines keeps
// every line beside any number of dark fills, with a black title band or not, Enhance on or off (Y1-1; v318.37's
// page-level verdict, inkLinesColoured, lost every section from the fifth fill); coloured lines 2 mm and thicker
// stay lines (Y1-2); the picture keeps its colour, so the fills are offered as done and a page of coloured outlines
// with no fills gets no offer (Y1-5); a fill scribbled in strokes with hairline gaps is one section (Y1-4); black
// lines with dark fills or coloured stipple are as v318.35 had them. And the page finder's 'kept' state cleared for
// the next picture (Y1-3), the dry hatch merge's answer kept from the detection (Y1-6). Fails on v318.37.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const W = 800,
  H = 1000,
  RED = [220, 30, 30],
  BLUE = [20, 60, 150],
  BLACK = [0, 0, 0];
// an RGBA page: white paper, a 5 x 6 grid of 120 px cells (30) in `lw` px outlines in `line`; `fills` cells (from
// the top left, along the rows, every other cell as on a chessboard: a line between two dark fills is cut with them,
// a known limit) filled with a dark blue marker; `band`: a 20 px black title band (2% of the pixels);
// `streak`: the fills in vertical strokes `streak[0]` px wide with `streak[1]` px of paper between; `dots`: a
// stipple of `dots` px dots in every cell instead
function rgba(o) {
  const d = new Uint8ClampedArray(W * H * 4),
    lw = o.lw || 3,
    line = o.line || RED;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = [250, 250, 250];
      const inDraw = x >= 100 && x < 700 && y >= 100 && y < 820,
        px = (x - 100) % 120,
        py = (y - 100) % 120,
        cx = Math.floor((x - 100) / 120),
        cy = Math.floor((y - 100) / 120),
        // the chessboard's cells in order: 0, 2, 4 on the first row, 6, 8 on the second...
        cell = (cx + cy) % 2 ? -1 : (cy * 5 + cx) >> 1;
      if (inDraw && (px < lw || py < lw || x >= 700 - lw || y >= 820 - lw)) c = line;
      else if (inDraw && o.fills && cell >= 0 && cell < o.fills) {
        if (!o.streak || x % (o.streak[0] + o.streak[1]) < o.streak[0]) c = BLUE;
      } else if (inDraw && o.dots && px % 14 < o.dots && py % 14 < o.dots && px > 6 && py > 6) c = BLUE;
      if (o.band && y >= 900 && y < 920 && x >= 100 && x < 700) c = BLACK;
      const j = (y * W + x) * 4;
      d[j] = c[0];
      d[j + 1] = c[1];
      d[j + 2] = c[2];
      d[j + 3] = 255;
    }
  return d;
}
function seg(d, enhance) {
  const t = createApp().__mstest,
    n = W * H;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  t.srcK = 1;
  t.W = W;
  t.H = H;
  const g = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
  t.gray = g;
  const share = t.colourShare(d, n);
  t.chroma = t.chromaOf(d, n, share);
  t.srcColour = share;
  t.srcDims = { w: W, h: H };
  t.minPos = t.minPosAuto();
  t.enhance = enhance;
  t.segment();
  return t;
}
function counted(t) {
  let k = 0;
  for (let l = 1; l < t.comps.length; l++) {
    const c = t.comps[l];
    if (c && !c.bg && !c.merged && c.area >= t.minPx()) k++;
  }
  return k;
}
const SETTINGS = [
  [true, false],
  [false, false],
  [true, true],
  [false, true],
];
for (const lw of [3, 8, 14])
  test(
    'Y1-1/2/5: ' +
      lw +
      ' px red outlines keep their cells beside 0-10 dark fills, and the colour for the offer',
    () => {
      for (const [enh, band] of SETTINGS)
        for (const fills of [0, 1, 3, 5, 10]) {
          const t = seg(rgba({ lw: lw, band: band, fills: fills }), enh),
            n = counted(t),
            nm = lw + ' px, Enhance ' + enh + ', band ' + band + ', ' + fills + ' fills: ';
          assert.equal(n, 30, nm + n + ' sections');
          assert.ok(!t.segWarn || t.segWarn.ok, nm + 'warned ' + (t.segWarn && t.segWarn.code));
          assert.ok(t.chroma, nm + 'colour kept');
          assert.equal(t.colourSecs().length, fills, nm + 'fills offered');
        }
    },
  );
test("Y1-1: black outlines with dark fills keep v318.35's gain, and with a coloured stipple every cell", () => {
  for (const enh of [true, false]) {
    const t = seg(rgba({ line: BLACK, fills: 3 }), enh);
    assert.equal(counted(t), 30, 'fills, Enhance ' + enh);
    assert.equal(t.colourSecs().length, 3);
    for (const dots of [2, 4])
      assert.equal(counted(seg(rgba({ line: BLACK, dots: dots }), enh)), 30, dots + ' px dots');
  }
});
test('Y1-4: a fill scribbled in strokes with hairline gaps is one section, offered as done', () => {
  for (const [sw, gap] of [
    [5, 2],
    [6, 1],
    [10, 2],
    [20, 3],
  ])
    for (const enh of [true, false]) {
      const t = seg(rgba({ line: BLACK, fills: 3, streak: [sw, gap] }), enh),
        nm = sw + ' px strokes, ' + gap + ' px gaps, Enhance ' + enh + ': ';
      assert.equal(counted(t), 30, nm + 'sections');
      assert.equal(t.colourSecs().length, 3, nm + 'offered');
    }
});

// the hatching pages of v31837-segment: a cross-hatched box every 5 px on the left, cells of pitch q on the right
const HW = 800,
  HH = 800;
function hatchPage(q) {
  const g = new Uint8Array(HW * HH).fill(245);
  for (let y = 100; y < 700; y++)
    for (let x = 100; x < 700; x++) {
      if (x < 103 || x >= 697 || y < 103 || y >= 697 || Math.abs(x - 400) < 2) g[y * HW + x] = 30;
      else if (x < 400 && ((x - 103) % 5 === 0 || (y - 103) % 5 === 0)) g[y * HW + x] = 30;
      else if (x > 400 && ((x - 400) % q < 2 || (y - 100) % q < 2)) g[y * HW + x] = 30;
    }
  return g;
}
function hatched(t) {
  t.srcK = 1;
  t.W = HW;
  t.H = HH;
  t.gray = hatchPage(100);
  t.srcDims = { w: HW, h: HH };
  t.minPos = t.minPosAuto();
  t.segment();
  return t;
}
test("Y1-3: a camera photo kept as photographed doesn't leave the next picture 'kept'", () => {
  const t = createApp().__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  // as pgBegin and pgFound leave a camera photo the finder left as it was
  t.pgF35 = 26;
  t.pgHint = 'kept';
  t.pgSteep = true;
  // the sample, or a guide saved before v318.34: resetForNewPicture and no pgBegin
  t.assign.resetForNewPicture();
  assert.equal(t.pgHint, null);
  assert.equal(t.pgF35, 0);
  assert.equal(t.pgSteep, false);
  assert.equal(t.hatchUnsure(), false);
  hatched(t);
  assert.ok(t.hatchMade > 0, 'its hatching merged: ' + t.hatchMade);
  assert.doesNotMatch(t.hatchNoteText(), /straightened/);
});
test("Y1-6: segQuality's 'hatched' answer with the switch off is the detection's dry merge, not run again", () => {
  const t = createApp().__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  t.hatchOne = false;
  hatched(t);
  assert.ok(t.hatchWould > 0, 'the dry merge counted: ' + t.hatchWould);
  assert.equal(t.hatchMade, 0);
  assert.equal(t.segQuality().code, 'hatched');
  // were the dry merge run again now, it would find nothing (a camera photo kept as photographed waits for the
  // page to be straightened, hatchUnsure) and the page would be called 'noisy'
  t.pgHint = 'kept';
  t.pgF35 = 26;
  assert.equal(t.hatchMerge(true), 0);
  assert.equal(t.segQuality().code, 'hatched');
  // a new picture starts from nothing
  t.assign.resetForNewPicture();
  assert.equal(t.hatchWould, 0);
});
