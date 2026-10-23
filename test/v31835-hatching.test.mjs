// v318.35: hatching as one section (hatchMerge, 10-segment; Fable E1-2, plan Stage 4.3). The slivers between close
// parallel shading lines, and the cells of cross-hatching, merge into one section with their lines kept as drawn;
// a striped motif with wide stripes keeps its stripes, and a ladder of five rungs (under the group of six) keeps
// its five, and a photo kept as photographed (scale unknown) keeps every sliver. Treat hatching as one section is on by default, saved with the guide only when off, and turning it off
// leaves every sliver as it was; the "hatched" warning is softer once patches were merged and names the switch when
// it's off. Fails on v318.34 (no hatchMerge, no hatchOne).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const W = 800,
  H = 1040;
// a blank page (grey 245) with a 3 px frame 120 px in from the edge; draw(g) adds ink (30)
function page(draw) {
  const g = new Uint8Array(W * H).fill(245);
  for (let y = 120; y < H - 120; y++)
    for (let x = 120; x < W - 120; x++)
      if (x < 123 || y < 123 || x >= W - 123 || y >= H - 123) g[y * W + x] = 30;
  if (draw) draw(g);
  return g;
}
const px = (g, x, y) => {
  if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = 30;
};
// a box of lines t px thick; hatch: horizontal lines every `every` px inside; cross: vertical ones too
function box(g, x0, y0, w, h, every, cross, t) {
  t = t || 2;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const edge = x < x0 + t || y < y0 + t || x >= x0 + w - t || y >= y0 + h - t;
      const hy = every && (y - y0) % every < t,
        hx = cross && every && (x - x0) % every < t;
      if (edge || hy || hx) px(g, x, y);
    }
}
function seg(g, o) {
  o = o || {};
  const app = createApp(),
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  if (o.hatchOne === false) t.hatchOne = false;
  if (o.kept) t.pgHint = 'kept';
  // (v318.37: a camera photo, its lens known: only that kind of kept picture waits for straightening, X1-2)
  if (o.f35) t.pgF35 = o.f35;
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.srcDims = { w: W, h: H };
  t.minPos = t.minPosAuto();
  t.segment();
  return t;
}
// the sections (not background, not merged away) whose box lies inside x0,y0,w,h
const inside = (t, x0, y0, w, h) => {
  const a = [];
  for (let l = 1; l < t.comps.length; l++) {
    const c = t.comps[l];
    if (!c || c.bg || c.merged) continue;
    if (c.x0 >= x0 && c.y0 >= y0 && c.x1 < x0 + w && c.y1 < y0 + h) a.push(l);
  }
  return a;
};
const inkIn = (t, x0, y0, w, h) => {
  let k = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (t.labels[y * W + x] === -1) k++;
  return k;
};

test('parallel lines in a box (4 px gaps, about 1 mm): one section, its lines kept as drawn', () => {
  const g = page((g) => box(g, 300, 300, 200, 200, 6));
  const t = seg(g);
  const ls = inside(t, 300, 300, 200, 200);
  assert.equal(ls.length, 1, 'sections in the hatched box: ' + ls.length);
  const c = t.comps[ls[0]];
  assert.ok(c.hatch >= 30, 'slivers merged in: ' + c.hatch);
  // (every sliver's pixels now carry the one label; the lines stay ink)
  assert.equal(
    c.area + inkIn(t, 300, 300, 200, 200),
    200 * 200,
    'all the paper in the box, and the lines still ink',
  );
  assert.equal(t.hatchMade, 1);
  // the sliver merged away says where it went
  let gone = 0;
  for (let l = 1; l < t.comps.length; l++) if (t.comps[l].hatched) gone++;
  assert.equal(gone, c.hatch - 1);
  assert.equal(t.comps[ls[0]].hatch, gone + 1);
  // the same page without the merge: every sliver its own section
  const t0 = seg(
    page((g) => box(g, 300, 300, 200, 200, 6)),
    { hatchOne: false },
  );
  assert.equal(inside(t0, 300, 300, 200, 200).length, c.hatch);
  assert.equal(t0.hatchMade, 0);
});

// (v318.37: a camera photo, pgF35; a lens-less picture kept as is on the unsure outline merges as a scan does, X1-2)
test('a photo kept as photographed (its scale on the page unknown) keeps its slivers', () => {
  const t = seg(
    page((g) => box(g, 300, 300, 200, 200, 6)),
    { kept: true, f35: 26 },
  );
  assert.ok(inside(t, 300, 300, 200, 200).length >= 30);
  assert.equal(t.hatchMade, 0);
  const s = seg(
    page((g) => box(g, 300, 300, 200, 200, 6)),
    { kept: true },
  );
  assert.equal(s.hatchMade, 1, 'kept as is without a lens: merged');
});

test('a striped motif with wide stripes (12 px, about 3 mm) keeps its stripes', () => {
  const t = seg(page((g) => box(g, 300, 300, 200, 198, 14)));
  const ls = inside(t, 300, 300, 200, 198);
  assert.equal(ls.length, 14, 'stripes: ' + ls.length);
  assert.equal(t.hatchMade, 0);
});

test('cross-hatching (5 px cells): one section (its four corner cells, with cells on two sides only, stay)', () => {
  const t = seg(page((g) => box(g, 300, 300, 198, 198, 7, true)));
  const ls = inside(t, 300, 300, 198, 198).filter((l) => t.comps[l].area > 25);
  assert.equal(ls.length, 1, 'sections in the cross-hatched box: ' + ls.length);
  assert.equal(t.comps[ls[0]].hatch, 28 * 28 - 4, 'cells merged in: ' + t.comps[ls[0]].hatch);
  assert.equal(t.hatchMade, 1);
});

test('a ladder of five rungs keeps its five (a group needs six)', () => {
  const t = seg(page((g) => box(g, 300, 300, 120, 32, 6)));
  const ls = inside(t, 300, 300, 120, 32);
  assert.equal(ls.length, 5, 'rungs: ' + ls.length);
  assert.equal(t.hatchMade, 0);
  // six rungs: hatching
  const t6 = seg(page((g) => box(g, 300, 300, 120, 38, 6)));
  assert.equal(inside(t6, 300, 300, 120, 38).length, 1);
});

test('a hatched patch beside a plain one across a thicker line: the plain one is not taken in', () => {
  // the hatched box's own outline is the 2 px lines are; the big plain box beside it shares a 4 px side
  const t = seg(
    page((g) => {
      box(g, 300, 300, 200, 200, 6);
      box(g, 498, 300, 150, 200, 0, false, 4);
    }),
  );
  assert.equal(inside(t, 300, 300, 200, 200).length, 1);
  assert.equal(inside(t, 498, 300, 150, 200).length, 1, 'the plain box is a section of its own');
  assert.equal(t.hatchMade, 1);
});

test('the "hatched" warning: softer once patches were merged, names the switch when it is off', () => {
  // a page of 10 narrow hatched boxes (2 px gaps): 390 slivers, each under 3 x Min section size
  const draw = (g) => {
    for (let i = 0; i < 10; i++) box(g, 140 + i * 50, 300, 14, 160, 4);
  };
  const t0 = seg(page(draw), { hatchOne: false });
  assert.equal(t0.segWarn.code, 'hatched', JSON.stringify(t0.segWarn));
  assert.match(t0.segWarn.tip, /Treat hatching as one section/);
  const t = seg(page(draw));
  assert.equal(t.hatchMade, 10);
  assert.ok(t.segWarn.ok, 'merged: no warning: ' + JSON.stringify(t.segWarn));
  // the switch on, and still lots of slivers (a page of 60 five-rung ladders): the warning stays, worded as before
  const t1 = seg(
    page((g) => {
      for (let i = 0; i < 60; i++) box(g, 140 + (i % 10) * 50, 140 + ((i / 10) | 0) * 60, 14, 24, 4);
    }),
  );
  assert.equal(t1.segWarn.code, 'hatched');
  assert.equal(t1.hatchMade, 0);
  assert.doesNotMatch(t1.segWarn.tip, /Treat hatching/);
});

test('Treat hatching as one section: on to begin with, saved only when off, opens as saved', () => {
  const core = createApp().__mstest;
  assert.equal(core.styleVars.hatchOne, true);
  const f = [...core.styleFields].find((x) => x.key === 'hatchOne');
  assert.ok(f, 'a style field');
  assert.deepEqual([f.in, f.def, f.undo], ['payload', true, false]);
  assert.equal(f.save(), undefined, 'on: not written, so a guide saves exactly as before');
  core.styleVars.hatchOne = false;
  assert.equal(f.save(), false);
  assert.equal(f.check(false, true), false);
  assert.equal(f.check(undefined, true), true, 'a guide saved before: on');
  assert.equal(f.check('no', true), true);
});
