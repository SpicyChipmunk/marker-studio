// v318.1: read gently (after running out of memory, for a fortnight, or after the app closed mid-read) is the photo at
// 1600 px with the detector in four strips, not 1280 px: in Safari's engine the peak was the same within the noise,
// and 1280 px added wrong codes. Fails on v318.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// (a localStorage of its own: the harness's is a stub)
function store() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
async function sent(setup) {
  const app = createApp({ localStorage: store() });
  const p = app.__eval(
    '(async function () {' +
      setup +
      'let got = null;' +
      'ocrW = { postMessage: (m) => (got = m), terminate() {} };' +
      'ocrReady = Promise.resolve(ocrW);' +
      'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "",' +
      '  img: { w: 4, h: 4, data: { data: new Uint8ClampedArray(64) } } };' +
      'ocrRun = r;' +
      'await ocrGo(r);' +
      'return JSON.stringify({ maxSide: got.o.maxSide, detTiles: got.o.detTiles });' +
      '})()',
  );
  return JSON.parse(await p);
}

test('read gently: 1600 px in four strips, not 1280 px', async () => {
  const normal = await sent('localStorage.removeItem("ms-ocr-low"); localStorage.removeItem("ms-ocr-busy");');
  assert.deepEqual(normal, { maxSide: 1600, detTiles: 1 }, 'a desktop, as before');
  const low = await sent('localStorage.setItem("ms-ocr-low", String(Date.now()));');
  assert.deepEqual(low, { maxSide: 1600, detTiles: 4 });
  const busy = await sent('localStorage.removeItem("ms-ocr-low"); localStorage.setItem("ms-ocr-busy", "1");');
  assert.deepEqual(busy, { maxSide: 1600, detTiles: 4 });
});
