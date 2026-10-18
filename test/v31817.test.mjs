// v318.17: Shadows only per zone (a record's Highlights None: no H for its sections, the rest as they were; leaving the
// whole picture's Shadows only from one zone keeps the others and every coloured section as they are); Blender
// highlights (the Colorless Blender you own as the H, the base lifted, never a lighter marker to buy); themes in Lean
// towards (Sunset, Forest, Candy from your markers; v318.18: their own Theme, v31818, widened to the nearest when too few). Fails on v318.16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(sets) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  E('state.owned = new Set()');
  for (const n of sets)
    E(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
    );
  t.coll = E('sfCollection()');
  t.setCollection(t.coll);
  return { t, E };
}
const by = (t, code) => [...t.coll].find((m) => m.code === code);

test('Highlights None in a record: no highlight for its sections, others keep theirs', () => {
  const { t } = appWith(['Honolulu 120']);
  t.shadeMode = 'full';
  const zsS = { shadow: 'same', hilite: 'same', hi: 0.5, lo: 0.5, round: 0.5, on: true },
    // (a colour of the set with a lighter marker of its own)
    base = [...t.coll].find((m) => t.shadeTones(m, zsS).light && t.shadeTones(m, zsS).dark),
    on = t.shadeTones(base, zsS),
    off = t.shadeTones(base, { shadow: 'same', hilite: 'none', hi: 0.5, lo: 0.5, round: 0.5, on: true });
  assert.ok(on.light, 'a lighter marker with Same colour');
  assert.equal(off.light, null);
  assert.equal(off.noHi, true);
  assert.equal(off.wantLight, null, 'nothing to buy for a highlight that isn’t there');
  assert.equal(off.dark, on.dark, 'the shadow as before');
  assert.equal(t.hiOn({ hilite: 'none' }), false);
  assert.equal(t.hiOn({ hilite: 'same' }), true);
  t.shadeMode = 'shadow';
  assert.equal(t.hiOn({ hilite: 'same' }), false, 'the whole picture’s Shadows only, as before');
});

test('leaving whole-picture Shadows only from one zone: the other zones and Main None', () => {
  const t = createApp().__mstest;
  t.W = 10;
  t.H = 10;
  t.zoneOpen(
    [
      { name: 'Bell', secs: [1] },
      { name: 'Foot', secs: [2] },
    ],
    { 1: 11, 2: 12 },
  );
  const [a, b] = Array.from(t.zones, (z) => z.id);
  t.zshSet(a, 'hilite', 'same');
  t.shZonesNone(a);
  assert.equal(t.zsh(a).hilite, 'same', 'the chosen zone as it was');
  assert.equal(t.zsh(b).hilite, 'none');
  assert.equal(t.zsh(0).hilite, 'none', 'Main too');
});

test('a section coloured under Shadows only is held as None; with shading off, as before', () => {
  const t = createApp().__mstest;
  t.W = 10;
  t.H = 10;
  t.colored = new Uint8Array(20);
  t.colored[5] = 1;
  t.colored[6] = 1;
  t.shadeMode = 'shadow';
  t.zshOf(5);
  assert.equal(t.heldSh[5].hilite, 'none', 'coloured without a highlight');
  t.shadeMode = 'off';
  t.zshOf(6);
  assert.equal(t.heldSh[6].hilite, 'same', 'shading off: the kind as it is');
  // highlights on after: the one held as None stays without
  t.shadeMode = 'full';
  assert.equal(t.hiOn(t.zshOf(5)), false);
  assert.equal(t.hiOn(t.zshOf(6)), true);
});

test('the last zone deleted with Main’s Highlights None: the whole picture is Shadows only, as it’s saved', () => {
  const t = createApp().__mstest;
  t.W = 10;
  t.H = 10;
  t.zoneOpen([{ name: 'Bell', secs: [1] }], { 1: 11 });
  t.shadeMode = 'full';
  t.zshSet(0, 'hilite', 'none');
  t.zoneDelete(t.zones[0].id);
  assert.equal(t.zones.length, 0);
  assert.equal(t.shadeMode, 'shadow');
  assert.equal(t.zsh(0).hilite, 'same');
});

test('Blender: the Colorless Blender you own is the H (its own brand’s), the base lifted; no lighter marker to buy', () => {
  const { t } = appWith(['Honolulu 120']);
  t.shadeMode = 'full';
  const base = by(t, 'R16') || t.coll[40],
    zs = { shadow: 'same', hilite: 'blender', hi: 0.5, lo: 0.5, round: 0.5, on: true },
    b = t.shadeTones(base, zs);
  assert.ok(b.light, 'the blender');
  assert.equal(b.blender, true);
  assert.match(b.light.name, /colou?rless blender/i);
  assert.equal(b.light.brand, base.brand);
  assert.equal(b.wantLight, null);
  // lighter than the base, not white
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
    sum = (c) => c[0] + c[1] + c[2];
  assert.ok(sum(hx(b.light.hex)) > sum(hx(base.hex)), b.light.hex + ' over ' + base.hex);
  assert.notEqual(b.light.hex.toLowerCase(), '#ffffff');
  // a smaller lit part, as the paper's
  const same = t.shadeTones(base, { ...zs, hilite: 'same' });
  assert.ok(b.T2 < same.T2);
});

test('the highlight kinds saved: blender and none are values; an older value still reads', () => {
  const t = createApp().__mstest,
    f = [...t.styleFields].find((x) => x.key === 'hilite' && x.in === 'shade');
  for (const v of ['same', 'warm', 'paper', 'blender', 'none']) assert.equal(f.check(v, f.def), v);
  assert.equal(f.check('glitter', f.def), 'same');
  // (v318.18: the themes are their own setting, theme; palette is Any, Cool or Warm again: see v31818)
  const p = [...t.styleFields].find((x) => x.key === 'palette');
  for (const v of ['all', 'cool', 'warm']) assert.equal(p.check(v, p.def), v);
  assert.equal(p.check('sunset', p.def), 'all');
});

test('themes: each finds its own colours in a full set, and widens to the nearest in a small one, saying so', () => {
  for (const set of ['Honolulu 320 (complete set)', 'Honolulu 120', 'All Copic markers']) {
    const { t } = appWith([set]);
    for (const k of ['sunset', 'forest', 'blossom']) {
      const pool = [...t.colour.poolFor('all', k)],
        w = t.themeEntry('all', k).wide;
      assert.ok(pool.length >= 8, `${set} ${k}: ${pool.length}`);
      assert.ok(w.inside >= 6, `${set} ${k}: ${w.inside} inside`);
    }
  }
  const { t } = appWith(['Honolulu 24']);
  const pool = [...t.colour.poolFor('all', 'blossom')];
  assert.ok(pool.length >= 8, 'widened to 8: ' + pool.length);
  assert.ok(t.themeEntry('all', 'blossom').wide.added > 0);
  t.styleVars.theme = 'blossom';
  assert.match(t.themeNote(), /^(Few|No) blossom colours in your markers: the nearest \d+ (added|used)\.$/);
});
