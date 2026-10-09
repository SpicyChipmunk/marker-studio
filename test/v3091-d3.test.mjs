// v309.2 (reviewer 3): Markers and Palette.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp();
const size = (n) => app.__eval(`presetSize(MARKER_SETS.find((p) => p.n === ${JSON.stringify(n)}))`);
const row = (n) => {
  const h = app.__eval('presetListHTML()'),
    m = h.match(
      new RegExp(
        '<span class="presetnm">' +
          n.replace(/[()]/g, '\\$&') +
          '</span><span class="presetn">([^<]*)</span>',
      ),
    );
  return m && m[1];
};

test("a Copic set's Colorless Blender is one of the markers its name counts; an Ohuhu set's added one isn't", () => {
  // (v309's "a set's size is its colours" had made Ciao 36 Set B 35 and All Copic markers 357)
  assert.equal(size('Ciao 36 - Set B'), 36);
  assert.equal(size('Ciao 72 - Set A'), 72);
  assert.equal(size('Sketch 72 - Set B'), 72);
  assert.equal(size('All Copic markers'), 358);
  assert.equal(row('Ciao 36 - Set B'), '36');
  assert.equal(row('All Copic markers'), '358');
  // the Ohuhu sets as v309 has them
  assert.equal(size('Honolulu 120'), 120);
  assert.equal(size('Honolulu 320 (complete set)'), 320);
  assert.equal(row('Honolulu 120'), '120');
});
