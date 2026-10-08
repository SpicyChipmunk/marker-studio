// v308, the Gradient's colours (30-palette-assign): the Include row (Browns, Greys & black, Fluorescents), the vivid
// markers for Any and Bright, "all" as every marker left (repeated where needed), lightness that follows hue (the
// Gradient and Palette's Rainbow), the marker count's end and label, the mandala test behind "Use Around", the Undo
// wording, and guides saved before v308 laid exactly as v307 laid them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
function setPage(t, W, H, labels, n, given) {
  const comps = given || [null];
  if (!given) {
    for (let l = 1; l <= n; l++)
      comps.push({ area: 0, sx: 0, sy: 0, bg: false, bpx: 0, x0: W, y0: H, x1: -1, y1: -1, merged: false });
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
    comps.forEach((c) => {
      if (!c) return;
      c.cx = c.sx / c.area;
      c.cy = c.sy / c.area;
      c.h = c.y1 - c.y0;
    });
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
// cols × rows sections of uneven sizes (from a seed), lines lw px between them
function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
    ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
    hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
    W = ws.reduce((a, b) => a + b + lw, lw),
    H = hs.reduce((a, b) => a + b + lw, lw),
    labels = new Int32Array(W * H).fill(-1);
  const comps = [null];
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
  return setPage(t, W, H, labels, comps.length - 1, comps);
}
// a mandala: a middle, then rings of `k` matching petals (lines between them)
function mandala(t, rings = 4, k = 12, S = 400) {
  const labels = new Int32Array(S * S).fill(-1),
    c = S / 2,
    band = (S / 2 - 30) / rings;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r < 18) {
        labels[y * S + x] = 1;
        continue;
      }
      const ri = Math.floor((r - 20) / band);
      if (r < 20 || ri >= rings || r - 20 - ri * band < 2) continue;
      const a = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 360) % 360,
        si = Math.floor(a / (360 / k));
      if (a - si * (360 / k) < 2) continue;
      labels[y * S + x] = 2 + ri * k + si;
    }
  return setPage(t, S, S, labels, 1 + rings * k);
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
      gradIncl: {},
    },
    o,
  );
const keys = (t) => t.assignData.order.map((l) => t.assignData.assign[l].mkey);
const usedMs = (t) => {
  const seen = new Map();
  t.assignData.order.forEach((l) => seen.set(t.assignData.assign[l].mkey, t.assignData.assign[l]));
  return [...seen.values()];
};
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
const grp = (t, m) => t.grad.inclGroup(m);
const field = (t, k) => [...t.styleFields].find((f) => f.key === k);

// ---- the groups and the markers left ----

test('Include’s groups on Ben’s 451: Browns the 40 Earth markers and 29 tans, ochres and olives; Greys & black the grey families, BGY, YGY, 100 and 120; Fluorescents the F markers; 130 vivid', () => {
  const { t } = appWith();
  const g = { browns: [], greys: [], fluor: [], '': [] };
  t.coll.forEach((m) => g[grp(t, m)].push(m));
  assert.equal(g.browns.length, 69);
  assert.equal(g.browns.filter((m) => /Earth/.test(m.fam)).length, 40);
  // (the other browns: warm and muted, not light)
  for (const m of g.browns.filter((m) => !/Earth/.test(m.fam))) {
    const x = t.colour.lch(m);
    assert.ok(x[2] >= 25 && x[2] <= 125 && x[0] < 75 && !t.grad.vivid(m), m.code);
  }
  assert.ok(g.greys.some((m) => m.code === '120'));
  assert.ok(g.greys.some((m) => /^BGY/.test(m.code)) && g.greys.some((m) => /^YGY/.test(m.code)));
  assert.ok(g.greys.every((m) => /Gr[ae]y|Black|Blue-Green-Yellow|Yellow-Green-Yellow/.test(m.fam)));
  assert.deepEqual(g.fluor.map((m) => m.code).sort(), ['FY00', 'FY01', 'FY02', 'FY04']);
  assert.equal(t.coll.filter((m) => t.grad.vivid(m)).length, 130);
});

test('the Mood’s Include: all off but Earthy’s Browns (Deep too: no greys); no grey, black or fluorescent in any Mood; Soft, Pastel and Earthy nothing darker than L25', () => {
  const { t } = appWith();
  page(t, 18, 12);
  const want = { neutral: 130, vivid: 96, muted: 109, pastel: 108, deep: 71, earthy: 46 };
  for (const mood of Object.keys(want)) {
    style(t, { emphasis: mood });
    const on = t.grad.inclOn({}, mood);
    assert.deepEqual({ ...on }, { browns: mood === 'earthy', greys: false, fluor: false }, mood);
    const left = [...t.grad.inclPool(16).items];
    assert.equal(left.length, want[mood], mood);
    assert.ok(
      left.every((m) => grp(t, m) !== 'greys' && grp(t, m) !== 'fluor'),
      mood + ': no greys, no fluorescents',
    );
    if (mood === 'neutral' || mood === 'vivid')
      assert.ok(
        left.every((m) => t.grad.vivid(m)),
        mood + ': vivid only',
      );
    if (['muted', 'pastel', 'earthy'].includes(mood))
      assert.ok(
        left.every((m) => t.colour.lch(m)[0] >= 25),
        mood + ': none darker than L25',
      );
  }
  // a choice tapped stays through a Mood change; the others follow the Mood
  assert.deepEqual(
    { ...t.grad.inclOn({ greys: true }, 'earthy') },
    { browns: true, greys: true, fluor: false },
  );
  assert.deepEqual(
    { ...t.grad.inclOn({ browns: false }, 'earthy') },
    { browns: false, greys: false, fluor: false },
  );
  // turning a group on brings it all in (a group's markers aren't held to the vivid test)
  style(t, { gradIncl: { browns: true } });
  assert.equal(t.grad.inclPool(16).items.length, 199);
  style(t, { gradIncl: { browns: true, greys: true, fluor: true } });
  assert.equal(t.grad.inclPool(16).items.length, 130 + 69 + 47 + 4);
});

test('a pool filter at every count: 16, 24 and 48 pick only from the markers left (no browns, greys or fluorescents), and the default 16 keeps to colours of similar strength', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  for (const n of [16, 24, 48]) {
    style(t, { limitN: n });
    t.grad.build(cl);
    const ms = usedMs(t);
    assert.equal(ms.length, n);
    assert.ok(
      ms.every((m) => t.grad.vivid(m)),
      n + ': all vivid',
    );
  }
  // (v307's 16 had R310 and V010 at 0.4 of their hue's strongest beside a hot RV06)
  const weakest = (incl) => {
    style(t, { limitN: 16, gradIncl: incl });
    t.grad.build(cl);
    return Math.min(...usedMs(t).map((m) => t.grad.rc(m)));
  };
  const was = weakest(null),
    now = weakest({});
  assert.ok(was < 0.45 && now >= 0.5, `weakest ${was.toFixed(2)} → ${now.toFixed(2)}`);
});

test('“all”: the slider ends at the smaller of the sections and the markers left; more sections than markers lays them all, split where they touch while each is used twice at most, else in bands', () => {
  // Ben's 130 on 216 sections (2 × 130 = 260 or more): every one, no two touching sections sharing one
  {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, {});
    assert.equal(t.grad.mkCap(), 130);
    const c = t.grad.countNow();
    assert.deepEqual([c.M, c.reuse, c.all], [130, true, true]);
    t.grad.build(cl);
    assert.equal(usedMs(t).length, 130);
    assert.equal(same(t), 0);
    assert.equal(t.grad.mkCountLabel(), 'all · 130');
    // a count of 129 is a count, not all
    style(t, { limitN: 129 });
    assert.equal(t.grad.mkCountLabel(), '129');
    assert.deepEqual([t.grad.countNow().M, !!t.grad.countNow().all], [129, false]);
    // (a saved count at or over the end reads as all)
    style(t, { limitN: 451 });
    assert.equal(t.grad.mkCountLabel(), 'all · 130');
    // fewer sections than markers left: one each
    const few = page(t, 10, 8);
    style(t, {});
    assert.equal(t.grad.mkCap(), 80);
    t.grad.build(few);
    assert.equal(usedMs(t).length, 80);
    assert.ok(usedMs(t).every((m) => t.grad.vivid(m)));
    assert.equal(t.grad.mkCountLabel(), 'all · 80');
  }
  // Honolulu 24's 12 vivid on 216 sections (more than twice as many): bands of all 12, not split up (confetti)
  // (v308.3: 14, its two violets V010 and V416 kept so the set keeps its violet family)
  {
    const { t } = appWith(['Honolulu 24']);
    const cl = page(t, 18, 12);
    style(t, {});
    assert.equal(t.grad.mkCap(), 14);
    const c = t.grad.countNow();
    assert.deepEqual([c.M, c.reuse], [14, false]);
    t.grad.build(cl);
    assert.equal(usedMs(t).length, 14);
    assert.ok(same(t) > 150, 'bands: neighbours share their band’s marker');
    // and the line under Include says what Browns would add
    assert.match(
      t.grad.inclStatus(),
      /^14 of your markers · browns, greys, fluorescents off · .+ would add \d+$/,
    );
  }
});

test('Greys & black on: greys come in at "all" and their share at a count; off (the default), never', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, { gradIncl: { greys: true } });
  t.grad.build(cl);
  const all = usedMs(t);
  assert.equal(all.length, 177);
  assert.ok(all.filter((m) => grp(t, m) === 'greys').length === 47);
  style(t, { gradIncl: { greys: true }, limitN: 24 });
  t.grad.build(cl);
  const g24 = usedMs(t).filter((m) => grp(t, m) === 'greys').length;
  assert.ok(g24 >= 4 && g24 <= 8, g24 + ' greys of 24');
  style(t, { limitN: 24 });
  t.grad.build(cl);
  assert.equal(usedMs(t).filter((m) => grp(t, m) === 'greys').length, 0);
});

test('Smooth them and Pick shadeable ones draw from the same markers the Gradient does', () => {
  const { t } = appWith();
  page(t, 18, 12);
  style(t, {});
  const src = t.grad.poolSource(216, true),
    fix = [...t.grad.fixPool(src)];
  assert.ok(fix.length === 130 && fix.every((m) => t.grad.vivid(m)));
  // (Pick shadeable ones re-lays with shade-aware picks from the vivid markers)
  style(t, { limitN: 16 });
  t.assign.buildGuide();
  t.styleVars.shadeMode = 'full';
  if (t.grad.shadeOffer()) t.grad.shadePick();
  style(t, { limitN: 16, shadeMode: 'full' });
  t.grad.build(t.countedList());
  assert.ok(usedMs(t).every((m) => t.grad.vivid(m)));
});

// ---- lightness follows hue ----

test('lightness follows hue: yellow light, violet dark; a Gradient at 16 has a real light yellow; the targets go through the rainbow from red', () => {
  const { t } = appWith();
  assert.ok(t.grad.lt(92) > t.grad.lt(35) && t.grad.lt(92) > t.grad.lt(290) + 30);
  assert.equal(Math.round(t.grad.hueWarp(0, 12)), 33);
  assert.equal(Math.round(t.grad.hueWarp(2, 6)), 92, 'yellow third of six');
  // Pastel follows hue least
  assert.ok(
    Math.abs(t.grad.ltTarget(60, 92, 'pastel') - 60) < Math.abs(t.grad.ltTarget(60, 92, 'neutral') - 60) / 2,
  );
  const cl = page(t, 18, 12);
  for (const n of [16, 24]) {
    style(t, { limitN: n });
    t.grad.build(cl);
    const yel = usedMs(t).filter((m) => {
      const x = t.colour.lch(m);
      return x[2] >= 75 && x[2] <= 110 && x[0] >= 80 && x[1] >= 50;
    });
    assert.ok(yel.length >= 1, n + ': a light yellow');
  }
});

test('Palette’s Rainbow (SF.rainbowPick) picks as a new guide’s Gradient does: a real yellow at 6, 8 and 12, no fluorescents or browns, and the Gradient’s markers at the same count', () => {
  const { E, t } = appWith();
  const idx = JSON.parse(
    E('JSON.stringify(COLORS.map((c, i) => i).filter((i) => state.owned.has(mkey(i))))'),
  );
  for (const n of [6, 8, 12]) {
    const pal = [...t.grad.rainbow(n, 'neutral', idx)];
    assert.equal(pal.length, n);
    const ms = pal.map((i) => t.coll.find((m) => m.mkey === E(`mkey(${i})`)));
    assert.ok(
      ms.every((m) => !grp(t, m)),
      n + ': no browns, greys or fluorescents',
    );
    assert.ok(
      ms.some((m) => {
        const x = t.colour.lch(m);
        return x[2] >= 75 && x[2] <= 110 && x[0] >= 75;
      }),
      n + ': a yellow',
    );
  }
  // the Gradient at the same count (a loop: the same markers)
  const cl = page(t, 18, 12);
  style(t, { limitN: 12, gradShape: 'serpentine' });
  t.grad.build(cl);
  const g = usedMs(t)
      .map((m) => m.mkey)
      .sort(),
    r = [...t.grad.rainbow(12, 'neutral', idx)].map((i) => E(`mkey(${i})`)).sort();
  assert.deepEqual(r, g);
});

// ---- guides saved before v308 ----

test('a guide saved before v308 (no Include) opens with none and is laid exactly as v307.1 laid it, every Mood and count', () => {
  const { t } = appWith();
  const f = field(t, 'incl');
  assert.equal(f.check(undefined, f.def), null);
  assert.equal(f.check('yes', f.def), null);
  assert.deepEqual({ ...f.check({ browns: true, greys: 3 }, f.def) }, { browns: true });
  // its saved style says nothing of Include
  t.styleVars.gradIncl = null;
  assert.equal(f.save(), undefined);
  t.styleVars.gradIncl = { fluor: true };
  assert.deepEqual({ ...f.save() }, { fluor: true });
  // (hashes of each section's marker, laid by v307.1 itself on these pages)
  const want = [
    [18, 16, 'neutral', 999, 'serpentine', 268, '0ae6511fb9f8099f'],
    [18, 16, 'neutral', 16, 'serpentine', 16, 'ba8e6f7fa5ee4239'],
    [24, 20, 'neutral', 999, 'radial', 268, '3d7a7836432497d6'],
    [18, 16, 'deep', 999, 'serpentine', 288, '6639d7bfa88fbedb'],
    [18, 16, 'vivid', 48, 'around', 48, '6729bb0165b8dc22'],
    [12, 10, 'earthy', 24, 'serpentine', 24, '532a403d46c725e0'],
  ];
  for (const [cols, rows, mood, n, shape, k, h] of want) {
    const cl = page(t, cols, rows);
    style(t, { emphasis: mood, limitN: n, gradShape: shape, gradIncl: null });
    t.grad.build(cl);
    const s = t.assignData.order.map((l) => l + ':' + t.assignData.assign[l].mkey).join(',');
    assert.equal(usedMs(t).length, k);
    assert.equal(createHash('sha256').update(s).digest('hex').slice(0, 16), h, `${mood} ${n} ${shape}`);
  }
});

// ---- the mandala test, Undo's words ----

test('a mandala-like page (rings of matching petals) is told apart from a grid; Radial on it is offered Around', () => {
  const { t } = appWith();
  const m = mandala(t);
  assert.equal(m.length, 49);
  assert.ok(t.grad.mandalaScore(m) > 0.8, 'score ' + t.grad.mandalaScore(m));
  assert.equal(t.grad.mandala(m), true);
  // (petals that don't match: every ring's sizes uneven, so no group of 4 is symmetric)
  const g = page(t, 9, 8);
  assert.equal(t.grad.mandala(g), false);
  // (too few sections)
  const small = mandala(t, 2, 8);
  assert.equal(small.length, 17);
  assert.equal(t.grad.mandala(small), false);
});

test('Undo says what the control says: “Tone lines off”, “Shadow amount: 80%”, “Markers: all”, “Browns on”', () => {
  const { t } = appWith(['Honolulu 48']);
  page(t, 12, 10);
  style(t, { limitN: 16 });
  t.assign.buildGuide();
  t.styleVars.limitN = 999;
  t.reassign();
  assert.equal(t.planLabel, 'Markers: all');
  t.styleVars.gradIncl = { browns: true };
  t.reassign();
  assert.equal(t.planLabel, 'Browns on');
  t.styleVars.shadeMode = 'full';
  t.reassign();
  t.styleVars.shadeLines = false;
  t.reassign();
  assert.equal(t.planLabel, 'Tone lines off');
  t.styleVars.shadeLo = 0.8;
  t.reassign();
  assert.equal(t.planLabel, 'Shadow amount: 80%');
  t.styleVars.shadeHi = 0.25;
  t.reassign();
  assert.equal(t.planLabel, 'Highlight amount: 25%');
});
