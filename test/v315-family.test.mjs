// v315 (Q10g): Copic's greys are written with a hyphen (C-00, C-0, C-1 … C-10, and N-, T-, W-), which v313's family
// rule didn't read, so a grey had no family: its blend companions and shading were found by eye, across the grey
// types and into near-grey colours. In a guide made since v315 (famRule 2) each grey type is a family, palest first;
// a guide saved before (famRule 0 or 1) keeps its rule. Fails on v314.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(owned) {
  const app = createApp(),
    E = app.__eval,
    core = app.__mstest;
  if (owned === 'copic')
    E('state.owned = new Set(COLORS.filter((c) => c.brand === "Copic").map((c) => c.brand + "|" + c.code))');
  else if (owned === 'ben') E('state.owned = defaultOwned()');
  core.coll = E('sfCollection()');
  return { app, E, core, K: core.colour, sv: core.styleVars, coll: core.coll };
}
const fv = (K, c) => JSON.parse(JSON.stringify(K.famVal(c)));
const code = (m) => (m ? m.brand[0] + ':' + m.code : '-');

test('famVal: a Copic grey is its type’s family under famRule 2 (C-00 first), none under 0 and 1; other codes as before', () => {
  const { app, K, sv } = appWith();
  for (const r of [0, 1]) {
    sv.famRule = r;
    assert.equal(K.famVal('N-10'), null, 'rule ' + r);
  }
  sv.famRule = 2;
  assert.deepEqual(
    ['C-00', 'C-0', 'C-1', 'C-10', 'W-00', 'N-3', 'T-9'].map((c) => fv(K, c)),
    [
      { fam: 'C-', val: -1 },
      { fam: 'C-', val: 0 },
      { fam: 'C-', val: 1 },
      { fam: 'C-', val: 10 },
      { fam: 'W-', val: -1 },
      { fam: 'N-', val: 3 },
      { fam: 'T-', val: 9 },
    ],
  );
  // every other code reads as under rule 1, and no two Copic greys of a type share a number
  const cat = JSON.parse(app.__eval('JSON.stringify(COLORS.map((c) => [c.brand, c.code]))'));
  const seen = new Set();
  let greys = 0;
  for (const [b, c] of cat) {
    sv.famRule = 1;
    const one = JSON.stringify(K.famVal(c));
    sv.famRule = 2;
    const two = K.famVal(c);
    if (/-/.test(c)) {
      greys++;
      const k = b + '|' + two.fam + two.val;
      assert.ok(!seen.has(k), c);
      seen.add(k);
    } else assert.equal(JSON.stringify(two), one, c);
  }
  assert.equal(greys, 46, 'Copic’s 46 greys');
});

test('a full set of Copic: a grey’s companions and shading stay in its own grey type under famRule 2', () => {
  const { K, sv, coll, core } = appWith('copic');
  const by = (c) => coll.find((m) => m.code === c);
  sv.famRule = 1;
  const before = { dark: code(K.companion(by('C-6').lab, by('C-6'), coll, 1)) };
  sv.famRule = 2;
  assert.notEqual(before.dark, 'C:C-7', 'v314: across the types');
  assert.equal(code(K.companion(by('C-6').lab, by('C-6'), coll, 1)), 'C:C-7');
  assert.equal(code(K.companion(by('C-6').lab, by('C-6'), coll, -1)), 'C:C-5');
  assert.equal(code(K.companion(by('W-1').lab, by('W-1'), coll, -1)), 'C:W-00');
  // every grey: its companions and shading picks, where in its type, keep to it
  let inType = 0,
    all = 0;
  for (const m of coll.filter((x) => /-/.test(x.code))) {
    const t = m.code.split('-')[0] + '-';
    for (const side of [-1, 1])
      for (const p of [K.companion(m.lab, m, coll, side), core.shadePick(m, coll, side)]) {
        if (!p) continue;
        all++;
        if (p.code.startsWith(t)) inType++;
      }
  }
  assert.ok(inType / all > 0.9, `${inType} of ${all} in the grey’s own type`);
});

test('Ben’s markers: only picks for his Copic greys change, and to the same grey type', () => {
  const { K, sv, coll, core } = appWith('ben');
  const picks = () =>
    coll.map((m) =>
      [
        K.companion(m.lab, m, coll, -1),
        K.companion(m.lab, m, coll, 1),
        core.shadePick(m, coll, -1),
        core.shadePick(m, coll, 1),
      ].map(code),
    );
  sv.famRule = 1;
  const a = picks();
  sv.famRule = 2;
  const b = picks();
  let n = 0;
  coll.forEach((m, i) =>
    a[i].forEach((x, j) => {
      if (x === b[i][j]) return;
      n++;
      assert.match(m.code, /-/, m.code + ' changed');
      assert.ok(b[i][j].startsWith('C:' + m.code.split('-')[0] + '-'), `${m.code}: ${x} → ${b[i][j]}`);
    }),
  );
  assert.ok(n > 0 && n <= 8, n + ' picks changed');
});
