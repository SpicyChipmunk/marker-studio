// v306 debugging pass (the colour engines): fixes found after merging the four branches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

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
