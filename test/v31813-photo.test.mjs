// v318.13, taking a photo of a page: a new picture's Min section size is about 1 mm on the page (in the picture's own
// pixels, whatever size it came at; a small download keeps the old default); the coloured-page warning counts specks at
// the size it was tuned at, whatever Min section size is; a steep photo's note is in the warning box; the faint
// warning's tip names the control that's there; an unsure find on a busy surface starts its corner handles 3% in.
// Fails on v318.12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core, createApp } from './harness.mjs';

const MM = (L) => Math.pow(L / 279.4, 2); // pixels in 1 mm² on a Letter page whose long side is L pixels

test('Min section size for a new picture: about 1 mm on the page, at any size; small pictures keep the default', () => {
  const t = createApp().__mstest;
  t.srcK = 1;
  for (const [w, h] of [
    [1800, 2400],
    [3024, 4032],
    [2400, 1800],
  ]) {
    t.srcDims = { w, h };
    const pos = t.minPosAuto(),
      want = MM(Math.max(w, h));
    t.styleVars.minPos = pos;
    const got = t.minPx(pos);
    assert.ok(Math.abs(got / want - 1) < 0.06, `${w}x${h}: ${got.toFixed(1)} px for ${want.toFixed(1)}`);
    assert.match(t.minMmText(), /^about 1(\.0)? mm$/, t.minMmText());
  }
  // a picture too small for 1 mm to be over the old default's 10 px keeps the default, and none known too
  t.srcDims = { w: 600, h: 800 };
  assert.equal(t.minPosAuto(), t.MIN_DEF);
  t.srcDims = null;
  assert.equal(t.minPosAuto(), t.MIN_DEF);
  // a new picture follows it until Min section size is moved
  t.assign.resetForNewPicture();
  assert.equal(t.minAuto, true);
});

test('Min section size as an enlarged picture is worked on: the same size on the page (srcK)', () => {
  const t = createApp().__mstest;
  t.srcDims = { w: 1500, h: 2000 };
  t.srcK = 1;
  const a = t.minPx(t.minPosAuto());
  t.srcK = 2;
  const b = t.minPx(t.minPosAuto());
  assert.ok(Math.abs(b / (4 * a) - 1) < 0.02, `${a} x4 = ${b}`); // (minPx rounds to whole pixels)
});

// a synthetic segmentation: px pixels, `ink` of them ink, sections of the given areas
function seg(t, px, ink, areas) {
  const L = new Int32Array(px).fill(1);
  for (let i = 0; i < ink && i < px; i++) L[i] = -1;
  t.W = px;
  t.H = 1;
  t.labels = L;
  const comps = [null];
  for (const a of areas) comps.push({ area: a, merged: false });
  t.comps = comps;
}
const fill = (n, a) => Array.from({ length: n }, () => a);

test('coloured page: specks counted at the default size, not the (bigger) Min section size', () => {
  const t = createApp().__mstest;
  t.srcK = 1;
  t.srcDims = null;
  t.srcColour = 0.3;
  // a line page on a wooden table, as taken: 120 small bits of the table (20 px, over the default's 10) and 40 sections;
  // with Min section size raised (82 px) they're left out, but they aren't a coloured page's specks
  t.styleVars.minPos = 70;
  seg(t, 100000, 15000, [...fill(120, 20), ...fill(40, 1500)]);
  assert.notEqual(t.segQuality().code, 'coloured');
  // a coloured page: its colour in specks under 10 px, many to a section
  seg(t, 100000, 15000, [...fill(400, 4), ...fill(40, 1500)]);
  const q = t.segQuality();
  assert.equal(q.code, 'coloured');
  assert.equal(q.retake, true);
});

test('a steep photo: the warning box says so, with Choose another photo; only for a photo chosen now', () => {
  const t = createApp().__mstest;
  t.srcK = 1;
  t.srcDims = null;
  t.srcColour = 0;
  seg(t, 100000, 15000, fill(60, 1500));
  t.pgSteep = true;
  t.pgOrig = null;
  assert.equal(t.segQuality().ok, true, 'a guide opened again: nothing');
  t.pgOrig = { width: 1200, height: 1600 };
  const q = t.segQuality();
  assert.equal(q.code, 'steep');
  assert.equal(q.retake, true);
  assert.match(q.msg, /steep angle/);
  assert.match(q.tip, /holding the phone flatter/);
  t.pgSteep = false;
  assert.equal(t.segQuality().ok, true);
  // another warning says more, and comes first
  t.pgSteep = true;
  seg(t, 100000, 60000, fill(10, 4000));
  assert.equal(t.segQuality().code, 'dark');
});

test('faint: the tip names the control that is there (Sensitivity once Enhance is on)', () => {
  const t = createApp().__mstest;
  t.srcK = 1;
  t.srcDims = null;
  seg(t, 100000, 0, [100000]);
  t.enhance = true;
  assert.match(t.segQuality().tip, /raise Sensitivity/);
  t.enhance = false;
  assert.match(t.segQuality().tip, /turn on Enhance/);
});

test('an unsure find on a busy surface starts its corner handles 3% in; on a plain one, at its outline', () => {
  const q = [
    [100, 200],
    [900, 180],
    [950, 1400],
    [80, 1450],
  ];
  assert.equal(core.pgStartQ({ q, flick: 4.2 }, 1200, 1600), q);
  assert.equal(core.pgStartQ({ q }, 1200, 1600), q);
  const r = core.pgStartQ({ q, flick: core.PG_BUSY + 1.3 }, 1200, 1600).flat(),
    want = [36, 48, 1164, 48, 1164, 1552, 36, 1552];
  assert.ok(
    r.every((v, k) => Math.abs(v - want[k]) < 1e-6),
    r.join(' '),
  );
});
