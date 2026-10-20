// v318.28 (deep debugging pass, step 2): Y2, Palette (reviewer C's C2, C3) and making a guide (reviewer D's D2/D3).
// C1, C4, C5 (a band's tap) and D1 (a long PDF) are in e2e/v31828-y2. Each test fails on v318.27.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

// ---- Palette ----
function palApp(owned) {
  const a = createApp({ localStorage: memoryStorage() }),
    E = a.__eval;
  E('state.owned = new Set(); state.pool = null; state.ink = {}');
  E(
    `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(owned)})).forEach((k) => state.owned.add(k))`,
  );
  // no screen to draw on; the line under the Colours row readable
  E(`showPalette = function () {}; chrome = function () {}; fullRender = function () {}; clearPalette = function () {};
     renderRecent = function () {}; flashSaved = function () {}; toast = function () {};
     var __pc = { textContent: '', style: {} }, __d = document;
     document = new Proxy({}, { get(t, p) {
       if (p === 'getElementById') return (id) => (id === 'palClose' ? __pc : __d.getElementById(id));
       return __d[p];
     } })`);
  return a;
}
const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
const palState = (E, h, n) =>
  E(`state.mode = 'palette'; state.harmony = '${h}'; state.palSize = ${n}; state.palettes = []; state.palH = [];
     state.locked = []; state.seed = null; state.excluded = new Set(); setPool(null)`);

test('Y2 C2: re-rolling a band of a grey Monochrome (built from a black) gives greys, not clear colours', () => {
  for (const set of ['Honolulu 120', 'Sketch 72 - Set A']) {
    const a = palApp(set),
      E = a.__eval;
    palState(E, 'mono', 5);
    // the darkest near-grey in play: the set's black
    const bi = +E(`(function () { let b = -1; for (let i = 0; i < COLORS.length; i++)
      if (inPool(i) && LCH[i][1] < GREY_C && (b < 0 || LCH[i][0] < LCH[b][0])) b = i; return b; })()`);
    const pal = J(a, `[...genPalette(5, 'mono', { seedIdx: ${bi}, locked: { 0: ${bi} } })]`);
    assert.ok(J(a, `${JSON.stringify(pal)}.every((i) => LCH[i][1] < GREY_C)`), set + ': a ramp of greys');
    for (let k = 0; k < pal.length; k++)
      for (let t = 0; t < 12; t++) {
        const p = +E(`rerollPick(${JSON.stringify(pal)}, ${k}, 'mono')`);
        if (p < 0) continue;
        assert.ok(
          +E(`LCH[${p}][1]`) < +E('GREY_C'),
          `${set} band ${k}: ${E(`capCode(${p})`)} is a clear colour`,
        );
      }
  }
});

test('Y2 C3: a colour scheme made of greys says so under the Colours row; Monochrome and clear schemes don’t', () => {
  const a = palApp('All Copic markers'),
    E = a.__eval;
  palState(E, 'custom', 4);
  // a selection of the Copic greys (as Markers' search "grey" hands one over)
  E(
    `setPool(COLORS.map((c, i) => i).filter((i) => COLORS[i].brand === 'Copic' && /^(C|N|T|W)-\\d/.test(COLORS[i].code)))`,
  );
  for (const h of ['complementary', 'triadic', 'tetradic', 'split', 'analogous']) {
    E(`setHarmony('${h}'); closeNote()`);
    assert.match(
      E('__pc.textContent'),
      /^Some colours are greys: your markers in play don’t have \d clear colours for this scheme\.$/,
      h,
    );
  }
  E(`setHarmony('mono'); closeNote()`);
  assert.doesNotMatch(E('__pc.textContent'), /greys/, 'Monochrome’s greys are its steps');
  const b = palApp('Honolulu 120'),
    F = b.__eval;
  for (const h of ['complementary', 'triadic', 'tetradic'])
    for (let t = 0; t < 4; t++) {
      palState(F, h, 4);
      F(`palPush(genPalette(4, '${h}', paletteOpts()), 24); closeNote()`);
      assert.doesNotMatch(F('__pc.textContent'), /greys/, h + ' from Honolulu 120');
    }
});

// ---- Sections left white in the Pattern box's counts ----
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
// an app on a page drawn by draw(W, H, g) (0 = line), segmented, with Honolulu 120
function appOn(W, H, draw) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(`state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')))`);
  t.coll = E('sfCollection()');
  const g = new Uint8Array(W * H).fill(255);
  draw(W, H, g);
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.segment();
  return t;
}
function lay(t, vars, seed) {
  Object.assign(
    t.styleVars,
    { family: 'random', look: 'auto', paletteSource: 'owned', palette: 'all', emphasis: 'neutral' },
    { limitN: 16, noRep: false, noAdj: true, balance: 'mixed' },
    vars,
  );
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  seeded(seed, () => t.assign.buildGuide());
}
const LW = 2;
// a grid of cells (cell px, lines LW), with the top-left bw × bh cells one big section when bw > 0
const grid = (cols, rows, bw = 0, bh = 0, cell = 18) => {
  const step = cell + LW;
  return [
    cols * step + LW,
    rows * step + LW,
    (W, H, g) => {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const cx = Math.floor(x / step),
            cy = Math.floor(y / step),
            inBig = cx < bw && cy < bh && x > LW && y > LW && x < bw * step && y < bh * step;
          if ((!inBig && (x % step < LW || y % step < LW)) || x < LW || y < LW || x >= W - LW || y >= H - LW)
            g[y * W + x] = 0;
        }
    },
  ];
};

test('Y2 D3: No repeats counts the sections coloured, not those left white', () => {
  const t = appOn(...grid(5, 3));
  lay(t, { noRep: true, limitN: 120 }, 1);
  const note = () => (t.assign.pattern().match(/id="sfNoRepNote"[^>]*>([^<]*)/) || [])[1];
  assert.equal(t.assignData.N, 15);
  assert.match(note(), /^Every section has its own marker: 15\./);
  for (const l of t.assignData.order.slice(0, 5)) t.leaveWhite(l);
  seeded(2, () => t.layPlan(null));
  assert.equal(t.assignData.N, 10);
  assert.match(note(), /^Every section has its own marker: 10\./);
});

test('Y2 D2: Main colour’s “why the shares miss” stays once a section is left white', () => {
  // one big section (11 × 9 cells) among small ones: 60/30/10 can't be met
  const t = appOn(...grid(12, 10, 11, 9)),
    miss = () => (t.assign.pattern().match(/id="sfBalMiss"[^>]*>([^<]*)/) || [])[1] || '';
  lay(t, { balance: 'main', limitN: 8 }, 1);
  assert.match(miss(), /^Its sections’ sizes don’t allow 60\/30\/10 exactly: the biggest covers \d+%/);
  t.leaveWhite(t.assignData.order[t.assignData.order.length - 1]);
  seeded(1, () => t.layPlan(null));
  assert.match(miss(), /^Its sections’ sizes don’t allow 60\/30\/10 exactly: the biggest covers \d+%/);
});
