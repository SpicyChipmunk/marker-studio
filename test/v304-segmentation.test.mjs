// v304 (sections): a section picked to Merge is let go when the sections are found again; the page's margin merged into
// a section keeps it the page; table pieces left out because of the page found in a photo are saved as left out, worked
// out when saving (so an Undo can't lose them); a Split or Add stroke cuts the section it runs through furthest, so one
// begun on the outline works; a very dense page has its specks saved as part of the lines, so the guide can be opened
// again (never anything with a marker, a tick, a pin or a tap that kept it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

const desc = () => [...core.comps].map((c, l) => (c && !c.merged ? { l, ...c } : null)).filter(Boolean);
// a guide's saved secStates (a built guide is needed to save: one with no markers will do)
const saved = () => {
  core.assignData = { assign: {}, order: [], N: 0 };
  const d = core.currentDesignObj(false, true);
  core.assignData = null;
  return d.payload;
};
// the harness's section map: raw RGBA after 'data:image/x-mslabels;w,h,'
const mapLabels = (url) => {
  const m = /^data:image\/x-mslabels;(\d+),(\d+),(.*)$/.exec(url), b = Buffer.from(m[3], 'base64'), out = new Set();
  let hi = 0;
  for (let j = 0; j < b.length; j += 4) {
    const v = b[j] | (b[j + 1] << 8) | (b[j + 2] << 16);
    if (v) { out.add(v - 1); if (v - 1 > hi) hi = v - 1; }
  }
  return { n: out.size, hi, has: (l) => out.has(l) };
};

// A photo of a page on a table: dark table, a bright page with a band of ink round it, a square drawn on it, and a
// little piece of the table cut off at a corner by a line (it touches the edge, but too little to be background by
// the edge rule: it is background only because it lies outside the page)
function pagePhoto() {
  const W = 200, H = 200, gray = new Uint8Array(W * H).fill(90), lab = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, inPage = x >= 20 && x < 180 && y >= 20 && y < 180;
    if (inPage) gray[p] = 245;
    const band = x >= 18 && x < 182 && y >= 18 && y < 182 && !inPage,
      sq = x >= 60 && x < 140 && y >= 60 && y < 140 && !(x >= 62 && x < 138 && y >= 62 && y < 138),
      cut = Math.abs(x + y - 12) <= 1;
    lab[p] = band || sq || cut ? -1 : 0;
  }
  core.W = W; core.H = H; core.gray = gray; core.labels = lab; core.bgTrim = 50;
  core.labelCells();
  const cs = desc();
  return {
    page: cs.find((c) => c.page).l,
    sliver: cs.find((c) => c.bpx > 0 && c.area < 200).l,
    inner: cs.find((c) => !c.bg && c.area > 3000 && c.area < 7000).l,
  };
}

test('a table piece left out because of the page is saved as left out, and still is after an Undo', () => {
  const s = pagePhoto();
  assert.equal(core.comps[s.sliver].bg, true, 'background on screen');
  let ss = saved().secStates;
  assert.equal(ss[s.sliver], 2, 'saved as left out');
  assert.equal(ss[s.page], 2, 'the page too');
  // a Split stroke that didn't divide anything is taken back from its Undo step, which doesn't know the page rule
  core.snapshotSeg();
  core.restoreSnap();
  ss = saved().secStates;
  assert.equal(ss[s.sliver], 2, 'still left out after the Undo step');
  assert.equal(ss[s.inner], undefined, 'the drawing is not');
});

test('the page margin merged into a section keeps that section the page (and its background)', () => {
  const s = pagePhoto();
  core.mergeCellsSnap(s.inner, s.page);
  assert.equal(core.comps[s.inner].page, true);
  core.applyBg();
  assert.equal(core.comps[s.sliver].bg, true, 'the table piece is still background after the page rule runs again');
});

test('a section picked to merge is let go when the sections are found again', () => {
  core.W = 40; core.H = 40; core.enhance = true;
  const g = new Uint8Array(1600).fill(255);
  for (let i = 0; i < 40; i++) { g[20 * 40 + i] = 0; g[i * 40 + 20] = 0; }
  core.gray = g; core.segment();
  core.mergeSel = 2;
  core.segment();
  assert.equal(core.mergeSel, -1);
});

test('a stroke is for the section it runs through furthest, lines not counted', () => {
  // three columns of paper between two ink lines: x 0-9 | 10-11 ink | 12-37 | 38-39 ink | 40-49
  const W = 50, H = 20, lab = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lab[y * W + x] = (x >= 10 && x < 12) || (x >= 38 && x < 40) ? -1 : 0;
  core.W = W; core.H = H; core.labels = lab; core.gray = new Uint8Array(W * H).fill(255); core.labelCells();
  const at = (x, y) => core.labels[y * W + x];
  // begun on the line, across the middle column and a little way into the next
  assert.equal(core.strokeSection([{ x: 10, y: 10 }, { x: 42, y: 10 }]), at(20, 10));
  // begun a pixel into the left column
  assert.equal(core.strokeSection([{ x: 9, y: 5 }, { x: 36, y: 5 }]), at(20, 5));
  // only on the line: none
  assert.equal(core.strokeSection([{ x: 10, y: 1 }, { x: 11, y: 18 }]), 0);
});

// a page of tiny specks (2 x 2 paper cells in a grid of 1-pixel lines) beside two big sections
function denseSpecks(S) {
  const W = S, H = S, lab = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const big = x < 60, edge = x === 60 || x === 61 || y === 100 && big;
    lab[y * W + x] = edge ? -1 : big ? 0 : x % 3 === 0 || y % 3 === 0 ? -1 : 0;
  }
  core.W = W; core.H = H; core.labels = lab; core.gray = new Uint8Array(W * H).fill(255);
  core.minPos = 30;
  core.labelCells();
  core.secState = new Uint8Array(core.comps.length);
  core.colored = new Uint8Array(core.comps.length);
}

test('a very dense page: the specks are saved as part of the lines until 90,000 sections are left', () => {
  denseSpecks(960); // about 300 x 300 = 90,000+ specks
  const live = desc().length;
  assert.ok(live > 95000, 'sections: ' + live);
  const bigs = desc().filter((c) => c.area > 1000).map((c) => c.l);
  assert.equal(bigs.length, 2);
  // a speck kept in the guide by a tap, and one ticked, are never folded; nor the highest-numbered ones last
  const specks = desc().filter((c) => c.area < 10).map((c) => c.l), top = specks[specks.length - 1], low = specks[0];
  core.secState[top] = 1;
  core.colored[specks[specks.length - 2]] = 1;
  const m = mapLabels(saved().lmap);
  assert.equal(m.n, 90000, 'sections saved: ' + m.n);
  for (const l of bigs) assert.ok(m.has(l), 'big section ' + l + ' kept');
  assert.ok(m.has(top), 'kept by a tap');
  assert.ok(m.has(specks[specks.length - 2]), 'ticked');
  assert.ok(m.has(low), 'the lowest numbers stay');
  // (the guide's own numbers are kept when it opens: no more than twice as high as how many there are)
  assert.ok(m.hi <= m.n * 2 + 64, 'highest ' + m.hi);
  // the sections on screen are as they were
  assert.equal(desc().length, live);
  // which specks go depends on Min section size, so the saved map is made again when it changes
  core.minPos = 0;
  const m0 = mapLabels(saved().lmap);
  assert.ok(m0.n > 90000, 'nothing smaller than the smallest Min: ' + m0.n);
  core.minPos = 30;
});

test('a page with fewer sections is saved exactly as it is', () => {
  denseSpecks(300);
  const live = desc().length;
  assert.ok(live < 90000);
  assert.equal(core.foldSet(), null);
  assert.equal(mapLabels(saved().lmap).n, live);
});

test('Build is stopped when the sections left after folding would be more than a guide keeps', () => {
  denseSpecks(960);
  // Min section size at its smallest: the specks are sections in the guide, nothing to fold
  core.minPos = 0;
  const d = core.denseCount(0);
  assert.ok(d.cnt > 90000 && d.kept > 90000, JSON.stringify(d));
  const d30 = core.denseCount(30);
  assert.ok(d30.cnt <= 3000 && d30.kept === 90000, JSON.stringify(d30));
  core.minPos = 30;
});
