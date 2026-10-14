// v318 review (adding markers, 9): two lettered sets in one name, "Copic Ciao 72 Set A and Set B", are both found (only
// Set A had been). Fails on v318.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp();
const sets = (t) =>
  JSON.parse(
    app.__eval(
      `JSON.stringify(scanSets(${JSON.stringify(t)}, '').map((g) => g.map((i) => MARKER_SETS[i].n)))`,
    ),
  );

test('two letters of one size: a set each', () => {
  assert.deepEqual(sets('Copic Ciao 72 Set A and Set B'), [['Ciao 72 - Set A'], ['Ciao 72 - Set B']]);
  assert.deepEqual(sets('COPIC CIAO 72 SET A AND SET B'), [['Ciao 72 - Set A'], ['Ciao 72 - Set B']]);
  assert.deepEqual(sets('Copic Sketch 72 Sets C and D'), [['Sketch 72 - Set C'], ['Sketch 72 - Set D']]);
  assert.deepEqual(sets('Copic Ciao 36A, 36B'), [['Ciao 36 - Set A'], ['Ciao 36 - Set B']]);
});

test('one letter, or none, as before', () => {
  assert.deepEqual(sets('Copic Ciao 36 Set C'), [['Ciao 36 - Set C']]);
  assert.deepEqual(sets('Copic Ciao 72 - B'), [['Ciao 72 - Set B']]);
  assert.deepEqual(sets('Copic Ciao Markers 36 Colors'), [
    ['Ciao 36 - Set A', 'Ciao 36 - Set B', 'Ciao 36 - Set C', 'Ciao 36 - Set D', 'Ciao 36 - Set E'],
  ]);
});
