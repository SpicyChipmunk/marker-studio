// Focus mode walks one section at a time: colours light -> dark, and within a
// colour from its top-most section to the nearest remaining one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

// 10 x 10 grid of 10px cells; section id = 1 + row*10 + col.
function grid(assignFor) {
  const W = 100, H = 100, labels = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) labels[y * W + x] = 1 + ((y / 10) | 0) * 10 + ((x / 10) | 0);
  const assign = {}, order = [];
  for (let l = 1; l <= 100; l++) { const r = ((l - 1) / 10) | 0, c = (l - 1) % 10, a = assignFor(r, c); if (a) { assign[l] = a; order.push(l); } }
  core.W = W; core.H = H; core.labels = labels;
  core.comps = [null, ...Array.from({ length: 100 }, () => ({ area: 100, cx: 0, cy: 0 }))];
  core.colored = new Uint8Array(101);
  core.assignData = { order, assign, N: order.length };
  core.buildFocusOrder();
  return [...core.focusOrd];
}
const LIGHT = { mkey: 'Ohuhu|L', hex: '#f4f0e8' }, MID = { mkey: 'Ohuhu|M', hex: '#80a0c0' }, DARK = { mkey: 'Ohuhu|D', hex: '#202030' };

test('every counted section appears exactly once', () => {
  const ord = grid((r, c) => (c < 3 ? LIGHT : c < 7 ? DARK : r < 5 ? MID : null));
  assert.equal(ord.length, core.assignData.N);
  assert.equal(new Set(ord).size, ord.length);
});

test('colours are ordered light to dark, one colour at a time', () => {
  const ord = grid((r, c) => (c < 3 ? DARK : c < 6 ? LIGHT : MID));
  const runs = [];
  for (const l of ord) { const k = core.assignData.assign[l].mkey; if (runs[runs.length - 1] !== k) runs.push(k); }
  assert.deepEqual(runs, ['Ohuhu|L', 'Ohuhu|M', 'Ohuhu|D']);
});

test('within a colour it starts at the top and steps to a neighbour', () => {
  // one colour in a diagonal band; each step should move at most one cell
  const ord = grid((r, c) => (Math.abs(r - c) <= 1 ? LIGHT : null));
  const rc = (l) => [((l - 1) / 10) | 0, (l - 1) % 10];
  assert.equal(rc(ord[0])[0], 0, 'starts on the top row');
  for (let i = 1; i < ord.length; i++) {
    const [r0, c0] = rc(ord[i - 1]), [r1, c1] = rc(ord[i]);
    assert.ok(Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) <= 1, `hop ${i} is to an adjacent cell`);
  }
});

test('next skips finished sections and wraps; -1 when all are done', () => {
  const ord = grid((r, c) => (r === 0 && c < 4 ? LIGHT : null));
  core.colored[ord[1]] = 1;
  assert.equal(core.nextUndone(0), 2, 'skips the coloured one');
  core.colored[ord[2]] = 1; core.colored[ord[3]] = 1;
  assert.equal(core.nextUndone(3), 0, 'wraps to the start');
  core.colored[ord[0]] = 1;
  assert.equal(core.nextUndone(0), -1);
});
