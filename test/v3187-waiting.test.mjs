// v318.7 Scan, sections 8 and 9: each entry's photo is saved with the list and read back, the photos numbered 1.. in
// turn; a question every answer of which is in your collection is dropped, not counted among the questions waiting;
// and Add markers' line on them. Each test fails on v318.6 (scanParseList, scanDropOwned, scanWaiting and
// scanWaitHTML don't exist there; the list was saved without photos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function studio(init) {
  const a = createApp({ localStorage: memoryStorage(init || {}) });
  a.__eval(`
    var T = {};
    T.ix = (b, c) => COLORS.findIndex((x) => x.brand === b && x.code === c);
    T.m = (b, c, photo) => Object.assign({ i: T.ix(b, c), how: '' }, photo ? { photo: photo } : {});
    T.q = (code, photo) => Object.assign({ ask: 'brands ' + code, title: code + ': Ohuhu or Copic?', at: 1,
      opts: [{ i: T.ix('Ohuhu', code), how: 'chosen' }, { i: T.ix('Copic', code), how: 'chosen' }] }, photo ? { photo: photo } : {});
    T.rows = (l) => (l || scanList).map((e) => (e.ask ? '?' + e.ask.slice(7) : COLORS[e.i].brand[0] + COLORS[e.i].code) + (e.photo ? '@' + e.photo : ''));
  `);
  return a;
}
const rows = (a, expr) => JSON.parse(a.__eval('JSON.stringify(T.rows(' + (expr || '') + '))'));

test('the list saved carries each entry’s photo, and read back the photos are numbered 1.. in turn, the next photo after them', () => {
  const a = studio();
  a.__eval(
    'scanFind = null; scanList = [T.m("Ohuhu", "R014"), T.q("B04", 5), T.m("Ohuhu", "B03", 5), T.m("Ohuhu", "B08", 3), T.q("YR07")]; scanSaveList();',
  );
  const saved = JSON.parse(a.__eval('localStorage.getItem("ms-scan-list")'));
  assert.deepEqual(
    saved.map((e) => e.p || 0),
    [0, 5, 5, 3, 0],
    'p: the photo, with markers and questions alike',
  );
  assert.equal(saved[0].k, 'Ohuhu|R014');
  assert.deepEqual(rows(a, 'scanParseList(localStorage.getItem("ms-scan-list"))'), [
    'OR014',
    '?B04@2',
    'OB03@2',
    'OB08@1',
    '?YR07',
  ]);
  a.__eval('scanList = scanParseList(localStorage.getItem("ms-scan-list"))');
  assert.equal(a.__eval('scanPhotoMax()'), 2, 'the next photo read is 3');
  // nothing saved, or no photos: as before
  assert.deepEqual(rows(a, 'scanParseList(null)'), []);
  assert.deepEqual(rows(a, 'scanParseList("[{\\"k\\":\\"Ohuhu|R014\\",\\"how\\":\\"\\"}]")'), ['OR014']);
  // a photo number that isn't one (another version's saving): no photo
  assert.deepEqual(
    rows(a, 'scanParseList("[{\\"k\\":\\"Ohuhu|R014\\",\\"how\\":\\"\\",\\"p\\":\\"x\\"}]")'),
    ['OR014'],
  );
  // the page starting with a list of photos saved: the reader numbers on from them
  const b = studio({ 'ms-scan-list': a.__eval('localStorage.getItem("ms-scan-list")') });
  assert.deepEqual(rows(b), ['OR014', '?B04@2', 'OB03@2', 'OB08@1', '?YR07']);
  assert.equal(b.__eval('ocrPhotos'), 2);
});

test('a question every answer of which is in your collection is dropped; one with an answer not yours, or none, stays', () => {
  const a = studio();
  a.__eval(
    'scanFind = null; state.owned = new Set(["Ohuhu|B04", "Copic|B04", "Ohuhu|YR07"]); scanList = [T.q("B04", 1), T.m("Ohuhu", "B03", 1), T.q("YR07"), { ask: "odd", title: "?", opts: [], at: 1 }];',
  );
  assert.equal(a.__eval('scanDropOwned()'), true);
  assert.deepEqual(rows(a), ['OB03@1', '?YR07', '?']);
  assert.equal(a.__eval('scanDropOwned()'), false, 'nothing more to drop');
  assert.equal(JSON.parse(a.__eval('localStorage.getItem("ms-scan-list")')).length, 3, 'saved without it');
  // counted for Add markers' line: the questions left, after the drop; none in Find mode
  a.__eval('state.owned.add("Copic|YR07")');
  assert.equal(a.__eval('scanWaiting()'), 1);
  assert.deepEqual(rows(a), ['OB03@1', '?']);
  assert.match(
    a.__eval('scanWaitHTML("mka")'),
    /^<div class="mkwait" id="mkaWait"><span>1 question still to answer<\/span><button [^>]*data-add="questions" id="mkaQuestions">Answer them<\/button><\/div>$/,
  );
  a.__eval('scanList.push(T.q("B05"))');
  assert.match(a.__eval('scanWaitHTML("mka")'), /2 questions still to answer/);
  a.__eval('scanFind = { brand: "Ohuhu" }');
  assert.equal(a.__eval('scanWaiting()'), 0);
  assert.equal(a.__eval('scanWaitHTML("mka")'), '<div class="mkwait" id="mkaWait" hidden></div>');
  a.__eval('scanFind = null; scanList = []');
  assert.equal(a.__eval('scanWaitHTML("mkc")'), '<div class="mkwait" id="mkcWait" hidden></div>');
});
