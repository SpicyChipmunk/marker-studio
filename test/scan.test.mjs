// Scan or type codes (v296): what a piece of read text holds — codes as read, the usual mix-ups put right, the colour
// name confirming a code and picking the brand, a cap read upside down turned round.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './harness.mjs';

const C = app.__eval('COLORS');
const nm = (i) => C[i].brand + ' ' + C[i].code;
const read = (t, b = '') => {
  const r = app.scanRead(t, b);
  return { codes: [...r.codes].map((c) => [...c.opts].map(nm)), byName: r.byName >= 0 ? nm(r.byName) : '', flips: [...r.flips].map((f) => [...f.opts].map(nm).sort()) };
};

test('a code and its name: the code, confirmed by the name', () => {
  assert.deepEqual(read('YG06 Sugarcane').codes, [['Ohuhu YG06']]);
  const r = app.scanRead('YG06 Sugarcane', '');
  assert.equal(r.codes[0].named, true);
  assert.equal(r.codes[0].fixed, false);
});

test('the usual mix-ups are put right, and said so', () => {
  assert.deepEqual(read('BO15 Celadon Blue').codes, [['Ohuhu B015']]);
  assert.deepEqual(read('8G011 Teal').codes, [['Ohuhu BG011']]);
  assert.equal(app.scanRead('BO15', '').codes[0].fixed, true);
  // a code read in two pieces, and Copic's C-3 with or without its dash
  assert.deepEqual(read('G 24 Celadon').codes, [['Ohuhu G24']]);
  assert.deepEqual(read('C3').codes, [['Copic C-3']]);
  assert.deepEqual(read('C-3').codes, [['Copic C-3']]);
});

test('a code both brands use: both offered, unless the name or the brand chosen settles it', () => {
  assert.deepEqual(read('B04').codes.map((o) => o.sort()), [['Copic B04', 'Ohuhu B04']]);
  assert.deepEqual(read('B04', 'Ohuhu').codes, [['Ohuhu B04']]);
  const ohName = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B04').name;
  assert.deepEqual(read('B04 ' + ohName).codes, [['Ohuhu B04']]);
});

test('several codes in one go (a pasted list), each once', () => {
  assert.deepEqual(read('R014 Deep Vermilion\nYG07 Honeydew Melon\nBV0000\nR014').codes, [['Ohuhu R014'], ['Ohuhu YG07'], ['Copic BV0000']]);
});

test('only the name read: offered by its name; no code and no name: nothing', () => {
  assert.equal(read('Sugarcane').byName, 'Ohuhu YG06');
  // the longest name read: Honey Brown (E49), not Honey (Y38) as well
  assert.equal(read('Honey Brown').byName, 'Ohuhu E49');
  assert.deepEqual(read('Ohuhu Alcohol Markers'), { codes: [], byName: '', flips: [] });
});

test('a code that is only a number counts only on its own or with its name', () => {
  assert.deepEqual(read('120').codes, [['Ohuhu 120']]);
  assert.deepEqual(read('120 Black').codes, [['Ohuhu 120']]);
  assert.deepEqual(read('O').codes, [], 'a letter O is not the colourless blender 0');
  assert.deepEqual(read('pack of 120').codes, []);
});

test('a cap read upside down is turned round; where that could be two codes, both are offered', () => {
  assert.deepEqual(read('6L3', 'Ohuhu').flips, [['Ohuhu E19']]);
  assert.deepEqual(read('SZA98', 'Ohuhu').flips, [['Ohuhu BGY25']]);
  // E19 or Copic's E79
  assert.deepEqual(read('6L3').flips, [['Copic E19', 'Copic E79', 'Ohuhu E19']]);
  // YR213 upside down with its Y lost reads as R213: both offered
  assert.deepEqual(read('ELZと', 'Ohuhu').flips, [['Ohuhu R213', 'Ohuhu YR213']]);
  // right way up wins: no turning round when a code was read
  assert.deepEqual(read('YG06 6L3', 'Ohuhu').flips, []);
});

test('words are not codes: misreads are put right only in a word with a digit, turning round only with a digit or a turned letter', () => {
  for (const w of ['Egg', 'Bog', 'No', 'BIG', 'TO', 'BOO', 'Sea', 'Dim', 'in', 'ZOO']) {
    const r = app.scanRead(w, '');
    assert.equal(r.codes.length + r.flips.length, 0, w);
  }
  // every marker's code with its name reads as that marker, and its name alone never as a code
  // (v303: but for the colourless blender, 0, which both brands have under the same name: both, to choose between)
  C.forEach((c, i) => {
    const r = app.scanRead(c.code + ' ' + c.name, ''),
      twin = C.filter((d) => d.code === c.code && d.name === c.name).length;
    assert.ok(r.codes.length === 1 && r.codes[0].opts.length === twin && r.codes[0].opts.includes(i), c.brand + ' ' + c.code);
    assert.equal(app.scanRead(c.name, '').codes.length, 0, c.name);
  });
});

test('the name decides between two readings of a misread (YG11 with Ohuhu Y611’s name)', () => {
  const y611 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'Y611');
  assert.deepEqual(read('YG11 ' + y611.name).codes, [['Ohuhu Y611']]);
  assert.deepEqual(read('YG11', 'Copic').codes, [['Copic YG11']]);
});

test('a reading put right that could also be another code upside down asks both ways; a brand left out is said', () => {
  // "603": G03 with 6 for G, or E09 upside down
  const r = app.scanRead('603', 'Copic');
  assert.equal(r.codes.length, 1);
  assert.equal(r.codes[0].asked, 'turned');
  assert.deepEqual([...r.codes[0].opts].map(nm).sort(), ['Copic E09', 'Copic G03']);
  // a Copic code with Ohuhu chosen
  const o = app.scanRead('C-3', 'Ohuhu');
  assert.deepEqual([...o.other].map(nm), ['Copic C-3']);
  assert.equal(o.codes.length, 0);
});

test('the code and the colour name disagree: asked, not the code taken as read (R4b with "Old Rose")', () => {
  const r = app.scanRead('R4b Old Rose', 'Ohuhu');
  assert.equal(r.codes.length, 1);
  assert.equal(r.codes[0].asked, 'name');
  assert.ok([...r.codes[0].opts].map(nm).includes('Ohuhu R46'), 'Old Rose offered');
  assert.equal(app.scanRead('B08 Frost', 'Ohuhu').codes[0].asked, 'name');
});

test('old Ohuhu codes on older caps: the marker they belong to now, by its name; alone, asked when the code is now another marker’s', () => {
  const bv26 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'BV26');
  assert.equal(bv26.old, 'R25');
  assert.deepEqual(read('R25 ' + bv26.name).codes, [['Ohuhu BV26']]);
  assert.equal(app.scanRead('R25 ' + bv26.name, '').codes[0].old, true);
  const r = app.scanRead('R25', 'Ohuhu');
  assert.equal(r.codes[0].asked, 'old');
  assert.deepEqual([...r.codes[0].opts].map(nm).sort(), ['Ohuhu BV26', 'Ohuhu R25']);
  // an old code no marker has now: that marker
  const b015 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B015');
  assert.deepEqual(read(b015.old, 'Ohuhu').codes, [['Ohuhu B015']]);
});

test('with a brand chosen, the other brand’s code (or its name) is said, not bent into the chosen brand’s', () => {
  for (const t of ['YG11', 'YG11 Mignonette', 'E08 Brown', 'B04 Tahitian Blue', 'E000']) {
    const r = app.scanRead(t, 'Ohuhu');
    assert.equal(r.codes.length + r.flips.length, 0, t);
    assert.ok(r.other.length && [...r.other].every((i) => C[i].brand === 'Copic'), t);
  }
});

test('more ways a cap is read: full-width, a dash on its own, the brand on the cap, the name run on, no code made up across two words', () => {
  assert.deepEqual(read('Ｂ０１５').codes, [['Ohuhu B015']]);
  assert.deepEqual(read('C - 3').codes, [['Copic C-3']]);
  assert.deepEqual(read('Ohuhu B04').codes, [['Ohuhu B04']]);
  assert.deepEqual(read('Copic B04').codes, [['Copic B04']]);
  assert.deepEqual(read('B015Celadon Blue').codes, [['Ohuhu B015']]);
  for (const t of ['B63 T-1', 'Y62 T-2']) assert.equal(read(t).codes.length, 2, t + ': its two codes only');
});

