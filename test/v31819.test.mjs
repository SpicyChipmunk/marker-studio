// v318.19: older Ohuhu caps print an old code with the name it had then ("R6 Rose Red" is R213 Pomegranate now). The
// reader knows those names (src/data/cap-names.json, COLORS[i].cap) and counts one only WITH its old code: then the
// cap is that marker, with no question. A name of an older cap read with a code as it is now changes nothing. Fails on
// v318.18.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from './harness.mjs';

const app = createApp();
const k = (i) => app.__eval('COLORS[' + i + '].brand[0] + COLORS[' + i + '].code');
function read(t, brand = '') {
  return JSON.parse(
    app.__eval(
      '(function () { const r = scanRead(' +
        JSON.stringify(t) +
        ', ' +
        JSON.stringify(brand) +
        '); const k = (i) => COLORS[i].brand[0] + COLORS[i].code; return JSON.stringify({ codes: (r.codes || []).map((c) => c.code + (c.asked ? "?" + c.asked : "") + " [" + c.opts.map(k).join(",") + "]"), names: (r.names || []).map(k), other: (r.other || []).map(k) }); })()',
    ),
  );
}
function photo(texts) {
  const a = createApp();
  return JSON.parse(
    a.__eval(
      '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1;' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r; let id = 0; const lines = [];' +
        JSON.stringify(texts) +
        '.forEach((t, k) => { const x = 200 * (k % 6), y = 300 * Math.floor(k / 6), me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
        '  (t[1] || []).forEach((n) => lines.push({ id: ++id, look: 1, text: n.replace(/^\\?/, ""), conf: 0.97, unsure: /^\\?/.test(n), nameOf: me, box: [x, y + 30, 80, 20, 0] })); });' +
        'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)), asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) }); })()',
    ),
  );
}
// a tray of older Ohuhu caps (old codes only)
const OLD = ['YR170', 'RP6', 'BR3', 'E400', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2'].map(
  (c) => [c],
);

test('an old code with its older cap’s name: that marker, no question', () => {
  for (const b of ['Ohuhu', '']) {
    assert.deepEqual(read('R6 Rose Red', b).codes, ['R6 [OR213]'], b);
    // (Cobalt Blue is BV315's name now: with PB3, BV314's old code, it's BV314's old cap)
    assert.deepEqual(read('PB3 Cobalt Blue', b).codes, ['PB3 [OBV314]'], b);
    // (R21 is Copic's code now too: with its old cap's name it's Ohuhu's R16)
    assert.deepEqual(read('R21 Fruit Pink', b).codes, ['R21 [OR16]'], b);
    assert.deepEqual(read('R11 Mauve Shadow', b).codes, ['R11 [OV13]'], b);
  }
  // the grey caps' Ⅱ, read as I, l or H, and run into the word before it
  assert.deepEqual(read('CGI09 Cool Greyll9', 'Ohuhu').codes, ['CGI09 [OBGY35]']);
  assert.deepEqual(read('CGH08 Cool Grey II 8', 'Ohuhu').codes, ['CGH08 [OBGY25]']);
  assert.deepEqual(read('CGlO7', 'Ohuhu').codes, ['CG107 [OBGY24]']);
});

test('a code that’s one marker’s now and another’s old code: the older cap’s words that only it has decide', () => {
  // (R16 is Light Salmon now and RV316's old code; G410 is Grass Green now and G24's old code)
  assert.deepEqual(read('R16 Deep Violet', 'Ohuhu').codes, ['R16 [ORV316]']);
  assert.deepEqual(read('G410 Light Holly Green', 'Ohuhu').codes, ['G410 [OG24]']);
  // (a word both have, "Green", is the marker of the code now, as before)
  assert.deepEqual(read('G410 Green', 'Ohuhu').codes, ['G410 [OG410]']);
  assert.deepEqual(read('G410 Grass Green', 'Ohuhu').codes, ['G410 [OG410]']);
});

test('an older cap’s name with a code as it is now changes nothing', () => {
  // (BV314's code with "Cobalt Blue", BV315's name now: still asked, as v318.18 asked it)
  assert.deepEqual(read('BV314 Cobalt Blue', 'Ohuhu').codes, ['BV314?name [OBV314,OBV315]']);
  assert.deepEqual(read('Y111 Sunflower', 'Ohuhu').codes, ['Y111?name [OY111,OY27]']);
  // (a pasted list: a name line another marker has now isn't swallowed by a code whose OLD cap had that name)
  assert.ok(read('R213\nRose Red').names.includes('CR85'), JSON.stringify(read('R213\nRose Red')));
  assert.ok(read('V13\nMauve Shadow').names.includes('CBV00'));
  // (a one-word older cap's name inside a longer name read: "Lavender Mist" isn't V010's old cap "Lavender")
  assert.deepEqual(read('P4 Lavender Mist', 'Ohuhu').codes, ['P4?name [OV010,OV46]']);
});

test('a photo of older caps: an old code that’s Copic’s now, with its cap’s name, is the Ohuhu marker; alone, as before', () => {
  const p = photo(OLD.concat([['R21', ['Fruit Pink']]]));
  assert.ok(p.list.includes('Ohuhu|R16'), p.list.join(' '));
  const q = photo(OLD.concat([['R21']]));
  assert.ok(!q.list.includes('Ohuhu|R16'), q.list.join(' '));
  const r = photo(OLD.concat([['R6', ['Rose Red']]]));
  assert.ok(r.list.includes('Ohuhu|R213') && !r.asks.length, JSON.stringify(r));
});

test('the names data: Ohuhu codes as they are now, whole names, none its marker’s name now', () => {
  const cn = JSON.parse(readFileSync(new URL('../src/data/cap-names.json', import.meta.url), 'utf8')),
    M = JSON.parse(readFileSync(new URL('../src/data/markers.json', import.meta.url), 'utf8')),
    by = new Map(M.filter((m) => m.brand === 'Ohuhu').map((m) => [m.code, m])),
    key = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  assert.deepEqual(Object.keys(cn), ['Ohuhu']);
  const n = Object.keys(cn.Ohuhu).length;
  assert.ok(n >= 300, n + ' markers');
  for (const [code, names] of Object.entries(cn.Ohuhu)) {
    const m = by.get(code);
    assert.ok(m, code + ' is an Ohuhu code now');
    assert.ok(m.old && m.old !== m.code, code + ' has an old code');
    for (const nm of names) {
      assert.equal(nm, nm.trim(), code);
      assert.ok(!/\.\.|[()?]/.test(nm), code + ': ' + nm);
      assert.notEqual(key(nm), key(m.name), code + ': its name now');
      const ws = nm.split(/[^A-Za-z0-9]+/).filter(Boolean);
      assert.ok(ws.length > 1 || ws[0].length >= 5, code + ': ' + nm);
    }
  }
  // (built into the app)
  assert.equal(k(app.__eval("COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'R213')")), 'OR213');
  assert.ok(
    app.__eval("COLORS.find((c) => c.brand === 'Ohuhu' && c.code === 'R213').cap.includes('Rose Red')"),
  );
});

test('debugging pass: an old code with its older cap’s name of plain words is listed; a name line read as a code isn’t', () => {
  // (v318.19 debug: "Y11" with "Brown Grey", "BG2" with "Deep Green": every word one every family has, which the
  // photo's own check of a name left out, so Y611 and G316 were missed)
  const p = photo(
    OLD.concat([
      ['Y11', ['Brown Grey']],
      ['BG2', ['Deep Green']],
    ]),
  );
  assert.ok(p.list.includes('Ohuhu|Y611') && p.list.includes('Ohuhu|G316'), JSON.stringify(p));
  // (a turned E400 cap: its code read "00", its name lines "e020)" and "e030" unsure, as codes: E020 and E030 had gone
  // in unasked as YR05 and YR45)
  const q = photo(OLD.concat([['00', ['?e020)', 'Brown', '?e030']]]));
  assert.ok(!q.list.includes('Ohuhu|YR05') && !q.list.includes('Ohuhu|YR45'), JSON.stringify(q));
});
