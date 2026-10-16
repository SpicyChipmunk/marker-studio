// v318.7 Scan, sections 4 and 5: one answer function for the list's chips and the larger view's — the answer takes the
// question's place in the list (not the top) and its photo; a row taken off; and Undo this photo gives a question back
// at its photo's group, not the top. Each test fails on v318.6 (scanAnswer and ocrGroupAt don't exist there; the old
// chip handler unshifted the answer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function studio() {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval(`
    var T = {};
    T.reset = function () {
      scanList = []; scanBrand = ''; scanBrandChosen = true; scanSw = scanSwNew(); ocrAnswered = [];
      scanTookAt.clear(); scanAnsweredAt.clear(); scanLast = { i: -1, at: 0 }; state.owned = new Set();
      T.cards = [];
      scanSay = function (k, a, b) { T.cards.push({ k: k, big: String(a), small: String(b || '') }); };
    };
    T.ix = (b, c) => COLORS.findIndex((x) => x.brand === b && x.code === c);
    T.m = (b, c, photo) => Object.assign({ i: T.ix(b, c), how: '' }, photo ? { photo: photo } : {});
    T.q = (code, photo) => Object.assign({ ask: 'brands ' + code, title: code + ': Ohuhu or Copic?', at: 1,
      opts: [{ i: T.ix('Ohuhu', code), how: 'chosen' }, { i: T.ix('Copic', code), how: 'chosen' }] }, photo ? { photo: photo } : {});
    T.rows = () => scanList.map((e) => (e.ask ? '?' + e.ask.slice(7) : COLORS[e.i].brand[0] + COLORS[e.i].code) + (e.photo ? '@' + e.photo : ''));
  `);
  return a;
}

test('an answer takes the question’s place in the list and its photo; the question isn’t asked again while its cap’s in view', () => {
  const a = studio();
  a.__eval('T.reset(); scanList = [T.m("Ohuhu", "E19"), T.q("B04", 2), T.m("Ohuhu", "B015", 2), T.q("YR07"), T.m("Ohuhu", "R014")];');
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), ['OE19', '?B04@2', 'OB015@2', '?YR07', 'OR014']);
  const n = a.__eval('scanAnswer(scanList[1], T.ix("Copic", "B04"), "chosen")');
  assert.equal(n, 1, 'the question’s place');
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), ['OE19', 'CB04@2', 'OB015@2', '?YR07', 'OR014']);
  assert.ok(a.__eval('scanAnsweredAt.has("brands B04")'), 'not asked again while the cap’s in view');
  assert.equal(a.__eval('T.cards[T.cards.length - 1].small'), 'Added to the list · Copic');
  // one of no photo: in place, no photo of its own
  assert.equal(a.__eval('scanAnswer(scanList[3], T.ix("Ohuhu", "YR07"), "chosen")'), 3);
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), ['OE19', 'CB04@2', 'OB015@2', 'OYR07', 'OR014']);
  assert.equal(a.__eval('"photo" in scanList[3]'), false);
  // the answer already in the list: the question just goes, said so
  a.__eval('scanList.splice(2, 0, T.q("B04", 3))');
  assert.equal(a.__eval('scanAnswer(scanList[2], T.ix("Copic", "B04"), "chosen")'), 2);
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), ['OE19', 'CB04@2', 'OB015@2', 'OYR07', 'OR014']);
  assert.match(a.__eval('T.cards[T.cards.length - 1].small'), /^Already in the list/);
  // a question gone from the list meanwhile: nothing, -1
  assert.equal(a.__eval('scanAnswer(T.q("B05"), T.ix("Copic", "B05"), "chosen")'), -1);
  assert.equal(a.__eval('scanList.length'), 5);
});

test('a row taken off: a question let go by isn’t asked again while its cap’s in view; the last marker read is forgotten', () => {
  const a = studio();
  a.__eval('T.reset(); scanList = [T.q("B04"), T.m("Ohuhu", "E19")]; scanLast = { i: T.ix("Ohuhu", "E19"), at: Date.now() };');
  a.__eval('scanRemove(0)');
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), ['OE19']);
  assert.ok(a.__eval('scanAnsweredAt.has("brands B04")'));
  a.__eval('scanRemove(0)');
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), []);
  assert.equal(a.__eval('scanLast.i'), -1);
  a.__eval('scanRemove(5)');
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), []);
});

test('Undo this photo gives a question answered by that photo back at its own photo’s group, not the top', () => {
  const a = studio();
  // the list newest first: a typed marker, photo 3's, photo 2's, photo 1's
  a.__eval(
    'T.reset(); scanList = [T.m("Ohuhu", "R014"), T.m("Ohuhu", "B03", 3), T.m("Ohuhu", "B08", 2), T.m("Ohuhu", "B09", 2), T.m("Ohuhu", "E19", 1)];',
  );
  assert.equal(a.__eval('ocrGroupAt(T.q("B04", 2))'), 2, 'at the top of photo 2’s group');
  assert.equal(a.__eval('ocrGroupAt(T.q("B04", 1))'), 4, 'at the top of photo 1’s group');
  assert.equal(a.__eval('ocrGroupAt(T.q("B04"))'), 0, 'one of no photo at the top');
  // its group gone (that photo undone too): where its photo would sit
  a.__eval('scanList = [T.m("Ohuhu", "R014"), T.m("Ohuhu", "B03", 3), T.m("Ohuhu", "E19", 1)];');
  assert.equal(a.__eval('ocrGroupAt(T.q("B04", 2))'), 2, 'between photo 3 and photo 1');
  assert.equal(a.__eval('ocrGroupAt(T.q("B04", 4))'), 1, 'above photo 3, under the typed one');
  a.__eval('scanList = [T.m("Ohuhu", "B03", 3)];');
  assert.equal(a.__eval('ocrGroupAt(T.q("B04", 2))'), 1, 'after photo 3');
});
