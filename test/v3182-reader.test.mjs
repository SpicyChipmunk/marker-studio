// v318.2: the photo reader adds no marker it can't stand behind. Readings made up here (the reader itself isn't run):
// digits alone aren't bent into a lettered code ("99" isn't G9, G112's old code; "808" is asked about); a reading with
// letters that isn't the code as printed is asked about ("W60g"); a photo plainly of the codes as they are now asks
// about a code that's only an old one ("GG1" of GG15; v318.2 dropped it) unless its name is read, and takes a code
// that's current over another's
// old one (Y210, not "Which Y210?"); a cap's names in either order (R22 "Pink Ballet") and "R22 Pink" aren't RV17
// Pink; a code read with another marker's name is asked about; noise questions go; "Yellowish" isn't Copic's Yellow.
// Typed and pasted codes as before. Fails on v318.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// Ohuhu codes as they are now, enough to make a photo plainly of them (eight)
const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'];
// a photo's lines: [text, unsure, names (lines below the code), box] → { list, asks, titles }
function photo(texts, brand = '') {
  const app = createApp();
  return JSON.parse(
    app.__eval(
      '(function () {' +
        'scanList = []; scanBrand = ' +
        JSON.stringify(brand) +
        '; ocrPhotos = 1;' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r;' +
        'let id = 0; const lines = [];' +
        JSON.stringify(texts) +
        '.forEach((t, k) => {' +
        '  const x = 200 * (k % 6), y = 300 * Math.floor(k / 6), me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: !!t[1], nameOf: 0, box: [x, y, 60, 30, 0] });' +
        '  (t[2] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n[0], conf: 0.97, unsure: false, nameOf: me,' +
        '    box: [x, y + n[1], 80, 20, 0] }));' +
        '});' +
        'lines.forEach((it) => ocrLine(r, it));' +
        'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),' +
        ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")),' +
        ' titles: scanList.filter((e) => e.ask).map((e) => e.title) });' +
        '})()',
    ),
  );
}
const now = NOW.map((c) => [c]);
// typed: what Scan's box makes of a text, as a list of "code asked [options]"
function typed(t, brand = '') {
  const app = createApp();
  return JSON.parse(
    app.__eval(
      '(function () { const r = scanRead(' +
        JSON.stringify(t) +
        ', ' +
        JSON.stringify(brand) +
        '); return JSON.stringify((r.codes || []).map((c) => c.code + " " + (c.asked || "-") + " [" + c.opts.map((i) => COLORS[i].code).join(",") + "]")); })()',
    ),
  );
}

test('digits alone from a photo: two are no code ("99" isn’t G112), three or more are asked about ("808": B08?)', () => {
  const o = photo(now.concat([['99']]));
  assert.ok(!o.list.includes('Ohuhu|G112'), o.list.join(' '));
  assert.deepEqual(o.asks, []);
  const p = photo([['B015'], ['808'], ['99']]);
  assert.ok(!p.list.includes('Ohuhu|G112') && !p.list.includes('Ohuhu|B08'), p.list.join(' '));
  assert.deepEqual(p.asks, ['Ohuhu|B08']);
  assert.match(p.titles[0], /“808” read: is it this one\?/);
  // (typed, as before: Scan's box puts misreads right)
  assert.deepEqual(typed('99', 'Ohuhu'), ['G9 - [G112]']);
  assert.deepEqual(typed('808', 'Ohuhu'), ['B08 - [B08]']);
});

test('a reading with letters that isn’t the code as printed is asked about, not added ("W60g": WG06?); as printed, at once', () => {
  const o = photo(now.concat([['W60g'], ['WG01'], ['YRO6']]));
  assert.ok(!o.list.includes('Ohuhu|WG06'), o.list.join(' '));
  assert.ok(o.asks.includes('Ohuhu|WG06'), o.asks.join(' | '));
  assert.ok(o.list.includes('Ohuhu|WG01'), 'the code as printed');
  assert.ok(o.list.includes('Ohuhu|YR06'), 'O for 0 is as printed');
  assert.deepEqual(typed('W60g', 'Ohuhu'), ['WG06 - [WG06]'], 'typed, as before');
});

test('a photo plainly of the codes as they are now: an old code alone is asked about, with its own name it’s added; Y210 is Y210', () => {
  const o = photo(now.concat([['GG1'], ['Y210']]));
  assert.ok(!o.list.includes('Ohuhu|GG03'), 'GG1, likely a scrap of GG15, not added: ' + o.list.join(' '));
  assert.ok(o.list.includes('Ohuhu|Y210'), 'not "Which Y210?"');
  // (v318.3: asked, with the cap's picture beside it, rather than left out)
  assert.deepEqual(o.asks, ['Ohuhu|GG03']);
  assert.match(o.titles[0], /“GG1” read: is it this one\?/);
  const n = photo(now.concat([['GG1', false, [['Silver Cloud', 30]]]]));
  assert.ok(n.list.includes('Ohuhu|GG03'), 'by its old code with its name: ' + n.list.join(' '));
  // (fewer than eight codes read: no generation, asked as before)
  const few = photo([['B015'], ['Y210']]);
  assert.deepEqual(few.asks, ['Ohuhu|Y210,Ohuhu|Y416']);
  // (a photo of old codes, several: no generation either, so an older set's caps aren't dropped)
  const older = photo(
    NOW.slice(0, 6)
      .map((c) => [c])
      .concat([['GG1'], ['G9'], ['Y1']]),
  );
  assert.ok(
    older.list.includes('Ohuhu|GG03') || older.asks.some((a) => a.includes('GG03')),
    JSON.stringify(older),
  );
});

test('R22 Ballet Pink: its names in either order, or "Pink" alone, aren’t RV17 Pink (R22 by its old code)', () => {
  // (the cap's lines read in reading order: "Ballet" nearer the code than "Pink")
  const o = photo(
    now.concat([
      [
        'R22',
        false,
        [
          ['Pink', 60],
          ['Ballet', 30],
        ],
      ],
    ]),
  );
  assert.ok(o.list.includes('Ohuhu|R22') && !o.list.includes('Ohuhu|RV17'), o.list.join(' '));
  const p = photo(now.concat([['R22', false, [['Pink', 30]]]]));
  assert.ok(!p.list.includes('Ohuhu|RV17'), 'not RV17: ' + p.list.join(' '));
  assert.ok(p.list.includes('Ohuhu|R22'), 'the code as it is now, on a photo of them');
  assert.deepEqual(typed('R22 Pink Ballet', 'Ohuhu'), ['R22 - [R22]']);
  assert.deepEqual(typed('R22 Pink', 'Ohuhu'), ['R22 old [R22,RV17]'], 'typed: asked, not RV17');
  assert.deepEqual(typed('R22 Ballet Pink', 'Ohuhu'), ['R22 - [R22]']);
});

test('a code read with a word of another marker’s name and none of its own is asked about', () => {
  const o = photo(now.concat([['B21', false, [['Sakura', 30]]]]));
  assert.ok(!o.list.includes('Ohuhu|B21'), o.list.join(' '));
  assert.ok(o.asks.includes('Ohuhu|B21'), o.asks.join(' | '));
  assert.match(o.titles.join(' '), /“B21 Sakura” read: is it this one\?/);
});

test('noise questions go: a name alone that’s a word of other names ("Grey"); another brand’s code that’s part of the photo’s brand’s (Copic BG11 by BG114)', () => {
  const o = photo(now.concat([['Grey'], ['BG11']]));
  assert.deepEqual(o.titles, [], o.titles.join(' | '));
});

test('"Yellowish" isn’t Copic Y06 Yellow: YR20 Yellowish Shade read either way round', () => {
  assert.deepEqual(typed('YR20 Shade Yellowish', ''), ['YR20 - [YR20]']);
  assert.deepEqual(typed('YR20 Yellowish', ''), ['YR20 - [YR20]']);
  assert.deepEqual(typed('YG06 Green Yellowish', 'Copic'), ['YG06 - [YG06]']);
  // (Yellow itself still is)
  assert.deepEqual(typed('Y06 Yellow', 'Copic'), ['Y06 - [Y06]']);
});
