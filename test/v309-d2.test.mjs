// v309.1 (review 2): "All Copic markers" in findSets. It has every Copic cap, so it came first whenever no real set had
// all the caps read (caps from two sets, one misread), whatever "about how many" said.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp();
const name = (r) => app.__eval(`MARKER_SETS[${r.i}].n`);
const bucket = (t) => app.__eval(`FIND_BUCKETS.findIndex((b) => b.t === ${JSON.stringify(t)})`);
// one cap each from Ciao 24 (R29, E00) and Sketch 72 - Set D (B000): no real set has all three
const mix = ['Copic|R29', 'Copic|E00', 'Copic|B000'];

test('caps no real set has all of: the sets with most of them first, All Copic markers last (not ruled out)', () => {
  for (const t of ['Up to 30', '31–60', '61–100', '101–150', '151–250']) {
    const r = app.findSets('Copic', bucket(t), mix);
    assert.notEqual(name(r[0]), 'All Copic markers', t);
    assert.equal(r[0].all, false, t);
    assert.equal(name(r.at(-1)), 'All Copic markers', t);
    assert.equal(r.at(-1).far, true);
    // the welcome's list: none has every cap, so all of them, the most caps first
    const l = app.__eval(
      `findList(findSets('Copic', ${bucket(t)}, ${JSON.stringify(mix)})).map((x) => MARKER_SETS[x.i].n)`,
    );
    assert.notEqual(l[0], 'All Copic markers');
    assert.equal(l.at(-1), 'All Copic markers');
  }
});

test('more than 250 Copic markers: All Copic markers first', () => {
  const r = app.findSets('Copic', bucket('More than 250'), mix);
  assert.equal(name(r[0]), 'All Copic markers');
  assert.ok(r[0].all && !r[0].far);
});

test('caps one real set has: that set first, All Copic markers after the sets with every cap', () => {
  const r = app.findSets('Copic', bucket('Up to 30'), ['Copic|R29', 'Copic|E00']);
  const l = app.__eval(
    `findList(findSets('Copic', ${bucket('Up to 30')}, ['Copic|R29', 'Copic|E00'])).map((x) => MARKER_SETS[x.i].n)`,
  );
  assert.equal(name(r[0]), 'Ciao 24');
  assert.equal(l.at(-1), 'All Copic markers');
  assert.ok(l.length > 1);
});
