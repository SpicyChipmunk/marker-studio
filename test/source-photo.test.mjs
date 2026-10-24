// The picture kept with each guide.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, core, createApp } from './harness.mjs';

// ---- from v31834-source-photo.test.mjs ----
// v318.34 (Stage 3 C): the source picture kept with a guide. srcRecOk (guide-bridge) checks a 'src-<id>' record as a
// backup carries it; srcCheck (guide/25-source-photo) reads a saved guide's `src` settings, kept in range or dropped.
// Each fails on v318.33 (neither exists).
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app,
    core = _app.__mstest;
  const ok = (r) => app.__eval('srcRecOk')(r);
  // (the app runs in its own realm: compared by value, not by prototype)
  const c = (s) => JSON.parse(JSON.stringify(core.srcCheck(s)));
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  test('srcRecOk: a data: URL picture with a size; nothing else, and nothing over SRC_MAX', () => {
    assert.equal(app.__eval('SRC_MAX'), 8e6);
    assert.equal(ok({ u: PNG, w: 10, h: 12, ts: 1, kind: 'scan' }), true);
    assert.equal(
      ok({ u: 'data:image/jpeg;base64,/9j/4AAQ', w: 2400, h: 1800, ts: 1 }),
      true,
      'kind optional',
    );
    assert.equal(ok(null), false);
    assert.equal(ok({ u: PNG, w: 0, h: 12 }), false, 'no width');
    assert.equal(ok({ u: 'data:text/html;base64,PHNjcmlwdD4=', w: 10, h: 10 }), false, 'not a picture');
    assert.equal(ok({ u: 'data:image/png;base64,abc<svg>', w: 10, h: 10 }), false, 'not base64');
    assert.equal(ok({ u: 'data:image/jpeg;base64,' + 'A'.repeat(8e6), w: 10, h: 10 }), false, 'too big');
  });
  test('srcCheck: the settings a guide was built with, kept in range; a corner list of four points; anything odd dropped', () => {
    assert.equal(c(null), null);
    assert.equal(c('x'), null);
    assert.equal(c([1, 2]), null);
    // defaults for an empty object: a scan as it came, Sensitivity 5 (adaptC 9), Enhance on
    assert.deepEqual(c({}), { v: 1, k: 'scan', rot: 0, tilt: 0, enh: 1, c: 9 });
    const full = c({
      v: 1,
      k: 'photo',
      q: [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ],
      shape: 'a4',
      hint: 'kept',
      f35: 26,
      up: 1,
      rot: 270,
      tilt: 3.4,
      crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
      enh: 0,
      c: 6,
      su: 1,
      fc: 180,
    });
    assert.deepEqual(full, {
      v: 1,
      k: 'photo',
      rot: 270,
      tilt: 3.4,
      enh: 0,
      c: 6,
      q: [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ],
      shape: 'a4',
      hint: 'kept',
      f35: 26,
      up: 1,
      crop: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
      su: 1,
      fc: 180,
    });
    // out of range or odd: clamped or dropped
    const odd = c({
      k: 'gif',
      q: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
      shape: 'poster',
      hint: 'other',
      f35: -5,
      up: 2,
      rot: 45,
      tilt: 99,
      crop: { x: 0, y: 0, w: 1, h: 1 },
      enh: 'yes',
      c: 40,
      su: 'y',
      fc: 300,
    });
    assert.deepEqual(odd, { v: 1, k: 'scan', rot: 0, tilt: 8, enh: 1, c: 16 });
    assert.equal(c({ crop: { x: 0.5, y: 0.5, w: 0, h: 0.5 } }).crop, undefined, 'an empty crop is none');
  });
}

// ---- from v319-src-fit.test.mjs ----
// v319 (Fable Y2-1): how far a picture rebuilt from a saved guide's settings may be from the saved map and still be
// fitted to it (guide/25-source-photo srcFit). Settings saved from v319 on carry v: 2 (the crop and corners exact):
// 2 px. Anything without that mark (v318.34–37, the crop rounded to 1/100) gets 1/100 of the map's long side, at
// least 2 px. srcCheck keeps the mark. Fails on v318.37 (no srcFit; srcSettings and srcCheck write v: 1).
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
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
}
