// v318.24: Scan's box reads a Copic grey upside down ("8-N" is N-8), only in that shape (a date with a dash isn't a
// marker); a run of zeros isn't G0000; a number or a size read upside down as one marker is asked, not added.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const a = createApp();
// what scanRead makes of a word read upside down: each option as "Brand CODE", and whether it's sure
const flips = (t, brand = '') =>
  JSON.parse(
    a.__eval(
      `JSON.stringify(scanRead(${JSON.stringify(t)}, ${JSON.stringify(brand)}).flips.map((f) => ({ opts: f.opts.map((i) => COLORS[i].brand + ' ' + COLORS[i].code).sort(), sure: f.sure })))`,
    ),
  );

test('a Copic grey read upside down: its number, the dash, the family turned', () => {
  assert.deepEqual(flips('8-N'), [{ opts: ['Copic N-8'], sure: true }]);
  assert.deepEqual(flips('01-N'), [{ opts: ['Copic N-10'], sure: true }]);
  assert.deepEqual(flips('00-M'), [{ opts: ['Copic W-00'], sure: true }]);
  // a turned 3 reads E: C-3 upside down is "E-C" (letters only, so asked, as a size would be)
  assert.deepEqual(flips('E-C'), [{ opts: ['Copic C-3'], sure: false }]);
  // a turned 7 reads L, as a 1 might: asked between them
  assert.deepEqual(flips('L-M'), [{ opts: ['Copic W-1', 'Copic W-7'], sure: false }]);
  // the dash of another kind, or with spaces round it
  for (const t of ['8–N', '8 - N', '8 -N', '8 — N'])
    assert.deepEqual(flips(t), [{ opts: ['Copic N-8'], sure: true }], t);
  // the right way up, as before
  assert.equal(a.__eval(`scanRead('N-8', '').codes[0].code`), 'N8');
});

test('words with a dash that aren’t a turned grey stay unread (dates, times, ranges, sizes as markers unasked)', () => {
  for (const t of [
    '6-13',
    '1-23',
    '2-10',
    '9-10',
    '12-8',
    '5-00',
    '00-0',
    '123-456',
    'E-MAIL',
    'T-SHIRT',
    'X-LARGE',
  ])
    assert.deepEqual(flips(t), [], t);
  // a size in the grey's shape: asked, never added on its own
  for (const t of ['S-M', 'H-M', 'B-C']) {
    const f = flips(t);
    assert.equal(f.length, 1, t);
    assert.equal(f[0].sure, false, t);
  }
});

test('a run of zeros isn’t Copic G0000 upside down; a turned G0000 (its G read as 9) still is', () => {
  for (const t of ['000', '0000', '00000']) assert.deepEqual(flips(t), [], t);
  assert.ok(flips('00009').some((f) => f.opts.includes('Copic G0000')));
});

test('a number read upside down as one marker is asked, not added (digits bent into a code, as v318.2)', () => {
  for (const t of ['1100', '001', '123']) {
    const f = flips(t);
    assert.ok(f.length && f.every((x) => x.sure === false), t + ': ' + JSON.stringify(f));
  }
  // in Scan's box: the question, nothing in the list
  const b = createApp();
  b.__eval(`scanList = []; scanBrand = ''; scanHandle('1100', false)`);
  assert.equal(b.__eval('scanList.filter((e) => !e.ask).length'), 0);
  assert.equal(b.__eval('scanList.filter((e) => e.ask).length'), 1);
  // a turned grey on its own goes in, said as read upside down
  b.__eval(`scanList = []; scanHandle('8-N', false)`);
  assert.deepEqual(
    JSON.parse(b.__eval('JSON.stringify(scanList.filter((e) => !e.ask).map((e) => COLORS[e.i].code))')),
    ['N-8'],
  );
});
