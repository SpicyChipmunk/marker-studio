// v318.10: three colouring fixes the guide benchmark found (scripts/bench colour.mjs, stage B).
//  - Gradient (gradArea 4, new guides only): a run never picks a marker under TWIN_DE of one already picked while one
//    that isn't is among the near ones (Honolulu 120 at 32 markers picked near twins on 33 of 38 pages).
//  - No repeats: the sections touching the most others are laid first, and the last resort is a marker clear of the
//    neighbours before one on them (a hub laid late on Ciao 12 found every marker beside it and took one anyway).
//  - Balance: hubs first, the rest biggest first as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function seeded(seed, fn) {
  const r = Math.random;
  let s = seed >>> 0 || 1;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = r;
  }
}
const SET = (n) => `state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => ${n})))`;

// an app on a page drawn by draw(W, H, g) (0 = line), segmented
function appOn(W, H, draw, ownedJs) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(ownedJs);
  t.coll = E('sfCollection()');
  const g = new Uint8Array(W * H).fill(255);
  draw(W, H, g);
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.segment();
  return { E, t, de: E('de2000') };
}
const cell = 20,
  lw = 2,
  step = cell + lw;
// a grid of cells
const grid = (cols, rows) => [
  cols * step + lw,
  rows * step + lw,
  (W, H, g) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (x % step < lw || y % step < lw) g[y * W + x] = 0;
  },
];
// rows of cells (cw x ch) between full-width bands bh tall: every band touches the 2 x cols cells beside it (a hub,
// smaller than its neighbours when the cells are big and the bands thin)
const comb = (cols, rows, cw = cell, ch = cell, bh = cell) => {
  const ys = [lw];
  for (let r = 0; r < rows; r++) ys.push(ys[r] + (r % 2 ? ch : bh) + lw);
  const W = cols * (cw + lw) + lw,
    H = ys[rows];
  return [
    W,
    H,
    (W, H, g) => {
      for (let y = 0; y < H; y++) {
        let r = 0;
        while (r < rows && y >= ys[r + 1]) r++;
        for (let x = 0; x < W; x++)
          if (y < lw || y >= ys[r + 1] - lw || x < lw || x >= W - lw || (r % 2 === 1 && x % (cw + lw) < lw))
            g[y * W + x] = 0;
      }
    },
  ];
};
function lay(a, vars, seed) {
  const t = a.t;
  Object.assign(
    t.styleVars,
    {
      look: 'auto',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      limitN: 16,
      gradScat: 0,
      noRep: false,
      noAdj: false,
      balance: 'mixed',
    },
    vars,
  );
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  seeded(seed, () => t.assign.buildGuide());
  return t.assignData;
}
// touching sections on the same marker
function shared(a, ad) {
  const adj = a.t.adj;
  let n = 0;
  for (const l of ad.order)
    for (const q of adj[l] || [])
      if (q > l && ad.assign[q] && ad.assign[l] && ad.assign[q].mkey === ad.assign[l].mkey) n++;
  return n;
}

test('a new guide takes gradArea 4 or later (5 since v318.11)', () => {
  const a = appOn(...grid(4, 4), 'state.owned = defaultOwned()');
  assert.ok(a.t.styleVars.gradArea >= 4);
});

test('gradArea: 4 is saved and opens as saved; 6 is not a value', () => {
  const core = createApp().__mstest,
    f = [...core.styleFields].find((x) => x.key === 'gradArea');
  assert.equal(f.check(4, f.def), 4);
  assert.equal(f.check(6, f.def), 0);
  core.styleVars.gradArea = 4;
  assert.equal(f.save(), 4);
});

test('Gradient at 32 markers on Honolulu 120: no near twins picked at gradArea 4 (gradArea 3 lays as before)', () => {
  const a = appOn(...grid(16, 14), SET("s.n === 'Honolulu 120'"));
  const ms = (ad) => [...new Map(Object.values(ad.assign).map((m) => [m.mkey, m])).values()];
  const twins = (list) => {
    let n = 0;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) if (a.de(list[i].lab, list[j].lab) < 2.5) n++;
    return n;
  };
  const v = { family: 'gradient', gradShape: 'serpentine', limitN: 32 };
  const was = twins(ms(lay(a, { ...v, gradArea: 3 }, 7))),
    now = twins(ms(lay(a, { ...v, gradArea: 4 }, 7)));
  assert.ok(was > 0, 'gradArea 3 picks a near twin here');
  assert.equal(now, 0);
});

test('No repeats on Ciao 12: the bands touching 2 x 24 cells never share a marker with one', () => {
  const a = appOn(...comb(24, 9), SET("s.n === 'Ciao 12'"));
  for (const seed of [1, 2, 3, 4, 5, 6])
    assert.equal(shared(a, lay(a, { family: 'random', noRep: true }, seed)), 0, `seed ${seed}`);
});

test('No repeats on Ciao 12, a plain grid: still no touching pair on one marker, every marker used', () => {
  const a = appOn(...grid(10, 8), SET("s.n === 'Ciao 12'"));
  for (const seed of [1, 2, 3]) {
    const ad = lay(a, { family: 'random', noRep: true }, seed);
    assert.equal(shared(a, ad), 0, `seed ${seed}`);
    assert.equal(new Set(Object.values(ad.assign).map((m) => m.mkey)).size, 12);
  }
});

test('Balance on Ciao 12: thin bands between big cells never share a marker with a cell beside them', () => {
  const a = appOn(...comb(12, 9, 40, 80, 6), SET("s.n === 'Ciao 12'"));
  for (const seed of [1, 2, 3, 4])
    assert.equal(shared(a, lay(a, { family: 'random', balance: 'main' }, seed)), 0, `seed ${seed}`);
});
