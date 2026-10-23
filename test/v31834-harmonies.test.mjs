// (v318.34) Three harmonies on evenly stepped ramps (plan D; Fable P2-7, P2-8, E1-4): the ramp picked as a path
// (picker.js genPath) for Monochrome, Analogous, Light to shadow and the greys of Greys + accent; the three schemes'
// sizes and shapes on Honolulu 120 / 320 and a 36-Copic set; Greys + accent unavailable below 3 greys; the notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import { createApp, memoryStorage } from './harness.mjs';

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
  assert.equal(results.filter((r) => r.startsWith('H320') && /median/.test(r)).length, 4, results.join('; '));
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
      assert.doesNotMatch(E('__pc.textContent'), /greys/, 'its greys are its ramp: ' + E('__pc.textContent'));
    }
    // the report agrees
    const rep = J(a, `(() => { const report = {}; genPalette(5, 'neutral', { report }); return report; })()`);
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
