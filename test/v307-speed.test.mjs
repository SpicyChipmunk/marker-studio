// v307 speed work: the faster code gives exactly what the code it replaced gave (packing a PDF page's pixels, reading a
// saved section map's numbers), and the label points kept for the session are the ones worked out afresh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

// a made-up RGBA picture, opaque or not
function pixels(n, seed) {
  const d = new Uint8ClampedArray(n * 4);
  let s = seed;
  for (let i = 0; i < d.length; i++) {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    d[i] = (s >>> 16) & 255;
  }
  return d;
}

test('PDF pages: RGB packing gives the same bytes as the per-pixel loop it replaced', () => {
  for (const [n, seed] of [
    [1, 1],
    [7, 2],
    [1700 * 3, 3],
    [4099, 4],
  ]) {
    const d = pixels(n, seed),
      old = new Uint8Array(n * 3);
    for (let i = 0, j = 0; i < n; i++) {
      old[j++] = d[i * 4];
      old[j++] = d[i * 4 + 1];
      old[j++] = d[i * 4 + 2];
    }
    const got = core.rgbPack(d, n);
    assert.equal(got.length, n * 3);
    assert.ok(
      old.every((v, i) => v === got[i]),
      `same bytes for ${n} pixels`,
    );
  }
  // a view part-way into a bigger buffer reads only its own pixels
  const big = pixels(20, 9),
    view = new Uint8ClampedArray(big.buffer, 16, 40);
  assert.deepEqual([...core.rgbPack(view, 10)], [...core.rgbPack(new Uint8ClampedArray([...view]), 10)]);
});

// the v306 way of reading a saved section map's numbers (97-open), kept here to compare with
function oldLabels(data, n) {
  const raw = new Int32Array(n),
    labels = new Int32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = data[j] | (data[j + 1] << 8) | (data[j + 2] << 16);
    raw[i] = v === 0 ? -1 : v - 1;
  }
  const map = Object.create(null);
  let next = 0,
    lo = Infinity,
    hi = 0,
    cnt = 0;
  for (let i = 0; i < n; i++) {
    const r = raw[i];
    if (r < 0 || map[r] !== undefined) continue;
    map[r] = 0;
    cnt++;
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  const own = cnt > 0 && lo >= 1 && hi <= cnt * 2 + 64;
  for (const r in map) map[r] = own ? +r : undefined;
  if (own) next = hi;
  for (let i = 0; i < n; i++) {
    const r = raw[i];
    if (r < 0) {
      labels[i] = -1;
      continue;
    }
    if (map[r] === undefined) map[r] = ++next;
    labels[i] = map[r];
  }
  return { labels, map, next };
}
function mapData(vals) {
  const d = new Uint8ClampedArray(vals.length * 4);
  vals.forEach((v, i) => {
    d[i * 4] = v & 255;
    d[i * 4 + 1] = (v >> 8) & 255;
    d[i * 4 + 2] = (v >> 16) & 255;
    d[i * 4 + 3] = 255;
  });
  return d;
}
test('opening a guide: its section numbers are read through a table, the same numbers as before', () => {
  const W = 60,
    H = 40,
    n = W * H,
    cases = {
      // a guide's own numbers, with gaps (sections merged away) and lines
      own: Array.from({ length: n }, (_, i) =>
        i % 13 === 0 ? 0 : 2 + 3 * (((i % W) / 10) | 0) + 20 * ((i / W / 10) | 0),
      ),
      // numbers that aren't a guide's: numbered afresh in the order they're met
      afresh: Array.from({ length: n }, (_, i) => (i % 11 === 0 ? 0 : 1 + 5000 + ((i * 7919) % 97) * 31)),
      // section 0 in the file (a 1 in the red): afresh
      zero: Array.from({ length: n }, (_, i) => 1 + (i % 5)),
      // numbers too big for a table: the object, as before
      huge: Array.from({ length: n }, (_, i) => (i % 3 ? 0x7f0000 + (i % 50) : 0)),
      lines: Array.from({ length: n }, () => 0),
    };
  for (const [name, vals] of Object.entries(cases)) {
    const d = mapData(vals),
      a = oldLabels(d, n),
      b = core.lmapLabels(d, W, H);
    assert.equal(b.next, a.next, name + ': highest number');
    assert.ok(
      a.labels.every((v, i) => v === b.labels[i]),
      name + ': every pixel the same section',
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(Object.assign({}, b.map))),
      JSON.parse(JSON.stringify(Object.assign({}, a.map))),
      name + ': the file’s numbers map the same way',
    );
    assert.equal(Object.getPrototypeOf(b.map), null, name + ': no prototype to look things up in');
  }
});

test('label points: kept for the session are the ones worked out afresh, and a changed section map isn’t mistaken for them', () => {
  const W = 90,
    H = 70,
    K = 1 + 6 * 5;
  const lab = new Int32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      lab[y * W + x] = x % 15 === 0 || y % 14 === 0 ? -1 : 1 + ((x / 15) | 0) + 6 * ((y / 14) | 0);
  core.W = W;
  core.H = H;
  core.labels = lab;
  core.comps = Array.from({ length: K }, (_, i) => (i ? { area: 1, cx: 0, cy: 0 } : null));
  core.labelPts = null;
  const afresh = core.labelPtsCore(lab, W, H, K);
  core.labelPos(1);
  const first = core.labelPts;
  assert.deepEqual(
    JSON.parse(JSON.stringify(first)),
    JSON.parse(JSON.stringify(afresh.lp)),
    'the same points',
  );
  core.labelPts = null;
  core.labelPos(1);
  assert.equal(core.labelPts, first, 'kept: not worked out again');
  // one pixel moved to another section: worked out again
  const lab2 = lab.slice();
  lab2[W * 20 + 20] = lab2[W * 20 + 50];
  core.labels = lab2;
  core.labelPts = null;
  core.labelPos(1);
  assert.notEqual(core.labelPts, first);
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.labelPts)),
    JSON.parse(JSON.stringify(core.labelPtsCore(lab2, W, H, K).lp)),
  );
});
