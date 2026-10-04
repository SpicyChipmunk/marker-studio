// v306 (along): the same code in both brands (warnings only, worked out from the guide as shown), finding a marker by
// its code in Colour along, and "Did any run low?" once a page is finished.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3';

// Ben's 451 markers as the guide's collection, and a guide whose sections (1, 2, …) take the markers given by key
function benApp(opts = {}) {
  const app = createApp(opts),
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
}
const sorted = (o) => Object.keys(o).sort();

test('same code: every code Ben owns in both brands (18) is marked when the guide has both, whatever the colour difference', () => {
  const { E, t } = benApp();
  const both = JSON.parse(
    E(
      `JSON.stringify((function () { const b = {}; for (const k of state.owned) { const [br, c] = k.split('|'); (b[c] = b[c] || new Set()).add(br); } return Object.keys(b).filter((c) => b[c].size > 1 && c !== '0').sort(); })())`,
    ),
  );
  assert.equal(both.length, 18, both.join(' '));
  // (Y06, B21, Y19 and B02 differ least, ΔE 11–14: still marked)
  for (const c of ['Y06', 'B21', 'Y19', 'B02', 'Y26', 'RV19']) assert.ok(both.includes(c), c);
  for (const c of both) {
    guideOf(t, ['Ohuhu|' + c, 'Copic|' + c, 'Copic|R20']);
    const s = t.sameCodeScan();
    assert.deepEqual(sorted(s), ['Copic|' + c, 'Ohuhu|' + c], c);
    assert.deepEqual(
      [...s['Ohuhu|' + c]].map((m) => m.mkey),
      ['Copic|' + c],
    );
    assert.equal(t.sameName(t.assignData.assign[1]), 'Copic ' + c);
    assert.equal(t.sameName(t.assignData.assign[3]), '', 'R20: one code, one brand');
  }
});

test('same code: one brand of a code is no warning; two sections of the same marker are none either', () => {
  const { t } = benApp();
  guideOf(t, ['Ohuhu|Y26', 'Ohuhu|Y26', 'Ohuhu|Y28']);
  assert.deepEqual(sorted(t.sameCodeScan()), []);
  // (zones: each zone's sections are the guide's too, so a Copic Y26 laid in another zone counts)
  guideOf(t, ['Ohuhu|Y26', 'Ohuhu|G24', 'Copic|Y26', 'Copic|G24']);
  assert.deepEqual(sorted(t.sameCodeScan()), ['Copic|G24', 'Copic|Y26', 'Ohuhu|G24', 'Ohuhu|Y26']);
});

test('find by code: the exact current code, both brands, codes that start another code, old codes left out, unknown codes', () => {
  const { E, t } = benApp();
  // Ohuhu RV18 was R14 (and Copic R14 is another marker); Copic Y21 and Ohuhu Y210; both brands' Y26
  guideOf(t, ['Ohuhu|RV18', 'Copic|Y21', 'Ohuhu|Y210', 'Ohuhu|Y26', 'Copic|Y26', 'Copic|R20']);
  assert.equal(E(`COLORS.find((c) => c.brand === 'Ohuhu' && c.code === 'RV18').old`), 'R14');
  let r = t.codeFind('y21');
  assert.deepEqual(
    r.base.map((m) => m.mkey),
    ['Copic|Y21'],
    'Y21 is Y21, not Y210',
  );
  assert.equal(t.findLine(r), 'Y21 ' + r.base[0].name);
  r = t.codeFind('Y2');
  assert.equal(r.base.length, 0);
  assert.deepEqual([...r.pre], ['Y21', 'Y26', 'Y210']);
  assert.equal(t.findLine(r), 'Codes starting Y2: Y21, Y26, Y210');
  r = t.codeFind(' y-26 ');
  assert.deepEqual(
    r.base.map((m) => m.mkey),
    ['Copic|Y26', 'Ohuhu|Y26'],
  );
  assert.match(t.findLine(r), /^Copic Y26 Mustard · Ohuhu Y26 /);
  // old codes find nothing: R14 is Copic R14's code, and only an old code here
  r = t.codeFind('R14');
  assert.equal(r.base.length + r.part.length, 0);
  assert.equal(t.findLine(r), 'R14 isn’t in this guide');
  assert.equal(t.findLine(t.codeFind('r99')), 'No marker R99');
  assert.equal(t.findLine(t.codeFind('')), '');
});

test('run low: the five that covered most of the page, yours and not dry, never the Colorless Blender', () => {
  const { app, t } = benApp();
  guideOf(t, [
    'Copic|R20',
    'Ohuhu|Y26',
    'Copic|Y26',
    'Ohuhu|B02',
    'Ohuhu|G24',
    'Copic|R20',
    'Ohuhu|V13',
    'Ohuhu|E311',
  ]);
  // (the shell's own lowInk, given to the guide with its api: Ohuhu Y26 marked dry, B02 no longer yours)
  app.__eval(`state.ink['Ohuhu|Y26'] = 'dry'; state.owned.delete('Ohuhu|B02');`);
  app.SF.configure({});
  // (areas 800, 700, …: R20 has sections 1 and 6, 800 + 300)
  const cov = t.lowCover();
  assert.equal(cov[0].k, 'Copic|R20');
  assert.equal(cov[0].a, 1100);
  assert.deepEqual(
    [...t.lowTop()],
    ['Copic|R20', 'Copic|Y26', 'Ohuhu|G24', 'Ohuhu|V13', 'Ohuhu|E311'],
    'no dry Y26, no B02 (not yours)',
  );
});

// the shell's side: one tap is Running low and on To buy in one save, and Undo takes off only what it put on
function shell(full) {
  const ls = memoryStorage();
  ls.setItem(
    KEY,
    JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R310', 'Ohuhu|Y26', 'Copic|Y26'],
      saved: [],
      wish: [{ k: 'Ohuhu|Y26', why: 'from Markers', ts: 1 }],
    }),
  );
  const app = createApp({ localStorage: ls }),
    E = app.__eval;
  if (full) {
    const set = ls.setItem;
    ls.setItem = (k, v) => {
      if (k === KEY) throw new Error('QuotaExceededError');
      return set(k, v);
    };
  }
  return { E, ls };
}
const st = (E) =>
  JSON.parse(E("JSON.stringify({ ink: state.ink, wish: state.wish.map((w) => w.k + ':' + w.why) })"));

test('run low (the shell): one tap marks it and puts it on To buy, in one save; taking it back takes off only what it added', () => {
  const { E, ls } = shell();
  assert.equal(E(`lowInk('Ohuhu|R310')`), '');
  assert.equal(E(`lowInk('Copic|R20')`), null, 'not yours');
  assert.equal(
    E(`lowInk(COLORS.map((c, i) => mkey(i)).find((k, i) => NOINK.has(i)))`),
    null,
    'the Colorless Blender',
  );
  assert.equal(E(`JSON.stringify(lowMark('Ohuhu|R310'))`), '{"k":"Ohuhu|R310","added":true}');
  assert.deepEqual(st(E), {
    ink: { 'Ohuhu|R310': 'low' },
    wish: ['Ohuhu|Y26:from Markers', 'Ohuhu|R310:running low'],
  });
  const saved = JSON.parse(ls.getItem(KEY));
  assert.equal(saved.ink['Ohuhu|R310'], 'low', 'saved');
  assert.ok(saved.wish.some((w) => w.k === 'Ohuhu|R310'));
  assert.equal(E(`lowMark('Ohuhu|R310')`), null, 'already low');
  assert.equal(E(`lowUnmark('Ohuhu|R310', true)`), true);
  assert.deepEqual(st(E), { ink: {}, wish: ['Ohuhu|Y26:from Markers'] });
  // already on To buy: marked low, and Undo leaves the entry it found there
  assert.equal(E(`JSON.stringify(lowMark('Ohuhu|Y26'))`), '{"k":"Ohuhu|Y26","added":false}');
  assert.equal(E(`lowUnmark('Ohuhu|Y26', false)`), true);
  assert.deepEqual(st(E), { ink: {}, wish: ['Ohuhu|Y26:from Markers'] });
  // dry: not offered
  E(`state.ink['Copic|Y26'] = 'dry'`);
  assert.equal(E(`lowMark('Copic|Y26')`), null);
});

test('run low (the shell): storage full keeps neither the ink nor the To buy entry', () => {
  const { E } = shell(true);
  assert.equal(E(`lowMark('Ohuhu|R310')`), null);
  assert.deepEqual(st(E), { ink: {}, wish: ['Ohuhu|Y26:from Markers'] });
});
