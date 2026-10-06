// v308 Markers: Unowned's orders follow Brands I'd buy (your brands first, another only for a colour yours don't have;
// no fluorescents or blender in the gaps and families to finish), Copic's fluorescent cap codes, Ohuhu's BGY and YGY
// greys as "Blue Grey" and "Yellow Grey" with the greys (saved filters follow), Owned's "Running low", a search that's a
// list of codes, and Scan's lines it couldn't read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3';
const fresh = (st) => {
  const a = createApp({ localStorage: memoryStorage(st ? { [KEY]: JSON.stringify(st) } : {}) });
  a.__eval(
    `state.mode = 'collection'; state.collView = 'unowned'; state.finderScope = 'all'; state.pool = null; poolSet = null; searchStr = ''; state.ink = {};`,
  );
  return a.__eval;
};
const J = (E, s) => JSON.parse(E('JSON.stringify(' + s + ')'));
// Honolulu 24 and 48: an Ohuhu-only collection
const OHUHU_ONLY =
  'state.owned = new Set([...presetMkeys(MARKER_SETS[0]), ...presetMkeys(MARKER_SETS[1])]); state.buyBrands = null;';
const unowned = 'finderMatches()';

test('Unowned › Fill the biggest gaps: your brands first, another brand only after them and only for a colour yours don’t have', () => {
  const E = fresh();
  E(OHUHU_ONLY);
  const g = J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`);
  const firstCopic = g.indexOf('Copic');
  assert.ok(firstCopic > 0, 'Ohuhu first');
  assert.ok(
    g.slice(firstCopic).every((b) => b === 'Copic'),
    'Copic only after every Ohuhu',
  );
  assert.ok(
    g.filter((b) => b === 'Copic').length < 80,
    'and only some: ' + g.filter((b) => b === 'Copic').length,
  );
  // each Copic one listed has no Ohuhu marker within BUY_OTHER_DE
  const far = J(
    E,
    `gapRank(${unowned}).filter((i) => COLORS[i].brand === 'Copic').map((i) => Math.min(...COLORS.map((c, j) => j).filter((j) => COLORS[j].brand === 'Ohuhu' && !NOINK.has(j)).map((j) => de2000(LAB[i], LAB[j]))))`,
  );
  assert.ok(
    far.every((d) => d >= E('BUY_OTHER_DE')),
    'a colour Ohuhu doesn’t have',
  );
  // Brands I'd buy ticked: only those
  E(`state.buyBrands = ['Ohuhu']`);
  assert.deepEqual([...new Set(J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`))], ['Ohuhu']);
  E(`state.buyBrands = ['Copic']`);
  assert.deepEqual(
    [...new Set(J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`))],
    ['Copic'],
    'Copic only, though you own none',
  );
});

test('Unowned: no fluorescents or Colorless Blender in Fill the biggest gaps or Finish families (unless the filters leave only those)', () => {
  const E = fresh();
  E('state.owned = new Set([...defaultOwned()]); state.buyBrands = null;');
  const g = J(E, `gapRank(${unowned}).map((i) => COLORS[i].fam + (NOINK.has(i) ? ' blender' : ''))`);
  assert.ok(g.length > 100);
  assert.deepEqual(
    g.filter((f) => /Fluorescent|blender/.test(f)),
    [],
  );
  const fams = J(E, `completeGroups(${unowned}).map((g) => g.fam)`);
  assert.ok(!fams.includes('Fluorescent'), fams.join(', '));
  assert.ok(!J(E, `completeGroups(${unowned}).some((g) => g.un.some((i) => NOINK.has(i)))`), 'no blender');
  // a filter to the fluorescents alone: they're what's asked for
  E(`state.excluded = new Set(families.map((f) => f.name).filter((n) => n !== 'Fluorescent'))`);
  assert.ok(J(E, `gapRank(${unowned}).length`) > 0);
});

test('Unowned › Finish families counts a family in your brands; Ramp gaps puts your brands first', () => {
  const E = fresh();
  E(OHUHU_ONLY);
  const g = J(
    E,
    `completeGroups(${unowned}).map((g) => ({ fam: g.fam, total: g.total, brands: [...new Set(g.un.map((i) => COLORS[i].brand))] }))`,
  );
  assert.ok(
    g.every((x) => x.brands.join() === 'Ohuhu'),
    'only Ohuhu to finish',
  );
  const ohuhuGreen = E(`COLORS.filter((c) => c.brand === 'Ohuhu' && c.fam === 'Green').length`);
  assert.equal(g.find((x) => x.fam === 'Green').total, ohuhuGreen, 'Green counted in Ohuhu');
  const r = J(E, `rampRank(${unowned}).map((i) => COLORS[i].brand)`);
  const c = r.indexOf('Copic');
  assert.ok(c < 0 || r.slice(c).every((b) => b === 'Copic'), 'Ohuhu ramps first');
  // Ben's two brands: both are yours, and the order is as before apart from fluorescents and the blender
  E('state.owned = new Set([...defaultOwned()])');
  assert.ok(J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`).slice(0, 30).includes('Copic'));
});

test('Copic fluorescents are found by the codes on their caps (FB2, FBG2, FRV1, FV2, FY1, FYG1, FYG2, FYR1)', () => {
  const E = fresh();
  const cap = {
    FB2: 'FB',
    FBG2: 'FBG',
    FRV1: 'FRV',
    FV2: 'FV',
    FY1: 'FY',
    FYG1: 'FYG',
    FYG2: 'FG',
    FYR1: 'FYR',
  };
  for (const [old, now] of Object.entries(cap)) {
    assert.equal(E(`knownMkey('Copic|${old}')`), 'Copic|' + now, old);
    E(`state.collView = 'all'; searchStr = ${JSON.stringify(old.toLowerCase())}`);
    assert.ok(
      J(E, 'finderMatches().map((i) => COLORS[i].brand + "|" + COLORS[i].code)').includes('Copic|' + now),
      'search ' + old,
    );
    assert.deepEqual(
      J(E, `scanRead(${JSON.stringify(old)}, 'Copic').codes.map((c) => c.opts.map((i) => COLORS[i].code))`),
      [[now]],
      'Scan ' + old,
    );
  }
  // a current code is still itself: FYG is Fluorescent Yellow Green, FYG2 is Fluorescent Green
  assert.equal(E(`knownMkey('Copic|FYG')`), 'Copic|FYG');
});

test('Ohuhu’s BGY and YGY greys are Blue Grey and Yellow Grey, listed with the greys; a saved filter follows them', () => {
  const E = fresh();
  assert.deepEqual(
    [...new Set(J(E, `COLORS.filter((c) => /^(BGY|YGY)/.test(c.code)).map((c) => c.fam)`))].sort(),
    ['Blue Grey', 'Yellow Grey'],
  );
  const order = J(E, 'families.map((f) => f.name)');
  const greys = order.slice(order.indexOf('Warm Grey'), order.indexOf('Green Grey') + 1);
  assert.ok(greys.includes('Blue Grey') && greys.includes('Yellow Grey'), order.join(', '));
  assert.ok(order.indexOf('Yellow-Green') === order.indexOf('Yellow') + 1, 'not between the colours');
  assert.ok(E(`WARM_FAMS.has('Yellow Grey') && COOL_FAMS.has('Blue Grey')`));
  // a filter saved before v308 leaving them out still leaves them out
  const E2 = fresh({
    mode: 'home',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: ['Ohuhu|R014'],
    saved: [],
    excluded: ['Blue-Green-Yellow', 'Yellow-Green-Yellow', 'Red'],
  });
  assert.deepEqual(J(E2, '[...state.excluded].sort()'), ['Blue Grey', 'Red', 'Yellow Grey']);
  assert.equal(E2(`passes(COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'BGY24'))`), false);
});

test('Owned › Running low: only the markers you marked running low or dry', () => {
  const E = fresh();
  E(
    `state.owned = new Set(['Ohuhu|R014', 'Ohuhu|B08', 'Ohuhu|Y111']); state.ink = { 'Ohuhu|B08': 'low', 'Ohuhu|Y111': 'dry', 'Copic|E09': 'low' }; state.collView = 'owned'`,
  );
  assert.deepEqual(J(E, 'lowCount()'), { n: 2, dry: 1 }, 'yours only');
  assert.equal(J(E, 'finderMatches()').length, 3);
  E('lowOnly = true');
  assert.deepEqual(J(E, 'finderMatches().map((i) => COLORS[i].code)').sort(), ['B08', 'Y111']);
  E(`state.collView = 'all'`);
  assert.ok(J(E, 'finderMatches()').length > 3, 'only in Owned');
});

test('a search that is a list of codes points to Scan or type codes', () => {
  const E = fresh();
  for (const q of ['b02, b03', 'B02 B03 R014', 'c-3; c-5', 'fb2 / fy1'])
    assert.equal(E(`searchList(${JSON.stringify(q)})`), true, q);
  for (const q of ['b02', 'cool grey 3', 'red pink', 'b02 sugar'])
    assert.equal(E(`searchList(${JSON.stringify(q)})`), false, q);
});

test('Scan: a pasted line with nothing to read in it is counted, not dropped without a word', () => {
  const E = fresh();
  const r = J(
    E,
    `(() => { const r = scanRead('B02\\nfoo bar\\nR014\\n?? !!', ''); return { codes: r.codes.length, unread: r.unread }; })()`,
  );
  assert.deepEqual(r, { codes: 2, unread: 2 });
});
