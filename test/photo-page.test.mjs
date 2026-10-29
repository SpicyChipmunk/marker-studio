// A photo made into a colouring page (v325, 47-photo-page): the page builder's invariants, on made-up photos (the
// author's photos stay out of the repo; they're the quality bench, run locally). The builder is the shipped code, run
// as the worker runs it (ppBuildCore, with its marker choice, ppPickCore).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

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
