// v298 fixes outside the browser: re-rolling a colour stays on its scheme; the scheme check is exact; the Colorless
// Blender is never picked as a colour; a saved time that isn't one is dropped; the note about lost data is kept even
// when the copy takes the last of the room; and what Scan reads: a colour name another code accounts for, and a list's
// every line.
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

test('re-rolling one colour again and again keeps it on the palette’s scheme', () => {
  const a = appWith(S320), E = a.__eval;
  withSeed(3, () => {
    for (const h of ['complementary', 'triadic', 'tetradic', 'split']) {
      let off = 0, tries = 0;
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
    E(`(() => { const C = LCH.map((l, i) => [l, i]).filter(([l]) => l[1] >= 25); for (const [a, i] of C) for (const [b, j] of C) { const s = (b[2] - a[2] + 360) % 360; if (s > ${lo} && s < ${hi}) return [i, j]; } return null; })()`);
  const inside = pair(119.6, 120),
    past = pair(120.05, 120.45);
  assert.ok(inside && past, 'pairs to try');
  assert.equal(E('palOnScheme')([...inside], 'analogous', new Set()), true);
  assert.equal(E('palOnScheme')([...past], 'analogous', new Set()), false);
  // Complementary: two colours exactly opposite, and 30° either side of opposite, are on it; 61° off isn't
  const comp = (d) =>
    E(`(() => { const C = LCH.map((l, i) => [l, i]).filter(([l]) => l[1] >= 25); for (const [a, i] of C) for (const [b, j] of C) { const s = hueDist(a[2], b[2] + 180); if (Math.abs(s - ${d}) < 0.5) return [i, j]; } return null; })()`);
  assert.equal(E('palOnScheme')([...comp(0)], 'complementary', new Set()), true);
  assert.equal(E('palOnScheme')([...comp(59.6)], 'complementary', new Set()), true);
  assert.equal(E('palOnScheme')([...comp(61)], 'complementary', new Set()), false);
});

test('the Colorless Blender can be owned but is never picked as a colour', () => {
  const a = appWith(null), E = a.__eval;
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
  const raw = JSON.stringify({ ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: ['Ohuhu|R14'], saved: [{ id: 'oops', type: 'guide', name: 'x', keys: [] }] });
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

const C = app.__eval('COLORS');
const nm = (i) => C[i].brand + ' ' + C[i].code;
const idx = (brand, code) => C.findIndex((c) => c.brand === brand && c.code === code);

test('two caps in view and one of their names: both codes, no question (the name is the other cap’s)', () => {
  const r = app.scanRead('YG06 YG07 Sugarcane', 'Ohuhu');
  assert.deepEqual([...r.codes].map((c) => [...c.opts].map(nm)), [['Ohuhu YG06'], ['Ohuhu YG07']]);
  assert.deepEqual([...r.codes].map((c) => c.asked), ['', '']);
  // a single misread code with another marker's name is still asked about
  const q = app.scanRead('YG07 Sugarcane', 'Ohuhu');
  assert.equal(q.codes[0].asked, 'name');
});

test('a pasted list: one entry per marker (the same code of two brands is two), and a line with only a name, another brand’s code or a code upside down becomes a question', () => {
  const r = app.scanRead('B04 Copic\nB04 Ohuhu\nB04 Copic', '');
  assert.deepEqual([...r.codes].map((c) => [...c.opts].map(nm)), [['Copic B04'], ['Ohuhu B04']]);
  const s = app.scanRead('YG06\nHoneydew Melon\nYG11', 'Ohuhu');
  assert.deepEqual([...s.codes].map((c) => [...c.opts].map(nm)), [['Ohuhu YG06']]);
  assert.deepEqual([...s.names].map(nm), ['Ohuhu YG07']);
  assert.deepEqual([...s.other].map(nm), ['Copic YG11']);
  assert.equal(s.many, true);
  // "6L3" is E19 upside down
  const t = app.scanRead('YG06\n6L3', 'Ohuhu');
  assert.ok(t.flips.length === 1 && [...t.flips[0].opts].includes(idx('Ohuhu', 'E19')));
});
