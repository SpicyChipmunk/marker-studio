// Round-trip tests for guide persistence, driven through the seam with the
// harness's lossless canvas/Image polyfill; and opening guide files safely.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core, app } from './harness.mjs';

// Decode a label-map data URL the way openDesignObj does (Image -> drawImage ->
// getImageData -> v-1). Returns the recovered Int32Array of labels.
function decodeLmap(url, W, H) {
  let out = null;
  const img = new app.Image();
  img.onload = () => {
    const c = app.document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, W, H).data;
    out = new Int32Array(W * H);
    for (let p = 0, j = 0; p < W * H; p++, j += 4) {
      const v = d[j] | (d[j + 1] << 8) | (d[j + 2] << 16);
      out[p] = v === 0 ? -1 : v - 1;
    }
  };
  img.src = url;
  return out;
}

test('lmapURL() round-trips the label map losslessly', () => {
  const W = 8, H = 6, n = W * H;
  const lab = new Int32Array(n);
  for (let i = 0; i < n; i++) lab[i] = (i % 7 === 0) ? -1 : (i % 4); // labels 0..3 + ink
  core.W = W; core.H = H; core.labels = lab;

  const url = core.lmapURL();
  const recovered = decodeLmap(url, W, H);
  assert.ok(recovered, 'decode ran');
  for (let i = 0; i < n; i++) assert.equal(recovered[i], lab[i], `pixel ${i}`);
});

test('lmapURL() preserves labels above 255 (multi-byte encoding)', () => {
  const W = 4, H = 4, n = W * H;
  const lab = new Int32Array(n).fill(300); // > 255 exercises the g/b bytes
  lab[0] = -1; lab[5] = 70000;             // and > 65535 exercises the third byte
  core.W = W; core.H = H; core.labels = lab;

  const recovered = decodeLmap(core.lmapURL(), W, H);
  for (let i = 0; i < n; i++) assert.equal(recovered[i], lab[i], `pixel ${i} (label ${lab[i]})`);
});

test('currentDesignObj() persists Toggle state and settings (v227 #2)', () => {
  const W = 4, H = 4;
  core.W = W; core.H = H; core.labels = new Int32Array(W * H).fill(1);
  core.secState = new Uint8Array([0, 1, 0, 2]); // label 1 -> include, label 3 -> exclude
  core.colored = new Uint8Array([0, 0, 0, 0]);
  core.minPos = 33; core.bgTrim = 40; core.addAutoClose = true;
  core.curName = 'Test Guide'; // avoids the name-generator path
  core.assignData = { order: [1, 3], assign: { 1: { mkey: 'Ohuhu|120' }, 3: { mkey: 'Copic|100' } }, N: 2 };

  const d = core.currentDesignObj();
  assert.ok(d, 'design object built');
  // (minSize on the slider's scale since v277; minPos is the same size on the old scale, for older copies)
  assert.equal(d.payload.minSize, 33);
  assert.equal(d.payload.minPos, 7);
  assert.equal(d.payload.bgTrim, 40);
  assert.equal(d.payload.addAutoClose, true);
  // sparse map: only non-auto states, keyed by label
  assert.deepEqual({ ...d.payload.secStates }, { 1: 1, 3: 2 });
  // lmap present and non-trivial
  assert.ok(typeof d.payload.lmap === 'string' && d.payload.lmap.startsWith('data:'), 'lmap encoded');
});

// ---- From the persistence / import-safety fixes ----
test('esc() and safeThumb() neutralise markup', () => {
  assert.equal(app.esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  assert.equal(app.safeThumb('data:image/jpeg;base64,AAAA+/=='), 'data:image/jpeg;base64,AAAA+/==');
  assert.equal(app.safeThumb('data:image/jpeg;base64,AA" onerror="x'), '');
  assert.equal(app.safeThumb('javascript:alert(1)'), '');
  assert.equal(app.safeThumb(null), '');
});

test('generated-palette source is saved with the guide (was always [])', () => {
  const W = 4, H = 4;
  core.W = W; core.H = H; core.labels = new Int32Array(W * H).fill(1);
  core.secState = new Uint8Array([0, 0]); core.colored = new Uint8Array([0, 0]);
  core.curName = 'Gen test';
  core.assignData = { order: [1], assign: { 1: { mkey: 'Ohuhu|120' } }, N: 1 };
  core.genPal = ['Ohuhu|120', 'Copic|100', 7];
  const d = core.currentDesignObj();
  const gp = [...d.payload.style.genPal];
  assert.equal(gp.length, 3);
  assert.equal(gp[0], 'Ohuhu|120');
  assert.equal(gp[1], 'Copic|100');
  assert.equal(app.keyIdx(gp[2]), 7, 'numeric entries are converted to marker keys');
});

// v248: a guide file that isn't a guide is turned away before anything changes
test('opening something that is not a guide changes nothing', () => {
  core.W = 4; core.H = 4; core.labels = new Int32Array(16).fill(1);
  const before = core.assignData = { assign: {}, order: [], N: 0 };
  core.openDesignObj({ lmap: 'https://example.com/x.png', W: 50000, H: 50000 }, 99);
  assert.equal(core.assignData, before);
  core.openDesignObj({ lmap: 12 }, 99);
  assert.equal(core.assignData, before);
});
