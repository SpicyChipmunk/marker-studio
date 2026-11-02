// A photo made into a colouring page (v325, 47-photo-page): the page builder's invariants, on made-up photos (the
// author's photos stay out of the repo; they're the quality bench, run locally). The builder is the shipped code, run
// as the worker runs it (ppBuildCore, with its marker choice, ppPickCore).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core, createApp, memoryStorage } from './harness.mjs';
import { createHash, webcrypto } from 'node:crypto';

// a made-up photo, w × h RGB: a sky-to-ground gradient, soft blobs and hard-edged shapes in a few colours, a white
// patch (near-white areas are left white), and noise; seeded, so the same photo every time
function photo(w, h, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647,
    rgb = new Uint8Array(w * h * 3),
    shapes = [];
  for (let i = 0; i < 60; i++)
    shapes.push({
      x: rnd() * w,
      y: rnd() * h,
      r: (0.015 + rnd() * (i < 10 ? 0.15 : 0.05)) * w,
      c: [rnd() * 255, rnd() * 255, rnd() * 255],
      soft: rnd() < 0.5,
    });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = y / h,
        i = (y * w + x) * 3;
      let c = t < 0.55 ? [120 + 90 * t, 170 + 60 * t, 225] : [100 - 40 * t, 130 - 50 * t, 50];
      for (const sh of shapes) {
        const d = Math.hypot(x - sh.x, y - sh.y) / sh.r;
        const a = sh.soft ? Math.max(0, 1 - d) : d < 1 ? 1 : 0;
        if (a > 0) c = c.map((v, k) => v * (1 - a) + sh.c[k] * a);
      }
      // the white patch
      if (x > w * 0.7 && x < w * 0.9 && y > h * 0.1 && y < h * 0.3) c = [252, 252, 250];
      const n = (rnd() - 0.5) * 16;
      rgb[i] = Math.max(0, Math.min(255, c[0] + n));
      rgb[i + 1] = Math.max(0, Math.min(255, c[1] + n));
      rgb[i + 2] = Math.max(0, Math.min(255, c[2] + n));
    }
  return rgb;
}
// a pool of markers: L*a*b* spread over the gamut, as a collection's might be
function pool(n) {
  const pl = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const L = 15 + ((i * 37) % 80),
      h = (i * 137.5 * Math.PI) / 180,
      C = 10 + ((i * 23) % 60);
    pl[i * 3] = L;
    pl[i * 3 + 1] = C * Math.cos(h);
    pl[i * 3 + 2] = C * Math.sin(h);
  }
  return pl;
}
const W = 240,
  H = 180,
  GW = 480,
  GH = 360,
  RGB = photo(W, H),
  PL = pool(40);
// the photo's colours as ppPrepare gives them (every pixel, in 6-unit bins, each with its share)
function targets(rgb) {
  const bins = new Map();
  for (let i = 0; i < rgb.length; i += 3) {
    const L = labOf(rgb[i], rgb[i + 1], rgb[i + 2]),
      k = L.map((v) => Math.round(v / 6)).join('|'),
      b = bins.get(k);
    if (b) {
      b.w++;
      b.s[0] += L[0];
      b.s[1] += L[1];
      b.s[2] += L[2];
    } else bins.set(k, { w: 1, s: L.slice() });
  }
  const tl = new Float32Array(bins.size * 3),
    tw = new Float32Array(bins.size);
  let j = 0;
  for (const b of bins.values()) {
    tl[j * 3] = b.s[0] / b.w;
    tl[j * 3 + 1] = b.s[1] / b.w;
    tl[j * 3 + 2] = b.s[2] / b.w;
    tw[j++] = b.w;
  }
  return { tl, tw };
}
function labOf(r, g, b) {
  const f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)),
    R = f(r),
    G = f(g),
    B = f(b),
    X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047,
    Y = R * 0.2126 + G * 0.7152 + B * 0.0722,
    Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883,
    q = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))];
}
const TG = targets(RGB);
let pid = 1;
// one page: Detail as a smallest width (minR, in working pixels) and a ceiling; n markers (0: the photo's suggestion,
// at most mkCap)
function make({ minR = 4, cap = 80, n = 0, mkCap = 18, minCount = 0, rgb = RGB, id = pid } = {}) {
  return core.ppBuildCore({
    pid: id,
    rgb: rgb.slice(),
    w: W,
    h: H,
    GW,
    GH,
    tl: TG.tl,
    tw: TG.tw,
    pl: PL,
    n,
    mkCap,
    fl: null,
    ck: id + '|' + n + '|' + mkCap,
    minArea: Math.pow(4.4 * minR, 2),
    minR,
    cap,
    minCount,
    paper: [100, 0, 0],
    fragMin: 24,
    sal: null,
    areaK: [1, 1],
  });
}
// the sections that touch across a line (within 3 pixels of each other, a line between): pairs "a|b", a < b
function touching(r) {
  const L = r.lab,
    out = new Set();
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const a = L[y * GW + x];
      if (a < 1) continue;
      for (const [dx, dy] of [
        [3, 0],
        [0, 3],
        [2, 2],
        [2, -2],
      ]) {
        const X = x + dx,
          Y = y + dy;
        if (X < 0 || Y < 0 || X >= GW || Y >= GH) continue;
        const b = L[Y * GW + X];
        if (b >= 1 && b !== a) out.add(Math.min(a, b) + '|' + Math.max(a, b));
      }
    }
  return [...out].map((k) => k.split('|').map(Number));
}

test('the same photo and settings make the same page, every time', () => {
  const a = make({ id: 101 }),
    b = make({ id: 102 });
  assert.equal(a.S, b.S);
  assert.deepEqual([...a.pick.chosen], [...b.pick.chosen]);
  assert.ok(
    a.lab.every((v, i) => v === b.lab[i]),
    'the same section map',
  );
});

test('a line between every two sections: no two sections side by side without one', () => {
  const r = make();
  const L = r.lab;
  let bad = 0;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const a = L[y * GW + x];
      if (a < 1) continue;
      if (x + 1 < GW && L[y * GW + x + 1] >= 1 && L[y * GW + x + 1] !== a) bad++;
      if (y + 1 < GH && L[(y + 1) * GW + x] >= 1 && L[(y + 1) * GW + x] !== a) bad++;
    }
  assert.equal(bad, 0);
  assert.ok(r.S > 3, 'sections: ' + r.S);
});

test('sections side by side never share a marker', () => {
  for (const n of [0, 6, 24]) {
    const r = make({ n }),
      same = touching(r).filter(([a, b]) => r.secMk[a] === r.secMk[b] && !r.secWhite[a] && !r.secWhite[b]);
    assert.deepEqual(same, [], 'n ' + n);
  }
});

test('Detail: a coarser step has fewer sections, its ceiling holds, and with minCount a finer one is never fewer', () => {
  const steps = [
    { minR: 9, cap: 20 },
    { minR: 6, cap: 40 },
    { minR: 4, cap: 80 },
    { minR: 2.5, cap: 160 },
  ];
  let prev = 0;
  for (const st of steps) {
    const r = make({ ...st, minCount: prev, n: 24 });
    assert.ok(r.S >= prev, `${JSON.stringify(st)}: ${r.S} after ${prev}`);
    assert.ok(r.S <= st.cap * 1.25, `${JSON.stringify(st)}: ${r.S} under about ${st.cap}`);
    prev = r.S;
  }
  // (and the steps make a difference here: the finest has several times the coarsest's sections)
  assert.ok(prev >= 4 * make({ minR: 9, cap: 20, n: 24 }).S, 'finest ' + prev);
});

test('no section is smaller than the step allows (tiny holes become line, fragments join a neighbour)', () => {
  const r = make({ minR: 4 }),
    area = new Int32Array(r.S + 1);
  for (const v of r.lab) if (v > 0) area[v]++;
  const small = [];
  for (let s = 1; s <= r.S; s++) if (area[s] < 24) small.push([s, area[s]]);
  assert.deepEqual(small, []);
  // the boxes say the same
  for (let s = 1; s <= r.S; s++) assert.equal(r.box[s * 8], area[s], 'area of ' + s);
});

test('a near-white area of the photo is left white', () => {
  const r = make(),
    // the white patch's middle, at the guide's size
    l = r.lab[Math.round(GH * 0.2) * GW + Math.round(GW * 0.8)];
  assert.ok(l > 0, 'a section there');
  assert.equal(r.secWhite[l], 1);
});

test('the marker choice: a count set by hand is kept; the suggestion is within the step’s most', () => {
  const p6 = core.ppPickCore({ tl: TG.tl, tw: TG.tw, pl: PL, n: 6, mkCap: 18, fl: null });
  assert.equal(p6.n, 6);
  assert.ok(p6.chosen.length <= 6 && p6.chosen.length > 0);
  assert.equal(new Set(p6.chosen).size, p6.chosen.length, 'no marker twice');
  const ps = core.ppPickCore({ tl: TG.tl, tw: TG.tw, pl: PL, n: 0, mkCap: 12, fl: PL });
  assert.ok(ps.n >= 1 && ps.n <= 12, 'n ' + ps.n);
  assert.ok(ps.suits > 0 && ps.suits <= 40);
  assert.equal(ps.suitsFull, ps.suits, 'the full range here is the pool');
  // more than the pool: all of it at most
  const pa = core.ppPickCore({ tl: TG.tl, tw: TG.tw, pl: PL, n: 500, mkCap: 18, fl: null });
  assert.equal(pa.n, 40);
});

test('the builder runs as the worker runs it: its source stands alone', () => {
  // the worker's source, with no page around it: every function it names is in it
  const src = core.ppWorkerSrc();
  const fn = new Function('self', src + '\nreturn { ppBuildCore, ppPickCore };');
  const w = fn({});
  const r = w.ppBuildCore({
    pid: 9,
    rgb: RGB.slice(),
    w: W,
    h: H,
    GW,
    GH,
    tl: TG.tl,
    tw: TG.tw,
    pl: PL,
    n: 0,
    mkCap: 18,
    fl: null,
    ck: 'x',
    minArea: Math.pow(4.4 * 4, 2),
    minR: 4,
    cap: 80,
    minCount: 0,
    paper: [100, 0, 0],
    fragMin: 24,
    sal: null,
    areaK: [1, 1],
  });
  assert.equal(r.S, make({ id: 9 }).S, 'the same page as in the app');
});

test('mm on the paper: a page printed on smaller paper has smaller pixels', () => {
  const l = core.ppMmPx(2000, 1500, 'letter'),
    h = core.ppMmPx(2000, 1500, 'half');
  assert.ok(l > 0.1 && l < 0.2, 'Letter ' + l);
  assert.ok(h < l, 'Half Letter ' + h);
});

test('a saved guide’s pp: checked, and its sections renumbered as the guide opens', () => {
  const ok = core.ppCheck(
    {
      v: 1,
      d: 3,
      f: 'even',
      n: 18,
      hand: 1,
      paper: 'a4',
      made: { 1: 'oh:1', 5: 'oh:2', x: 'bad' },
      white: { 2: 'oh:3' },
    },
    { 1: 4, 5: 7, 2: 9 },
  );
  assert.equal(ok.d, 3);
  assert.equal(ok.hand, true);
  assert.equal(ok.paper, 'a4');
  assert.deepEqual(JSON.parse(JSON.stringify(ok.made)), { 4: 'oh:1', 7: 'oh:2' });
  assert.deepEqual(JSON.parse(JSON.stringify(ok.white)), { 9: 'oh:3' });
  assert.equal(core.ppCheck({ v: 2 }), null, 'a newer version’s');
  assert.equal(core.ppCheck(null), null);
  const odd = core.ppCheck({ v: 1, d: 9, f: 'x', n: -3, paper: 'tabloid' });
  assert.equal(odd.d, 2);
  assert.equal(odd.f, 'even');
  assert.equal(odd.n, 0);
});

test('Focus: the subject keeps more detail (Sharper subject), and with Simpler background less behind it', () => {
  // the subject: a disc in the middle of the photo
  const sal = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) sal[y * W + x] = Math.hypot(x - W / 2, y - H / 2) < H * 0.3 ? 1 : 0;
  const run = (areaK) =>
    core.ppBuildCore({
      pid: 50,
      rgb: RGB.slice(),
      w: W,
      h: H,
      GW,
      GH,
      tl: TG.tl,
      tw: TG.tw,
      pl: PL,
      n: 24,
      mkCap: 24,
      fl: null,
      ck: 'focus',
      minArea: Math.pow(4.4 * 4, 2),
      minR: 4,
      cap: 400,
      minCount: 0,
      paper: [100, 0, 0],
      fragMin: 24,
      sal: areaK ? sal : null,
      areaK: areaK || [1, 1],
    });
  // sections mostly inside the subject, and outside it (at the guide's size)
  const split = (r) => {
    const a = new Float64Array(r.S + 1),
      inn = new Float64Array(r.S + 1);
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const l = r.lab[y * GW + x];
        if (l < 1) continue;
        a[l]++;
        if (Math.hypot(x - GW / 2, y - GH / 2) < GH * 0.3) inn[l]++;
      }
    let i = 0,
      o = 0;
    for (let l = 1; l <= r.S; l++) if (a[l]) inn[l] / a[l] > 0.5 ? i++ : o++;
    return { i, o };
  };
  const even = split(run(null)),
    sharp = split(run([0.3, 1])),
    calm = split(run([0.3, 1.6]));
  assert.ok(sharp.i > even.i, `subject: ${sharp.i} sharper than ${even.i}`);
  assert.ok(calm.o < sharp.o, `behind it: ${calm.o} simpler than ${sharp.o}`);
  assert.ok(calm.i >= even.i, 'the subject as sharp with a simpler background');
});

// ---- v326 (docs/PLAN-v326-photo-page.md) ----
// the markers that would help most (ppFillCore): coverage within 10 by eye; each one added adds 5 points or more, at
// most 6; from the preferred brands (cg 1), and with both a second list from all; the paper matches white areas
test('the markers to add: each adds 5 points or more, at most 6, the preferred brands first, a second list from all', () => {
  const own = PL.slice(0, 4 * 3),
    cand = pool(120),
    cg = new Uint8Array(120).map((_, i) => (i % 2 ? 1 : 0)),
    r = core.ppFillCore({ tl: TG.tl, tw: TG.tw, pl: own, ml: null, cl: cand, cg, both: true, paper: 0 });
  assert.ok(r.own >= 0 && r.own <= 100);
  assert.equal(r.made, -1);
  assert.ok(r.a.i.length <= 6 && r.b.i.length <= 6);
  let prev = r.own;
  r.a.c.forEach((c) => {
    assert.ok(c - prev >= 5, `each adds 5 points or more: ${prev} -> ${c}`);
    prev = c;
  });
  r.a.i.forEach((i) => assert.equal(cg[i], 1, 'the first list from the preferred brands only'));
  assert.ok(
    (r.b.c.length ? r.b.c[r.b.c.length - 1] : r.own) >= (r.a.c.length ? r.a.c[r.a.c.length - 1] : r.own),
    'the second list, from all, does at least as well',
  );
  // the same again: the same answer (the line must not change as it's drawn again)
  assert.deepEqual(
    core.ppFillCore({ tl: TG.tl, tw: TG.tw, pl: own, ml: null, cl: cand, cg, both: true, paper: 0 }),
    r,
  );
  // more of your own markers: more of the photo matched, never less
  const more = core.ppFillCore({
    tl: TG.tl,
    tw: TG.tw,
    pl: PL,
    ml: own,
    cl: cand,
    cg,
    both: false,
    paper: 0,
  });
  assert.ok(more.own >= r.own);
  assert.equal(more.made, r.own, 'what the markers it was made with match');
  assert.equal(more.b, null);
  // the white patch matched by the paper
  const pp0 = core.ppFillCore({
      tl: TG.tl,
      tw: TG.tw,
      pl: own,
      ml: null,
      cl: new Float32Array(0),
      cg: new Uint8Array(0),
      paper: 0,
    }),
    pp1 = core.ppFillCore({
      tl: TG.tl,
      tw: TG.tw,
      pl: own,
      ml: null,
      cl: new Float32Array(0),
      cg: new Uint8Array(0),
      paper: 1,
    });
  assert.ok(pp1.own > pp0.own, `the paper: ${pp1.own} over ${pp0.own}`);
  assert.deepEqual(JSON.parse(JSON.stringify(pp0.a)), { i: [], c: [] });
});

// Subject only: the background kept apart in the builder (bgm): none of the subject handed to it, all of it white and
// marked, and a page without bgm as before
test('Subject only: the background its own, white, marked sections, the subject’s edge kept', () => {
  const sal = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) sal[y * W + x] = Math.hypot(x - W * 0.45, y - H * 0.5) < H * 0.32 ? 0 : 1;
  const run = (bgm) =>
    core.ppBuildCore({
      pid: 60,
      rgb: RGB.slice(),
      w: W,
      h: H,
      GW,
      GH,
      tl: TG.tl,
      tw: TG.tw,
      pl: PL,
      n: 18,
      mkCap: 18,
      fl: null,
      ck: 'subj' + (bgm ? 1 : 0),
      minArea: Math.pow(4.4 * 4, 2),
      minR: 4,
      cap: 120,
      minCount: 0,
      paper: [100, 0, 0],
      fragMin: 24,
      sal: null,
      areaK: [1, 1],
      bgm,
    });
  const r = run(sal),
    inside = (x, y) => Math.hypot((x * W) / GW - W * 0.45, (y * H) / GH - H * 0.5) < H * 0.32;
  let sub = 0,
    lost = 0,
    bgPx = 0,
    bgIn = 0;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const l = r.lab[y * GW + x];
      if (l < 1) continue;
      const i = inside(x, y);
      if (i) sub++;
      if (r.secBg[l]) {
        bgPx++;
        if (i) lost++;
        assert.equal(r.secWhite[l], 1, 'the background is white');
      } else if (!i && Math.hypot((x * W) / GW - W * 0.45, (y * H) / GH - H * 0.5) > H * 0.32 + 3) bgIn++;
    }
  assert.ok(bgPx > 0, 'a background');
  assert.ok(
    lost / sub < 0.01,
    `under 1% of the subject in the background: ${((100 * lost) / sub).toFixed(2)}%`,
  );
  assert.ok(bgIn / bgPx < 0.01, `and no background coloured: ${((100 * bgIn) / bgPx).toFixed(2)}%`);
  // without bgm: the page as before (no background sections at all), and the same every time
  const a = run(null),
    b = run(undefined);
  assert.equal(a.S, b.S);
  assert.deepEqual(Array.from(a.secMk), Array.from(b.secMk));
  assert.ok(Array.from(a.secBg).every((v) => v === 0));
});

test('a saved guide’s pp (v326): its markers added, colours, kind of pool, background and Subject only kept', () => {
  const ok = core.ppCheck(
    {
      v: 1,
      d: 2,
      f: 'subject',
      n: 10,
      paper: 'letter',
      add: ['Copic|E49', 'Ohuhu|E514', 42, 'nobar'],
      made: { 1: 'Ohuhu|E514' },
      sm: 'add|all',
      tg: { l: [50, 1.5, -2, 60, 0, 0], w: [3, 4] },
      bgs: [3, 8, 'x'],
    },
    { 1: 1, 3: 5, 8: 9 },
  );
  assert.equal(ok.f, 'subject');
  assert.deepEqual(JSON.parse(JSON.stringify(ok.add)), ['Copic|E49', 'Ohuhu|E514']);
  assert.equal(ok.sm, 'add|all');
  assert.deepEqual(Array.from(ok.tg.l), [50, 1.5, -2, 60, 0, 0]);
  assert.deepEqual(Array.from(ok.tg.w), [3, 4]);
  assert.deepEqual(JSON.parse(JSON.stringify(ok.bgs)), [5, 9], 'renumbered as the sections are');
  // the full range and markers added don't go together; odd colours aren't kept
  const odd = core.ppCheck({ v: 1, full: 1, add: ['Copic|E49'], tg: { l: [1, 2], w: [1] } });
  assert.equal(odd.add, null);
  assert.equal(odd.tg, null);
});

// (v329.1) the Detail steps' pages kept and the subject maps go with the picture: a new picture or guide lets them go
test('v329.1: the pages kept for Detail steps and the subject maps are let go with the picture', () => {
  const t = core;
  t.ppMemPut('k1', { pid: 1 }, { lab: new Int32Array(16), R: 3, it: 0 }, 0);
  t.ppMemPut('k2', { pid: 1 }, { lab: new Int32Array(16), R: 4, it: 0 }, 0);
  t.subKeep.push({ src: {}, sal: new Float32Array(4) });
  assert.equal(t.ppMemN, 2);
  assert.equal(t.subKeep.length, 1);
  t.assign.resetForNewPicture();
  assert.equal(t.ppMemN, 0, 'pages let go');
  assert.equal(t.subKeep.length, 0, 'subject maps let go');
});

// (v329.1) a photo page's job allowed time for its marker choice too, by the photo's colours and the markers it may
// use: from the full range a slow iPad had run out of time and lost the worker for the session
test('v329.1: the photo page job’s time allowed grows with the markers it may choose from', () => {
  const job = (P) => ({ GW: 2000, GH: 1500, tw: new Float32Array(450), pl: new Float32Array(P * 3) });
  const full = core.jobBudget(job(720), 'ppage'),
    small = core.jobBudget(job(120), 'ppage'),
    none = core.jobBudget({ GW: 2000, GH: 1500 }, 'ppage');
  assert.equal(none, 14000, 'the page’s own share as before');
  assert.equal(small, 14000 + 2160);
  assert.equal(full, 14000 + 12960);
});

// (v329.2) the merge step's narrowness test (ppWideCore) gives the exact distance map's answer: a region is wide if
// some pixel of it is at least minR from every pixel outside its inside (f = 0), on random regions and radii
test('v329.2: the merge step’s narrowness test matches the exact distance', () => {
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let trial = 0; trial < 12; trial++) {
    const w = 36 + Math.floor(rnd() * 20),
      h = 28 + Math.floor(rnd() * 20),
      n = w * h,
      L = new Int32Array(n);
    // regions: a few random rectangles and discs over a background, numbered 0..R-1
    const shapes = [];
    for (let k = 0; k < 6; k++) shapes.push([rnd() * w, rnd() * h, 2 + rnd() * 9, rnd() < 0.5]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let id = 0;
        shapes.forEach(function (sh, k) {
          const inside = sh[3]
            ? Math.hypot(x - sh[0], y - sh[1]) < sh[2]
            : Math.abs(x - sh[0]) < sh[2] && Math.abs(y - sh[1]) < sh[2] / 2;
          if (inside) id = k + 1;
        });
        L[y * w + x] = id;
      }
    const R = 7,
      f = new Uint8Array(n);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x,
          a = L[p];
        f[p] =
          (x > 0 && L[p - 1] !== a) ||
          (x < w - 1 && L[p + 1] !== a) ||
          (y > 0 && L[p - w] !== a) ||
          (y < h - 1 && L[p + w] !== a)
            ? 0
            : 1;
      }
    for (const minR of [1.4, 2.9, 3, 4.2, 5.8]) {
      const got = core.ppWideCore(f, L, R, w, h, minR),
        want = new Uint8Array(R);
      for (let p = 0; p < n; p++) {
        if (!f[p]) continue;
        let d = Infinity;
        for (let q = 0; q < n; q++)
          if (!f[q]) {
            const dx = (q % w) - (p % w),
              dy = Math.floor(q / w) - Math.floor(p / w);
            d = Math.min(d, dx * dx + dy * dy);
          }
        if (d >= minR * minR) want[L[p]] = 1;
      }
      assert.deepEqual(Array.from(got), Array.from(want), 'trial ' + trial + ', minR ' + minR);
    }
  }
});

// (v329.2) Focus: stray bits of the subject dropped, its colours counted more, the small subject's crop offered only
// for a subject the right shape, and the map's edges put on the photo's
test('v329.2: Focus — stray parts, the subject’s colours weighted, the small subject’s crop, the map’s edges', () => {
  // stray parts: under a tenth of the largest and a hundredth of the photo
  const w = 100,
    h = 100,
    m = new Uint8Array(w * h).fill(1),
    box = (x0, y0, s) => {
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) m[y * w + x] = 0;
    };
  box(5, 5, 40); // the subject: 1600 px
  box(60, 60, 5); // 25 px: a stray
  box(60, 10, 12); // 144 px: under a tenth of the subject but over 1% of the photo, kept
  core.subStrays(m, w, h);
  const sub = (x, y) => m[y * w + x] === 0;
  assert.ok(sub(20, 20) && sub(65, 15), 'the subject and the part over 1% kept');
  assert.ok(!sub(62, 62), 'the stray made background');
  // the colours weighted: the subject's (red, its map 1) count 1 + 3 to the background's (blue, 0) 1
  const pw = 60,
    ph = 40,
    rgb = new Uint8Array(pw * ph * 3),
    sal = new Float32Array(pw * ph);
  for (let i = 0; i < pw * ph; i++) {
    const left = i % pw < pw / 2;
    rgb.set(left ? [220, 30, 30] : [30, 40, 220], i * 3);
    sal[i] = left ? 1 : 0;
  }
  const t = core.ppFocusTargets({ w: pw, h: ph, rgb, sal, tl: null, tw: null }),
    ws = Array.from(t.w).sort((a, b) => b - a);
  assert.equal(ws.length, 2);
  assert.ok(Math.abs(ws[0] / ws[1] - 4) < 0.01, 'the subject’s colour four times: ' + ws);
  // the small subject's crop: a 3% disc is offered it, a 3% band across the photo isn't
  const prep = (fill) => {
    const s2 = new Float32Array(200 * 150);
    for (let y = 0; y < 150; y++) for (let x = 0; x < 200; x++) s2[y * 200 + x] = fill(x, y) ? 1 : 0;
    return { w: 200, h: 150, sal: s2 };
  };
  assert.equal(core.ppSmallSubOK(prep((x, y) => Math.hypot(x - 100, y - 75) < 17)), true, 'a small disc');
  assert.equal(core.ppSmallSubOK(prep((x, y) => y >= 70 && y < 75 && x >= 10 && x < 190)), false, 'a band');
  assert.equal(core.ppSmallSubOK(prep((x, y) => Math.hypot(x - 100, y - 75) < 60)), false, 'not small');
  // the map's edges on the photo's: a soft map over a hard edge in the photo comes out nearer the edge
  const S = 8,
    mw = 64,
    mh = 48,
    mm = new Float32Array(S * S),
    prgb = new Uint8Array(mw * mh * 3);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) mm[y * S + x] = x < 3 ? 1 : x < 5 ? 0.5 : 0;
  for (let i = 0; i < mw * mh; i++) prgb.fill(i % mw < mw / 2 ? 230 : 20, i * 3, i * 3 + 3);
  const soft = core.subMapUp(mm, S, prgb, mw, mh, 0, 0),
    hard = core.subMapUp(mm, S, prgb, mw, mh, 8, 0.004),
    // (pixels the 0.5 cut-off puts on the wrong side of the photo's edge)
    off = (p) => {
      let e = 0;
      for (let i = 0; i < mw * mh; i++) if (p[i] >= 0.5 !== i % mw < mw / 2) e++;
      return e;
    };
  assert.ok(
    hard.every((v) => v >= 0 && v <= 1),
    'within 0–1',
  );
  assert.ok(off(soft) > 0, 'the soft map’s cut-off off the edge');
  assert.equal(off(hard), 0, 'the filtered map’s on it (from ' + off(soft) + ' pixels off)');
});

// (v329.3 review) Crop to the subject's re-find: a crop under half the whole photo is found again; half or more, and an
// Undo back to the whole, take the kept map; a crop made in steps is measured against the photo, not the last kept
// (resampled) map, so three drags of 70% each are found again once they're under half
test('v329.3: a crop under half the photo is found again, measured against the whole photo, in steps too', () => {
  const t = core;
  t.assign.resetForNewPicture();
  const src = {},
    W = 8,
    H = 8,
    prep = (x, y, w, h) => ({ w: W, h: H, keep: { src, rot: 0, tilt: 0, rect: { x, y, w, h } } });
  const whole = Object.assign(prep(0, 0, 1, 1), { sal: new Float32Array(W * H).fill(0.5) });
  t.subKeepAdd(whole);
  assert.equal(t.subFromKept(prep(0, 0, 0.7, 0.7)), null, '0.49 of the photo: found again');
  assert.equal(t.subFromKept(prep(0, 0, 1, 0.5)).length, W * H, 'half: the kept map, resampled');
  // in steps: 70% of the width each time, the resampled map kept as the app does (ppPrepare)
  const a = prep(0, 0, 0.7, 1);
  a.sal = t.subFromKept(a);
  assert.ok(a.sal, 'first drag (0.7): the kept map');
  t.subKeepAdd(a);
  const b = prep(0, 0, 0.49, 1);
  assert.equal(t.subFromKept(b), null, 'second drag (0.49 of the photo, 0.7 of the last kept map): found again');
  // Undo back to the whole: the whole's own map
  assert.equal(t.subFromKept(prep(0, 0, 1, 1)).length, W * H);
  t.assign.resetForNewPicture();
});

// (v329.3 review) the subject finder's failures: out of memory and too slow told apart from the rest
test('v329.3 review: the subject finder’s failures, out of memory or too slow, told apart', () => {
  const k = core.subFailKind;
  assert.equal(k(new Error('Out of memory')), 'memory');
  assert.equal(k(new Error('RangeError: WebAssembly.Memory(): could not allocate memory')), 'memory');
  assert.equal(k(new Error('Aborted(OOM)')), 'memory');
  assert.equal(k(new Error('failed to allocate a buffer of size 2097152')), 'memory');
  assert.equal(k(new Error('timed out')), 'slow');
  assert.equal(k(new Error('not stored')), '');
  assert.equal(k(new Error('not stored (damaged)')), '');
  assert.equal(k(new Error('Can’t create a session')), '');
  assert.equal(k(Object.assign(new Error('off this launch'), { sub: 'slow' })), 'slow');
});

// (v329.3 review) the subject finder run with a stand-in worker: a find for another photo waits for the running one
// (never two models at once); a start that fails for no clear reason has its stored files checked again, the damaged
// ones let go of and said as not stored; out of memory is kept for the launch, and not tried again
function subApp(reply) {
  const st = { made: 0, alive: 0, most: 0, dels: 0 };
  class FakeWorker {
    constructor() {
      st.made++;
      st.alive++;
      st.most = Math.max(st.most, st.alive);
    }
    postMessage() {
      setImmediate(() => this.onmessage && this.onmessage({ data: { t: 'error', message: reply } }));
    }
    terminate() {
      if (!this.dead) st.alive--;
      this.dead = true;
    }
  }
  const cache = {
    match: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }),
    delete: async () => {
      st.dels++;
      return true;
    },
  };
  const ss = memoryStorage();
  const a = createApp({
    Worker: FakeWorker,
    caches: { open: async () => cache },
    crypto: webcrypto,
    sessionStorage: ss,
  });
  return { t: a.__mstest, st, ss };
}
const subPrep = () => ({ w: 4, h: 4, rgb: new Uint8Array(48) });
test('v329.3 review: one find at a time for any photo; a damaged stored model is let go of, as not stored', async () => {
  const { t, st } = subApp('Can’t create a session: bad model');
  const p1 = t.subMap(subPrep()),
    p2 = t.subMap(subPrep());
  await assert.rejects(p1, /not stored \(damaged\)/);
  await assert.rejects(p2, /not stored \(damaged\)/);
  assert.equal(st.made, 2, 'both found, one after the other');
  assert.equal(st.most, 1, 'never two workers at once');
  assert.equal(st.alive, 0, 'each ended');
  assert.equal(st.dels, 6, 'the damaged files let go of each time (ONNX Runtime’s two and the model)');
});
test('v329.3 review: a find out of memory is kept for the launch, and the next isn’t tried', async () => {
  const { t, st, ss } = subApp('RangeError: Out of memory');
  await assert.rejects(t.subMap(subPrep()), (e) => e.sub === 'memory');
  assert.equal(ss.getItem('ms-subject-off'), 'memory');
  await assert.rejects(t.subMap(subPrep()), (e) => e.sub === 'memory');
  assert.equal(st.made, 1, 'not started again');
  assert.equal(st.dels, 0, 'the stored files not checked: memory isn’t damage');
});

// (v329.3 review) the subject finder's download read as it comes: the progress counts up within a file
test('v329.3 review: the subject finder’s download counts up as it comes', async () => {
  const bytes = new Uint8Array(3000).map((_, i) => i % 251),
    h = createHash('sha256').update(bytes).digest('hex'),
    put = [];
  const a = createApp({
    crypto: webcrypto,
    Response: class {
      constructor(b) {
        this.b = b;
      }
    },
    caches: { open: async () => ({ put: async (u, r) => put.push(r.b.length) }) },
    fetch: async () => {
      let i = 0;
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => (i < 3 ? { done: false, value: bytes.slice(i * 1000, ++i * 1000) } : { done: true }),
          }),
        },
      };
    },
  });
  const seen = [];
  await a.__mstest.subDownload([{ x: { f: 'm', n: 3000, h }, url: 'u', cache: 'c' }], (n, tot) => seen.push(n + '/' + tot));
  assert.deepEqual(seen, ['1000/3000', '2000/3000', '3000/3000', '3000/3000']);
  assert.deepEqual(put, [3000], 'kept whole, once checked');
});

// (v329.3 review) a page job that fails: made on the page only when the worker never started; over its time, short
// of memory, or the worker gone meanwhile, said instead
test('v329.3 review: a page job made on the page only when the worker never started', () => {
  const f = core.ppRunFail,
    E = (m) => new Error(m);
  assert.equal(f(E('superseded'), true, 0), 'pass');
  assert.equal(f(E('too long'), true, 20000), 'long');
  assert.equal(f(E('ppage job took too long'), true, 20000), 'long');
  assert.equal(f(E('timed out'), true, 20000), 'long');
  assert.equal(f(E('RangeError: Array buffer allocation failed'), true, 5000), 'memory');
  assert.equal(f(E('Out of memory'), false, 5000), 'memory');
  assert.equal(f(E('no worker'), true, 0), 'gone', 'it had worked this session');
  assert.equal(f(E('no worker'), false, 9000), 'gone', 'it took the job, then went');
  assert.equal(f(E('no worker'), false, 10), 'here', 'it never started');
  assert.equal(f(E('DataCloneError'), true, 0), 'here');
  const w = core.ppFailWords;
  assert.match(w({ pp: 'long' }), /^Couldn’t make this page in time on this device\./);
  assert.match(w({ pp: 'memory' }), /short of memory/);
  assert.match(w({ pp: 'gone' }), /reopen Marker Studio/);
  assert.equal(w(new Error('no photo')), null, 'the caller’s own words');
});

// (v329.3 review) the marker choice's key follows the markers' colours, so a recoloured marker isn't chosen as it was
test('v329.3 review: the marker choice’s key changes with a marker’s colour', () => {
  const s = core.ppLabSig,
    a = [{ lab: [50, 10, -20] }, { lab: [70, -5, 30] }];
  assert.equal(s(a), s([{ lab: [50, 10, -20] }, { lab: [70, -5, 30] }]));
  assert.notEqual(s(a), s([{ lab: [50, 10, -20] }, { lab: [70, -5, 31] }]));
  assert.equal(s(a), s([{ lab: [50.01, 10, -20] }, { lab: [70, -5, 30] }]), 'to a tenth of a unit');
});
