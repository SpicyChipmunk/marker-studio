// v318.18: the themes are their own setting (theme), under Lean towards (Any, Cool, Warm): twelve, in the grid's order,
// tuned on the Ohuhu and Copic sets; with Cool or Warm the theme is taken from that temperature's markers (its strip
// too, greyed where next to none are). A v318.17 guide's theme (in palette) opens as the theme. Fails on v318.17.
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
const codes = (list) => new Set(list.map((m) => m.code));

test('twelve themes, in the grid’s order (Twilight never beside Winter or Blossom, 3 or 4 across)', () => {
  const t = createApp().__mstest,
    K = [...t.THEME_KEYS];
  assert.deepEqual(K, [
    'blossom',
    'tropical',
    'autumn',
    'winter',
    'sunset',
    'desert',
    'forest',
    'ocean',
    'coral',
    'berry',
    'galaxy',
    'twilight',
  ]);
  for (const cols of [3, 4]) {
    const at = (k) => K.indexOf(k),
      near = (a, b) => {
        const i = at(a),
          j = at(b),
          ri = Math.floor(i / cols),
          rj = Math.floor(j / cols),
          ci = i % cols,
          cj = j % cols;
        return Math.abs(ri - rj) + Math.abs(ci - cj) === 1;
      };
    for (const k of ['winter', 'blossom']) assert.equal(near('twilight', k), false, `${cols} across: ${k}`);
  }
});

test('the theme saved: only when there is one; a v318.17 guide’s palette theme opens as the theme (Candy as Blossom)', () => {
  const t = createApp().__mstest,
    f = [...t.styleFields].find((x) => x.key === 'theme'),
    p = [...t.styleFields].find((x) => x.key === 'palette');
  assert.equal(f.def, '');
  for (const k of t.THEME_KEYS) assert.equal(f.check(k, f.def, {}), k);
  assert.equal(f.check('candy', f.def, {}), '', 'a theme that never was');
  assert.equal(f.check(undefined, f.def), '', 'no file to read from');
  assert.equal(f.check(undefined, f.def, { palette: 'forest' }), 'forest');
  assert.equal(f.check(undefined, f.def, { palette: 'sunset' }), 'sunset');
  assert.equal(f.check(undefined, f.def, { palette: 'candy' }), 'blossom');
  assert.equal(f.check(undefined, f.def, { palette: 'warm' }), '');
  assert.equal(p.check('forest', p.def, { palette: 'forest' }), 'all', 'the temperature: Any');
  // (a saved theme wins over a palette an odd file has too)
  assert.equal(f.check('ocean', f.def, { palette: 'sunset' }), 'ocean');
  // written only when chosen, so a guide without one is saved as before
  t.styleVars.theme = '';
  assert.equal(f.save(), undefined);
  t.styleVars.theme = 'coral';
  assert.equal(f.save(), 'coral');
  // a zone's own, read the same way
  const z = t.zoneStOpen({ family: 'random', palette: 'candy' });
  assert.deepEqual([z.palette, z.theme], ['all', 'blossom']);
  assert.equal(t.zoneStOpen({ palette: 'cool', theme: 'winter' }).theme, 'winter');
});

test('each theme finds its own colours in the big sets, and is widened to 8 in a small one', () => {
  const MIN_IN = { 'Honolulu 120': 10, 'Honolulu 320 (complete set)': 27, 'All Copic markers': 17 };
  for (const set of Object.keys(MIN_IN)) {
    const { t } = appWith([set]);
    for (const k of t.THEME_KEYS) {
      const e = t.themeEntry('all', k);
      assert.ok(e.wide.inside >= MIN_IN[set], `${set} ${k}: ${e.wide.inside} inside`);
      assert.equal(e.wide.added, 0, `${set} ${k}: none added`);
    }
  }
  const { t } = appWith(['Honolulu 48']);
  for (const k of t.THEME_KEYS) {
    const e = t.themeEntry('all', k);
    assert.ok(e.items.length >= 8, `Honolulu 48 ${k}: ${e.items.length}`);
    assert.ok(e.wide.inside >= 4, `Honolulu 48 ${k}: ${e.wide.inside} inside`);
  }
});

test('the tuning holds: no lemons in Forest, no royal blues in Sunset (its violets by fit), Ocean has them', () => {
  const { t } = appWith(['All Copic markers']),
    forest = codes(t.colour.poolFor('all', 'forest')),
    sunset = codes(t.colour.poolFor('all', 'sunset')),
    ocean = codes(t.colour.poolFor('all', 'ocean'));
  for (const c of ['Y06', 'Y02', 'Y13']) assert.ok(!forest.has(c), 'Forest ' + c);
  for (const c of ['B18', 'B28', 'B29']) {
    assert.ok(!sunset.has(c), 'Sunset ' + c);
    assert.ok(ocean.has(c), 'Ocean ' + c);
  }
  // (Winter's silver is its extra: at most a third as many as its blues and lilacs)
  const w = t.themeSplit(t.poolBase('all'), 'winter');
  const pool = t.colour.poolFor('all', 'winter'),
    grey = pool.filter((m) => w.extra.some((p) => p[1] === m)).length;
  assert.ok(grey > 0 && grey <= Math.max(2, Math.floor(w.inside.length / 3)), `silver ${grey}`);
});

test('with Cool or Warm: the theme from that temperature, widened within it; a one-sided theme greyed', () => {
  const { t } = appWith(['Honolulu 120']);
  const warm = new Set(t.poolBase('warm'));
  for (const k of t.THEME_KEYS) {
    const pool = t.colour.poolFor('warm', k);
    assert.ok(pool.length >= 8, k);
    assert.ok(
      pool.every((m) => warm.has(m)),
      k + ': warm markers only',
    );
  }
  t.styleVars.palette = 'warm';
  assert.equal(t.themeStrip('ocean').off, true, 'Ocean has next to no warm colours');
  assert.equal(t.themeStrip('sunset').off, false);
  t.styleVars.palette = 'all';
  assert.ok(
    t.THEME_KEYS.every((k) => !t.themeStrip(k).off),
    'under Any nothing is greyed',
  );
  // the note names the temperature when it narrows the theme
  const k = t.THEME_KEYS.find((x) => t.themeEntry('warm', x).wide.added > 0);
  assert.ok(k, 'a theme widened under Warm');
  Object.assign(t.styleVars, { palette: 'warm', theme: k });
  assert.match(
    t.themeNote(),
    new RegExp(`^(Few|No) warm ${k} colours in your markers: the nearest \\d+ (added|used)\\.$`),
  );
});

test('a theme’s strip: hard stops of its own colours, at most 24, none from the widened ones', () => {
  const { t } = appWith(['All Copic markers']);
  for (const k of t.THEME_KEYS) {
    const s = t.themeStrip(k),
      stops = s.css.match(/#[0-9a-f]{6}/gi) || [];
    assert.match(s.css, /^linear-gradient\(90deg,/, k);
    assert.ok(stops.length >= 2 && stops.length <= 24, `${k}: ${stops.length}`);
  }
  const small = appWith(['Honolulu 48']).t,
    e = small.themeEntry('all', 'desert'),
    s = small.themeStrip('desert');
  assert.ok(e.wide.added > 0, 'Desert is widened on the 48');
  assert.ok(
    (s.css.match(/#[0-9a-f]{6}/gi) || []).length < e.items.length,
    'the strip shows its own colours only',
  );
});

test('Random’s Main colour Auto names the theme and temperature, with the right article', () => {
  const { t } = appWith(['Honolulu 120']);
  Object.assign(t.styleVars, { palette: 'all', theme: 'ocean' });
  assert.equal(t.balAutoSub(false), 'an ocean colour, from the theme');
  Object.assign(t.styleVars, { palette: 'warm', theme: 'sunset' });
  assert.equal(t.balAutoSub(false), 'a warm sunset colour, as Lean towards and Theme say');
  assert.equal(
    t.balAutoSub(true),
    'a sunset colour, from the theme',
    'a colour chosen by hand: the theme still holds',
  );
  Object.assign(t.styleVars, { palette: 'cool', theme: '' });
  assert.equal(t.balAutoSub(false), 'a cool colour, as Lean towards says');
  t.styleVars.palette = 'all';
  assert.equal(t.balAutoSub(false), 'chosen for you');
});
