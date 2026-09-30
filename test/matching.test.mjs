// Tests for the colour-matching subsystem (nearest, pool filtering, keyIdx).
// The matching functions are reachable; COLORS/HS come from a read-only seam.
// The pool is controlled via setPool(), and nearest() is checked against an
// exact reimplementation of its own cost function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, matching } from './harness.mjs';

const COLORS = matching.COLORS, HS = matching.HS;
const hueDist = app.hueDist;

// Exact reference of nearest()'s two-pass cost, over a given pool (index order).
function refNearest(target, pool, opt = {}) {
  const ex = opt.exclude || new Set();
  const minS = opt.minS != null ? opt.minS : 0.16;
  const P = [...pool].sort((a, b) => a - b);
  let best = -1, bc = 1e9;
  for (const i of P) {
    if (ex.has(i)) continue; const o = HS[i]; if (o.s < minS) continue;
    const cost = hueDist(o.h, target) / 180 + (1 - o.s) * 0.15 + (opt.preferL != null ? Math.abs(o.l - opt.preferL) * 0.55 : 0);
    if (cost < bc) { bc = cost; best = i; }
  }
  if (best < 0) for (const i of P) {
    if (ex.has(i)) continue; const o = HS[i];
    const cost = hueDist(o.h, target) / 180 + (opt.preferL != null ? Math.abs(o.l - opt.preferL) * 0.55 : 0);
    if (cost < bc) { bc = cost; best = i; }
  }
  return best;
}

// A spread of saturated markers, and a set of near-neutral (low-sat) markers.
const satPool = [];
for (let i = 0; i < COLORS.length; i++) if (HS[i].s > 0.25) satPool.push(i);
const satSpread = satPool.filter((_, k) => k % 12 === 0).slice(0, 20);
const lowSat = [];
for (let i = 0; i < COLORS.length && lowSat.length < 8; i++) if (HS[i].s < 0.1) lowSat.push(i);

test('fixture sanity: pools are non-trivial', () => {
  assert.ok(satSpread.length >= 8, `sat pool ${satSpread.length}`);
  assert.ok(lowSat.length >= 3, `low-sat pool ${lowSat.length}`);
});

test('nearest() picks the exact minimum-cost marker in the pool', () => {
  app.setPool(satSpread);
  for (const target of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const got = app.nearest(target);
    assert.equal(got, refNearest(target, satSpread), `target ${target}`);
    assert.ok(satSpread.includes(got), `result ${got} in pool`);
  }
  app.setPool(null);
});

test('nearest() honours exclude', () => {
  app.setPool(satSpread);
  const t = 30;
  const first = app.nearest(t);
  const second = app.nearest(t, { exclude: new Set([first]) });
  assert.notEqual(second, first);
  assert.equal(second, refNearest(t, satSpread, { exclude: new Set([first]) }));
  app.setPool(null);
});

test('nearest() returns -1 when everything is excluded', () => {
  const p = satSpread.slice(0, 3);
  app.setPool(p);
  assert.equal(app.nearest(100, { exclude: new Set(p) }), -1);
  app.setPool(null);
});

test('nearest() falls back past the saturation floor for a neutral-only pool', () => {
  app.setPool(lowSat);
  const got = app.nearest(200);
  assert.notEqual(got, -1, 'still returns a marker via the fallback pass');
  assert.ok(lowSat.includes(got));
  assert.equal(got, refNearest(200, lowSat));
  app.setPool(null);
});

test('nearest() respects the preferL (lightness) term', () => {
  app.setPool(satSpread);
  const t = 60;
  assert.equal(app.nearest(t, { preferL: 0.2 }), refNearest(t, satSpread, { preferL: 0.2 }));
  assert.equal(app.nearest(t, { preferL: 0.9 }), refNearest(t, satSpread, { preferL: 0.9 }));
  app.setPool(null);
});

test('nearest() is deterministic', () => {
  app.setPool(satSpread);
  assert.equal(app.nearest(123), app.nearest(123));
  app.setPool(null);
});

test('keyIdx() round-trips a marker key (brand|code)', () => {
  for (const i of [0, 50, 200, 400, 700]) {
    const key = COLORS[i].brand + '|' + COLORS[i].code;
    assert.equal(app.keyIdx(key), i, `keyIdx for ${key}`);
  }
  assert.equal(app.keyIdx('NoSuch|000'), null);
});
