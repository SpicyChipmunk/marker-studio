// v305 (the Gradient, 30-palette-assign): a smoothing pass after the Gradient is laid swaps the markers of sections near
// each other along the flow where that lowers the clash between touching sections, with guards so the gradient stays
// as laid: each marker moves at most a window (sections / 30, 2 to 12) from its place; the flow's first section keeps
// the Start colour; with several sections to a marker only sections of about the same size swap (each marker keeps
// its share of the picture); with the marker count at all your markers no new pair of touching sections shares one;
// pinned sections and those with ink on the paper stay. Deterministic (a fixed number of passes, no clock), quick, and
// the Gradient's own (not the Photo pattern before it has a photo, nor Random or Blend). And a fifth Flow, Around:
// round Radial's centre, out and back when the markers don't go right round the colour wheel, so there's no seam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, cpuMs } from './harness.mjs';

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
          assert.ok(Math.abs(before.indexOf(k) - i) <= s.win, `${what}: ${k} moved ${before.indexOf(k) - i}`),
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
      if (t.grad.smoothed.mode === 'reuse') assert.ok(a.same.size < b.same.size, shape + ': split up');
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
    comps.push({ area: 0, bg: false, bpx: 0, cx: 0, cy: 0, x0: W, y0: H, x1: 0, y1: 0, h: 0, merged: false });
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
