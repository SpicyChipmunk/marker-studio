// v303: Scan or type codes, put right after a close look: numbers and prices aren't markers, the brand on the cap and
// a word of a name settle what they can, codes in pieces and a few more misreads are read, and in the dialog a question
// answered (or a cap still in view) isn't asked again, a second cap with the same code is, and a name read settles a
// question about the same cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const app = createApp({ localStorage: memoryStorage() }), E = app.__eval;
const C = E('COLORS');
const nm = (i) => C[i].brand + ' ' + C[i].code;
const read = (t, b = '') => {
  const r = app.scanRead(t, b);
  return JSON.parse(JSON.stringify({
    codes: r.codes.map((c) => [c.opts.map(nm).sort().join('|'), c.asked]),
    byName: r.byName >= 0 ? nm(r.byName) : '',
    byNames: (r.byNames || []).map(nm).sort(),
    other: r.other.map(nm),
    names2: (r.names2 || []).map((a) => a.map(nm).sort()),
  }));
};

test('numbers and prices beside a code aren’t markers (a price’s 99 had added Ohuhu G112)', () => {
  assert.deepEqual(read('E19 Dried Sage $3.99').codes, [['Ohuhu E19', '']]);
  assert.deepEqual(read('R46 Old Rose 2.99').codes, [['Ohuhu R46', '']]);
  assert.deepEqual(read('61\tE19 Dried Sage').codes, [['Ohuhu E19', '']]);
  assert.deepEqual(read('Item 6012').codes, []);
  assert.deepEqual(read('pack of 100', 'Ohuhu'), { codes: [], byName: '', byNames: [], other: [], names2: [] });
  assert.deepEqual(read('Ohuhu 120 Colors', 'Copic').other, []);
  // a count beside a number-only code, or after a code without digits
  assert.deepEqual(read('120 x2').codes, [['Ohuhu 120', '']]);
  assert.deepEqual(read('2x 120').codes, [['Ohuhu 120', '']]);
  assert.deepEqual(read('2 FB').codes, [['Copic FB', '']]);
  // a code without digits among words that aren't codes isn't one
  assert.deepEqual(read('see the FB page').codes, []);
  // a name's own number ("No.0") isn't a code
  assert.deepEqual(read('C-0 No.0').codes, [['Copic C-0', '']]);
});

test('a word of a name read beside a code settles it, or says nothing, rather than asking about another marker', () => {
  assert.deepEqual(read('BG212 Green').codes, [['Ohuhu BG212', '']]);
  const b21 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B21');
  const w = b21.name.split(' ')[0];
  assert.deepEqual(read('B21 ' + w).codes, [['Ohuhu B21', '']], w);
});

test('the brand on the cap settles a question it can (Copic R12, not Ohuhu’s R12 or the marker that was R12)', () => {
  assert.deepEqual(read('Copic R12').codes, [['Copic R12', '']]);
  assert.deepEqual(read('R12 Copic').codes, [['Copic R12', '']]);
  // Ohuhu has no Y13 now: its old Y13
  const r = app.scanRead('Ohuhu Y13', '');
  assert.equal(r.codes.length, 1);
  assert.equal(nm(r.codes[0].opts[0]), 'Ohuhu E515');
  assert.equal(r.codes[0].old, true);
  // a name both brands use: the cap's brand picks it; alone, both offered
  assert.equal(read('Ohuhu Tahitian Blue').byName, 'Ohuhu B09');
  assert.deepEqual(read('Tahitian Blue').byNames, ['Copic B04', 'Ohuhu B09']);
  assert.deepEqual(read('Tahitian Blue\nE19').names2, [['Copic B04', 'Ohuhu B09']]);
});

test('a code read in pieces is that code only (E 614 had added Copic G14 as well)', () => {
  assert.deepEqual(read('E 614').codes, [['Ohuhu E614', '']]);
  assert.deepEqual(read('E.614').codes, [['Ohuhu E614', '']]);
  assert.deepEqual(read('B G05').codes, [['Copic BG05|Ohuhu BG05', '']]);
  assert.deepEqual(read('R V 17', 'Copic').codes, [['Copic RV17', '']]);
  assert.deepEqual(read('FY 00').codes, [['Ohuhu FY00', '']]);
});

test('more misreads: | or ! for 1, a T that could be 1 or 7 (asked), O for 0 in Copic’s greys, WG0.5, and Ⅱ read as ll', () => {
  assert.deepEqual(read('B|12').codes, [['Ohuhu B112', '']]);
  assert.deepEqual(read('B1!1').codes, [['Ohuhu B111', '']]);
  assert.deepEqual(read('E1T').codes, [['Copic E11|Copic E17|Ohuhu E17', 'fix']]);
  assert.deepEqual(read('E1T', 'Ohuhu').codes, [['Ohuhu E17', '']]);
  assert.deepEqual(read('C-O').codes, [['Copic C-0', '']]);
  assert.deepEqual(read('W-O').codes, [['Copic W-0', '']]);
  assert.deepEqual(read('WG0.5').codes, [['Ohuhu YR02', '']]);
  assert.deepEqual(read('BGll03').codes, [['Ohuhu B310', '']]);
  assert.deepEqual(read('CGll00').codes, [['Ohuhu WG10', '']]);
  assert.deepEqual(read('Cool Gray 3').byName, 'Copic C-3');
  // Ohuhu's colourless blender is 0 too
  assert.deepEqual(read('Ohuhu 0').codes, [['Ohuhu 0', '']]);
  assert.deepEqual(read('Copic 0').codes, [['Copic 0', '']]);
});

test('a long line of number-only codes is read in good time', () => {
  const t0 = Date.now();
  app.scanRead('120 '.repeat(5000), '');
  app.scanRead('0 '.repeat(20000), '');
  assert.ok(Date.now() - t0 < 2000, Date.now() - t0 + ' ms');
});

// the dialog's reading of text as it comes from Scan Text (not loud), at times we set
function dialog() {
  const a = createApp({ localStorage: memoryStorage() });
  let now = 1e12;
  a.__eval('Date').now = () => now;
  const at = (ms) => (now += ms);
  const list = () => JSON.parse(JSON.stringify(a.__eval('scanList').map((e) => (e.ask ? '?' + e.ask : nm(e.i)))));
  return { a, at, list, handle: (t, loud = false) => a.scanHandle(t, loud) };
}

test('dialog: a question answered isn’t asked again while the two caps stay in view', () => {
  const d = dialog();
  d.handle('B015 Celadon Blue B04');
  assert.deepEqual(d.list(), ['?brands B04', 'Ohuhu B015']);
  // answered: Copic (as the list's button does)
  d.a.__eval(`(function(){ const q = scanList[0]; scanAnsweredAt.set(q.ask, Date.now()); scanList.splice(0, 1); scanTake(q.opts.find((o) => COLORS[o.i].brand === 'Copic').i, 'chosen', true); })()`);
  for (let k = 0; k < 8; k++) {
    d.at(850);
    d.handle('B015 Celadon Blue B04');
  }
  assert.deepEqual(d.list(), ['Copic B04', 'Ohuhu B015']);
});

test('dialog: a second cap with the same code is asked about once the first has gone (it had been ignored for good)', () => {
  const d = dialog();
  d.handle('B04 Pale Cyan');
  assert.deepEqual(d.list(), ['Ohuhu B04']);
  // the Copic B04 cap, read as "B04" again and again: not at once (the first cap could still be in view), then asked
  d.at(850);
  d.handle('B04');
  assert.deepEqual(d.list(), ['Ohuhu B04']);
  for (let k = 0; k < 3; k++) {
    d.at(850);
    d.handle('B04');
  }
  assert.deepEqual(d.list(), ['?brands B04', 'Ohuhu B04']);
});

test('dialog: the cap’s name read settles the question its code alone raised a moment ago', () => {
  const d = dialog();
  d.handle('YG06');
  assert.deepEqual(d.list(), ['?brands YG06']);
  d.at(900);
  d.handle('YG06 Sugarcane');
  assert.deepEqual(d.list(), ['Ohuhu YG06']);
});

test('dialog: a list pasted twice asks nothing twice', () => {
  const d = dialog();
  const t = 'Honey Brown\nB04\nE19';
  d.handle(t, true);
  const n = d.list().length;
  d.a.__eval(`scanList = scanList.filter((e) => !e.ask || !/^byname/.test(e.ask)); scanTake(COLORS.findIndex((c) => c.name === 'Honey Brown'), 'name', true)`);
  d.at(5000);
  d.handle(t, true);
  assert.equal(d.list().filter((x) => /byname/.test(x)).length, 0, d.list().join());
  assert.ok(d.list().length <= n + 1);
});
