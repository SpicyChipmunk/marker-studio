// The Gradient pattern’s engine.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpuMs, createApp } from './harness.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// ---- from gradient.test.mjs ----
// The Gradient pattern's engine (js/guide/30-palette-assign.js): which markers it picks, how it orders them (loop
// or ramp), how many go to a band (the Look), how sections are shared out by area, and that it stays quick with
// thousands of sections and the whole catalogue. The browser tests (e2e/gradient.test.mjs) cover the controls.
{
  // an app with these marker sets owned (none: the whole catalogue, as in demo mode), and the guide's collection
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    core.coll = E('sfCollection()');
    return { app, E, core, g: core.grad, sv: core.styleVars };
  }
  // a picture of cols × rows sections (each rw × rh pixels; widths[x] makes some columns wider), all counted
  function grid(core, cols, rows, rw = 20, rh = 20, widths = null) {
    const xs = [0];
    for (let x = 0; x < cols; x++) xs.push(xs[x] + (widths ? widths[x] : rw));
    const W = xs[cols],
      H = rows * rh,
      labels = new Int32Array(W * H),
      comps = [null];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const l = comps.length;
        comps.push({
          cx: (xs[x] + xs[x + 1]) / 2,
          cy: y * rh + rh / 2,
          area: (xs[x + 1] - xs[x]) * rh,
          merged: false,
          bg: false,
        });
        for (let py = y * rh; py < (y + 1) * rh; py++) labels.fill(l, py * W + xs[x], py * W + xs[x + 1]);
      }
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.comps = comps;
    core.secState = new Uint8Array(comps.length).fill(1);
    core.assignData = null;
    return core.countedList();
  }
  const lchOf = (E, m) => E(`lchOf(${JSON.stringify([...m.lab])})`);
  const keysOf = (core) => {
    const a = core.assignData;
    return a.order.map((l) => a.assign[l].mkey);
  };
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
    const coll = core.coll,
      h = (m) => lchOf(E, m);
    const col = coll.filter((m) => h(m)[1] >= 12);
    assert.equal(g.isLoop(col), true, 'your coloured markers go round the wheel');
    assert.equal(
      g.isLoop(
        col.filter((m) => {
          const x = h(m)[2];
          return x < 90 || x > 330;
        }),
      ),
      false,
      'warm only',
    );
    const red = col.filter((m) => {
      const x = h(m)[2];
      return x > 20 && x < 40;
    });
    assert.ok(red.length >= 3);
    assert.equal(g.isLoop(red), false, 'one hue');
    const two = col.filter((m) => {
      const x = h(m)[2];
      return (x > 60 && x < 80) || (x > 250 && x < 270);
    });
    assert.equal(g.isLoop(two), false, 'two opposite hues');
    assert.equal(g.isLoop(col.slice(0, 2)), false, 'fewer than three colours');
    assert.deepEqual([...g.hueGap([10, 20, 200])], [180, 2]);
    assert.deepEqual([...g.hueGap([10, 100, 200, 300])], [100, 2]);
  });
  test('which markers: coloured before greys, greys only when there aren’t enough coloured, the clearer mid-range ones with markers to spare', () => {
    const { g, core, E } = appWith(['Honolulu 320 (complete set)']);
    const coll = core.coll,
      h = (m) => lchOf(E, m);
    const col = coll.filter((m) => h(m)[1] >= 12),
      greys = coll.length - col.length;
    assert.ok(greys > 10, 'the set has greys');
    // plenty: the tightest tier (chroma 30+, lightness 42-84)
    const t16 = g.tierPool(coll, 16);
    assert.ok(
      t16.length >= 16 &&
        t16.every((m) => {
          const x = h(m);
          return x[1] >= 30 && x[0] >= 42 && x[0] <= 84;
        }),
    );
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
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      gradSeed: 0,
      dir: 1,
    });
    for (const look of ['auto', 'smooth', 'ltd'])
      for (const shape of ['diagonal', 'radial', 'serpentine', 'vertical']) {
        Object.assign(sv, { look, gradShape: shape, limitN: 999 });
        core.grad.build(cl);
        const k = keysOf(core);
        assert.equal(k.length, 210);
        // (v306: with more sections than clear markers, the clear ones, some used twice, rather than greys)
        const cnt = core.grad.count(core.grad.poolSource(210, true), 210);
        assert.equal(
          new Set(k).size,
          cnt.reuse ? cnt.M : 210,
          `${look} ${shape}: every section its own marker`,
        );
        const a = core.assignData;
        assert.equal(
          a.order.filter((l) => Math.hypot(a.assign[l].lab[1], a.assign[l].lab[2]) < 12).length,
          0,
          'no greys',
        );
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
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      gradSeed: 0,
      dir: 1,
      look: 'smooth',
      gradShape: 'vertical',
      limitN: 40,
    });
    core.grad.build(cl);
    const a = core.assignData,
      seq = a.order.map((l) => [...a.assign[l].lab]);
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
    const reds = core.coll.filter((m) => {
      const x = h(m);
      return x[1] >= 12 && x[2] > 10 && x[2] < 50;
    });
    const seq = g.sequence(reds, 1, false),
      L = seq.map((m) => m.lab[0]);
    assert.ok(L[0] >= L[L.length - 1], 'lighter end first');
    // a ramp's steps are much smaller than a loop's over the same markers (the loop has to come back)
    const D = g.deMatrix(reds),
      n = reds.length;
    const open = g.tour(D, n, true),
      closed = g.tour(D, n, false);
    const run = (t) => t.slice(1).reduce((s, x, i) => s + D[t[i] * n + x], 0);
    assert.ok(run(open) < run(closed) + 1e-6);
    assert.deepEqual(
      [...open].sort((a, b) => a - b),
      [...Array(n).keys()],
      'a tour visits each once',
    );
    // 700 colours: stops improving at a budget of steps (v306: counted, not on the clock), keeping the best so far. (The speed limits here and below catch a
    // slowdown of several times, not the difference between machines: GitHub's runners are 2-3 times slower than ours.)
    const all = appWith([]).core.coll;
    assert.ok(all.length > 700);
    // (the differences are timed in processor time, which other tests running alongside don't inflate; so is the tour)
    const big = all.slice(0, 700),
      c0 = cpuMs(),
      DB = g.deMatrix(big),
      c1 = cpuMs(),
      t1 = cpuMs(),
      tb = g.tour(DB, 700, false),
      t2 = cpuMs();
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
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      gradSeed: 0,
      dir: 1,
      look: 'smooth',
      gradShape: 'vertical',
      limitN: 8,
    });
    core.grad.build(cl);
    const a = core.assignData,
      c = core.comps,
      per = {};
    let tot = 0;
    a.order.forEach((l) => {
      const k = a.assign[l].mkey;
      per[k] = (per[k] || 0) + c[l].area;
      tot += c[l].area;
    });
    const share = Object.values(per).map((x) => x / tot);
    assert.equal(share.length, 8);
    // by count each marker would get 12 sections: 3 columns of 60 or 1 of 60 and 2 of 10 (a 3:1 range at best);
    // by area they're within a column's width of an eighth
    assert.ok(
      Math.max(...share) / Math.min(...share) < 1.8,
      share.map((x) => (100 * x).toFixed(1)).join(' '),
    );
    // the split itself: shares and minimums
    const s = core.grad.splitByArea(cl, [1, 1, 1, 1], [1, 1, 1, 1]);
    assert.equal(s.flat().length, cl.length);
    const s2 = core.grad.splitByArea(cl.slice(0, 5), [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]);
    assert.deepEqual(
      [...s2].map((x) => x.length),
      [1, 1, 1, 1, 1],
      'as many parts as items: one each',
    );
  });
  test('Light to dark: each band runs light to dark across the flow, light at the top, or facing the sun when there’s shading', () => {
    const { core, sv } = appWith(['Honolulu 320 (complete set)']);
    const cl = grid(core, 12, 12);
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      gradSeed: 0,
      dir: 1,
      look: 'ltd',
      gradShape: 'vertical',
      limitN: 144,
      shadeMode: 'off',
    });
    // mean lightness of the top and bottom rows
    const rows = () => {
      const a = core.assignData,
        c = core.comps,
        top = [],
        bot = [];
      a.order.forEach((l) => {
        if (c[l].cy < 40) top.push(a.assign[l].lab[0]);
        if (c[l].cy > 200) bot.push(a.assign[l].lab[0]);
      });
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
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      dir: 1,
      look: 'smooth',
      gradShape: 'vertical',
      limitN: 12,
      gradSeed: 0,
    });
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
    assert.ok(
      [...r1].some((k) => !r0.has(k)),
      'other markers',
    );
    void E;
  });
  test('a saved palette keeps its markers (fewer only with fewer sections); one that doesn’t go round the wheel is an open ramp', () => {
    const { core, sv, app } = appWith(['Honolulu 320 (complete set)']);
    const E = app.__eval,
      h = (m) => lchOf(E, m);
    const blues = core.coll
      .filter((m) => {
        const x = h(m);
        return x[1] >= 12 && x[2] > 230 && x[2] < 280;
      })
      .slice(0, 8);
    E(
      `state.saved = [{ id: 5, type: 'palette', name: 'Blues', keys: ${JSON.stringify(blues.map((m) => m.mkey))} }]`,
    );
    E(`SF.configure({ listPalettes: () => state.saved, markerInfo: () => null })`);
    const cl = grid(core, 6, 4);
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'saved',
      savedPalId: 5,
      expand: false,
      look: 'smooth',
      gradShape: 'vertical',
      limitN: 8,
      gradSeed: 0,
      dir: 1,
    });
    const plan = core.grad.plan(core.grad.poolSource(8), 24);
    assert.equal(plan.loop, false);
    assert.deepEqual([...plan.seq.map((m) => m.mkey)].sort(), [...blues.map((m) => m.mkey)].sort());
    core.grad.build(cl);
    assert.deepEqual(
      [...new Set(keysOf(core))].sort(),
      [...blues.map((m) => m.mkey)].sort(),
      'exactly its markers',
    );
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
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'pastel',
      limitN: 999,
      look: 'auto',
      gradShape: 'diagonal',
    });
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
    assert.ok(
      pool.every((m) => Math.hypot(m.lab[1], m.lab[2]) >= 45),
      'all bright',
    );
    sv.emphasis = 'neutral';
    sv.family = 'gradient';
  });
  test('demo mode (no markers owned) draws on the whole catalogue', () => {
    const { core, sv } = appWith([]);
    const cl = grid(core, 10, 10);
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      limitN: 999,
      look: 'auto',
      gradShape: 'radial',
      gradSeed: 0,
      dir: 1,
    });
    core.grad.build(cl);
    assert.equal(new Set(keysOf(core)).size, 100);
    assert.ok(core.coll.length > 700);
  });
  test('speed: 3,600 sections and the whole catalogue (721 markers) lay out without freezing (a few seconds at most, even on a slow machine)', () => {
    const { core, sv } = appWith([]);
    const cl = grid(core, 60, 60, 8, 8);
    Object.assign(sv, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      limitN: 999,
      gradSeed: 0,
      dir: 1,
    });
    for (const [look, shape] of [
      ['smooth', 'diagonal'],
      ['auto', 'radial'],
      ['ltd', 'vertical'],
    ]) {
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
      const p = core.activePool(),
        g = greys(p);
      assert.equal(p.length, n);
      assert.equal(g.length, 1, n + ' markers: one grey');
      // (spread through their lightness: not the black)
      assert.ok(g[0].lab[0] > 25, n + ': ' + g[0].code);
    }
    // only greys and a few colours to choose from: the greys make up the rest
    const { core: c2, sv: s2 } = appWith(['36 Gray Tones']);
    grid(c2, 10, 10);
    Object.assign(s2, {
      family: 'random',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      limitN: 8,
    });
    const p2 = c2.activePool();
    assert.equal(p2.length, 8);
    assert.ok(p2.filter(c2.thinGreyM).length >= 4, 'mostly greys');
    // pastels and dark browns are colours, though their chroma is low
    const { core: c3 } = appWith(['48 Pastel - Sweetness', '36 Skin Tones']);
    const g3 = c3.coll.filter(c3.thinGreyM);
    assert.ok(
      g3.every((m) => /^(CG|WG|GG|BGY|YGY)/.test(m.code) || m.lab[0] > 96),
      g3.map((m) => m.code).join(' '),
    );
    for (const k of ['E515', 'E514', 'R22', 'V32']) {
      const m = c3.coll.find((x) => x.code === k);
      if (m) assert.equal(c3.thinGreyM(m), false, k);
    }
    // Ciao 24's two greys: the one in the middle, not the black
    const { core: c4, sv: s4 } = appWith(['Ciao 24']);
    grid(c4, 10, 10);
    Object.assign(s4, {
      family: 'random',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      limitN: 12,
    });
    const g4 = c4.activePool().filter(c4.thinGreyM);
    assert.equal(g4.length, 1);
    assert.notEqual(g4[0].code, '100', 'not the black');
    sv.limitN = 16;
    sv.family = 'gradient';
  });
}

// ---- from v305-gradient.test.mjs ----
// v305 (the Gradient, 30-palette-assign): a smoothing pass after the Gradient is laid swaps the markers of sections near
// each other along the flow where that lowers the clash between touching sections, with guards so the gradient stays
// as laid: each marker moves at most a window (sections / 30, 2 to 12) from its place; the flow's first section keeps
// the Start colour; with several sections to a marker only sections of about the same size swap (each marker keeps
// its share of the picture); with the marker count at all your markers no new pair of touching sections shares one;
// pinned sections and those with ink on the paper stay. Deterministic (a fixed number of passes, no clock), quick, and
// the Gradient's own (not the Photo pattern before it has a photo, nor Random or Blend). And a fifth Flow, Around:
// round Radial's centre, out and back when the markers don't go right round the colour wheel, so there's no seam.
{
  // an app with Ben's own markers (defaultOwned: 451), or these sets, owned
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    if (sets) {
      E('state.owned = new Set()');
      for (const n of sets)
        E(
          `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
        );
    } else E('state.owned = new Set(defaultOwned())');
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, E, t };
  }
  // cols × rows sections of uneven sizes (from a seed), lines lw px between them; ready to build
  function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
      ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
      hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
      W = ws.reduce((a, b) => a + b + lw, lw),
      H = hs.reduce((a, b) => a + b + lw, lw),
      labels = new Int32Array(W * H).fill(-1),
      comps = [null];
    let y0 = lw;
    for (let rr = 0; rr < rows; rr++) {
      let x0 = lw;
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          w = ws[c],
          h = hs[rr];
        comps.push({
          area: w * h,
          bg: false,
          bpx: 0,
          cx: x0 + w / 2,
          cy: y0 + h / 2,
          h: h - 1,
          x0,
          y0,
          x1: x0 + w - 1,
          y1: y0 + h - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
        x0 += w + lw;
      }
      y0 += hs[rr] + lw;
    }
    return ready(t, W, H, labels, comps);
  }
  function ready(t, W, H, labels, comps) {
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    for (const k in t.locks) delete t.locks[k];
    return t.countedList();
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'gradient',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        gradSeed: 0,
        dir: 1,
        look: 'auto',
        gradShape: 'serpentine',
        limitN: 999,
        shadeMode: 'off',
      },
      o,
    );
  // the Gradient as laid before smoothing (the Photo pattern before it has a photo lays it, unsmoothed)
  function unsmoothed(t, cl) {
    const f = t.styleVars.family;
    t.styleVars.family = 'photo';
    t.grad.build(cl);
    t.styleVars.family = f;
    return keys(t);
  }
  const keys = (t) => {
    const a = t.assignData;
    return a.order.map((l) => a.assign[l].mkey);
  };
  // touching pairs: the sum of their differences squared, and the pairs sharing a marker ("l-q")
  function clash(app, t) {
    const a = t.adj,
      A = t.assignData.assign,
      same = new Set();
    let sum = 0;
    for (const k in a)
      a[k].forEach((q) => {
        const l = +k;
        if (q <= l || !A[l] || !A[q]) return;
        const d = app.de2000(A[l].lab, A[q].lab);
        sum += d * d;
        if (A[l].mkey === A[q].mkey) same.add(l + '-' + q);
      });
    return { sum, same };
  }
  // Spearman's rank correlation of a list of numbers with 0, 1, 2…
  function rankCorr(xs) {
    const n = xs.length,
      r = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]),
      rk = new Array(n);
    r.forEach((p, k) => (rk[p[1]] = k));
    let d = 0;
    for (let i = 0; i < n; i++) d += (rk[i] - i) ** 2;
    return 1 - (6 * d) / (n * (n * n - 1));
  }
  test('smoothing: touching sections clash less, the flow’s first section keeps the Start colour, no marker moves past its window', () => {
    const { app, t } = appWith();
    const cl = page(t, 15, 14);
    for (const shape of ['serpentine', 'diagonal', 'radial', 'around']) {
      for (const [n, seed] of [
        [999, 0],
        [48, 0.37],
      ]) {
        style(t, { gradShape: shape, limitN: n, gradSeed: seed });
        const before = unsmoothed(t, cl),
          c0 = clash(app, t).sum;
        t.grad.build(cl);
        const after = keys(t),
          c1 = clash(app, t).sum,
          s = t.grad.smoothed,
          what = `${shape} ${n}`;
        assert.ok(s && s.swaps > 0, what + ': smoothed');
        assert.ok(c1 < c0 * 0.95, `${what}: clash ${Math.round(c0)} -> ${Math.round(c1)}`);
        assert.equal(after[0], before[0], what + ': the first section keeps the Start colour');
        assert.equal(s.win, 7, '210 sections: a window of 7');
        assert.ok(s.moved <= s.win, what + ': moved ' + s.moved);
        // (each marker of the one-per-section layout is within the window of where the flow put it)
        if (n === 999)
          after.forEach((k, i) =>
            assert.ok(
              Math.abs(before.indexOf(k) - i) <= s.win,
              `${what}: ${k} moved ${before.indexOf(k) - i}`,
            ),
          );
        // the same markers in all
        assert.deepEqual([...after].sort(), [...before].sort(), what);
      }
    }
  });
  test('smoothing: with several sections to a marker each marker keeps its share of the picture', () => {
    const { app, t } = appWith();
    const cl = page(t, 15, 14, 24, 2, 7);
    for (const shape of ['serpentine', 'diagonal', 'radial']) {
      style(t, { gradShape: shape, limitN: 16 });
      const share = () => {
        const a = t.assignData,
          per = {};
        let tot = 0;
        a.order.forEach((l) => {
          per[a.assign[l].mkey] = (per[a.assign[l].mkey] || 0) + t.comps[l].area;
          tot += t.comps[l].area;
        });
        for (const k in per) per[k] /= tot;
        return per;
      };
      unsmoothed(t, cl);
      const s0 = share(),
        c0 = clash(app, t).sum;
      t.grad.build(cl);
      const s1 = share();
      assert.ok(t.grad.smoothed.swaps > 0 && clash(app, t).sum < c0, shape + ': smoothed');
      // each marker within a fifth of its share either way (a swap is between sections within 1.5× of each other's area)
      for (const k in s0)
        assert.ok(
          Math.abs(s1[k] - s0[k]) <= s0[k] * 0.2,
          `${shape} ${k}: ${(100 * s0[k]).toFixed(2)}% -> ${(100 * s1[k]).toFixed(2)}%`,
        );
    }
  });
  test('smoothing: the same settings lay the same markers every time (no clock), in a fresh app too', () => {
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const { t } = appWith();
      const cl = page(t, 40, 43);
      for (const [shape, n] of [
        ['serpentine', 999],
        ['radial', 48],
        ['around', 999],
      ]) {
        style(t, { gradShape: shape, limitN: n });
        t.grad.build(cl);
        const a = keys(t).join();
        t.grad.build(cl);
        assert.equal(keys(t).join(), a, shape + ': again');
        runs.push(a);
      }
    }
    assert.deepEqual(runs.slice(0, 3), runs.slice(3));
  });
  test('smoothing: pinned sections and ticked ones keep their markers; Build again keeps the guide as it was', () => {
    const { t } = appWith();
    const cl = page(t, 15, 14);
    style(t, { gradShape: 'diagonal', limitN: 999 });
    t.assign.buildGuide();
    assert.equal(t.sfmode, 'guide');
    const A = () => t.assignData.assign;
    // pins: a marker unlike its neighbours' on every tenth section, ticks on every seventh
    const pins = {},
      ticks = {};
    cl.forEach((l, i) => {
      if (i % 10 === 5) pins[l] = A()[cl[(i + 100) % cl.length]].mkey;
      else if (i % 7 === 3) ticks[l] = A()[l].mkey;
    });
    Object.assign(t.locks, pins);
    for (const l in ticks) t.colored[l] = 1;
    // a change to the plan lays it again
    t.styleVars.gradSeed = 0.4;
    t.reassign();
    assert.ok(t.grad.smoothed.swaps > 0, 'smoothed');
    for (const l in pins) assert.equal(A()[l].mkey, pins[l], 'pinned ' + l);
    for (const l in ticks) assert.equal(A()[l].mkey, ticks[l], 'ticked ' + l);
    // Build again with nothing changed (as after Edit sections): every section keeps its marker
    const was = JSON.stringify(keys(t));
    t.assign.sfmode = 'review';
    t.assign.buildGuide();
    assert.equal(JSON.stringify(keys(t)), was);
  });
  test('smoothing with the marker count at all your markers: no new pair of touching sections shares a marker', () => {
    const { app, t } = appWith(['Honolulu 120']);
    // more sections than markers (so markers repeat), and fewer
    for (const [cols, rows] of [
      [20, 14],
      [9, 9],
    ]) {
      const cl = page(t, cols, rows);
      for (const shape of ['serpentine', 'diagonal', 'radial', 'around']) {
        style(t, { gradShape: shape, limitN: 999 });
        unsmoothed(t, cl);
        const b = clash(app, t);
        t.grad.build(cl);
        const a = clash(app, t);
        // (v306: with more sections than clear markers, some used twice, touching ones sharing a marker count as a
        // clash too: fewer of those, rather than less clash by colour alone)
        // (v307: and none left at all, by the pass after the smoothing; the Photo pattern before it has a photo, laid
        // here as the base, has its repeats split up too now)
        if (t.grad.smoothed.mode === 'reuse') assert.equal(a.same.size, 0, shape + ': split up');
        else assert.ok(t.grad.smoothed.swaps > 0 && a.sum < b.sum, shape + ': smoothed');
        const added = [...a.same].filter((p) => !b.same.has(p));
        assert.deepEqual(added, [], `${cl.length} ${shape}: new pairs sharing a marker`);
        // (v306: unless there are more sections than clear markers, which are then used twice: gradCount's reuse)
        if (cl.length <= t.coll.length && !t.grad.count(t.grad.poolSource(cl.length, true), cl.length).reuse)
          assert.equal(a.same.size, 0, 'one marker each: none share');
      }
    }
  });
  test('smoothing on a small page (37 sections) keeps its gradient: a window of 2', () => {
    const { t } = appWith();
    // 37 sections: 7 × 6 with five left out
    page(t, 7, 6);
    [3, 11, 19, 30, 40].forEach((l) => (t.secState[l] = 2));
    const cl = t.countedList();
    assert.equal(cl.length, 37);
    for (const shape of ['serpentine', 'diagonal', 'radial', 'around']) {
      style(t, { gradShape: shape, limitN: 999 });
      const before = unsmoothed(t, cl);
      t.grad.build(cl);
      const s = t.grad.smoothed;
      assert.equal(s.win, 2);
      assert.ok(s.swaps > 0, shape + ': smoothed');
      const corr = rankCorr(keys(t).map((k) => before.indexOf(k)));
      assert.ok(corr >= 0.97, `${shape}: the flow's order kept, rank correlation ${corr.toFixed(3)}`);
    }
  });
  test('smoothing: the Gradient’s own — the Photo pattern before it has a photo lays its gradient unsmoothed', () => {
    const { t } = appWith();
    const cl = page(t, 15, 14);
    style(t, { family: 'photo' });
    t.grad.build(cl);
    assert.equal(t.grad.smoothed, null);
    style(t, { family: 'gradient' });
    t.grad.build(cl);
    assert.ok(t.grad.smoothed);
  });
  test('smoothing is quick: 1,720 sections and Ben’s 451 markers, one each and 48', () => {
    const { t } = appWith();
    const cl = page(t, 40, 43, 16);
    assert.equal(cl.length, 1720);
    for (const [shape, n] of [
      ['serpentine', 999],
      ['diagonal', 999],
      ['radial', 48],
      ['around', 999],
    ]) {
      style(t, { gradShape: shape, limitN: n });
      unsmoothed(t, cl);
      let c = cpuMs();
      t.grad.build(cl);
      t.styleVars.family = 'photo';
      const withS = cpuMs() - c;
      c = cpuMs();
      t.grad.build(cl);
      const without = cpuMs() - c;
      t.styleVars.family = 'gradient';
      // (processor time, not the clock: other test files running alongside slow the clock, not the work)
      assert.ok(withS - without < 600, `${shape} ${n}: smoothing took ${Math.round(withS - without)} ms`);
    }
  });
  test('Around: round the centre clockwise from the top; out and back when the markers don’t go round the wheel, so no seam', () => {
    const { app, t } = appWith();
    // a ring of 48 wedges round the middle of a 400 × 400 picture, a line between each
    const W = 400,
      H = 400,
      K = 48,
      labels = new Int32Array(W * H).fill(-1),
      comps = [null];
    for (let k = 0; k < K; k++)
      comps.push({
        area: 0,
        bg: false,
        bpx: 0,
        cx: 0,
        cy: 0,
        x0: W,
        y0: H,
        x1: 0,
        y1: 0,
        h: 0,
        merged: false,
      });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - 200, y - 200);
        if (r < 60 || r > 190) continue;
        let a = Math.atan2(y - 200, x - 200) + Math.PI / 2;
        if (a < 0) a += 2 * Math.PI;
        const f = (a / (2 * Math.PI)) * K,
          k = Math.floor(f) % K;
        if (f - Math.floor(f) < 0.06) continue;
        const c = comps[k + 1];
        labels[y * W + x] = k + 1;
        c.area++;
        c.cx += x;
        c.cy += y;
        c.x0 = Math.min(c.x0, x);
        c.x1 = Math.max(c.x1, x);
        c.y0 = Math.min(c.y0, y);
        c.y1 = Math.max(c.y1, y);
      }
    comps.forEach((c) => c && ((c.cx /= c.area), (c.cy /= c.area), (c.h = c.y1 - c.y0)));
    const cl = ready(t, W, H, labels, comps);
    style(t, { gradShape: 'around', limitN: 24, look: 'smooth' });
    assert.deepEqual([...t.grad.order(cl)], [...cl], 'clockwise from the top, the wedges in turn');
    t.styleVars.dir = -1;
    assert.deepEqual([...t.grad.order(cl)], [...cl].reverse(), 'Reversed: anticlockwise');
    t.styleVars.dir = 1;
    // the step between the last wedge and the first (where the flow comes round), and the biggest step anywhere
    const steps = () => {
      const A = t.assignData.assign,
        d = (l, q) => app.de2000(A[l].lab, A[q].lab);
      let mx = 0;
      for (let i = 1; i < K; i++) mx = Math.max(mx, d(cl[i - 1], cl[i]));
      return { seam: d(cl[K - 1], cl[0]), mx };
    };
    for (const palette of ['warm', 'cool']) {
      style(t, { gradShape: 'around', limitN: 24, look: 'smooth', palette });
      assert.equal(t.grad.plan(t.grad.poolSource(24), K).loop, false, palette + ': an open ramp');
      t.grad.build(cl);
      const s = steps();
      assert.ok(s.seam < 25, `${palette}: the seam ${s.seam.toFixed(1)}`);
      assert.ok(s.mx < 30, `${palette}: the biggest step ${s.mx.toFixed(1)}`);
      // (straight round, the ramp's two ends would meet there)
      t.styleVars.family = 'photo';
      const plan = t.grad.plan(t.grad.poolSource(24), K).seq;
      assert.ok(
        app.de2000(plan[0].lab, plan[plan.length - 1].lab) > 40,
        palette + ': the ramp’s ends are far apart',
      );
      t.styleVars.family = 'gradient';
    }
    // the markers right round the wheel: a loop, not turned out and back
    style(t, { gradShape: 'around', limitN: 24, look: 'smooth' });
    const p = t.grad.plan(t.grad.poolSource(24), K);
    assert.equal(p.loop, true);
    t.grad.build(cl);
    const first = t.assignData.assign[cl[0]].mkey;
    assert.equal(first, p.seq[0].mkey, 'starts with the Start colour');
    assert.deepEqual([...t.grad.outAndBack([1, 2, 3, 4, 5, 6])], [1, 3, 5, 6, 4, 2]);
  });
  test('Around is a Flow a saved guide can have (an unknown flow still opens as Serpentine)', () => {
    const { t } = appWith();
    const f = t.styleFields.find((x) => x.key === 'gradShape');
    assert.equal(f.check('around', 'serpentine'), 'around');
    assert.equal(f.check('spiral', 'serpentine'), 'serpentine');
  });
}

// ---- from v306-colour.test.mjs ----
// v306 (the Gradient's colours, 30-palette-assign): Scatter, five stops (Polished, Natural, Textured, Sparkle,
// Confetti); "all" on a page with more sections than your clear markers lays the clear ones twice rather than greys
// (U6); shading-aware base picks (U7); rough spots and "Smooth them" (gradFix); Blend's anchors added by a tap.
{
  // an app with Ben's own markers (defaultOwned: 451), or these sets, owned
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    if (sets) {
      E('state.owned = new Set()');
      for (const n of sets)
        E(
          `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
        );
    } else E('state.owned = new Set(defaultOwned())');
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, E, t };
  }
  // cols × rows sections of uneven sizes (from a seed), lines lw px between them; ready to build
  function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
      ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
      hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
      W = ws.reduce((a, b) => a + b + lw, lw),
      H = hs.reduce((a, b) => a + b + lw, lw),
      labels = new Int32Array(W * H).fill(-1),
      comps = [null];
    let y0 = lw;
    for (let rr = 0; rr < rows; rr++) {
      let x0 = lw;
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          w = ws[c],
          h = hs[rr];
        comps.push({
          area: w * h,
          bg: false,
          bpx: 0,
          cx: x0 + w / 2,
          cy: y0 + h / 2,
          h: h - 1,
          x0,
          y0,
          x1: x0 + w - 1,
          y1: y0 + h - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
        x0 += w + lw;
      }
      y0 += hs[rr] + lw;
    }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    for (const k in t.locks) delete t.locks[k];
    return t.countedList();
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'gradient',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        gradSeed: 0,
        gradScat: 0,
        gradJit: 0,
        gradFix: false,
        dir: 1,
        look: 'auto',
        gradShape: 'serpentine',
        limitN: 999,
        shadeMode: 'off',
      },
      o,
    );
  const keys = (t) => t.assignData.order.map((l) => t.assignData.assign[l].mkey);
  const byKey = (t) => Object.fromEntries(t.coll.map((m) => [m.mkey, m]));
  // touching sections sharing a marker
  function same(t) {
    const a = t.adj || t.colour.adj(),
      A = t.assignData.assign;
    let n = 0;
    for (const k in a)
      a[k].forEach((q) => {
        if (q > +k && A[k] && A[q] && A[k].mkey === A[q].mkey) n++;
      });
    return n;
  }
  const field = (t, k) => [...t.styleFields].find((f) => f.key === k);
  // ---- Scatter ----

  test('Scatter: five stops; Polished is v305 (smoothed), Natural the same without smoothing, and the others mix the same markers', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    for (const shape of ['serpentine', 'radial', 'around', 'diagonal']) {
      const lay = (sc, o = {}) => {
        style(t, { gradShape: shape, gradScat: sc, gradJit: 0.3, ...o });
        t.grad.build(cl);
        return keys(t);
      };
      const pol = lay(0);
      assert.ok(t.grad.smoothed && t.grad.smoothed.swaps > 0, shape + ': Polished is smoothed');
      // (the Photo pattern before it has a photo lays the Gradient unsmoothed, as v304 did)
      const v304 = lay(0, { family: 'photo' });
      const nat = lay(1);
      assert.equal(t.grad.smoothed, null, shape + ': Natural isn’t smoothed');
      assert.deepEqual(nat, v304, shape + ': Natural is the Gradient as laid');
      const stops = [pol, nat];
      for (const sc of [2, 3, 4]) {
        const k = lay(sc);
        assert.ok(t.grad.scattered, shape + ' ' + sc + ': scattered');
        assert.equal(k[0], nat[0], `${shape} ${sc}: the flow's first section keeps the Start colour`);
        assert.deepEqual([...k].sort(), [...nat].sort(), `${shape} ${sc}: the same markers`);
        assert.deepEqual(lay(sc), k, `${shape} ${sc}: laid again, the same`);
        stops.push(k);
      }
      // every stop differs from the one before
      for (let i = 1; i < 5; i++) assert.notDeepEqual(stops[i], stops[i - 1], `${shape}: stop ${i}`);
      // Sparkle and Confetti stray; Textured doesn't (beyond Radial's rings, which move as one)
      const sp = (sc) => (lay(sc), t.grad.scattered);
      assert.ok(sp(3).stray1 > 0.2 && sp(4).stray2 > 0.1, shape + ': strays');
      // a new seed (Shuffle at Textured and up) mixes them again
      assert.notDeepEqual(lay(3, { gradJit: 0.71 }), lay(3), shape + ': another seed');
    }
  });
  test('Scatter: Around runs round as a loop for its strays, its two ends meeting (a warm set too, laid out and back)', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, { gradShape: 'around', gradScat: 4, palette: 'warm' });
    t.grad.build(cl);
    assert.equal(t.grad.scattered.loop, true);
    style(t, { gradShape: 'serpentine', gradScat: 4, palette: 'warm' });
    t.grad.build(cl);
    assert.equal(t.grad.scattered.loop, false, 'a ramp on Serpentine is turned back at its ends');
  });
  test('Scatter: below 9 markers it stays Polished (two colour bands made Sparkle and Confetti the same)', () => {
    const { t } = appWith();
    const cl = page(t, 15, 14);
    style(t, { limitN: 8, gradScat: 0 });
    t.grad.build(cl);
    const pol = keys(t);
    for (const sc of [1, 3, 4]) {
      style(t, { limitN: 8, gradScat: sc, gradJit: 0.5 });
      t.grad.build(cl);
      assert.deepEqual(keys(t), pol, 'at ' + sc);
      assert.equal(t.grad.scattered, null);
    }
    style(t, { limitN: 9, gradScat: 4 });
    assert.equal(t.grad.countNow().M, 9);
    assert.equal(t.grad.scatAt(9), 4);
    assert.equal(t.grad.scatAt(8), 0);
    // only the Gradient scatters (not the Photo pattern before it has a photo)
    t.styleVars.family = 'photo';
    assert.equal(t.grad.scatAt(40), 0);
  });
  test('Scatter: a scattered guide isn’t marked as facing the light, so moving the sun never lays it again', () => {
    const { t } = appWith();
    const cl = page(t, 15, 14);
    for (const sc of [0, 1, 2, 3, 4]) {
      style(t, { gradShape: 'vertical', look: 'ltd', limitN: 48, gradScat: sc });
      t.grad.build(cl);
      assert.equal(!!t.assignData.lit, sc < 2, 'stop ' + sc);
    }
  });
  test('Scatter: the Look note says Scatter places the markers from Textured up; below that it says what Auto does', () => {
    const { t } = appWith();
    page(t, 15, 14);
    style(t, { gradShape: 'radial', limitN: 999, gradScat: 0 });
    assert.match(t.lookNote(), /^Auto: light to dark/);
    t.styleVars.gradScat = 1;
    assert.match(t.lookNote(), /^Auto: light to dark/);
    t.styleVars.gradScat = 3;
    assert.match(t.lookNote(), /^Auto: markers picked for bands of \d+; Scatter places them\.$/);
    style(t, { gradShape: 'serpentine', gradScat: 2 });
    assert.equal(t.lookNote(), 'Auto: markers picked for a smooth run; Scatter places them.');
    // (only with 9 or more markers, when it scatters at all)
    t.styleVars.limitN = 6;
    assert.equal(t.lookNote(), 'Auto: smooth, as Serpentine runs in rows.');
  });
  test('Scatter’s saved settings: written only when used (gradScat at Natural and up, gradJit from Textured, gradFix when on); kept by Undo', () => {
    const { t } = appWith();
    const sv = t.styleVars,
      saved = () => ['gradScat', 'gradJit', 'gradFix'].map((k) => field(t, k).save());
    Object.assign(sv, { gradScat: 0, gradJit: 0.4, gradFix: false });
    assert.deepEqual(saved(), [undefined, undefined, undefined]);
    sv.gradScat = 1;
    assert.deepEqual(saved(), [1, undefined, undefined]);
    Object.assign(sv, { gradScat: 3, gradFix: true });
    assert.deepEqual(saved(), [3, 0.4, true]);
    // (the defaults: what an older guide, which says nothing, opens with)
    assert.deepEqual(
      ['gradScat', 'gradJit', 'gradFix'].map((k) => field(t, k).check(undefined, field(t, k).def)),
      [0, 0, false],
    );
    assert.equal(field(t, 'gradScat').check(7.4, 0), 4);
    assert.equal(field(t, 'gradScat').check(2.4, 0), 2);
    // all three kept by Undo
    assert.ok(['gradScat', 'gradJit', 'gradFix'].every((k) => field(t, k).undo));
  });
  // ---- U6: "all" on a page with more sections than your clear markers ----

  test('U6: with the count at all, more sections than clear markers lays the 268 clear ones, some twice, no greys; touching ones rarely share', () => {
    const { app, t } = appWith();
    const cl = page(t, 24, 20); // 480 sections
    for (const shape of ['serpentine', 'radial', 'around']) {
      for (const sc of [0, 1, 3]) {
        style(t, { gradShape: shape, gradScat: sc, gradJit: 0.2 });
        const c = t.grad.count(t.grad.poolSource(480, true), 480);
        assert.deepEqual({ ...c }, { M: 268, reuse: true });
        t.grad.build(cl);
        const A = t.assignData.assign,
          ks = new Set(keys(t));
        assert.equal(ks.size, 268, `${shape} ${sc}: every clear marker`);
        for (const l of t.assignData.order) {
          const x = t.colour.lch(A[l]);
          assert.ok(x[1] >= 20 && x[0] >= 34 && x[0] <= 90, `${shape} ${sc}: ${A[l].code} is clear`);
        }
        // the touching-repeat penalty: at Polished as a clash, at Natural and Scatter split up on its own
        assert.equal(t.grad.smoothed.mode, sc === 0 ? 'reuse' : 'split');
        assert.ok(same(t) <= 6, `${shape} ${sc}: ${same(t)} touching pairs share a marker`);
      }
    }
    void app;
  });
  test('U6: Ben’s 216-section pages are laid as before; the Earthy, Soft and Deep Moods, a lower count and a palette aren’t changed', () => {
    const { t } = appWith();
    let cl = page(t, 18, 12); // 216
    style(t, {});
    assert.deepEqual({ ...t.grad.count(t.grad.poolSource(216, true), 216) }, { M: 216, reuse: false });
    t.grad.build(cl);
    assert.equal(new Set(keys(t)).size, 216);
    assert.equal(t.grad.smoothed.mode, '');
    cl = page(t, 24, 20); // 480
    for (const emphasis of ['earthy', 'muted', 'deep', 'pastel']) {
      style(t, { emphasis });
      assert.equal(t.grad.count(t.grad.poolSource(480, true), 480).reuse, false, emphasis);
    }
    style(t, { limitN: 300 });
    assert.deepEqual({ ...t.grad.count(t.grad.poolSource(300, true), 480) }, { M: 300, reuse: false });
    void cl;
  });
  test('U6: the marker count says how many the Gradient lays: “all · 216”, “all · 268” (v308: a count at or over the slider’s end, the smaller of the sections and markers, reads as all)', () => {
    const { t } = appWith();
    page(t, 18, 12);
    style(t, {});
    assert.equal(t.grad.mkCountLabel(), 'all · 216');
    // (v308: 300 on a 216-section page is at the slider's end: all; it said "300 · 216 used")
    t.styleVars.limitN = 300;
    assert.equal(t.grad.mkCountLabel(), 'all · 216');
    t.styleVars.limitN = 16;
    assert.equal(t.grad.mkCountLabel(), '16');
    page(t, 24, 20);
    t.styleVars.limitN = 999;
    assert.equal(t.grad.mkCountLabel(), 'all · 268');
    // (Random takes the count's worth: all of the 451, fewer than the 480 sections)
    t.styleVars.family = 'random';
    assert.equal(t.grad.mkCountLabel(), 'all · 451');
  });
  // ---- U7: shading-aware base picks ----

  test('U7: laid with shading on, Honolulu 48 at 16 markers picks 14 of 16 that shade (8 without); Ben’s 451 all 16', () => {
    for (const [set, off, on] of [
      [['Honolulu 48'], 8, 14],
      [null, 15, 16],
    ]) {
      const { t } = appWith(set);
      const cl = page(t, 24, 20);
      const count = () => {
        const bk = byKey(t),
          ms = [...new Set(keys(t))].map((k) => bk[k]);
        t.styleVars.shadeMode = 'full';
        return ms.filter((m) => t.grad.shadeOK(m)).length;
      };
      style(t, { limitN: 16 });
      t.grad.build(cl);
      assert.equal(count(), off, 'shading off');
      assert.ok(!t.assignData.shp);
      style(t, { limitN: 16, shadeMode: 'full' });
      t.grad.build(cl);
      assert.ok(count() >= on, `shading on: ${count()} of 16`);
      assert.equal(t.assignData.shp, 1, 'picked with shading in mind');
      // (Shadows needs a darker partner only)
      style(t, { limitN: 16, shadeMode: 'shadow' });
      t.grad.build(cl);
      assert.ok(t.assignData.shp);
    }
  });
  test('U7: only one marker to a band from your markers is picked that way (bands of several and palettes as before)', () => {
    const { t } = appWith(['Honolulu 48']);
    const cl = page(t, 24, 20);
    style(t, { limitN: 16, look: 'ltd', gradShape: 'vertical' });
    t.grad.build(cl);
    const off = keys(t).join();
    style(t, { limitN: 16, look: 'ltd', gradShape: 'vertical', shadeMode: 'full' });
    t.grad.build(cl);
    assert.equal(keys(t).join(), off);
    assert.ok(!t.assignData.shp);
  });
  test('U7: turning shading on doesn’t pick again by itself; the Shading tab offers “Pick shadeable ones”, one Undo step, and it’s gone after', () => {
    const { t } = appWith(['Honolulu 48']);
    page(t, 24, 20);
    style(t, { limitN: 16 });
    t.assign.buildGuide();
    const before = keys(t).join();
    t.styleVars.shadeMode = 'full';
    // (nothing laid again: the offer instead)
    assert.equal(keys(t).join(), before);
    const o = t.grad.shadeOffer();
    assert.deepEqual([o.ok, o.n, [...o.ids]], [8, 16, [0]]);
    t.grad.shadePick();
    assert.notEqual(keys(t).join(), before);
    assert.equal(t.planLabel, 'Shadeable markers picked');
    assert.equal(t.grad.shadeOffer(), null, 'gone once picked with shading on');
    // Shadows with the same picks: nothing to offer either
    t.styleVars.shadeMode = 'off';
    assert.equal(t.grad.shadeOffer(), null, 'no shading, no offer');
  });
  // ---- rough spots ----

  test('rough spots: Smooth them gives one of each pair an unused clear marker, never a grey, a second of a code, or a marker twice', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, {});
    t.grad.build(cl);
    const A0 = { ...t.assignData.assign },
      before = t.grad.rough(cl, A0);
    assert.ok(before.length >= 10, before.length + ' rough spots');
    assert.ok(before.every((p) => p[2] > 30));
    // (the codes the guide had in both brands before: the fix adds none)
    const twins = (A) => {
      const by = {};
      for (const m of Object.values(A)) (by[m.code] = by[m.code] || new Set()).add(m.mkey);
      return Object.keys(by).filter((c) => by[c].size > 1);
    };
    const tw0 = twins(A0);
    style(t, { gradFix: true });
    t.grad.build(cl);
    const f = t.grad.fixed,
      A = t.assignData.assign,
      bk = byKey(t);
    assert.ok(f.swaps.length > 0 && f.after < f.before / 2, `${f.before} -> ${f.after}`);
    assert.equal(t.grad.rough(cl, A).length, f.after);
    const added = f.swaps.map((s) => bk[s[1]]);
    for (const m of added) {
      const x = t.colour.lch(m);
      assert.ok(x[1] >= 20 && x[0] >= 34 && x[0] <= 90, m.code + ' is clear');
    }
    assert.deepEqual(
      twins(A).filter((c) => !tw0.includes(c)),
      [],
      'no second of a code in the guide',
    );
    assert.equal(new Set(keys(t)).size, keys(t).length, 'one marker per section still');
    // the flow's first section keeps the Start colour
    assert.equal(A[t.assignData.order[0]].mkey, A0[t.assignData.order[0]].mkey);
    // laid again after a Shuffle: still smoothed
    style(t, { gradFix: true, gradSeed: 0.5 });
    t.grad.build(cl);
    assert.ok(t.grad.fixed.swaps.length > 0, 'kept through Shuffle');
    // Natural and Scatter aren't smoothed this way, nor a count below all your markers
    for (const o of [{ gradScat: 1 }, { gradScat: 3 }, { limitN: 200 }]) {
      style(t, { gradFix: true, ...o });
      t.grad.build(cl);
      assert.equal(t.grad.fixed, null, JSON.stringify(o));
    }
  });
  test('rough spots: pinned and coloured sections keep their markers; only pairs within the sections given count', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, {});
    t.grad.build(cl);
    const A = { ...t.assignData.assign },
      pairs = t.grad.rough(cl, A),
      fixed = new Set(pairs.flatMap((p) => [p[0], p[1]]));
    const none = { used: new Set(), codes: new Set() };
    const r = t.grad.fixRun(cl, { ...A }, t.coll, (l) => fixed.has(l), none);
    assert.equal(r.swaps.length, 0, 'every rough section held');
    // half the picture: only its own pairs
    const half = cl.slice(0, cl.length / 2),
      inH = new Set(half);
    assert.ok(t.grad.rough(half, A).every((p) => inH.has(p[0]) && inH.has(p[1])));
    // a greedy pass: with no markers to spare, nothing
    const used = new Set(t.coll.map((m) => m.mkey));
    assert.equal(
      t.grad.fixRun(cl, { ...A }, t.coll, () => false, { used, codes: new Set() }).swaps.length,
      0,
    );
  });
  test('rough spots: the line under the tabs counts them only at Polished and only when they can be smoothed; Smooth them is one Undo step', () => {
    const { t } = appWith();
    page(t, 18, 12);
    style(t, {});
    t.assign.buildGuide();
    const r = t.grad.roughNow();
    assert.ok(r.pairs.length >= 10 && r.ids.length === 1, r.pairs.length + ' rough spots');
    t.grad.roughSmooth();
    assert.equal(t.styleVars.gradFix, true);
    assert.equal(t.planLabel, 'Rough spots smoothed');
    const after = t.grad.roughNow();
    assert.ok(after.pairs.length < r.pairs.length / 2);
    assert.deepEqual([...after.ids], [], 'nothing more it can do: no line');
    // at Natural: none
    t.styleVars.gradScat = 1;
    t.reassign();
    assert.equal(t.grad.roughNow().ids.length, 0);
    assert.equal(t.grad.roughNow().pairs.length, 0);
  });
  test('rough spots: on a page with more sections than clear markers every one is used, so there is nothing to smooth', () => {
    const { t } = appWith();
    page(t, 24, 20);
    style(t, {});
    t.assign.buildGuide();
    const r = t.grad.roughNow();
    assert.deepEqual([[...r.ids], [...r.pairs]], [[], []]);
  });
  // ---- Blend ----

  test('Blend: an anchor added by a tap is vivid, not fluorescent, and the hue furthest from the anchors there; none twice', () => {
    for (const set of [null, ['Ciao 12']]) {
      const { t } = appWith(set);
      const cl = page(t, 18, 12);
      style(t, { family: 'blend' });
      t.anchors = [];
      t.seedAnchors(cl);
      for (let i = 0; i < 6; i++) t.addAnchor({ x: 10 + i, y: 10 });
      const bk = byKey(t),
        ms = t.anchors.map((a) => bk[a.mkey]);
      assert.equal(new Set(ms.map((m) => m.mkey)).size, 9, 'none twice');
      const cs = t.coll.map((m) => t.colour.lch(m)[1]).sort((a, b) => a - b),
        med = cs[Math.floor(cs.length / 2)];
      for (const m of ms.slice(3, set ? 4 : 9)) {
        assert.notEqual(m.fam, 'Fluorescent', m.code);
        assert.ok(t.colour.lch(m)[1] >= med, m.code + ' is vivid');
      }
      if (!set)
        assert.deepEqual([...ms.slice(3, 8).map((m) => m.code)], ['RV25', 'YR20', 'BG011', 'RV13', 'V414']);
    }
  });
}

// ---- from v306-dbg-colour.test.mjs ----
// v306 debugging pass (the colour engines): fixes found after merging the four branches.
{
  // a clock that runs `step` ms on at every look, as on a slow or busy iPad
  function slowDate(step, calls) {
    let now = 1.7e12;
    const D = function (...a) {
      return new Date(...a);
    };
    D.now = () => {
      calls.n++;
      return (now += step);
    };
    D.prototype = Date.prototype;
    D.UTC = Date.UTC;
    D.parse = Date.parse;
    return D;
  }
  // an app with Ben's own markers (defaultOwned: 451), or these sets, owned
  function appWith(sets, over) {
    const app = createApp(over),
      E = app.__eval,
      t = app.__mstest;
    if (sets) {
      E('state.owned = new Set()');
      for (const n of sets)
        E(
          `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
        );
    } else E('state.owned = new Set(defaultOwned())');
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, E, t };
  }
  // cols × rows sections of uneven sizes (from a seed), lines lw px between them; ready to build
  function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
      ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
      hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
      W = ws.reduce((a, b) => a + b + lw, lw),
      H = hs.reduce((a, b) => a + b + lw, lw),
      labels = new Int32Array(W * H).fill(-1),
      comps = [null];
    let y0 = lw;
    for (let rr = 0; rr < rows; rr++) {
      let x0 = lw;
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          w = ws[c],
          h = hs[rr];
        comps.push({
          area: w * h,
          bg: false,
          bpx: 0,
          cx: x0 + w / 2,
          cy: y0 + h / 2,
          h: h - 1,
          x0,
          y0,
          x1: x0 + w - 1,
          y1: y0 + h - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
        x0 += w + lw;
      }
      y0 += hs[rr] + lw;
    }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    for (const k in t.locks) delete t.locks[k];
    return t.countedList();
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'gradient',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        gradSeed: 0,
        dir: 1,
        look: 'auto',
        gradShape: 'serpentine',
        limitN: 999,
        shadeMode: 'off',
      },
      o,
    );
  const keys = (t) => {
    const a = t.assignData;
    return a.order.map((l) => a.assign[l].mkey).join();
  };
  test('the Gradient lays the same markers on a slow or busy device: ordering the markers is not time-boxed', () => {
    const lay = (over) => {
      const { t } = appWith(null, over),
        cl = page(t, 40, 43),
        out = [];
      for (const shape of ['serpentine', 'around']) {
        style(t, { gradShape: shape });
        t.grad.build(cl);
        out.push(keys(t));
      }
      return out;
    };
    const fast = lay(),
      calls = { n: 0 },
      slow = lay({ Date: slowDate(5, calls) });
    assert.ok(calls.n > 0, 'the slow clock was in use');
    assert.deepEqual(slow, fast);
  });
  test('ordering markers never looks at the clock, and all 720 finish inside its budget of steps', () => {
    const calls = { n: 0 },
      { t } = appWith([], { Date: slowDate(50, calls) }),
      all = t.coll,
      D = t.grad.deMatrix(all),
      n0 = calls.n,
      a = t.grad.tour(D, all.length, false);
    assert.equal(calls.n, n0, 'no clock');
    assert.equal(new Set(a).size, all.length);
    assert.ok(t.gradTourWork[0] < t.gradTourWork[1], 'finished inside the budget');
    assert.deepEqual(t.grad.tour(D, all.length, false), a, 'the same again');
  });
  test('Smooth them in two Gradient zones never brings the same new marker (or its code) into both', () => {
    const { t } = appWith(),
      cl = page(t, 12, 12);
    style(t, {});
    t.assign.buildGuide();
    const map = {};
    cl.forEach((l) => (map[l] = l));
    const half = (left) => cl.filter((l) => t.comps[l].cx < t.W / 2 === left),
      st = {
        family: 'gradient',
        gradShape: 'serpentine',
        limitN: 999,
        emphasis: 'neutral',
        palette: 'all',
        paletteSource: 'owned',
        look: 'auto',
      };
    t.zoneOpen(
      [
        { name: 'A', secs: half(true), style: st },
        { name: 'B', secs: half(false), style: { ...st, gradSeed: 0.5 } },
      ],
      map,
    );
    t.reassign([1, 2]);
    assert.deepEqual([...t.grad.roughNow().ids], [1, 2], 'both zones have rough spots to smooth');
    t.grad.roughSmooth();
    const A1 = { ...t.assignData.assign };
    // the same lay without the fix: the markers the fixes brought in are the ones it hasn't got
    for (const z of t.zones) {
      t.zoneSelect(z.id);
      assert.equal(t.styleVars.gradFix, true);
      t.styleVars.gradFix = false;
    }
    t.zoneSelect(0);
    t.reassign([1, 2]);
    const had = new Set(Object.values(t.assignData.assign).map((m) => m.mkey)),
      zs = {};
    for (const l in A1) {
      const m = A1[l];
      if (!had.has(m.mkey)) (zs[m.code] = zs[m.code] || new Set()).add(t.zoneOf(+l));
    }
    assert.ok(Object.keys(zs).length >= 6, 'markers brought in');
    assert.deepEqual(
      Object.keys(zs).filter((c) => zs[c].size > 1),
      [],
    );
  });
}

// ---- from v308-colour.test.mjs ----
// v308, the Gradient's colours (30-palette-assign): the Include row (Browns, Greys & black, Fluorescents), the vivid
// markers for Any and Bright, "all" as every marker left (repeated where needed), lightness that follows hue (the
// Gradient and Palette's Rainbow), the marker count's end and label, the mandala test behind "Use Around", the Undo
// wording, and guides saved before v308 laid exactly as v307 laid them.
{
  // an app with Ben's own markers (defaultOwned: 451), or these sets, owned
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    if (sets) {
      E('state.owned = new Set()');
      for (const n of sets)
        E(
          `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
        );
    } else E('state.owned = new Set(defaultOwned())');
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, E, t };
  }
  function setPage(t, W, H, labels, n, given) {
    const comps = given || [null];
    if (!given) {
      for (let l = 1; l <= n; l++)
        comps.push({ area: 0, sx: 0, sy: 0, bg: false, bpx: 0, x0: W, y0: H, x1: -1, y1: -1, merged: false });
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const l = labels[y * W + x];
          if (l < 1) continue;
          const c = comps[l];
          c.area++;
          c.sx += x;
          c.sy += y;
          c.x0 = Math.min(c.x0, x);
          c.y0 = Math.min(c.y0, y);
          c.x1 = Math.max(c.x1, x);
          c.y1 = Math.max(c.y1, y);
        }
      comps.forEach((c) => {
        if (!c) return;
        c.cx = c.sx / c.area;
        c.cy = c.sy / c.area;
        c.h = c.y1 - c.y0;
      });
    }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    for (const k in t.locks) delete t.locks[k];
    return t.countedList();
  }
  // cols × rows sections of uneven sizes (from a seed), lines lw px between them
  function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
      ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
      hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
      W = ws.reduce((a, b) => a + b + lw, lw),
      H = hs.reduce((a, b) => a + b + lw, lw),
      labels = new Int32Array(W * H).fill(-1);
    const comps = [null];
    let y0 = lw;
    for (let rr = 0; rr < rows; rr++) {
      let x0 = lw;
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          w = ws[c],
          h = hs[rr];
        comps.push({
          area: w * h,
          bg: false,
          bpx: 0,
          cx: x0 + w / 2,
          cy: y0 + h / 2,
          h: h - 1,
          x0,
          y0,
          x1: x0 + w - 1,
          y1: y0 + h - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
        x0 += w + lw;
      }
      y0 += hs[rr] + lw;
    }
    return setPage(t, W, H, labels, comps.length - 1, comps);
  }
  // a mandala: a middle, then rings of `k` matching petals (lines between them)
  function mandala(t, rings = 4, k = 12, S = 400) {
    const labels = new Int32Array(S * S).fill(-1),
      c = S / 2,
      band = (S / 2 - 30) / rings;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const r = Math.hypot(x - c, y - c);
        if (r < 18) {
          labels[y * S + x] = 1;
          continue;
        }
        const ri = Math.floor((r - 20) / band);
        if (r < 20 || ri >= rings || r - 20 - ri * band < 2) continue;
        const a = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 360) % 360,
          si = Math.floor(a / (360 / k));
        if (a - si * (360 / k) < 2) continue;
        labels[y * S + x] = 2 + ri * k + si;
      }
    return setPage(t, S, S, labels, 1 + rings * k);
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'gradient',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        gradSeed: 0,
        gradScat: 0,
        gradJit: 0,
        gradFix: false,
        dir: 1,
        look: 'auto',
        gradShape: 'serpentine',
        limitN: 999,
        shadeMode: 'off',
        gradIncl: {},
      },
      o,
    );
  const keys = (t) => t.assignData.order.map((l) => t.assignData.assign[l].mkey);
  const usedMs = (t) => {
    const seen = new Map();
    t.assignData.order.forEach((l) => seen.set(t.assignData.assign[l].mkey, t.assignData.assign[l]));
    return [...seen.values()];
  };
  function same(t) {
    const a = t.colour.adj(),
      A = t.assignData.assign;
    let n = 0;
    for (const k in a)
      a[k].forEach((q) => {
        if (q > +k && A[k] && A[q] && A[k].mkey === A[q].mkey) n++;
      });
    return n;
  }
  const grp = (t, m) => t.grad.inclGroup(m);
  const field = (t, k) => [...t.styleFields].find((f) => f.key === k);
  // ---- the groups and the markers left ----

  test('Include’s groups on Ben’s 451: Browns the 40 Earth markers and 29 tans, ochres and olives; Greys & black the grey families, BGY, YGY, 100 and 120; Fluorescents the F markers; 130 vivid', () => {
    const { t } = appWith();
    const g = { browns: [], greys: [], fluor: [], '': [] };
    t.coll.forEach((m) => g[grp(t, m)].push(m));
    assert.equal(g.browns.length, 69);
    assert.equal(g.browns.filter((m) => /Earth/.test(m.fam)).length, 40);
    // (the other browns: warm and muted, not light)
    for (const m of g.browns.filter((m) => !/Earth/.test(m.fam))) {
      const x = t.colour.lch(m);
      assert.ok(x[2] >= 25 && x[2] <= 125 && x[0] < 75 && !t.grad.vivid(m), m.code);
    }
    assert.ok(g.greys.some((m) => m.code === '120'));
    assert.ok(g.greys.some((m) => /^BGY/.test(m.code)) && g.greys.some((m) => /^YGY/.test(m.code)));
    assert.ok(g.greys.every((m) => /Gr[ae]y|Black|Blue-Green-Yellow|Yellow-Green-Yellow/.test(m.fam)));
    assert.deepEqual(g.fluor.map((m) => m.code).sort(), ['FY00', 'FY01', 'FY02', 'FY04']);
    assert.equal(t.coll.filter((m) => t.grad.vivid(m)).length, 130);
  });
  test('the Mood’s Include: all off but Earthy’s Browns (Deep too: no greys); no grey, black or fluorescent in any Mood; Soft, Pastel and Earthy nothing darker than L25', () => {
    const { t } = appWith();
    page(t, 18, 12);
    const want = { neutral: 130, vivid: 96, muted: 109, pastel: 108, deep: 71, earthy: 46 };
    for (const mood of Object.keys(want)) {
      style(t, { emphasis: mood });
      const on = t.grad.inclOn({}, mood);
      assert.deepEqual({ ...on }, { browns: mood === 'earthy', greys: false, fluor: false }, mood);
      const left = [...t.grad.inclPool(16).items];
      assert.equal(left.length, want[mood], mood);
      assert.ok(
        left.every((m) => grp(t, m) !== 'greys' && grp(t, m) !== 'fluor'),
        mood + ': no greys, no fluorescents',
      );
      if (mood === 'neutral' || mood === 'vivid')
        assert.ok(
          left.every((m) => t.grad.vivid(m)),
          mood + ': vivid only',
        );
      if (['muted', 'pastel', 'earthy'].includes(mood))
        assert.ok(
          left.every((m) => t.colour.lch(m)[0] >= 25),
          mood + ': none darker than L25',
        );
    }
    // a choice tapped stays through a Mood change; the others follow the Mood
    assert.deepEqual(
      { ...t.grad.inclOn({ greys: true }, 'earthy') },
      { browns: true, greys: true, fluor: false },
    );
    assert.deepEqual(
      { ...t.grad.inclOn({ browns: false }, 'earthy') },
      { browns: false, greys: false, fluor: false },
    );
    // turning a group on brings it all in (a group's markers aren't held to the vivid test)
    style(t, { gradIncl: { browns: true } });
    assert.equal(t.grad.inclPool(16).items.length, 199);
    style(t, { gradIncl: { browns: true, greys: true, fluor: true } });
    assert.equal(t.grad.inclPool(16).items.length, 130 + 69 + 47 + 4);
  });
  test('a pool filter at every count: 16, 24 and 48 pick only from the markers left (no browns, greys or fluorescents), and the default 16 keeps to colours of similar strength', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    for (const n of [16, 24, 48]) {
      style(t, { limitN: n });
      t.grad.build(cl);
      const ms = usedMs(t);
      assert.equal(ms.length, n);
      assert.ok(
        ms.every((m) => t.grad.vivid(m)),
        n + ': all vivid',
      );
    }
    // (v307's 16 had R310 and V010 at 0.4 of their hue's strongest beside a hot RV06)
    const weakest = (incl) => {
      style(t, { limitN: 16, gradIncl: incl });
      t.grad.build(cl);
      return Math.min(...usedMs(t).map((m) => t.grad.rc(m)));
    };
    const was = weakest(null),
      now = weakest({});
    assert.ok(was < 0.45 && now >= 0.5, `weakest ${was.toFixed(2)} → ${now.toFixed(2)}`);
  });
  test('“all”: the slider ends at the smaller of the sections and the markers left; more sections than markers lays them all, split where they touch while each is used twice at most, else in bands', () => {
    // Ben's 130 on 216 sections (2 × 130 = 260 or more): every one, no two touching sections sharing one
    {
      const { t } = appWith();
      const cl = page(t, 18, 12);
      style(t, {});
      assert.equal(t.grad.mkCap(), 130);
      const c = t.grad.countNow();
      assert.deepEqual([c.M, c.reuse, c.all], [130, true, true]);
      t.grad.build(cl);
      assert.equal(usedMs(t).length, 130);
      assert.equal(same(t), 0);
      assert.equal(t.grad.mkCountLabel(), 'all · 130');
      // a count of 129 is a count, not all
      style(t, { limitN: 129 });
      assert.equal(t.grad.mkCountLabel(), '129');
      assert.deepEqual([t.grad.countNow().M, !!t.grad.countNow().all], [129, false]);
      // (a saved count at or over the end reads as all)
      style(t, { limitN: 451 });
      assert.equal(t.grad.mkCountLabel(), 'all · 130');
      // fewer sections than markers left: one each
      const few = page(t, 10, 8);
      style(t, {});
      assert.equal(t.grad.mkCap(), 80);
      t.grad.build(few);
      assert.equal(usedMs(t).length, 80);
      assert.ok(usedMs(t).every((m) => t.grad.vivid(m)));
      assert.equal(t.grad.mkCountLabel(), 'all · 80');
    }
    // Honolulu 24's 12 vivid on 216 sections (more than twice as many): bands of all 12, not split up (confetti)
    // (v308.3: 14, its two violets V010 and V416 kept so the set keeps its violet family)
    {
      const { t } = appWith(['Honolulu 24']);
      const cl = page(t, 18, 12);
      style(t, {});
      assert.equal(t.grad.mkCap(), 14);
      const c = t.grad.countNow();
      assert.deepEqual([c.M, c.reuse], [14, false]);
      t.grad.build(cl);
      assert.equal(usedMs(t).length, 14);
      assert.ok(same(t) > 150, 'bands: neighbours share their band’s marker');
      // and the line under Include says what Browns would add
      assert.match(
        t.grad.inclStatus(),
        /^14 of your markers · browns, greys, fluorescents off · .+ would add \d+$/,
      );
    }
  });
  test('Greys & black on: greys come in at "all" and their share at a count; off (the default), never', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, { gradIncl: { greys: true } });
    t.grad.build(cl);
    const all = usedMs(t);
    assert.equal(all.length, 177);
    assert.ok(all.filter((m) => grp(t, m) === 'greys').length === 47);
    style(t, { gradIncl: { greys: true }, limitN: 24 });
    t.grad.build(cl);
    const g24 = usedMs(t).filter((m) => grp(t, m) === 'greys').length;
    assert.ok(g24 >= 4 && g24 <= 8, g24 + ' greys of 24');
    style(t, { limitN: 24 });
    t.grad.build(cl);
    assert.equal(usedMs(t).filter((m) => grp(t, m) === 'greys').length, 0);
  });
  test('Smooth them and Pick shadeable ones draw from the same markers the Gradient does', () => {
    const { t } = appWith();
    page(t, 18, 12);
    style(t, {});
    const src = t.grad.poolSource(216, true),
      fix = [...t.grad.fixPool(src)];
    assert.ok(fix.length === 130 && fix.every((m) => t.grad.vivid(m)));
    // (Pick shadeable ones re-lays with shade-aware picks from the vivid markers)
    style(t, { limitN: 16 });
    t.assign.buildGuide();
    t.styleVars.shadeMode = 'full';
    if (t.grad.shadeOffer()) t.grad.shadePick();
    style(t, { limitN: 16, shadeMode: 'full' });
    t.grad.build(t.countedList());
    assert.ok(usedMs(t).every((m) => t.grad.vivid(m)));
  });
  // ---- lightness follows hue ----

  test('lightness follows hue: yellow light, violet dark; a Gradient at 16 has a real light yellow; the targets go through the rainbow from red', () => {
    const { t } = appWith();
    assert.ok(t.grad.lt(92) > t.grad.lt(35) && t.grad.lt(92) > t.grad.lt(290) + 30);
    assert.equal(Math.round(t.grad.hueWarp(0, 12)), 33);
    assert.equal(Math.round(t.grad.hueWarp(2, 6)), 92, 'yellow third of six');
    // Pastel follows hue least
    assert.ok(
      Math.abs(t.grad.ltTarget(60, 92, 'pastel') - 60) <
        Math.abs(t.grad.ltTarget(60, 92, 'neutral') - 60) / 2,
    );
    const cl = page(t, 18, 12);
    for (const n of [16, 24]) {
      style(t, { limitN: n });
      t.grad.build(cl);
      const yel = usedMs(t).filter((m) => {
        const x = t.colour.lch(m);
        return x[2] >= 75 && x[2] <= 110 && x[0] >= 80 && x[1] >= 50;
      });
      assert.ok(yel.length >= 1, n + ': a light yellow');
    }
  });
  test('Palette’s Rainbow (SF.rainbowPick) picks as a new guide’s Gradient does: a real yellow at 6, 8 and 12, no fluorescents or browns, and the Gradient’s markers at the same count', () => {
    const { E, t } = appWith();
    const idx = JSON.parse(
      E('JSON.stringify(COLORS.map((c, i) => i).filter((i) => state.owned.has(mkey(i))))'),
    );
    for (const n of [6, 8, 12]) {
      const pal = [...t.grad.rainbow(n, 'neutral', idx)];
      assert.equal(pal.length, n);
      const ms = pal.map((i) => t.coll.find((m) => m.mkey === E(`mkey(${i})`)));
      assert.ok(
        ms.every((m) => !grp(t, m)),
        n + ': no browns, greys or fluorescents',
      );
      assert.ok(
        ms.some((m) => {
          const x = t.colour.lch(m);
          return x[2] >= 75 && x[2] <= 110 && x[0] >= 75;
        }),
        n + ': a yellow',
      );
    }
    // the Gradient at the same count (a loop: the same markers)
    const cl = page(t, 18, 12);
    style(t, { limitN: 12, gradShape: 'serpentine' });
    t.grad.build(cl);
    const g = usedMs(t)
        .map((m) => m.mkey)
        .sort(),
      r = [...t.grad.rainbow(12, 'neutral', idx)].map((i) => E(`mkey(${i})`)).sort();
    assert.deepEqual(r, g);
  });
  // ---- guides saved before v308 ----

  test('a guide saved before v308 (no Include) opens with none and is laid exactly as v307.1 laid it, every Mood and count', () => {
    const { t } = appWith();
    const f = field(t, 'incl');
    assert.equal(f.check(undefined, f.def), null);
    assert.equal(f.check('yes', f.def), null);
    assert.deepEqual({ ...f.check({ browns: true, greys: 3 }, f.def) }, { browns: true });
    // its saved style says nothing of Include
    t.styleVars.gradIncl = null;
    assert.equal(f.save(), undefined);
    t.styleVars.gradIncl = { fluor: true };
    assert.deepEqual({ ...f.save() }, { fluor: true });
    // (hashes of each section's marker, laid by v307.1 itself on these pages)
    const want = [
      [18, 16, 'neutral', 999, 'serpentine', 268, '0ae6511fb9f8099f'],
      [18, 16, 'neutral', 16, 'serpentine', 16, 'ba8e6f7fa5ee4239'],
      [24, 20, 'neutral', 999, 'radial', 268, '3d7a7836432497d6'],
      [18, 16, 'deep', 999, 'serpentine', 288, '6639d7bfa88fbedb'],
      [18, 16, 'vivid', 48, 'around', 48, '6729bb0165b8dc22'],
      [12, 10, 'earthy', 24, 'serpentine', 24, '532a403d46c725e0'],
    ];
    for (const [cols, rows, mood, n, shape, k, h] of want) {
      const cl = page(t, cols, rows);
      style(t, { emphasis: mood, limitN: n, gradShape: shape, gradIncl: null });
      t.grad.build(cl);
      const s = t.assignData.order.map((l) => l + ':' + t.assignData.assign[l].mkey).join(',');
      assert.equal(usedMs(t).length, k);
      assert.equal(createHash('sha256').update(s).digest('hex').slice(0, 16), h, `${mood} ${n} ${shape}`);
    }
  });
  // ---- the mandala test, Undo's words ----

  test('a mandala-like page (rings of matching petals) is told apart from a grid; Radial on it is offered Around', () => {
    const { t } = appWith();
    const m = mandala(t);
    assert.equal(m.length, 49);
    assert.ok(t.grad.mandalaScore(m) > 0.8, 'score ' + t.grad.mandalaScore(m));
    assert.equal(t.grad.mandala(m), true);
    // (petals that don't match: every ring's sizes uneven, so no group of 4 is symmetric)
    const g = page(t, 9, 8);
    assert.equal(t.grad.mandala(g), false);
    // (too few sections)
    const small = mandala(t, 2, 8);
    assert.equal(small.length, 17);
    assert.equal(t.grad.mandala(small), false);
  });
  test('Undo says what the control says: “Tone lines off”, “Shadow amount: 80%”, “Markers: all”, “Browns on”', () => {
    const { t } = appWith(['Honolulu 48']);
    page(t, 12, 10);
    style(t, { limitN: 16 });
    t.assign.buildGuide();
    t.styleVars.limitN = 999;
    t.reassign();
    assert.equal(t.planLabel, 'Markers: all');
    t.styleVars.gradIncl = { browns: true };
    t.reassign();
    assert.equal(t.planLabel, 'Browns on');
    t.styleVars.shadeMode = 'full';
    t.reassign();
    t.styleVars.shadeLines = false;
    t.reassign();
    assert.equal(t.planLabel, 'Tone lines off');
    t.styleVars.shadeLo = 0.8;
    t.reassign();
    assert.equal(t.planLabel, 'Shadow amount: 80%');
    t.styleVars.shadeHi = 0.25;
    t.reassign();
    assert.equal(t.planLabel, 'Highlight amount: 25%');
  });
}

// ---- from v3083-colour.test.mjs ----
// v308.3 (colour): the Gradient's vivid set keeps every colour family the collection has (Any and Bright), Ben's
// 451 laid exactly as before; the data fix (Ohuhu V013 "Violet"); the colours neither text reads on at 4.5:1 (Focus
// mode's chips give their words a halo: txtWeak).
{
  // an app with Ben's own markers (defaultOwned: 451), or these sets, owned
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    if (sets) {
      E('state.owned = new Set()');
      for (const n of sets)
        E(
          `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
        );
    } else E('state.owned = new Set(defaultOwned())');
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, E, t };
  }
  function setPage(t, W, H, labels, n, given) {
    const comps = given || [null];
    if (!given) {
      for (let l = 1; l <= n; l++)
        comps.push({ area: 0, sx: 0, sy: 0, bg: false, bpx: 0, x0: W, y0: H, x1: -1, y1: -1, merged: false });
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const l = labels[y * W + x];
          if (l < 1) continue;
          const c = comps[l];
          c.area++;
          c.sx += x;
          c.sy += y;
          c.x0 = Math.min(c.x0, x);
          c.y0 = Math.min(c.y0, y);
          c.x1 = Math.max(c.x1, x);
          c.y1 = Math.max(c.y1, y);
        }
      comps.forEach((c) => {
        if (!c) return;
        c.cx = c.sx / c.area;
        c.cy = c.sy / c.area;
        c.h = c.y1 - c.y0;
      });
    }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    for (const k in t.locks) delete t.locks[k];
    return t.countedList();
  }
  // cols × rows sections of uneven sizes (from a seed), lines lw px between them
  function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
      ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
      hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
      W = ws.reduce((a, b) => a + b + lw, lw),
      H = hs.reduce((a, b) => a + b + lw, lw),
      labels = new Int32Array(W * H).fill(-1);
    const comps = [null];
    let y0 = lw;
    for (let rr = 0; rr < rows; rr++) {
      let x0 = lw;
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          w = ws[c],
          h = hs[rr];
        comps.push({
          area: w * h,
          bg: false,
          bpx: 0,
          cx: x0 + w / 2,
          cy: y0 + h / 2,
          h: h - 1,
          x0,
          y0,
          x1: x0 + w - 1,
          y1: y0 + h - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
        x0 += w + lw;
      }
      y0 += hs[rr] + lw;
    }
    return setPage(t, W, H, labels, comps.length - 1, comps);
  }
  // a mandala: a middle, then rings of `k` matching petals (lines between them)
  function mandala(t, rings = 4, k = 12, S = 400) {
    const labels = new Int32Array(S * S).fill(-1),
      c = S / 2,
      band = (S / 2 - 30) / rings;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const r = Math.hypot(x - c, y - c);
        if (r < 18) {
          labels[y * S + x] = 1;
          continue;
        }
        const ri = Math.floor((r - 20) / band);
        if (r < 20 || ri >= rings || r - 20 - ri * band < 2) continue;
        const a = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 360) % 360,
          si = Math.floor(a / (360 / k));
        if (a - si * (360 / k) < 2) continue;
        labels[y * S + x] = 2 + ri * k + si;
      }
    return setPage(t, S, S, labels, 1 + rings * k);
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'gradient',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        gradSeed: 0,
        gradScat: 0,
        gradJit: 0,
        gradFix: false,
        dir: 1,
        look: 'auto',
        gradShape: 'serpentine',
        limitN: 999,
        shadeMode: 'off',
        gradIncl: {},
      },
      o,
    );
  const usedMs = (t) => {
    const seen = new Map();
    t.assignData.order.forEach((l) => seen.set(t.assignData.assign[l].mkey, t.assignData.assign[l]));
    return [...seen.values()];
  };
  const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
  const laid = (t) => hash(t.assignData.order.map((l) => l + ':' + t.assignData.assign[l].mkey).join(','));
  const SETS = JSON.parse(
    createApp().__eval('JSON.stringify(MARKER_SETS.map((s) => [s.n, presetMkeys(s).length]))'),
  ).filter((s) => s[1] <= 60);
  // the families a set has inside the Mood: colours (no Include group) of chroma over 20
  function hasFams(t, mood) {
    const M = { neutral: [12, 999], vivid: [45, 999] }[mood];
    return new Set(
      t.coll
        .filter((m) => {
          const C = t.colour.lch(m)[1];
          return !t.grad.inclGroup(m) && C > 20 && C >= M[0];
        })
        .map((m) => t.grad.fam8(m)),
    );
  }
  test('the eight families go by how the colour looks: B29 a blue, V09 and BV08 violets, BG09 a cyan, RV04 a pink, R29 a red', () => {
    const { t } = appWith(['Ciao 12', 'Honolulu 24']);
    const f = (c) => t.grad.fam8(t.coll.find((m) => m.code === c));
    assert.deepEqual(
      ['B29', 'V09', 'BV08', 'BG09', 'RV04', 'R29', 'YR07', 'Y06', 'G17', 'V010', 'V416'].map(f),
      ['blue', 'violet', 'violet', 'cyan', 'pink', 'red', 'orange', 'yellow', 'green', 'violet', 'violet'],
    );
  });
  test('Any and Bright keep every colour family a set of 60 or fewer has: Honolulu 24 its violets V010 and V416 (14), Ciao 12 its V09', () => {
    for (const [n] of SETS) {
      const { t } = appWith([n]);
      page(t, 18, 12);
      for (const mood of ['neutral', 'vivid']) {
        style(t, { emphasis: mood });
        const kept = new Set([...t.grad.inclPool(216).items].map((m) => t.grad.fam8(m)));
        const lost = [...hasFams(t, mood)].filter((f) => !kept.has(f));
        assert.deepEqual(lost, [], `${n} ${mood}: lost ${lost.join(', ')}`);
      }
    }
    const { t } = appWith(['Honolulu 24']);
    page(t, 18, 12);
    style(t, {});
    const h24 = [...t.grad.inclPool(216).items].map((m) => m.code);
    assert.equal(h24.length, 14);
    assert.ok(h24.includes('V010') && h24.includes('V416'), h24.join(' '));
    // (as many as a kept family has on average: Ciao 12's have one each, so its violet gets one, the more vivid V09)
    const c = appWith(['Ciao 12']).t;
    page(c, 18, 12);
    style(c, {});
    const c12 = [...c.grad.inclPool(216).items].map((m) => m.code);
    assert.ok(c12.includes('V09') && !c12.includes('BV08'), c12.join(' '));
  });
  test('browns, greys and fluorescents still go by Include: a kept-back marker is never one of theirs; Browns on adds its browns to them', () => {
    for (const [n] of SETS) {
      const { t } = appWith([n]);
      page(t, 18, 12);
      style(t, {});
      const off = [...t.grad.inclPool(216).items].filter((m) => t.grad.inclGroup(m));
      // (a set with fewer than 2 vivid markers, or too few for the Mood, is widened from outside it as before: Skin
      // Tones, Gray Tones)
      if (t.grad.inclPool(216).widened || t.coll.filter((m) => t.grad.vivid(m)).length < 2) continue;
      assert.deepEqual(
        off.map((m) => m.code),
        [],
        n,
      );
    }
    const { t } = appWith(['Honolulu 24']);
    page(t, 18, 12);
    style(t, { gradIncl: { browns: true } });
    const items = [...t.grad.inclPool(216).items];
    assert.ok(items.some((m) => m.code === 'V010') && items.some((m) => t.grad.inclGroup(m) === 'browns'));
    assert.ok(items.every((m) => ['', 'browns'].includes(t.grad.inclGroup(m))));
  });
  test('the other Moods (Soft, Pastel, Deep, Earthy) are as they were', () => {
    const want = {
      'Honolulu 24 muted': 'B08 BG114 BG311 BV310 G36 RV08 V010 V18',
      'Honolulu 24 muted grad': 'c521a82a6170d893',
      'Honolulu 24 pastel': 'B08 BG114 G36 G410 RV08 V18 Y111 Y26',
      'Honolulu 24 pastel grad': 'b2d7c91c9866fc64',
      'Honolulu 24 deep': 'B111 BV310 G312 R014 R413 RV311 V010 V416',
      'Honolulu 24 deep grad': 'd5b65fedd4a9b6e1',
      'Honolulu 24 earthy': 'B111 BG114 BG311 BV310 G310 R210 V010 YR313',
      'Honolulu 24 earthy grad': '568a6e4f2a11ea8d',
      'Ciao 12 muted': 'BG09 BV08 G17 R29 RV04 V09 YG06 YR07',
      'Ciao 12 muted grad': '7d25606b7d1ee62a',
      'Ciao 12 pastel': 'B29 BG09 G17 R29 RV04 Y06 YG06 YR07',
      'Ciao 12 pastel grad': 'aada9fc725cb1f9e',
      'Ciao 12 deep': 'B29 BG09 BV08 G17 R29 RV04 V09 YR07',
      'Ciao 12 deep grad': '45aed36deaa0dd15',
      'Ciao 12 earthy': 'BG09 BV08 E29 G17 R29 RV04 V09 YR07',
      'Ciao 12 earthy grad': '938085ecab7e2116',
      '48 Mid-tone Set muted': 'B09 B311 BG211 BV08 BV415 BV48 BV58 G44 R57 RV57 V29 V412 V46 YG36',
      '48 Mid-tone Set muted grad': '422f1dabb365bad8',
      '48 Mid-tone Set pastel': 'G44 R23 Y09 Y39 Y46 YG111 YG112 YG36',
      '48 Mid-tone Set pastel grad': '84ae2d34fdebf7a9',
      '48 Mid-tone Set deep': 'BV013 BV28 BV415 R410 R48 RV29 V29 V412',
      '48 Mid-tone Set deep grad': '145621e71f003f7c',
      '48 Mid-tone Set earthy': 'BV28 BV415 E413 E610 R57 V29 V412 YR312',
      '48 Mid-tone Set earthy grad': '2654fe5578e59468',
    };
    for (const set of ['Honolulu 24', 'Ciao 12', '48 Mid-tone Set']) {
      const { t } = appWith([set]);
      for (const mood of ['muted', 'pastel', 'deep', 'earthy']) {
        const cl = page(t, 18, 12);
        style(t, { emphasis: mood });
        assert.equal(
          [...t.grad.inclPool(216).items]
            .map((m) => m.code)
            .sort()
            .join(' '),
          want[`${set} ${mood}`],
          `${set} ${mood}`,
        );
        t.grad.build(cl);
        assert.equal(laid(t), want[`${set} ${mood} grad`], `${set} ${mood} laid`);
      }
    }
  });
  test('the count’s end, “all”, what all lays and the line under Include agree, on a big page and a small one', () => {
    for (const n of [
      'Honolulu 24',
      'Honolulu 48',
      'Ciao 12',
      'Ciao 24',
      'Ciao 36 - Set D',
      '48 Mid-tone Set',
      'Sketch 12',
    ]) {
      const { t } = appWith([n]);
      for (const [cols, rows] of [
        [18, 12],
        [4, 3],
      ]) {
        const cl = page(t, cols, rows);
        for (const mood of ['neutral', 'vivid']) {
          style(t, { emphasis: mood });
          // (the slider's end, mkCap: the smaller of the sections and the markers left)
          const left = t.grad.sliderMax(),
            cap = t.grad.mkCap(),
            at = `${n} ${cols}×${rows} ${mood}`;
          assert.equal(cap, Math.min(cl.length, left), `${at}: slider ends at ${cap}, ${left} left`);
          assert.equal(t.grad.mkCountLabel(), 'all · ' + cap, at);
          // the line under Include says the markers left
          assert.equal(+t.grad.inclStatus().match(/^(\d+) of your markers/)[1], left, at);
          // and all lays as many as it says
          t.grad.build(cl);
          assert.equal(usedMs(t).length, cap, `${at}: all lays ${cap}`);
        }
      }
    }
  });
  test('Ben’s 451: the same markers left and the same Gradients as v308.2, every Mood and Temperature; Palette’s Rainbow too', () => {
    const want = {
      'pool neutral all': '1f001b85c67ab078',
      'pool neutral warm': 'ddb575ac82d9f18b',
      'pool neutral cool': 'df16ace2f366412a',
      'pool vivid all': '3b58e842409145c5',
      'pool vivid warm': '2f21c1d37e9375bf',
      'pool vivid cool': '091a0b3e33ff4c13',
      'pool muted all': 'c4632db417638a73',
      'pool muted warm': 'e89ac395f003388f',
      'pool muted cool': '0a60a18f38ab52aa',
      'pool pastel all': '82a59410d9221b95',
      'pool pastel warm': '91bc6b12a4677252',
      'pool pastel cool': 'aa3360f80055caf2',
      'pool deep all': '3a1e2aaf491f03ff',
      'pool deep warm': '13af5050f5b9405e',
      'pool deep cool': '32797dbcb95089e5',
      'pool earthy all': 'f0400e2466a924ac',
      'pool earthy warm': '48f3519f72e87465',
      'pool earthy cool': '42886b042d24462a',
      'grad neutral all 16 serpentine': 'e2c7a562423d5f80',
      'grad neutral all 24 radial': '38bae292f012e9a7',
      'grad neutral all 999 serpentine': '27e27b385c58924c',
      'grad neutral warm 16 serpentine': '3dff30d3f12b0d75',
      'grad neutral warm 24 radial': '307f7f655c5c0f1c',
      'grad neutral warm 999 serpentine': '16c3393e99d2f4ac',
      'grad neutral cool 16 serpentine': 'aff5acfe5ce1cd67',
      'grad neutral cool 24 radial': '16d49b249b463a21',
      'grad neutral cool 999 serpentine': '0a5b3b3dc009c77d',
      'grad vivid all 16 serpentine': '1a45d42e59e3d588',
      'grad vivid all 24 radial': '1bd9318cdacd0cda',
      'grad vivid all 999 serpentine': 'd38762645e39f26d',
      'grad vivid warm 16 serpentine': '40f113fac6743a9a',
      'grad vivid warm 24 radial': '8a6526f7082c6499',
      'grad vivid warm 999 serpentine': 'aff0a9fad973ea91',
      'grad vivid cool 16 serpentine': 'be059fde218804de',
      'grad vivid cool 24 radial': 'ed6b84ef5e4b9b40',
      'grad vivid cool 999 serpentine': '5079bd2ab3945366',
      'rainbow neutral 6': '331,557,526,297,237,115',
      'rainbow neutral 8': '8,352,547,526,298,630,270,115',
      'rainbow neutral 12': '331,352,557,185,526,301,297,630,237,641,115,25',
      'rainbow neutral 16': '557,547,540,526,517,298,661,630,621,270,282,115,21,8,57,352',
      'rainbow vivid 6': '331,557,526,297,237,481',
      'rainbow vivid 8': '331,352,547,526,298,630,270,481',
      'rainbow vivid 12': '331,57,352,557,185,526,301,297,630,237,641,481',
      'rainbow vivid 16': '331,57,352,557,547,540,526,313,298,661,630,621,270,282,481,487',
    };
    const { E, t } = appWith();
    for (const mood of ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'])
      for (const pal of ['all', 'warm', 'cool']) {
        page(t, 18, 12);
        style(t, { emphasis: mood, palette: pal });
        const k = `pool ${mood} ${pal}`;
        assert.equal(
          hash(
            [...t.grad.inclPool(1).items]
              .map((m) => m.mkey)
              .sort()
              .join(','),
          ),
          want[k],
          k,
        );
      }
    for (const mood of ['neutral', 'vivid'])
      for (const pal of ['all', 'warm', 'cool'])
        for (const [n, shape] of [
          [16, 'serpentine'],
          [24, 'radial'],
          [999, 'serpentine'],
        ]) {
          const cl = page(t, 18, 12);
          style(t, { emphasis: mood, palette: pal, limitN: n, gradShape: shape });
          t.grad.build(cl);
          const k = `grad ${mood} ${pal} ${n} ${shape}`;
          assert.equal(laid(t), want[k], k);
        }
    const idx = JSON.parse(
      E('JSON.stringify(COLORS.map((c, i) => i).filter((i) => state.owned.has(mkey(i))))'),
    );
    for (const mood of ['neutral', 'vivid'])
      for (const n of [6, 8, 12, 16])
        assert.equal(
          [...t.grad.rainbow(n, mood, idx)].join(','),
          want[`rainbow ${mood} ${n}`],
          `rainbow ${mood} ${n}`,
        );
  });
  test('a Temperature keeps its own families: Warm’s one plum at its red-violet edge (RV316) isn’t brought back as a violet', () => {
    const { t } = appWith();
    page(t, 18, 12);
    style(t, { palette: 'warm' });
    const items = [...t.grad.inclPool(216).items];
    assert.ok(!items.some((m) => m.code === 'RV316'));
    assert.ok(items.every((m) => t.grad.vivid(m)));
  });
  test('data: Ohuhu V013 is “Violet”; E415, E69 and Y34 as they were', () => {
    const data = JSON.parse(readFileSync(new URL('../src/data/markers.json', import.meta.url), 'utf8'));
    const name = (c) => data.find((m) => m.brand === 'Ohuhu' && m.code === c).name;
    assert.equal(name('V013'), 'Violet');
    assert.equal(name('E415'), 'Cedar brown');
    assert.equal(name('E69'), 'Russet brown');
    assert.equal(name('Y34'), 'Eggnog yellow');
  });
  test('txtWeak: the 21 of the 722 colours neither dark text nor white reads on at 4.5:1 (R413, B315, V015…; not Y28)', () => {
    const { E } = appWith();
    const weak = JSON.parse(
      E('JSON.stringify(COLORS.filter((c) => txtWeak(c.hex)).map((c) => c.brand + " " + c.code))'),
    );
    assert.equal(weak.length, 21);
    for (const c of ['Ohuhu R413', 'Ohuhu B315', 'Ohuhu V015', 'Ohuhu R014', 'Copic YR18', 'Copic B06'])
      assert.ok(weak.includes(c), c);
    assert.ok(!weak.includes('Ohuhu Y28'));
    assert.equal(E('txtWeak("#ffffff") || txtWeak("#000000")'), false);
  });
}

// ---- from v314-gradient.test.mjs ----
// v314 (D8): a Gradient made since v314 (gradArea 1), laid Polished or Natural, shares its run of markers out by each
// section's area to the power 0.7, so one huge section takes less of the run and the small ones aren't left with
// markers seen only on specks; a guide saved before (gradArea 0), and Textured, Sparkle and Confetti, as v313 laid them.
// gradArea is saved only when 1.
{
  // one big section (3000) and ten small ones (100 each), shared out to four markers
  function split(soft) {
    const core = createApp().__mstest;
    core.comps = [null, { area: 3000 }, ...Array.from({ length: 10 }, () => ({ area: 100 }))];
    const items = Array.from({ length: 11 }, (_, i) => i + 1);
    return [...core.grad.splitByArea(items, [1, 1, 1, 1], [1, 1, 1, 1], soft)].map((p) => p.length);
  }
  test('a guide saved before v314: the run shared by plain area, as v313 did (the big section takes three markers’ worth, two markers get a speck each)', () => {
    assert.deepEqual(split(false), [1, 1, 1, 8]);
  });
  test('a guide made since v314: by area to the power 0.7, the small sections shared out more evenly', () => {
    assert.deepEqual(split(true), [1, 1, 4, 5]);
  });
  test('gradArea: saved beside the section settings when set (1 in v314; 2 since v315), opens as saved, 0 otherwise', () => {
    const core = createApp().__mstest,
      f = [...core.styleFields].find((x) => x.key === 'gradArea');
    assert.equal(f.in, 'payload');
    assert.equal(f.undo, false);
    assert.equal(f.check(1, f.def), 1);
    assert.equal(f.check(undefined, f.def), 0);
    assert.equal(f.check(0.7, f.def), 0);
    core.styleVars.gradArea = 0;
    assert.equal(f.save(), undefined);
    core.styleVars.gradArea = 1;
    assert.equal(f.save(), 1);
  });
}

// ---- from v315-gradient.test.mjs ----
// v315 (Q5, Q11): a Gradient made since v315 (gradArea 2) shares its run out by plain area unless a marker would land
// only on specks (under 0.3% of the page), then softer and softer until none does; a section you pinned that is bigger
// than one marker's share counts for nothing, so the others spread over the rest (not a section kept only because it's
// coloured); and no two markers in the run are within RAINBOW_NEED of each other while one further off is near. A
// guide made in v314 (1) or before (0) is laid as it was. Fails on v314.1.
{
  // a page: one big section on the left, a grid of 16 px boxes on the right; Ben's markers
  function setup() {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest,
      A = core.assign;
    if (A.quiet) A.quiet();
    const W = 400,
      H = 300,
      g = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const edge = x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || (x >= 238 && x < 242),
          grid = x > 240 && (x % 16 < 2 || y % 16 < 2);
        if (edge || grid) g[y * W + x] = 0;
      }
    core.srcK = 1;
    core.W = W;
    core.H = H;
    core.gray = g;
    core.segment();
    E('state.owned = defaultOwned()');
    core.coll = E('sfCollection()');
    const lay = (ga) => {
      Object.assign(core.styleVars, {
        family: 'gradient',
        gradShape: 'serpentine',
        look: 'auto',
        paletteSource: 'owned',
        palette: 'all',
        limitN: 16,
        gradScat: 0,
        gradArea: ga,
      });
      A.adj = null;
      A.segFresh = true;
      A.sfmode = 'review';
      core.assignData = null;
      A.buildGuide();
    };
    // each marker's share of the page, and the markers on under 0.3% of it
    const shares = () => {
      const M = core.assignData.assign,
        a = {};
      let all = 0;
      for (const l of core.assignData.order) {
        a[M[l].mkey] = (a[M[l].mkey] || 0) + core.comps[l].area;
        all += core.comps[l].area;
      }
      for (const k in a) a[k] /= all;
      return a;
    };
    const specks = () => Object.values(shares()).filter((v) => v < 0.003).length;
    lay(2);
    const big = core.assignData.order.reduce((b, l) => (core.comps[l].area > core.comps[b].area ? l : b));
    return { app, core, A, lay, shares, specks, big };
  }
  test('splitByArea: rule 2 lays as the plain rule unless a part would be a speck, then softens', () => {
    const core = createApp().__mstest,
      split = (areas, soft, zero) => {
        core.comps = [null, ...areas.map((a) => ({ area: a }))];
        const items = areas.map((_, i) => i + 1),
          ones = [1, 1, 1, 1];
        return [...core.grad.splitByArea(items, ones, ones, soft, zero)].map((p) => p.length);
      };
    // no specks either way: as plain
    const even = [500, 400, 600, 300, 500, 400, 600, 300];
    assert.deepEqual(split(even, 2), split(even, 0));
    // a big section, ten tiny ones, four middling: plain leaves the second marker one tiny section (0.1% of the page);
    // rule 2 softens until no part is under 0.3%
    const areas = [3000, ...Array(10).fill(5), 400, 400, 400, 400],
      sums = (soft, zero) => {
        const cut = split(areas, soft, zero);
        let i = 0;
        return cut.map((n) => areas.slice(i, (i += n)).reduce((a, b) => a + b, 0));
      };
    assert.deepEqual(sums(0), [3000, 5, 445, 1200]);
    const tot = 4650;
    assert.ok(Math.min(...sums(2)) >= 0.003 * tot, 'no speck: ' + sums(2));
    // v314's rule as it was (true, as v314 passed it, is 1)
    assert.deepEqual(split(areas, true), split(areas, 1));
    // the big one counting for nothing: the run shared out over the rest
    const z = sums(2, { 1: 1 }),
      rest = [z[0] - 3000, ...z.slice(1)];
    assert.ok(Math.min(...rest) >= 400, 'each marker a fair part of the rest: ' + rest);
  });
  test('a new Gradient (rule 2): fewer markers on specks than the plain rule', () => {
    const { lay, specks } = setup();
    lay(0);
    const plain = specks();
    lay(2);
    assert.ok(specks() < plain, `${specks()} < ${plain}`);
  });
  test('pinning the big section (rule 2): the other markers spread over the rest; a coloured one held for a re-lay counts as before', () => {
    const { core, lay, shares, big } = setup();
    const others = () =>
      core.assignData.order
        .filter((l) => l !== big)
        .map((l) => core.assignData.assign[l].mkey)
        .join(',');
    lay(2);
    const plain = others();
    // coloured, not pinned: held by the re-lay, laid as before
    core.colored[big] = 1;
    core.reassign();
    assert.equal(others(), plain, 'a coloured section isn’t a pin');
    core.colored[big] = 0;
    // pinned
    lay(2);
    const pk = core.assignData.assign[big].mkey;
    core.locks[big] = pk;
    core.reassign();
    assert.notEqual(others(), plain);
    const s = shares();
    for (const k in s) if (k !== pk) assert.ok(s[k] > 0.01, k + ' on more than specks: ' + s[k]);
    delete core.locks[big];
    // rule 1 (v314): a pin changes nothing
    lay(1);
    const v314 = others();
    core.locks[big] = core.assignData.assign[big].mkey;
    core.reassign();
    assert.equal(others(), v314);
    delete core.locks[big];
  });
  test('rule 2: no two markers in the run within RAINBOW_NEED of each other (Ben’s B111 and B112); rule 1 as before', () => {
    const { core, lay, app } = setup();
    const close = () => {
      const ms = [
        ...new Map(
          core.assignData.order.map((l) => [core.assignData.assign[l].mkey, core.assignData.assign[l]]),
        ).values(),
      ];
      let n = 0;
      for (let i = 0; i < ms.length; i++)
        for (let j = i + 1; j < ms.length; j++) if (app.de2000(ms[i].lab, ms[j].lab) < 5) n++;
      return n;
    };
    lay(1);
    assert.ok(close() > 0, 'v314’s run has a near pair here');
    lay(2);
    assert.equal(close(), 0);
  });
  test('gradArea: saved beside the section settings when set (2 for a new guide; 3 since v318, 4 since v318.10, 5 since v318.11), opens as saved, 0 otherwise', () => {
    const core = createApp().__mstest,
      f = [...core.styleFields].find((x) => x.key === 'gradArea');
    assert.equal(f.check(2, f.def), 2);
    assert.equal(f.check(1, f.def), 1);
    assert.equal(f.check(3, f.def), 3);
    assert.equal(f.check(4, f.def), 4);
    assert.equal(f.check(5, f.def), 5);
    assert.equal(f.check(6, f.def), 0);
    core.styleVars.gradArea = 2;
    assert.equal(f.save(), 2, 'a 2 is saved as 2, not 1');
    core.styleVars.gradArea = 0;
    assert.equal(f.save(), undefined);
  });
}

// ---- from v318-gradient-twins.test.mjs ----
// v318 (gradArea 3, new guides only): smoothing keeps touching sections off markers under TWIN_DE (2.5 CIEDE2000) of
// each other, which read as one colour; the markers a run picks are as before. A guide saved before (gradArea 2) lays
// as it did. Fails on v318 as shipped.
{
  // a grid of cells w x h, each a section, every one counted
  function gridApp(cols, rows, ownedJs) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    E(ownedJs || 'state.owned = defaultOwned()');
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
    return { E, t, de: E('de2000') };
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
        gradScat: 0,
      },
      vars,
    );
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    t.assign.buildGuide();
    return t.assignData;
  }
  const markers = (ad) => [...new Map(Object.values(ad.assign).map((m) => [m.mkey, m])).values()];
  function twins(a, ms) {
    let n = 0;
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) if (a.de(ms[i].lab, ms[j].lab) < 2.5) n++;
    return n;
  }
  test('a new guide takes gradArea 3 or later (4 since v318.10)', () => {
    const a = gridApp(4, 4);
    assert.ok(a.t.styleVars.gradArea >= 3);
  });
  test('Pastel 24, Soft 24, Deep 32 on Ben’s markers: gradArea 3 picks the same markers as 2', () => {
    const a = gridApp(12, 10);
    const k = (ad) =>
      markers(ad)
        .map((m) => m.mkey)
        .sort()
        .join();
    for (const [emphasis, limitN] of [
      ['pastel', 24],
      ['muted', 24],
      ['deep', 32],
    ])
      assert.equal(
        k(lay(a, { gradArea: 2, emphasis, limitN })),
        k(lay(a, { gradArea: 3, emphasis, limitN })),
        emphasis,
      );
  });
  test('Any and Bright pick from the whole set as before (no tiers): the same markers under 2 and 3', () => {
    const a = gridApp(12, 10);
    for (const emphasis of ['neutral', 'vivid']) {
      const k = (ad) =>
        markers(ad)
          .map((m) => m.mkey)
          .sort()
          .join();
      assert.equal(
        k(lay(a, { gradArea: 2, emphasis, limitN: 16 })),
        k(lay(a, { gradArea: 3, emphasis, limitN: 16 })),
      );
    }
  });
  test('smoothing at all your markers: fewer touching sections on near twins at gradArea 3', () => {
    const a = gridApp(14, 12);
    const touchTwins = (ad) => {
      const adj = a.t.adj;
      let n = 0;
      for (const l of ad.order)
        for (const q of adj[l] || [])
          if (
            q > l &&
            ad.assign[q] &&
            ad.assign[q].mkey !== ad.assign[l].mkey &&
            a.de(ad.assign[q].lab, ad.assign[l].lab) < 2.5
          )
            n++;
      return n;
    };
    const was = touchTwins(lay(a, { gradArea: 2, emphasis: 'neutral', limitN: 999 })),
      now = touchTwins(lay(a, { gradArea: 3, emphasis: 'neutral', limitN: 999 }));
    assert.ok(now < was, `touching twins ${was} → ${now}`);
  });
}

// ---- from v31811-shuffle.test.mjs ----
// v318.11 (gradArea 5, new guides only): Shuffle on a Gradient that runs light to dark (a ramp, not a loop round the
// colour wheel) moves where each marker hands over to the next, so it always changes the guide; its order and markers
// stay. Pastel on Honolulu 120 had given the same guide back Shuffle after Shuffle. A guide at gradArea 4 and before,
// a loop, and the first build (gradSeed 0) lay as before. Fails on v318.10.
{
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
}
