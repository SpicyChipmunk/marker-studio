// v316 (famRule 3): a blend companion from outside the marker's family is a step a blend can make — no more than 20
// lighter or darker, as a family member may be, and a darker one keeping 35% of the colour's chroma. Before, the nearest
// by eye could be any distance away (Copic E29's lighter was YR07, 34 lighter) and a red's darker a near grey (Ohuhu
// E515 Black Brown for R514). A guide saved before (famRule 2) keeps its picks. Fails on v315.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(set) {
  const app = createApp(),
    E = app.__eval,
    core = app.__mstest;
  if (set === 'allO' || set === 'allC')
    E(
      'state.owned = new Set(COLORS.filter((c) => c.brand === "' +
        (set === 'allO' ? 'Ohuhu' : 'Copic') +
        '").map((c) => c.brand + "|" + c.code))',
    );
  else E('state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === ' + JSON.stringify(set) + ')))');
  core.coll = E('sfCollection()');
  return { E, core, K: core.colour, sv: core.styleVars, coll: core.coll };
}
const code = (m) => (m ? m.brand[0] + ':' + m.code : '-');
const comp = (a, c, side) => {
  const b = a.coll.find((m) => code(m) === c);
  assert.ok(b, c);
  const r = a.K.companions(b);
  return side < 0 ? r.light : r.dark;
};

test('famRule 3: Ohuhu R514’s darker no longer Black Brown, Copic E29’s lighter no longer orange, black’s lighter no longer pale grey; famRule 2 keeps them', () => {
  const cases = [
    ['Honolulu 48', 'O:R514', 1, 'O:E515'],
    ['Ciao 12', 'C:E29', -1, 'C:YR07'],
    ['Ciao 36 - Set A', 'C:100', -1, 'C:C-3'],
  ];
  for (const [set, base, side, was] of cases) {
    const a = appWith(set);
    a.sv.famRule = 2;
    assert.equal(code(comp(a, base, side)), was, set + ' ' + base + ' under famRule 2');
    a.sv.famRule = 3;
    const now = comp(a, base, side);
    assert.ok(now && code(now) !== was, set + ' ' + base + ': ' + code(now));
  }
});

test('famRule 3, over sets of both brands: every companion from outside the family within 20 in lightness, and a darker one keeping 35% of a colour’s chroma', () => {
  let n = 0;
  for (const set of [
    'Honolulu 24',
    'Honolulu 72',
    'Honolulu 216',
    'Ciao 12',
    'Ciao 72 - Set A',
    'allO',
    'allC',
  ]) {
    const a = appWith(set),
      lch = a.E('lchOf');
    a.sv.famRule = 3;
    for (const b of a.coll) {
      const r = a.K.companions(b),
        fb = a.K.famVal(b.code);
      for (const [m, side] of [
        [r.light, -1],
        [r.dark, 1],
      ]) {
        if (!m) continue;
        const fm = a.K.famVal(m.code);
        if (fb && fm && m.brand === b.brand && fm.fam === fb.fam) continue;
        n++;
        const B = lch(b.lab),
          M = lch(m.lab);
        assert.ok(Math.abs(M[0] - B[0]) <= 20, set + ' ' + code(b) + ' → ' + code(m));
        if (side > 0 && B[1] >= 12)
          assert.ok(M[1] >= 0.35 * B[1] - 1e-9, set + ' ' + code(b) + ' → ' + code(m));
      }
    }
  }
  assert.ok(n > 500, 'companions checked: ' + n);
});
