// v318.11 (gradArea 5, new guides only): Shuffle on a Gradient that runs light to dark (a ramp, not a loop round the
// colour wheel) moves where each marker hands over to the next, so it always changes the guide; its order and markers
// stay. Pastel on Honolulu 120 had given the same guide back Shuffle after Shuffle. A guide at gradArea 4 and before,
// a loop, and the first build (gradSeed 0) lay as before. Fails on v318.10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const SET = (n) => `state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => ${n})))`;
// a grid of cells, each a section
function gridApp(cols, rows, ownedJs) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(ownedJs);
  t.coll = E('sfCollection()');
  const cell = 20,
    lw = 2,
    W = cols * (cell + lw) + lw,
    H = rows * (cell + lw) + lw,
    g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (x % (cell + lw) < lw || y % (cell + lw) < lw) g[y * W + x] = 0;
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.segment();
  return { E, t };
}
function lay(a, vars) {
  const t = a.t;
  Object.assign(
    t.styleVars,
    {
      family: 'gradient',
      gradShape: 'serpentine',
      look: 'auto',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'pastel',
      limitN: 40,
      gradScat: 0,
      gradSeed: 0,
    },
    vars,
  );
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  t.assign.buildGuide();
  return { ...t.assignData.assign };
}
const codes = (as) =>
  Object.keys(as)
    .sort((x, y) => x - y)
    .map((l) => as[l].mkey);
const moved = (x, y) => {
  const ls = Object.keys(x);
  return ls.filter((l) => y[l] && y[l].mkey !== x[l].mkey).length / ls.length;
};
// Shuffle's steps on a ramp (52-controls-plan-wire: a fifth to four fifths of the way round each time)
const SEEDS = [0, 0.27, 0.71, 0.95, 0.38];

test('Pastel on Honolulu 120 at 40 markers (all its pastels: nothing else to pick) runs light to dark, and every Shuffle moves at least 15% of the sections', () => {
  const a = gridApp(16, 14, SET("s.n === 'Honolulu 120'"));
  lay(a, {});
  assert.equal(a.t.gradStartInfo(), null, 'a ramp, not a loop');
  const all = SEEDS.map((s) => lay(a, { gradSeed: s }));
  for (let k = 1; k < all.length; k++)
    assert.ok(
      moved(all[k - 1], all[k]) >= 0.15,
      `Shuffle ${k}: ${Math.round(moved(all[k - 1], all[k]) * 100)}% moved`,
    );
  // the run's markers are the same ones
  const set = (as) => [...new Set(Object.values(as).map((m) => m.mkey))].sort().join();
  assert.equal(set(all[1]), set(all[0]));
});

test('a guide at gradArea 4 lays as it did: the same Shuffles there change nothing', () => {
  const a = gridApp(16, 14, SET("s.n === 'Honolulu 120'"));
  const all = SEEDS.map((s) => codes(lay(a, { gradArea: 4, gradSeed: s })).join());
  assert.equal(new Set(all).size, 1);
});

test('the first build (gradSeed 0) and a loop lay exactly as at gradArea 4', () => {
  const a = gridApp(16, 14, SET("s.n === 'Honolulu 120'"));
  assert.equal(codes(lay(a, { gradArea: 5 })).join(), codes(lay(a, { gradArea: 4 })).join(), 'gradSeed 0');
  for (const s of [0.27, 0.71])
    assert.equal(
      codes(lay(a, { emphasis: 'neutral', gradArea: 5, gradSeed: s })).join(),
      codes(lay(a, { emphasis: 'neutral', gradArea: 4, gradSeed: s })).join(),
      'a loop at ' + s,
    );
});

test('gradArea: 5 is saved and opens as saved', () => {
  const core = createApp().__mstest,
    f = [...core.styleFields].find((x) => x.key === 'gradArea');
  assert.equal(f.check(5, f.def), 5);
  core.styleVars.gradArea = 5;
  assert.equal(f.save(), 5);
});
