// v328, Tick off from a photo (26-tick): lining a later photo up with the guide's picture, and reading which sections
// were coloured since. Made-up pages: a grid of cells with an odd mark in one corner (so only one turn fits), drawn
// again as a photo would see it (moved, scaled, turned, a little in perspective and bent, on greyer paper). Fails on
// v327.1 (no Tick off from a photo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const t = createApp().__mstest;
const W = 360,
  H = 480,
  S = 60;
// the page, RGBA: 4 px lines every S px, a filled square near the top left, cells coloured as fills says
function pageRGBA(fills = {}, paper = [246, 244, 238]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const line = x % S < 4 || y % S < 4 || x > W - 5 || y > H - 5,
        mark = x > 14 && x < 34 && y > 14 && y < 26,
        l = cellAt(x, y),
        c = line || mark ? [30, 30, 30] : fills[l] || paper,
        i = (y * W + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  return d;
}
function cellAt(x, y) {
  return 1 + ((y / S) | 0) * (W / S) + ((x / S) | 0);
}
// the guide's sections: one a cell, the lines and the mark ink
function labelsOf() {
  const L = new Int32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const line = x % S < 4 || y % S < 4 || x > W - 5 || y > H - 5,
        mark = x > 14 && x < 34 && y > 14 && y < 26;
      L[y * W + x] = line || mark ? -1 : cellAt(x, y);
    }
  return L;
}
const NL = (W / S) * (H / S) + 1;
// the page seen as a photo: pw x ph, each photo pixel's page point by map(u, v) -> [x, y]; dim: the light
function photo(src, pw, ph, map, dim = 1) {
  const o = new Uint8ClampedArray(pw * ph * 4);
  for (let v = 0; v < ph; v++)
    for (let u = 0; u < pw; u++) {
      const [x, y] = map(u, v),
        i = (v * pw + u) * 4;
      let c = [200, 200, 196];
      if (x >= 0 && y >= 0 && x <= W - 1 && y <= H - 1) {
        const x0 = Math.floor(x),
          y0 = Math.floor(y),
          x1 = Math.min(W - 1, x0 + 1),
          y1 = Math.min(H - 1, y0 + 1),
          fx = x - x0,
          fy = y - y0;
        c = [0, 1, 2].map(
          (k) =>
            (src[(y0 * W + x0) * 4 + k] * (1 - fx) + src[(y0 * W + x1) * 4 + k] * fx) * (1 - fy) +
            (src[(y1 * W + x0) * 4 + k] * (1 - fx) + src[(y1 * W + x1) * 4 + k] * fx) * fy,
        );
      }
      o[i] = c[0] * dim;
      o[i + 1] = c[1] * dim;
      o[i + 2] = c[2] * dim * 0.97;
      o[i + 3] = 255;
    }
  return o;
}
// where tickAlign puts a page point in the photo (turned and sized to W x H, as tickWarp reads it)
function mapped(al, x, y) {
  const p = al.h,
    sh = (tt) => {
      const gx = (x / W) * al.nx - 0.5,
        gy = (y / H) * al.ny - 0.5,
        cx = Math.max(0, Math.min(al.nx - 1, gx)),
        cy = Math.max(0, Math.min(al.ny - 1, gy)),
        x0 = Math.floor(cx),
        y0 = Math.floor(cy),
        x1 = Math.min(al.nx - 1, x0 + 1),
        y1 = Math.min(al.ny - 1, y0 + 1),
        fx = cx - x0,
        fy = cy - y0;
      return (
        (tt[y0 * al.nx + x0] * (1 - fx) + tt[y0 * al.nx + x1] * fx) * (1 - fy) +
        (tt[y1 * al.nx + x0] * (1 - fx) + tt[y1 * al.nx + x1] * fx) * fy
      );
    },
    xs = x + sh(al.tx),
    ys = y + sh(al.ty),
    d = p[6] * xs + p[7] * ys + 1;
  return [(p[0] * xs + p[1] * ys + p[2]) / d, (p[3] * xs + p[4] * ys + p[5]) / d];
}

test('lining up: a photo moved, scaled, in a little perspective and bent is lined up within a pixel', () => {
  const ref = pageRGBA(),
    // the photo: page point (x, y) at photo (u, v) = 1.04 (x, y) + (9, -6), with a little perspective and a bend
    fwd = (x, y) => {
      const d = 1 + 0.00006 * x;
      return [(1.04 * x + 9) / d + 1.5 * Math.sin(y / 90), (1.04 * y - 6) / d];
    },
    // (its inverse, by Newton's method from a guess)
    inv = (u, v) => {
      let x = (u - 9) / 1.04,
        y = (v + 6) / 1.04;
      for (let k = 0; k < 8; k++) {
        const [a, b] = fwd(x, y),
          [ax] = fwd(x + 0.5, y),
          [, by] = fwd(x, y + 0.5);
        x -= (a - u) / ((ax - a) / 0.5);
        y -= (b - v) / ((by - b) / 0.5);
      }
      return [x, y];
    },
    ph = photo(ref, W, H, inv, 0.93),
    al = t.tickAlign(ref, W, H, ph, W, H);
  assert.equal(al.ok, true, JSON.stringify({ cc: al.cc }));
  assert.equal(al.rot, 0);
  const errs = [];
  for (let y = 40; y < H - 40; y += 40)
    for (let x = 40; x < W - 40; x += 40) {
      const [u, v] = mapped(al, x, y),
        [U, V] = fwd(x, y);
      errs.push(Math.hypot(u - U, v - V));
    }
  errs.sort((a, b) => a - b);
  assert.ok(errs[errs.length >> 1] < 1, 'median ' + errs[errs.length >> 1]);
  assert.ok(errs[Math.floor(errs.length * 0.9)] < 1.5, '90% ' + errs[Math.floor(errs.length * 0.9)]);
});

test('lining up: a photo taken on its side is turned; another page doesn’t line up', () => {
  const ref = pageRGBA(),
    // on its side: the photo is H wide, W tall, page (x, y) at photo (y, W - 1 - x)
    side = photo(ref, H, W, (u, v) => [W - 1 - v, u]),
    al = t.tickAlign(ref, W, H, side, H, W);
  assert.equal(al.ok, true);
  assert.equal(al.rot, 3, 'turned back');
  // another page: circles, not a grid
  const other = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 180, y - 240),
        on = Math.abs((r % 50) - 25) < 2,
        i = (y * W + x) * 4;
      other[i] = other[i + 1] = other[i + 2] = on ? 30 : 245;
      other[i + 3] = 255;
    }
  assert.equal(t.tickAlign(ref, W, H, other, W, H).ok, false);
});

test('the reading: what was plain paper and is coloured now is offered; a ticked blank one is said apart', () => {
  const before = { 9: [250, 214, 120] },
    ref = pageRGBA(before),
    // since: three more coloured (a pale yellow, a pink, a grey-blue), under light that's dimmer and warmer across
    now = pageRGBA({ ...before, 15: [250, 238, 175], 22: [244, 200, 214], 30: [150, 170, 196] }),
    lit = new Uint8ClampedArray(now.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4,
        k = 0.9 + 0.08 * (x / W);
      lit[i] = Math.min(255, now[i] * k * 1.02);
      lit[i + 1] = now[i + 1] * k;
      lit[i + 2] = now[i + 2] * k * 0.95;
      lit[i + 3] = 255;
    }
  const lab = labelsOf(),
    list = Array.from({ length: NL - 1 }, (_, i) => i + 1),
    done = new Uint8Array(NL);
  // ticked: 9 (coloured before, so not plain paper: not read) and 40 (blank in both: said apart)
  done[9] = 1;
  done[40] = 1;
  const r = t.tickRead(ref, lit, lab, W, H, NL, list, done, []);
  assert.deepEqual(
    [...r.on].sort((a, b) => a - b),
    [15, 22, 30],
  );
  assert.deepEqual([...r.blank], [40]);
  assert.equal(r.plain, NL - 2, 'every cell but the one coloured before was plain paper');
  // the binding's sections, or any left out, aren't read
  assert.deepEqual(
    [...t.tickRead(ref, lit, lab, W, H, NL, list, done, [22]).on].sort((a, b) => a - b),
    [15, 30],
  );
});

// (v328 review) a lamp's warm light, the paper's b* moved by 17 or so: the light found round the cast, not round no
// change, so the blank cells aren't all offered, and a ticked blank one is still said apart
test('the reading: under a warm lamp (the paper’s b* +17) only what was coloured since is offered', () => {
  const ref = pageRGBA(),
    now = pageRGBA({ 15: [250, 238, 175], 22: [244, 200, 214], 30: [150, 170, 196] });
  for (const [gr, gb] of [
    [0.95, 0.82],
    [0.93, 0.78],
    [0.9, 0.72],
  ]) {
    const lit = new Uint8ClampedArray(now.length);
    for (let i = 0; i < now.length; i += 4) {
      lit[i] = now[i];
      lit[i + 1] = now[i + 1] * gr;
      lit[i + 2] = now[i + 2] * gb;
      lit[i + 3] = 255;
    }
    const lab = labelsOf(),
      list = Array.from({ length: NL - 1 }, (_, i) => i + 1),
      done = new Uint8Array(NL);
    done[40] = 1;
    const r = t.tickRead(ref, lit, lab, W, H, NL, list, done, []);
    assert.deepEqual(
      [...r.on].sort((a, b) => a - b),
      [15, 22, 30],
      'gains ' + gr + ', ' + gb,
    );
    assert.deepEqual([...r.blank], [40], 'gains ' + gr + ', ' + gb);
  }
});

test('a printout’s thin dark marks are found, and the drawing’s fills aren’t', () => {
  const d = pageRGBA({ 15: [150, 170, 196] });
  // a printed code: a few strokes 2 px wide in cell 22
  for (let y = 200; y < 214; y++)
    for (let x = 250; x < 280; x++)
      if ((x - 250) % 8 < 2 || y - 200 < 2) {
        const i = (y * W + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 40;
      }
  const m = t.tkThin(d, W, H);
  let inCode = 0,
    inFill = 0;
  for (let y = 200; y < 214; y++) for (let x = 250; x < 280; x++) inCode += m[y * W + x];
  for (let y = 130; y < 170; y++) for (let x = 130; x < 170; x++) inFill += m[y * W + x];
  assert.ok(inCode > 100, 'the code: ' + inCode);
  assert.equal(inFill, 0, 'not a fill');
});

test('a printout: the drawing found on the sheet under its header, put in the guide’s place, then lined up', () => {
  const ref = pageRGBA();
  t.W = W;
  t.H = H;
  t.labels = labelsOf();
  // the sheet: 1.2 times the page, the drawing shrunk to 0.8 of it (Fit to page) 60 px down, a header of text above
  const sw = Math.round(W * 1.2),
    sh = Math.round(H * 1.2),
    k = 0.8,
    ox = (sw - W * k) / 2,
    oy = 60,
    sheet = photo(ref, sw, sh, (u, v) => [(u - ox) / k, (v - oy) / k]);
  for (let i = 0; i < sw * sh; i++) if (sheet[i * 4] === 200) sheet.fill(250, i * 4, i * 4 + 3);
  for (let y = 12; y < 22; y++)
    for (let x = 20; x < 220; x++)
      if (x % 7 < 3) {
        const i = (y * sw + x) * 4;
        sheet[i] = sheet[i + 1] = sheet[i + 2] = 40;
      }
  const f = t.tickFit({ d: sheet, w: sw, h: sh });
  assert.ok(f && f.w === W && f.h === H);
  const al = t.tickAlign(ref, W, H, f.d, W, H);
  assert.equal(al.ok, true);
  // lined up: the page's own points land where they are, within a pixel
  const errs = [];
  for (let y = 40; y < H - 40; y += 40)
    for (let x = 40; x < W - 40; x += 40) {
      const [u, v] = mapped(al, x, y);
      errs.push(Math.hypot(u - x, v - y));
    }
  errs.sort((a, b) => a - b);
  assert.ok(errs[Math.floor(errs.length * 0.9)] < 1.5, '90% ' + errs[Math.floor(errs.length * 0.9)]);
});

test('the reading: a background of one colour over most of the page, half of it ticked, isn’t taken for the light', () => {
  // (v328 review: the light's change had become the colour, and every blank section read as coloured)
  const lab = labelsOf(),
    list = Array.from({ length: NL - 1 }, (_, i) => i + 1),
    done = new Uint8Array(NL),
    fills = {};
  // 30 of the 48 cells sky blue, every other one of them ticked already
  for (let l = 1; l <= 30; l++) {
    fills[l] = [150, 200, 240];
    if (l % 2) done[l] = 1;
  }
  const ref = pageRGBA(),
    now = pageRGBA(fills),
    lit = new Uint8ClampedArray(now.length);
  for (let i = 0; i < W * H; i++) {
    const k = 0.9 - 0.08 * ((i % W) / W);
    lit[i * 4] = now[i * 4] * k;
    lit[i * 4 + 1] = now[i * 4 + 1] * k;
    lit[i * 4 + 2] = now[i * 4 + 2] * k * 0.96;
    lit[i * 4 + 3] = 255;
  }
  const r = t.tickRead(ref, lit, lab, W, H, NL, list, done, []),
    want = list.filter((l) => fills[l] && !done[l]);
  assert.deepEqual(
    [...r.on].sort((a, b) => a - b),
    want,
  );
  assert.deepEqual([...r.blank], [], 'the ticked blue ones aren’t called blank');
});

test('lining up: crisp 2 px lines, the photo the page turned half round, lined up (the ink doesn’t hang on the pixel grid)', () => {
  const w = 363,
    h = 485,
    d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const line = (x + 39) % 40 < 2 || (y + 39) % 40 < 2 || (x > 20 && x < 60 && y > 20 && y < 30),
        i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = line ? 30 : 245;
      d[i + 3] = 255;
    }
  const turned = new Uint8ClampedArray(d.length);
  for (let i = 0; i < w * h; i++) turned.set(d.subarray(i * 4, i * 4 + 4), (w * h - 1 - i) * 4);
  const al = t.tickAlign(d, w, h, turned, w, h);
  assert.equal(al.ok, true, JSON.stringify({ cc: al.cc }));
  assert.equal(al.rot, 2);
});
