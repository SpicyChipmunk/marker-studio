// v318.12: a Copic code that's the tail of a longer one with a letter more at its head (G03 of YG03) is read again by
// the engine with its box grown by a character at the code's start, and the longer code taken when it reads surely,
// its first character a letter and the rest the code as read; the page holds such a code back from going in at once
// until then, and asks for none of it when the brand chosen is Ohuhu. Fails on v318.11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from './harness.mjs';

// --- the engine, with made-up models (as in v3181-parts): a detector that finds the blocks it's given, a recogniser
// that reads what it's told
const ENGINE = readFileSync(new URL('../src/js/ocr/engine.js', import.meta.url), 'utf8');
const DICT = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function fakeOrt(blocks, reads) {
  const seen = { rec: 0 };
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
      const [n, , H, W] = feeds.x.dims,
        p = new Float32Array(n * H * W);
      // (each block [cx, cy, w, h] in the map's own pixels)
      for (let b = 0; b < n; b++)
        blocks.forEach(([cx, cy, w, h]) => {
          for (let y = Math.round(cy - h / 2); y < cy + h / 2; y++)
            for (let x = Math.round(cx - w / 2); x < cx + w / 2; x++)
              if (x >= 0 && y >= 0 && x < W && y < H) p[b * H * W + y * W + x] = 1;
        });
      return { y: { data: p, dims: [n, 1, H, W] } };
    },
  };
  const rec = {
    inputNames: ['x'],
    outputNames: ['y'],
    run: async () => {
      const [text, conf] = reads[seen.rec++] || ['', 0],
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
  return { seen, Tensor, InferenceSession: { create: async () => [det, rec][s++] } };
}
async function engineRead(blocks, reads, o, abort) {
  const OCR2 = new Function(ENGINE + '\nreturn OCR2;')();
  const ort = fakeOrt(blocks, reads);
  const reader = await OCR2.create(ort, new Uint8Array(1), new Uint8Array(1), DICT.join('\n'), null);
  const img = { width: 320, height: 320, data: new Uint8ClampedArray(320 * 320 * 4).fill(200) },
    told = [],
    ctl = new AbortController();
  if (abort) ctl.abort();
  const r = await reader.read(img, Object.assign({ maxSide: 320, signal: ctl.signal }, o), {
    line: (it) => told.push(it.best.text),
  });
  return { r: r, told: told, recs: ort.seen.rec };
}

const W = { short: ['G03', 'R20', 'V04'], long: ['YG03', 'YR20', 'BV04', 'RV04'] };
const one = [[160, 160, 120, 30]];
const texts = (r) => r.r.lines.filter((it) => it.best).map((it) => it.best.text);

test('engine: G03 read again wider reads YG03 surely: taken, and told to the page', async () => {
  const r = await engineRead(
    one,
    [
      ['G03', 0.97],
      ['YG03', 0.95],
    ],
    { widen: W },
  );
  assert.deepEqual(texts(r), ['YG03']);
  assert.ok(r.told.includes('YG03'));
  assert.deepEqual(r.r.stat.widen, { tried: 1, took: 1 });
});

test('engine: a real R20 stays R20 (the wider read the same), and nothing else turns it into a longer code', async () => {
  for (const [wide, why] of [
    [['R20', 0.98], 'read the same'],
    [['YR20', 0.6], 'not sure'],
    [['R205', 0.97], 'grown at its tail'],
    [['1R20', 0.97], 'a digit at its head'],
    [['XR20', 0.97], 'not a code'],
  ]) {
    const r = await engineRead(one, [['R20', 0.97], wide], { widen: W });
    assert.deepEqual(texts(r), ['R20'], why);
    assert.equal(r.r.stat.widen.took, 0, why);
  }
});

test('engine: without o.widen, or for a code that is no longer one’s tail, nothing is read again', async () => {
  const a = await engineRead(
    one,
    [
      ['G03', 0.97],
      ['YG03', 0.95],
    ],
    {},
  );
  assert.deepEqual(texts(a), ['G03']);
  assert.equal(a.recs, 1);
  const b = await engineRead(
    one,
    [
      ['YG03', 0.97],
      ['XYG03', 0.95],
    ],
    { widen: W },
  );
  assert.deepEqual(texts(b), ['YG03']);
  assert.equal(b.r.stat.widen.tried, 0);
});

test('page: the short and long Copic codes; a short one waits for its read again, not with Ohuhu chosen', () => {
  const app = createApp(),
    E = app.__eval;
  const sets = E('ocrWidenSets()');
  for (const k of ['G03', 'R20', 'V04']) assert.ok(sets.short.includes(k), k);
  for (const k of ['YG03', 'YR20', 'BV04', 'RV04']) assert.ok(sets.long.includes(k), k);
  assert.ok(!sets.short.includes('YG03'));
  // (only a letter more at the head: no digit tails, B000 isn't B00's)
  assert.ok(sets.long.every((w) => /^[A-Z]/.test(w) && sets.short.includes(w.slice(1))));
  const idx = (c) => E(`COLORS.findIndex((m) => m.brand === 'Copic' && m.code === '${c}')`);
  E("scanBrand = ''");
  assert.equal(E(`ocrWidenWait(${idx('G03')})`), true);
  assert.equal(E(`ocrWidenWait(${idx('YG03')})`), false);
  E("scanBrand = 'Ohuhu'");
  assert.equal(E(`ocrWidenWait(${idx('G03')})`), false);
});
