// v308.2 (a review of getting a picture in and the Plan): with a small collection the marker count's end is what
// "all" lays, so every count up to it can be chosen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(sets) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  E('state.owned = new Set()');
  for (const n of sets)
    E(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
    );
  t.coll = E('sfCollection()');
  t.assign.quiet();
  return { app, E, t };
}
// cols × rows sections, 20 px square, 2 px lines between them
function page(t, cols, rows) {
  const cell = 20,
    lw = 2,
    W = cols * (cell + lw) + lw,
    H = rows * (cell + lw) + lw,
    labels = new Int32Array(W * H).fill(-1),
    comps = [null];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const l = comps.length,
        x0 = lw + c * (cell + lw),
        y0 = lw + r * (cell + lw);
      comps.push({
        area: cell * cell,
        bg: false,
        bpx: 0,
        cx: x0 + cell / 2,
        cy: y0 + cell / 2,
        h: cell - 1,
        x0,
        y0,
        x1: x0 + cell - 1,
        y1: y0 + cell - 1,
        merged: false,
      });
      for (let y = y0; y < y0 + cell; y++) labels.fill(l, y * W + x0, y * W + x0 + cell);
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
      gradIncl: {},
    },
    o,
  );
const usedN = (t) => new Set(t.assignData.order.map((l) => t.assignData.assign[l].mkey)).size;

test('a 12-marker set: the count’s end is what “all” lays, and the count one under it lays one fewer', () => {
  const { t } = appWith(['Ciao 12']);
  const cl = page(t, 14, 10);
  for (const palette of ['all', 'cool']) {
    style(t, { palette });
    const all = t.grad.countNow();
    // (fewer than 8 left after the Include row and the vivid test, so "all" takes in the nearest ones)
    assert.ok(all.all && all.M >= 3, palette + ': all lays ' + all.M);
    assert.equal(t.grad.mkCap(), all.M, palette + ': the slider ends at what all lays');
    assert.equal(t.grad.mkCountLabel(), 'all · ' + all.M);
    t.grad.build(cl);
    assert.equal(usedN(t), all.M);
    // one under the end is a count, not all, and lays that many
    style(t, { palette, limitN: all.M - 1 });
    assert.equal(t.grad.mkCountLabel(), String(all.M - 1));
    assert.equal(t.grad.countNow().M, all.M - 1);
    t.grad.build(cl);
    assert.equal(usedN(t), all.M - 1);
  }
});
