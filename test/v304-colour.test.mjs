// v304 (colour and palettes): the guide's Generate palette uses your markers, never a Finder selection left on the
// Palette screen; Palette › Photo's band taps go round the five nearest markers and back (they flipped between two);
// Tap the white paper never darkens a scan and takes a cream paper's cast away; greys that have to fill in a palette
// are kept apart; re-rolling a near-grey of an Analogous palette aims at the palette's middle; re-rolling on a small
// collection says nothing fits rather than leaving the scheme; a filter or base changed while a palette rolls is
// used once the roll ends; the palette screen's "can't" toasts say "clear the selection" when there are no filters
// to loosen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp, memoryStorage } from './harness.mjs';

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
  assert.equal(after.length, 1, 'made in its place, one step');
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
    /^Couldn’t make a 12-colour palette from the markers in play — try fewer colours or loosen the filters\.$/,
  );
  E(`setPool([...state.owned].map(keyIdx).slice(0, 6))`);
  E('regenReplace()');
  assert.match(last(), /or clear the selection\.$/);
  E('doGenerate()');
  assert.match(last(), /or clear the selection\.$/);
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
