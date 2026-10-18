// v318.1: a part of a cap read as a code of its own. On the page: a code inside a longer one read in the same place
// ("V91" of RV91, "Y00" of BGY00) is left out, and taken back out of the list when it went in at once;
// a code read for sure whose names are another marker's ("V91" with Grayish Cherry, RV91's) is asked about. In the
// engine: a box read whole as one of its halves reads ("GY00", its halves "GY00" and "Y00") keeps no other half.
// Each fails before v318.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from './harness.mjs';

// (as in v318-ocr: each line through ocrLine as it comes, then ocrDone; readings made up here)
function run(brand, texts) {
  const app = createApp();
  return JSON.parse(
    app.__eval(
      '(function () {' +
        'scanList = []; scanBrand = ' +
        JSON.stringify(brand) +
        ';' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r;' +
        'const lines = ' +
        JSON.stringify(texts) +
        '.map((t, k) => ({ id: k + 1, look: t[4] || 1, text: t[0], conf: 0.97, unsure: !!t[1], nameOf: t[2] || 0, box: t[3] || [0, 0, 1, 1, 0] }));' +
        'const keys = () => scanList.filter((e) => !e.ask).map((e) => mkey(e.i));' +
        'lines.forEach((it) => ocrLine(r, it));' +
        'const streamed = keys();' +
        'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ streamed: streamed, list: keys(), added: r.added,' +
        ' photo: scanList.every((e) => e.photo === 1),' +
        ' titles: scanList.filter((e) => e.ask).map((e) => e.title + " " + e.opts.map((o) => mkey(o.i)).join(",")) });' +
        '})()',
    ),
  );
}
// (a tray plainly Copic's: codes only Copic has)
const CO = ['R46', 'BV00', 'E74', 'YG63', 'W-3', 'C-5', 'G85'].map((c, k) => [
  c,
  false,
  0,
  [k * 100, 900, 60, 30, 0],
]);

test('a code inside a longer one read in the same place is that cap read short: left out, and out of the list again', () => {
  const o = run(
    '',
    CO.concat([
      ['RV91', false, 0, [300, 300, 90, 34, 10]],
      // (the second look's box over the same cap, its first letter lost)
      ['V91', false, 0, [312, 302, 64, 32, 12], 2],
    ]),
  );
  // (v318.12: a code that's a longer one's tail, V91 of RV91, no longer goes in at once: it waits for the end, read
  // again for its lost first letter, ocrWidenWait)
  assert.ok(!o.streamed.includes('Copic|V91'), 'it waited');
  assert.ok(o.list.includes('Copic|RV91'));
  assert.ok(!o.list.includes('Copic|V91'), o.list.join(' '));
  assert.equal(o.added, o.list.length);
});

test('the same short code on a cap of its own, or with its own name, stays', () => {
  const o = run(
    '',
    CO.concat([
      ['RV91', false, 0, [300, 300, 90, 34, 10]],
      // (elsewhere on the photo: another cap)
      ['V91', false, 0, [800, 600, 64, 32, 0]],
    ]),
  );
  assert.ok(o.list.includes('Copic|V91') && o.list.includes('Copic|RV91'), o.list.join(' '));
  const n = run(
    '',
    CO.concat([
      ['RV91', false, 0, [300, 300, 90, 34, 10]],
      ['V91', false, 0, [312, 302, 64, 32, 12]],
      ['Pale Grape', false, CO.length + 2, [312, 330, 90, 20, 12]],
    ]),
  );
  assert.ok(n.list.includes('Copic|V91'), 'its own name read with it: ' + n.list.join(' '));
});

test('a short scrap read as an old code (Ohuhu G3, now G311) inside a longer code (G316) isn’t that marker', () => {
  const OH = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112'].map((c, k) => [
    c,
    false,
    0,
    [k * 100, 900, 60, 30, 0],
  ]);
  const o = run(
    '',
    OH.concat([
      ['G316', false, 0, [400, 400, 90, 34, 0], 2],
      ['G3', false, 0, [392, 401, 70, 33, 0]],
    ]),
  );
  assert.ok(o.list.includes('Ohuhu|G316'));
  assert.ok(!o.list.includes('Ohuhu|G311'), o.list.join(' '));
});

test('a code read for sure with another marker’s name is asked about, not kept as read', () => {
  const o = run(
    '',
    CO.concat([
      ['V91', false, 0, [246, 15, 85, 47, 30]],
      ['Grayish Cherry', false, CO.length + 1, [250, 50, 110, 22, 30]],
    ]),
  );
  assert.ok(!o.streamed.includes('Copic|V91'), 'it waited (v318.12)');
  assert.ok(!o.list.includes('Copic|V91') && !o.list.includes('Copic|RV91'), o.list.join(' '));
  assert.equal(o.titles.length, 1, o.titles.join(' | '));
  assert.match(o.titles[0], /don’t match.*Copic\|V91.*Copic\|RV91|don’t match.*Copic\|RV91.*Copic\|V91/);
  assert.ok(o.photo, 'the question is the photo’s, for Undo this photo');
  // (its own name: kept)
  const b = run(
    '',
    CO.concat([
      ['V91', false, 0, [246, 15, 85, 47, 30]],
      ['Pale Grape', false, CO.length + 1, [250, 50, 110, 22, 30]],
    ]),
  );
  assert.ok(b.list.includes('Copic|V91'));
  assert.equal(b.titles.length, 0);
});

// --- the engine, with made-up models: a detector that finds one tall box, a recogniser that reads what it's told
const ENGINE = readFileSync(new URL('../src/js/ocr/engine.js', import.meta.url), 'utf8');
const DICT = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function fakeOrt(reads) {
  let k = 0;
  class Tensor {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  }
  const det = {
    inputNames: ['x'],
    outputNames: ['y'],
    run: async (feeds) => {
      const [, , H, W] = feeds.x.dims,
        n = feeds.x.dims[0],
        p = new Float32Array(n * H * W);
      // (a block of text 120 × 50 in the middle of each map)
      for (let b = 0; b < n; b++)
        for (let y = (H >> 1) - 25; y < (H >> 1) + 25; y++)
          for (let x = (W >> 1) - 60; x < (W >> 1) + 60; x++)
            if (x >= 0 && y >= 0 && x < W && y < H) p[b * H * W + y * W + x] = 1;
      return { y: { data: p, dims: [n, 1, H, W] } };
    },
  };
  const rec = {
    inputNames: ['x'],
    outputNames: ['y'],
    run: async () => {
      const [text, conf] = reads[k++] || ['', 0],
        C = DICT.length + 2,
        T = 2 * text.length + 2,
        p = new Float32Array(T * C);
      for (let t = 0; t < T; t++) p[t * C] = 1;
      [...text].forEach((ch, i) => {
        const o = (2 * i + 1) * C;
        p[o] = 0;
        p[o + DICT.indexOf(ch) + 1] = conf;
      });
      return { y: { data: p, dims: [1, T, C] } };
    },
  };
  let s = 0;
  return {
    Tensor,
    InferenceSession: { create: async () => [det, rec][s++] },
  };
}
async function readTall(halfBox) {
  const OCR2 = new Function(ENGINE + '\nreturn OCR2;')();
  // (the whole box read unsure as GY00, again turned over as nothing; its halves GY00 and Y00)
  const ort = fakeOrt([
    ['GY00', 0.85],
    ['', 0],
    ['GY00', 0.83],
    ['Y00', 0.77],
  ]);
  const reader = await OCR2.create(ort, new Uint8Array(1), new Uint8Array(1), DICT.join('\n'), null);
  const img = { width: 320, height: 320, data: new Uint8ClampedArray(320 * 320 * 4).fill(200) },
    told = [];
  const r = await reader.read(
    img,
    { maxSide: 320, split: 2.5, retry: true, halfBox: halfBox },
    { line: (it) => told.push(it.best.text) },
  );
  return { lines: r.lines.map((it) => it.best.text), told: told };
}

test('engine: a box read whole as one of its halves keeps no other half (GY00 / Y00), told to the page or not', async () => {
  const off = await readTall(false);
  assert.ok(off.lines.includes('Y00'), 'without the rule, as before: ' + off.lines.join(' '));
  const on = await readTall(true);
  assert.ok(!on.lines.includes('Y00'), on.lines.join(' '));
  assert.ok(!on.told.includes('Y00'), 'nor streamed to the page as it was read');
  assert.ok(on.lines.includes('GY00'));
});
