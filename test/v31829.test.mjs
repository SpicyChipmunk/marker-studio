// v318.29: Ohuhu RV33 Thistle and RV34 Faded Lilac no longer share one colour. Measured on Ben's own scanned swatch card
// (Color Swatch 2, side by side): about 1.25 apart (CIEDE2000), RV33 the warmer. RV34 keeps the list's #efd4e7 (the
// nearer of the two to it); RV33 is that far from it, in the scanned direction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

test('RV33 and RV34: two colours, about as far apart as on the swatch card, RV34 as before', () => {
  const a = createApp(),
    E = a.__eval;
  const ix = (c) => E(`COLORS.findIndex((m) => m.brand === 'Ohuhu' && m.code === '${c}')`);
  const i = ix('RV33'),
    j = ix('RV34');
  assert.equal(E(`COLORS[${j}].hex`), '#efd4e7');
  assert.equal(E(`COLORS[${i}].hex`), '#edd5e5');
  const d = +E(`de2000(LAB[${i}], LAB[${j}])`);
  assert.ok(d > 1 && d < 1.5, 'apart by ' + d);
  // no two inked markers share a colour now (the Colorless Blenders are white, and aren't matched)
  const dup = E(
    `(() => { const s = new Map(); let n = 0; COLORS.forEach((m, k) => { if (NOINK.has(k)) return; const h = m.hex.toLowerCase(); if (s.has(h)) n++; s.set(h, k); }); return n; })()`,
  );
  assert.equal(dup, 0);
});

test('a rough spot’s ring sits on the line two sections share, not on the code of a shape inside another', () => {
  const core = createApp().__mstest;
  // a 100 × 100 page: a square (2) inside another (1), a 2 px line between them
  const W = 100,
    H = 100,
    labels = new Int32Array(W * H).fill(1);
  for (let y = 28; y < 72; y++)
    for (let x = 28; x < 72; x++) labels[y * W + x] = x < 30 || x >= 70 || y < 30 || y >= 70 ? 0 : 2;
  core.W = W;
  core.H = H;
  core.labels = labels;
  core.comps = [
    null,
    { cx: 50, cy: 15, area: 8064, merged: false, bg: false },
    { cx: 50, cy: 50, area: 1600, merged: false, bg: false },
  ];
  const [p] = core.grad.roughPts([[1, 2, 30]]);
  // on the line (within a few pixels of the inner square's edge), well away from its middle where its code is
  const edge = Math.min(Math.abs(p.x - 29), Math.abs(p.x - 70), Math.abs(p.y - 29), Math.abs(p.y - 70));
  assert.ok(edge <= 3, 'on the line: ' + JSON.stringify(p));
  assert.ok(Math.hypot(p.x - 50, p.y - 50) >= 15, 'away from the code: ' + JSON.stringify(p));
});
