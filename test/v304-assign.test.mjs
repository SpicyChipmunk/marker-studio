// v304 (plan patterns: 30-palette-assign, 31-balance, 34-zones): Build guide after sections were added or split lays
// the new sections clear of the old ones' markers (it used to put the old markers back after laying them all afresh);
// with zones, every zone laid in one go is laid over its own extent (all but the first ran over the whole picture);
// markers that look the same (CIEDE2000 under 2.5) count as the same marker for touching sections, and Random's
// Mixed keeps touching sections from sharing a marker even with "clearly different" off; specks in a porous line are
// looked across (kept ones aren't); the Gradient's order is worked out once per set of markers; the last Blend anchor
// removed brings back three in the zone; one marker to use shows "all (1)" on a slider that can't move; and what the
// last laying worked out isn't shown for another picture, guide or after Undo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(sets) {
  const app = createApp(), E = app.__eval, t = app.__mstest;
  E('state.owned = new Set()');
  for (const n of sets) E(`presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`);
  t.coll = E('sfCollection()');
  t.assign.quiet();
  return { app, t, A: t.assign };
}
// a repeatable Math.random while fn runs
function seeded(seed, fn) {
  const r = Math.random;
  let s = seed;
  Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  try { return fn(); } finally { Math.random = r; }
}
// cols × rows square sections, cell px across, lines lw px between them; ready to build
function grid(t, cols, rows, cell = 24, lw = 2) {
  const W = cols * (cell + lw) + lw, H = rows * (cell + lw) + lw, labels = new Int32Array(W * H).fill(-1), comps = [null];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const l = comps.length, x0 = lw + c * (cell + lw), y0 = lw + r * (cell + lw);
    comps.push({ area: cell * cell, bg: false, bpx: 0, cx: x0 + cell / 2, cy: y0 + cell / 2, h: cell - 1, x0, y0, x1: x0 + cell - 1, y1: y0 + cell - 1, merged: false });
    for (let y = y0; y < y0 + cell; y++) labels.fill(l, y * W + x0, y * W + x0 + cell);
  }
  ready(t, W, H, labels, comps);
  return { W, H, at: (c, r) => 1 + r * cols + c };
}
function ready(t, W, H, labels, comps) {
  t.W = W; t.H = H; t.labels = labels; t.comps = comps;
  t.secState = new Uint8Array(comps.length).fill(1);
  t.secColor = new Array(comps.length).fill([200, 200, 200]);
  t.assign.adj = null; t.assign.segFresh = true; t.assign.sfmode = 'review';
}
const style = (t, o) => Object.assign(t.styleVars, { family: 'random', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 16, balance: 'mixed', noRep: false, noAdj: false, balM: 'auto', balS: 'auto', balA: 'auto', balSeed: 0.3 }, o);
// touching pairs (among sections with markers; only those touching one of `only` when given): sharing a marker, and
// with markers under 2.5 apart
function touching(app, t, only) {
  const a = t.adj, A = t.assignData.assign;
  let same = 0, twin = 0, pairs = 0;
  for (const k in a) a[k].forEach((q) => {
    const l = +k;
    if (q <= l || !A[l] || !A[q] || (only && !only[l] && !only[q])) return;
    pairs++;
    if (A[l].mkey === A[q].mkey) same++;
    else if (app.de2000(A[l].lab, A[q].lab) < 2.5) twin++;
  });
  return { same, twin, pairs };
}

test('Build guide after sections are brought in: the new ones are laid clear of the markers the old ones keep', () => {
  for (const [mode, o] of [['Mixed, clearly different', { noAdj: true }], ['Main colour', { balance: 'main' }], ['No repeats', { noRep: true }]]) {
    const { app, t, A } = appWith(['Honolulu 120']);
    const g = grid(t, 12, 10), back = {};
    // every other section, as on a chessboard, left out of the first build
    for (let r = 0; r < 10; r++) for (let c = 0; c < 12; c++) if ((r + c) % 2) { t.secState[g.at(c, r)] = 2; back[g.at(c, r)] = 1; }
    style(t, o);
    const n = seeded(5, () => {
      A.buildGuide();
      A.sfmode = 'review';
      for (const l in back) t.secState[l] = 1;
      A.adj = null;
      A.buildGuide();
      return touching(app, t, back);
    });
    assert.equal(t.sfmode, 'guide');
    assert.ok(n.pairs > 200, mode + ': ' + n.pairs + ' pairs');
    assert.equal(n.same, 0, mode + ': touching sections sharing a marker');
  }
});

test('zones laid in one go (sections moved into a zone) are each laid over their own extent, as when laid alone', () => {
  for (const shape of ['radial', 'serpentine']) {
    const { t, A } = appWith(['Honolulu 120']);
    const g = grid(t, 12, 10);
    style(t, { family: 'gradient', gradShape: 'serpentine', limitN: 12 });
    A.buildGuide();
    const z = A.zoneNew();
    A.zoneSelect(z.id);
    Object.assign(t.styleVars, { family: 'gradient', gradShape: shape, look: 'smooth', limitN: 6 });
    const blk = [];
    for (let r = 4; r < 10; r++) for (let c = 6; c < 12; c++) blk.push(g.at(c, r));
    t.reassign(t.zoneMove(blk, z.id));
    const one = blk.map((l) => t.assignData.assign[l].mkey).join();
    t.reassign([z.id]);
    assert.equal(blk.map((l) => t.assignData.assign[l].mkey).join(), one, shape + ': the same layout');
  }
});

test('touching sections: specks in a porous line are looked across, as the line is; one kept by a tap is a section', () => {
  const { t } = appWith(['Honolulu 120']);
  // 1 | a 6 px line with a column of 2 × 2 specks in it (each a cell of its own) | 2
  const W = 300, H = 300, L = new Int32Array(W * H), comps = [null, { cx: 70, cy: 150, area: 140 * 300 }, { cx: 223, cy: 150, area: 154 * 300 }];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let l = x < 140 ? 1 : x < 146 ? -1 : 2;
    if (x >= 142 && x < 144) {
      l = 3 + (y >> 1);
      comps[l] = comps[l] || { cx: 143, cy: y + 1, area: 4 };
    }
    L[y * W + x] = l;
  }
  ready(t, W, H, L, comps);
  t.secState = new Uint8Array(comps.length);
  assert.ok(t.colour.adj()[1] && t.colour.adj()[1].has(2), '1 and 2 touch across the line and its specks');
  // a 3 × 3 section kept by a tap, ringed by a line inside a big one, touches it
  const W2 = 60, L2 = new Int32Array(W2 * W2).fill(1);
  for (let y = 19; y <= 23; y++) for (let x = 19; x <= 23; x++) L2[y * W2 + x] = y === 19 || y === 23 || x === 19 || x === 23 ? -1 : 2;
  ready(t, W2, W2, L2, [null, { cx: 30, cy: 30, area: 3575 }, { cx: 21, cy: 21, area: 9 }]);
  t.secState = Uint8Array.from([0, 0, 1]);
  assert.ok(t.colour.adj()[2] && t.colour.adj()[2].has(1), 'the kept one touches the one round it');
});

test('touching sections never share a marker, nor two markers that look the same (under 2.5), while another would do', () => {
  // (36 Skin Tones: many markers within 2.5 of another; Mixed with "clearly different" off included)
  for (const [mode, o, most] of [['Main colour', { balance: 'main', limitN: 12 }, 3], ['No repeats', { noRep: true }, 0], ['Mixed', { limitN: 12 }, 0]]) {
    let same = 0, twin = 0, pairs = 0;
    for (let k = 0; k < 8; k++) {
      const { app, t, A } = appWith(['36 Skin Tones']);
      grid(t, 12, 10);
      style(t, Object.assign({ balSeed: 0.2 * k + 0.1 }, o));
      const n = seeded(11 + k, () => {
        A.buildGuide();
        return touching(app, t);
      });
      same += n.same; twin += n.twin; pairs += n.pairs;
    }
    assert.ok(same + twin <= most, `${mode}: ${same} sharing a marker and ${twin} look-alikes in ${pairs} touching pairs`);
  }
});

test('with hundreds of markers, laying Random compares few pairs of them by eye (CIEDE2000)', () => {
  // (720 markers: "clearly different" tried every one against every neighbour, a second or more on an iPad; the
  // look-alike check of v304 looks at plain L*a*b* distance first, so most pairs need no CIEDE2000)
  const { app, t, A } = appWith([]);
  grid(t, 25, 20, 20);
  const d = app.de2000;
  for (const [mode, o, most] of [['clearly different', { noAdj: true }, 30000], ['Mixed', {}, 3000], ['No repeats', { noRep: true }, 3000], ['Main colour', { balance: 'main' }, 10000]]) {
    style(t, Object.assign({ limitN: 400 }, o));
    let n = 0;
    app.de2000 = (a, b) => (n++, d(a, b));
    try {
      seeded(3, () => (t.sfmode === 'guide' ? t.reassign() : A.buildGuide()));
    } finally {
      app.de2000 = d;
    }
    assert.ok(n < most, `${mode}: ${n} with ${t.coll.length} markers`);
  }
});

test('the Gradient\'s order of markers is worked out once: asked again, it is the same however little time there is', () => {
  const { t } = appWith(['Honolulu 320 (complete set)']);
  const ms = t.coll.filter((m, i) => m.lab && i % 2 === 0).slice(0, 150);
  const first = t.grad.sequence(ms, 1, false).map((m) => m.mkey).join();
  const now = Date.now;
  let clock = now();
  // (a clock that runs out at once: the tour gets no time to improve on its start)
  Date.now = () => (clock += 1000);
  try {
    assert.equal(t.grad.sequence(ms.slice(), 1, false).map((m) => m.mkey).join(), first);
  } finally {
    Date.now = now;
  }
});

test('the last Blend anchor removed: three again, inside the zone being laid', () => {
  const { t, A } = appWith(['Honolulu 120']);
  const g = grid(t, 10, 8);
  style(t, { family: 'blend', limitN: 12 });
  A.buildGuide();
  const z = A.zoneNew();
  A.zoneSelect(z.id);
  t.styleVars.family = 'blend';
  const blk = [];
  for (let r = 5; r < 8; r++) for (let c = 7; c < 10; c++) blk.push(g.at(c, r));
  t.reassign(t.zoneMove(blk, z.id));
  t.anchors.length = 0;
  A.blendNow();
  const b = t.zoneBoxOf(t.zoneSecs(z.id));
  assert.equal(t.anchors.length, 3);
  for (const a of t.anchors) assert.ok(a.x >= b.x0 && a.x <= b.x1 && a.y >= b.y0 && a.y <= b.y1, `(${a.x}, ${a.y}) in the zone`);
  assert.ok(new Set(blk.map((l) => t.assignData.assign[l].mkey)).size > 1, 'not one marker everywhere');
});

test('one marker to use: the count says "all · 1" (v308: "all (1)" before) and its slider can\'t move', () => {
  const { app, t, A } = appWith([]);
  const E = app.__eval;
  E('state.owned = new Set([presetMkeys(MARKER_SETS[0])[0]])');
  t.coll = E('sfCollection()');
  grid(t, 4, 4);
  style(t, { family: 'gradient' });
  const h = A.colours();
  assert.match(h, /id="sfMkNlbl">all · 1</);
  assert.match(h, /id="sfMkCount"[^>]* disabled/);
});

test('what the last laying worked out (Balance\'s figures, how many markers) goes with a new picture and with Undo', () => {
  const { t, A } = appWith(['Honolulu 120']);
  grid(t, 12, 9);
  style(t, { balance: 'main' });
  A.buildGuide();
  A.planCommit();
  assert.ok(Object.keys(A.balStat).length && A.lastPoolN > 0);
  t.styleVars.balSeed = 0.8;
  t.reassign();
  A.planUndo();
  // (the count is worked out again from the settings Undo put back; Balance's figures wait for the next laying)
  assert.equal(Object.keys(A.balStat).length, 0, 'after Undo');
  t.reassign();
  assert.ok(A.lastPoolN > 0);
  A.resetForNewPicture();
  assert.deepEqual([Object.keys(A.balStat).length, A.lastPoolN], [0, 0], 'a new picture');
});
