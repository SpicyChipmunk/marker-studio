// The palette generator (picker.js genPalette, rerollPick): every two colours clearly different (CIEDE2000 10,
// Monochrome 6), no near-greys in a colour scheme, colours near their scheme hues (Analogous within 120°), full
// palettes on small collections with the relaxing reported, locked colours kept and kept apart from, the guide's
// moods, and re-rolling one colour by the same rules. Rolls use a seeded Math.random so a failure repeats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage, cpuMs } from './harness.mjs';

// a small seeded random number generator (mulberry32); the harness shares Math with the app
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function withSeed(seed, fn) {
  const orig = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}
function appWith(set) {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval('state.owned = new Set(); state.pool = null');
  if (set) a.__eval(`presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`);
  return a;
}
const S320 = 'Honolulu 320 (complete set)', S24 = 'Honolulu 24';
const hd = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
// the smallest arc of the colour wheel holding all these hues
function arc(hs) {
  if (hs.length < 2) return 0;
  const s = [...hs].sort((a, b) => a - b);
  let g = 360 - s[s.length - 1] + s[0];
  for (let i = 1; i < s.length; i++) g = Math.max(g, s[i] - s[i - 1]);
  return 360 - g;
}
const ANCH = { complementary: [0, 180], split: [0, 150, 210], triadic: [0, 120, 240], tetradic: [0, 90, 180, 270] };
// whether some base hue puts every hue within 30° of one of the scheme's hues
const fitsAnchors = (hs, A) => { for (let b = 0; b < 360; b++) if (hs.every((h) => A.some((a) => hd(h, b + a) <= 30))) return true; return false; };

function tools(a) {
  const LAB = a.__eval('LAB'), LCH = a.__eval('LCH'), de = a.__eval('de2000'), GREY_C = a.__eval('GREY_C');
  const gen = (n, h, opts = {}) => {
    const report = {};
    const p = a.__eval('genPalette')(n, h, { ...opts, report });
    return { pal: p ? [...p] : null, report };
  };
  const minDE = (pal, skip = new Set()) => {
    let m = Infinity;
    for (let i = 0; i < pal.length; i++) for (let j = i + 1; j < pal.length; j++) if (!(skip.has(pal[i]) && skip.has(pal[j]))) m = Math.min(m, de(LAB[pal[i]], LAB[pal[j]]));
    return m;
  };
  const lch = (i) => [...LCH[i]];
  const clearHues = (pal) => pal.map(lch).filter((x) => x[1] >= GREY_C).map((x) => x[2]);
  return { gen, minDE, lch, clearHues, GREY_C, de: (i, j) => de(LAB[i], LAB[j]), R: a.__eval('HARM_RANGE') };
}

test('the sizes each scheme offers', () => {
  const R = JSON.parse(JSON.stringify(createApp().__eval('HARM_RANGE')));
  assert.deepEqual(R, { complementary: [2, 8], analogous: [2, 8], triadic: [3, 10], split: [3, 10], tetradic: [4, 12], mono: [2, 10], custom: [2, 16], photo: [4, 16] });
});

test('320 set: every scheme at every size is full, clearly different, grey-free and on its hues', () => {
  const a = appWith(S320), t = tools(a);
  withSeed(1, () => {
    for (const h of ['complementary', 'analogous', 'triadic', 'split', 'tetradic', 'mono']) {
      const [lo, hi] = t.R[h], need = h === 'mono' ? 6 : 10;
      for (let n = lo; n <= hi; n++) {
        let clean = 0;
        const R = 12;
        for (let r = 0; r < R; r++) {
          const { pal, report } = t.gen(n, h);
          assert.ok(pal && pal.length === n, `${h} ${n}: a full palette`);
          assert.equal(new Set(pal).size, n, `${h} ${n}: no marker twice`);
          const m = t.minDE(pal);
          assert.equal(report.need, need);
          assert.equal(report.relaxed, m < need, `${h} ${n}: the report says whether it relaxed (${m})`);
          assert.ok(Math.abs(report.minDE - m) < 1e-6, 'the report gives the smallest difference');
          if (m >= need) clean++;
          if (h !== 'mono') assert.ok(pal.every((i) => t.lch(i)[1] >= t.GREY_C), `${h} ${n}: no near-grey`);
          const hs = t.clearHues(pal);
          if (h === 'analogous') assert.ok(arc(hs) <= 120, `${h} ${n}: within 120° (${arc(hs)})`);
          else if (h === 'mono') assert.ok(arc(hs) <= 70, `${h} ${n}: one hue (${arc(hs)})`);
          else assert.ok(fitsAnchors(hs, ANCH[h]), `${h} ${n}: each colour near a scheme hue`);
        }
        assert.ok(clean >= R * 0.9, `${h} ${n}: clean in ${clean} of ${R}`);
      }
    }
  });
});

test('a clean palette reports nothing relaxed', () => {
  const t = tools(appWith(S320));
  withSeed(2, () => {
    const { report } = t.gen(6, 'triadic');
    assert.equal(report.relaxed, false);
    assert.equal(report.hueWidened, false);
    assert.equal(report.moodWidened, 0);
    assert.equal(report.grey, false);
  });
});

test('24 set: full palettes at every size, relaxing (and saying so) rather than giving fewer', () => {
  const a = appWith(S24), t = tools(a);
  withSeed(3, () => {
    let relaxed = 0;
    for (const h of ['complementary', 'analogous', 'triadic', 'split', 'tetradic', 'mono']) {
      const [lo, hi] = t.R[h], need = h === 'mono' ? 6 : 10;
      for (let n = lo; n <= hi; n++)
        for (let r = 0; r < 6; r++) {
          const { pal, report } = t.gen(n, h);
          assert.ok(pal && pal.length === n && new Set(pal).size === n, `${h} ${n}: full`);
          const m = t.minDE(pal);
          assert.equal(report.relaxed, m < need, `${h} ${n}: reported`);
          if (report.relaxed) relaxed++;
        }
    }
    assert.ok(relaxed > 0, 'a 24-marker collection has to relax at the bigger sizes');
    // Analogous gives up closeness before spreading past 120°: at 6 colours it still fits
    for (let r = 0; r < 30; r++) {
      const { pal, report } = t.gen(6, 'analogous');
      assert.ok(arc(t.clearHues(pal)) <= 120, 'analogous 6 within 120°');
      assert.equal(report.hueWidened, false);
    }
  });
});

test('more colours than markers in play: null, as before', () => {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval("state.owned = new Set(['Ohuhu|R014', 'Ohuhu|B08', 'Ohuhu|Y111'].filter((k) => keyIdx(k) != null))");
  const n = a.__eval('state.owned.size');
  assert.ok(n >= 2);
  assert.equal(a.__eval(`genPalette(${n + 1}, 'complementary')`), null);
  assert.equal(a.__eval(`genPalette(${n}, 'complementary')`).length, n, 'as many as there are is fine');
});

test('locked colours stay put, the rest keep clear of them; a close locked pair is the user’s choice', () => {
  const a = appWith(S320), t = tools(a);
  withSeed(4, () => {
    const base = t.gen(6, 'complementary').pal;
    for (let r = 0; r < 20; r++) {
      const locked = { 0: base[0], 3: base[3] };
      const { pal, report } = t.gen(6, 'complementary', { locked });
      assert.equal(pal[0], base[0]);
      assert.equal(pal[3], base[3]);
      if (!report.relaxed) for (const i of pal) if (i !== base[0] && i !== base[3]) assert.ok(t.de(i, base[0]) >= 10 && t.de(i, base[3]) >= 10);
    }
    // two locked markers that look the same: not counted against the palette
    const pair = a.__eval('(() => { const P = COLORS.map((_, i) => i).filter((i) => inPool(i) && LCH[i][1] > 20); for (const x of P) for (const y of P) if (x < y && de2000(LAB[x], LAB[y]) < 4) return [x, y]; })()');
    const { pal, report } = t.gen(5, 'split', { locked: { 0: pair[0], 1: pair[1] } });
    assert.deepEqual(pal.slice(0, 2), [...pair]);
    assert.ok(t.de(pair[0], pair[1]) < 4);
    assert.equal(report.relaxed, false, 'the locked pair is left out');
    assert.ok(report.minDE >= 10);
  });
});

test('Monochrome: one hue from a real colour; a greyish family may use its near-greys, others not', () => {
  const a = appWith(S320), t = tools(a);
  withSeed(5, () => {
    for (let r = 0; r < 20; r++) {
      const { pal } = t.gen(8, 'mono');
      assert.ok(arc(t.clearHues(pal)) <= 70);
      assert.ok(pal.every((i) => t.lch(i)[1] >= t.GREY_C), 'a colourful family: no near-greys');
    }
    // a warm grey seed: its own family's greys are fine
    const wg = a.__eval("COLORS.findIndex((c, i) => inPool(i) && c.fam === 'Warm Grey')");
    assert.ok(wg >= 0);
    const { pal } = t.gen(5, 'mono', { seedIdx: wg, locked: { 0: wg } });
    assert.equal(pal.length, 5);
    assert.ok(pal.filter((i) => a.__eval(`COLORS[${i}].fam`) === 'Warm Grey').length >= 4, 'stays in the warm greys');
  });
});

test('moods: colours from inside the look, and the report counts any from outside it', () => {
  const a = appWith(S320), t = tools(a);
  const off = (mood, i) => a.__eval('moodOff')(mood, a.__eval(`LCH[${i}]`));
  withSeed(6, () => {
    for (const mood of ['vivid', 'muted', 'pastel', 'deep', 'earthy']) {
      let outside = 0, total = 0;
      for (let r = 0; r < 12; r++) {
        const { pal, report } = t.gen(6, 'analogous', { mood });
        const o = pal.filter((i) => off(mood, i) > 0).length;
        assert.equal(report.moodWidened, o, `${mood}: the report counts the colours outside the look`);
        outside += o;
        total += pal.length;
      }
      assert.ok(outside / total < 0.15, `${mood}: mostly inside the look (${outside}/${total})`);
    }
    // Pastel aims light, Deep dark
    const L = (mood) => { let s = 0; for (let r = 0; r < 10; r++) for (const i of t.gen(6, 'triadic', { mood }).pal) s += t.lch(i)[0]; return s / 60; };
    assert.ok(L('pastel') > 78 && L('deep') < 52 && L('pastel') > L('neutral') && L('deep') < L('neutral'));
    // no mood, or one it doesn't know: Any
    assert.equal(t.gen(4, 'complementary', { mood: 'toString' }).pal.length, 4);
  });
});

test('demo mode and filters: the whole catalogue with nothing owned; a filtered-out family is never used', () => {
  const a = appWith(null), t = tools(a);
  withSeed(7, () => {
    assert.equal(a.__eval('state.owned.size'), 0);
    for (let r = 0; r < 5; r++) assert.equal(t.gen(12, 'tetradic').pal.length, 12);
    a.__eval("state.excluded = new Set(['Red', 'Blue'])");
    for (let r = 0; r < 20; r++) for (const i of t.gen(8, 'split').pal) assert.ok(!['Red', 'Blue'].includes(a.__eval(`COLORS[${i}].fam`)));
  });
});

test('re-rolling one colour: a free marker near it, clearly different from the rest, never a near-grey', () => {
  const a = appWith(S320), t = tools(a);
  withSeed(8, () => {
    for (const h of ['complementary', 'analogous', 'tetradic', 'mono']) {
      const need = h === 'mono' ? 6 : 10;
      for (let r = 0; r < 10; r++) {
        const pal = t.gen(t.R[h][1], h).pal, k = r % pal.length;
        const pick = a.__eval('rerollPick')(pal, k, h);
        assert.ok(pick >= 0 && !pal.includes(pick), `${h}: a marker not already in the palette`);
        const next = pal.slice();
        next[k] = pick;
        const others = pal.filter((_, p) => p !== k);
        assert.ok(others.every((i) => t.de(i, pick) >= need), `${h}: clearly different from the others`);
        if (h !== 'mono') assert.ok(t.lch(pick)[1] >= t.GREY_C, `${h}: not a near-grey`);
        if (h === 'analogous') assert.ok(arc(t.clearHues(next)) <= 120, 'analogous stays within 120°');
        else if (h !== 'mono') {
          // (v298: aimed at the scheme hue nearest it, so it stays on the scheme the palette was on)
          assert.ok(hd(t.lch(pick)[2], t.lch(pal[k])[2]) <= 60, `${h}: near the colour it replaces`);
          if (a.__eval('palOnScheme')(pal, h, new Set())) assert.ok(a.__eval('palOnScheme')(next, h, new Set()), `${h}: still on the scheme`);
        }
      }
    }
  });
});

test('a roll on a 680-marker collection is quick', () => {
  const a = appWith(S320);
  a.__eval("COLORS.forEach((c, i) => { if (c.brand === 'Copic') state.owned.add(mkey(i)); })");
  a.__eval("presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')).forEach((k) => state.owned.add(k))");
  const n = a.__eval('COLORS.filter((_, i) => inPool(i)).length');
  assert.ok(n > 600, n + ' markers');
  withSeed(9, () => {
    a.__eval("genPalette(12, 'tetradic')");
    // processor time: other test files running alongside slow the clock, not the work
    const t0 = cpuMs();
    for (let r = 0; r < 20; r++) a.__eval("genPalette(12, 'tetradic'); genPalette(10, 'mono'); genPalette(8, 'analogous')");
    const ms = (cpuMs() - t0) / 60;
    // (a limit that catches a slowdown of several times; GitHub's runners are 2-3 times slower than ours)
    assert.ok(ms < 60, `${ms.toFixed(1)} ms a roll`);
  });
});
