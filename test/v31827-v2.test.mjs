// v318.27: Random's "Keep touching sections clearly different" holds roll after roll. Laid one section at a time, a
// section could find every marker alike to one of its neighbours' and take one anyway (the order painted itself into a
// corner): on the sample, 3 rolls in 4 with Main colour; with No repeats on a small set nearly every roll. A repair
// after the laying (adjRepair, js/guide/30-palette-assign.js) puts each such section right where any marker will do,
// and the box says so when one can't be (too few different markers): #sfNoAdjNote.
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
const SET = (n) => `state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === '${n}')))`;

// an app on a page drawn by draw(W, H, g) (0 = line), segmented
function appOn([W, H, draw], set) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(SET(set));
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
const lw = 2;
// rows of cells (cw wide) between full-width bands: every band touches the cells of the rows on both sides of it, and
// two cells side by side touch each other and the band, so three touching sections at every cell's edge (many more
// round a band); cells of different sizes so the order sections are laid in varies
const comb = (cols, rows, cw = 20, ch = 20, bh = 12) => {
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
// a grid of cells with every other line knocked through in places: sections of many shapes and neighbour counts
const blocks = (cols, rows, cell = 18) => {
  const step = cell + lw,
    W = cols * step + lw,
    H = rows * step + lw;
  return [
    W,
    H,
    (W, H, g) => {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const cx = Math.floor(x / step),
            cy = Math.floor(y / step),
            vl = x % step < lw,
            hl = y % step < lw;
          // (a vertical line left out where (cx + 2 cy) % 5 is 0, a horizontal one where (3 cx + cy) % 7 is 0)
          const keepV = vl && !(x > lw && x < W - lw && !hl && (cx + 2 * cy) % 5 === 0),
            keepH = hl && !(y > lw && y < H - lw && !vl && (3 * cx + cy) % 7 === 0);
          if (keepV || keepH || x < lw || y < lw || x >= W - lw || y >= H - lw) g[y * W + x] = 0;
        }
    },
  ];
};
function lay(a, vars, seed) {
  const t = a.t;
  Object.assign(
    t.styleVars,
    {
      family: 'random',
      look: 'auto',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      limitN: 16,
      noRep: false,
      noAdj: true,
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
// touching sections (the app's own adjacency) on one marker or on markers alike by eye (CIEDE2000 under 10): the pairs,
// and the sections in them
function clashes(a, ad) {
  const adj = a.t.adj,
    secs = new Set();
  let n = 0;
  for (const l of ad.order)
    for (const q of adj[l] || []) {
      const x = ad.assign[l],
        y = ad.assign[q];
      if (q > l && x && y && (x.mkey === y.mkey || a.de(x.lab, y.lab) < 10)) {
        n++;
        secs.add(l).add(q);
      }
    }
  return { n, secs: secs.size };
}
const MODES = {
  Mixed: {},
  'Main colour': { balance: 'main' },
  'No repeats': { noRep: true },
};

// (before v318.27, on these pages: No repeats left touching sections alike on 4 to 7 rolls in 12, Main colour on
// Honolulu 24's blocks 11 in 12; Mixed held)
test('Keep touching sections clearly different holds on every roll: Mixed, Main colour and No repeats, 8 and 16 markers', () => {
  for (const [page, set] of [
    [comb(14, 9), 'Honolulu 120'],
    [blocks(16, 12), 'Honolulu 24'],
  ]) {
    const a = appOn(page, set);
    for (const [mode, v] of Object.entries(MODES))
      for (const limitN of [8, 16]) {
        const bad = [];
        for (let seed = 1; seed <= 12; seed++) {
          const ad = lay(a, { ...v, limitN }, seed),
            c = clashes(a, ad),
            // (and the count the note goes by agrees: nothing left)
            left = (a.t.assign.adjLeft || {})['0'];
          assert.ok(ad.order.length > 60, ad.order.length + ' sections');
          if (c.n || left) bad.push('seed ' + seed + ': ' + c.n + ' pairs, ' + left + ' left');
        }
        assert.deepEqual(bad, [], set + ' · ' + mode + ' · ' + limitN + ' markers');
      }
  }
});

test("where it can't hold, the count is honest: Main colour on Ciao 12, each role a few markers, every roll", () => {
  const a = appOn(blocks(16, 12), 'Ciao 12');
  let some = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const ad = lay(a, { balance: 'main', limitN: 8 }, seed),
      c = clashes(a, ad);
    // (every section still alike to one it touches is counted, and only those)
    assert.equal(a.t.assign.adjLeft['0'], c.secs, 'seed ' + seed);
    if (c.n) some++;
    assert.ok(a.t.assign.balStat['0'].total > 0, 'Balance laid');
  }
  // (and it's the odd roll, not most: 12 in 12 before)
  assert.ok(some < 9, some + ' rolls in 12');
});

test('the rule off: no repair, nothing counted', () => {
  const a = appOn(comb(14, 9), 'Honolulu 120');
  for (const v of Object.values(MODES)) {
    lay(a, { ...v, noAdj: false, limitN: 8 }, 3);
    assert.equal(a.t.assign.adjLeft['0'], 0);
  }
});

test('too few markers to keep them apart: the note under the box says how many sections, and goes with a new picture', () => {
  // (2 markers: a band and the two cells either side of a line between them touch each other, three at once)
  const a = appOn(comb(6, 5), 'Honolulu 120');
  const ad = lay(a, { limitN: 2 }, 1),
    n = a.t.assign.adjLeft['0'];
  assert.ok(n > 0 && clashes(a, ad).secs === n, n + ' left');
  const h = a.t.assign.pattern();
  assert.match(h, /id="sfNoAdjNote"/);
  assert.ok(
    h.includes(n + ' touching sections couldn’t be kept clearly different: too few different markers.'),
    h.match(/sfNoAdjNote[^<]*/)[0],
  );
  // (with the rule off, no note: it isn't claimed)
  a.t.styleVars.noAdj = false;
  assert.doesNotMatch(a.t.assign.pattern(), /sfNoAdjNote/);
  a.t.styleVars.noAdj = true;
  // (enough markers: none)
  lay(a, { limitN: 16 }, 1);
  assert.equal(a.t.assign.adjLeft['0'], 0);
  assert.doesNotMatch(a.t.assign.pattern(), /sfNoAdjNote/);
  // (what the last laying worked out goes with a new picture, as Balance's figures do)
  lay(a, { limitN: 2 }, 1);
  a.t.assign.resetForNewPicture();
  assert.deepEqual({ ...a.t.assign.adjLeft }, {});
});

test('one section left: the note in the singular', () => {
  const a = appOn(comb(6, 5), 'Honolulu 120');
  lay(a, { limitN: 2 }, 1);
  a.t.assign.adjLeft['0'] = 1;
  assert.match(
    a.t.assign.pattern(),
    /<div id="sfNoAdjNote" class="sfc-note sfc-mt6">1 section couldn’t be kept clearly different from every section it touches: too few different markers\.<\/div>/,
  );
});
