// v318.22 Look closer: a photo read is kept for it (not one read closer already, nor one no bigger than its copy); its
// spots are the lines that didn't settle into a marker; the lines read closer are settled with the photo's own, what
// that adds added under the photo's number, and a marker taken off the list since, or a question the photo had asked,
// left as they are. Fails on v318.21.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'];
// a photo read: the tray above and the extra lines given, then `then` run in the app; returns what it returns
function run(extra, then, img) {
  const a = createApp();
  return JSON.parse(
    a.__eval(
      '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1; ocrCloserList = [];' +
        'const r = { n: 1, file: { name: "x.jpg" }, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null,' +
        ' done: false, note: "", img: ' +
        JSON.stringify(img || { w: 1536, h: 2048, ow: 3024, oh: 4032 }) +
        ' }; ocrRun = r; let id = 0;' +
        'const lines = ' +
        JSON.stringify(OLD) +
        '.map((t, k) => ({ id: ++id, look: 1, text: t, conf: 0.97, unsure: false, nameOf: 0, box: [100 + 200 * (k % 6), 100 + 300 * Math.floor(k / 6), 60, 30, 0] }));' +
        JSON.stringify(extra) +
        '.forEach((l) => lines.push(Object.assign({ id: ++id, look: 1, conf: 0.6, unsure: true, nameOf: 0 }, l)));' +
        'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
        'const p = ocrCloserList[0], k = (e) => e.ask ? "ask " + e.opts.map((o) => mkey(o.i)).join(",") : mkey(e.i) + " #" + e.photo;' +
        'return JSON.stringify((' +
        then +
        ')(p, k)); })()',
    ),
  );
}
// the lines read closer: GY5 with its name, where "GYX9" and "Absinme" were read
const CLOSER =
  '{ lines: [{ id: 901, look: 1, text: "GY5", conf: 0.98, unsure: false, nameOf: 0, box: [700, 1500, 60, 30, 0] },' +
  ' { id: 902, look: 1, text: "Absinthe", conf: 0.98, unsure: false, nameOf: 901, box: [700, 1540, 80, 20, 0] }] }';
const MISREAD = [
  { text: 'GYX9', box: [700, 1500, 60, 30, 0] },
  { text: 'Absinme', box: [700, 1540, 80, 20, 0] },
];

test('a photo read is kept for Look closer; its spots are the lines that didn’t settle', () => {
  const r = run(
    MISREAD,
    '(p) => ({ kept: !!p, n: p && p.n, spots: p ? ocrCloserSpots(p).map((x) => x.text) : [] })',
  );
  assert.equal(r.kept, true);
  assert.equal(r.n, 1);
  assert.deepEqual(r.spots, ['GYX9', 'Absinme']);
  // (not a photo no bigger than its copy)
  assert.equal(run(MISREAD, '(p) => !!p', { w: 1536, h: 2048, ow: 1536, oh: 2048 }), false);
  // (nor one read closer already, or gently)
  assert.equal(
    run(
      MISREAD,
      '() => { ocrCloserList = []; const im = { w: 1536, h: 2048, ow: 3024, oh: 4032 };' +
        ' ocrCloserKeep({ n: 2, file: {}, detail: true, img: im }, []); ocrCloserKeep({ n: 3, file: {}, low: true, img: im }, []);' +
        ' return ocrCloserList.length; }',
    ),
    0,
  );
});

test('what the closer read settles is added under the photo’s number', () => {
  const r = run(MISREAD, '(p, k) => ocrCloserMerge(p, ' + CLOSER + ').map(k)');
  assert.deepEqual(r, ['Ohuhu|YG211 #1']);
});

test('a marker taken off the list since, or a question the photo asked, is left as it is', () => {
  // (YG211 listed by the photo, then taken off: not put back)
  const a = run(
    [{ text: 'GY5', conf: 0.98, unsure: false, box: [700, 1500, 60, 30, 0] }],
    '(p, k) => { scanList = scanList.filter((e) => e.ask || mkey(e.i) !== "Ohuhu|YG211"); return ocrCloserMerge(p, ' +
      CLOSER +
      ').map(k); }',
  );
  assert.deepEqual(a, []);
  // (BG期05 asked by the photo, the question taken off: not asked again)
  const b = run(
    [{ text: 'BG期05', conf: 0.98, unsure: false, box: [700, 1500, 60, 30, 0] }],
    '(p, k) => { const q = scanList.filter((e) => e.ask).length; scanList = scanList.filter((e) => !e.ask);' +
      ' return { q: q, again: ocrCloserMerge(p, { lines: [] }).map(k) }; }',
  );
  assert.equal(b.q, 1);
  assert.deepEqual(b.again, []);
});
