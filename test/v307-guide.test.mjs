// v307 (the guide's Plan): big pages laid "all · 268, some twice" have no two touching sections sharing a marker;
// Undo and Redo keep how the markers were picked (shading-aware), so the Start colour line stays right; Colour it on
// the paper round the drawing smooths its rough spots in the same step, and the rough line shows with the first-time
// tip; Smooth them never brings in a marker whose own highlight or shadow is the other brand of a code the guide
// uses; a photo with no colour says "N sections · left white", with Colour along off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// an app with Ben's own markers (defaultOwned: 451), or these sets, owned
function appWith(sets) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  if (sets) {
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
  } else E('state.owned = new Set(defaultOwned())');
  t.coll = E('sfCollection()');
  t.assign.quiet();
  return { app, E, t };
}
// cols × rows sections of uneven sizes (from a seed), lines lw px between them; ready to build
function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
    ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
    hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
    W = ws.reduce((a, b) => a + b + lw, lw),
    H = hs.reduce((a, b) => a + b + lw, lw),
    labels = new Int32Array(W * H).fill(-1),
    comps = [null];
  let y0 = lw;
  for (let rr = 0; rr < rows; rr++) {
    let x0 = lw;
    for (let c = 0; c < cols; c++) {
      const l = comps.length,
        w = ws[c],
        h = hs[rr];
      comps.push({
        area: w * h,
        bg: false,
        bpx: 0,
        cx: x0 + w / 2,
        cy: y0 + h / 2,
        h: h - 1,
        x0,
        y0,
        x1: x0 + w - 1,
        y1: y0 + h - 1,
        merged: false,
      });
      for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
      x0 += w + lw;
    }
    y0 += hs[rr] + lw;
  }
  t.W = W;
  t.H = H;
  t.labels = labels;
  t.comps = comps;
  t.secState = new Uint8Array(comps.length).fill(1);
  t.colored = new Uint8Array(comps.length);
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  for (const k in t.locks) delete t.locks[k];
  return t.countedList();
}
// a drawn-looking page: n cells round random points (half of them packed towards the middle, as a mandala's small
// sections are), lines 2px wide between them; ready to build. Each touches about six others, of all sizes.
function vor(t, n, W, H, seed = 7) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
    P = [];
  for (let i = 0; i < n; i++) {
    if (r() < 0.5) {
      const a = r() * 2 * Math.PI,
        d = Math.pow(r(), 1.5) * Math.min(W, H) * 0.45;
      P.push([W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d]);
    } else P.push([r() * W, r() * H]);
  }
  const G = 24,
    gw = Math.ceil(W / G),
    gh = Math.ceil(H / G),
    B = Array.from({ length: gw * gh }, () => []);
  P.forEach((p, i) =>
    B[Math.min(gh - 1, Math.floor(p[1] / G)) * gw + Math.min(gw - 1, Math.floor(p[0] / G))].push(i),
  );
  const lab = new Int32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const bx = Math.floor(x / G),
        by = Math.floor(y / G);
      let best = -1,
        bd = Infinity;
      for (let rad = 0; rad < 60; rad++) {
        for (let yy = by - rad; yy <= by + rad; yy++)
          for (let xx = bx - rad; xx <= bx + rad; xx++) {
            if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue;
            if (Math.max(Math.abs(yy - by), Math.abs(xx - bx)) !== rad) continue;
            for (const i of B[yy * gw + xx]) {
              const d = (P[i][0] - x) ** 2 + (P[i][1] - y) ** 2;
              if (d < bd) {
                bd = d;
                best = i;
              }
            }
          }
        if (best >= 0 && Math.sqrt(bd) < rad * G) break;
      }
      lab[y * W + x] = best + 1;
    }
  const labels = new Int32Array(W * H),
    comps = [null];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x,
        l = lab[p],
        edge =
          (x + 1 < W && lab[p + 1] !== l) ||
          (y + 1 < H && lab[p + W] !== l) ||
          (x + 2 < W && lab[p + 2] !== l) ||
          (y + 2 < H && lab[p + 2 * W] !== l);
      labels[p] = edge ? -1 : l;
    }
  for (let i = 1; i <= n; i++)
    comps.push({ area: 0, bg: false, bpx: 0, sx: 0, sy: 0, x0: W, y0: H, x1: -1, y1: -1, merged: false });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const l = labels[y * W + x];
      if (l < 1) continue;
      const c = comps[l];
      c.area++;
      c.sx += x;
      c.sy += y;
      c.x0 = Math.min(c.x0, x);
      c.y0 = Math.min(c.y0, y);
      c.x1 = Math.max(c.x1, x);
      c.y1 = Math.max(c.y1, y);
    }
  for (const c of comps) {
    if (!c) continue;
    if (!c.area) c.merged = true;
    c.cx = c.area ? c.sx / c.area : 0;
    c.cy = c.area ? c.sy / c.area : 0;
    c.h = Math.max(0, c.y1 - c.y0);
  }
  t.W = W;
  t.H = H;
  t.labels = labels;
  t.comps = comps;
  t.secState = new Uint8Array(comps.length).fill(1);
  t.colored = new Uint8Array(comps.length);
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  for (const k in t.locks) delete t.locks[k];
  return t.countedList();
}
const style = (t, o) =>
  Object.assign(
    t.styleVars,
    {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      gradSeed: 0,
      gradScat: 0,
      gradJit: 0,
      gradFix: false,
      dir: 1,
      look: 'auto',
      gradShape: 'serpentine',
      limitN: 999,
      shadeMode: 'off',
    },
    o,
  );
const keys = (t) => t.assignData.order.map((l) => t.assignData.assign[l].mkey);
// touching sections sharing a marker
function same(t) {
  const a = t.colour.adj(),
    A = t.assignData.assign;
  let n = 0;
  for (const k in a)
    a[k].forEach((q) => {
      if (q > +k && A[k] && A[q] && A[k].mkey === A[q].mkey) n++;
    });
  return n;
}

// ---- Bug 2: "all · 268, some twice" ----

test('big pages at “all · 268, some twice”: no two touching sections share a marker, at every Scatter stop and Flow', () => {
  const { t } = appWith();
  let left = 0;
  for (const [n, W, H] of [
    [960, 900, 1100], // about 940 sections (as the 954-section page)
    [1430, 1000, 1300], // about 1,390 (as the 1,423-section page)
  ]) {
    const cl = vor(t, n, W, H);
    assert.ok(cl.length > 900, cl.length + ' sections');
    for (const shape of ['serpentine', 'radial', 'around']) {
      for (const sc of [0, 1, 3]) {
        style(t, { gradShape: shape, gradScat: sc, gradJit: 0.2 });
        assert.equal(t.grad.mkCountLabel(451), 'all · 268, some twice');
        t.grad.build(cl);
        const k = keys(t),
          tag = `${cl.length} ${shape} ${sc}`;
        left += t.grad.same.before;
        assert.equal(same(t), 0, tag + ': touching sections sharing a marker');
        assert.equal(t.grad.same.after, 0, tag);
        // still the 268 clear markers, each used
        assert.equal(new Set(k).size, 268, tag + ': every clear marker');
        // deterministic: laid again, the same
        t.grad.build(cl);
        assert.deepEqual(keys(t), k, tag + ': laid again, the same');
      }
    }
  }
  // (the smoothing alone left hundreds: v306 laid them)
  assert.ok(left > 100, left + ' pairs left by the smoothing');
});

test('big pages: the pass keeps the Start colour, pins and sections with ink, and moves one of each pair only', () => {
  const { t } = appWith();
  const cl = vor(t, 960, 900, 1100);
  style(t, {});
  t.grad.build(cl);
  const first = t.assignData.order[0],
    A = t.assignData.assign;
  // pin a few sections to the marker of a section they touch, so they share one with it
  const a = t.colour.adj(),
    pins = {};
  for (const l of cl.filter((l, i) => i % 150 === 75)) {
    const q = [...a[l]].find((q) => !pins[q] && q !== first);
    pins[l] = A[q].mkey;
    pins[q] = A[q].mkey;
  }
  const np = Object.keys(pins).length / 2;
  Object.assign(t.locks, pins);
  t.grad.build(cl);
  const B = t.assignData.assign;
  for (const l in pins) assert.equal(B[l].mkey, pins[l], 'pinned ' + l + ' keeps its marker');
  // (each pinned pair shares one, as pinned: the only pairs left)
  assert.equal(same(t), np);
  assert.equal(B[first].mkey, A[first].mkey, 'the Start colour kept');
  const s = t.grad.same;
  assert.ok(s.before > np && s.after === np && s.moved <= s.before - np, JSON.stringify(s));
});

test('a 216-section page and a lower count are laid as before (no marker used twice: nothing for the pass to do)', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, {});
  t.grad.build(cl);
  assert.equal(t.grad.same, null);
  assert.equal(t.grad.smoothed.mode, '');
  style(t, { limitN: 200 });
  page(t, 24, 20);
  t.grad.build(t.countedList());
  assert.equal(t.grad.same, null);
});

test('the Photo pattern before it has a photo (laid as the Gradient) splits up its repeats too', () => {
  const { t } = appWith();
  const cl = vor(t, 960, 900, 1100);
  style(t, { family: 'photo' });
  t.grad.build(cl);
  assert.equal(t.grad.smoothed.mode, 'split');
  assert.equal(same(t), 0);
});

// ---- Bug 3: Undo keeps how the markers were picked ----

test('Undo and Redo keep the shading-aware picks, so the Start colour line names the marker the picture starts with', () => {
  const { t } = appWith(['Honolulu 48']);
  page(t, 24, 20);
  style(t, { limitN: 16, shadeMode: 'full' });
  t.assign.buildGuide();
  assert.equal(t.assignData.shp, 1);
  const start = () => {
    const g = t.gradStartInfo();
    return g.cols[g.r].mkey;
  };
  const s0 = start(),
    first0 = keys(t)[0];
  assert.equal(s0, first0, 'the Start colour is the first section’s marker');
  // a change, then Undo and Redo
  t.styleVars.dir = -1;
  t.reassign();
  const s1 = start(),
    first1 = keys(t)[0];
  assert.equal(t.assignData.shp, 1);
  assert.equal(s1, first1);
  t.assign.planUndo();
  assert.equal(t.assignData.shp, 1, 'kept by Undo');
  assert.equal(keys(t)[0], first0);
  assert.equal(start(), s0, 'Undo: the Start colour line is right');
  t.assign.planRedo();
  assert.equal(t.assignData.shp, 1, 'kept by Redo');
  assert.equal(start(), s1, 'Redo: the Start colour line is right');
  // (a guide laid with shading off: none after Undo either)
  style(t, { limitN: 16, shadeMode: 'off' });
  t.reassign();
  t.styleVars.dir = 1;
  t.reassign();
  t.styleVars.dir = -1;
  t.reassign();
  t.assign.planUndo();
  assert.ok(!t.assignData.shp);
});

// ---- Bug 9: Smooth them and the shading's partners ----

test('Smooth them never brings in a marker whose own highlight or shadow is the other brand of a code the guide uses', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, { shadeMode: 'full' });
  t.grad.build(cl);
  const A0 = { ...t.assignData.assign },
    pairs = t.grad.rough(cl, A0);
  assert.ok(pairs.length > 5);
  // the run as Smooth them makes it, with shading on: which markers it brings in
  const bk = Object.fromEntries(t.coll.map((m) => [m.mkey, m]));
  const run = (A, ext) =>
    t.grad.fixRun(
      cl,
      A,
      t.coll.filter((m) => {
        const x = t.colour.lch(m);
        return x[1] >= 20 && x[0] >= 34 && x[0] <= 90;
      }),
      (l) => l === t.assignData.order[0],
      ext,
    );
  const A1 = { ...A0 },
    free = run(A1, { used: new Set(), codes: new Set(), part: {} });
  assert.ok(free.swaps.length > 0);
  // a marker it brings in whose own highlight or shadow has a code in both brands (Ben's markers have many)
  let s = -1,
    mk = null,
    m = null,
    other = null;
  for (const [l, k] of free.swaps) {
    const q = t.shadeTones(bk[k]);
    for (const x of [q.light, q.dark].filter(Boolean)) {
      const o = t.coll.find((y) => y.code === x.code && y.mkey !== x.mkey);
      if (o && !other) [s, mk, m, other] = [l, k, bk[k], o];
    }
  }
  assert.ok(other, 'a partner whose code is in both brands');
  const tones = (l, x) => {
    const q = t.shadeTones(x);
    return [q.light, q.dark].filter(Boolean);
  };
  const ext = { used: new Set([other.mkey]), codes: new Set([other.code]), part: {}, tones };
  const A2 = { ...A0 },
    r = run(A2, ext);
  assert.ok(!r.swaps.some((x) => x[1] === mk && x[0] === s), m.code + ' not brought in where it was');
  // nothing it brings in has a highlight or shadow of the other brand of a code in the guide
  const by = {};
  const note = (x) => (by[x.code] = by[x.code] || new Set()).add(x.mkey);
  Object.values(A2).forEach(note);
  note(other);
  for (const [l, k] of r.swaps)
    for (const x of tones(l, bk[k]))
      assert.ok(!by[x.code] || by[x.code].has(x.mkey), `${bk[k].code}'s ${x.code}`);
  // and the list follows each swap: two markers brought in never have partners of one code in both brands
  const parts = {};
  for (const [l, k] of r.swaps)
    for (const x of tones(l, bk[k])) (parts[x.code] = parts[x.code] || new Set()).add(x.mkey);
  for (const c in parts) assert.equal(parts[c].size, 1, c + ' in one brand only');
});

test('Smooth them with shading on: gradFixExt hands the fix each marker’s highlight and shadow; with shading off, none', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, { shadeMode: 'full', gradFix: true });
  t.grad.build(cl);
  const f = t.grad.fixed;
  assert.ok(f && f.swaps.length > 0);
  // no code in the guide in both brands, as a marker, a highlight or a shadow, that wasn't before the fix
  const by = (A) => {
    const o = {};
    const add = (x) => (o[x.code] = o[x.code] || new Set()).add(x.mkey);
    for (const l in A) {
      add(A[l]);
      const q = t.shadeTones(A[l]);
      [q.light, q.dark].filter(Boolean).forEach(add);
    }
    return Object.keys(o).filter((c) => o[c].size > 1);
  };
  const after = by(t.assignData.assign);
  style(t, { shadeMode: 'full', gradFix: false });
  t.grad.build(cl);
  const before = by(t.assignData.assign);
  assert.deepEqual(
    after.filter((c) => !before.includes(c)),
    [],
    'no new code in both brands',
  );
});

// ---- Bug 12: a photo with no colour ----

test('every section left white: the status says “N sections · left white” and Colour along is off', () => {
  const { t } = appWith();
  page(t, 18, 12);
  style(t, {});
  t.assign.buildGuide();
  assert.equal(t.assign.guideWhite(), 0);
  assert.doesNotMatch(t.assign.planBar(), /disabled/);
  // (as the Photo pattern leaves it with no colour in the photo: no markers, every section paper)
  const paper = {};
  for (const l of t.assignData.order) paper[l] = 1;
  t.assignData = { assign: {}, order: [], N: 0, base: {}, paper };
  assert.equal(t.assign.guideWhite(), 216);
  assert.match(t.assign.planBar(), /id="sfColor" class="sfcolorcta" disabled/);
  // (a pinned section keeps its marker: a guide with one marker, said as before)
  const l0 = Object.keys(paper)[0];
  delete paper[l0];
  t.assignData = { assign: { [l0]: t.coll[0] }, order: [+l0], N: 1, base: {}, paper };
  assert.equal(t.assign.guideWhite(), 0);
  assert.doesNotMatch(t.assign.planBar(), /disabled/);
});
