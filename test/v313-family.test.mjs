// v313 (D3): a marker's family from its code is its letters and first digit (Ohuhu Y213 with Y26, as Ohuhu numbers
// them; Copic B000 and B0000 before B00), for a guide made since v313 (famRule 1); a guide saved before keeps v312's
// rule (famRule 0) for good. A blend companion from the family is never more than 20 lighter or darker. famRule is
// saved only when 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function appWith(owned) {
  const app = createApp(),
    E = app.__eval,
    core = app.__mstest;
  E('state.owned = new Set(' + JSON.stringify(owned || []) + ')');
  core.coll = E('sfCollection()');
  return { app, E, core, K: core.colour, sv: core.styleVars, coll: core.coll };
}
const fv = (K, c) => JSON.parse(JSON.stringify(K.famVal(c)));

test('famVal: v312’s rule while famRule is 0 (a guide saved before), letters and first digit once it’s 1', () => {
  const { K, sv } = appWith();
  assert.equal(sv.famRule, 0, 'starts at 0, as a guide saved before opens');
  assert.deepEqual(fv(K, 'Y213'), { fam: 'Y21', val: 3 });
  assert.deepEqual(fv(K, 'Y26'), { fam: 'Y2', val: 6 });
  assert.deepEqual(fv(K, 'B000'), { fam: 'B00', val: 0 });
  sv.famRule = 1;
  assert.deepEqual(fv(K, 'Y213'), { fam: 'Y2', val: 13 });
  assert.deepEqual(fv(K, 'Y26'), { fam: 'Y2', val: 6 });
  assert.deepEqual(fv(K, 'Y210'), { fam: 'Y2', val: 10 });
  // Copic's palest: B0000, B000, B00, then B01, B02
  assert.deepEqual(
    ['B0000', 'B000', 'B00', 'B01', 'B05'].map((c) => fv(K, c)),
    [
      { fam: 'B0', val: -2 },
      { fam: 'B0', val: -1 },
      { fam: 'B0', val: 0 },
      { fam: 'B0', val: 1 },
      { fam: 'B0', val: 5 },
    ],
  );
  // one digit: its letters, as before; no letters: none
  assert.deepEqual(fv(K, 'N3'), { fam: 'N', val: 3 });
  assert.equal(K.famVal('100'), null);
});

test('v313’s rule over each brand’s whole catalogue: no two markers of a family share a number', () => {
  const { app, K, sv } = appWith();
  sv.famRule = 1;
  const cat = JSON.parse(app.__eval('JSON.stringify(COLORS.map((c) => [c.brand, c.code]))'));
  const seen = new Map();
  let n = 0;
  for (const [b, code] of cat) {
    const f = K.famVal(code);
    if (!f) continue;
    n++;
    const k = b + '|' + f.fam + '|' + f.val;
    assert.ok(!seen.has(k), `${b} ${code} and ${seen.get(k)}: both ${f.fam} ${f.val}`);
    seen.set(k, code);
  }
  assert.ok(n > 600, n + ' codes');
});

test('blend companions in a guide made since v313: a family one is never more than 20 lighter or darker; Ohuhu Y213’s lighter is from Y2x', () => {
  const { app, K, sv, coll } = appWith();
  sv.famRule = 1;
  const same = (a, b) => {
    const x = K.famVal(a.code),
      y = K.famVal(b.code);
    return a.brand === b.brand && x && y && x.fam === y.fam;
  };
  let n = 0,
    fam = 0;
  for (const m of coll)
    for (const side of [-1, 1]) {
      const c = K.companion(m.lab, m, coll, side);
      if (!c) continue;
      n++;
      const dL = (c.lab[0] - m.lab[0]) * -side;
      assert.ok(dL >= 4, `${m.brand} ${m.code} ${side}: ${c.code} lightness`);
      assert.ok(app.de2000(m.lab, c.lab) >= 3, `${m.code} ${side}: ${c.code} too close`);
      if (same(m, c)) {
        fam++;
        assert.ok(dL <= 20, `${m.brand} ${m.code} ${side}: ${c.code} ${dL.toFixed(1)} lighter or darker`);
      }
    }
  assert.ok(n > coll.length && fam > coll.length / 2, n + ' companions, ' + fam + ' from the family');
  const y213 = coll.find((x) => x.brand === 'Ohuhu' && x.code === 'Y213'),
    l = K.companion(y213.lab, y213, coll, -1);
  assert.ok(l && /^Y2\d$|^Y21\d$/.test(l.code), 'Y213 lighter: ' + (l && l.code));
});

test('a guide saved before v313 keeps v312’s companions: famRule 0 picks as v312 did', () => {
  // (v312's rule and no step limit: Ohuhu GG12's darker was GG15, 33 darker; since v313 a nearer one)
  const { K, sv, coll } = appWith();
  const gg12 = coll.find((x) => x.brand === 'Ohuhu' && x.code === 'GG12');
  const old = K.companion(gg12.lab, gg12, coll, 1);
  assert.equal(old && old.code, 'GG15');
  sv.famRule = 1;
  const now = K.companion(gg12.lab, gg12, coll, 1);
  assert.ok(now && now.code !== 'GG15' && gg12.lab[0] - now.lab[0] <= 20, 'since v313: ' + (now && now.code));
});

test('famRule is saved beside the section settings only when 1, and opens as saved (anything else as 0)', () => {
  const { app, core, sv } = appWith();
  const W = 4,
    H = 4;
  core.W = W;
  core.H = H;
  core.labels = new Int32Array(W * H).fill(1);
  core.secState = new Uint8Array(2);
  core.colored = new Uint8Array(2);
  core.assignData = { order: [1], assign: { 1: { mkey: 'Ohuhu|R16' } }, N: 1 };
  let d = core.currentDesignObj();
  assert.equal('famRule' in d.payload, false, 'a guide saved before saves as it was');
  sv.famRule = 1;
  d = core.currentDesignObj();
  assert.equal(d.payload.famRule, 1);
  const ks = Object.keys(d.payload);
  assert.equal(ks[ks.indexOf('addAutoClose') + 1], 'famRule', 'after addAutoClose');
  // (opening: STYLE_FIELDS' check, as styleFrom uses it)
  const f = [...core.styleFields].find((x) => x.key === 'famRule');
  assert.equal(f.in, 'payload');
  assert.equal(f.undo, false, 'not part of Undo');
  assert.equal(f.check(1, f.def), 1);
  assert.equal(f.check(undefined, f.def), 0);
  assert.equal(f.check(2, f.def), 0);
  assert.equal(f.check('1', f.def), 0);
});

test('lowX (the running-low lines closed) is saved with the guide as a list, only when there are any, and opens as saved', () => {
  const { core } = appWith();
  const f = [...core.styleFields].find((x) => x.key === 'lowX');
  assert.equal(f.in, 'payload');
  assert.equal(f.undo, false);
  assert.equal(f.check(undefined, f.def), null);
  assert.equal(f.check([], f.def), null);
  assert.deepEqual(JSON.parse(JSON.stringify(f.check(['Ohuhu|R413', 5, 'Copic|B00'], f.def))), {
    'Ohuhu|R413': 1,
    'Copic|B00': 1,
  });
  assert.equal(f.check('Ohuhu|R413', f.def), null);
  core.styleVars.lowX = null;
  assert.equal(f.save(), undefined);
  core.styleVars.lowX = { 'Ohuhu|R413': 1 };
  assert.deepEqual([...f.save()], ['Ohuhu|R413']);
});
