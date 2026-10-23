// v318.32 bug fixes (Fable R32: D1-2, D2-1, D3-2). Each fails on v318.31.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createApp } from './harness.mjs';

const root = new URL('../', import.meta.url);

// D1-2: a list file in UTF-16 (Excel's "Unicode Text", an older Notepad's "Unicode") read as the codes it holds, not a
// letter at a time ("R16" had arrived as R, 1, 6 and added Ohuhu R210, Y27 for R16, Y13)
const utf16 = (s, be, bom) => {
  const u = Buffer.from(s, 'utf16le');
  if (be) u.swap16();
  return bom ? Buffer.concat([be ? Buffer.from([0xfe, 0xff]) : Buffer.from([0xff, 0xfe]), u]) : u;
};
const asBuf = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
test('D1-2: a list file decoded by its bytes: UTF-16LE and BE with a mark, UTF-16LE without one, and UTF-8', () => {
  const app = createApp({ TextDecoder });
  const text = 'B02 R16 Y13 CG5\n';
  assert.equal(app.scanDecode(asBuf(utf16(text, false, true))), text, 'UTF-16LE + BOM');
  assert.equal(app.scanDecode(asBuf(utf16(text, true, true))), text, 'UTF-16BE + BOM');
  assert.equal(app.scanDecode(asBuf(utf16(text, false, false))), text, 'UTF-16LE, no BOM');
  assert.equal(app.scanDecode(asBuf(Buffer.from('﻿' + text, 'utf8'))), text, 'UTF-8 + BOM');
  assert.equal(app.scanDecode(asBuf(Buffer.from('Café ' + text, 'utf8'))), 'Café ' + text, 'UTF-8');
  assert.equal(app.scanDecode(new ArrayBuffer(0)), '', 'empty');
  // what scanRead makes of each: the same four codes
  const codes = (buf) =>
    app
      .scanRead(app.scanDecode(buf), 'Ohuhu')
      .codes.map((c) => c.code)
      .sort();
  const want = codes(asBuf(Buffer.from(text, 'utf8')));
  assert.ok(want.length >= 4, 'the UTF-8 list reads its codes: ' + want);
  assert.deepEqual(codes(asBuf(utf16(text, false, true))), want);
  assert.deepEqual(codes(asBuf(utf16(text, true, true))), want);
  assert.deepEqual(codes(asBuf(utf16(text, false, false))), want);
});

// D2-1: buildNoRep's byUse bookkeeping with two pool entries of one marker (distinct objects, one mkey): the second's
// pick looked for it in the list of the markers used once, found nothing, and splice(-1, 1) took that list's LAST
// marker out of the rotation. (Every pool source dedupes today; the guard is for the one that won't.) The splice with
// a negative start is what's watched for: the lay's counts can't show it, as the duplicate entry itself stays in the
// unused list and is laid again and again either way.
test('D2-1: No repeats with a pool holding one marker twice never splices at -1', () => {
  const app = createApp(),
    E = app.__eval,
    core = app.__mstest;
  E('state.owned = new Set()');
  E('presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k))');
  core.coll = E('sfCollection()');
  Object.assign(core.styleVars, { noRep: true, paletteSource: 'owned', palette: 'all', limitN: 16 });
  // 8 squares that don't touch (a gap of background between): no neighbour rules, the rotation alone lays them
  const W = 8 * 20,
    H = 20,
    labels = new Int32Array(W * H),
    comps = [null];
  for (let x = 0; x < 8; x++) {
    const l = comps.length;
    comps.push({ cx: x * 20 + 8, cy: 8, area: 256, merged: false, bg: false });
    for (let py = 0; py < 16; py++) labels.fill(l, py * W + x * 20, py * W + x * 20 + 16);
  }
  core.W = W;
  core.H = H;
  core.labels = labels;
  core.comps = comps;
  core.secState = new Uint8Array(comps.length).fill(1);
  core.assignData = null;
  const cl = core.countedList();
  assert.equal(cl.length, 8);
  const by = (code) => core.coll.find((m) => m.code === code),
    A = by('R16'),
    B = by('B02'),
    C = by('Y07');
  assert.ok(A && B && C, 'the three markers are in the collection');
  // (a copy of A: the same mkey, another object, as a pool built from two sources could hold)
  // (the app's own Array: its literals are the context's, not Node's)
  const pool = [B, C, A, Object.assign({}, A)],
    AP = E('[].constructor.prototype'),
    splice = AP.splice,
    neg = [];
  AP.splice = function (start) {
    if (start < 0) neg.push([start, this.length]);
    return splice.apply(this, arguments);
  };
  try {
    for (let k = 0; k < 6; k++) core.buildNoRep(cl, pool);
  } finally {
    AP.splice = splice;
  }
  assert.equal(core.assignData.order.length, 8, 'every section laid');
  assert.deepEqual(neg, [], 'no splice from the end of a list');
});

// D3-2: the service worker stores only the app's own origin's responses in its cache (an opaque cross-origin one would
// take about 7 MB of quota each in Chrome)
function loadSW() {
  const src = readFileSync(new URL('service-worker.js', root), 'utf8'),
    handlers = {},
    puts = [],
    cache = {
      match: async () => undefined,
      put: async (k, v) => puts.push([typeof k === 'string' ? k : k.url, v]),
      addAll: async () => {},
      add: async () => {},
      keys: async () => [],
    },
    ctx = {
      self: null,
      caches: {
        open: async () => cache,
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true,
      },
      fetch: async (r) => ({ ok: true, type: 'basic', url: r.url, clone: () => ({ cloned: r.url }) }),
      URL,
      Request: function (u) {
        this.url = u;
      },
      Promise,
      console,
    };
  ctx.self = Object.assign(ctx, {
    location: { href: 'https://example.test/marker-studio/index.html' },
    addEventListener: (t, f) => (handlers[t] = f),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  });
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'service-worker.js' });
  return { handlers, puts };
}
async function swFetch(url, mode = 'no-cors') {
  const { handlers, puts } = loadSW();
  let out = null;
  handlers.fetch({ request: { method: 'GET', url, mode }, respondWith: (p) => (out = p) });
  const res = await out;
  // (the put is queued behind caches.open: a few turns)
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  return { res, puts };
}
test('D3-2: the service worker caches a same-origin file it fetched, and never a cross-origin one', async () => {
  const same = await swFetch('https://example.test/marker-studio/src/assets/fonts/x.woff2');
  assert.ok(same.res && same.res.ok, 'answered from the network');
  assert.deepEqual(
    same.puts.map((p) => p[0]),
    ['https://example.test/marker-studio/src/assets/fonts/x.woff2'],
  );
  const other = await swFetch('https://cdn.example.net/lib.js');
  assert.ok(other.res && other.res.ok, 'still answered from the network');
  assert.deepEqual(other.puts, [], 'not stored');
});
