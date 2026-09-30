// Unit checks for the speed work: packed undo snapshots round-trip exactly and stay small,
// and the section-map signature notices any change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

test('undo snapshots pack the section map and unpack it exactly', () => {
  const W = 300, H = 200, a = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = (x % 50 === 0 || y % 40 === 0) ? -1 : 1 + ((x / 50) | 0) + 6 * ((y / 40) | 0);
  const p = core.packLabels(a);
  assert.ok(p.z.length * 4 < a.length * 4 / 10, 'packed well under a tenth of the size');
  const b = core.unpackLabels(p);
  assert.equal(b.length, a.length);
  assert.ok(a.every((v, i) => v === b[i]), 'identical after unpacking');
  // edge cases: empty, one value, all different
  assert.equal(core.unpackLabels(core.packLabels(new Int32Array(0))).length, 0);
  const one = core.unpackLabels(core.packLabels(new Int32Array(7).fill(3)));
  assert.deepEqual([...one], [3, 3, 3, 3, 3, 3, 3]);
  const mixed = Int32Array.from([1, 2, 3, -1, -1, 4]);
  assert.deepEqual([...core.unpackLabels(core.packLabels(mixed))], [...mixed]);
});

test('the section-map signature changes when any single pixel changes', () => {
  core.W = 64; core.H = 48; core.labels = new Int32Array(64 * 48).fill(2);
  const s1 = core.labelsSig();
  core.labels[1234] = 3; const s2 = core.labelsSig();
  core.labels[1234] = 2; core.labels[1235] = 3; const s3 = core.labelsSig();
  // swapping two values between positions must not collide either
  core.labels[1235] = 2; core.labels[10] = 5; core.labels[11] = 6; const s4 = core.labelsSig();
  core.labels[10] = 6; core.labels[11] = 5; const s5 = core.labelsSig();
  assert.equal(new Set([s1, s2, s3, s4, s5]).size, 5);
});
