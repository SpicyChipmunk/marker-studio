// v318.9: a photo whose codes are small in it (a whole bag, a tray from afar, a Copic case) is read again closer. The
// engine, told detailCheck, says so after its first detection with nothing read (detail: true, stat.detail.lineH); the
// page then decodes the photo up to 4096 px and reads it with the detector at 3200 in 16 strips. Not when read gently,
// nor for a photo no bigger than 2560 px. A closer read that never finished reads gently for a fortnight; a memory
// failure in it reads the 2048 copy again. And a sure code paired before reading as a taller box's name is swapped back
// for a free pair too, not only a zoomed box's lines ("Jade Green" over G311). Each fails on v318.8.
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

test('engine: codes small for detailCheck: nothing read, told so with the line height; else read as before', async () => {
  const one = [[160, 160, 120, 30]];
  const small = await engineRead(one, [['R014', 0.99]], { detailCheck: 200 });
  assert.equal(small.r.detail, true);
  assert.equal(small.r.lines.length, 0);
  assert.ok(small.r.stat.detail && small.r.stat.detail.lineH > 20, JSON.stringify(small.r.stat.detail));
  assert.equal(small.recs, 0, 'nothing read');
  assert.deepEqual(small.told, [], 'nothing told the page');
  const large = await engineRead(one, [['R014', 0.99]], { detailCheck: 10 });
  assert.ok(!large.r.detail);
  assert.deepEqual(
    large.r.lines.map((it) => it.best.text),
    ['R014'],
  );
  const none = await engineRead(one, [['R014', 0.99]], {});
  assert.ok(!none.r.detail && !none.r.stat.detail, 'no detailCheck: as before');
  const stopped = await engineRead(one, [['R014', 0.99]], { detailCheck: 200 }, true);
  assert.ok(stopped.r.aborted && !stopped.r.detail, 'stopped before: stopped, not read closer');
});

test('engine: a sure code paired as the name of a taller box above it is the code, not the name (Jade Green over G311)', async () => {
  // (a two-word name's box, taller than the code's under it: paired before reading, the code as its name)
  const blocks = [
    [160, 100, 120, 40],
    [160, 175, 90, 20],
  ];
  const r = await engineRead(
    blocks,
    [
      ['JADEGREEN', 0.97],
      ['G311', 0.99],
    ],
    {},
  );
  const code = r.r.lines.find((it) => it.best && it.best.text === 'G311');
  assert.ok(code, r.r.lines.map((it) => it.best && it.best.text).join(' '));
  assert.ok(!code.nameOf, 'G311 is a line of its own, not a name');
  assert.ok(r.told.includes('G311'), 'and told to the page as a code');
  // (two codes one above the other: neither made the other's name and swapped)
  const two = await engineRead(
    blocks,
    [
      ['R014', 0.99],
      ['G311', 0.99],
    ],
    {},
  );
  const top = two.r.lines.find((it) => it.best && it.best.text === 'R014');
  assert.ok(top && !top.nameOf, 'the taller code stays the code');
});

// --- the page, with a worker of its own: what each read is sent with
function store(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  };
}
// (r a photo of ow × oh px, its 2048 copy in hand; ocrPhoto made up: the size it would decode to, no pixels of anyone's)
const PAGE =
  'const posts = [], decoded = [];' +
  'const fake = () => ({ postMessage: (m) => { if (m.t === "read") posts.push(m); }, terminate() {} });' +
  'ocrW = fake();' +
  'ocrReady = Promise.resolve(ocrW);' +
  'ocrStart = async () => { if (!ocrW) { ocrW = fake(); ocrReady = Promise.resolve(ocrW); } return ocrW; };' +
  'ocrPhoto = async (f, cap) => { decoded.push(cap || 2048); const s = Math.min(1, (cap || 2048) / 4032);' +
  '  const w = Math.round(4032 * s), h = Math.round(3024 * s);' +
  '  return { w: w, h: h, data: { data: new Uint8ClampedArray(16) }, show: null, ow: 4032, oh: 3024 }; };' +
  'const photo = (ow, oh) => ({ n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false,' +
  '  note: "", file: {}, img: { w: Math.round(ow * Math.min(1, 2048 / ow)), h: Math.round(oh * Math.min(1, 2048 / ow)),' +
  '  data: { data: new Uint8ClampedArray(16) }, ow: ow, oh: oh } });' +
  'const opts = (m) => ({ w: m.img.width, maxSide: m.o.maxSide, detTiles: m.o.detTiles, detailCheck: m.o.detailCheck || 0 });' +
  // (the harness's timers don't run: microtasks only)
  'const wait = async () => { for (let i = 0; i < 100; i++) await null; };';
async function page(storage, body) {
  const ls = store(storage);
  const app = createApp({ localStorage: ls });
  const out = JSON.parse(await app.__eval('(async function () {' + PAGE + body + '})()'));
  return Object.assign(out, { store: Object.fromEntries(ls._m) });
}

test('page: a photo bigger than 2560 px is asked about its codes; not a smaller one, nor one read gently', async () => {
  const o = await page(
    {},
    'const a = photo(4032, 3024); ocrRun = a; await ocrGo(a);' +
      'const b = photo(2400, 1800); ocrRun = b; await ocrGo(b);' +
      'localStorage.setItem("ms-ocr-low", String(Date.now()));' +
      'const c = photo(4032, 3024); ocrRun = c; await ocrGo(c);' +
      'return JSON.stringify({ posts: posts.map(opts) });',
  );
  assert.deepEqual(o.posts[0], { w: 2048, maxSide: 1600, detTiles: 1, detailCheck: 25 });
  assert.equal(o.posts[1].detailCheck, 0, 'no bigger than 2560 px: read as before');
  assert.deepEqual(
    o.posts[2],
    { w: 2048, maxSide: 1600, detTiles: 4, detailCheck: 0 },
    'read gently: as before',
  );
});

test('page: told the codes are small, the photo is decoded at 4096 and read at 3200 in 16 strips, the photo not ended', async () => {
  const o = await page(
    {},
    'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
      'const busy0 = localStorage.getItem("ms-ocr-busy");' +
      'ocrMessage({ data: { t: "done", detail: true, lines: [], stat: { detail: { lineH: 20 } }, ms: 1, aborted: false } });' +
      'await wait();' +
      'return JSON.stringify({ posts: posts.map(opts), decoded: decoded, done: r.done, busy0: busy0,' +
      ' busy: localStorage.getItem("ms-ocr-busy"), detail: r.detail, w: r.img.w, h: r.img.h });',
  );
  assert.equal(o.posts.length, 2);
  assert.deepEqual(o.posts[1], { w: 4032, maxSide: 3200, detTiles: 16, detailCheck: 0 });
  assert.deepEqual(o.decoded, [4096]);
  assert.equal(o.done, false, 'the photo goes on: not ended, nothing settled');
  assert.equal(o.busy0, '1');
  assert.equal(o.busy, '2', 'the closer read marked as under way');
  assert.deepEqual([o.w, o.h], [4032, 3024], "the photo's size is the larger copy's");
});

test('page: Stop tapped before the closer read: stopped, nothing more sent', async () => {
  const o = await page(
    {},
    'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
      'r.stop = true;' +
      'ocrMessage({ data: { t: "done", detail: true, lines: [], stat: { detail: { lineH: 20 } }, ms: 1, aborted: false } });' +
      'await wait();' +
      'clearTimeout(r.soon);' +
      'return JSON.stringify({ n: posts.length, done: r.done, aborted: r.aborted });',
  );
  assert.equal(o.n, 1);
  assert.equal(o.done, true);
  assert.equal(o.aborted, true);
});

test('page: out of memory in the closer read: the 2048 copy read again gently, not the larger one', async () => {
  const o = await page(
    {},
    'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
      'ocrMessage({ data: { t: "done", detail: true, lines: [], stat: { detail: { lineH: 20 } }, ms: 1, aborted: false } });' +
      'await wait();' +
      'ocrFailed({ message: "Aborted()", memory: true });' +
      'await wait();' +
      'return JSON.stringify({ posts: posts.map(opts), decoded: decoded, w: r.img.w, detail: !!r.detail, done: r.done });',
  );
  assert.equal(o.posts.length, 3);
  assert.deepEqual(o.posts[2], { w: 2048, maxSide: 1600, detTiles: 4, detailCheck: 0 });
  assert.deepEqual(o.decoded, [4096, 2048]);
  assert.equal(o.w, 2048);
  assert.equal(o.detail, false);
  assert.equal(o.done, false);
  assert.ok(o.store['ms-ocr-low'], 'gently for a fortnight, as after any memory failure');
});

test('page: a closer read that never finished: gently for a fortnight, said; an ordinary one: this photo only', async () => {
  const closer = await page(
    { 'ms-ocr-busy': '2' },
    'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
      'return JSON.stringify({ posts: posts.map(opts), note: r.note });',
  );
  assert.deepEqual(closer.posts[0], { w: 2048, maxSide: 1600, detTiles: 4, detailCheck: 0 });
  assert.ok(closer.store['ms-ocr-low'], 'gently for a fortnight');
  assert.match(closer.note, /didn’t finish/);
  const plain = await page(
    { 'ms-ocr-busy': '1' },
    'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
      'return JSON.stringify({ posts: posts.map(opts) });',
  );
  assert.equal(plain.posts[0].detTiles, 4, 'the next photo gently, as before');
  assert.equal(plain.posts[0].detailCheck, 0);
  assert.ok(!plain.store['ms-ocr-low'], 'not for a fortnight');
});
