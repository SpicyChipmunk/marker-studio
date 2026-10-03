// v304 (Markers): the search ignores hyphens, dots and spaces in codes, folds grey/gray and colour/color and curly
// punctuation, finds a brand from four letters and a code from its start (a number alone after the code's letters, a
// whole number among other words), and puts the code searched for first under "Best match", markers that once had it
// under "Old code"; the slot picker uses the same search. Tick all shown, Untick all shown, Copy codes and Palette from
// these act on what the grid shows (Ramp gaps shows only some of the matches); the Colorless Blender isn't a gap to
// fill, and owning one doesn't cover white; back in Custom the palette has its own size again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const fresh = () => {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval(`state.mode = 'finder'; state.finderScope = 'all'; state.owned = new Set(); state.pool = null; poolSet = null;`);
  return a;
};
// what a search finds, as 'C:C-3' (brand letter and code)
const find = (E, q) => JSON.parse(E(`searchStr = ${JSON.stringify(q)}; JSON.stringify(finderMatches().map((i) => COLORS[i].brand[0] + ':' + COLORS[i].code))`));
const idx = (E, brand, code) => E(`COLORS.findIndex((c) => c.brand === ${JSON.stringify(brand)} && c.code === ${JSON.stringify(code)})`);

test('codes: hyphens, spaces and case don’t matter, and "copic b04" is Copic’s B04', () => {
  const { __eval: E } = fresh();
  for (const q of ['c3', 'c 3', 'c-3', 'C-3']) assert.ok(find(E, q.toLowerCase()).includes('C:C-3'), q);
  assert.deepEqual(find(E, 'copic b04'), ['C:B04']);
  assert.deepEqual(find(E, 'w3'), ['C:W-3']);
  // every marker's code, typed with or without its hyphen, finds it
  const miss = JSON.parse(E(`JSON.stringify(COLORS.map((c, i) => [c.code, i]).filter(([code, i]) => !['', '-'].every((h) => { searchStr = code.replace(/-/g, h).toLowerCase(); return finderMatches().includes(i); })).map(([c]) => c))`));
  assert.deepEqual(miss, []);
});

test('names: grey and gray, colour and color, curly apostrophes; the name as written still found while typing', () => {
  const { __eval: E } = fresh();
  const grey = find(E, 'grey'), gray = find(E, 'gray');
  assert.deepEqual(grey, gray);
  assert.ok(grey.some((x) => x.startsWith('C:')) && grey.some((x) => x.startsWith('O:')), 'both brands’ greys');
  assert.deepEqual(find(E, 'cool grey 3'), ['C:C-3']);
  assert.equal(find(E, 'warm grey').length, find(E, 'warm gray').length);
  assert.deepEqual(find(E, 'colourless').sort(), find(E, 'colorless').sort());
  assert.equal(find(E, 'colourless').length, 2);
  assert.ok(find(E, 'robin’s').length >= 1, 'a curly apostrophe');
  // (on the way to "grey", "gre" still has every marker named Grey)
  const named = JSON.parse(E(`JSON.stringify(COLORS.filter((c) => /grey/i.test(c.name)).map((c) => c.brand[0] + ':' + c.code))`));
  const gre = find(E, 'gre');
  assert.ok(named.length > 0 && named.every((x) => gre.includes(x)));
});

test('old codes: as printed, with Ⅱ typed as two l’s or II', () => {
  const { __eval: E } = fresh();
  const olds = JSON.parse(E(`JSON.stringify(COLORS.map((c, i) => [c.old, i]).filter(([o]) => o && /Ⅱ/.test(o)))`));
  assert.ok(olds.length > 0);
  for (const [o, i] of olds)
    for (const q of [o.replace(/Ⅱ/g, 'll'), o.replace(/Ⅱ/g, 'II'), o]) {
      E(`searchStr = ${JSON.stringify(q.toLowerCase())}`);
      assert.ok(JSON.parse(E('JSON.stringify(finderMatches())')).includes(i), q);
    }
});

test('brands from four letters; "cop" and "pi" don’t bring every Copic marker', () => {
  const { __eval: E } = fresh();
  const copic = E(`COLORS.filter((c) => c.brand === 'Copic').length`),
    ohuhu = E(`COLORS.filter((c) => c.brand === 'Ohuhu').length`);
  assert.equal(find(E, 'copi').length, copic);
  assert.equal(find(E, 'copic').length, copic);
  assert.equal(find(E, 'ohuh').length, ohuhu);
  assert.ok(find(E, 'cop').length < 20, 'cop: ' + find(E, 'cop').length);
  assert.ok(find(E, 'pi').length < 100, 'pi: ' + find(E, 'pi').length);
});

test('numbers: alone, after the code’s letters by their start; among other words, the whole number', () => {
  const { __eval: E } = fresh();
  const r22 = find(E, '22');
  for (const x of ['O:R22', 'C:R22', 'O:E22', 'C:V22']) assert.ok(r22.includes(x), x);
  const z = find(E, '000');
  assert.ok(z.includes('C:B000') && z.includes('C:B0000'));
  // "copic 0": the Copic markers whose number is 0 (C-0, W-0, the blender ...), not every one with a 0 after its letters
  const c0 = find(E, 'copic 0');
  assert.ok(c0.length > 0 && c0.length < 20 && c0.every((x) => x.startsWith('C:')), JSON.stringify(c0));
  assert.ok(c0.includes('C:C-0') && c0.includes('C:W-0'));
  assert.ok(find(E, 'c 3').length < 10, 'c 3: ' + find(E, 'c 3').length);
  // (codes that are all numbers, found as they're typed: "ohuhu 1", "ohuhu 12", "ohuhu 120")
  const o120 = idx(E, 'Ohuhu', '120');
  for (const q of ['ohuhu 1', 'ohuhu 12', 'ohuhu 120']) {
    E(`searchStr = ${JSON.stringify(q)}`);
    assert.ok(JSON.parse(E('JSON.stringify(finderMatches())')).includes(o120), q);
  }
});

test('"Best match": the code searched for first; a marker that once had it next, under "Old code"', () => {
  const { __eval: E } = fresh();
  const groups = (q) => JSON.parse(E(`searchStr = ${JSON.stringify(q)}; JSON.stringify(searchGroups(finderMatches()).map((g) => [g.f.name, g.list.map((i) => COLORS[i].brand[0] + ':' + COLORS[i].code)]))`));
  const g = groups('g410');
  assert.deepEqual(g[0], ['Best match', ['O:G410']]);
  assert.equal(g[1][0], 'Old code');
  const r = groups('r22');
  assert.deepEqual(r[0], ['Best match', ['O:R22', 'C:R22']]);
  // every code searched for comes first
  const notFirst = JSON.parse(E(`JSON.stringify(COLORS.filter((c) => { searchStr = c.code.toLowerCase(); const f = [].concat(...searchGroups(finderMatches()).map((g) => g.list))[0]; return COLORS[f].code !== c.code; }).map((c) => c.code))`));
  assert.deepEqual(notFirst, []);
  // a search that isn't a code has no Best match
  assert.notEqual(groups('pink')[0][0], 'Best match');
});

test('"isn’t in your collection" names the code searched for, not a marker whose old code it was', () => {
  const { __eval: E } = fresh();
  const html = E(`state.mode = 'collection'; state.collView = 'owned'; state.owned = new Set([mkey(${idx(E, 'Ohuhu', 'B08')})]); searchStr = 'g410'; searchElsewhereHTML(searchOutside())`);
  assert.match(html, /G410 isn’t in your collection/);
});

test('Copy codes and Palette from these follow the grid’s order: the Best match first, in Palette’s list too', () => {
  const { __eval: E } = fresh();
  E(`searchStr = 'g410'; renderResults()`);
  assert.deepEqual(JSON.parse(E('JSON.stringify(shownMatches().map((i) => COLORS[i].code))')), ['G410', 'G24']);
});

test('Ramp gaps: Tick all shown and the rest act on the gaps shown, not every unowned match', () => {
  const { __eval: E } = fresh();
  E(`state.mode = 'collection'; state.collView = 'unowned'; state.gapSort = 'ramps'; state.owned = new Set([...defaultOwned()]); searchStr = ''; renderResults()`);
  const shown = E('shownMatches().length'),
    ramps = E('rampRank(finderMatches()).length'),
    all = E('finderMatches().length');
  assert.equal(shown, ramps);
  assert.ok(shown < all, shown + ' of ' + all);
});

test('Fill gaps: the Colorless Blender comes last, and owning one doesn’t move the palest markers down', () => {
  const { __eval: E } = fresh();
  const rank = (ownBlender) =>
    JSON.parse(E(`state.owned = new Set([...defaultOwned()]); ${ownBlender ? `COLORS.forEach((c, i) => { if (NOINK.has(i) && c.brand === 'Copic') state.owned.add(mkey(i)); });` : ''} state.ink = {};
      (() => { const m = []; for (let i = 0; i < COLORS.length; i++) if (!isOwned(i) && passes(i)) m.push(i);
      const o = gapRank(m); return JSON.stringify({ blend: o.map((i, k) => [i, k]).filter(([i]) => NOINK.has(i)).map(([, k]) => k), n: o.length, top: o.slice(0, 20) }); })()`));
  const a = rank(false), b = rank(true);
  assert.ok(a.blend.every((k) => k >= a.n - 2), 'blenders last: ' + JSON.stringify(a.blend) + ' of ' + a.n);
  assert.deepEqual(b.top, a.top, 'an owned blender changes nothing at the top');
});

test('Custom: a scheme with fewer sizes and back keeps its markers; a smaller size chosen in Custom cuts them', () => {
  const { __eval: E } = fresh();
  E(`state.mode = 'home'; setHarmony('custom'); setSize(12); state.customPal = COLORS.slice(0, 12).map((c, i) => i * 10); save()`);
  E(`setHarmony('analogous'); setHarmony('custom')`);
  assert.equal(E('state.palSize'), 12);
  assert.equal(E('state.customPal.filter((x) => x != null).length'), 12);
  E(`setSize(4); ensureCustomSize(); setHarmony('complementary'); setHarmony('custom'); ensureCustomSize()`);
  assert.equal(E('state.palSize'), 4);
  assert.equal(E('state.customPal.length'), 4);
});

test('a code typed with a space is that code, not a letter in a name and a number at the end of another code', () => {
  const { __eval: E } = fresh();
  assert.deepEqual(find(E, 'c 3'), ['C:C-3']);
  assert.deepEqual(find(E, 'w 3'), ['C:W-3']);
  assert.ok(!find(E, 'r 22').some((x) => /V22$/.test(x)), 'not V22: ' + find(E, 'r 22').join());
  assert.ok(find(E, 'r 22').includes('C:R22') && find(E, 'r 22').includes('O:R22'));
  // (words that aren't a code stay words)
  assert.ok(find(E, 'gray no 3').includes('C:C-3'), find(E, 'gray no 3').join());
  assert.ok(find(E, 'cool grey 3').includes('C:C-3'));
});
