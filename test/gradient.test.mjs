// The Gradient pattern's engine (js/guide/30-palette-assign.js): which markers it picks, how it orders them (loop
// or ramp), how many go to a band (the Look), how sections are shared out by area, and that it stays quick with
// thousands of sections and the whole catalogue. The browser tests (e2e/gradient.test.mjs) cover the controls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, cpuMs } from './harness.mjs';

// an app with these marker sets owned (none: the whole catalogue, as in demo mode), and the guide's collection
function appWith(sets) {
  const app = createApp(), E = app.__eval, core = app.__mstest;
  E('state.owned = new Set()');
  for (const n of sets) E(`presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`);
  core.coll = E('sfCollection()');
  return { app, E, core, g: core.grad, sv: core.styleVars };
}
// a picture of cols × rows sections (each rw × rh pixels; widths[x] makes some columns wider), all counted
function grid(core, cols, rows, rw = 20, rh = 20, widths = null) {
  const xs = [0];
  for (let x = 0; x < cols; x++) xs.push(xs[x] + (widths ? widths[x] : rw));
  const W = xs[cols], H = rows * rh, labels = new Int32Array(W * H), comps = [null];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const l = comps.length;
      comps.push({ cx: (xs[x] + xs[x + 1]) / 2, cy: y * rh + rh / 2, area: (xs[x + 1] - xs[x]) * rh, merged: false, bg: false });
      for (let py = y * rh; py < (y + 1) * rh; py++) labels.fill(l, py * W + xs[x], py * W + xs[x + 1]);
    }
  core.W = W; core.H = H; core.labels = labels; core.comps = comps;
  core.secState = new Uint8Array(comps.length).fill(1);
  core.assignData = null;
  return core.countedList();
}
const lchOf = (E, m) => E(`lchOf(${JSON.stringify([...m.lab])})`);
const keysOf = (core) => { const a = core.assignData; return a.order.map((l) => a.assign[l].mkey); };

test('Look: markers to a band — Smooth 1, Light to dark about √M (at least 3), Auto growing as markers near one per section, Serpentine’s rows smooth', () => {
  const { g } = appWith([]);
  assert.equal(g.groupSize('smooth', 200, 205, 'diagonal'), 1);
  assert.equal(g.groupSize('ltd', 200, 205, 'diagonal'), 14);
  assert.equal(g.groupSize('ltd', 4, 205, 'diagonal'), 3);
  assert.equal(g.groupSize('ltd', 2, 205, 'diagonal'), 2);
  // Auto: each marker on 3+ sections stays smooth; one per section is Light to dark's size; in between it grows
  assert.equal(g.groupSize('auto', 16, 205, 'diagonal'), 1);
  assert.equal(g.groupSize('auto', 60, 205, 'diagonal'), 1);
  assert.equal(g.groupSize('auto', 205, 205, 'diagonal'), 14);
  const mid = g.groupSize('auto', 120, 205, 'diagonal');
  assert.ok(mid > 1 && mid < 11, 'part way: ' + mid);
  assert.equal(g.groupSize('auto', 205, 205, 'serpentine'), 1);
  assert.equal(g.groupSize('ltd', 205, 205, 'serpentine'), 14);
});

test('loop or ramp: markers right round the colour wheel loop; a narrow set (warm only, one hue, two opposite hues) is a ramp', () => {
  const { g, core, E } = appWith(['Honolulu 320 (complete set)']);
  const coll = core.coll, h = (m) => lchOf(E, m);
  const col = coll.filter((m) => h(m)[1] >= 12);
  assert.equal(g.isLoop(col), true, 'your coloured markers go round the wheel');
  assert.equal(g.isLoop(col.filter((m) => { const x = h(m)[2]; return x < 90 || x > 330; })), false, 'warm only');
  const red = col.filter((m) => { const x = h(m)[2]; return x > 20 && x < 40; });
  assert.ok(red.length >= 3);
  assert.equal(g.isLoop(red), false, 'one hue');
  const two = col.filter((m) => { const x = h(m)[2]; return (x > 60 && x < 80) || (x > 250 && x < 270); });
  assert.equal(g.isLoop(two), false, 'two opposite hues');
  assert.equal(g.isLoop(col.slice(0, 2)), false, 'fewer than three colours');
  assert.deepEqual([...g.hueGap([10, 20, 200])], [180, 2]);
  assert.deepEqual([...g.hueGap([10, 100, 200, 300])], [100, 2]);
});

test('which markers: coloured before greys, greys only when there aren’t enough coloured, the clearer mid-range ones with markers to spare', () => {
  const { g, core, E } = appWith(['Honolulu 320 (complete set)']);
  const coll = core.coll, h = (m) => lchOf(E, m);
  const col = coll.filter((m) => h(m)[1] >= 12), greys = coll.length - col.length;
  assert.ok(greys > 10, 'the set has greys');
  // plenty: the tightest tier (chroma 30+, lightness 42-84)
  const t16 = g.tierPool(coll, 16);
  assert.ok(t16.length >= 16 && t16.every((m) => { const x = h(m); return x[1] >= 30 && x[0] >= 42 && x[0] <= 84; }));
  // all the coloured ones, and no grey, when that's what's needed
  const tc = g.tierPool(coll, col.length);
  assert.equal(tc.length, col.length);
  assert.ok(tc.every((m) => h(m)[1] >= 12));
  // more than the coloured ones: just enough greys, spread light to dark
  const t5 = g.tierPool(coll, col.length + 5);
  assert.equal(t5.length, col.length + 5);
  const gr = t5.filter((m) => h(m)[1] < 12).map((m) => h(m)[0]);
  assert.equal(gr.length, 5);
  assert.ok(Math.max(...gr) - Math.min(...gr) > 30, 'spread through their lightness');
});

test('the gradient never uses more markers than sections, uses no greys while there are enough coloured, and gives every section its own marker when asked', () => {
  const { core, sv, E } = appWith(['Honolulu 320 (complete set)']);
  const cl = grid(core, 15, 14); // 210 sections
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', gradSeed: 0, dir: 1 });
  for (const look of ['auto', 'smooth', 'ltd'])
    for (const shape of ['diagonal', 'radial', 'serpentine', 'vertical']) {
      Object.assign(sv, { look, gradShape: shape, limitN: 999 });
      core.grad.build(cl);
      const k = keysOf(core);
      assert.equal(k.length, 210);
      // (v306: with more sections than clear markers, the clear ones, some used twice, rather than greys)
      const cnt = core.grad.count(core.grad.poolSource(210, true), 210);
      assert.equal(new Set(k).size, cnt.reuse ? cnt.M : 210, `${look} ${shape}: every section its own marker`);
      const a = core.assignData;
      assert.equal(a.order.filter((l) => Math.hypot(a.assign[l].lab[1], a.assign[l].lab[2]) < 12).length, 0, 'no greys');
      sv.limitN = 16;
      core.grad.build(cl);
      assert.equal(new Set(keysOf(core)).size, 16, `${look} ${shape}: 16 markers`);
    }
  // fewer sections than the marker count: one marker per section at most
  const cl2 = grid(core, 3, 2);
  sv.limitN = 40;
  core.grad.build(cl2);
  assert.equal(new Set(keysOf(core)).size, 6);
  void E;
});

test('Smooth runs one marker after the next with small steps; a loop’s one wide step is its join', () => {
  const { core, sv, E } = appWith(['Honolulu 320 (complete set)']);
  const cl = grid(core, 40, 1, 20, 20);
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', gradSeed: 0, dir: 1, look: 'smooth', gradShape: 'vertical', limitN: 40 });
  core.grad.build(cl);
  const a = core.assignData, seq = a.order.map((l) => [...a.assign[l].lab]);
  const steps = seq.slice(1).map((x, i) => E(`de2000(${JSON.stringify(seq[i])}, ${JSON.stringify(x)})`));
  const mean = steps.reduce((s, x) => s + x, 0) / steps.length;
  assert.ok(mean < 12, 'mean step ' + mean.toFixed(1));
  // the old engine (HSL hue order) on the same markers stepped about twice as far; the widest step is small too
  assert.ok(Math.max(...steps) < 30, 'widest step ' + Math.max(...steps).toFixed(1));
});

test('ordering: an open ramp runs end to end from its lighter end; a loop tour is short; both keep to the time budget', () => {
  const { g, core, E } = appWith(['Honolulu 320 (complete set)']);
  const h = (m) => lchOf(E, m);
  // one hue, many lightnesses: a ramp, light to dark
  const reds = core.coll.filter((m) => { const x = h(m); return x[1] >= 12 && x[2] > 10 && x[2] < 50; });
  const seq = g.sequence(reds, 1, false), L = seq.map((m) => m.lab[0]);
  assert.ok(L[0] >= L[L.length - 1], 'lighter end first');
  // a ramp's steps are much smaller than a loop's over the same markers (the loop has to come back)
  const D = g.deMatrix(reds), n = reds.length;
  const open = g.tour(D, n, true), closed = g.tour(D, n, false);
  const run = (t) => t.slice(1).reduce((s, x, i) => s + D[t[i] * n + x], 0);
  assert.ok(run(open) < run(closed) + 1e-6);
  assert.deepEqual([...open].sort((a, b) => a - b), [...Array(n).keys()], 'a tour visits each once');
  // 700 colours: stops improving at a budget of steps (v306: counted, not on the clock), keeping the best so far. (The speed limits here and below catch a
  // slowdown of several times, not the difference between machines: GitHub's runners are 2-3 times slower than ours.)
  const all = appWith([]).core.coll;
  assert.ok(all.length > 700);
  // (the differences are timed in processor time, which other tests running alongside don't inflate; so is the tour)
  const big = all.slice(0, 700), c0 = cpuMs(), DB = g.deMatrix(big), c1 = cpuMs(), t1 = cpuMs(), tb = g.tour(DB, 700, false), t2 = cpuMs();
  assert.equal(new Set(tb).size, 700);
  assert.ok(c1 - c0 < 4000, 'differences ' + Math.round(c1 - c0) + 'ms');
  assert.ok(t2 - t1 < 2000, 'tour ' + Math.round(t2 - t1) + 'ms');
  assert.ok(core.gradTourWork[0] < core.gradTourWork[1], 'all of them finish inside the budget');
});

test('sharing by area: each marker covers about the same share of the picture, more evenly than sharing by count', () => {
  const { core, sv } = appWith(['Honolulu 320 (complete set)']);
  // columns of very different widths
  const widths = Array.from({ length: 24 }, (_, i) => (i % 3 === 0 ? 60 : 10));
  const cl = grid(core, 24, 4, 0, 20, widths);
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', gradSeed: 0, dir: 1, look: 'smooth', gradShape: 'vertical', limitN: 8 });
  core.grad.build(cl);
  const a = core.assignData, c = core.comps, per = {};
  let tot = 0;
  a.order.forEach((l) => { const k = a.assign[l].mkey; per[k] = (per[k] || 0) + c[l].area; tot += c[l].area; });
  const share = Object.values(per).map((x) => x / tot);
  assert.equal(share.length, 8);
  // by count each marker would get 12 sections: 3 columns of 60 or 1 of 60 and 2 of 10 (a 3:1 range at best);
  // by area they're within a column's width of an eighth
  assert.ok(Math.max(...share) / Math.min(...share) < 1.8, share.map((x) => (100 * x).toFixed(1)).join(' '));
  // the split itself: shares and minimums
  const s = core.grad.splitByArea(cl, [1, 1, 1, 1], [1, 1, 1, 1]);
  assert.equal(s.flat().length, cl.length);
  const s2 = core.grad.splitByArea(cl.slice(0, 5), [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]);
  assert.deepEqual([...s2].map((x) => x.length), [1, 1, 1, 1, 1], 'as many parts as items: one each');
});

test('Light to dark: each band runs light to dark across the flow, light at the top, or facing the sun when there’s shading', () => {
  const { core, sv } = appWith(['Honolulu 320 (complete set)']);
  const cl = grid(core, 12, 12);
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', gradSeed: 0, dir: 1, look: 'ltd', gradShape: 'vertical', limitN: 144, shadeMode: 'off' });
  // mean lightness of the top and bottom rows
  const rows = () => {
    const a = core.assignData, c = core.comps, top = [], bot = [];
    a.order.forEach((l) => { if (c[l].cy < 40) top.push(a.assign[l].lab[0]); if (c[l].cy > 200) bot.push(a.assign[l].lab[0]); });
    const m = (x) => x.reduce((s, v) => s + v, 0) / x.length;
    return m(top) - m(bot);
  };
  core.grad.build(cl);
  assert.ok(rows() > 15, 'light at the top: ' + rows().toFixed(1));
  assert.equal(core.grad.lightSign(), -1);
  sv.shadeMode = 'full';
  sv.shadeSun = { x: 0.5, y: 0.95 };
  core.grad.build(cl);
  assert.ok(rows() < -15, 'light facing the sun at the bottom: ' + rows().toFixed(1));
  assert.equal(core.assignData.lit, 1);
  sv.shadeMode = 'off';
});

test('Shuffle: a loop turns its start (same markers); a ramp of your markers picks others among near-equal ones', () => {
  const { core, sv, E } = appWith(['Honolulu 320 (complete set)']);
  const cl = grid(core, 10, 2);
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', dir: 1, look: 'smooth', gradShape: 'vertical', limitN: 12, gradSeed: 0 });
  core.grad.build(cl);
  const a0 = keysOf(core);
  sv.gradSeed = 0.5;
  core.grad.build(cl);
  const a1 = keysOf(core);
  assert.deepEqual([...new Set(a1)].sort(), [...new Set(a0)].sort(), 'a loop keeps its markers');
  assert.notDeepEqual(a1, a0, '... and starts elsewhere');
  // Warm: a ramp
  sv.palette = 'warm';
  sv.gradSeed = 0;
  assert.equal(core.grad.plan(core.grad.poolSource(12), 20).loop, false);
  core.grad.build(cl);
  const r0 = new Set(keysOf(core));
  sv.gradSeed = 0.37;
  core.grad.build(cl);
  const r1 = new Set(keysOf(core));
  assert.ok([...r1].some((k) => !r0.has(k)), 'other markers');
  void E;
});

test('a saved palette keeps its markers (fewer only with fewer sections); one that doesn’t go round the wheel is an open ramp', () => {
  const { core, sv, app } = appWith(['Honolulu 320 (complete set)']);
  const E = app.__eval, h = (m) => lchOf(E, m);
  const blues = core.coll.filter((m) => { const x = h(m); return x[1] >= 12 && x[2] > 230 && x[2] < 280; }).slice(0, 8);
  E(`state.saved = [{ id: 5, type: 'palette', name: 'Blues', keys: ${JSON.stringify(blues.map((m) => m.mkey))} }]`);
  E(`SF.configure({ listPalettes: () => state.saved, markerInfo: () => null })`);
  const cl = grid(core, 6, 4);
  Object.assign(sv, { family: 'gradient', paletteSource: 'saved', savedPalId: 5, expand: false, look: 'smooth', gradShape: 'vertical', limitN: 8, gradSeed: 0, dir: 1 });
  const plan = core.grad.plan(core.grad.poolSource(8), 24);
  assert.equal(plan.loop, false);
  assert.deepEqual([...plan.seq.map((m) => m.mkey)].sort(), [...blues.map((m) => m.mkey)].sort());
  core.grad.build(cl);
  assert.deepEqual([...new Set(keysOf(core))].sort(), [...blues.map((m) => m.mkey)].sort(), 'exactly its markers');
  // lightness runs one way along the ramp
  const L = plan.seq.map((m) => m.lab[0]);
  assert.ok(L[0] > L[L.length - 1]);
  const cl3 = grid(core, 3, 1);
  core.grad.build(cl3);
  assert.equal(new Set(keysOf(core)).size, 3, 'three sections: three of its markers');
});

test('Mood: filters your markers for every pattern, widening to the nearest when too few fit, and the line under it says so', () => {
  const { core, sv } = appWith(['Honolulu 320 (complete set)']);
  grid(core, 15, 14);
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'pastel', limitN: 999, look: 'auto', gradShape: 'diagonal' });
  const src = core.grad.poolSource(210);
  assert.ok(src.widened > 0 && src.items.length === 210);
  assert.match(core.poolMsg(), /^Pastel: \d+ of your markers are light; the rest are the next lightest$/);
  sv.emphasis = 'neutral';
  assert.equal(core.poolMsg(), 'From your 320 markers: one per section');
  sv.limitN = 16;
  assert.equal(core.poolMsg(), 'From your 320 markers');
  // Random picks the marker count from the Mood's markers
  Object.assign(sv, { family: 'random', emphasis: 'vivid', limitN: 12 });
  const pool = core.activePool();
  assert.equal(pool.length, 12);
  assert.ok(pool.every((m) => Math.hypot(m.lab[1], m.lab[2]) >= 45), 'all bright');
  sv.emphasis = 'neutral';
  sv.family = 'gradient';
});

test('demo mode (no markers owned) draws on the whole catalogue', () => {
  const { core, sv } = appWith([]);
  const cl = grid(core, 10, 10);
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 999, look: 'auto', gradShape: 'radial', gradSeed: 0, dir: 1 });
  core.grad.build(cl);
  assert.equal(new Set(keysOf(core)).size, 100);
  assert.ok(core.coll.length > 700);
});

test('speed: 3,600 sections and the whole catalogue (721 markers) lay out without freezing (a few seconds at most, even on a slow machine)', () => {
  const { core, sv } = appWith([]);
  const cl = grid(core, 60, 60, 8, 8);
  Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 999, gradSeed: 0, dir: 1 });
  for (const [look, shape] of [['smooth', 'diagonal'], ['auto', 'radial'], ['ltd', 'vertical']]) {
    Object.assign(sv, { look, gradShape: shape });
    // processor time: other test files running alongside slow the clock, not the work
    const t = cpuMs();
    core.grad.build(cl);
    const ms = Math.round(cpuMs() - t);
    // (v306: more sections than clear markers, so the clear ones, some used twice)
    const cnt = core.grad.count(core.grad.poolSource(3600, true), 3600);
    assert.ok(cnt.reuse);
    assert.equal(new Set(keysOf(core)).size, cnt.M, look);
    assert.ok(ms < 4000, `${look} ${shape}: ${ms}ms`);
  }
});

test('Random, Blend and Manual’s markers: colours first; a grey only when 12 or more are used, or when the Temperature and Mood leave mostly greys', () => {
  const { core, sv } = appWith(['Honolulu 120', '36 Gray Tones']);
  grid(core, 10, 10);
  const greys = (p) => p.filter(core.thinGreyM);
  Object.assign(sv, { family: 'random', paletteSource: 'owned', palette: 'all', emphasis: 'neutral' });
  assert.ok(greys(core.coll).length >= 30, 'a collection with plenty of greys');
  for (const n of [4, 6, 8, 11]) {
    sv.limitN = n;
    const p = core.activePool();
    assert.equal(p.length, n);
    assert.equal(greys(p).length, 0, n + ' markers: no greys');
  }
  for (const n of [12, 16, 24]) {
    sv.limitN = n;
    const p = core.activePool(), g = greys(p);
    assert.equal(p.length, n);
    assert.equal(g.length, 1, n + ' markers: one grey');
    // (spread through their lightness: not the black)
    assert.ok(g[0].lab[0] > 25, n + ': ' + g[0].code);
  }
  // only greys and a few colours to choose from: the greys make up the rest
  const { core: c2, sv: s2 } = appWith(['36 Gray Tones']);
  grid(c2, 10, 10);
  Object.assign(s2, { family: 'random', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 8 });
  const p2 = c2.activePool();
  assert.equal(p2.length, 8);
  assert.ok(p2.filter(c2.thinGreyM).length >= 4, 'mostly greys');
  // pastels and dark browns are colours, though their chroma is low
  const { core: c3 } = appWith(['48 Pastel - Sweetness', '36 Skin Tones']);
  const g3 = c3.coll.filter(c3.thinGreyM);
  assert.ok(g3.every((m) => /^(CG|WG|GG|BGY|YGY)/.test(m.code) || m.lab[0] > 96), g3.map((m) => m.code).join(' '));
  for (const k of ['E515', 'E514', 'R22', 'V32']) { const m = c3.coll.find((x) => x.code === k); if (m) assert.equal(c3.thinGreyM(m), false, k); }
  // Ciao 24's two greys: the one in the middle, not the black
  const { core: c4, sv: s4 } = appWith(['Ciao 24']);
  grid(c4, 10, 10);
  Object.assign(s4, { family: 'random', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 12 });
  const g4 = c4.activePool().filter(c4.thinGreyM);
  assert.equal(g4.length, 1);
  assert.notEqual(g4[0].code, '100', 'not the black');
  sv.limitN = 16;
  sv.family = 'gradient';
});
