// v318.21, the code on your cap: Ohuhu renamed 362 markers in June 2025 (R6 Rose Red is R213 Pomegranate now) and
// older caps still say the old code. Each marker remembers what its cap says, from how it came in (Scan's reads, Bought
// ✓, its own switch); the rest follow one setting; the code and name shown are your cap's, "now R213" beside; two
// markers of a guide that show the same code (an older cap's R22, RV17 now, and the R22 of now) are told apart by a *
// and their caps' names. Saved keys stay as they are now. Fails on v318.20.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function app(opts = {}) {
  const a = createApp(opts),
    E = a.__eval,
    t = a.__mstest;
  E('state.owned = new Set(); state.cap = {}; state.capDef = ""; state.capQ = 0; state.capOffer = 0;');
  return { a, E, t };
}
const J = (E, s) => JSON.parse(E('JSON.stringify(' + s + ')'));

test('shown: an older cap’s code and name, "now R213"; a marker not yours, or with nothing known, as it is now', () => {
  const { E } = app();
  E(
    'state.owned.add("Ohuhu|R213"); state.owned.add("Ohuhu|BG215"); state.owned.add("Ohuhu|CG18"); state.owned.add("Copic|FB")',
  );
  const show = (k) => J(E, '[capCode("' + k + '"), capName("' + k + '"), capNow("' + k + '")]');
  assert.deepEqual(show('Ohuhu|R213'), ['R213', 'Pomegranate', '']);
  E('state.cap["Ohuhu|R213"] = "old"');
  assert.deepEqual(show('Ohuhu|R213'), ['R6', 'Rose Red', 'now R213']);
  // (a short old name the reader leaves out, shown: BG8 Teal is BG215 Dark Pine Green now)
  E('state.cap["Ohuhu|BG215"] = "old"');
  assert.deepEqual(show('Ohuhu|BG215'), ['BG8', 'Teal', 'now BG215']);
  // (not yours: as it's sold now, whatever was known of it)
  E('state.owned.delete("Ohuhu|R213")');
  assert.deepEqual(show('Ohuhu|R213'), ['R213', 'Pomegranate', '']);
  // (the setting: Ohuhu markers with nothing known show their older caps; the Ⅱ shown as II; Copic's fluorescents only
  // by what's known)
  E('state.capDef = "old"');
  assert.deepEqual(show('Ohuhu|CG18'), ['CGII04', 'Cool Grey II 4', 'now CG18']);
  assert.deepEqual(show('Copic|FB'), ['FB', J(E, 'COLORS[keyIdx("Copic|FB")].name'), '']);
  E('state.cap["Copic|FB"] = "old"');
  assert.equal(J(E, 'capCode("Copic|FB")'), 'FB2');
  // (a guide's marker, by its key)
  assert.equal(J(E, 'capCode({ mkey: "Ohuhu|CG18", brand: "Ohuhu", code: "CG18" })'), 'CGII04');
  // (kept clean: a marker with no older code, or a key not a marker, isn't kept)
  assert.deepEqual(
    J(E, 'cleanCap({ "Ohuhu|R213": "old", "Ohuhu|nope": "old", "Ohuhu|R213x": "new", "Copic|R20": "old" })'),
    {
      'Ohuhu|R213': 'old',
    },
  );
});

// a photo's lines through the reader: [code, [name lines]], six caps a row
function photo(E, caps) {
  return J(
    E,
    '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1;' +
      'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
      'ocrRun = r; let id = 0; const lines = [];' +
      JSON.stringify(caps) +
      '.forEach((t, k) => { const x = 300 * (k % 6), y = 400 * Math.floor(k / 6), me = ++id;' +
      '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
      '  (t[1] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: me, box: [x, y + 30 + 20 * j, 80, 20, 0] })); });' +
      'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
      'const o = {}; scanList.filter((e) => !e.ask).forEach((e) => (o[mkey(e.i)] = e.cv || "-")); return o; })()',
  );
}
const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2'].map((c) => [
  c,
]);

test('what a cap says, by how Scan read it: an old code, a code as it is now, R22 only with its name, a code put right by its old name', () => {
  const { E } = app();
  const p = photo(E, OLD.concat([['R6'], ['5110', ['Dark Suntan']], ['R22', ['Dark Blush']]]));
  assert.equal(p['Ohuhu|R213'], 'old', JSON.stringify(p));
  assert.equal(p['Ohuhu|YR312'], 'old', 'put right by its old name: ' + JSON.stringify(p));
  // (R22 is the R22 of now and RV17's old code: with "Dark Blush", RV17's older cap)
  assert.equal(p['Ohuhu|RV17'], 'old', JSON.stringify(p));
  // (typed, a code as it is now: the cap of now; R22 alone tells nothing, being RV17's old code too)
  E('scanList = []; scanBrand = "Ohuhu"; scanHandleCodes("R213\\nB115", false, false, false);');
  assert.deepEqual(J(E, 'scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + ":" + (e.cv || "-"))'), [
    'Ohuhu|B115:new',
    'Ohuhu|R213:new',
  ]);
  assert.equal(J(E, 'capCvRead(keyIdx("Ohuhu|R22"), false, false)'), '');
  assert.equal(J(E, 'capCvRead(keyIdx("Ohuhu|R22"), false, true)'), 'new');
});

test('Add notes what the caps say on markers yours after it (Undo puts it back); the offer to switch the rest, once', () => {
  const { E } = app();
  E('state.owned.add("Ohuhu|R213"); state.owned.add("Ohuhu|B115"); state.cap["Ohuhu|B115"] = "old"');
  E(
    'scanList = [{ i: keyIdx("Ohuhu|R213"), how: "old", cv: "old" }, { i: keyIdx("Ohuhu|B115"), how: "", cv: "new" }, { i: keyIdx("Ohuhu|R10"), how: "", cv: "" }];',
  );
  const ch = J(E, 'capFromList(scanList)');
  assert.deepEqual(ch, { 'Ohuhu|R213': ['', 'old'], 'Ohuhu|B115': ['old', 'new'] });
  E('capApply(capFromList(scanList))');
  assert.deepEqual(J(E, 'state.cap'), { 'Ohuhu|R213': 'old', 'Ohuhu|B115': 'new' });
  E('capApply(' + JSON.stringify(ch) + ', true)');
  assert.deepEqual(J(E, 'state.cap'), { 'Ohuhu|B115': 'old' });
  // (the offer: five Ohuhu caps at least, half or more the other version than the setting gives; not a pasted list's)
  const list = (o, n, pasted) =>
    'Object.keys(COLORS).filter((i) => COLORS[i].brand === "Ohuhu" && capHasOld(COLORS[i])).slice(0, ' +
    (o + n) +
    ').map((i, k) => ({ i: +i, cv: k < ' +
    o +
    ' ? "old" : "new"' +
    (pasted ? ', pasted: true' : '') +
    ' }))';
  assert.equal(J(E, 'capOfferFor(' + list(5, 4) + ')'), 'old');
  assert.equal(J(E, 'capOfferFor(' + list(4, 0) + ')'), '');
  assert.equal(J(E, 'capOfferFor(' + list(1, 60) + ')'), '');
  assert.equal(J(E, 'capOfferFor(' + list(9, 1, true) + ')'), '');
  E('state.capDef = "old"');
  assert.equal(J(E, 'capOfferFor(' + list(1, 9) + ')'), 'new');
  E('state.capOffer = 1');
  assert.equal(J(E, 'capOfferFor(' + list(1, 9) + ')'), '');
});

test('Bought ✓ is the cap of now; the switch and the setting are kept, through a reload', () => {
  const st = memoryStorage();
  const { E } = app({ localStorage: st });
  E(
    'state.owned.add("Ohuhu|R213"); state.cap["Ohuhu|R213"] = "old"; state.wish = [{ k: "Ohuhu|R213", why: "", ts: 1 }]; save(true);',
  );
  E('wishBought("Ohuhu|R213")');
  assert.equal(J(E, 'state.cap["Ohuhu|R213"]'), 'new');
  E('capSetOne("Ohuhu|R213", "old"); capSetDef("old", "menu");');
  const b = createApp({ localStorage: st });
  assert.deepEqual(J(b.__eval, '[state.cap["Ohuhu|R213"], state.capDef, state.capQ]'), ['old', 'old', 1]);
});

test('backups carry what caps say: a restore replacing your markers takes them, one adding to yours merges, yours win; the restore’s fingerprint is the same with none', () => {
  const { E } = app();
  E('state.cap = { "Ohuhu|R213": "new" }; state.capDef = "";');
  assert.equal(
    J(E, 'capRestore({ cap: { "Ohuhu|R213": "old", "Ohuhu|CG18": "old" }, capDef: "old" }, false)'),
    1,
  );
  assert.deepEqual(J(E, '[state.cap, state.capDef]'), [{ 'Ohuhu|R213': 'new', 'Ohuhu|CG18': 'old' }, '']);
  E('capRestore({ cap: { "Ohuhu|B115": "old" }, capDef: "old", capQ: 1 }, true)');
  assert.deepEqual(J(E, '[state.cap, state.capDef, state.capQ]'), [{ 'Ohuhu|B115': 'old' }, 'old', 1]);
  // (a backup from before: nothing changes)
  assert.equal(J(E, 'capRestore({ owned: [] }, true)'), 0);
  // (the put-back after a restore, kept by v318.20 with no caps, still matches while no cap is known)
  E('state.cap = {}; state.capDef = ""');
  const now = J(E, 'mkSig()'),
    v31820 = J(
      E,
      'leaveHash(JSON.stringify([[...state.owned].sort(), state.wish.map((w) => w.k), Object.keys(state.ink).sort().map((k) => k + state.ink[k]), state.buyBrands == null ? null : state.buyBrands.slice()]))',
    );
  assert.equal(now, v31820);
});

test('a guide with an older cap’s R22 (RV17 now) and the R22 of now: a * on the older one, both named by their caps', () => {
  const { E, t } = app();
  E(
    'state.owned = new Set(["Ohuhu|RV17", "Ohuhu|R22", "Ohuhu|R213", "Copic|R22"]); state.cap = { "Ohuhu|RV17": "old" };',
  );
  t.coll = E('sfCollection()');
  const by = {};
  t.coll.forEach((m) => (by[m.mkey] = m));
  const guide = (keys) => {
    const assign = {},
      order = [];
    keys.forEach((k, i) => {
      assign[i + 1] = by[k];
      order.push(i + 1);
    });
    t.comps = [null].concat(keys.map(() => ({ area: 100, cx: 0, cy: 0 })));
    t.assignData = { assign, order, N: order.length };
  };
  guide(['Ohuhu|RV17', 'Ohuhu|R22', 'Ohuhu|R213']);
  const A = t.assignData.assign;
  assert.equal(t.capLabel(A[1]), 'R22*');
  assert.equal(t.capLabel(A[2]), 'R22');
  assert.equal(t.capLabel(A[3]), 'R213');
  assert.equal(t.sameName(A[2]), 'R22* Dark Blush cap');
  assert.equal(t.sameName(A[1]), 'R22 Ballet Pink cap');
  assert.equal(t.capKeyName(A[1]), 'Dark Blush, now RV17');
  // (without the R22 of now in the guide: no *, nothing to tell apart)
  guide(['Ohuhu|RV17', 'Ohuhu|R213']);
  assert.equal(t.capLabel(t.assignData.assign[1]), 'R22');
  // (three: the Copic R22 too: its brand's mark, as before, and the * on the older Ohuhu cap)
  guide(['Ohuhu|RV17', 'Ohuhu|R22', 'Copic|R22']);
  const B = t.assignData.assign;
  assert.equal(t.capLabel(B[1]), 'R22*');
  assert.deepEqual(Object.keys(t.sameCodeScan().b).sort(), ['Copic|R22', 'Ohuhu|R22', 'Ohuhu|RV17']);
  assert.equal(t.sameName(B[3]), 'Ohuhu R22* or Ohuhu R22');
});
