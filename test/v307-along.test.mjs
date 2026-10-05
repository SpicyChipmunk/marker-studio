// v307 (along): the find-by-code line names the zones when a code is a highlight in some zones and a shadow in
// others; the markers a shaded guide's highlights and shadows take besides its colours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// Ben's 451 markers as the guide's collection, and a guide whose sections (1, 2, …) take the markers given by key
function benApp() {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  E('state.owned = new Set([...defaultOwned()]); state.ink = {}; state.wish = [];');
  t.coll = E('sfCollection()');
  return { app, E, t };
}
function guideOf(t, keys) {
  const by = {};
  t.coll.forEach((m) => {
    by[m.mkey] = m;
  });
  const assign = {},
    order = [];
  keys.forEach((k, i) => {
    assert.ok(by[k], 'owned: ' + k);
    assign[i + 1] = by[k];
    order.push(i + 1);
  });
  t.comps = [null].concat(keys.map((k, i) => ({ area: 100 * (keys.length - i), cx: 0, cy: 0 })));
  t.assignData = { assign, order, N: order.length };
  return by;
}
// what codeFind gives for a code that's only a highlight or shadow here: the marker, the markers it's the highlight
// or shadow of, and the zones it's each in (zn)
function partOf(m, hi, sh, zh, zs) {
  const o = (ms) => Object.fromEntries(ms.map((x) => [x.mkey, x]));
  return { m, highlight: o(hi), shadow: o(sh), zn: { highlight: zh, shadow: zs } };
}
const found = (raw, part) => ({ q: raw, raw, base: [], part, pre: [], known: true });

test('find by code: a highlight in one zone and a shadow in another names the zones; the same zones, or no zones, don’t', () => {
  const { t } = benApp();
  const by = guideOf(t, ['Ohuhu|Y07', 'Ohuhu|Y07', 'Copic|R20', 'Copic|Y21']);
  const y06 = by['Ohuhu|Y06'] || { mkey: 'Ohuhu|Y06', code: 'Y06', brand: 'Ohuhu' },
    y07 = by['Ohuhu|Y07'],
    r20 = by['Copic|R20'];
  // no zones: as before
  let r = found('Y06', [partOf(y06, [y07], [y07, r20], { 0: 1 }, { 0: 1 })]);
  assert.equal(t.findLine(r), 'Y06: highlight for Y07 and shadow for Y07, R20');
  assert.equal(t.findPartLine(r), 'Y06 is a highlight for Y07 and a shadow for Y07, R20');
  // a zone: Wings holds sections 2 and 3
  t.zoneOpen([{ name: 'Wings', secs: [2, 3] }], { 1: 1, 2: 2, 3: 3, 4: 4 });
  const w = t.zones[0].id;
  assert.equal(t.zoneOf(2), w);
  r = found('Y06', [partOf(y06, [y07], [y07, r20], { 0: 1 }, { [w]: 1 })]);
  assert.equal(t.findLine(r), 'Y06: highlight in Main for Y07 and shadow in Wings for Y07, R20');
  assert.equal(t.findPartLine(r), 'Y06 is a highlight in Main for Y07 and a shadow in Wings for Y07, R20');
  // in both zones as a shadow: said as such
  r = found('Y06', [partOf(y06, [y07], [y07, r20], { 0: 1 }, { 0: 1, [w]: 1 })]);
  assert.equal(
    t.findPartLine(r),
    'Y06 is a highlight in Main for Y07 and a shadow in Main, Wings for Y07, R20',
  );
  // the same zones for both: no names
  r = found('Y06', [partOf(y06, [y07], [r20], { 0: 1, [w]: 1 }, { 0: 1, [w]: 1 })]);
  assert.equal(t.findPartLine(r), 'Y06 is a highlight for Y07 and a shadow for R20');
  // one kind only: no names
  r = found('Y06', [partOf(y06, [y07], [], { 0: 1 }, {})]);
  assert.equal(t.findLine(r), 'Y06: highlight for Y07');
  // both brands of the code: each brand's part, the zones where they differ
  const cy06 = { mkey: 'Copic|Y06', code: 'Y06', brand: 'Copic' };
  r = found('Y06', [
    partOf(y06, [y07], [r20], { 0: 1 }, { [w]: 1 }),
    partOf(cy06, [], [by['Copic|Y21']], {}, { 0: 1 }),
  ]);
  assert.equal(
    t.findPartLine(r),
    'Y06 is a highlight and a shadow here: Copic shadow for Y21 · Ohuhu highlight in Main for Y07 and shadow in Wings for R20',
  );
});
