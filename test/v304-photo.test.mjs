// v304 (Photo pattern and photos read in): a picture is shrunk in steps no larger than 16 million pixels, each freed
// as the next is drawn (a step past Safari's canvas limit on iPad came out blank); the Photo pattern works out its
// table of colour differences once per laying, shared by the marker choice and the suggested count. The browser
// tests (e2e/v304-photo.test.mjs) cover the photo through crop, turn, tilt and straighten, its size limits, late
// photos, Palette › From photo's picks and a photo with no colour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// drawShrunk with canvases that only record their sizes (the harness has no real canvas)
let canvasHook = null;
const base = createApp().document,
  doc = new Proxy(base, {
    get: (t, k) => (k === 'createElement' ? (tag) => (tag === 'canvas' && canvasHook ? canvasHook() : t.createElement(tag)) : t[k]),
  }),
  shrinkApp = createApp({ document: doc });
function shrinkRun(sw, sh, w, h) {
  const made = [],
    sizes = [];
  let last = null;
  canvasHook = () => {
    const c = {
      width: 0,
      height: 0,
      // (each step's size as it is drawn: it is freed, set to 0, afterwards)
      getContext: () => ({ drawImage: () => sizes.push([c.width, c.height]) }),
    };
    made.push(c);
    return c;
  };
  const img = { naturalWidth: sw, naturalHeight: sh, width: sw, height: sh },
    dest = { drawImage: (src) => (last = src) };
  try {
    shrinkApp.drawShrunk(dest, img, w, h);
  } finally {
    canvasHook = null;
  }
  return { made, sizes, last: { w: last.width } };
}

test('a 108-megapixel photo is shrunk in steps of at most 16 million pixels, each one freed', () => {
  const r = shrinkRun(12000, 9000, 1600, 1200);
  assert.ok(r.sizes.length >= 1);
  for (const [w, h] of r.sizes) assert.ok(w * h <= 16e6, 'step ' + w + 'x' + h + ' is over the limit');
  // (v303: its first half was 6000 x 4500 = 27 million pixels)
  for (const c of r.made) assert.equal(c.width * c.height, 0, 'every step canvas is freed');
  // (the last step was drawn to the picture before it was freed: its size then is the last recorded)
  const lw = r.sizes[r.sizes.length - 1][0];
  assert.ok(lw >= 1600 && lw < 3200, 'the last step is less than twice the size wanted: ' + lw);
});

test('a 12-megapixel photo is still halved as before', () => {
  const r = shrinkRun(4032, 3024, 1000, 750);
  assert.deepEqual(r.sizes, [[2016, 1512], [1008, 756]]);
  assert.equal(r.last.w, 0, 'drawn from the last step (freed since)');
});

test('the Photo pattern works out its colour differences once for the marker choice and the suggested count', () => {
  const app = createApp(),
    core = app.__mstest,
    pool = [{ mkey: 'A', lab: [60, 10, 0] }, { mkey: 'B', lab: [60, -5, 9] }, { mkey: 'C', lab: [40, 0, -20] }],
    t = [{ l: 1, lab: [60, 9, 0], w: 1 }, { l: 2, lab: [41, 0, -19], w: 2 }];
  const a = core.photoPrepDist(t, pool);
  assert.ok(a.D && a.D.length === a.pr.targets.length * a.pr.pool.length);
  assert.equal(core.photoPrepDist(t, pool), a, 'the same targets and markers: the same table');
  assert.notEqual(core.photoPrepDist(t.slice(), pool), a, 'other targets: worked out afresh');
  // and the choice is the same as before
  assert.deepEqual(
    [...core.photoPick(t, pool, 2, false).chosen.map((m) => m.mkey)].sort(),
    ['A', 'C'],
  );
});
