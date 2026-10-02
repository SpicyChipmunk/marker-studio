// v299 fixes outside the browser: re-rolling a colour of a hand-adjusted palette stays on its scheme; four blues aren't
// Complementary; a selection leaves out dry markers and the Colorless Blender; a draw from an edited backup opens; and
// what Scan reads: no codes glued together, the brand on the cap, a number-only code beside words on every cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage, app } from './harness.mjs';

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
  if (set) a.__eval(`presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`);
  return a;
}

test('re-rolling one colour of a palette that is on its scheme but not tightly (hand-adjusted) keeps it on the scheme', () => {
  const E = appWith(S320).__eval;
  // Triadic palettes of three clear colours, on the scheme but put together at random (not as the generator would):
  // re-rolling the third colour of many of them left the scheme on v298
  const clear = E('LCH.map((l, i) => i).filter((i) => inPool(i) && LCH[i][1] >= 30)');
  let off = 0, n = 0, pals = 0;
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
  const blues = E(`(() => { const out = []; LCH.forEach((l, i) => { if (inPool(i) && l[1] >= 25 && l[2] > 225 && l[2] < 275 && out.every((j) => de2000(LAB[i], LAB[j]) > 6)) out.push(i); }); return out.slice(0, 4); })()`);
  assert.equal(blues.length, 4);
  for (const h of ['complementary', 'triadic', 'tetradic', 'split']) assert.equal(E('palOnScheme')([...blues], h, new Set()), false, h);
  assert.equal(E('palOnScheme')([...blues], 'analogous', new Set()), true, 'Analogous, yes');
  withSeed(4, () => {
    for (const h of ['complementary', 'triadic', 'tetradic', 'split'])
      for (const n of [2, 3, 4, 6, 8]) for (let r = 0; r < 8; r++) {
        const p = E(`genPalette(${n}, '${h}', {})`);
        if (p) assert.equal(E('palOnScheme')([...p], h, new Set()), true, h + ' ' + n);
      }
  });
});

test('a selection ("Palette from these") leaves out markers marked dry and the Colorless Blender', () => {
  const a = appWith(S320), E = a.__eval;
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
  E(`loadDraw({ id: 9, type: 'draw', keys: ['Ohuhu|R14', 7], st: { pool: 'abc', brands: ['X'], tones: 5, sats: ['vivid', 'odd'] } })`);
  assert.ok(E('state.brands.size') > 0, 'not every brand filtered out');
  assert.equal(E(`state.brands.has('X')`), false);
  assert.deepEqual([...E('[...state.sats]')], ['vivid']);
  assert.equal(E('state.pool'), null);
});

const C = app.__eval('COLORS');
const nm = (i) => C[i].brand + ' ' + C[i].code;
const read = (t, b = '') => {
  const r = app.scanRead(t, b);
  return { codes: [...r.codes].map((c) => [[...c.opts].map(nm).join('/'), c.asked]), other: [...r.other].map(nm), flips: r.flips.length };
};

test('Scan: a stray digit beside a code isn’t glued onto it; a code in two pieces still is', () => {
  for (const [t, b] of [['E00 0', 'Copic'], ['B00 0', 'Copic'], ['BG21 1', 'Ohuhu'], ['E17 0', '']]) {
    const r = read(t, b);
    assert.ok(!r.codes.some(([o]) => /E000|B000|BG211|E58/.test(o)), t + ': ' + JSON.stringify(r));
  }
  // the bare digit beside a code is asked about, not added
  assert.deepEqual(read('E00 0', 'Copic').codes, [['Copic E00', ''], ['Copic 0', 'num']]);
  assert.deepEqual(read('C - 0').codes, [['Copic C-0', '']]);
  assert.deepEqual(read('YG 06', 'Ohuhu').codes, [['Ohuhu YG06', '']]);
  // a count column in a pasted list
  assert.deepEqual(read('BG21\t1\nYR11 (1)', 'Ohuhu').codes, [['Ohuhu BG21', ''], ['Ohuhu YR11', '']]);
});

test('Scan: the brand on the cap is heeded; words on every cap don’t hide a number-only code, nor make it a turned one', () => {
  assert.deepEqual(read('Ohuhu B04', 'Copic'), { codes: [], other: ['Ohuhu B04'], flips: 0 });
  assert.deepEqual(read('Honolulu B05', 'Copic').other, ['Ohuhu B05']);
  for (const t of ['Copic 0', 'Copic Sketch 100', 'Ohuhu 120', '120 Brush', 'No. 120']) {
    const r = read(t);
    assert.equal(r.codes.length, 1, t);
    assert.equal(r.flips, 0, t);
  }
  // a code the brand on the cap hasn't: asked
  assert.deepEqual(read('Ohuhu Alcohol Marker 0').codes, [['Copic 0', 'hint']]);
  // a name's own number isn't a code ("Cool Gray No.0")
  const c0 = C.find((c) => c.code === 'C-0');
  assert.deepEqual(read('C-0 ' + c0.name).codes, [['Copic C-0', '']]);
  // another brand's cap read along with one of the brand chosen: kept, to ask about
  const r = read('E19 C-3', 'Ohuhu');
  assert.deepEqual(r.codes, [['Ohuhu E19', '']]);
  assert.deepEqual(r.other, ['Copic C-3']);
});
