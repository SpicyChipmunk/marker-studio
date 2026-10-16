// v318.7: a photo whose reading failed (out of memory, read again gently; or given up) takes back out what it added at
// once, as closing Scan mid-photo does: its end never checked those (a cap cut by the photo's edge, one look's
// misreading, the photo's brand). Readings made up here (the reader itself isn't run). Fails on v318.6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a photo's first lines read, then the reader fails: { before, after, also } (the list's keys; also: a marker typed
// before the photo, kept)
function failed(memory) {
  const app = createApp();
  return JSON.parse(
    app.__eval(
      '(function () {' +
        'scanList = []; scanBrand = "Ohuhu"; ocrPhotos = 1;' +
        'scanHandleCodes("R014");' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r; ocrGo = function () {};' +
        '["B015", "B03", "808"].forEach((t, k) => ocrLine(r, { id: k + 1, look: 1, text: t, conf: 0.98, unsure: false,' +
        '  nameOf: 0, box: [100 + 200 * k, 100, 60, 30, 0] }));' +
        'const before = scanList.map((e) => (e.ask ? "?" : mkey(e.i)));' +
        'ocrFailed({ memory: ' +
        (memory ? 'true' : 'false') +
        ' });' +
        'return JSON.stringify({ before: before, after: scanList.map((e) => (e.ask ? "?" : mkey(e.i))),' +
        ' bent: (r.bent || []).length, gentle: !!r.gentle, done: !!r.done });' +
        '})()',
    ),
  );
}

test('out of memory: the first try’s adds come out before the photo is read again gently', () => {
  const o = failed(true);
  assert.ok(o.before.includes('Ohuhu|B015'), 'added at once while read: ' + o.before.join(' '));
  assert.deepEqual(o.after, ['Ohuhu|R014'], 'only what was there before the photo');
  assert.equal(o.bent, 0, 'its digits to ask about ("808") let go of too');
  assert.equal(o.gentle, true);
});

test('the reader given up: the photo’s adds come out, what was there before stays', () => {
  const o = failed(false);
  assert.ok(o.before.includes('Ohuhu|B03'), o.before.join(' '));
  assert.deepEqual(o.after, ['Ohuhu|R014']);
  assert.equal(o.done, true);
});
