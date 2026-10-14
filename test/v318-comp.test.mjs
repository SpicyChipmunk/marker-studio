// v318 (famRule 4): a blend companion under 5 CIEDE2000 from its marker gives way to one a clear step away, found the
// same way (family first; outside it, within 10° of the colour's hue); with none such the old pick stays, so no
// companion is lost and none becomes one to buy. (Ohuhu B111's darker was B112, 3.9 apart.) A guide saved before
// (famRule 3) keeps its picks. Fails on v317.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(set) {
  const app = createApp(),
    E = app.__eval,
    core = app.__mstest;
  if (set === 'ben') E('state.owned = defaultOwned()');
  else if (set === 'allO' || set === 'allC')
    E(
      'state.owned = new Set(COLORS.filter((c) => c.brand === "' +
        (set === 'allO' ? 'Ohuhu' : 'Copic') +
        '").map((c) => c.brand + "|" + c.code))',
    );
  else E('state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === ' + JSON.stringify(set) + ')))');
  core.coll = E('sfCollection()');
  return { E, core, K: core.colour, sv: core.styleVars, coll: core.coll, de: E('de2000'), lch: E('lchOf') };
}
const code = (m) => (m ? m.brand[0] + ':' + m.code : '-');
const comp = (a, c, side) => {
  const b = a.coll.find((m) => code(m) === c);
  assert.ok(b, c);
  const r = a.K.companions(b);
  return side < 0 ? r.light : r.dark;
};
const hd = (x, y) => {
  const d = Math.abs(x - y) % 360;
  return Math.min(d, 360 - d);
};

test('famRule 4: B111’s darker is no longer B112 (3.9 apart), B02’s no longer B05 (4.6); famRule 3 keeps them', () => {
  const a = appWith('ben');
  for (const [base, side, was] of [
    ['O:B111', 1, 'O:B112'],
    ['O:B02', 1, 'O:B05'],
    ['O:B112', -1, 'O:B111'],
  ]) {
    a.sv.famRule = 3;
    assert.equal(code(comp(a, base, side)), was, base + ' under famRule 3');
    a.sv.famRule = 4;
    const now = comp(a, base, side);
    assert.ok(now && code(now) !== was, base + ': ' + code(now));
    assert.ok(a.de(now.lab, a.coll.find((m) => code(m) === base).lab) >= 5, base + ' → ' + code(now));
  }
});

test('famRule 4 keeps a close pick that has nothing clearer: Copic BG75’s darker is still BG78 (4.8)', () => {
  const a = appWith('allC');
  a.sv.famRule = 4;
  assert.equal(code(comp(a, 'C:BG75', 1)), 'C:BG78');
});

test('famRule 4, over sets of both brands: a pick that changes is 5 or more away, keeps the hue outside its family, and none is lost or becomes one to buy', () => {
  let n = 0,
    changed = 0;
  for (const set of ['Honolulu 24', 'Honolulu 216', 'Ciao 12', 'Ciao 72 - Set A', 'ben', 'allO', 'allC']) {
    const a = appWith(set);
    for (const b of a.coll) {
      a.sv.famRule = 3;
      const r3 = a.K.companions(b);
      a.sv.famRule = 4;
      const r4 = a.K.companions(b),
        fb = a.K.famVal(b.code);
      for (const [s, side] of [
        ['light', -1],
        ['dark', 1],
      ]) {
        const m = r4[s],
          o = r3[s];
        n++;
        assert.equal(!!m, !!o, set + ' ' + code(b) + ' ' + s + ': lost or gained');
        if (!m) continue;
        assert.equal(r4[s + 'Owned'], r3[s + 'Owned'], set + ' ' + code(b) + ' ' + s + ': owned as before');
        if (m.mkey === o.mkey) continue;
        changed++;
        assert.ok(a.de(o.lab, b.lab) < 5, set + ' ' + code(b) + ': only a pick under 5 changes');
        assert.ok(a.de(m.lab, b.lab) >= 5, set + ' ' + code(b) + ' → ' + code(m));
        assert.ok((m.lab[0] - b.lab[0]) * -side >= 4, set + ' ' + code(b) + ' → ' + code(m) + ' goes the wrong way');
        const fm = a.K.famVal(m.code);
        if (fb && fm && m.brand === b.brand && fm.fam === fb.fam) continue;
        const B = a.lch(b.lab),
          M = a.lch(m.lab);
        assert.ok(Math.abs(M[0] - B[0]) <= 20, set + ' ' + code(b) + ' → ' + code(m));
        if (B[1] >= a.E('GREY_C')) assert.ok(hd(B[2], M[2]) <= 10, set + ' ' + code(b) + ' → ' + code(m) + ': hue');
        if (side > 0 && B[1] >= 12) assert.ok(M[1] >= 0.35 * B[1] - 1e-9, set + ' ' + code(b) + ' → ' + code(m));
      }
    }
  }
  assert.ok(n > 1500, 'companions checked: ' + n);
  assert.ok(changed > 150, 'picks changed: ' + changed);
});

test('a new picture takes famRule 4; From your guides reads a row’s 4 as 4', () => {
  const a = appWith('Honolulu 24');
  a.core.assign.quiet();
  a.core.assign.resetForNewPicture();
  assert.equal(a.sv.famRule, 4);
  const f = [...a.core.styleFields].find((x) => x.key === 'famRule');
  assert.equal(f.check(4, f.def), 4);
});
