// v306 (the Gradient's colours, 30-palette-assign): Scatter, five stops (Polished, Natural, Textured, Sparkle,
// Confetti); "all" on a page with more sections than your clear markers lays the clear ones twice rather than greys
// (U6); shading-aware base picks (U7); rough spots and "Smooth them" (gradFix); Blend's anchors added by a tap.
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
const byKey = (t) => Object.fromEntries(t.coll.map((m) => [m.mkey, m]));
// touching sections sharing a marker
function same(t) {
  const a = t.adj || t.colour.adj(),
    A = t.assignData.assign;
  let n = 0;
  for (const k in a)
    a[k].forEach((q) => {
      if (q > +k && A[k] && A[q] && A[k].mkey === A[q].mkey) n++;
    });
  return n;
}
const field = (t, k) => [...t.styleFields].find((f) => f.key === k);

// ---- Scatter ----

test('Scatter: five stops; Polished is v305 (smoothed), Natural the same without smoothing, and the others mix the same markers', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  for (const shape of ['serpentine', 'radial', 'around', 'diagonal']) {
    const lay = (sc, o = {}) => {
      style(t, { gradShape: shape, gradScat: sc, gradJit: 0.3, ...o });
      t.grad.build(cl);
      return keys(t);
    };
    const pol = lay(0);
    assert.ok(t.grad.smoothed && t.grad.smoothed.swaps > 0, shape + ': Polished is smoothed');
    // (the Photo pattern before it has a photo lays the Gradient unsmoothed, as v304 did)
    const v304 = lay(0, { family: 'photo' });
    const nat = lay(1);
    assert.equal(t.grad.smoothed, null, shape + ': Natural isn’t smoothed');
    assert.deepEqual(nat, v304, shape + ': Natural is the Gradient as laid');
    const stops = [pol, nat];
    for (const sc of [2, 3, 4]) {
      const k = lay(sc);
      assert.ok(t.grad.scattered, shape + ' ' + sc + ': scattered');
      assert.equal(k[0], nat[0], `${shape} ${sc}: the flow's first section keeps the Start colour`);
      assert.deepEqual([...k].sort(), [...nat].sort(), `${shape} ${sc}: the same markers`);
      assert.deepEqual(lay(sc), k, `${shape} ${sc}: laid again, the same`);
      stops.push(k);
    }
    // every stop differs from the one before
    for (let i = 1; i < 5; i++) assert.notDeepEqual(stops[i], stops[i - 1], `${shape}: stop ${i}`);
    // Sparkle and Confetti stray; Textured doesn't (beyond Radial's rings, which move as one)
    const sp = (sc) => (lay(sc), t.grad.scattered);
    assert.ok(sp(3).stray1 > 0.2 && sp(4).stray2 > 0.1, shape + ': strays');
    // a new seed (Shuffle at Textured and up) mixes them again
    assert.notDeepEqual(lay(3, { gradJit: 0.71 }), lay(3), shape + ': another seed');
  }
});

test('Scatter: Around runs round as a loop for its strays, its two ends meeting (a warm set too, laid out and back)', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, { gradShape: 'around', gradScat: 4, palette: 'warm' });
  t.grad.build(cl);
  assert.equal(t.grad.scattered.loop, true);
  style(t, { gradShape: 'serpentine', gradScat: 4, palette: 'warm' });
  t.grad.build(cl);
  assert.equal(t.grad.scattered.loop, false, 'a ramp on Serpentine is turned back at its ends');
});

test('Scatter: below 9 markers it stays Polished (two colour bands made Sparkle and Confetti the same)', () => {
  const { t } = appWith();
  const cl = page(t, 15, 14);
  style(t, { limitN: 8, gradScat: 0 });
  t.grad.build(cl);
  const pol = keys(t);
  for (const sc of [1, 3, 4]) {
    style(t, { limitN: 8, gradScat: sc, gradJit: 0.5 });
    t.grad.build(cl);
    assert.deepEqual(keys(t), pol, 'at ' + sc);
    assert.equal(t.grad.scattered, null);
  }
  style(t, { limitN: 9, gradScat: 4 });
  assert.equal(t.grad.countNow().M, 9);
  assert.equal(t.grad.scatAt(9), 4);
  assert.equal(t.grad.scatAt(8), 0);
  // only the Gradient scatters (not the Photo pattern before it has a photo)
  t.styleVars.family = 'photo';
  assert.equal(t.grad.scatAt(40), 0);
});

test('Scatter: a scattered guide isn’t marked as facing the light, so moving the sun never lays it again', () => {
  const { t } = appWith();
  const cl = page(t, 15, 14);
  for (const sc of [0, 1, 2, 3, 4]) {
    style(t, { gradShape: 'vertical', look: 'ltd', limitN: 48, gradScat: sc });
    t.grad.build(cl);
    assert.equal(!!t.assignData.lit, sc < 2, 'stop ' + sc);
  }
});

test('Scatter: the Look note says Scatter places the markers from Textured up; below that it says what Auto does', () => {
  const { t } = appWith();
  page(t, 15, 14);
  style(t, { gradShape: 'radial', limitN: 999, gradScat: 0 });
  assert.match(t.lookNote(), /^Auto: light to dark/);
  t.styleVars.gradScat = 1;
  assert.match(t.lookNote(), /^Auto: light to dark/);
  t.styleVars.gradScat = 3;
  assert.match(t.lookNote(), /^Auto: markers picked for bands of \d+; Scatter places them\.$/);
  style(t, { gradShape: 'serpentine', gradScat: 2 });
  assert.equal(t.lookNote(), 'Auto: markers picked for a smooth run; Scatter places them.');
  // (only with 9 or more markers, when it scatters at all)
  t.styleVars.limitN = 6;
  assert.equal(t.lookNote(), 'Auto: smooth, as Serpentine runs in rows.');
});

test('Scatter’s saved settings: written only when used (gradScat at Natural and up, gradJit from Textured, gradFix when on); kept by Undo', () => {
  const { t } = appWith();
  const sv = t.styleVars,
    saved = () => ['gradScat', 'gradJit', 'gradFix'].map((k) => field(t, k).save());
  Object.assign(sv, { gradScat: 0, gradJit: 0.4, gradFix: false });
  assert.deepEqual(saved(), [undefined, undefined, undefined]);
  sv.gradScat = 1;
  assert.deepEqual(saved(), [1, undefined, undefined]);
  Object.assign(sv, { gradScat: 3, gradFix: true });
  assert.deepEqual(saved(), [3, 0.4, true]);
  // (the defaults: what an older guide, which says nothing, opens with)
  assert.deepEqual(
    ['gradScat', 'gradJit', 'gradFix'].map((k) => field(t, k).check(undefined, field(t, k).def)),
    [0, 0, false],
  );
  assert.equal(field(t, 'gradScat').check(7.4, 0), 4);
  assert.equal(field(t, 'gradScat').check(2.4, 0), 2);
  // all three kept by Undo
  assert.ok(['gradScat', 'gradJit', 'gradFix'].every((k) => field(t, k).undo));
});

// ---- U6: "all" on a page with more sections than your clear markers ----

test('U6: with the count at all, more sections than clear markers lays the 268 clear ones, some twice, no greys; touching ones rarely share', () => {
  const { app, t } = appWith();
  const cl = page(t, 24, 20); // 480 sections
  for (const shape of ['serpentine', 'radial', 'around']) {
    for (const sc of [0, 1, 3]) {
      style(t, { gradShape: shape, gradScat: sc, gradJit: 0.2 });
      const c = t.grad.count(t.grad.poolSource(480, true), 480);
      assert.deepEqual({ ...c }, { M: 268, reuse: true });
      t.grad.build(cl);
      const A = t.assignData.assign,
        ks = new Set(keys(t));
      assert.equal(ks.size, 268, `${shape} ${sc}: every clear marker`);
      for (const l of t.assignData.order) {
        const x = t.colour.lch(A[l]);
        assert.ok(x[1] >= 20 && x[0] >= 34 && x[0] <= 90, `${shape} ${sc}: ${A[l].code} is clear`);
      }
      // the touching-repeat penalty: at Polished as a clash, at Natural and Scatter split up on its own
      assert.equal(t.grad.smoothed.mode, sc === 0 ? 'reuse' : 'split');
      assert.ok(same(t) <= 6, `${shape} ${sc}: ${same(t)} touching pairs share a marker`);
    }
  }
  void app;
});

test('U6: Ben’s 216-section pages are laid as before; the Earthy, Soft and Deep Moods, a lower count and a palette aren’t changed', () => {
  const { t } = appWith();
  let cl = page(t, 18, 12); // 216
  style(t, {});
  assert.deepEqual({ ...t.grad.count(t.grad.poolSource(216, true), 216) }, { M: 216, reuse: false });
  t.grad.build(cl);
  assert.equal(new Set(keys(t)).size, 216);
  assert.equal(t.grad.smoothed.mode, '');
  cl = page(t, 24, 20); // 480
  for (const emphasis of ['earthy', 'muted', 'deep', 'pastel']) {
    style(t, { emphasis });
    assert.equal(t.grad.count(t.grad.poolSource(480, true), 480).reuse, false, emphasis);
  }
  style(t, { limitN: 300 });
  assert.deepEqual({ ...t.grad.count(t.grad.poolSource(300, true), 480) }, { M: 300, reuse: false });
  void cl;
});

test('U6: the marker count says how many the Gradient lays: “all · 216 used”, “300 · 216 used”, “all · 268, some twice”', () => {
  const { t } = appWith();
  page(t, 18, 12);
  style(t, {});
  assert.equal(t.grad.mkCountLabel(451), 'all · 216 used');
  t.styleVars.limitN = 300;
  assert.equal(t.grad.mkCountLabel(451), '300 · 216 used');
  t.styleVars.limitN = 16;
  assert.equal(t.grad.mkCountLabel(451), '16');
  page(t, 24, 20);
  t.styleVars.limitN = 999;
  assert.equal(t.grad.mkCountLabel(451), 'all · 268, some twice');
  // (Random takes the count's worth: as before)
  t.styleVars.family = 'random';
  assert.equal(t.grad.mkCountLabel(451), 'all (451)');
});

// ---- U7: shading-aware base picks ----

test('U7: laid with shading on, Honolulu 48 at 16 markers picks 14 of 16 that shade (8 without); Ben’s 451 all 16', () => {
  for (const [set, off, on] of [
    [['Honolulu 48'], 8, 14],
    [null, 15, 16],
  ]) {
    const { t } = appWith(set);
    const cl = page(t, 24, 20);
    const count = () => {
      const bk = byKey(t),
        ms = [...new Set(keys(t))].map((k) => bk[k]);
      t.styleVars.shadeMode = 'full';
      return ms.filter((m) => t.grad.shadeOK(m)).length;
    };
    style(t, { limitN: 16 });
    t.grad.build(cl);
    assert.equal(count(), off, 'shading off');
    assert.ok(!t.assignData.shp);
    style(t, { limitN: 16, shadeMode: 'full' });
    t.grad.build(cl);
    assert.ok(count() >= on, `shading on: ${count()} of 16`);
    assert.equal(t.assignData.shp, 1, 'picked with shading in mind');
    // (Shadows needs a darker partner only)
    style(t, { limitN: 16, shadeMode: 'shadow' });
    t.grad.build(cl);
    assert.ok(t.assignData.shp);
  }
});

test('U7: only one marker to a band from your markers is picked that way (bands of several and palettes as before)', () => {
  const { t } = appWith(['Honolulu 48']);
  const cl = page(t, 24, 20);
  style(t, { limitN: 16, look: 'ltd', gradShape: 'vertical' });
  t.grad.build(cl);
  const off = keys(t).join();
  style(t, { limitN: 16, look: 'ltd', gradShape: 'vertical', shadeMode: 'full' });
  t.grad.build(cl);
  assert.equal(keys(t).join(), off);
  assert.ok(!t.assignData.shp);
});

test('U7: turning shading on doesn’t pick again by itself; the Shading tab offers “Pick shadeable ones”, one Undo step, and it’s gone after', () => {
  const { t } = appWith(['Honolulu 48']);
  page(t, 24, 20);
  style(t, { limitN: 16 });
  t.assign.buildGuide();
  const before = keys(t).join();
  t.styleVars.shadeMode = 'full';
  // (nothing laid again: the offer instead)
  assert.equal(keys(t).join(), before);
  const o = t.grad.shadeOffer();
  assert.deepEqual([o.ok, o.n, [...o.ids]], [8, 16, [0]]);
  t.grad.shadePick();
  assert.notEqual(keys(t).join(), before);
  assert.equal(t.planLabel, 'Shadeable markers picked');
  assert.equal(t.grad.shadeOffer(), null, 'gone once picked with shading on');
  // Shadows with the same picks: nothing to offer either
  t.styleVars.shadeMode = 'off';
  assert.equal(t.grad.shadeOffer(), null, 'no shading, no offer');
});

// ---- rough spots ----

test('rough spots: Smooth them gives one of each pair an unused clear marker, never a grey, a second of a code, or a marker twice', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, {});
  t.grad.build(cl);
  const A0 = { ...t.assignData.assign },
    before = t.grad.rough(cl, A0);
  assert.ok(before.length >= 10, before.length + ' rough spots');
  assert.ok(before.every((p) => p[2] > 30));
  // (the codes the guide had in both brands before: the fix adds none)
  const twins = (A) => {
    const by = {};
    for (const m of Object.values(A)) (by[m.code] = by[m.code] || new Set()).add(m.mkey);
    return Object.keys(by).filter((c) => by[c].size > 1);
  };
  const tw0 = twins(A0);
  style(t, { gradFix: true });
  t.grad.build(cl);
  const f = t.grad.fixed,
    A = t.assignData.assign,
    bk = byKey(t);
  assert.ok(f.swaps.length > 0 && f.after < f.before / 2, `${f.before} -> ${f.after}`);
  assert.equal(t.grad.rough(cl, A).length, f.after);
  const added = f.swaps.map((s) => bk[s[1]]);
  for (const m of added) {
    const x = t.colour.lch(m);
    assert.ok(x[1] >= 20 && x[0] >= 34 && x[0] <= 90, m.code + ' is clear');
  }
  assert.deepEqual(
    twins(A).filter((c) => !tw0.includes(c)),
    [],
    'no second of a code in the guide',
  );
  assert.equal(new Set(keys(t)).size, keys(t).length, 'one marker per section still');
  // the flow's first section keeps the Start colour
  assert.equal(A[t.assignData.order[0]].mkey, A0[t.assignData.order[0]].mkey);
  // laid again after a Shuffle: still smoothed
  style(t, { gradFix: true, gradSeed: 0.5 });
  t.grad.build(cl);
  assert.ok(t.grad.fixed.swaps.length > 0, 'kept through Shuffle');
  // Natural and Scatter aren't smoothed this way, nor a count below all your markers
  for (const o of [{ gradScat: 1 }, { gradScat: 3 }, { limitN: 200 }]) {
    style(t, { gradFix: true, ...o });
    t.grad.build(cl);
    assert.equal(t.grad.fixed, null, JSON.stringify(o));
  }
});

test('rough spots: pinned and coloured sections keep their markers; only pairs within the sections given count', () => {
  const { t } = appWith();
  const cl = page(t, 18, 12);
  style(t, {});
  t.grad.build(cl);
  const A = { ...t.assignData.assign },
    pairs = t.grad.rough(cl, A),
    fixed = new Set(pairs.flatMap((p) => [p[0], p[1]]));
  const none = { used: new Set(), codes: new Set() };
  const r = t.grad.fixRun(cl, { ...A }, t.coll, (l) => fixed.has(l), none);
  assert.equal(r.swaps.length, 0, 'every rough section held');
  // half the picture: only its own pairs
  const half = cl.slice(0, cl.length / 2),
    inH = new Set(half);
  assert.ok(t.grad.rough(half, A).every((p) => inH.has(p[0]) && inH.has(p[1])));
  // a greedy pass: with no markers to spare, nothing
  const used = new Set(t.coll.map((m) => m.mkey));
  assert.equal(t.grad.fixRun(cl, { ...A }, t.coll, () => false, { used, codes: new Set() }).swaps.length, 0);
});

test('rough spots: the line under the tabs counts them only at Polished and only when they can be smoothed; Smooth them is one Undo step', () => {
  const { t } = appWith();
  page(t, 18, 12);
  style(t, {});
  t.assign.buildGuide();
  const r = t.grad.roughNow();
  assert.ok(r.pairs.length >= 10 && r.ids.length === 1, r.pairs.length + ' rough spots');
  t.grad.roughSmooth();
  assert.equal(t.styleVars.gradFix, true);
  assert.equal(t.planLabel, 'Rough spots smoothed');
  const after = t.grad.roughNow();
  assert.ok(after.pairs.length < r.pairs.length / 2);
  assert.deepEqual([...after.ids], [], 'nothing more it can do: no line');
  // at Natural: none
  t.styleVars.gradScat = 1;
  t.reassign();
  assert.equal(t.grad.roughNow().ids.length, 0);
  assert.equal(t.grad.roughNow().pairs.length, 0);
});

test('rough spots: on a page with more sections than clear markers every one is used, so there is nothing to smooth', () => {
  const { t } = appWith();
  page(t, 24, 20);
  style(t, {});
  t.assign.buildGuide();
  const r = t.grad.roughNow();
  assert.deepEqual([[...r.ids], [...r.pairs]], [[], []]);
});

// ---- Blend ----

test('Blend: an anchor added by a tap is vivid, not fluorescent, and the hue furthest from the anchors there; none twice', () => {
  for (const set of [null, ['Ciao 12']]) {
    const { t } = appWith(set);
    const cl = page(t, 18, 12);
    style(t, { family: 'blend' });
    t.anchors = [];
    t.seedAnchors(cl);
    for (let i = 0; i < 6; i++) t.addAnchor({ x: 10 + i, y: 10 });
    const bk = byKey(t),
      ms = t.anchors.map((a) => bk[a.mkey]);
    assert.equal(new Set(ms.map((m) => m.mkey)).size, 9, 'none twice');
    const cs = t.coll.map((m) => t.colour.lch(m)[1]).sort((a, b) => a - b),
      med = cs[Math.floor(cs.length / 2)];
    for (const m of ms.slice(3, set ? 4 : 9)) {
      assert.notEqual(m.fam, 'Fluorescent', m.code);
      assert.ok(t.colour.lch(m)[1] >= med, m.code + ' is vivid');
    }
    if (!set)
      assert.deepEqual([...ms.slice(3, 8).map((m) => m.code)], ['RV25', 'YR20', 'BG011', 'RV13', 'V414']);
  }
});
