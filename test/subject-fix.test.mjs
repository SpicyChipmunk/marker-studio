// (v329.4) Fix the subject (49-subject-fix): the pieces, the layer in the photo's own frame, its key, the subject map
// read with it, and the strays rule leaving what the user added. Made-up photos only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

const W = 180,
  H = 120;
// a photo with a hard vertical edge at x = 67 (not on the grid) and soft noise; seeded
function photo(seed = 5) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647,
    rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3,
        c = x < 67 ? [60, 120, 200] : [220, 180, 60],
        n = (rnd() - 0.5) * 10;
      for (let k = 0; k < 3; k++) rgb[i + k] = Math.max(0, Math.min(255, c[k] + n));
    }
  return rgb;
}

test('the pieces: the same every time, of about even size, and following the photo’s edge', () => {
  const rgb = photo(),
    S = core.fixStep(W, H, false),
    a = core.fixPieces(rgb, W, H, S),
    b = core.fixPieces(rgb, W, H, S);
  assert.deepEqual(Array.from(a.L), Array.from(b.L), 'the same pieces twice');
  const area = new Map();
  for (const l of a.L) area.set(l, (area.get(l) || 0) + 1);
  assert.equal(area.size, a.n);
  for (const [l, c] of area) assert.ok(c >= (S * S) / 8, `piece ${l} is ${c} pixels (S ${S})`);
  const cells = (W / S) * (H / S);
  assert.ok(a.n > cells * 0.6 && a.n < cells * 1.4, `${a.n} pieces for about ${cells.toFixed(0)} cells`);
  // (along the edge: the pieces either side differ)
  let on = 0;
  for (let y = 0; y < H; y++)
    if (a.L[y * W + 66] !== a.L[y * W + 67] || a.L[y * W + 65] !== a.L[y * W + 68]) on++;
  assert.ok(on >= 0.9 * H, `a piece border on the edge in ${on} of ${H} rows`);
  const f = core.fixPieces(rgb, W, H, core.fixStep(W, H, true));
  assert.ok(f.n > a.n * 2, `the fine pieces are smaller (the step is at least 4 px): ${f.n} vs ${a.n}`);
});

const KEEP = { src: 'p1', rot: 0, tilt: 0, rect: { x: 0, y: 0, w: 1, h: 1 } };
test('the layer: runs out and back, its key, and the latest stroke wins', () => {
  const L = core.fixNew(KEEP, W, H, false);
  assert.equal(core.fixKey(core.fixEncode(L)), '', 'nothing marked: no key');
  const cells = core.fixCells(L, KEEP, W, H),
    P = new Int32Array(W * H).map((_, i) => (i % W < 90 ? 0 : 1));
  core.fixPaint(L, cells, P, [1], 1);
  const e = core.fixEncode(L),
    k1 = core.fixKey(e);
  assert.match(k1, /^[0-9a-f]{8}$/);
  assert.deepEqual(Array.from(core.fixDecode(e).a), Array.from(L.a), 'decoded as encoded');
  core.fixPaint(L, cells, P, [1], 2);
  const k2 = core.fixKey(core.fixEncode(L));
  assert.notEqual(k2, k1, 'another layer, another key');
  assert.equal(L.a[cells[W * 5 + 100]], 2, 'the latest stroke wins');
  core.fixPaint(L, cells, P, [1], 1);
  assert.equal(core.fixKey(core.fixEncode(L)), k1, 'back to the same layer: the same key');
  assert.equal(core.fixDecode({ gw: 2, gh: 2, runs: '1,3' }), null, 'a short layer refused');
  assert.equal(core.fixDecode({ gw: 2, gh: 2, runs: '7,4' }), null, 'a bad state refused');
});

test('the layer follows a crop, a quarter turn and an Undo of the crop; other photos and tilts don’t fit', () => {
  const L = core.fixNew(KEEP, 100, 80, false);
  // (in: the frame's top-left quarter)
  for (let y = 0; y < 40; y++) for (let x = 0; x < 50; x++) L.a[y * 100 + x] = 1;
  const crop = { src: 'p1', rot: 0, tilt: 0, rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } },
    v = core.fixView(L, crop, 60, 50);
  assert.equal(v[0], 1, 'the crop’s top-left is in the quarter');
  assert.equal(v[50 * 60 - 1], 0, 'its bottom-right is not');
  // (a quarter turn of the whole: rot 90 maps (u, v) back to (v, 1 - u))
  const turn = { src: 'p1', rot: 90, tilt: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
    t = core.fixView(L, turn, 80, 100);
  const b = core.fixBase(turn, 0.9, 0.1);
  assert.ok(b[0] < 0.5 && b[1] < 0.5, 'the turned photo’s top right is the frame’s top left');
  assert.equal(t[Math.floor(0.1 * 100) * 80 + Math.floor(0.9 * 80)], 1);
  const whole = core.fixView(L, KEEP, 100, 80);
  assert.deepEqual(Array.from(whole), Array.from(L.a), 'the whole photo again: the layer as it was');
  assert.ok(core.fixFits(L, crop) && core.fixFits(L, turn));
  assert.ok(!core.fixFits(L, { ...KEEP, src: 'p2' }), 'another photo: no');
  assert.ok(!core.fixFits(L, { ...KEEP, tilt: 2 }), 'another tilt: no');
  // (a fix on a tight crop: the grid made finer, what was there kept)
  const tight = { src: 'p1', rot: 0, tilt: 0, rect: { x: 0, y: 0, w: 0.1, h: 0.1 } },
    R = core.fixRefine(L, tight, 100, 80, 2000, 2000);
  assert.ok(R.gw >= 1000 && R.gh >= 800, `refined to ${R.gw} x ${R.gh}`);
  assert.deepEqual(Array.from(core.fixView(R, KEEP, 100, 80)), Array.from(L.a), 'the same at the old size');
  const capped = core.fixRefine(L, tight, 100, 80, 300, 200);
  assert.ok(capped.gw === 300 && capped.gh === 200, 'never finer than the photo’s own pixels');
});

test('the subject map read with the layer, and the strays rule leaving what the user added', () => {
  const n = 8,
    sal = new Float32Array([0.9, 0.9, 0.1, 0.1, 0.9, 0.1, 0.6, 0.2]),
    view = new Uint8Array([0, 2, 1, 0, 0, 0, 0, 0]);
  assert.deepEqual(
    Array.from(core.fixCombine(sal, view, false)).map((v) => +v.toFixed(2)),
    [0.9, 0, 1, 0.1, 0.9, 0.1, 0.6, 0.2],
  );
  assert.deepEqual(
    Array.from(core.fixCombine(sal, view, true)),
    [0, 0, 1, 0, 0, 0, 0, 0],
    'complete: the rest out',
  );
  assert.deepEqual(Array.from(core.fixCombine(null, view, false)), [0, 0, 1, 0, 0, 0, 0, 0], 'no finder map');
  assert.notEqual(
    core.fixCombine(sal, view, false),
    core.fixCombine(sal, view, false),
    'a fresh map each time',
  );
  assert.equal(n, sal.length);
  // (a big subject and two small separate parts: the finder's is dropped as a stray, the added one stays)
  const w = 100,
    h = 100,
    m = new Float32Array(w * h),
    add = new Uint8Array(w * h);
  for (let y = 10; y < 70; y++) for (let x = 10; x < 70; x++) m[y * w + x] = 1;
  for (let y = 85; y < 88; y++) for (let x = 85; x < 88; x++) m[y * w + x] = 1;
  for (let y = 85; y < 88; y++)
    for (let x = 5; x < 8; x++) {
      m[y * w + x] = 1;
      add[y * w + x] = 1;
    }
  const bg = core.ppSubjectMask({ sal: m, w, h, fixAdd: add });
  assert.equal(bg[86 * w + 86], 1, 'the finder’s stray made background');
  assert.equal(bg[86 * w + 6], 0, 'the part the user added kept');
  assert.equal(bg[40 * w + 40], 0, 'the subject kept');
});
