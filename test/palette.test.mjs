// The palette generator and the Palette screen’s logic.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, cpuMs, createApp, memoryStorage } from './harness.mjs';
import fs from 'node:fs';
import fsSync from 'node:fs';

// ---- from palette-generator.test.mjs ----
// The palette generator (picker.js genPalette, rerollPick): every two colours clearly different (CIEDE2000 10,
// Monochrome 6), no near-greys in a colour scheme, colours near their scheme hues (Analogous within 120°), full
// palettes on small collections with the relaxing reported, locked colours kept and kept apart from, the guide's
// moods, and re-rolling one colour by the same rules. Rolls use a seeded Math.random so a failure repeats.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
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
    if (set)
      a.__eval(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
      );
    return a;
  }
  const S320 = 'Honolulu 320 (complete set)',
    S24 = 'Honolulu 24';
  const hd = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  };
  // the smallest arc of the colour wheel holding all these hues
  function arc(hs) {
    if (hs.length < 2) return 0;
    const s = [...hs].sort((a, b) => a - b);
    let g = 360 - s[s.length - 1] + s[0];
    for (let i = 1; i < s.length; i++) g = Math.max(g, s[i] - s[i - 1]);
    return 360 - g;
  }
  const ANCH = {
    complementary: [0, 180],
    split: [0, 150, 210],
    triadic: [0, 120, 240],
    tetradic: [0, 90, 180, 270],
  };
  // whether some base hue puts every hue within 30° of one of the scheme's hues
  const fitsAnchors = (hs, A) => {
    for (let b = 0; b < 360; b++) if (hs.every((h) => A.some((a) => hd(h, b + a) <= 30))) return true;
    return false;
  };
  function tools(a) {
    const LAB = a.__eval('LAB'),
      LCH = a.__eval('LCH'),
      de = a.__eval('de2000'),
      GREY_C = a.__eval('GREY_C');
    const gen = (n, h, opts = {}) => {
      const report = {};
      const p = a.__eval('genPalette')(n, h, { ...opts, report });
      return { pal: p ? [...p] : null, report };
    };
    const minDE = (pal, skip = new Set()) => {
      let m = Infinity;
      for (let i = 0; i < pal.length; i++)
        for (let j = i + 1; j < pal.length; j++)
          if (!(skip.has(pal[i]) && skip.has(pal[j]))) m = Math.min(m, de(LAB[pal[i]], LAB[pal[j]]));
      return m;
    };
    const lch = (i) => [...LCH[i]];
    const clearHues = (pal) =>
      pal
        .map(lch)
        .filter((x) => x[1] >= GREY_C)
        .map((x) => x[2]);
    return {
      gen,
      minDE,
      lch,
      clearHues,
      GREY_C,
      de: (i, j) => de(LAB[i], LAB[j]),
      R: a.__eval('HARM_RANGE'),
    };
  }
  test('the sizes each scheme offers', () => {
    const R = JSON.parse(JSON.stringify(createApp().__eval('HARM_RANGE')));
    // (v318.34: Light to shadow, Analogous + accent and Greys + accent, 3–8; 3–6 below 72 markers in play: rampMax)
    assert.deepEqual(R, {
      complementary: [2, 8],
      analogous: [2, 8],
      triadic: [3, 10],
      split: [3, 10],
      tetradic: [4, 12],
      mono: [2, 10],
      shadow: [3, 8],
      accent: [3, 8],
      neutral: [3, 8],
      rainbow: [6, 16],
      custom: [2, 16],
      photo: [4, 16],
    });
  });
  test('320 set: every scheme at every size is full, clearly different, grey-free and on its hues', () => {
    const a = appWith(S320),
      t = tools(a);
    withSeed(1, () => {
      for (const h of ['complementary', 'analogous', 'triadic', 'split', 'tetradic', 'mono']) {
        const [lo, hi] = t.R[h],
          need = h === 'mono' ? 6 : 10;
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
            if (h !== 'mono')
              assert.ok(
                pal.every((i) => t.lch(i)[1] >= t.GREY_C),
                `${h} ${n}: no near-grey`,
              );
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
    const a = appWith(S24),
      t = tools(a);
    withSeed(3, () => {
      let relaxed = 0;
      for (const h of ['complementary', 'analogous', 'triadic', 'split', 'tetradic', 'mono']) {
        const [lo, hi] = t.R[h],
          need = h === 'mono' ? 6 : 10;
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
    a.__eval(
      "state.owned = new Set(['Ohuhu|R014', 'Ohuhu|B08', 'Ohuhu|Y111'].filter((k) => keyIdx(k) != null))",
    );
    const n = a.__eval('state.owned.size');
    assert.ok(n >= 2);
    assert.equal(a.__eval(`genPalette(${n + 1}, 'complementary')`), null);
    assert.equal(a.__eval(`genPalette(${n}, 'complementary')`).length, n, 'as many as there are is fine');
  });
  test('locked colours stay put, the rest keep clear of them; a close locked pair is the user’s choice', () => {
    const a = appWith(S320),
      t = tools(a);
    withSeed(4, () => {
      const base = t.gen(6, 'complementary').pal;
      for (let r = 0; r < 20; r++) {
        const locked = { 0: base[0], 3: base[3] };
        const { pal, report } = t.gen(6, 'complementary', { locked });
        assert.equal(pal[0], base[0]);
        assert.equal(pal[3], base[3]);
        if (!report.relaxed)
          for (const i of pal)
            if (i !== base[0] && i !== base[3]) assert.ok(t.de(i, base[0]) >= 10 && t.de(i, base[3]) >= 10);
      }
      // two locked markers that look the same: not counted against the palette
      const pair = a.__eval(
        '(() => { const P = COLORS.map((_, i) => i).filter((i) => inPool(i) && LCH[i][1] > 20); for (const x of P) for (const y of P) if (x < y && de2000(LAB[x], LAB[y]) < 4) return [x, y]; })()',
      );
      const { pal, report } = t.gen(5, 'split', { locked: { 0: pair[0], 1: pair[1] } });
      assert.deepEqual(pal.slice(0, 2), [...pair]);
      assert.ok(t.de(pair[0], pair[1]) < 4);
      assert.equal(report.relaxed, false, 'the locked pair is left out');
      assert.ok(report.minDE >= 10);
    });
  });
  test('Monochrome: one hue from a real colour; a greyish family may use its near-greys, others not', () => {
    const a = appWith(S320),
      t = tools(a);
    withSeed(5, () => {
      for (let r = 0; r < 20; r++) {
        const { pal } = t.gen(8, 'mono');
        assert.ok(arc(t.clearHues(pal)) <= 70);
        assert.ok(
          pal.every((i) => t.lch(i)[1] >= t.GREY_C),
          'a colourful family: no near-greys',
        );
      }
      // a warm grey seed: its own family's greys are fine
      const wg = a.__eval("COLORS.findIndex((c, i) => inPool(i) && c.fam === 'Warm Grey')");
      assert.ok(wg >= 0);
      const { pal } = t.gen(5, 'mono', { seedIdx: wg, locked: { 0: wg } });
      assert.equal(pal.length, 5);
      assert.ok(
        pal.filter((i) => a.__eval(`COLORS[${i}].fam`) === 'Warm Grey').length >= 4,
        'stays in the warm greys',
      );
    });
  });
  test('moods: colours from inside the look, and the report counts any from outside it', () => {
    const a = appWith(S320),
      t = tools(a);
    const off = (mood, i) => a.__eval('moodOff')(mood, a.__eval(`LCH[${i}]`));
    withSeed(6, () => {
      for (const mood of ['vivid', 'muted', 'pastel', 'deep', 'earthy']) {
        let outside = 0,
          total = 0;
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
      const L = (mood) => {
        let s = 0;
        for (let r = 0; r < 10; r++) for (const i of t.gen(6, 'triadic', { mood }).pal) s += t.lch(i)[0];
        return s / 60;
      };
      assert.ok(L('pastel') > 78 && L('deep') < 52 && L('pastel') > L('neutral') && L('deep') < L('neutral'));
      // no mood, or one it doesn't know: Any
      assert.equal(t.gen(4, 'complementary', { mood: 'toString' }).pal.length, 4);
    });
  });
  test('demo mode and filters: the whole catalogue with nothing owned; a filtered-out family is never used', () => {
    const a = appWith(null),
      t = tools(a);
    withSeed(7, () => {
      assert.equal(a.__eval('state.owned.size'), 0);
      for (let r = 0; r < 5; r++) assert.equal(t.gen(12, 'tetradic').pal.length, 12);
      a.__eval("state.excluded = new Set(['Red', 'Blue'])");
      for (let r = 0; r < 20; r++)
        for (const i of t.gen(8, 'split').pal)
          assert.ok(!['Red', 'Blue'].includes(a.__eval(`COLORS[${i}].fam`)));
    });
  });
  test('re-rolling one colour: a free marker near it, clearly different from the rest, never a near-grey', () => {
    const a = appWith(S320),
      t = tools(a);
    withSeed(8, () => {
      for (const h of ['complementary', 'analogous', 'tetradic', 'mono']) {
        const need = h === 'mono' ? 6 : 10;
        for (let r = 0; r < 10; r++) {
          const pal = t.gen(t.R[h][1], h).pal,
            k = r % pal.length;
          const pick = a.__eval('rerollPick')(pal, k, h);
          assert.ok(pick >= 0 && !pal.includes(pick), `${h}: a marker not already in the palette`);
          const next = pal.slice();
          next[k] = pick;
          const others = pal.filter((_, p) => p !== k);
          // (v318.34: a Monochrome of 10 is a ramp over the family's whole range, which can leave no free marker in
          // its hue window (round the palette's mean hue, as rerollPick looks) 6 from every other; then the re-roll
          // comes as close as it can, and the note says so)
          const roomLeft =
            h !== 'mono' ||
            a.__eval(
              `(() => { const pal = ${JSON.stringify(pal)}, others = ${JSON.stringify(others)}; let x = 0, y = 0; for (const i of pal) { x += Math.cos(LCH[i][2] * Math.PI / 180); y += Math.sin(LCH[i][2] * Math.PI / 180); } const bh = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; return COLORS.some((c, i) => inPool(i) && !pal.includes(i) && LCH[i][1] >= GREY_C && hueDist(LCH[i][2], bh) <= 25 && others.every((o) => de2000(LAB[o], LAB[i]) >= ${need})); })()`,
            );
          if (roomLeft)
            assert.ok(
              others.every((i) => t.de(i, pick) >= need),
              `${h}: clearly different from the others`,
            );
          if (h !== 'mono') assert.ok(t.lch(pick)[1] >= t.GREY_C, `${h}: not a near-grey`);
          if (h === 'analogous') assert.ok(arc(t.clearHues(next)) <= 120, 'analogous stays within 120°');
          else if (h !== 'mono') {
            // (v298: aimed at the scheme hue nearest it, so it stays on the scheme the palette was on)
            assert.ok(hd(t.lch(pick)[2], t.lch(pal[k])[2]) <= 60, `${h}: near the colour it replaces`);
            if (a.__eval('palOnScheme')(pal, h, new Set()))
              assert.ok(a.__eval('palOnScheme')(next, h, new Set()), `${h}: still on the scheme`);
          }
        }
      }
    });
  });
  test('a roll on a 680-marker collection is quick', () => {
    const a = appWith(S320);
    a.__eval("COLORS.forEach((c, i) => { if (c.brand === 'Copic') state.owned.add(mkey(i)); })");
    a.__eval(
      "presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')).forEach((k) => state.owned.add(k))",
    );
    const n = a.__eval('COLORS.filter((_, i) => inPool(i)).length');
    assert.ok(n > 600, n + ' markers');
    withSeed(9, () => {
      a.__eval("genPalette(12, 'tetradic')");
      // processor time: other test files running alongside slow the clock, not the work
      const t0 = cpuMs();
      for (let r = 0; r < 20; r++)
        a.__eval("genPalette(12, 'tetradic'); genPalette(10, 'mono'); genPalette(8, 'analogous')");
      const ms = (cpuMs() - t0) / 60;
      // (a limit that catches a slowdown of several times; GitHub's runners are 2-3 times slower than ours)
      assert.ok(ms < 60, `${ms.toFixed(1)} ms a roll`);
    });
  });
}

// ---- from v296.test.mjs ----
// v296 fixes outside the browser: the palette's Undo goes back to that palette's scheme and size; a colour locked past
// a smaller size is kept; a chosen base marker sits in the middle of an Analogous fan; the scheme check allows the half
// degree its own steps can miss; "… base" only for a chosen marker; unreadable saved data with no room for a copy.
{
  const fresh = () => {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval(
      'showPalette=function(){};chrome=function(){};fullRender=function(){};clearPalette=function(){};showCustom=function(){}',
    );
    return a.__eval;
  };
  test('palette Undo: back to the palette before with its own scheme and size', () => {
    const E = fresh();
    E(
      `state.mode='palette';state.harmony='complementary';state.palSize=4;state.palettes=[];state.palH=[];state.locked=[];state.seed=null`,
    );
    E(`palPush(genPalette(4,'complementary',{}),24)`);
    E(`palPush(genPalette(4,'complementary',{}),24)`);
    E(`setHarmony('analogous')`);
    E(`setSize(8)`);
    // (v308: the scheme change is a step of its own, which the size change then replaces)
    assert.equal(E('state.palettes.length'), 3);
    E('undo()');
    assert.equal(E('state.harmony'), 'complementary');
    assert.equal(E('state.palSize'), 4);
    assert.equal(E('state.palettes[state.palettes.length-1].length'), 4);
    assert.equal(E('state.palH.length'), E('state.palettes.length'), 'the schemes stay in step');
  });
  test('a colour locked past a smaller size moves into a free place instead of going', () => {
    const E = fresh();
    for (let r = 0; r < 10; r++) {
      E(
        `state.mode='palette';state.harmony='complementary';state.palSize=8;state.palettes=[];state.palH=[];state.locked=[];state.seed=null`,
      );
      E(`palPush(genPalette(8,'complementary',{}),24)`);
      const last = E('state.palettes[0][7]');
      E(`state.locked=[${last}]`);
      E('setSize(4)');
      assert.ok(E(`state.palettes[state.palettes.length-1].includes(${last})`), 'still there');
      assert.ok(E(`state.locked.includes(${last})`), 'still locked');
    }
  });
  test('Analogous built from a chosen marker: as many colours on either side of it', () => {
    const E = fresh();
    // (v323) seeded: unseeded, about one run in 25 fell outside the 20% band by chance (balance ~0.55 of it on average)
    E(
      `(() => { let s = 323; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })()`,
    );
    const seeds = E(`COLORS.map((c,i)=>i).filter(i=>LCH[i][1]>=35&&LCH[i][0]>40&&LCH[i][0]<75)`).filter(
      (_, k) => k % 9 === 0,
    );
    let above = 0,
      below = 0;
    for (const s of seeds)
      for (let r = 0; r < 4; r++) {
        const p = [...E(`genPalette(5,'analogous',{baseHue:LCH[${s}][2],locked:{0:${s}},seedIdx:${s}})`)];
        assert.equal(p[0], s, 'the chosen marker first');
        for (const i of p.slice(1)) {
          const o = E(`hueOff(LCH[${i}][2],LCH[${s}][2])`);
          if (o > 2) above++;
          else if (o < -2) below++;
        }
      }
    assert.ok(Math.abs(above - below) < (above + below) * 0.2, `${above} above, ${below} below`);
  });
  test('the scheme check allows the half degree between the hues it tries', () => {
    const E = fresh();
    // two clear colours spread across 119.5°–120° of hue: within Analogous's 120°, but between the whole degrees tried
    const pair = E(
      `(() => { const C = LCH.map((l, i) => [l, i]).filter(([l]) => l[1] >= 25 && Math.abs(l[2] - Math.round(l[2])) > 0.2); for (const [a, i] of C) for (const [b, j] of C) { const s = (b[2] - a[2] + 360) % 360; if (s > 119.5 && s < 120) return [i, j]; } return null; })()`,
    );
    assert.ok(pair, 'a pair to try');
    assert.equal(E(`palOnScheme([${[...pair]}], 'analogous', new Set())`), true);
  });
  test('the scheme line names a base only for a marker chosen to build from', () => {
    const E = fresh();
    E(`state.harmony='complementary';state.seed=null`);
    const pal = E(`genPalette(4,'complementary',{})`);
    assert.equal(E(`palSub([${[...pal]}])`), 'Complementary');
    const s = pal[0];
    E(`state.seed=mkey(${s})`);
    assert.match(E(`palSub([${[...pal]}])`), /^Complementary · .+ base$/);
  });
  test('unreadable saved data with no room to keep a copy: the note says so, and the original is kept for this time', () => {
    const raw = JSON.stringify({
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R14'],
      saved: [
        { id: 111, type: 'palette', name: 'Good', keys: ['Ohuhu|R14'] },
        { id: 'oops', type: 'guide', name: 'newer', keys: [] },
      ],
    });
    const ls = memoryStorage({ 'ohuhu-hb320-picker-v3': raw });
    const set = ls.setItem;
    ls.setItem = (k, v) => {
      if (k === 'ms-state-backup') throw new Error('QuotaExceededError');
      return set(k, v);
    };
    const a = createApp({ localStorage: ls });
    assert.equal(JSON.parse(ls.getItem('ms-load-note')).nocopy, true);
    assert.equal(a.__eval('_lossRaw'), raw);
    // with room, as before: a copy, and no such word
    const ls2 = memoryStorage({ 'ohuhu-hb320-picker-v3': raw });
    const b = createApp({ localStorage: ls2 });
    assert.equal(ls2.getItem('ms-state-backup'), raw);
    assert.equal(JSON.parse(ls2.getItem('ms-load-note')).nocopy, undefined);
    assert.equal(b.__eval('_lossRaw'), null);
  });
  test('keyIdx finds every marker by its key', () => {
    const E = fresh();
    assert.equal(E('COLORS.every((c, i) => keyIdx(mkey(i)) === i)'), true);
    assert.equal(E(`keyIdx('Nope|X1')`), null);
  });
}

// ---- from v298.test.mjs ----
// v298 fixes outside the browser: re-rolling a colour stays on its scheme; the scheme check is exact; the Colorless
// Blender is never picked as a colour; a saved time that isn't one is dropped; the note about lost data is kept even
// when the copy takes the last of the room; and what Scan reads: a colour name another code accounts for, and a list's
// every line.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
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
  const S320 = 'Honolulu 320 (complete set)';
  function appWith(set) {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval('state.owned = new Set(); state.pool = null');
    if (set)
      a.__eval(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
      );
    return a;
  }
  const C = app.__eval('COLORS');
  const nm = (i) => C[i].brand + ' ' + C[i].code;
  const idx = (brand, code) => C.findIndex((c) => c.brand === brand && c.code === code);
  test('re-rolling one colour again and again keeps it on the palette’s scheme', () => {
    const a = appWith(S320),
      E = a.__eval;
    withSeed(3, () => {
      for (const h of ['complementary', 'triadic', 'tetradic', 'split']) {
        let off = 0,
          tries = 0;
        for (let r = 0; r < 6; r++) {
          let pal = [...E(`genPalette(${h === 'tetradic' ? 4 : 3}, '${h}', {})`)];
          if (!E('palOnScheme')(pal, h, new Set())) continue;
          const k = r % pal.length;
          for (let n = 0; n < 25; n++) {
            const p = E('rerollPick')(pal, k, h);
            if (p < 0) break;
            pal = pal.slice();
            pal[k] = p;
            tries++;
            if (!E('palOnScheme')(pal, h, new Set())) off++;
          }
        }
        assert.ok(tries > 50, h + ': rolled');
        assert.equal(off, 0, `${h}: ${off} of ${tries} re-rolls left the scheme`);
      }
    });
  });
  test('the scheme check is exact: on the edge of Analogous’s spread passes, a little past it doesn’t', () => {
    const E = appWith(S320).__eval;
    const pair = (lo, hi) =>
      E(
        `(() => { const C = LCH.map((l, i) => [l, i]).filter(([l]) => l[1] >= 25); for (const [a, i] of C) for (const [b, j] of C) { const s = (b[2] - a[2] + 360) % 360; if (s > ${lo} && s < ${hi}) return [i, j]; } return null; })()`,
      );
    const inside = pair(119.6, 120),
      past = pair(120.05, 120.45);
    assert.ok(inside && past, 'pairs to try');
    assert.equal(E('palOnScheme')([...inside], 'analogous', new Set()), true);
    assert.equal(E('palOnScheme')([...past], 'analogous', new Set()), false);
    // Complementary: two colours exactly opposite, and 30° either side of opposite, are on it; 61° off isn't
    const comp = (d) =>
      E(
        `(() => { const C = LCH.map((l, i) => [l, i]).filter(([l]) => l[1] >= 25); for (const [a, i] of C) for (const [b, j] of C) { const s = hueDist(a[2], b[2] + 180); if (Math.abs(s - ${d}) < 0.5) return [i, j]; } return null; })()`,
      );
    assert.equal(E('palOnScheme')([...comp(0)], 'complementary', new Set()), true);
    assert.equal(E('palOnScheme')([...comp(59.6)], 'complementary', new Set()), true);
    assert.equal(E('palOnScheme')([...comp(61)], 'complementary', new Set()), false);
  });
  test('the Colorless Blender can be owned but is never picked as a colour', () => {
    const a = appWith(null),
      E = a.__eval;
    const b = E(`COLORS.findIndex((c) => /Colorless Blender/.test(c.name))`);
    assert.ok(b >= 0);
    E(`COLORS.forEach((c, i) => { if (c.brand === 'Copic') state.owned.add(mkey(i)); })`);
    assert.equal(E(`isOwned(${b})`), true, 'ownable');
    assert.equal(E(`inPool(${b})`), false, 'not in play');
    const m = E('matchNearest([100, 0, 0])');
    assert.ok(![...m.owned, ...m.buy].some((o) => o.i === b), 'not the match for white paper');
    assert.ok(!E('sfCollection()').some((m) => /Colorless/.test(m.name)), 'not in a guide’s markers');
    // with no collection, all markers are in play: still not this one
    const c = appWith(null);
    assert.equal(c.__eval(`inPool(${b})`), false);
  });
  test('a saved palette whose time isn’t a time loses it (no "Invalid Date"); a real one is kept', () => {
    const E = appWith(null).__eval;
    assert.equal(E(`cleanSaved({ id: 5, ts: 'soon' }).ts`), undefined);
    assert.equal(E(`'ts' in cleanSaved({ id: 5, ts: -3 })`), false);
    assert.equal(E(`cleanSaved({ id: 5, ts: '1700000000000' }).ts`), 1700000000000);
    assert.equal(E(`cleanSaved({ id: 5 }).ts`), undefined);
  });
  test('unreadable saved data: the note about it is kept even when the copy takes the last of the room', () => {
    const raw = JSON.stringify({
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R14'],
      saved: [{ id: 'oops', type: 'guide', name: 'x', keys: [] }],
    });
    const ls = memoryStorage({ 'ohuhu-hb320-picker-v3': raw });
    const set = ls.setItem;
    let full = false;
    ls.setItem = (k, v) => {
      if (full) throw new Error('QuotaExceededError');
      const r = set(k, v);
      if (k === 'ms-state-backup') full = true;
      return r;
    };
    createApp({ localStorage: ls });
    assert.equal(ls.getItem('ms-state-backup'), raw, 'the copy');
    assert.ok(ls.getItem('ms-load-note'), 'and the note');
  });
  test('two caps in view and one of their names: both codes, no question (the name is the other cap’s)', () => {
    const r = app.scanRead('YG06 YG07 Sugarcane', 'Ohuhu');
    assert.deepEqual(
      [...r.codes].map((c) => [...c.opts].map(nm)),
      [['Ohuhu YG06'], ['Ohuhu YG07']],
    );
    assert.deepEqual(
      [...r.codes].map((c) => c.asked),
      ['', ''],
    );
    // a single misread code with another marker's name is still asked about
    const q = app.scanRead('YG07 Sugarcane', 'Ohuhu');
    assert.equal(q.codes[0].asked, 'name');
  });
  test('a pasted list: one entry per marker (the same code of two brands is two), and a line with only a name, another brand’s code or a code upside down becomes a question', () => {
    const r = app.scanRead('B04 Copic\nB04 Ohuhu\nB04 Copic', '');
    assert.deepEqual(
      [...r.codes].map((c) => [...c.opts].map(nm)),
      [['Copic B04'], ['Ohuhu B04']],
    );
    const s = app.scanRead('YG06\nHoneydew Melon\nYG11', 'Ohuhu');
    assert.deepEqual(
      [...s.codes].map((c) => [...c.opts].map(nm)),
      [['Ohuhu YG06']],
    );
    assert.deepEqual([...s.names].map(nm), ['Ohuhu YG07']);
    assert.deepEqual([...s.other].map(nm), ['Copic YG11']);
    assert.equal(s.many, true);
    // "6L3" is E19 upside down
    const t = app.scanRead('YG06\n6L3', 'Ohuhu');
    assert.ok(t.flips.length === 1 && [...t.flips[0].opts].includes(idx('Ohuhu', 'E19')));
  });
}

// ---- from v299.test.mjs ----
// v299 fixes outside the browser: re-rolling a colour of a hand-adjusted palette stays on its scheme; four blues aren't
// Complementary; a selection leaves out dry markers and the Colorless Blender; a draw from an edited backup opens; and
// what Scan reads: no codes glued together, the brand on the cap, a number-only code beside words on every cap.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
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
  const S320 = 'Honolulu 320 (complete set)';
  function appWith(set) {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval('state.owned = new Set(); state.pool = null');
    if (set)
      a.__eval(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
      );
    return a;
  }
  const C = app.__eval('COLORS');
  const nm = (i) => C[i].brand + ' ' + C[i].code;
  const read = (t, b = '') => {
    const r = app.scanRead(t, b);
    return {
      codes: [...r.codes].map((c) => [[...c.opts].map(nm).join('/'), c.asked]),
      other: [...r.other].map(nm),
      flips: r.flips.length,
    };
  };
  test('re-rolling one colour of a palette that is on its scheme but not tightly (hand-adjusted) keeps it on the scheme', () => {
    const E = appWith(S320).__eval;
    // Triadic palettes of three clear colours, on the scheme but put together at random (not as the generator would):
    // re-rolling the third colour of many of them left the scheme on v298
    const clear = E('LCH.map((l, i) => i).filter((i) => inPool(i) && LCH[i][1] >= 30)');
    let off = 0,
      n = 0,
      pals = 0;
    withSeed(5, () => {
      for (let t = 0; t < 1500; t++) {
        const pal = [0, 1, 2].map(() => clear[(Math.random() * clear.length) | 0]);
        if (new Set(pal).size < 3 || !E('palOnScheme')(pal, 'triadic', new Set())) continue;
        pals++;
        for (let r = 0; r < 8; r++) {
          const next = pal.slice();
          next[2] = E('rerollPick')(pal, 2, 'triadic');
          n++;
          if (!E('palOnScheme')(next, 'triadic', new Set())) off++;
        }
      }
    });
    assert.ok(pals > 20, pals + ' palettes');
    assert.equal(off, 0, off + ' of ' + n + ' left the scheme');
  });
  test('four colours round one hue aren’t a Complementary, Triadic or Tetradic palette; generated ones still pass', () => {
    const E = appWith(S320).__eval;
    const blues = E(
      `(() => { const out = []; LCH.forEach((l, i) => { if (inPool(i) && l[1] >= 25 && l[2] > 225 && l[2] < 275 && out.every((j) => de2000(LAB[i], LAB[j]) > 6)) out.push(i); }); return out.slice(0, 4); })()`,
    );
    assert.equal(blues.length, 4);
    for (const h of ['complementary', 'triadic', 'tetradic', 'split'])
      assert.equal(E('palOnScheme')([...blues], h, new Set()), false, h);
    assert.equal(E('palOnScheme')([...blues], 'analogous', new Set()), true, 'Analogous, yes');
    withSeed(4, () => {
      for (const h of ['complementary', 'triadic', 'tetradic', 'split'])
        for (const n of [2, 3, 4, 6, 8])
          for (let r = 0; r < 8; r++) {
            const p = E(`genPalette(${n}, '${h}', {})`);
            if (p) assert.equal(E('palOnScheme')([...p], h, new Set()), true, h + ' ' + n);
          }
    });
  });
  test('a selection ("Palette from these") leaves out markers marked dry and the Colorless Blender', () => {
    const a = appWith(S320),
      E = a.__eval;
    const owned = E('COLORS.map((c, i) => i).filter((i) => isOwned(i)).slice(0, 24)');
    const dry = owned[3];
    E(`state.ink[mkey(${dry})] = 'dry'`);
    const blender = E(`COLORS.findIndex((c) => /Colorless Blender/.test(c.name))`);
    E(`setPool([${[...owned, blender].join(',')}])`);
    assert.equal(E(`state.pool.includes(${blender})`), false, 'the blender isn’t taken into the selection');
    assert.equal(E(`isDry(${dry})`), true);
    assert.equal(E(`inPool(${dry})`), false, 'the dry one isn’t in play');
    assert.equal(E(`inPool(${owned[0]})`), true);
  });
  test('a saved draw from an edited backup opens, keeping only what the app knows', () => {
    const E = appWith(S320).__eval;
    E('fullRender = function () {}');
    E(
      `loadDraw({ id: 9, type: 'draw', keys: ['Ohuhu|R14', 7], st: { pool: 'abc', brands: ['X'], tones: 5, sats: ['vivid', 'odd'] } })`,
    );
    assert.ok(E('state.brands.size') > 0, 'not every brand filtered out');
    assert.equal(E(`state.brands.has('X')`), false);
    assert.deepEqual([...E('[...state.sats]')], ['vivid']);
    assert.equal(E('state.pool'), null);
  });
  test('Scan: a stray digit beside a code isn’t glued onto it; a code in two pieces still is', () => {
    for (const [t, b] of [
      ['E00 0', 'Copic'],
      ['B00 0', 'Copic'],
      ['BG21 1', 'Ohuhu'],
      ['E17 0', ''],
    ]) {
      const r = read(t, b);
      assert.ok(!r.codes.some(([o]) => /E000|B000|BG211|E58/.test(o)), t + ': ' + JSON.stringify(r));
    }
    // the bare digit beside a code is asked about, not added
    assert.deepEqual(read('E00 0', 'Copic').codes, [
      ['Copic E00', ''],
      ['Copic 0', 'num'],
    ]);
    assert.deepEqual(read('C - 0').codes, [['Copic C-0', '']]);
    assert.deepEqual(read('YG 06', 'Ohuhu').codes, [['Ohuhu YG06', '']]);
    // a count column in a pasted list
    assert.deepEqual(read('BG21\t1\nYR11 (1)', 'Ohuhu').codes, [
      ['Ohuhu BG21', ''],
      ['Ohuhu YR11', ''],
    ]);
  });
  test('Scan: the brand on the cap is heeded; words on every cap don’t hide a number-only code, nor make it a turned one', () => {
    assert.deepEqual(read('Ohuhu B04', 'Copic'), { codes: [], other: ['Ohuhu B04'], flips: 0 });
    assert.deepEqual(read('Honolulu B05', 'Copic').other, ['Ohuhu B05']);
    for (const t of ['Copic 0', 'Copic Sketch 100', 'Ohuhu 120', '120 Brush', 'No. 120']) {
      const r = read(t);
      assert.equal(r.codes.length, 1, t);
      assert.equal(r.flips, 0, t);
    }
    // a code the brand on the cap hasn't: asked (v303: Ohuhu has a 0 too, its colourless blender: that one)
    assert.deepEqual(read('Ohuhu Alcohol Marker 0').codes, [['Ohuhu 0', '']]);
    assert.deepEqual(read('Ohuhu Alcohol Marker 100').codes, [['Copic 100', 'hint']]);
    // a name's own number isn't a code ("Cool Gray No.0")
    const c0 = C.find((c) => c.code === 'C-0');
    assert.deepEqual(read('C-0 ' + c0.name).codes, [['Copic C-0', '']]);
    // another brand's cap read along with one of the brand chosen: kept, to ask about
    const r = read('E19 C-3', 'Ohuhu');
    assert.deepEqual(r.codes, [['Ohuhu E19', '']]);
    assert.deepEqual(r.other, ['Copic C-3']);
  });
}

// ---- from v304-colour.test.mjs ----
// v304 (colour and palettes): the guide's Generate palette uses your markers, never a Finder selection left on the
// Palette screen; Palette › Photo's band taps go round the five nearest markers and back (they flipped between two);
// Tap the white paper never darkens a scan and takes a cream paper's cast away; greys that have to fill in a palette
// are kept apart; re-rolling a near-grey of an Analogous palette aims at the palette's middle; re-rolling on a small
// collection says nothing fits rather than leaving the scheme; a filter or base changed while a palette rolls is
// used once the roll ends; the palette screen's "can't" toasts say "clear the selection" when there are no filters
// to loosen.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
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
    if (set)
      a.__eval(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
      );
    return a;
  }
  const S320 = 'Honolulu 320 (complete set)';
  const hd = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  };
  test('v304: the guide’s Generate palette uses your markers, not a Finder selection left on the Palette screen, and leaves the selection as it was', () => {
    const a = createApp({ localStorage: memoryStorage() }),
      E = (s) => a.__eval(s);
    // boot.js runs in a script of its own, which the harness doesn't load: its genPalette for the guide, as shipped
    const boot = fs.readFileSync(new URL('../src/js/boot.js', import.meta.url), 'utf8');
    const src = /genPalette: (function \(n, harm, opts\) \{[\s\S]*?\n  \}),\n  isDemo/.exec(boot)[1];
    const gen = E('(' + src + ')');
    // you own every Ohuhu; the Palette screen still works from 12 Copic blues picked in Find (none of them yours)
    E(
      `state.owned = new Set(); COLORS.forEach((c, i) => { if (c.brand === 'Ohuhu') state.owned.add(mkey(i)); })`,
    );
    E(
      `setPool(COLORS.map((c, i) => i).filter((i) => COLORS[i].brand === 'Copic' && COLORS[i].fam === 'Blue').slice(0, 12))`,
    );
    const owned = E('state.owned'),
      fams = new Set();
    withSeed(5, () => {
      for (const h of ['complementary', 'triadic', 'analogous', 'mono']) {
        const keys = [...gen(6, h, { mood: 'neutral' })];
        assert.equal(keys.length, 6, h);
        for (const k of keys) {
          assert.ok(owned.has(k), `${h}: ${k} is one of yours`);
          fams.add(E(`COLORS[keyIdx(${JSON.stringify(k)})].fam`));
        }
      }
    });
    assert.ok(fams.size > 3, 'colours from round the wheel, not only the selection’s blues: ' + [...fams]);
    assert.equal(E('state.pool && state.pool.length'), 12, 'the selection is kept for the Palette screen');
    assert.equal(E('inPool(state.pool[0])'), true, 'and still in play there');
  });
  test('v304: Palette › Photo — tapping a band goes on to the next nearest marker each time and, after five, back to the first', () => {
    const a = appWith(S320),
      E = (s) => a.__eval(s);
    E('showPalette = function () {}; save = function () {}');
    E(`state.harmony = 'photo'; state.mode = 'palette';
    (function () {
      const ids = [...state.owned].map(keyIdx).filter((i) => i != null && inPool(i)),
        pick = [ids[5], ids[60], ids[120], ids[180], ids[240], ids[300]];
      _photoLabs = pick.map((i) => [LAB[i][0] + 1.5, LAB[i][1] + 1, LAB[i][2] - 1]);
      _photoTried = {};
      state.palettes = [pick.slice()];
      state.palH = ['photo'];
    })()`);
    const first = E('state.palettes[0][2]'),
      seen = [first];
    for (let t = 0; t < 6; t++) {
      E('swapPhotoBand(2)');
      seen.push(E('state.palettes[state.palettes.length - 1][2]'));
    }
    assert.equal(
      new Set(seen.slice(0, 6)).size,
      6,
      'six different markers in the first five taps (it flipped between two): ' + seen,
    );
    assert.equal(seen[6], first, 'the sixth tap is back at the first');
    const others = E('state.palettes[0]').filter((_, p) => p !== 2);
    for (const m of seen) assert.ok(!others.includes(m), 'never one of the other colours');
  });
  test('v304: Tap the white paper never darkens a scan; a cream paper loses its cast; a phone photo’s paper is corrected as before', () => {
    const a = createApp({ localStorage: memoryStorage() }),
      E = (s) => a.__eval(s);
    const spot = E('paperSpot'),
      lin = (rgb) => rgb.map((v) => E(`srgbToLin(${v})`)),
      apply = E('lightApply'),
      lab = E('rgbLab8');
    // a white scan: nothing to correct (it was darkened to L* 94)
    for (const w of [
      [255, 255, 255],
      [250, 250, 250],
    ]) {
      const r = spot(lin(w));
      assert.equal(r.fix, null, String(w));
      assert.equal(r.note, 'That already looks white: nothing to correct.');
    }
    // cream scans: grey after, and not darker than before by more than the top end's easing
    for (const c of [
      [255, 255, 236],
      [255, 248, 225],
      [255, 250, 200],
    ]) {
      const r = spot(lin(c));
      assert.ok(r.fix && !r.bad, String(c));
      assert.ok(Math.min(...r.fix.gain) >= 1 - 1e-9, 'no channel turned down: ' + [...r.fix.gain]);
      const out = lab(...apply(r.fix, ...c));
      assert.ok(Math.hypot(out[1], out[2]) < 1, 'the cast gone: ' + out);
      assert.ok(out[0] > 96.5, 'still about white (it went to L* 94.4): ' + out[0]);
    }
    // a phone photo's grey, warm paper: the correction to paper white, as lightFix gives it
    const g = lin([186, 176, 160]),
      r = spot(g),
      f = E('lightFix')(g);
    assert.deepEqual([...r.fix.gain], [...f.gain]);
  });
  test('v304: greys that have to fill a palette (a collection of greys) are kept apart', () => {
    const a = appWith('36 Gray Tones'),
      E = (s) => a.__eval(s);
    withSeed(11, () => {
      for (const h of ['complementary', 'analogous', 'mono']) {
        let sum = 0;
        for (let r = 0; r < 10; r++) {
          const rep = {};
          assert.ok(a.__eval('genPalette')(8, h, { report: rep }), h);
          sum += rep.minDE;
        }
        // (v303: 4.6, 2.7 and 2.1 on average, two greys hardly different)
        assert.ok(sum / 10 >= 6, `${h}: the closest two colours ${(sum / 10).toFixed(1)} apart on average`);
      }
    });
    void E;
  });
  test('v304: re-rolling a near-grey of an Analogous palette aims at the other colours’ middle, not the grey’s own tint', () => {
    const a = appWith(S320),
      E = (s) => a.__eval(s);
    const set = JSON.parse(
      JSON.stringify(
        E(`(function () {
    const pool = COLORS.map((c, i) => i).filter((i) => inPool(i));
    const blues = pool.filter((i) => LCH[i][1] > 30 && LCH[i][2] > 215 && LCH[i][2] < 275).slice(0, 5);
    const g = pool.find((i) => LCH[i][1] < GREY_C && LCH[i][1] > 8 && hueDist(LCH[i][2], 250) > 40 && hueDist(LCH[i][2], 250) < 60);
    return [blues, g];
  })()`),
      ),
    );
    const [blues, grey] = set;
    assert.equal(blues.length, 5);
    assert.ok(grey != null, 'a near-grey with a tint 40-60° from the blues');
    let x = 0,
      y = 0;
    for (const i of blues) {
      const h = (E(`LCH[${i}][2]`) * Math.PI) / 180;
      x += Math.cos(h);
      y += Math.sin(h);
    }
    const mid = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
      gh = E(`LCH[${grey}][2]`);
    withSeed(3, () => {
      for (let t = 0; t < 10; t++) {
        const q = E('rerollPick')([...blues, grey], 5, 'analogous');
        assert.ok(q >= 0);
        const h = E(`LCH[${q}][2]`);
        assert.ok(
          hd(h, mid) < hd(h, gh),
          `${E(`COLORS[${q}].code`)} at ${h.toFixed(0)}° nearer the blues’ middle (${mid.toFixed(0)}°) than the grey’s tint (${gh.toFixed(0)}°)`,
        );
      }
    });
  });
  test('v304: re-rolling on a small collection keeps a palette on its scheme, or finds nothing (it took a green into a yellow Monochrome)', () => {
    const a = appWith('Sketch 24 - Manga'),
      E = (s) => a.__eval(s),
      on = E('palOnScheme');
    let none = 0,
      tried = 0;
    withSeed(3, () => {
      for (const h of ['mono', 'complementary', 'analogous']) {
        for (let r = 0; r < 6; r++) {
          const p = [...E(`genPalette(6, '${h}', {})`)];
          if (!on(p, h, null)) continue;
          for (let k = 0; k < p.length; k++) {
            const q = E('rerollPick')(p, k, h);
            tried++;
            if (q < 0) {
              none++;
              continue;
            }
            const np = p.slice();
            np[k] = q;
            assert.ok(
              on(np, h, null),
              `${h}: band ${k} → ${E(`COLORS[${q}].code`)} keeps the palette on its scheme`,
            );
          }
        }
      }
    });
    assert.ok(tried > 30 && none > 0, `some taps find nothing that fits (${none} of ${tried})`);
    // a full collection always finds one
    const b = appWith(S320);
    withSeed(4, () => {
      for (const h of ['mono', 'complementary', 'analogous', 'triadic']) {
        const p = [...b.__eval(`genPalette(6, '${h}', {})`)];
        for (let k = 0; k < p.length; k++) assert.ok(b.__eval('rerollPick')(p, k, h) >= 0, h + ' band ' + k);
      }
    });
  });
  test('v304: a filter or base changed while a palette is rolling is used once the roll ends (the roll’s palette landed on top of it)', () => {
    const a = appWith(S320),
      E = (s) => a.__eval(s);
    E(`showPalette = function () {}; save = function () {}; chrome = function () {};
    state.mode = 'palette'; state.harmony = 'triadic'; state.palSize = 6; state.locked = [];
    state.palettes = [genPalette(6, 'triadic', {})]; state.palH = ['triadic']`);
    const before = JSON.stringify(E('state.palettes'));
    E('rolling = true; regenReplace()');
    assert.equal(JSON.stringify(E('state.palettes')), before, 'nothing made while it rolls');
    E('rolling = false; regenFlush()');
    const after = E('state.palettes');
    // (v308: a new step, so Undo goes back to the palette that was there)
    assert.equal(after.length, 2, 'made once, as a step of its own');
    assert.notEqual(JSON.stringify(after), before, 'made once the roll ended');
    E('regenFlush()');
    assert.equal(JSON.stringify(E('state.palettes')), JSON.stringify(after), 'and only once');
  });
  test('v304: the palette screen’s “can’t” toasts say what to do: loosen the filters, or with a Finder selection (no filters shown) clear it', () => {
    const a = appWith('Sketch 12'),
      E = (s) => a.__eval(s);
    E('state.owned = new Set([...state.owned].slice(0, 8))');
    E(`showPalette = function () {}; save = function () {}; chrome = function () {}; window.__toasts = [];
    toast = function (m) { window.__toasts.push(m); };
    state.mode = 'palette'; state.harmony = 'tetradic'; state.palSize = 12; state.locked = []; state.palettes = []; state.palH = []`);
    const last = () => E('window.__toasts[window.__toasts.length - 1]');
    // a size or filter change the markers can't fill is said (it wasn't), as Generate says it
    E('regenReplace()');
    assert.match(
      last(),
      // (v318.22: no filter on here, so not "loosen the filters")
      /^Couldn’t make a 12-colour palette from the markers in play — try fewer colours, or add markers with more colours\.$/,
    );
    // (with a filter on, it says so)
    E('fgTap("tone", "pale"); palFailToast()');
    assert.match(last(), /try fewer colours or loosen the filters\.$/);
    E('fgClear("tone")');
    E(`setPool([...state.owned].map(keyIdx).slice(0, 6))`);
    E('regenReplace()');
    assert.match(last(), /or clear the selection\.$/);
    // (v308: Generate first brings the size down to what the markers in play can fill, palCap; three can't fill
    // Tetradic's smallest, 4; v318.25: so no "try fewer colours" there)
    E(`setPool([...state.owned].map(keyIdx).slice(0, 3))`);
    E('doGenerate()');
    assert.match(last(), /in play — clear the selection\.$/);
    // a band with no other marker that fits
    E(
      `rerollPick = function () { return -1; }; state.palettes = [state.pool.slice(0, 4)]; state.palH = ['tetradic']`,
    );
    E('doReRollBand(0)');
    assert.equal(
      last(),
      'No other marker in the selection fits this scheme — clear the selection to use all your markers.',
    );
    E('setPool(null); doReRollBand(0)');
    assert.equal(last(), 'No other marker fits this scheme — add markers or loosen the filters.');
  });
}

// ---- from v308-merge.test.mjs ----
// v308 after the merge (reviewer 1): where the colour and palette branches meet.
{
  function appWith(set) {
    const a = createApp({ localStorage: memoryStorage() }),
      E = a.__eval;
    E('state.owned = new Set(); state.pool = null');
    if (set === 'ben') E('state.owned = new Set(defaultOwned())');
    else
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
      );
    return { a, E };
  }
  const codes = (E, s) => JSON.parse(E(`JSON.stringify((${s} || []).map((i) => COLORS[i].code))`));
  test('Palette’s Rainbow from a small collection: past the vivid ones it takes the other clear colours before a brown, so it keeps its yellow and starts at red', () => {
    for (const set of ['Sketch 12', 'Ciao 12']) {
      const { E } = appWith(set);
      for (let n = 6; n <= 10; n++) {
        const p = JSON.parse(E(`JSON.stringify(genPalette(${n}, 'rainbow', {}))`));
        const lch = JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.map((i) => LCH[i]))`)),
          c = codes(E, JSON.stringify(p));
        assert.ok(lch[0][2] < 50 || lch[0][2] > 345, set + ' ' + n + ': starts at red, not ' + c[0]);
        assert.ok(
          lch.some((x) => x[2] >= 80 && x[2] <= 105 && x[0] >= 80),
          set + ' ' + n + ': a yellow in ' + c.join(' '),
        );
        // (a brown only once the other clear colours are used up: Sketch 12 has 10 that aren't browns)
        if (n <= 10) assert.ok(!c.some((k) => /^E/.test(k)), set + ' ' + n + ': no brown in ' + c.join(' '));
      }
    }
  });
}

// ---- from v308-palette.test.mjs ----
// v308 Palette (beta review, area 3): size, scheme and filter changes keep the palette you made (Undo brings it back);
// Undo into a photo's palette goes back to Photo; the first visit's preview follows your markers; saved palettes keep
// their scheme and open as it, asking before they replace Custom picks; no marker in play gives an empty card; sizes
// stop at what the markers in play can fill; Brands I'd buy stands in for an empty collection; a Library tile shows 16
// colours; Rainbow runs from red; Use in a guide doesn't save the palette; From photo keeps hues apart, keeps a big
// dark, stops instead of making colours up and puts its bands in order; "Photo looks dim" is offered on dim photos,
// not on a starry sky.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const KEY = 'ohuhu-hb320-picker-v3';
  function appWith(set, storage) {
    const a = createApp({ localStorage: storage || memoryStorage() });
    a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}');
    if (set === 'ben') a.__eval('state.owned = new Set(defaultOwned())');
    else if (set)
      a.__eval(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
      );
    // no screen to draw on
    a.__eval(
      `showPalette = function () {}; chrome = function () {}; fullRender = function () {}; clearPalette = function () {};
     showCustom = function () {}; closeDialog = function () {}; renderRecent = function () {}; flashSaved = function () {};
     window.__toasts = []; toast = function (m) { window.__toasts.push(m); }`,
    );
    return a;
  }
  const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
  function palState(E, h, n) {
    E(
      `state.mode = 'palette'; state.harmony = '${h}'; state.palSize = ${n}; state.palettes = []; state.palH = [];
     state.locked = []; state.seed = null; state.excluded = new Set(); state.pool = null; setPool(null)`,
    );
  }
  // ---- 4. From photo ----

  // an image for the harness's canvas: RGBA pixels it reads back exactly (no more than 9000 pixels: not scaled)
  function img(a, w, h, fill) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...fill(x, y), 255], (y * w + x) * 4);
    const im = new (a.__eval('Image'))();
    im.src = 'data:image/x-mslabels;' + w + ',' + h + ',' + Buffer.from(d.buffer).toString('base64');
    return { im, d, w, h };
  }
  const mixC = (p, q, t) => p.map((v, k) => Math.round(v + (q[k] - v) * t));
  // a sunset: a sky from violet through magenta and red to orange, a pale gold sun, and dark violet hills over the
  // lower quarter and more
  function sunset(a) {
    const W = 120,
      H = 75,
      sky = [
        [74, 44, 120],
        [160, 50, 110],
        [220, 60, 60],
        [245, 140, 60],
      ];
    return img(a, W, H, (x, y) => {
      const hill = H * 0.68 - 6 * Math.sin(x / 9);
      if (y > hill) return [38, 22, 48];
      if (Math.hypot(x - W * 0.55, y - H * 0.6) < 7) return [255, 226, 140];
      const t = (y / hill) * 3,
        k = Math.min(2, Math.floor(t));
      return mixC(sky[k], sky[k + 1], t - k);
    });
  }
  const lchOf = (a, pal) => J(a, `${JSON.stringify(pal)}.map((i) => LCH[i].slice())`);
  const hueGap = (h1, h2) => Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
  // ---- 14. Photo looks dim ----

  function photoOffer(a, p) {
    return JSON.parse(
      a.__eval(`(function () { const d = new Uint8ClampedArray(${JSON.stringify([...p.d])}), q = photoWarm(d, ${p.w});
      return JSON.stringify(q && { warm: q.warm, L: q.lab[0] }); })()`),
    );
  }
  // ---- 1. Size, scheme and filter changes push; only a palette made that way is replaced ----

  test('trying other sizes keeps the palette you made: 6, then 3, then Undo gives it back', () => {
    const a = appWith('ben'),
      E = a.__eval;
    palState(E, 'triadic', 4);
    E(`palPush(genPalette(4, 'triadic', {}), 24)`);
    E(`palPush(genPalette(4, 'triadic', {}), 24)`);
    const B = J(a, 'state.palettes[1]');
    E('setSize(6)');
    E('setSize(3)');
    assert.equal(E('state.palettes.length'), 3, 'the 6 was replaced by the 3; B kept');
    assert.deepEqual(J(a, 'state.palH'), ['triadic', 'triadic', 'triadic+']);
    E('undo()');
    assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), B, 'B is back');
    assert.equal(E('state.palSize'), 4);
    // a scheme change and a filter change are steps too, the second replacing the first
    E(`setHarmony('tetradic')`);
    E(`state.excluded = new Set(['Fluorescent']); filterChanged()`);
    assert.equal(E('state.palettes.length'), 3);
    E('undo()');
    assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), B);
    assert.equal(E('state.harmony'), 'triadic');
    // Generate's palette is yours: the next size change doesn't replace it
    // (as Generate's roll ends: its own step)
    E(`palPush(genPalette(5, 'triadic', paletteOpts()), 24)`);
    const G = J(a, 'state.palettes[state.palettes.length - 1]');
    E('setSize(5)');
    E('undo()');
    assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), G);
  });
  test('the made-by-itself mark is kept in saved data (an older app reads it as unknown)', () => {
    const ls = memoryStorage();
    const a = appWith('ben', ls),
      E = a.__eval;
    palState(E, 'split', 4);
    E(`palPush(genPalette(4, 'split', {}), 24); setSize(5)`);
    assert.deepEqual(J(a, 'state.palH'), ['split', 'split+']);
    E('save(true)');
    const b = createApp({ localStorage: memoryStorage({ [KEY]: ls.getItem(KEY) }) });
    assert.deepEqual(JSON.parse(b.__eval('JSON.stringify(state.palH)')), ['split', 'split+']);
    assert.equal(b.__eval(`palHarm('split+')`), 'split');
    assert.equal(b.__eval(`palAuto('split+')`), true);
    assert.equal(b.__eval(`palAuto('split')`), false);
  });
  // ---- 5. Undo into a photo's palette ----

  test('Undo into a photo’s palette goes back to From photo (or past it, once its photo has gone)', () => {
    const a = appWith('ben'),
      E = a.__eval;
    palState(E, 'photo', 8);
    E(`_photoImg = { width: 10, height: 10 }`);
    E(`palPush(genPalette(8, 'complementary', {}), 20)`);
    E(`setHarmony('complementary')`);
    assert.equal(E('state.palettes.length'), 2);
    E('undo()');
    assert.equal(E('state.harmony'), 'photo', 'shown as From photo, not as Complementary');
    assert.equal(E('state.palSize'), 8);
    // a scheme's palette under Photo goes back to its scheme
    palState(E, 'triadic', 6);
    E(
      `palPush(genPalette(6, 'triadic', {}), 24); state.harmony = 'photo'; palPush(genPalette(8, 'complementary', {}), 20)`,
    );
    E('undo()');
    assert.equal(E('state.harmony'), 'triadic');
    // the photo gone (the page opened again): its palettes are skipped
    palState(E, 'mono', 4);
    E(`palPush(genPalette(4, 'mono', {}), 24); state.harmony = 'photo'; palPush(genPalette(6, 'complementary', {}), 20);
     palPush(genPalette(6, 'complementary', {}), 20); state.harmony = 'complementary'; palPush(genPalette(4, 'complementary', {}), 24);
     _photoImg = null`);
    E('undo()');
    assert.equal(E('state.palettes.length'), 1);
    assert.equal(E('state.harmony'), 'mono');
  });
  // ---- 2. The first visit's preview ----

  test('the first visit’s preview is made again when your markers change (it kept markers you don’t own)', () => {
    const a = appWith(null),
      E = a.__eval;
    palState(E, 'triadic', 6);
    E('palPvOff = false; palPv = null');
    const p1 = J(a, 'palPreview()');
    assert.equal(p1.length, 6);
    E(`presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')).forEach((k) => state.owned.add(k))`);
    const p2 = J(a, 'palPreview()');
    assert.ok(
      J(a, `${JSON.stringify(p2)}.every((i) => isOwned(i))`),
      'all owned: ' + J(a, `${JSON.stringify(p2)}.map((i) => COLORS[i].code)`),
    );
    // a filter, and a selection, too
    E(
      `state.excluded = new Set(families.map((f) => f.name).filter((n) => n !== 'Blue' && n !== 'Red' && n !== 'Yellow'))`,
    );
    const p3 = J(a, 'palPreview()');
    assert.ok(J(a, `${JSON.stringify(p3)}.every((i) => inPool(i))`));
    // the same markers in play: the same preview
    assert.deepEqual(J(a, 'palPreview()'), p3);
  });
  // ---- 6. Saved palettes keep their scheme ----

  test('a saved palette keeps its scheme and opens as it, as a new step; Custom’s and older ones open as Custom', () => {
    const a = appWith('ben'),
      E = a.__eval;
    E('disarm = function () {}; unownDisarm = function () {}');
    palState(E, 'tetradic', 8);
    E(`palPush(genPalette(8, 'tetradic', {}), 24)`);
    E('doSave()');
    const ent = J(a, 'state.saved[0]');
    assert.equal(ent.h, 'tetradic');
    assert.equal(ent.type, 'palette');
    palState(E, 'mono', 4);
    E(`palPush(genPalette(4, 'mono', {}), 24)`);
    E('loadSaved(state.saved[0])');
    assert.equal(E('state.harmony'), 'tetradic');
    assert.equal(E('state.palSize'), 8);
    assert.equal(E('state.palettes.length'), 2);
    assert.deepEqual(J(a, 'state.palettes[1].map(mkey)'), ent.keys);
    E('undo()');
    assert.equal(E('state.harmony'), 'mono', 'Undo goes back to the palette before');
    // one saved before v308 (no scheme): Custom picks, as before
    E(
      `state.saved.push({ id: 5, type: 'palette', name: 'Old', keys: ${JSON.stringify(ent.keys.slice(0, 5))} })`,
    );
    E(`state.customPal = []; loadSaved(state.saved[state.saved.length - 1])`);
    assert.equal(E('state.harmony'), 'custom');
    assert.equal(E('state.customPal.length'), 5);
    // a scheme name the app doesn't know is dropped when read
    assert.equal(E(`'h' in cleanSaved({ id: 3, type: 'palette', keys: [], h: 'loud' })`), false);
    assert.equal(E(`cleanSaved({ id: 3, type: 'palette', keys: [], h: 'rainbow' }).h`), 'rainbow');
  });
  test('opening a saved palette asks before it replaces Custom picks in progress', () => {
    const a = appWith('ben'),
      E = a.__eval;
    E(`disarm = function () {}; unownDisarm = function () {};
     window.__asks = []; SF = { askBox: function (t, x) { window.__asks.push([t, x]); return { then: function (f) { window.__ans = f; } }; } }`);
    E(`state.mode = 'palette'; state.harmony = 'custom'; state.palSize = 4;
     state.customPal = COLORS.map((c, i) => i).filter((i) => isOwned(i)).slice(0, 3).concat([null])`);
    const picks = J(a, 'state.customPal');
    E(
      `state.saved = [{ id: 9, type: 'palette', name: 'Sea', keys: COLORS.map((c, i) => i).filter((i) => isOwned(i)).slice(40, 46).map(mkey), h: 'custom' }]`,
    );
    E('loadSaved(state.saved[0])');
    assert.equal(E('window.__asks.length'), 1);
    assert.equal(E('window.__asks[0][0]'), 'Replace your Custom picks?');
    assert.match(E('window.__asks[0][1]'), /“Sea” replaces the 3 markers you’ve picked in Custom/);
    assert.deepEqual(J(a, 'state.customPal'), picks, 'nothing replaced yet');
    E(`window.__ans('stay')`);
    assert.deepEqual(J(a, 'state.customPal'), picks, 'Cancel keeps them');
    E(`loadSaved(state.saved[0]); window.__ans('go')`);
    assert.equal(E('state.customPal.length'), 6);
    // no picks, or picks that are this palette: opened without asking
    E(`window.__asks = []; loadSaved(state.saved[0])`);
    assert.equal(E('window.__asks.length'), 0);
  });
  // ---- 7. Filters that leave nothing ----

  test('filters that leave no marker in play: an empty card, nothing to save or use, no “try fewer colours” toast', () => {
    const a = appWith('ben'),
      E = a.__eval;
    palState(E, 'complementary', 4);
    E(`palPush(genPalette(4, 'complementary', {}), 24)`);
    assert.equal(E('palNone()'), false);
    assert.equal(E('currentPaletteIdxs().length'), 4);
    E(
      `state.harmony = 'rainbow'; state.palSize = 8; state.excluded = new Set(families.map((f) => f.name)); filterChanged()`,
    );
    assert.equal(E('palNone()'), true);
    assert.equal(E('currentPaletteIdxs().length'), 0, 'Save, Save image and Use in a guide have nothing');
    assert.equal(E('window.__toasts.length'), 0);
    // a selection with nothing left in it
    E(
      `state.excluded = new Set(); setPool([COLORS.findIndex((c, i) => NOINK.has(i))].filter((i) => i >= 0))`,
    );
    assert.equal(E('palNone()'), false, 'an empty selection is no selection');
    // Custom isn't filtered
    E(`state.excluded = new Set(families.map((f) => f.name)); state.harmony = 'custom'`);
    assert.equal(E('palNone()'), false);
  });
  // ---- 9. Sizes for small collections ----

  test('sizes stop at what the markers in play can fill (Honolulu 24’s Monochrome at 10 had spanned three hues)', () => {
    const a = appWith('Honolulu 24'),
      E = a.__eval;
    const cap = E(`palCap('mono')`);
    assert.ok(cap >= 2 && cap <= 6, 'Monochrome ' + cap);
    palState(E, 'mono', 4);
    E('setSize(10)');
    assert.equal(E('state.palSize'), 4, '10 not offered');
    E('state.palSize = 10; palSizeFit()');
    assert.equal(E('state.palSize'), cap);
    // a scheme chosen with a size past its cap comes down to it
    palState(E, 'complementary', 8);
    E(`setHarmony('mono')`);
    assert.equal(E('state.palSize'), cap);
    // Ben's markers, Honolulu 120 and none owned: every size, as before
    for (const set of ['ben', 'Honolulu 120', null]) {
      const b = appWith(set);
      for (const [h, n] of [
        ['complementary', 8],
        ['analogous', 8],
        ['triadic', 10],
        ['split', 10],
        ['tetradic', 12],
        ['mono', 10],
      ])
        assert.equal(b.__eval(`palCap('${h}')`), n, `${set} ${h}`);
    }
    // never under a scheme's smallest size
    const c = appWith('36 Gray Tones');
    assert.equal(c.__eval(`palCap('tetradic')`), 4);
  });
  // ---- 10. Brands I'd buy with nothing owned ----

  test('with no markers added, Brands I’d buy “Only Copic” keeps palettes to Copic', () => {
    const a = appWith(null),
      E = a.__eval;
    E(`state.buyBrands = ['Copic']`);
    for (const h of ['complementary', 'rainbow', 'mono']) {
      const p = J(a, `genPalette(6, '${h}', {})`);
      assert.ok(p && p.length >= 6, h);
      assert.deepEqual([...new Set(J(a, `${JSON.stringify(p)}.map((i) => COLORS[i].brand)`))], ['Copic'], h);
    }
    // once markers are owned, they decide
    E(`presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')).forEach((k) => state.owned.add(k))`);
    assert.deepEqual(
      [...new Set(J(a, `genPalette(6, 'complementary', {}).map((i) => COLORS[i].brand)`))],
      ['Ohuhu'],
    );
  });
  // ---- 11. Library tiles ----

  test('a palette’s Library tile shows all 16 of its colours', () => {
    const a = appWith('ben'),
      E = a.__eval;
    const keys = J(a, `genPalette(16, 'rainbow', {}).map(mkey)`);
    const html = E(
      `libRowHTML({ id: 1, type: 'palette', name: 'R', keys: ${JSON.stringify(keys)}, ts: 1 }, false)`,
    );
    const strip = html.match(/<span class="sstrip">(.*?)<\/span><\/span>/)[1];
    assert.equal((strip.match(/<span style=/g) || []).length, 16);
  });
  // ---- 12. Rainbow from red ----

  test('Rainbow runs from red round the wheel, and colours locked under another scheme take their place in it', () => {
    const a = appWith('ben'),
      E = a.__eval;
    const ordered = (p) => {
      const h = J(a, `${JSON.stringify(p)}.map((i) => LCH[i][2])`);
      let turns = 0;
      for (let k = 1; k < h.length; k++) if (h[k] < h[k - 1]) turns++;
      return turns <= 1;
    };
    const isRed = (i) => {
      const h = E(`LCH[${i}][2]`);
      return h < 50 || h > 345;
    };
    for (const n of [6, 8, 12, 16]) {
      for (const o of ['{}', '{ reroll: true }']) {
        const p = J(a, `genPalette(${n}, 'rainbow', ${o})`);
        assert.ok(isRed(p[0]), n + ': starts at red, not ' + E(`COLORS[${p[0]}].code`));
        assert.ok(ordered(p), n + ': in hue order');
      }
    }
    // two colours locked where a Triadic had them
    const t = J(a, `genPalette(6, 'triadic', {})`);
    const lk = { 0: t[2], 3: t[5] };
    const p = J(a, `genPalette(8, 'rainbow', { reroll: true, locked: ${JSON.stringify(lk)} })`);
    assert.ok(p.includes(t[2]) && p.includes(t[5]), 'kept');
    assert.ok(ordered(p.filter((i) => E(`LCH[${i}][1] >= GREY_C`))), 'in hue order with them');
  });
  // ---- 13. Use in a guide ----

  test('Use in a guide doesn’t add the palette to the Library; one already there is used from there', () => {
    const a = appWith('ben'),
      E = a.__eval;
    E(`setMode = function () {}; window.__got = [];
     SF = { setNextPal: function (x) { window.__got.push(x); }, pickPhoto: function () {},
            recolourWith: function (x) { window.__got.push(x); return true; }, hasGuide: function () { return false; } }`);
    palState(E, 'split', 5);
    E(`palPush(genPalette(5, 'split', {}), 24); state.saved = []`);
    const idxs = J(a, 'state.palettes[0]');
    E(`useInGuideGo(${JSON.stringify(idxs)}, ${JSON.stringify(idxs)}.map(mkey), null, true)`);
    E(`useInGuideGo(${JSON.stringify(idxs)}, ${JSON.stringify(idxs)}.map(mkey), null, false)`);
    assert.equal(E('state.saved.length'), 0, 'nothing saved');
    const got = J(a, 'window.__got');
    assert.equal(got.length, 2);
    for (const g of got) {
      assert.deepEqual(g.keys, J(a, `${JSON.stringify(idxs)}.map(mkey)`));
      assert.equal(g.h, 'split');
      assert.equal(typeof g.name, 'string');
    }
    E(`window.__got = []; useInGuideGo([], [], { id: 77 }, true)`);
    assert.deepEqual(J(a, 'window.__got'), [77]);
  });
  test('From photo: a sunset’s colours keep their hues apart, and its dark hills (a quarter of it) are kept', () => {
    const a = appWith('ben'),
      s = sunset(a);
    const p4 = [...a.extractPhotoPalette(s.im, 4).markers],
      L4 = lchOf(a, p4).filter((l) => l[1] >= 15);
    // no two clear colours of much the same hue and lightness (v307.1: four reds)
    for (let i = 0; i < L4.length; i++)
      for (let j = i + 1; j < L4.length; j++)
        assert.ok(
          hueGap(L4[i][2], L4[j][2]) >= 20 || Math.abs(L4[i][0] - L4[j][0]) >= 20,
          'apart: ' + JSON.stringify([L4[i], L4[j]].map((l) => l.map(Math.round))),
        );
    const p8 = [...a.extractPhotoPalette(s.im, 8).markers];
    assert.ok(
      lchOf(a, p8).some((l) => l[0] < 30),
      'a dark for the hills: ' + J(a, `${JSON.stringify(p8)}.map((i) => COLORS[i].code)`),
    );
  });
  test('From photo: stops when the markers left are far from the photo’s colours, and says so; bands in hue order', () => {
    const a = appWith('Honolulu 24'),
      de = a.de2000,
      LAB = a.__eval('LAB');
    // three flat colours: a red, a green and a blue
    const three = img(a, 60, 30, (x) => (x < 20 ? [200, 40, 50] : x < 40 ? [60, 150, 70] : [40, 80, 180]));
    const r = a.extractPhotoPalette(three.im, 16),
      pal = [...r.markers];
    assert.ok(pal.length >= 3 && pal.length < 16, pal.length + ' markers');
    assert.equal(r.few, true);
    [...r.labs].forEach((l, k) => assert.ok(de(l, LAB[pal[k]]) <= 18, 'each within 18 of its colour'));
    // in hue order round the wheel (one turn at most), the near-greys after
    const L = lchOf(a, pal),
      clear = L.filter((l) => l[1] >= 12),
      h = clear.map((l) => l[2]);
    let turns = 0;
    for (let k = 1; k < h.length; k++) if (h[k] < h[k - 1]) turns++;
    assert.ok(turns <= 1, 'hue order: ' + h.map(Math.round));
    const firstGrey = L.findIndex((l) => l[1] < 12);
    if (firstGrey >= 0)
      assert.ok(
        L.slice(firstGrey).every((l) => l[1] < 12),
        'greys last',
      );
  });
  test('Photo looks dim: offered on a photo taken in the dark, not on a starry sky', () => {
    const a = appWith('ben');
    // deep space: black, with stars and small faint galaxies all over it
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars = new Map();
    for (let k = 0; k < 420; k++) stars.set(Math.floor(rnd() * 160 * 120), 110 + Math.floor(rnd() * 70));
    const space = img(a, 160, 120, (x, y) => {
      const v = stars.get(y * 160 + x);
      return v ? [v, v, v + 6] : [4, 4, 7];
    });
    assert.equal(photoOffer(a, space), null, 'nothing offered for space');
    // a house with white walls, a green field and a dusky sky, photographed in the dark (its walls L* about 28)
    const dk = 0.07;
    const night = img(a, 160, 120, (x, y) => {
      let c = y < 50 ? [150, 170, 210] : [120, 170, 100];
      if (x > 60 && x < 110 && y > 40 && y < 90) c = [245, 245, 240];
      if (x > 75 && x < 95 && y > 60 && y < 90) c = [150, 40, 30];
      return c.map((v) => Math.round(255 * Math.pow(Math.pow(v / 255, 2.2) * dk, 1 / 2.2)));
    });
    const o = photoOffer(a, night);
    assert.ok(o, 'offered');
    assert.equal(o.warm, false, 'dim, not warm');
    assert.ok(o.L >= 15 && o.L < 35, 'its whites dim: ' + o.L);
  });
}

// ---- from v31825-x2.test.mjs ----
// v318.25 (deep debugging pass, step 2).
{
  // ---- X2: Palette (reviewer C's C1–C8) ----

  function palApp(owned) {
    const a = createApp({ localStorage: memoryStorage() }),
      E = a.__eval;
    E('state.owned = new Set(); state.pool = null; state.ink = {}');
    if (Array.isArray(owned)) E(`state.owned = new Set(${JSON.stringify(owned)})`);
    else if (owned)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(owned)})).forEach((k) => state.owned.add(k))`,
      );
    // no screen to draw on; the toasts kept, and the line under the Colours row readable
    E(`showPalette = function () {}; chrome = function () {}; fullRender = function () {}; clearPalette = function () {};
     renderRecent = function () {}; flashSaved = function () {}; window.__toasts = [];
     toast = function (m) { window.__toasts.push(m); };
     var __pc = { textContent: '', style: {} }, __d = document;
     document = new Proxy({}, { get(t, p) {
       if (p === 'getElementById') return (id) => (id === 'palClose' ? __pc : __d.getElementById(id));
       return __d[p];
     } })`);
    return a;
  }
  const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
  const palState = (E, h, n) =>
    E(`state.mode = 'palette'; state.harmony = '${h}'; state.palSize = ${n}; state.palettes = []; state.palH = [];
     state.locked = []; state.seed = null; state.excluded = new Set(); setPool(null)`);
  const FIVE = ['Copic|R27', 'Copic|G07', 'Copic|B29', 'Copic|Y08', 'Copic|V09'];
  test('X2 C4: Save and Use in a guide keep the palette’s own scheme when the one chosen since can’t be made', () => {
    const a = palApp(FIVE),
      E = a.__eval;
    palState(E, 'complementary', 4);
    E(`palPush(genPalette(4, 'complementary', paletteOpts()), 24)`);
    // five clear markers can't make a Rainbow (6): the Complementary palette stays on the card
    E(`setHarmony('rainbow')`);
    assert.equal(E('state.harmony'), 'rainbow');
    assert.deepEqual(J(a, 'state.palH'), ['complementary']);
    E('doSave()');
    assert.equal(
      E('state.saved[0].h'),
      'complementary',
      'saved as the Complementary it is, not as "Rainbow"',
    );
    assert.equal(E('currentPaletteHarm()'), 'complementary');
    // the first visit's preview (nothing made yet) and Custom are the scheme chosen
    palState(E, 'triadic', 3);
    assert.equal(E('currentPaletteHarm()'), 'triadic');
    E(`palPush(genPalette(3, 'triadic', paletteOpts()), 24); state.harmony = 'custom'`);
    assert.equal(E('currentPaletteHarm()'), 'custom');
  });
  test('X2 C5: Rainbow’s “N clear colours” isn’t said of another scheme’s palette left on the card', () => {
    const a = palApp(FIVE),
      E = a.__eval;
    palState(E, 'complementary', 4);
    E(`palPush(genPalette(4, 'complementary', paletteOpts()), 24); setHarmony('rainbow'); closeNote()`);
    assert.doesNotMatch(E('__pc.textContent'), /clear colours for a rainbow/);
    // a Rainbow itself stopped at the clear markers in play still says it
    const b = palApp('Honolulu 24'),
      F = b.__eval;
    palState(F, 'rainbow', 16);
    F(`palPush(genPalette(16, 'rainbow', paletteOpts()), 24); closeNote()`);
    const n = +F('state.palettes[0].length');
    if (n < 16)
      assert.match(F('__pc.textContent'), new RegExp('have ' + n + ' clear colours for a rainbow, not 16'));
  });
  test('X2 C6: “try fewer colours” isn’t said at the scheme’s smallest size', () => {
    const a = palApp(['Copic|R27', 'Copic|G07', 'Copic|B29']),
      E = a.__eval;
    palState(E, 'tetradic', 4);
    E('doGenerate()');
    assert.equal(
      E('window.__toasts[window.__toasts.length - 1]'),
      'Couldn’t make a 4-colour palette from the markers in play — add markers with more colours.',
    );
    // above the smallest it's still offered
    palState(E, 'complementary', 4);
    E('palFailToast()');
    assert.match(E('window.__toasts[window.__toasts.length - 1]'), /— try fewer colours, or add markers/);
  });
  test('X2 C7: a lock with no room at the new size is said, not dropped silently', () => {
    const a = palApp('Honolulu 120'),
      E = a.__eval;
    palState(E, 'complementary', 8);
    E(
      `palPush(genPalette(8, 'complementary', paletteOpts()), 24); state.locked = state.palettes[0].slice(0, 5)`,
    );
    const five = J(a, 'state.locked.map(capCode)');
    E('window.__toasts = []; setSize(4)');
    assert.equal(E('state.locked.length'), 4);
    const off = five.filter((c) => !J(a, 'state.locked.map(capCode)').includes(c));
    assert.deepEqual(J(a, 'window.__toasts'), ['Unlocked ' + off[0] + ': no room for it at 4 colours.']);
  });
  test('X2 C2: after From photo, Undo in Photo goes back to the palettes made before it', () => {
    const a = palApp('Honolulu 120'),
      E = a.__eval;
    palState(E, 'complementary', 4);
    E(
      `palPush(genPalette(4, 'complementary', paletteOpts()), 24); palPush(genPalette(4, 'complementary', paletteOpts()), 24)`,
    );
    const B = J(a, 'state.palettes[1]');
    // From photo (its palette, then a band swap: two photo steps), then Complementary again
    E(`_photoImg = { width: 10, height: 10 }; state.harmony = 'photo'; state.palSize = 4;
     palPush(genPalette(4, 'complementary', {}), 20); palPush(genPalette(4, 'complementary', {}), 20)`);
    assert.equal(E('photoUndoable()'), true);
    E(`setHarmony('complementary')`);
    E('undo()');
    assert.equal(E('state.harmony'), 'photo', 'v308: Undo into a photo’s palette goes back to From photo');
    E('undo()');
    assert.equal(E('state.harmony'), 'photo', 'the band swap taken back (v299), in Photo');
    E('undo()');
    assert.equal(E('state.harmony'), 'complementary', 'and from Photo, back to the palette before it');
    assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), B);
    // only photo palettes: nothing to go back to, Undo does nothing in Photo
    palState(E, 'photo', 4);
    E(`palPush(genPalette(4, 'complementary', {}), 20); undo()`);
    assert.equal(E('photoUndoable()'), false);
    assert.equal(E('state.palettes.length'), 1);
  });
  test('X2 C1: Monochrome from a black is a ramp of greys, of one family', () => {
    const a = palApp('Honolulu 320 (complete set)'),
      E = a.__eval;
    palState(E, 'mono', 5);
    E(`state.seed = 'Ohuhu|120'; palSizeFit()`);
    for (let t = 0; t < 6; t++) {
      const p = J(
        a,
        `genPalette(5, 'mono', paletteOpts()).map((i) => ({ k: mkey(i), c: LCH[i][1], f: COLORS[i].fam }))`,
      );
      assert.equal(p[0].k, 'Ohuhu|120', 'the black kept');
      assert.ok(
        p.every((x) => x.c < 12),
        'all near-greys: ' + p.map((x) => x.k).join(' '),
      );
      assert.equal(
        new Set(p.slice(1).map((x) => x.f)).size,
        1,
        'one grey family: ' + p.map((x) => x.f).join(', '),
      );
    }
    // a colour's Monochrome is as before: its own family
    E(`state.seed = mkey(COLORS.findIndex((c, i) => c.fam === 'Red' && inPool(i) && LCH[i][1] > 40))`);
    const r = J(a, `genPalette(5, 'mono', paletteOpts()).map((i) => COLORS[i].fam)`);
    assert.ok(r.filter((f) => f === 'Red').length >= 3, r.join(', '));
  });
}

// ---- from v31828-y2.test.mjs ----
// v318.28 (deep debugging pass, step 2): Y2, Palette (reviewer C's C2, C3) and making a guide (reviewer D's D2/D3).
// C1, C4, C5 (a band's tap) and D1 (a long PDF) are in e2e/v31828-y2. Each test fails on v318.27.
{
  // ---- Palette ----
  function palApp(owned) {
    const a = createApp({ localStorage: memoryStorage() }),
      E = a.__eval;
    E('state.owned = new Set(); state.pool = null; state.ink = {}');
    E(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(owned)})).forEach((k) => state.owned.add(k))`,
    );
    // no screen to draw on; the line under the Colours row readable
    E(`showPalette = function () {}; chrome = function () {}; fullRender = function () {}; clearPalette = function () {};
     renderRecent = function () {}; flashSaved = function () {}; toast = function () {};
     var __pc = { textContent: '', style: {} }, __d = document;
     document = new Proxy({}, { get(t, p) {
       if (p === 'getElementById') return (id) => (id === 'palClose' ? __pc : __d.getElementById(id));
       return __d[p];
     } })`);
    return a;
  }
  const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
  const palState = (E, h, n) =>
    E(`state.mode = 'palette'; state.harmony = '${h}'; state.palSize = ${n}; state.palettes = []; state.palH = [];
     state.locked = []; state.seed = null; state.excluded = new Set(); setPool(null)`);
  // ---- Sections left white in the Pattern box's counts ----
  function seeded(seed, fn) {
    const r = Math.random;
    let s = seed >>> 0 || 1;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      return fn();
    } finally {
      Math.random = r;
    }
  }
  // an app on a page drawn by draw(W, H, g) (0 = line), segmented, with Honolulu 120
  function appOn(W, H, draw) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    E(`state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')))`);
    t.coll = E('sfCollection()');
    const g = new Uint8Array(W * H).fill(255);
    draw(W, H, g);
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.segment();
    return t;
  }
  function lay(t, vars, seed) {
    Object.assign(
      t.styleVars,
      { family: 'random', look: 'auto', paletteSource: 'owned', palette: 'all', emphasis: 'neutral' },
      { limitN: 16, noRep: false, noAdj: true, balance: 'mixed' },
      vars,
    );
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    seeded(seed, () => t.assign.buildGuide());
  }
  const LW = 2;
  // a grid of cells (cell px, lines LW), with the top-left bw × bh cells one big section when bw > 0
  const grid = (cols, rows, bw = 0, bh = 0, cell = 18) => {
    const step = cell + LW;
    return [
      cols * step + LW,
      rows * step + LW,
      (W, H, g) => {
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const cx = Math.floor(x / step),
              cy = Math.floor(y / step),
              inBig = cx < bw && cy < bh && x > LW && y > LW && x < bw * step && y < bh * step;
            if (
              (!inBig && (x % step < LW || y % step < LW)) ||
              x < LW ||
              y < LW ||
              x >= W - LW ||
              y >= H - LW
            )
              g[y * W + x] = 0;
          }
      },
    ];
  };
  test('Y2 C2: re-rolling a band of a grey Monochrome (built from a black) gives greys, not clear colours', () => {
    for (const set of ['Honolulu 120', 'Sketch 72 - Set A']) {
      const a = palApp(set),
        E = a.__eval;
      palState(E, 'mono', 5);
      // the darkest near-grey in play: the set's black
      const bi = +E(`(function () { let b = -1; for (let i = 0; i < COLORS.length; i++)
      if (inPool(i) && LCH[i][1] < GREY_C && (b < 0 || LCH[i][0] < LCH[b][0])) b = i; return b; })()`);
      const pal = J(a, `[...genPalette(5, 'mono', { seedIdx: ${bi}, locked: { 0: ${bi} } })]`);
      assert.ok(J(a, `${JSON.stringify(pal)}.every((i) => LCH[i][1] < GREY_C)`), set + ': a ramp of greys');
      for (let k = 0; k < pal.length; k++)
        for (let t = 0; t < 12; t++) {
          const p = +E(`rerollPick(${JSON.stringify(pal)}, ${k}, 'mono')`);
          if (p < 0) continue;
          assert.ok(
            +E(`LCH[${p}][1]`) < +E('GREY_C'),
            `${set} band ${k}: ${E(`capCode(${p})`)} is a clear colour`,
          );
        }
    }
  });
  test('Y2 C3: a colour scheme made of greys says so under the Colours row; Monochrome and clear schemes don’t', () => {
    const a = palApp('All Copic markers'),
      E = a.__eval;
    palState(E, 'custom', 4);
    // a selection of the Copic greys (as Markers' search "grey" hands one over)
    E(
      `setPool(COLORS.map((c, i) => i).filter((i) => COLORS[i].brand === 'Copic' && /^(C|N|T|W)-\\d/.test(COLORS[i].code)))`,
    );
    for (const h of ['complementary', 'triadic', 'tetradic', 'split', 'analogous']) {
      E(`setHarmony('${h}'); closeNote()`);
      assert.match(
        E('__pc.textContent'),
        /^Some colours are greys: your markers in play don’t have \d clear colours for this scheme\.$/,
        h,
      );
    }
    E(`setHarmony('mono'); closeNote()`);
    assert.doesNotMatch(E('__pc.textContent'), /greys/, 'Monochrome’s greys are its steps');
    const b = palApp('Honolulu 120'),
      F = b.__eval;
    for (const h of ['complementary', 'triadic', 'tetradic'])
      for (let t = 0; t < 4; t++) {
        palState(F, h, 4);
        F(`palPush(genPalette(4, '${h}', paletteOpts()), 24); closeNote()`);
        assert.doesNotMatch(F('__pc.textContent'), /greys/, h + ' from Honolulu 120');
      }
  });
  test('Y2 D3: No repeats counts the sections coloured, not those left white', () => {
    const t = appOn(...grid(5, 3));
    lay(t, { noRep: true, limitN: 120 }, 1);
    const note = () => (t.assign.pattern().match(/id="sfNoRepNote"[^>]*>([^<]*)/) || [])[1];
    assert.equal(t.assignData.N, 15);
    assert.match(note(), /^Every section has its own marker: 15\./);
    for (const l of t.assignData.order.slice(0, 5)) t.leaveWhite(l);
    seeded(2, () => t.layPlan(null));
    assert.equal(t.assignData.N, 10);
    assert.match(note(), /^Every section has its own marker: 10\./);
  });
  test('Y2 D2: Main colour’s “why the shares miss” stays once a section is left white', () => {
    // one big section (11 × 9 cells) among small ones: 60/30/10 can't be met
    const t = appOn(...grid(12, 10, 11, 9)),
      miss = () => (t.assign.pattern().match(/id="sfBalMiss"[^>]*>([^<]*)/) || [])[1] || '';
    lay(t, { balance: 'main', limitN: 8 }, 1);
    assert.match(miss(), /^Its sections’ sizes don’t allow 60\/30\/10 exactly: the biggest covers \d+%/);
    t.leaveWhite(t.assignData.order[t.assignData.order.length - 1]);
    seeded(1, () => t.layPlan(null));
    assert.match(miss(), /^Its sections’ sizes don’t allow 60\/30\/10 exactly: the biggest covers \d+%/);
  });
}

// ---- from v31834-harmonies.test.mjs ----
// (v318.34) Three harmonies on evenly stepped ramps (plan D; Fable P2-7, P2-8, E1-4): the ramp picked as a path
// (picker.js genPath) for Monochrome, Analogous, Light to shadow and the greys of Greys + accent; the three schemes'
// sizes and shapes on Honolulu 120 / 320 and a 36-Copic set; Greys + accent unavailable below 3 greys; the notes.
{
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
  const SETS = { H120: 'Honolulu 120', H320: 'Honolulu 320 (complete set)', C36: 'Ciao 36 - Set A' };
  function appWith(set) {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}');
    a.__eval(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
    );
    return a;
  }
  const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
  // a palette as [{ i, L, C, h, fam }]
  const gen = (a, n, h, opts) =>
    J(
      a,
      `(() => { const p = genPalette(${n}, ${JSON.stringify(h)}, ${JSON.stringify(opts || {})}); return p && p.map((i) => ({ i, L: LCH[i][0], C: LCH[i][1], h: LCH[i][2], fam: COLORS[i].fam })); })()`,
    );
  const hd = (x, y) => {
    const d = Math.abs(x - y) % 360;
    return Math.min(d, 360 - d);
  };
  // the largest lightness step over the smallest (steps under 1 count as 1), lightest to darkest
  const stepRatio = (Ls) => {
    const s = Ls.slice().sort((x, y) => x - y),
      st = [];
    for (let i = 1; i < s.length; i++) st.push(s[i] - s[i - 1]);
    return Math.max(...st) / Math.max(1, Math.min(...st));
  };
  const median = (xs) => xs.slice().sort((x, y) => x - y)[xs.length >> 1];
  // the most even ramp the candidates allow, by lightness (no hue fit, no mood): a path through one candidate per
  // slot, lightest first, neighbours the scheme's ΔE apart, with the largest smallest step; its max/min step ratio
  function optRatio(slots, de, need) {
    const m = slots.length;
    let prev = slots[0].map((c) => ({ c, min: Infinity, path: [c.L] }));
    for (let k = 1; k < m; k++) {
      const cur = [];
      for (const c of slots[k]) {
        let best = null;
        for (const p of prev) {
          if (p.c.L <= c.L || de(p.c.i, c.i) < need) continue;
          const mn = Math.min(p.min, p.c.L - c.L);
          if (!best || mn > best.min) best = { c, min: mn, path: p.path.concat(c.L) };
        }
        if (best) cur.push(best);
      }
      if (!cur.length) return null;
      prev = cur;
    }
    let best = prev[0];
    for (const p of prev) if (p.min > best.min) best = p;
    return stepRatio(best.path);
  }
  test('v318.34: a ramp is evenly stepped where the markers in play allow it (median max/min step ≤ 2.5 over 60 rolls)', () => {
    // "allow": by lightness alone the slots' candidates (the clear markers of the band, L 24–94, in each slot's hue
    // window — Monochrome 25°, Analogous 60° either side, Light to shadow 30° of each slot's hue along its sweep —
    // or the greys of the band) hold a ramp with a step ratio of 2 or under (optRatio); such rolls are measured
    const results = [];
    for (const [tag, set] of Object.entries(SETS)) {
      const a = appWith(set),
        n = tag === 'C36' ? 4 : 6;
      const bases = J(
        a,
        `COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] >= 20 && LCH[i][0] >= 25 && LCH[i][0] <= 90)`,
      );
      const slotLs = (h, b, k) =>
          J(
            a,
            `(() => { const pool = COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][0] >= 24 && LCH[i][0] <= 94), out = (l) => l.map((i) => ({ i, L: LCH[i][0] }));
           if (${JSON.stringify(h)} === 'neutral') return out(pool.filter((i) => LCH[i][1] < GREY_C));
           const bh = LCH[${b}][2], clear = pool.filter((i) => LCH[i][1] >= GREY_C);
           if (${JSON.stringify(h)} === 'shadow') { const sgn = hueOff(270, bh) >= 0 ? 1 : -1, sh = (bh + (sgn * 120 * ${k}) / ${n - 1} + 360) % 360; return out(clear.filter((i) => hueDist(LCH[i][2], sh) <= 30)); }
           return out(clear.filter((i) => hueDist(LCH[i][2], bh) <= ${h === 'mono' ? 25 : 60})); })()`,
          ),
        deCache = new Map(),
        de = (x, y) => {
          const key = x < y ? x * 4096 + y : y * 4096 + x;
          if (!deCache.has(key)) deCache.set(key, a.__eval(`de2000(LAB[${x}], LAB[${y}])`));
          return deCache.get(key);
        };
      for (const h of ['mono', 'analogous', 'shadow', 'neutral']) {
        const ratios = withSeed(34, () => {
          const out = [];
          for (let r = 0; r < 60; r++) {
            const b = bases[(Math.random() * bases.length) | 0],
              k = h === 'neutral' ? n - 1 : n,
              lists = [];
            for (let q = 0; q < k; q++) lists.push(h === 'shadow' || q === 0 ? slotLs(h, b, q) : lists[0]);
            const opt = optRatio(lists, de, h === 'mono' ? 6 : 10);
            if (!(opt != null && opt <= 2)) continue;
            // (Monochrome's base sets its hue and family; not locked, so the ramp is free to be even round it)
            const opts =
                h === 'mono' ? { seedIdx: b } : h === 'neutral' ? {} : { baseHue: a.__eval(`LCH[${b}][2]`) },
              p = gen(a, n, h, opts);
            assert.ok(p && p.length === n, `${tag} ${h} ${n}: a full palette`);
            // the ramp: all of Monochrome, Analogous and Light to shadow; Greys + accent's greys (after its accent)
            out.push(stepRatio((h === 'neutral' ? p.slice(1) : p).map((x) => x.L)));
          }
          return out;
        });
        if (ratios.length < 10) {
          results.push(`${tag} ${h} ${n}: only ${ratios.length} rolls with room`);
          continue;
        }
        const m = median(ratios);
        results.push(`${tag} ${h} ${n}: median ${m.toFixed(1)} over ${ratios.length} rolls`);
        assert.ok(
          m <= 2.5,
          `${tag} ${h} ${n}: median step ratio ${m.toFixed(2)} over ${ratios.length} rolls with room`,
        );
      }
    }
    // Honolulu 320 has room for every ramp (the smaller sets for some: the line says which)
    assert.equal(
      results.filter((r) => r.startsWith('H320') && /median/.test(r)).length,
      4,
      results.join('; '),
    );
  });
  test('v318.34: each new harmony gives n distinct colours in its range, shaped as it says, on the three sets', () => {
    for (const [tag, set] of Object.entries(SETS)) {
      const a = appWith(set),
        inPlay = a.__eval('COLORS.filter((c, i) => inPool(i)).length'),
        greys = a.__eval('genGreys(null)'),
        max = inPlay < 72 ? 6 : 8;
      withSeed(7, () => {
        for (const h of ['shadow', 'accent', 'neutral']) {
          assert.deepEqual(J(a, `HARM_RANGE.${h}`), [3, 8]);
          if (h === 'neutral' && greys < 3) {
            assert.equal(gen(a, 4, h), null, `${tag}: Greys + accent needs 3 greys (${greys} in play)`);
            assert.equal(
              a.__eval(`palCap('neutral')`),
              3,
              'the smallest size stays offered (the button is greyed)',
            );
            continue;
          }
          const cap = a.__eval(`palCap(${JSON.stringify(h)})`);
          assert.equal(
            cap,
            h === 'neutral' ? Math.min(max, greys + 1) : max,
            `${tag} ${h}: sizes to ${cap} (${inPlay} in play)`,
          );
          for (let n = 3; n <= 8; n++)
            for (let r = 0; r < 8; r++) {
              const p = gen(a, n, h);
              assert.ok(p, `${tag} ${h} ${n}: made`);
              assert.equal(
                p.length,
                Math.min(n, cap),
                `${tag} ${h} ${n}: the size, within what the markers in play offer`,
              );
              assert.equal(new Set(p.map((x) => x.i)).size, p.length, 'distinct');
              if (h === 'neutral') {
                assert.ok(
                  p[0].C >= 12 || p.length < 3,
                  `${tag} neutral ${n}: a clear accent first (C ${p[0].C.toFixed(0)})`,
                );
                assert.ok(
                  p.slice(1).every((x) => x.C < 12),
                  `${tag} neutral ${n}: greys after it`,
                );
                const Ls = p.slice(1).map((x) => x.L);
                assert.deepEqual(
                  Ls,
                  Ls.slice().sort((x, y) => y - x),
                  'greys lightest first',
                );
              }
              if (h === 'accent' && p.length >= 3) {
                // the accent last, across the wheel from the fan's middle
                const fan = p.slice(0, -1).filter((x) => x.C >= 12),
                  acc = p[p.length - 1];
                if (fan.length >= 2 && acc.C >= 12) {
                  let x = 0,
                    y = 0;
                  for (const f of fan) {
                    x += Math.cos((f.h * Math.PI) / 180);
                    y += Math.sin((f.h * Math.PI) / 180);
                  }
                  const mid = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
                  assert.ok(
                    hd(acc.h, mid) >= 90 || tag === 'C36',
                    `${tag} accent ${n}: the accent ${hd(acc.h, mid).toFixed(0)}° from the fan`,
                  );
                }
              }
              if (h === 'shadow' && p.length >= 3) {
                const Ls = p.map((x) => x.L);
                assert.deepEqual(
                  Ls,
                  Ls.slice().sort((x, y) => y - x),
                  `${tag} shadow ${n}: light to dark`,
                );
              }
            }
        }
      });
    }
  });
  test('v318.34: the sizes follow the markers in play: 3–6 below 72, 3–8 from 72 (Palette’s buttons and the guide’s asks)', () => {
    const a = appWith('Honolulu 120');
    assert.equal(a.__eval(`palCap('shadow')`), 8);
    // the Palette screen's selection narrows the markers in play
    a.__eval(`setPool(COLORS.map((c, i) => i).filter((i) => inPool(i)).slice(0, 60))`);
    assert.equal(a.__eval(`palCap('shadow')`), 6);
    assert.equal(a.__eval(`palCap('accent')`), 6);
    assert.equal(
      a.__eval(`genPalette(8, 'accent').length`),
      6,
      'asked for 8 (the guide asks for the range’s most): 6',
    );
    a.__eval('setPool(null)');
    assert.equal(a.__eval(`genPalette(8, 'accent').length`), 8);
  });
  test('v318.34: Greys + accent is unavailable below 3 greys, with the reason; never in Surprise’s list', () => {
    const a = appWith('Ciao 36 - Set A'),
      E = a.__eval;
    assert.equal(E('genGreys(null)'), 2);
    assert.equal(E('neutralWhy()'), 'Needs 3 greys among your markers');
    assert.equal(E(`genPalette(3, 'neutral')`), null);
    assert.equal(E(`palCap('neutral')`), 3);
    // a selection on the Palette screen counts as the markers in play
    const b = appWith('Honolulu 24');
    assert.equal(b.__eval('genGreys(null)'), 3);
    assert.equal(b.__eval('neutralWhy()'), null);
    b.__eval(`setPool(COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] >= GREY_C))`);
    assert.equal(b.__eval('neutralWhy()'), 'Needs 3 greys among your markers');
    b.__eval('setPool(null)');
    // the guide's exclusions (a group turned off) count too
    const greys = JSON.parse(
      b.__eval('JSON.stringify(COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] < GREY_C))'),
    );
    assert.equal(b.__eval(`genGreys(new Set([${greys[0]}]))`), 2);
    assert.equal(b.__eval(`genPalette(4, 'neutral', { exclude: new Set([${greys[0]}]) })`), null);
    // the guide's row after Monochrome; Surprise's list (its source: shadow and accent in, never neutral)
    assert.deepEqual(J(b, '__mstest.GEN_HARMS'), [
      'complementary',
      'analogous',
      'triadic',
      'split',
      'tetradic',
      'mono',
      'shadow',
      'accent',
      'neutral',
      'rainbow',
    ]);
    const src = fsSync.readFileSync(new URL('../src/js/guide/30-palette-assign.js', import.meta.url), 'utf8');
    const list = /function surprise\(\)[\s\S]*?var harms = \[([\s\S]*?)\]\.filter/.exec(src)[1];
    assert.ok(
      /'shadow'/.test(list) && /'accent'/.test(list) && !/'neutral'/.test(list),
      'Surprise: shadow and accent, never neutral: ' + list,
    );
  });
  test('v318.34: the notes: "Some colours are greys" never for Greys + accent; palOnScheme for shadow and accent', () => {
    const a = appWith('Honolulu 120'),
      E = a.__eval;
    E(`showPalette = function () {}; fullRender = function () {}; clearPalette = function () {}; renderRecent = function () {};
     var __pc = { textContent: '', style: {} }, __d = document;
     document = new Proxy({}, { get(t, p) { if (p === 'getElementById') return (id) => (id === 'palClose' ? __pc : __d.getElementById(id)); return __d[p]; } })`);
    E(
      `state.mode = 'palette'; state.harmony = 'neutral'; state.palSize = 5; state.palettes = []; state.palH = []; state.locked = []; state.seed = null`,
    );
    withSeed(3, () => {
      for (let t = 0; t < 6; t++) {
        E(`palPush(genPalette(5, 'neutral', paletteOpts()), 24); closeNote()`);
        assert.doesNotMatch(
          E('__pc.textContent'),
          /greys/,
          'its greys are its ramp: ' + E('__pc.textContent'),
        );
      }
      // the report agrees
      const rep = J(
        a,
        `(() => { const report = {}; genPalette(5, 'neutral', { report }); return report; })()`,
      );
      assert.equal(rep.grey, false);
      // on the scheme: Light to shadow's sweep, Analogous + accent's fan and accent; off it when the hues say otherwise
      for (let t = 0; t < 10; t++) {
        const s = gen(a, 6, 'shadow', { report: {} }),
          c = gen(a, 6, 'accent');
        const sRep = J(
          a,
          `(() => { const report = {}; const p = genPalette(6, 'shadow', { report }); return { p, report }; })()`,
        );
        if (!sRep.report.hueWidened)
          assert.ok(
            E(`palOnScheme(${JSON.stringify(sRep.p)}, 'shadow')`),
            'a clean Light to shadow is on its scheme',
          );
        void s;
        const cRep = J(
          a,
          `(() => { const report = {}; const p = genPalette(6, 'accent', { report }); return { p, report }; })()`,
        );
        if (!cRep.report.hueWidened)
          assert.ok(
            E(`palOnScheme(${JSON.stringify(cRep.p)}, 'accent')`),
            'a clean Analogous + accent is on its scheme',
          );
        void c;
      }
      // a Triadic's spread is neither
      const tri = J(a, `genPalette(6, 'triadic')`);
      assert.equal(E(`palOnScheme(${JSON.stringify(tri)}, 'shadow')`), false);
      assert.equal(E(`palOnScheme(${JSON.stringify(tri)}, 'accent')`), false);
    });
  });
}

// ---- from v31837-palettes.test.mjs ----
// (v318.37) Palette fixes from Fable's X3 review: a locked colour keeps its place under Analogous + accent and Light
// to shadow (paletteOpts knows their slots' hue offsets, X3-1); Greys + accent started from a grey puts the grey on
// its ramp and finds a clear accent, or says it has none (X3-2, X3-5); Random's Remove/Clear Undo only while the pile
// is as the removal left it (X3-3).
{
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
    a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}; state.seed = null');
    a.__eval(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
    );
    return a;
  }
  const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
  const H320 = 'Honolulu 320 (complete set)';
  const hd = (x, y) => {
    const d = Math.abs(x - y) % 360;
    return Math.min(d, 360 - d);
  };
  test('v318.37 X3-1: Analogous + accent with the accent locked: the fan is rebuilt round the fan, not the accent', () => {
    const a = appWith(H320),
      E = a.__eval;
    withSeed(11, () => {
      for (let round = 0; round < 4; round++) {
        E(
          `state.harmony = 'accent'; state.palSize = 5; state.palettes = [genPalette(5, 'accent', {})]; state.palH = ['accent']; state.locked = [state.palettes[0][4]]`,
        );
        const acc = J(a, 'LCH[state.locked[0]][2]');
        for (let t = 0; t < 5; t++) {
          const r = J(
            a,
            `(() => { const o = paletteOpts(); const p = genPalette(5, 'accent', o); state.palettes.push(p); return { base: o.baseHue, pal: p, hs: p.map((i) => LCH[i][2]), on: palOnScheme(p, 'accent', new Set()) }; })()`,
          );
          assert.equal(r.pal[4], J(a, 'state.locked[0]'), 'the locked accent stays last');
          // the base is the accent's complement, so the fan sits across the wheel from it
          assert.ok(hd(r.base, acc + 180) < 1e-6, 'base ' + r.base + ' for accent ' + acc);
          const fan = r.hs.slice(0, 4),
            reach = 40 + J(a, "genLevels('accent')[0][1]");
          for (const h of fan)
            assert.ok(hd(h, r.base) <= reach + 1e-6, 'fan hue ' + h + ' within the fan round ' + r.base);
          assert.ok(r.on, 'on the scheme: ' + r.hs.map(Math.round).join('/'));
        }
      }
    });
  });
  test('v318.37 X3-1: Light to shadow with the shadow end locked: the sweep still ends on it', () => {
    const a = appWith(H320),
      E = a.__eval;
    withSeed(5, () => {
      let checked = 0;
      for (let round = 0; round < 6; round++) {
        E(
          `state.harmony = 'shadow'; state.palSize = 5; state.palettes = [genPalette(5, 'shadow', {})]; state.palH = ['shadow']; state.locked = [state.palettes[0][4]]`,
        );
        const end = J(a, 'LCH[state.locked[0]][2]'),
          win = J(a, "genLevels('shadow')[0][1]");
        for (let t = 0; t < 4; t++) {
          const r = J(
            a,
            `(() => { const o = paletteOpts(); const p = genPalette(5, 'shadow', o); state.palettes.push(p); const sgn = hueOff(270, o.baseHue) >= 0 ? 1 : -1; return { base: o.baseHue, slotEnd: (o.baseHue + sgn * 120 + 360) % 360, pal: p, hs: p.map((i) => LCH[i][2]) }; })()`,
          );
          assert.equal(r.pal[4], J(a, 'state.locked[0]'));
          // the sweep's last place is on the locked hue (where the scheme can reach it at all: yellow-green shadows
          // are no scheme's end, and the nearest sweep is taken)
          if (hd(r.slotEnd, end) < 1e-6) checked++;
          else assert.ok(hd(r.slotEnd, end) <= win, 'sweep end ' + r.slotEnd + ' for locked ' + end);
          // the free colours step from the base, not from the locked colour
          assert.ok(hd(r.hs[0], r.base) <= win + 1e-6, 'first hue ' + r.hs[0] + ' near base ' + r.base);
        }
      }
      assert.ok(checked >= 8, 'the sweep ended exactly on the locked hue ' + checked + ' times');
    });
  });
  test('v318.37 X3-1: Greys + accent with a grey locked: the base is left to the clear colours', () => {
    const a = appWith(H320),
      E = a.__eval;
    withSeed(7, () => {
      E(
        `state.harmony = 'neutral'; state.palSize = 5; state.palettes = [genPalette(5, 'neutral', {})]; state.palH = ['neutral']; state.locked = [state.palettes[0][2]]`,
      );
      const acc = J(a, 'LCH[state.palettes[0][0]][2]');
      const o = J(a, 'paletteOpts()');
      assert.ok(hd(o.baseHue, acc) < 1e-6, 'the base from the palette first colour, not the locked grey');
    });
  });
  test('v318.37 X3-2: Greys + accent started from a grey marker: the grey on its ramp, one clear accent', () => {
    const a = appWith(H320),
      E = a.__eval;
    const greys = J(
      a,
      '(() => { const r = []; for (let i = 0; i < COLORS.length; i++) if (inPool(i) && LCH[i][1] < GREY_C) r.push(i); return r; })()',
    );
    withSeed(3, () => {
      for (const g of [greys[0], greys[4], greys[8], greys[12], greys[greys.length - 1]]) {
        E(
          `state.seed = mkey(${g}); state.harmony = 'neutral'; state.palSize = 5; state.palettes = []; state.locked = []`,
        );
        const r = J(
          a,
          `(() => { const o = paletteOpts(); const report = {}; o.report = report; const p = genPalette(5, 'neutral', o); return { p, report, L: p.map((i) => LCH[i][0]), C: p.map((i) => LCH[i][1]), from: palFrom(p, ${g}, 'neutral') }; })()`,
        );
        assert.ok(r.p.includes(g), 'the seed is in the palette');
        assert.ok(r.C[0] >= J(a, 'GREY_C'), 'the first colour is the clear accent: ' + r.C.map(Math.round));
        assert.equal(r.C.filter((c) => c >= J(a, 'GREY_C')).length, 1, 'exactly one clear colour');
        // the ramp (after the accent) reads lightest first, the seed at its own step
        const ramp = r.L.slice(1);
        for (let k = 1; k < ramp.length; k++)
          assert.ok(ramp[k - 1] >= ramp[k] - 1e-6, 'ramp order ' + ramp.map(Math.round));
        assert.equal(r.from, true, 'still built from the seed (the card says "… base")');
        assert.equal(r.report.grey, false);
      }
    });
  });
  test('v318.37 X3-5: Greys + accent on greys only: the accent is a grey, and the note says so', () => {
    const a = appWith(H320),
      E = a.__eval;
    E(`showPalette = function () {}; fullRender = function () {}; clearPalette = function () {}; renderRecent = function () {};
     var __pc = { textContent: '', style: {} }, __d = document;
     document = new Proxy({}, { get(t, p) { if (p === 'getElementById') return (id) => (id === 'palClose' ? __pc : __d.getElementById(id)); return __d[p]; } })`);
    E(
      '(() => { const r = []; for (let i = 0; i < COLORS.length; i++) if (inPool(i) && LCH[i][1] < GREY_C) r.push(i); setPool(r); })()',
    );
    E(
      `state.mode = 'palette'; state.harmony = 'neutral'; state.palSize = 5; state.palettes = []; state.palH = []; state.locked = []; state.seed = null`,
    );
    withSeed(9, () => {
      const rep = J(
        a,
        `(() => { const report = {}; genPalette(5, 'neutral', { report }); return report; })()`,
      );
      assert.equal(rep.grey, true, 'the report says the accent is a grey');
      E(`palPush(genPalette(5, 'neutral', paletteOpts()), 24); closeNote()`);
      assert.match(
        E('__pc.textContent'),
        /All greys: your markers in play don.t have a clear colour for the accent\./,
      );
      // locked first: the grey accent is your choice, nothing said
      E(`state.locked = [state.palettes[state.palettes.length - 1][0]]; closeNote()`);
      assert.doesNotMatch(E('__pc.textContent'), /All greys/);
    });
    // the full set: a clear accent, no note
    E(`setPool(null); state.locked = []; state.palettes = []; state.palH = []`);
    withSeed(9, () => {
      E(`palPush(genPalette(5, 'neutral', paletteOpts()), 24); closeNote()`);
      assert.equal(E('__pc.textContent'), '');
    });
  });
  test('v318.37 X3-3: Random: Undo of Remove/Clear only while the pile is as it was left', () => {
    const a = appWith(H320),
      E = a.__eval;
    E(`fullRender = function () {}; var __toasts = []; toast = function (m) { __toasts.push(m); }`);
    E(`state.mode = 'random'; state.drawn = [8, 132, 217]`);
    // as the removal left it: back
    E(`drawnBack([8, 132, 217], [132, 217])`); // the pile isn't [132, 217]: refused
    assert.deepEqual(J(a, 'state.drawn'), [8, 132, 217]);
    assert.equal(J(a, '__toasts.length'), 1);
    E(`state.drawn = [132, 217]; drawnBack([8, 132, 217], [132, 217])`);
    assert.deepEqual(J(a, 'state.drawn'), [8, 132, 217], 'put back when nothing changed since');
    // a draw since: refused, the new draw kept
    E(`state.drawn = [136, 132, 217]; drawnBack([8, 132, 217], [132, 217])`);
    assert.deepEqual(J(a, 'state.drawn'), [136, 132, 217]);
    assert.match(J(a, '__toasts[1]'), /pile has changed/);
    // Clear all's: back only while empty
    E(`state.drawn = []; drawnBack([8, 132], [])`);
    assert.deepEqual(J(a, 'state.drawn'), [8, 132]);
    E(`state.drawn = [5]; drawnBack([8, 132], [])`);
    assert.deepEqual(J(a, 'state.drawn'), [5]);
    // without `after` (older callers): as before
    E(`drawnBack([1, 2])`);
    assert.deepEqual(J(a, 'state.drawn'), [1, 2]);
  });
}

// ---- from v319-palettes.test.mjs ----
// (v319) Palette fixes from Fable's Y3 review: Greys + accent from a grey seed keeps a locked accent, at the accent's
// slot (Y3-1); in a guide, Include › Greys & black off makes Greys + accent unavailable with that reason, the
// exclusions counting the generator's own greys (Y3-2); the fallback to Analogous + accent is per call: genHarmony
// stays 'neutral', the note returns each time, and Greys + accent comes back once the greys do (Y3-3).
{
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
    a.__eval(
      'state.owned = new Set(); state.pool = null; state.ink = {}; state.seed = null; state.locked = []',
    );
    a.__eval(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
    );
    return a;
  }
  const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
  const H320 = 'Honolulu 320 (complete set)';
  // the guide, with the shell's two callbacks it uses here (the harness doesn't run the shell's boot)
  function guideWith(set) {
    const a = appWith(set),
      E = a.__eval,
      core = a.__mstest;
    E(
      `SF.configure({ neutralWhy: (ex) => (genGreys(ex || null) < NEUTRAL_GREYS ? 'Needs ' + NEUTRAL_GREYS + ' greys among your markers' : null), genPalette: (n, h, o) => (genPalette(n, h, o) || []).map(mkey) })`,
    );
    core.coll = E('sfCollection()');
    core.paletteSource = 'generate';
    return { a, E, core, sv: core.styleVars };
  }
  const greysIn = (a, keys) =>
    keys.filter((k) => J(a, `LCH[keyIdx(${JSON.stringify(k)})][1] < GREY_C`)).length;
  test('v319 Y3-1: Greys + accent from a grey seed with the accent locked: the lock is kept, at the accent’s slot', () => {
    const a = appWith(H320),
      E = a.__eval,
      GREY_C = J(a, 'GREY_C');
    withSeed(5, () => {
      for (let t = 0; t < 20; t++) {
        // a black seed (Ohuhu 120: its step is the ramp's darkest, where paletteOpts had put the locked accent)
        E(
          `state.harmony = 'neutral'; state.palSize = 5; state.seed = mkey(0); state.palettes = []; state.palH = []; state.locked = []`,
        );
        const r = J(
          a,
          `(() => { const p = genPalette(5, 'neutral', paletteOpts()); state.palettes.push(p); state.palH.push('neutral');
           const acc = p[0]; state.locked = [acc];
           const o = paletteOpts(), p2 = genPalette(5, 'neutral', o);
           return { acc, opts: o.locked, p2, C: p2.map((i) => LCH[i][1]) }; })()`,
        );
        assert.equal(r.opts[4], r.acc, 'paletteOpts puts the locked accent in the last free slot');
        assert.ok(r.p2.includes(r.acc), 'the locked accent is kept: ' + JSON.stringify(r));
        assert.equal(r.p2[0], r.acc, 'at the accent’s slot');
        assert.ok(r.p2.includes(0), 'the seed is in the palette');
        assert.equal(r.C.filter((c) => c >= GREY_C).length, 1, 'one clear colour: ' + r.C.map(Math.round));
        assert.equal(new Set(r.p2).size, 5);
      }
    });
  });
  test('v319 Y3-1: a grey locked at the seed’s own step moves to the nearest free step; two locks, both kept', () => {
    const a = appWith(H320),
      E = a.__eval;
    withSeed(8, () => {
      for (let t = 0; t < 12; t++) {
        E(
          `state.harmony = 'neutral'; state.palSize = 6; state.seed = mkey(0); state.palettes = []; state.palH = []; state.locked = []`,
        );
        const r = J(
          a,
          `(() => { const p = genPalette(6, 'neutral', paletteOpts()); state.palettes.push(p); state.palH.push('neutral');
           const acc = p[0], g = p[5] === 0 ? p[4] : p[5]; state.locked = [acc, g];
           const o = paletteOpts(), p2 = genPalette(6, 'neutral', o);
           return { acc, g, p2 }; })()`,
        );
        assert.ok(
          r.p2.includes(r.acc) && r.p2.includes(r.g) && r.p2.includes(0),
          'all kept: ' + JSON.stringify(r),
        );
        assert.equal(r.p2[0], r.acc);
        assert.equal(new Set(r.p2).size, 6);
      }
    });
  });
  test('v319 Y3-2: Include › Greys & black off: Greys + accent is unavailable with that reason, and every near-grey is kept out', () => {
    const { a, core, sv } = guideWith(H320);
    sv.gradIncl = {};
    assert.equal(core.grad.inclOn(sv.gradIncl, sv.emphasis).greys, false, 'off by default');
    assert.equal(core.genNeutralWhy(), 'Needs Include › Greys & black on');
    // (v319, Ben's choice) the option itself is greyed only for a real shortage: the chip alone doesn't grey it
    assert.equal(core.genNeutralChipOff(), true);
    assert.equal(core.genNeutralShort(), null, 'with the greys on it could be made');
    // the exclusions hold the generator's greys (chroma under GREY_C), whatever their family: so the two agree
    const ex = core.inclExclude();
    const nearGreys = J(a, 'COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] < GREY_C)');
    for (const i of nearGreys) assert.ok(ex.has(i), 'near-grey ' + i + ' kept out');
    assert.equal(
      a.__eval(`neutralWhy()`),
      null,
      'the generator alone would make it (greys among the markers)',
    );
    // greys on: available; browns off changes nothing for it
    sv.gradIncl = { greys: true, browns: false };
    assert.equal(core.genNeutralWhy(), null);
    assert.equal(core.genNeutralChipOff(), false);
    // every group on: no near-grey kept out (an Earth-family one goes with the browns)
    sv.gradIncl = { greys: true, browns: true, fluor: true };
    assert.equal(core.inclExclude(), null);
    // a guide from before the Include row (gradIncl null): the generator's own test only
    sv.gradIncl = null;
    assert.equal(core.genNeutralWhy(), null);
    // too few greys with the chip on: the generator's reason, as before
    const c = guideWith('Ciao 36 - Set A');
    c.sv.gradIncl = { greys: true };
    assert.equal(c.core.genNeutralWhy(), 'Needs 3 greys among your markers');
  });
  test('v319 Y3-3: the fallback is per call: genHarmony stays Greys + accent, the note returns each time, and the scheme comes back with the greys', () => {
    const { a, core, sv } = guideWith(H320);
    sv.gradIncl = {};
    core.genHarmony = 'neutral';
    withSeed(2, () => {
      core.generatePalette();
      assert.equal(core.genHarmony, 'neutral', 'the chosen scheme is kept');
      assert.equal(core.genFell, true);
      assert.equal(core.genHarmUsed(), 'accent', 'made as Analogous + accent');
      assert.equal(
        core.genNote,
        'Greys + accent needs Include › Greys & black on: Analogous + accent instead',
      );
      let pal = [...sv.genPal];
      assert.ok(pal.length >= 3 && greysIn(a, pal) === 0, 'no grey: ' + pal);
      // a second regeneration: the note again (it had been lost with genHarmony set to 'accent' for good)
      core.generatePalette(true);
      assert.equal(core.genHarmony, 'neutral');
      assert.match(core.genNote, /Analogous \+ accent instead$/);
      // the greys back on: nothing made yet says what the palette is; the next call makes Greys + accent, no note
      sv.gradIncl = { greys: true };
      assert.equal(core.genHarmUsed(), 'accent', 'the palette on the card is still the fallback’s');
      core.generatePalette();
      assert.equal(core.genHarmony, 'neutral');
      assert.equal(core.genFell, false);
      assert.equal(core.genHarmUsed(), 'neutral');
      assert.equal(core.genNote, '');
      pal = [...sv.genPal];
      assert.equal(greysIn(a, pal), pal.length - 1, 'a clear accent and greys: ' + pal);
      // another scheme is never touched by any of it
      core.genHarmony = 'analogous';
      core.generatePalette();
      assert.equal(core.genNote, '');
      assert.equal(core.genHarmUsed(), 'analogous');
    });
  });
}
