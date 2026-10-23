// v319 (Fable Y2-1): how far a picture rebuilt from a saved guide's settings may be from the saved map and still be
// fitted to it (guide/25-source-photo srcFit). Settings saved from v319 on carry v: 2 (the crop and corners exact):
// 2 px. Anything without that mark (v318.34–37, the crop rounded to 1/100) gets 1/100 of the map's long side, at
// least 2 px. srcCheck keeps the mark. Fails on v318.37 (no srcFit; srcSettings and srcCheck write v: 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { core } from './harness.mjs';

const c = (s) => JSON.parse(JSON.stringify(core.srcCheck(s)));

test('srcFit: 2 px for settings marked v: 2, 1/100 of the long side (at least 2) for anything older', () => {
  assert.equal(core.srcFit({ v: 2 }, 1111, 1600), 2);
  assert.equal(core.srcFit({ v: 2 }, 2400, 1800), 2);
  assert.equal(core.srcFit({ v: 1 }, 1111, 1600), 16);
  assert.equal(core.srcFit({}, 1600, 1236), 16);
  assert.equal(core.srcFit(null, 1800, 2400), 24);
  assert.equal(core.srcFit({ v: 1 }, 2400, 1800), 24);
  assert.equal(core.srcFit({ v: 1 }, 1700, 2200), 22);
  assert.equal(core.srcFit({ v: 1 }, 120, 100), 2, 'never under 2');
  assert.equal(core.srcFit({ v: 1 }, 0, 0), 2);
});

test('srcCheck keeps the v: 2 mark, and gives 1 to settings without it (or with anything else)', () => {
  assert.equal(c({ v: 2 }).v, 2);
  assert.equal(c({}).v, 1);
  assert.equal(c({ v: 1 }).v, 1);
  assert.equal(c({ v: 3 }).v, 1);
  assert.equal(c({ v: '2' }).v, 1);
});
