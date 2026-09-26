// Tests for segQuality(): detecting inputs that won't segment well, so the app
// can warn instead of silently producing a bad guide. Calibrated against the
// real jellyfish (good) vs blank / noisy / dark / gradient (bad).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

// Set up a synthetic segmentation state: px pixels, `ink` of them ink (-1),
// and cells with the given areas.
function setup(px, ink, areas) {
  const L = new Int32Array(px).fill(1);
  for (let i = 0; i < ink && i < px; i++) L[i] = -1;
  core.W = px; core.H = 1; core.labels = L;
  const comps = [null];
  for (const a of areas) comps.push({ area: a, merged: false });
  core.comps = comps;
}
const PX = 100000; // tc (tiny cutoff) = PX*0.0005 = 50

test('flags a blank / near-empty image as "faint"', () => {
  setup(PX, 0, [PX]);
  assert.equal(core.segQuality().code, 'faint');
});

test('flags a single-blob (low-contrast) result as "few"', () => {
  setup(PX, 30000, [70000]); // inkFrac 0.3, one section
  assert.equal(core.segQuality().code, 'few');
});

test('flags a mostly-dark image (photo/shaded) as "dark"', () => {
  setup(PX, 60000, [4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000]); // inkFrac 0.6
  assert.equal(core.segQuality().code, 'dark');
});

test('flags an over-segmented (noisy/photo) result as "noisy"', () => {
  const areas = [];
  for (let i = 0; i < 90; i++) areas.push(2);   // tiny fragments
  for (let i = 0; i < 10; i++) areas.push(500); // a few bigger
  setup(PX, 40000, areas);                       // inkFrac 0.4, tinyFrac 0.9
  assert.equal(core.segQuality().code, 'noisy');
});

test('passes clean line art (jellyfish-like profile)', () => {
  const areas = [];
  for (let i = 0; i < 54; i++) areas.push(2);    // ~32% tiny, like the jellyfish
  for (let i = 0; i < 115; i++) areas.push(1000);
  setup(PX, 18000, areas);                        // inkFrac 0.18, N 169, tinyFrac 0.32
  assert.equal(core.segQuality().ok, true);
});

test('segment() sets segWarn end-to-end', () => {
  // blank image -> faint
  core.W = 100; core.H = 100; core.enhance = true; core.gray = new Uint8Array(10000).fill(250);
  core.segment();
  assert.equal(core.segWarn.ok, false);
  assert.equal(core.segWarn.code, 'faint');

  // clean plus -> good
  const W = 40, H = 40, g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.abs(x - 20) < 2 || Math.abs(y - 20) < 2) g[y * W + x] = 0;
  core.W = W; core.H = H; core.gray = g; core.segment();
  assert.equal(core.segWarn.ok, true);
});
