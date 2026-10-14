// v318: a set's name in pasted text (its box, an order email, a shop's page) is read: the sets it could be, one when
// the name says which. Not a price, an order number, a quantity, nor the number in a code read off a cap. Fails on v317.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp(),
  E = app.__eval;
// (through JSON: arrays from the app's own realm)
const sets = (text, brand) =>
  JSON.parse(
    E(
      'JSON.stringify(scanSets(' +
        JSON.stringify(text) +
        (brand ? ',' + JSON.stringify(brand) : '') +
        ').map((g) => g.map((i) => MARKER_SETS[i].n)))',
    ),
  );

test('a set named on a shop page, a box or an order: which set', () => {
  const cases = [
    ['Ohuhu Alcohol Markers Honolulu Series 120 Colors Dual Tip Brush & Chisel', ['Honolulu 120']],
    // (a box's words, a line each, as Live Text copies them)
    ['OHUHU\nHONOLULU\nALCOHOL MARKERS\n120\nCOLORS', ['Honolulu 120']],
    ['OHUHU\nHONOLULU\nSET OF 48 COLORS', ['Honolulu 48']],
    ['Ohuhu Honolulu 320 Colors', ['Honolulu 320 (complete set)']],
    // (a line naming another of Ohuhu's sets isn't also Honolulu 48)
    ['Ohuhu Honolulu 48 Mid-tone Colors Alcohol Markers', ['48 Mid-tone Set']],
    ['Ohuhu Alcohol Markers 36 Skin Tone Colors', ['36 Skin Tones']],
    ['Ohuhu 36 Grey Tones Alcohol Markers', ['36 Gray Tones']],
    ['Ohuhu Pastel Markers 48 Colors - Sweetness', ['48 Pastel - Sweetness']],
    ['Ohuhu Alcohol Markers 24 Colors Portrait', ['24 Portrait']],
    ['Ohuhu Alcohol Markers 104 Colors', ['104 Colors Set']],
    ['Copic Ciao Markers 36 Color Set A', ['Ciao 36 - Set A']],
    ['Copic Ciao Set 72A', ['Ciao 72 - Set A']],
    ['Copic Ciao 12 Colours', ['Ciao 12']],
    ['Copic Sketch Marker 24 Color Set Manga', ['Sketch 24 - Manga']],
    ['Copic Sketch 72 Colors Set B', ['Sketch 72 - Set B']],
    ['Copic Sketch 12 Colors Basic', ['Sketch 12']],
    // (two sets in one order: one each)
    ['Honolulu 24 Colors and Honolulu 48 Colors', [['Honolulu 24'], ['Honolulu 48']]],
  ];
  for (const [t, want] of cases) assert.deepEqual(sets(t), Array.isArray(want[0]) ? want : [want], t);
});

test('a name that doesn’t say which: the sets it could be, to choose from', () => {
  assert.deepEqual(sets('Copic Ciao 36 Colors'), [
    ['Ciao 36 - Set A', 'Ciao 36 - Set B', 'Ciao 36 - Set C', 'Ciao 36 - Set D', 'Ciao 36 - Set E'],
  ]);
  assert.deepEqual(sets('Ohuhu Pastel 48 Colors'), [['48 Pastel - Sweetness', '48 Pastel - Blossoming']]);
  // (Sketch 24 is only the Manga set here: not offered without its name)
  assert.deepEqual(sets('Copic Sketch 24 Colors'), []);
});

test('an order email: each set, not its price, order number or quantity; only the brand asked for', () => {
  const order =
    'Order #112-4824839-1234567\nOhuhu Honolulu Markers, 72 Colors\nQty: 1\n$48.99\nCopic Ciao Markers 36 Color Set A\n$120.00\nSubtotal £24';
  assert.deepEqual(sets(order), [['Honolulu 72'], ['Ciao 36 - Set A']]);
  assert.deepEqual(sets(order, 'Copic'), [['Ciao 36 - Set A']]);
  assert.deepEqual(sets(order, 'Ohuhu'), [['Honolulu 72']]);
  // (and none of it read as a marker's code)
  assert.deepEqual(E('scanRead(' + JSON.stringify(order) + ', "").codes.length'), 0);
});

test('a tray’s text, codes read off caps with the brand on them: no set', () => {
  for (const t of [
    'OHUHU HONOLULU\nY28 R014 BG314\nE24 B48\nHONOLULU\n0',
    'HONOLULU R 24 Y 48',
    'COPIC CIAO E00 R24 YG06\nCIAO B24 100',
    'Honolulu markers are great for skin and grey',
  ])
    assert.deepEqual(sets(t), [], t);
});

// (v318.1) a tray's text with the case's HONOLULU and the Black marker's code, 120, on lines of their own: no set, and
// the 120 is still read as a code; a box's words a line each still name the set; "Honolulu B" is the range too
test('a tray’s text with HONOLULU and the 120 Black cap on lines of their own: a code, not Honolulu 120', () => {
  for (const t of ['HONOLULU\nR014\n120\nY28', 'HONOLULU\n120\nR014\nY28\nBG314'])
    assert.deepEqual(sets(t), [], t);
  const r = JSON.parse(
    E(
      'JSON.stringify(scanRead("HONOLULU\\nR014\\n120\\nY28", "").codes.map((c) => c.opts.map((i) => COLORS[i].brand + " " + COLORS[i].code)))',
    ),
  );
  assert.ok(
    r.some((o) => o.indexOf('Ohuhu 120') >= 0),
    'Ohuhu 120 Black is read',
  );
  // (a box's words, a line each, and the size on a line of its own: still the set)
  assert.deepEqual(sets('OHUHU\nHONOLULU\n120\nCOLORS'), [['Honolulu 120']]);
  assert.deepEqual(sets('OHUHU\nHONOLULU\n120'), [['Honolulu 120']]);
  // (a set named on a line of its own above the codes: still the set)
  assert.deepEqual(sets('Honolulu 120\nR014\nY28'), [['Honolulu 120']]);
  // (an order's name wrapped onto the next line, with codes below)
  assert.deepEqual(sets('Ohuhu Honolulu Markers,\n72 Colors\nR014 Y28'), [['Honolulu 72']]);
});

test('Honolulu B, the range’s second series: its size isn’t taken for a code "B 120"', () => {
  assert.deepEqual(sets('Ohuhu Honolulu B 120 Colors'), [['Honolulu 120']]);
  assert.deepEqual(sets('OHUHU\nHONOLULU B\n72 COLORS'), [['Honolulu 72']]);
  // (a code split by Live Text, "R 24", still isn't a size)
  assert.deepEqual(sets('HONOLULU R 24 Y 48'), []);
});
