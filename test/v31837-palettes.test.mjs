// (v318.37) Palette fixes from Fable's X3 review: a locked colour keeps its place under Analogous + accent and Light
// to shadow (paletteOpts knows their slots' hue offsets, X3-1); Greys + accent started from a grey puts the grey on
// its ramp and finds a clear accent, or says it has none (X3-2, X3-5); Random's Remove/Clear Undo only while the pile
// is as the removal left it (X3-3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    const rep = J(a, `(() => { const report = {}; genPalette(5, 'neutral', { report }); return report; })()`);
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
