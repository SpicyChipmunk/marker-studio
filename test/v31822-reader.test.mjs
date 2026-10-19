// v318.22, the reader: an older cap's code that's another brand's code now, told by a word of that cap's name ("Y13"
// with "Chestnut" is Ohuhu E515, not Copic Y13); Ohuhu's older grey caps with the Ⅱ misread ("CGé08", "BG期05"); a cap
// whose name alone was read, its first line a word of it ("Colorless" over "Blender"); the name fix taking a name
// misread by a letter, or a code's last digit read as its look-alike letter ("GYS" for GY5). Fails on v318.21.
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
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + (e.how === "fixed" ? " as " + e.as : "") + (e.cv ? " cv " + e.cv : "")),' +
        ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) }); })()',
    ),
  );
}
// a tray of older Ohuhu caps read right; and one of Copic caps
const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'].map(
  (c) => [c],
);
const COP = ['YG03', 'B23', 'E74', 'R85', 'BV04', 'G28', 'C-3', 'W-5', 'E31', 'RV29', 'Y38', 'BG34'].map(
  (c) => [c],
);
const has = (p, re) => p.list.some((k) => re.test(k));

test('an older cap’s code that’s another brand’s code now, with a word of that cap’s name: that cap', () => {
  const a = photo(OLD.concat([['Y13', ['Chestnut']]]));
  assert.ok(a.list.includes('Ohuhu|E515 cv old'), JSON.stringify(a));
  assert.ok(!has(a, /^Copic\|Y13/), JSON.stringify(a));
  const b = photo(OLD.concat([['R11', ['Mauve']]]));
  assert.ok(b.list.includes('Ohuhu|V13 cv old'), JSON.stringify(b));
  // (Copic's own name: not Ohuhu's older cap)
  const c = photo(OLD.concat([['Y13', ['Lemon Yellow']]]));
  assert.ok(!has(c, /E515/) && !c.asks.some((q) => /E515/.test(q)), JSON.stringify(c));
  // (on a tray of Copic caps, Copic's)
  const d = photo(COP.concat([['Y13', ['Chestnut']]]));
  assert.ok(d.list.includes('Copic|Y13') && !has(d, /E515/), JSON.stringify(d));
});

test('Ohuhu’s older grey caps with the Ⅱ misread: CG listed, BG with its name, else asked', () => {
  const a = photo(OLD.concat([['CGé08', ['Cool Greyll8']], ['cclo8']]));
  assert.ok(a.list.includes('Ohuhu|BGY25 as CGé08 cv old'), JSON.stringify(a));
  assert.deepEqual(a.asks, [], 'no question about the name alone');
  // (BG05 is a cap now: without its name, asked; with it, listed; never taken for BG05 as read)
  const b = photo(OLD.concat([['BG期05']]));
  assert.deepEqual(b.asks, ['Ohuhu|B411,Ohuhu|BG05'], JSON.stringify(b));
  assert.ok(!has(b, /BG05|B411/), JSON.stringify(b));
  const c = photo(OLD.concat([['BG期05', ['Blue Grey II 5']]]));
  assert.ok(c.list.includes('Ohuhu|B411 as BG期05 cv old') && !has(c, /\|BG05/), JSON.stringify(c));
  assert.deepEqual(c.asks, []);
  // (not a word, not another number in its name, not a Copic tray)
  for (const [caps, why] of [
    [OLD.concat([['Cocoa']]), 'a word'],
    [OLD.concat([['CGé08', ['Cool Grey II 7']]]), 'another number in its name'],
    [COP.concat([['CGé08']]), 'a Copic tray'],
    [OLD.concat([['BGY13']]), 'BGY13'],
  ]) {
    const p = photo(caps);
    assert.ok(!has(p, /BGY25|CG18|BGY24|B310/), why + ': ' + JSON.stringify(p));
  }
});

test('a cap whose name alone was read, its first line a word of the name: asked by its name', () => {
  const p = photo(OLD.concat([['Colorless', ['Blender']]]));
  assert.ok(p.asks.includes('Ohuhu|0'), JSON.stringify(p));
});

test('the name fix: a code’s last digit read as a letter; a name misread by a letter or without its plain words', () => {
  const a = photo(OLD.concat([['GYS', ['Absinthe']]]));
  assert.ok(a.list.includes('Ohuhu|YG211 as GYS cv old'), JSON.stringify(a));
  const b = photo(OLD.concat([['F400', ['Cocoa']]]));
  assert.ok(b.list.includes('Ohuhu|E97 as F400 cv old'), JSON.stringify(b));
  const c = photo(OLD.concat([['5110', ['Dark', 'Suntam']]]));
  assert.ok(c.list.includes('Ohuhu|YR312 as 5110 cv old'), JSON.stringify(c));
  // (never a two-character code by these: "RI" with Coral Pink is left to Scan's own reading)
  const d = photo(OLD.concat([['RI', ['Coral Pink']]]));
  assert.ok(!d.list.some((k) => / as RI/.test(k)), JSON.stringify(d));
});
