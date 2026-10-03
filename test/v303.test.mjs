// v303: a small picture of the person's own (a page downloaded at 400-800 pixels) is enlarged before its sections are
// found, so lines that ran together at the small size come apart; Min section size and the specks cleared are measured
// on the picture as it came; the "tiny fragments" warning counts only fragments that are in the guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

// N x N rings drawn smoothly (each pixel the share of it under ink, as a downloaded picture has them): lines lw wide
// with gaps gap wide between them
function rings(N, lw, gap) {
  const g = new Uint8Array(N * N), c = N / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let ink = 0;
    for (let s = 0; s < 16; s++) {
      const xx = x + ((s % 4) + 0.5) / 4, yy = y + (((s / 4) | 0) + 0.5) / 4, r = Math.hypot(xx - c, yy - c);
      if (r % (lw + gap) < lw && r < c - 2) ink++;
    }
    g[y * N + x] = Math.round(255 - (255 * ink) / 16);
  }
  return g;
}
const find = (g, W, H, k) => { core.srcK = k; core.W = W; core.H = H; core.gray = g; core.segment(); core.applyBg(true); return core.countedList().length; };

test('rings 3 pixels apart run together at their own size and come apart enlarged 3 times', () => {
  const N = 120, g = rings(N, 1.2, 1.6);
  const small = find(g, N, N, 1);
  const big = find(core.grayUp(g, N, N, N * 3, N * 3), N * 3, N * 3, 3);
  assert.ok(small <= 2, 'at their own size: ' + small);
  assert.ok(big >= 18 && big <= 21, 'enlarged, a section between each two rings: ' + big);
  core.srcK = 1;
});

test('grayUp: a flat grey stays flat, an edge stays within black and white, and the size is the one asked', () => {
  const flat = core.grayUp(new Uint8Array(20 * 10).fill(137), 20, 10, 53, 27);
  assert.equal(flat.length, 53 * 27);
  assert.ok(flat.every((v) => v === 137));
  // a hard edge: Catmull-Rom overshoots it, kept to 0-255
  const e = new Uint8Array(10 * 4);
  for (let y = 0; y < 4; y++) for (let x = 5; x < 10; x++) e[y * 10 + x] = 255;
  const u = core.grayUp(e, 10, 4, 40, 16);
  assert.equal(u[0], 0);
  assert.equal(u[39], 255);
  // left to right along a row: never lighter, then darker again by more than the overshoot kept in range
  const row = Array.from(u.subarray(40 * 8, 40 * 8 + 40));
  for (let i = 1; i < row.length; i++) assert.ok(row[i] >= row[i - 1] - 30, 'row ' + row.join());
});

test('Min section size is measured on the picture as it came: enlarged 2 times, 4 times the pixels', () => {
  core.srcK = 1;
  const a = core.minPx(50);
  core.srcK = 2;
  assert.equal(core.minPx(50), Math.round(2 * Math.pow(200, 0.5) * 4), 'four times as many pixels');
  assert.equal(a, Math.round(2 * Math.pow(200, 0.5)));
  core.srcK = 1;
});

// a 300 x 300 page: a black frame 30 wide round a white middle split by a plus (about a third of it ink), with holes
// in the frame
function framed(hole) {
  const W = 300, F = 30, g = new Uint8Array(W * W).fill(255);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const inFrame = x < F || y < F || x >= W - F || y >= W - F, plus = Math.abs(x - W / 2) < 2 || Math.abs(y - W / 2) < 2;
    if (inFrame || plus) g[y * W + x] = 0;
  }
  // holes on a grid in the frame (white specks in the ink), clear of its edges
  let n = 0;
  for (let y = 3; y < W - 3 - hole; y += 7) for (let x = 3; x < W - 3 - hole; x += 7) {
    if (!(x + hole < F - 2 || y + hole < F - 2 || x >= W - F + 2 || y >= W - F + 2)) continue;
    for (let dy = 0; dy < hole; dy++) for (let dx = 0; dx < hole; dx++) g[(y + dy) * W + x + dx] = 255;
    n++;
  }
  return { g, W, n };
}

test('the "tiny fragments" warning: not for specks Min section size leaves out, still for fragments in the guide', () => {
  core.enhance = false;
  // 2 x 2 specks (4 pixels): under Min section size, left out, so the page is fine
  const a = framed(2);
  find(a.g, a.W, a.W, 1);
  assert.ok(core.comps.filter((c) => c && !c.merged).length > a.n * 0.8, 'the specks are found');
  assert.equal(core.segWarn.ok, true, 'no warning: ' + JSON.stringify(core.segWarn));
  // 4 x 4 fragments (16 pixels): over Min section size, so in the guide: the warning, as before
  const b = framed(4);
  find(b.g, b.W, b.W, 1);
  assert.equal(core.segWarn.code, 'noisy');
  core.enhance = true;
});

test('boxBlur (now by running sums) gives exactly what the 3 x 3 box did, edges and all', () => {
  for (const [W, H] of [[37, 23], [5, 4], [1, 7], [200, 3]]) {
    let s = 7;
    const g = new Uint8Array(W * H).map(() => (s = (s * 16807) % 2147483647) & 255);
    const old = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let t = 0, c = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx++) { t += g[yy * W + xx]; c++; }
      old[y * W + x] = (t / c + 0.5) | 0;
    }
    core.W = W; core.H = H;
    assert.deepEqual(Array.from(core.boxBlur(g, 1)), Array.from(old), W + 'x' + H);
  }
});
