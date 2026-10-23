// (v318.37) The sections' fixes after the X1 review: coloured outlines kept by the chroma ink rule (X1-1), the hatch
// switch after Keep as is on a lens-less picture (X1-2), Undo's byte budget counting the colour (X1-3), the warning
// judged after Undo put the hatching state back (X1-4), a cross-hatched page called hatched rather than noisy (X1-5)
// and hatchMade reset for a new picture (X1-6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const W = 800,
  H = 1000;
// an RGBA page: white paper, a grid of 3 px outlines in `line` (30 cells), `band`: a 20 px black title band (2% of
// the pixels), `fills`: three cells filled with a dark blue marker
function rgba(line, band, fills) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = [250, 250, 250];
      const inDraw = x >= 100 && x < 700 && y >= 100 && y < 820;
      if (inDraw && ((x - 100) % 120 < 3 || (y - 100) % 120 < 3 || x >= 697 || y >= 817)) c = line;
      else if (fills && inDraw && y < 220 && x < 460) c = [20, 60, 150];
      if (band && y >= 900 && y < 920 && x >= 100 && x < 700) c = [0, 0, 0];
      const j = (y * W + x) * 4;
      d[j] = c[0];
      d[j + 1] = c[1];
      d[j + 2] = c[2];
      d[j + 3] = 255;
    }
  return d;
}
function seg(d, enhance) {
  const app = createApp(),
    t = app.__mstest,
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
const LINES = { red: [220, 30, 30], blue: [40, 60, 200], green: [30, 150, 40] };
for (const band of [false, true])
  for (const enh of [true, false])
    test('X1-1: coloured outlines keep their sections (black band ' + band + ', Enhance ' + enh + ')', () => {
      const base = counted(seg(rgba([0, 0, 0], band), enh));
      assert.ok(base >= 28, 'black lines: ' + base);
      for (const nm in LINES) {
        const t = seg(rgba(LINES[nm], band), enh),
          n = counted(t);
        assert.ok(n >= base - 2, nm + ' lines: ' + n + ' sections of ' + base);
        // (v319: the picture keeps its colour, the cut being per patch now, inkColourCut; its lines are ink, so no
        // section is coloured and there's no colour offer. Until then the colour was dropped for a coloured-line page)
        assert.ok(t.chroma, nm + ': colour kept');
        assert.equal(t.colourSecs().length, 0, nm + ': nothing offered');
      }
    });
test('X1-1: a black-lined page with dark fills still keeps the filled sections (v318.35), and its colour', () => {
  for (const enh of [true, false]) {
    const t = seg(rgba([0, 0, 0], false, true), enh);
    assert.equal(counted(t), 30, 'Enhance ' + enh);
    assert.ok(t.chroma, 'chroma kept');
    assert.equal(t.colourSecs().length, 3);
  }
});

// a cross-hatched box every 5 px (1 px lines) on the left, cells of pitch q on the right
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
function hatched(o) {
  const t = createApp().__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  t.srcK = 1;
  t.W = HW;
  t.H = HH;
  t.gray = hatchPage(o.q || 100);
  t.srcDims = { w: HW, h: HH };
  t.minPos = t.minPosAuto();
  if (o.hatchOne != null) t.hatchOne = o.hatchOne;
  if (o.kept) t.pgHint = 'kept';
  if (o.f35) t.pgF35 = o.f35;
  t.segment();
  return t;
}
test('X1-2: after Keep as is on a lens-less picture the hatching still merges; a camera photo waits, and says so', () => {
  const scan = hatched({ hatchOne: true, kept: true });
  assert.ok(scan.hatchMade > 0, 'scan kept as is: merged ' + scan.hatchMade);
  assert.equal(scan.hatchUnsure(), false);
  assert.match(scan.hatchNoteText(), /Found 1 hatched patch/);
  const photo = hatched({ hatchOne: true, kept: true, f35: 26 });
  assert.equal(photo.hatchMade, 0);
  assert.equal(photo.hatchUnsure(), true);
  assert.match(photo.hatchNoteText(), /Not until the page is straightened/);
  assert.doesNotMatch(photo.hatchNoteText(), /Found/);
});
test('X1-3: a geo step counts its colour in the Undo budget', () => {
  const t = createApp().__mstest,
    gray = new Uint8Array(1000),
    chroma = new Uint8Array(1000),
    s = { t: 'seg', keep: { geo: { gray: gray, chroma: chroma } } };
  assert.equal(t.snapBytes(s), 2000);
  assert.equal(t.snapBytes({ t: 'seg', keep: { geo: { gray: gray, chroma: null } } }), 1000);
});
test('X1-4: after Undo of switching hatching on, the warning is the one from before', () => {
  const t = hatched({ hatchOne: false, q: 7 });
  const w0 = t.segWarn;
  assert.equal(w0 && w0.code, 'hatched');
  assert.match(w0.msg, /^Lots of slivers/);
  // (as the switch does: the settings kept for Undo first, hatchWire)
  t.reFrom();
  t.hatchOne = true;
  t.segSync = true;
  try {
    assert.equal(t.resegment(), true);
  } finally {
    t.segSync = false;
  }
  assert.ok(t.hatchMade > 0);
  assert.match(t.segWarn.msg, /^Still lots of slivers/);
  t.doUndoSeg();
  assert.equal(t.hatchOne, false);
  assert.equal(t.hatchMade, 0);
  assert.equal(t.segWarn.msg, w0.msg);
  assert.equal(t.segWarn.tip, w0.tip);
});
test('X1-5: a cross-hatched page with the switch off is called hatched, naming the switch, not noisy', () => {
  const t = hatched({ hatchOne: false });
  assert.equal(t.segWarn && t.segWarn.code, 'hatched');
  assert.match(t.segWarn.tip, /Treat hatching as one section/);
  // (the sections untouched by the dry run)
  assert.equal(t.hatchMade, 0);
  assert.ok(counted(t) > 5000, 'still unmerged: ' + counted(t));
  const on = hatched({ hatchOne: true });
  assert.equal(on.hatchMade, 1);
  assert.ok(!on.segWarn || on.segWarn.ok, 'merged: no warning');
});
test('X1-6: hatchMade is reset for a new picture', () => {
  const t = hatched({ hatchOne: true });
  assert.equal(t.hatchMade, 1);
  t.assign.resetForNewPicture();
  assert.equal(t.hatchMade, 0);
});
