// v318.21, the reader: a code misread by one character is put right by the whole name read beside it ("5110" with
// "Dark Suntan" is E110, YR312's older cap), listed with "read as “5110”"; and a Π read for the grey caps' Ⅱ is that Ⅱ.
// Fails on v318.20.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a photo's lines: [code, [name lines linked to it], [name lines nearby, not linked]], six caps a row
function photo(caps) {
  const a = createApp();
  return JSON.parse(
    a.__eval(
      '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1;' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r; let id = 0; const lines = [];' +
        JSON.stringify(caps) +
        '.forEach((t, k) => { const x = 300 * (k % 6), y = 400 * Math.floor(k / 6), me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
        '  (t[1] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: me, box: [x, y + 30 + 20 * j, 80, 20, 0] }));' +
        '  (t[2] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: 0, box: [x + 10, y + 40 + 20 * j, 80, 20, 0] })); });' +
        'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + (e.how === "fixed" ? " as " + e.as : "")),' +
        ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) }); })()',
    ),
  );
}
// a tray of older Ohuhu caps read right
const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'].map(
  (c) => [c],
);

test('a code misread by one character, with its whole name beside it: that marker, listed, "read as" on its row', () => {
  const p = photo(
    OLD.concat([
      ['5110', ['Dark', 'Suntan']],
      // ("Cocoa Brown" is Copic E74's name too: the code decides, E400 being E97's older cap)
      ['F400', [], ['Cocoa', 'Brown']],
      ['RVO70', ['Sakura Pink']],
    ]),
  );
  for (const k of ['Ohuhu|YR312 as 5110', 'Ohuhu|E97 as F400', 'Ohuhu|RV09 as RVO70'])
    assert.ok(p.list.includes(k), k + ' in ' + JSON.stringify(p));
  assert.ok(!p.list.some((k) => /^Copic\|E74/.test(k)), JSON.stringify(p));
  // (said on its row and kept through a reload of the list: e2e/v31821-reader)
});

test('not put right: part of the name, a short reading, a code as read', () => {
  // (one word of the name only)
  const a = photo(OLD.concat([['5110', ['Dark']]]));
  assert.ok(!a.list.some((k) => /YR312/.test(k)), JSON.stringify(a));
  // (two characters: no code is guessed from so little)
  const b = photo(OLD.concat([['00', ['Cocoa Brown']]]));
  assert.ok(!b.list.some((k) => /E97|E74/.test(k)), JSON.stringify(b));
  // (a code as it is is read as itself, E110 YR312's older cap, not put right to another one character away)
  const c = photo(OLD.concat([['E110', ['Sardonyx']]]));
  assert.ok(!c.list.some((k) => / as /.test(k)) && !c.list.includes('Ohuhu|R15'), JSON.stringify(c));
});

test('a Π read for the grey caps’ Ⅱ is that Ⅱ', () => {
  const app = createApp();
  const k = (t) =>
    JSON.parse(
      app.__eval(
        'JSON.stringify((scanRead(' +
          JSON.stringify(t) +
          ', "Ohuhu").codes || []).map((c) => c.opts.map(mkey).join(",")))',
      ),
    );
  assert.deepEqual(k('CG∏04'), ['Ohuhu|CG18']);
  assert.deepEqual(k('CGΠ04 Cool Grey II 4'), ['Ohuhu|CG18']);
  assert.deepEqual(k('bgπ03'), ['Ohuhu|B310']);
  assert.equal(app.__eval('scanKey("CG∏04")'), 'CGII04');
});
