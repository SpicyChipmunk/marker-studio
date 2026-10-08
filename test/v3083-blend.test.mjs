// v308.3 Blend's choice of markers (blendChoose, 30-palette-assign): the count's worth of the sections' ideal markers
// that best cover them, the anchors' own always among them, the same every time. (In the browser, on the sample:
// e2e/v3083-blend.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp(),
  t = app.__mstest,
  E = app.__eval;
// 60 real markers spread round the colours, each the ideal of some sections (weights 1 to 7)
const U = E(
  'COLORS.filter((c, i) => i % 7 === 0).slice(0, 60).map((c) => ({ mkey: mkey(COLORS.indexOf(c)), lab: c.lab || hexToLab(c.hex) }))',
);
const wt = Float64Array.from(U.map((_, i) => 1 + (i % 7)));
const de = E('de2000');
// the weighted distance from each ideal to its nearest chosen
const cost = (r) => U.reduce((s, m, i) => s + wt[i] * de(m.lab, U[r.near[i]].lab), 0);

test('never more than N; the anchors’ own kept; each ideal goes to its nearest chosen; the same every time', () => {
  assert.equal(U.length, 60);
  assert.ok(U.every((m) => m.lab && m.lab.length === 3));
  const F = [3, 17, 41];
  let prev = Infinity;
  for (const N of [3, 4, 6, 8, 12, 16, 24, 40]) {
    const r = t.assign.blendChoose(U, wt, F, N),
      pick = [...r.pick];
    assert.equal(new Set(pick).size, N, 'N of them at ' + N);
    for (const f of F) assert.ok(pick.includes(f), 'anchor ' + f + ' kept at ' + N);
    for (let i = 0; i < U.length; i++) {
      const d = de(U[i].lab, U[r.near[i]].lab);
      assert.ok(pick.includes(r.near[i]));
      for (const j of pick) assert.ok(d <= de(U[i].lab, U[j].lab) + 1e-9);
    }
    const c = cost(r);
    assert.ok(c < prev, 'closer with more: ' + N);
    prev = c;
    assert.deepEqual([...t.assign.blendChoose(U, wt, F, N).pick], pick, 'the same again');
  }
  // as many as there are, or more: all of them, each its own
  const all = t.assign.blendChoose(U, wt, F, 60);
  assert.deepEqual([...all.near], [...U.keys()]);
  // more anchors than N: N of the anchors'
  const two = t.assign.blendChoose(U, wt, F, 2);
  assert.equal(two.pick.length, 2);
  assert.ok([...two.pick].every((j) => F.includes(j)));
});

test('better than spreading the count round the colour wheel first (as Blend did before v308.3)', () => {
  // the old way's stand-in: every (60/N)th ideal in hue order
  const byHue = U.map((m, i) => [Math.atan2(m.lab[2], m.lab[1]), i])
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
  for (const N of [8, 16]) {
    const spread = byHue.filter((_, k) => k % (60 / N) < 1).slice(0, N);
    const near = U.map((m) =>
      spread.reduce((b, j) => (de(m.lab, U[j].lab) < de(m.lab, U[b].lab) ? j : b), spread[0]),
    );
    const old = cost({ near }),
      now = cost(t.assign.blendChoose(U, wt, [], N));
    assert.ok(now < old, `${N}: ${now.toFixed(0)} < ${old.toFixed(0)}`);
  }
});
