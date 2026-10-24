// Scan or type codes: reading text into markers.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, cpuMs, createApp, memoryStorage } from './harness.mjs';
import { readFileSync } from 'node:fs';

// ---- from scan.test.mjs ----
// Scan or type codes (v296): what a piece of read text holds — codes as read, the usual mix-ups put right, the colour
// name confirming a code and picking the brand, a cap read upside down turned round.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const C = app.__eval('COLORS');
  const nm = (i) => C[i].brand + ' ' + C[i].code;
  const read = (t, b = '') => {
    const r = app.scanRead(t, b);
    return {
      codes: [...r.codes].map((c) => [...c.opts].map(nm)),
      byName: r.byName >= 0 ? nm(r.byName) : '',
      flips: [...r.flips].map((f) => [...f.opts].map(nm).sort()),
    };
  };
  test('a code and its name: the code, confirmed by the name', () => {
    assert.deepEqual(read('YG06 Sugarcane').codes, [['Ohuhu YG06']]);
    const r = app.scanRead('YG06 Sugarcane', '');
    assert.equal(r.codes[0].named, true);
    assert.equal(r.codes[0].fixed, false);
  });
  test('the usual mix-ups are put right, and said so', () => {
    assert.deepEqual(read('BO15 Celadon Blue').codes, [['Ohuhu B015']]);
    assert.deepEqual(read('8G011 Teal').codes, [['Ohuhu BG011']]);
    assert.equal(app.scanRead('BO15', '').codes[0].fixed, true);
    // a code read in two pieces, and Copic's C-3 with or without its dash
    assert.deepEqual(read('G 24 Celadon').codes, [['Ohuhu G24']]);
    assert.deepEqual(read('C3').codes, [['Copic C-3']]);
    assert.deepEqual(read('C-3').codes, [['Copic C-3']]);
  });
  test('a code both brands use: both offered, unless the name or the brand chosen settles it', () => {
    assert.deepEqual(
      read('B04').codes.map((o) => o.sort()),
      [['Copic B04', 'Ohuhu B04']],
    );
    assert.deepEqual(read('B04', 'Ohuhu').codes, [['Ohuhu B04']]);
    const ohName = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B04').name;
    assert.deepEqual(read('B04 ' + ohName).codes, [['Ohuhu B04']]);
  });
  test('several codes in one go (a pasted list), each once', () => {
    assert.deepEqual(read('R014 Deep Vermilion\nYG07 Honeydew Melon\nBV0000\nR014').codes, [
      ['Ohuhu R014'],
      ['Ohuhu YG07'],
      ['Copic BV0000'],
    ]);
  });
  test('only the name read: offered by its name; no code and no name: nothing', () => {
    assert.equal(read('Sugarcane').byName, 'Ohuhu YG06');
    // the longest name read: Honey Brown (E49), not Honey (Y38) as well
    assert.equal(read('Honey Brown').byName, 'Ohuhu E49');
    assert.deepEqual(read('Ohuhu Alcohol Markers'), { codes: [], byName: '', flips: [] });
  });
  test('a code that is only a number counts only on its own or with its name', () => {
    assert.deepEqual(read('120').codes, [['Ohuhu 120']]);
    assert.deepEqual(read('120 Black').codes, [['Ohuhu 120']]);
    assert.deepEqual(read('O').codes, [], 'a letter O is not the colourless blender 0');
    assert.deepEqual(read('pack of 120').codes, []);
  });
  test('a cap read upside down is turned round; where that could be two codes, both are offered', () => {
    assert.deepEqual(read('6L3', 'Ohuhu').flips, [['Ohuhu E19']]);
    assert.deepEqual(read('SZA98', 'Ohuhu').flips, [['Ohuhu BGY25']]);
    // E19 or Copic's E79
    assert.deepEqual(read('6L3').flips, [['Copic E19', 'Copic E79', 'Ohuhu E19']]);
    // YR213 upside down with its Y lost reads as R213: both offered
    assert.deepEqual(read('ELZと', 'Ohuhu').flips, [['Ohuhu R213', 'Ohuhu YR213']]);
    // right way up wins: no turning round when a code was read
    assert.deepEqual(read('YG06 6L3', 'Ohuhu').flips, []);
  });
  test('words are not codes: misreads are put right only in a word with a digit, turning round only with a digit or a turned letter', () => {
    for (const w of ['Egg', 'Bog', 'No', 'BIG', 'TO', 'BOO', 'Sea', 'Dim', 'in', 'ZOO']) {
      const r = app.scanRead(w, '');
      assert.equal(r.codes.length + r.flips.length, 0, w);
    }
    // every marker's code with its name reads as that marker, and its name alone never as a code
    // (v303: but for the colourless blender, 0, which both brands have under the same name: both, to choose between)
    C.forEach((c, i) => {
      const r = app.scanRead(c.code + ' ' + c.name, ''),
        twin = C.filter((d) => d.code === c.code && d.name === c.name).length;
      assert.ok(
        r.codes.length === 1 && r.codes[0].opts.length === twin && r.codes[0].opts.includes(i),
        c.brand + ' ' + c.code,
      );
      assert.equal(app.scanRead(c.name, '').codes.length, 0, c.name);
    });
  });
  test('the name decides between two readings of a misread (YG11 with Ohuhu Y611’s name)', () => {
    const y611 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'Y611');
    assert.deepEqual(read('YG11 ' + y611.name).codes, [['Ohuhu Y611']]);
    assert.deepEqual(read('YG11', 'Copic').codes, [['Copic YG11']]);
  });
  test('a reading put right that could also be another code upside down asks both ways; a brand left out is said', () => {
    // "603": G03 with 6 for G, or E09 upside down
    const r = app.scanRead('603', 'Copic');
    assert.equal(r.codes.length, 1);
    assert.equal(r.codes[0].asked, 'turned');
    assert.deepEqual([...r.codes[0].opts].map(nm).sort(), ['Copic E09', 'Copic G03']);
    // a Copic code with Ohuhu chosen
    const o = app.scanRead('C-3', 'Ohuhu');
    assert.deepEqual([...o.other].map(nm), ['Copic C-3']);
    assert.equal(o.codes.length, 0);
  });
  test('the code and the colour name disagree: asked, not the code taken as read (R4b with "Old Rose")', () => {
    const r = app.scanRead('R4b Old Rose', 'Ohuhu');
    assert.equal(r.codes.length, 1);
    assert.equal(r.codes[0].asked, 'name');
    assert.ok([...r.codes[0].opts].map(nm).includes('Ohuhu R46'), 'Old Rose offered');
    assert.equal(app.scanRead('B08 Frost', 'Ohuhu').codes[0].asked, 'name');
  });
  test('old Ohuhu codes on older caps: the marker they belong to now, by its name; alone, asked when the code is now another marker’s', () => {
    const bv26 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'BV26');
    assert.equal(bv26.old, 'R25');
    assert.deepEqual(read('R25 ' + bv26.name).codes, [['Ohuhu BV26']]);
    assert.equal(app.scanRead('R25 ' + bv26.name, '').codes[0].old, true);
    const r = app.scanRead('R25', 'Ohuhu');
    assert.equal(r.codes[0].asked, 'old');
    assert.deepEqual([...r.codes[0].opts].map(nm).sort(), ['Ohuhu BV26', 'Ohuhu R25']);
    // an old code no marker has now: that marker
    const b015 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B015');
    assert.deepEqual(read(b015.old, 'Ohuhu').codes, [['Ohuhu B015']]);
  });
  test('with a brand chosen, the other brand’s code (or its name) is said, not bent into the chosen brand’s', () => {
    for (const t of ['YG11', 'YG11 Mignonette', 'E08 Brown', 'B04 Tahitian Blue', 'E000']) {
      const r = app.scanRead(t, 'Ohuhu');
      assert.equal(r.codes.length + r.flips.length, 0, t);
      assert.ok(r.other.length && [...r.other].every((i) => C[i].brand === 'Copic'), t);
    }
  });
  test('more ways a cap is read: full-width, a dash on its own, the brand on the cap, the name run on, no code made up across two words', () => {
    assert.deepEqual(read('Ｂ０１５').codes, [['Ohuhu B015']]);
    assert.deepEqual(read('C - 3').codes, [['Copic C-3']]);
    assert.deepEqual(read('Ohuhu B04').codes, [['Ohuhu B04']]);
    assert.deepEqual(read('Copic B04').codes, [['Copic B04']]);
    assert.deepEqual(read('B015Celadon Blue').codes, [['Ohuhu B015']]);
    for (const t of ['B63 T-1', 'Y62 T-2']) assert.equal(read(t).codes.length, 2, t + ': its two codes only');
  });
}

// ---- from v302.test.mjs ----
// v302: old codes stored with the Roman numeral Ⅱ ("CGⅡ00") are shown and searched with plain letters, and saved work
// using them still opens.
{
  test('an old code with Ⅱ is shown as II, found by "CGII00" (and by "CGⅡ00"), and a saved key using it is still known', () => {
    const a = createApp({ localStorage: memoryStorage() }),
      E = a.__eval;
    const i = E(`COLORS.findIndex((c) => c.old === 'CGⅡ00')`);
    assert.ok(i >= 0, 'the data keeps the code as printed');
    assert.equal(E(`oldCode(COLORS[${i}])`), 'CGII00');
    for (const q of ['cgii00', 'cgⅱ00']) {
      E(`searchStr = ${JSON.stringify(q)}`);
      assert.equal(E(`matchesSearch(${i})`), true, q);
    }
    E(`searchStr = ''`);
    assert.equal(E(`knownMkey('Ohuhu|CGⅡ00')`), E(`mkey(${i})`), 'saved work from before the rename');
  });
}

// ---- from v303-scan.test.mjs ----
// v303: Scan or type codes, put right after a close look: numbers and prices aren't markers, the brand on the cap and
// a word of a name settle what they can, codes in pieces and a few more misreads are read, and in the dialog a question
// answered (or a cap still in view) isn't asked again, a second cap with the same code is, and a name read settles a
// question about the same cap.
{
  const app = createApp({ localStorage: memoryStorage() }),
    E = app.__eval;
  const C = E('COLORS');
  const nm = (i) => C[i].brand + ' ' + C[i].code;
  const read = (t, b = '') => {
    const r = app.scanRead(t, b);
    return JSON.parse(
      JSON.stringify({
        codes: r.codes.map((c) => [c.opts.map(nm).sort().join('|'), c.asked]),
        byName: r.byName >= 0 ? nm(r.byName) : '',
        byNames: (r.byNames || []).map(nm).sort(),
        other: r.other.map(nm),
        names2: (r.names2 || []).map((a) => a.map(nm).sort()),
      }),
    );
  };
  // the dialog's reading of text as it comes from Scan Text (not loud), at times we set
  function dialog() {
    const a = createApp({ localStorage: memoryStorage() });
    let now = 1e12;
    a.__eval('Date').now = () => now;
    const at = (ms) => (now += ms);
    const list = () =>
      JSON.parse(JSON.stringify(a.__eval('scanList').map((e) => (e.ask ? '?' + e.ask : nm(e.i)))));
    return { a, at, list, handle: (t, loud = false) => a.scanHandle(t, loud) };
  }
  test('numbers and prices beside a code aren’t markers (a price’s 99 had added Ohuhu G112)', () => {
    assert.deepEqual(read('E19 Dried Sage $3.99').codes, [['Ohuhu E19', '']]);
    assert.deepEqual(read('R46 Old Rose 2.99').codes, [['Ohuhu R46', '']]);
    assert.deepEqual(read('61\tE19 Dried Sage').codes, [['Ohuhu E19', '']]);
    assert.deepEqual(read('Item 6012').codes, []);
    assert.deepEqual(read('pack of 100', 'Ohuhu'), {
      codes: [],
      byName: '',
      byNames: [],
      other: [],
      names2: [],
    });
    assert.deepEqual(read('Ohuhu 120 Colors', 'Copic').other, []);
    // a count beside a number-only code, or after a code without digits
    assert.deepEqual(read('120 x2').codes, [['Ohuhu 120', '']]);
    assert.deepEqual(read('2x 120').codes, [['Ohuhu 120', '']]);
    assert.deepEqual(read('2 FB').codes, [['Copic FB', '']]);
    // a code without digits among words that aren't codes isn't one
    assert.deepEqual(read('see the FB page').codes, []);
    // a name's own number ("No.0") isn't a code
    assert.deepEqual(read('C-0 No.0').codes, [['Copic C-0', '']]);
  });
  test('a word of a name read beside a code settles it, or says nothing, rather than asking about another marker', () => {
    assert.deepEqual(read('BG212 Green').codes, [['Ohuhu BG212', '']]);
    const b21 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B21');
    const w = b21.name.split(' ')[0];
    assert.deepEqual(read('B21 ' + w).codes, [['Ohuhu B21', '']], w);
  });
  test('the brand on the cap settles a question it can (Copic R12, not Ohuhu’s R12 or the marker that was R12)', () => {
    assert.deepEqual(read('Copic R12').codes, [['Copic R12', '']]);
    assert.deepEqual(read('R12 Copic').codes, [['Copic R12', '']]);
    // Ohuhu has no Y13 now: its old Y13
    const r = app.scanRead('Ohuhu Y13', '');
    assert.equal(r.codes.length, 1);
    assert.equal(nm(r.codes[0].opts[0]), 'Ohuhu E515');
    assert.equal(r.codes[0].old, true);
    // a name both brands use: the cap's brand picks it; alone, both offered
    assert.equal(read('Ohuhu Tahitian Blue').byName, 'Ohuhu B09');
    assert.deepEqual(read('Tahitian Blue').byNames, ['Copic B04', 'Ohuhu B09']);
    assert.deepEqual(read('Tahitian Blue\nE19').names2, [['Copic B04', 'Ohuhu B09']]);
  });
  test('a code read in pieces is that code only (E 614 had added Copic G14 as well)', () => {
    assert.deepEqual(read('E 614').codes, [['Ohuhu E614', '']]);
    assert.deepEqual(read('E.614').codes, [['Ohuhu E614', '']]);
    assert.deepEqual(read('B G05').codes, [['Copic BG05|Ohuhu BG05', '']]);
    assert.deepEqual(read('R V 17', 'Copic').codes, [['Copic RV17', '']]);
    assert.deepEqual(read('FY 00').codes, [['Ohuhu FY00', '']]);
  });
  test('more misreads: | or ! for 1, a T that could be 1 or 7 (asked), O for 0 in Copic’s greys, WG0.5, and Ⅱ read as ll', () => {
    assert.deepEqual(read('B|12').codes, [['Ohuhu B112', '']]);
    assert.deepEqual(read('B1!1').codes, [['Ohuhu B111', '']]);
    assert.deepEqual(read('E1T').codes, [['Copic E11|Copic E17|Ohuhu E17', 'fix']]);
    assert.deepEqual(read('E1T', 'Ohuhu').codes, [['Ohuhu E17', '']]);
    assert.deepEqual(read('C-O').codes, [['Copic C-0', '']]);
    assert.deepEqual(read('W-O').codes, [['Copic W-0', '']]);
    assert.deepEqual(read('WG0.5').codes, [['Ohuhu YR02', '']]);
    assert.deepEqual(read('BGll03').codes, [['Ohuhu B310', '']]);
    assert.deepEqual(read('CGll00').codes, [['Ohuhu WG10', '']]);
    assert.deepEqual(read('Cool Gray 3').byName, 'Copic C-3');
    // Ohuhu's colourless blender is 0 too
    assert.deepEqual(read('Ohuhu 0').codes, [['Ohuhu 0', '']]);
    assert.deepEqual(read('Copic 0').codes, [['Copic 0', '']]);
  });
  test('a long line of number-only codes is read in good time', () => {
    const t0 = Date.now();
    app.scanRead('120 '.repeat(5000), '');
    app.scanRead('0 '.repeat(20000), '');
    assert.ok(Date.now() - t0 < 2000, Date.now() - t0 + ' ms');
  });
  test('dialog: a question answered isn’t asked again while the two caps stay in view', () => {
    const d = dialog();
    d.handle('B015 Celadon Blue B04');
    assert.deepEqual(d.list(), ['?brands B04', 'Ohuhu B015']);
    // answered: Copic (as the list's button does)
    d.a.__eval(
      `(function(){ const q = scanList[0]; scanAnsweredAt.set(q.ask, Date.now()); scanList.splice(0, 1); scanTake(q.opts.find((o) => COLORS[o.i].brand === 'Copic').i, 'chosen', true); })()`,
    );
    for (let k = 0; k < 8; k++) {
      d.at(850);
      d.handle('B015 Celadon Blue B04');
    }
    assert.deepEqual(d.list(), ['Copic B04', 'Ohuhu B015']);
  });
  test('dialog: a second cap with the same code is asked about once the first has gone (it had been ignored for good)', () => {
    const d = dialog();
    d.handle('B04 Pale Cyan');
    assert.deepEqual(d.list(), ['Ohuhu B04']);
    // the Copic B04 cap, read as "B04" again and again: not at once (the first cap could still be in view), then asked
    d.at(850);
    d.handle('B04');
    assert.deepEqual(d.list(), ['Ohuhu B04']);
    for (let k = 0; k < 3; k++) {
      d.at(850);
      d.handle('B04');
    }
    assert.deepEqual(d.list(), ['?brands B04', 'Ohuhu B04']);
  });
  test('dialog: the cap’s name read settles the question its code alone raised a moment ago', () => {
    const d = dialog();
    d.handle('YG06');
    assert.deepEqual(d.list(), ['?brands YG06']);
    d.at(900);
    d.handle('YG06 Sugarcane');
    assert.deepEqual(d.list(), ['Ohuhu YG06']);
  });
  test('dialog: a list pasted twice asks nothing twice', () => {
    const d = dialog();
    const t = 'Honey Brown\nB04\nE19';
    d.handle(t, true);
    const n = d.list().length;
    d.a.__eval(
      `scanList = scanList.filter((e) => !e.ask || !/^byname/.test(e.ask)); scanTake(COLORS.findIndex((c) => c.name === 'Honey Brown'), 'name', true)`,
    );
    d.at(5000);
    d.handle(t, true);
    assert.equal(d.list().filter((x) => /byname/.test(x)).length, 0, d.list().join());
    assert.ok(d.list().length <= n + 1);
  });
}

// ---- from v317-scan.test.mjs ----
// v317: a pasted list (text copied from a photo of a tray with Google Lens or Live Text): a line with only a name that
// a code in the same paste accounts for is no question; a name on its own line settles a code both brands use; lines
// of plain words beside codes aren't counted as not read.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const C = app.__eval('COLORS');
  const nm = (i) => C[i].brand + ' ' + C[i].code;
  const read = (t, b = '') => {
    const r = app.scanRead(t, b);
    return {
      codes: [...r.codes].map((c) => (c.asked ? '?' : '') + [...c.opts].map(nm).join('/')),
      names: [...(r.names || [])].map(nm),
      names2: [...(r.names2 || [])].map((a) => [...a].map(nm).join('/')),
      unread: r.unread,
    };
  };
  test('a name on its own line under its code is no question; one no code accounts for still is', () => {
    assert.deepEqual(read('E75\nLight Rose Taupe\nCG17\nCool Grey'), {
      codes: ['Ohuhu E75', 'Ohuhu CG17'],
      names: [],
      names2: [],
      unread: 0,
    });
    // a word of the code's name ("Grey" isn't CG24 Grey beside CG17 Cool Grey; "Orange" is FY01's, not a question
    // between the two brands' Orange)
    assert.deepEqual(read('CG17\nGrey\nFY01\nFluorescent\nOrange'), {
      codes: ['Ohuhu CG17', 'Ohuhu FY01'],
      names: [],
      names2: [],
      unread: 0,
    });
    // another marker's name: asked, as before
    assert.deepEqual(read('E75\nCool Grey'), {
      codes: ['Ohuhu E75'],
      names: ['Ohuhu CG17'],
      names2: [],
      unread: 0,
    });
    // names alone: asked, as before
    assert.deepEqual(read('Light Rose Taupe\nCool Grey').names, ['Ohuhu E75', 'Ohuhu CG17']);
    assert.deepEqual(read('Pink').names2 || [], []);
    assert.deepEqual(read('Pink\nOrange').names2, ['Ohuhu RV17/Copic RV11', 'Ohuhu YR112/Copic YR68']);
  });
  test('a name on the line after a code both brands use settles it', () => {
    assert.deepEqual(read('B04\nTahitian Blue\nE75').codes, ['Copic B04', 'Ohuhu E75']);
    const r = app.scanRead('B04\nTahitian Blue', '');
    assert.equal(r.codes[0].named, true);
    // (both brands' names read: still asked)
    assert.deepEqual(
      read('B04\nTahitian Blue\n' + C.find((c) => c.brand === 'Ohuhu' && c.code === 'B04').name).codes,
      ['Copic B04/Ohuhu B04'],
    );
  });
  test('lines of plain words beside codes aren’t counted as not read; lines with digits, and any line without codes, are', () => {
    assert.equal(read('E75\nSWE\nepa\nn6ea\nCG17').unread, 1);
    assert.equal(read('SWE\nepa').unread, 2);
    // a receipt: the words at the foot stop counting, the sums don't
    assert.equal(read('Ohuhu E75 Light Rose Taupe $2.99\nSubtotal $2.99\nThank you').unread, 1);
  });
}

// ---- from v318-adding-9.test.mjs ----
// v318 review (adding markers, 9): two lettered sets in one name, "Copic Ciao 72 Set A and Set B", are both found (only
// Set A had been). Fails on v318.
{
  const app = createApp();
  const sets = (t) =>
    JSON.parse(
      app.__eval(
        `JSON.stringify(scanSets(${JSON.stringify(t)}, '').map((g) => g.map((i) => MARKER_SETS[i].n)))`,
      ),
    );
  test('two letters of one size: a set each', () => {
    assert.deepEqual(sets('Copic Ciao 72 Set A and Set B'), [['Ciao 72 - Set A'], ['Ciao 72 - Set B']]);
    assert.deepEqual(sets('COPIC CIAO 72 SET A AND SET B'), [['Ciao 72 - Set A'], ['Ciao 72 - Set B']]);
    assert.deepEqual(sets('Copic Sketch 72 Sets C and D'), [['Sketch 72 - Set C'], ['Sketch 72 - Set D']]);
    assert.deepEqual(sets('Copic Ciao 36A, 36B'), [['Ciao 36 - Set A'], ['Ciao 36 - Set B']]);
  });
  test('one letter, or none, as before', () => {
    assert.deepEqual(sets('Copic Ciao 36 Set C'), [['Ciao 36 - Set C']]);
    assert.deepEqual(sets('Copic Ciao 72 - B'), [['Ciao 72 - Set B']]);
    assert.deepEqual(sets('Copic Ciao Markers 36 Colors'), [
      ['Ciao 36 - Set A', 'Ciao 36 - Set B', 'Ciao 36 - Set C', 'Ciao 36 - Set D', 'Ciao 36 - Set E'],
    ]);
  });
}

// ---- from v318-sets.test.mjs ----
// v318: a set's name in pasted text (its box, an order email, a shop's page) is read: the sets it could be, one when
// the name says which. Not a price, an order number, a quantity, nor the number in a code read off a cap. Fails on v317.
{
  const app = createApp(),
    E = app.__eval;
  // (through JSON: arrays from the app's own realm)
  const sets = (text, brand) =>
    JSON.parse(
      E(
        'JSON.stringify(scanSets(' +
          JSON.stringify(text) +
          (brand ? ',' + JSON.stringify(brand) : '') +
          ').map((g) => g.map((i) => MARKER_SETS[i].n)))',
      ),
    );
  test('a set named on a shop page, a box or an order: which set', () => {
    const cases = [
      ['Ohuhu Alcohol Markers Honolulu Series 120 Colors Dual Tip Brush & Chisel', ['Honolulu 120']],
      // (a box's words, a line each, as Live Text copies them)
      ['OHUHU\nHONOLULU\nALCOHOL MARKERS\n120\nCOLORS', ['Honolulu 120']],
      ['OHUHU\nHONOLULU\nSET OF 48 COLORS', ['Honolulu 48']],
      ['Ohuhu Honolulu 320 Colors', ['Honolulu 320 (complete set)']],
      // (a line naming another of Ohuhu's sets isn't also Honolulu 48)
      ['Ohuhu Honolulu 48 Mid-tone Colors Alcohol Markers', ['48 Mid-tone Set']],
      ['Ohuhu Alcohol Markers 36 Skin Tone Colors', ['36 Skin Tones']],
      ['Ohuhu 36 Grey Tones Alcohol Markers', ['36 Gray Tones']],
      ['Ohuhu Pastel Markers 48 Colors - Sweetness', ['48 Pastel - Sweetness']],
      ['Ohuhu Alcohol Markers 24 Colors Portrait', ['24 Portrait']],
      ['Ohuhu Alcohol Markers 104 Colors', ['104 Colors Set']],
      ['Copic Ciao Markers 36 Color Set A', ['Ciao 36 - Set A']],
      ['Copic Ciao Set 72A', ['Ciao 72 - Set A']],
      ['Copic Ciao 12 Colours', ['Ciao 12']],
      ['Copic Sketch Marker 24 Color Set Manga', ['Sketch 24 - Manga']],
      ['Copic Sketch 72 Colors Set B', ['Sketch 72 - Set B']],
      ['Copic Sketch 12 Colors Basic', ['Sketch 12']],
      // (two sets in one order: one each)
      ['Honolulu 24 Colors and Honolulu 48 Colors', [['Honolulu 24'], ['Honolulu 48']]],
    ];
    for (const [t, want] of cases) assert.deepEqual(sets(t), Array.isArray(want[0]) ? want : [want], t);
  });
  test('a name that doesn’t say which: the sets it could be, to choose from', () => {
    assert.deepEqual(sets('Copic Ciao 36 Colors'), [
      ['Ciao 36 - Set A', 'Ciao 36 - Set B', 'Ciao 36 - Set C', 'Ciao 36 - Set D', 'Ciao 36 - Set E'],
    ]);
    assert.deepEqual(sets('Ohuhu Pastel 48 Colors'), [['48 Pastel - Sweetness', '48 Pastel - Blossoming']]);
    // (Sketch 24 is only the Manga set here: not offered without its name)
    assert.deepEqual(sets('Copic Sketch 24 Colors'), []);
  });
  test('an order email: each set, not its price, order number or quantity; only the brand asked for', () => {
    const order =
      'Order #112-4824839-1234567\nOhuhu Honolulu Markers, 72 Colors\nQty: 1\n$48.99\nCopic Ciao Markers 36 Color Set A\n$120.00\nSubtotal £24';
    assert.deepEqual(sets(order), [['Honolulu 72'], ['Ciao 36 - Set A']]);
    assert.deepEqual(sets(order, 'Copic'), [['Ciao 36 - Set A']]);
    assert.deepEqual(sets(order, 'Ohuhu'), [['Honolulu 72']]);
    // (and none of it read as a marker's code)
    assert.deepEqual(E('scanRead(' + JSON.stringify(order) + ', "").codes.length'), 0);
  });
  test('a tray’s text, codes read off caps with the brand on them: no set', () => {
    for (const t of [
      'OHUHU HONOLULU\nY28 R014 BG314\nE24 B48\nHONOLULU\n0',
      'HONOLULU R 24 Y 48',
      'COPIC CIAO E00 R24 YG06\nCIAO B24 100',
      'Honolulu markers are great for skin and grey',
    ])
      assert.deepEqual(sets(t), [], t);
  });
  // (v318.1) a tray's text with the case's HONOLULU and the Black marker's code, 120, on lines of their own: no set, and
  // the 120 is still read as a code; a box's words a line each still name the set; "Honolulu B" is the range too
  test('a tray’s text with HONOLULU and the 120 Black cap on lines of their own: a code, not Honolulu 120', () => {
    for (const t of ['HONOLULU\nR014\n120\nY28', 'HONOLULU\n120\nR014\nY28\nBG314'])
      assert.deepEqual(sets(t), [], t);
    const r = JSON.parse(
      E(
        'JSON.stringify(scanRead("HONOLULU\\nR014\\n120\\nY28", "").codes.map((c) => c.opts.map((i) => COLORS[i].brand + " " + COLORS[i].code)))',
      ),
    );
    assert.ok(
      r.some((o) => o.indexOf('Ohuhu 120') >= 0),
      'Ohuhu 120 Black is read',
    );
    // (a box's words, a line each, and the size on a line of its own: still the set)
    assert.deepEqual(sets('OHUHU\nHONOLULU\n120\nCOLORS'), [['Honolulu 120']]);
    assert.deepEqual(sets('OHUHU\nHONOLULU\n120'), [['Honolulu 120']]);
    // (a set named on a line of its own above the codes: still the set)
    assert.deepEqual(sets('Honolulu 120\nR014\nY28'), [['Honolulu 120']]);
    // (an order's name wrapped onto the next line, with codes below)
    assert.deepEqual(sets('Ohuhu Honolulu Markers,\n72 Colors\nR014 Y28'), [['Honolulu 72']]);
  });
  test('Honolulu B, the range’s second series: its size isn’t taken for a code "B 120"', () => {
    assert.deepEqual(sets('Ohuhu Honolulu B 120 Colors'), [['Honolulu 120']]);
    assert.deepEqual(sets('OHUHU\nHONOLULU B\n72 COLORS'), [['Honolulu 72']]);
    // (a code split by Live Text, "R 24", still isn't a size)
    assert.deepEqual(sets('HONOLULU R 24 Y 48'), []);
  });
}

// ---- from v31812-widen.test.mjs ----
// v318.12: a Copic code that's the tail of a longer one with a letter more at its head (G03 of YG03) is read again by
// the engine with its box grown by a character at the code's start, and the longer code taken when it reads surely,
// its first character a letter and the rest the code as read; the page holds such a code back from going in at once
// until then, and asks for none of it when the brand chosen is Ohuhu. Fails on v318.11.
{
  // --- the engine, with made-up models (as in v3181-parts): a detector that finds the blocks it's given, a recogniser
  // that reads what it's told
  const ENGINE = readFileSync(new URL('../src/js/ocr/engine.js', import.meta.url), 'utf8');
  const DICT = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  function fakeOrt(blocks, reads) {
    const seen = { rec: 0 };
    class Tensor {
      constructor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    }
    const det = {
      inputNames: ['x'],
      outputNames: ['y'],
      run: async (feeds) => {
        const [n, , H, W] = feeds.x.dims,
          p = new Float32Array(n * H * W);
        // (each block [cx, cy, w, h] in the map's own pixels)
        for (let b = 0; b < n; b++)
          blocks.forEach(([cx, cy, w, h]) => {
            for (let y = Math.round(cy - h / 2); y < cy + h / 2; y++)
              for (let x = Math.round(cx - w / 2); x < cx + w / 2; x++)
                if (x >= 0 && y >= 0 && x < W && y < H) p[b * H * W + y * W + x] = 1;
          });
        return { y: { data: p, dims: [n, 1, H, W] } };
      },
    };
    const rec = {
      inputNames: ['x'],
      outputNames: ['y'],
      run: async () => {
        const [text, conf] = reads[seen.rec++] || ['', 0],
          C = DICT.length + 2,
          T = 2 * text.length + 2,
          p = new Float32Array(T * C);
        for (let t = 0; t < T; t++) p[t * C] = 1;
        [...text].forEach((ch, i) => {
          const o = (2 * i + 1) * C;
          p[o] = 0;
          p[o + DICT.indexOf(ch) + 1] = conf;
        });
        return { y: { data: p, dims: [1, T, C] } };
      },
    };
    let s = 0;
    return { seen, Tensor, InferenceSession: { create: async () => [det, rec][s++] } };
  }
  async function engineRead(blocks, reads, o, abort) {
    const OCR2 = new Function(ENGINE + '\nreturn OCR2;')();
    const ort = fakeOrt(blocks, reads);
    const reader = await OCR2.create(ort, new Uint8Array(1), new Uint8Array(1), DICT.join('\n'), null);
    const img = { width: 320, height: 320, data: new Uint8ClampedArray(320 * 320 * 4).fill(200) },
      told = [],
      ctl = new AbortController();
    if (abort) ctl.abort();
    const r = await reader.read(img, Object.assign({ maxSide: 320, signal: ctl.signal }, o), {
      line: (it) => told.push(it.best.text),
    });
    return { r: r, told: told, recs: ort.seen.rec };
  }
  const W = { short: ['G03', 'R20', 'V04'], long: ['YG03', 'YR20', 'BV04', 'RV04'] };
  const one = [[160, 160, 120, 30]];
  const texts = (r) => r.r.lines.filter((it) => it.best).map((it) => it.best.text);
  test('engine: G03 read again wider reads YG03 surely: taken, and told to the page', async () => {
    const r = await engineRead(
      one,
      [
        ['G03', 0.97],
        ['YG03', 0.95],
      ],
      { widen: W },
    );
    assert.deepEqual(texts(r), ['YG03']);
    assert.ok(r.told.includes('YG03'));
    assert.deepEqual(r.r.stat.widen, { tried: 1, took: 1 });
  });
  test('engine: a real R20 stays R20 (the wider read the same), and nothing else turns it into a longer code', async () => {
    for (const [wide, why] of [
      [['R20', 0.98], 'read the same'],
      [['YR20', 0.6], 'not sure'],
      [['R205', 0.97], 'grown at its tail'],
      [['1R20', 0.97], 'a digit at its head'],
      [['XR20', 0.97], 'not a code'],
    ]) {
      const r = await engineRead(one, [['R20', 0.97], wide], { widen: W });
      assert.deepEqual(texts(r), ['R20'], why);
      assert.equal(r.r.stat.widen.took, 0, why);
    }
  });
  test('engine: without o.widen, or for a code that is no longer one’s tail, nothing is read again', async () => {
    const a = await engineRead(
      one,
      [
        ['G03', 0.97],
        ['YG03', 0.95],
      ],
      {},
    );
    assert.deepEqual(texts(a), ['G03']);
    assert.equal(a.recs, 1);
    const b = await engineRead(
      one,
      [
        ['YG03', 0.97],
        ['XYG03', 0.95],
      ],
      { widen: W },
    );
    assert.deepEqual(texts(b), ['YG03']);
    assert.equal(b.r.stat.widen.tried, 0);
  });
  test('page: the short and long Copic codes; a short one waits for its read again, not with Ohuhu chosen', () => {
    const app = createApp(),
      E = app.__eval;
    const sets = E('ocrWidenSets()');
    for (const k of ['G03', 'R20', 'V04']) assert.ok(sets.short.includes(k), k);
    for (const k of ['YG03', 'YR20', 'BV04', 'RV04']) assert.ok(sets.long.includes(k), k);
    assert.ok(!sets.short.includes('YG03'));
    // (only a letter more at the head: no digit tails, B000 isn't B00's)
    assert.ok(sets.long.every((w) => /^[A-Z]/.test(w) && sets.short.includes(w.slice(1))));
    const idx = (c) => E(`COLORS.findIndex((m) => m.brand === 'Copic' && m.code === '${c}')`);
    E("scanBrand = ''");
    assert.equal(E(`ocrWidenWait(${idx('G03')})`), true);
    assert.equal(E(`ocrWidenWait(${idx('YG03')})`), false);
    E("scanBrand = 'Ohuhu'");
    assert.equal(E(`ocrWidenWait(${idx('G03')})`), false);
  });
}

// ---- from v31814-widen.test.mjs ----
// v318.14: Photograph your caps reads Ohuhu codes that lost their first letter again too (G24 for BG24, CG24 or GG24),
// as v318.12 did for Copic's. Whose codes: the brand chosen, else the only brand you own, else both; a code waits for
// its read again exactly when the engine is given it to read again. Fails on v318.13.
{
  const own = (E, keys) => E(`state.owned = new Set(${JSON.stringify(keys)})`);
  test('each brand’s pairs: Ohuhu’s G24 with BG24, CG24, GG24; Copic’s G03 with YG03; never across brands', () => {
    const E = createApp().__eval;
    const o = E("ocrWidenSets('Ohuhu')"),
      c = E("ocrWidenSets('Copic')"),
      both = E('ocrWidenSets(null)');
    for (const k of ['G24', 'R25', 'V08', 'Y00']) assert.ok(o.short.includes(k), k);
    for (const k of ['BG24', 'CG24', 'GG24']) assert.ok(o.long.includes(k), k);
    assert.ok(c.short.includes('G03') && c.long.includes('YG03'));
    assert.ok(!o.long.includes('YG03'), 'not a Copic code in Ohuhu’s');
    // each long code is a code of that brand, with a letter more than one of its short ones
    const codes = (b) => new Set(E(`COLORS.filter((m) => m.brand === '${b}').map((m) => scanKey(m.code))`));
    for (const [set, b] of [
      [o, 'Ohuhu'],
      [c, 'Copic'],
    ]) {
      const cc = codes(b);
      assert.ok(
        set.long.every((w) => cc.has(w) && /^[A-Z]/.test(w) && set.short.includes(w.slice(1))),
        b,
      );
      assert.ok(
        set.short.every((k) => cc.has(k)),
        b,
      );
    }
    // both: the two brands' put together
    assert.deepEqual([...both.short], [...new Set([...o.short, ...c.short])].sort());
    assert.deepEqual([...both.long], [...new Set([...o.long, ...c.long])].sort());
  });
  test('whose codes are read again: the brand chosen, else the only brand you own, else both; the wait follows', () => {
    const E = createApp().__eval;
    const idx = (b, c) => E(`COLORS.findIndex((m) => m.brand === '${b}' && m.code === '${c}')`);
    E("scanBrand = ''");
    own(E, ['Ohuhu|R1', 'Ohuhu|G24']);
    assert.equal(E('ocrWidenBrand()'), 'Ohuhu');
    assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'G24')})`), true);
    assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'BG24')})`), false);
    // a Copic-only short code isn't read again for an Ohuhu-only collection, so it doesn't wait
    assert.equal(E(`ocrWidenWait(${idx('Copic', 'G03')})`), false);
    own(E, ['Copic|G03']);
    assert.equal(E('ocrWidenBrand()'), 'Copic');
    assert.equal(E(`ocrWidenWait(${idx('Copic', 'G03')})`), true);
    own(E, ['Copic|G03', 'Ohuhu|G24']);
    assert.equal(E('ocrWidenBrand()'), null);
    assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'G24')})`), true);
    own(E, []);
    assert.equal(E('ocrWidenBrand()'), null);
    // the brand chosen wins
    E("scanBrand = 'Ohuhu'");
    own(E, ['Copic|G03']);
    assert.equal(E('ocrWidenBrand()'), 'Ohuhu');
    assert.equal(E(`ocrWidenWait(${idx('Ohuhu', 'G24')})`), true);
    assert.equal(E(`ocrWidenWait(${idx('Copic', 'G03')})`), false);
  });
}

// ---- from v31819.test.mjs ----
// v318.19: older Ohuhu caps print an old code with the name it had then ("R6 Rose Red" is R213 Pomegranate now). The
// reader knows those names (src/data/cap-names.json, COLORS[i].cap) and counts one only WITH its old code: then the
// cap is that marker, with no question. A name of an older cap read with a code as it is now changes nothing. Fails on
// v318.18.
{
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
  const OLD = [
    'YR170',
    'RP6',
    'BR3',
    'E400',
    'YR030',
    'G420',
    'CG050',
    'NG03',
    'PB1',
    'Y7',
    'R10',
    'YR2',
  ].map((c) => [c]);
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
}

// ---- from v31821-caps.test.mjs ----
// v318.21, the code on your cap: Ohuhu renamed 362 markers in June 2025 (R6 Rose Red is R213 Pomegranate now) and
// older caps still say the old code. Each marker remembers what its cap says, from how it came in (Scan's reads, Bought
// ✓, its own switch); the rest follow one setting; the code and name shown are your cap's, "now R213" beside; two
// markers of a guide that show the same code (an older cap's R22, RV17 now, and the R22 of now) are told apart by a *
// and their caps' names. Saved keys stay as they are now. Fails on v318.20.
{
  function app(opts = {}) {
    const a = createApp(opts),
      E = a.__eval,
      t = a.__mstest;
    E('state.owned = new Set(); state.cap = {}; state.capDef = ""; state.capQ = 0; state.capOffer = 0;');
    return { a, E, t };
  }
  const J = (E, s) => JSON.parse(E('JSON.stringify(' + s + ')'));
  // a photo's lines through the reader: [code, [name lines]], six caps a row
  function photo(E, caps) {
    return J(
      E,
      '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1;' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r; let id = 0; const lines = [];' +
        JSON.stringify(caps) +
        '.forEach((t, k) => { const x = 300 * (k % 6), y = 400 * Math.floor(k / 6), me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
        '  (t[1] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: me, box: [x, y + 30 + 20 * j, 80, 20, 0] })); });' +
        'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
        'const o = {}; scanList.filter((e) => !e.ask).forEach((e) => (o[mkey(e.i)] = e.cv || "-")); return o; })()',
    );
  }
  const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2'].map(
    (c) => [c],
  );
  test('shown: an older cap’s code and name, "now R213"; a marker not yours, or with nothing known, as it is now', () => {
    const { E } = app();
    E(
      'state.owned.add("Ohuhu|R213"); state.owned.add("Ohuhu|BG215"); state.owned.add("Ohuhu|CG18"); state.owned.add("Copic|FB")',
    );
    const show = (k) => J(E, '[capCode("' + k + '"), capName("' + k + '"), capNow("' + k + '")]');
    assert.deepEqual(show('Ohuhu|R213'), ['R213', 'Pomegranate', '']);
    E('state.cap["Ohuhu|R213"] = "old"');
    assert.deepEqual(show('Ohuhu|R213'), ['R6', 'Rose Red', 'now R213']);
    // (a short old name the reader leaves out, shown: BG8 Teal is BG215 Dark Pine Green now)
    E('state.cap["Ohuhu|BG215"] = "old"');
    assert.deepEqual(show('Ohuhu|BG215'), ['BG8', 'Teal', 'now BG215']);
    // (not yours: as it's sold now, whatever was known of it)
    E('state.owned.delete("Ohuhu|R213")');
    assert.deepEqual(show('Ohuhu|R213'), ['R213', 'Pomegranate', '']);
    // (the setting: Ohuhu markers with nothing known show their older caps; the Ⅱ shown as II; Copic's fluorescents only
    // by what's known)
    E('state.capDef = "old"');
    assert.deepEqual(show('Ohuhu|CG18'), ['CGII04', 'Cool Grey II 4', 'now CG18']);
    assert.deepEqual(show('Copic|FB'), ['FB', J(E, 'COLORS[keyIdx("Copic|FB")].name'), '']);
    E('state.cap["Copic|FB"] = "old"');
    assert.equal(J(E, 'capCode("Copic|FB")'), 'FB2');
    // (a guide's marker, by its key)
    assert.equal(J(E, 'capCode({ mkey: "Ohuhu|CG18", brand: "Ohuhu", code: "CG18" })'), 'CGII04');
    // (kept clean: a marker with no older code, or a key not a marker, isn't kept)
    assert.deepEqual(
      J(
        E,
        'cleanCap({ "Ohuhu|R213": "old", "Ohuhu|nope": "old", "Ohuhu|R213x": "new", "Copic|R20": "old" })',
      ),
      {
        'Ohuhu|R213': 'old',
      },
    );
  });
  test('what a cap says, by how Scan read it: an old code, a code as it is now, R22 only with its name, a code put right by its old name', () => {
    const { E } = app();
    const p = photo(E, OLD.concat([['R6'], ['5110', ['Dark Suntan']], ['R22', ['Dark Blush']]]));
    assert.equal(p['Ohuhu|R213'], 'old', JSON.stringify(p));
    assert.equal(p['Ohuhu|YR312'], 'old', 'put right by its old name: ' + JSON.stringify(p));
    // (R22 is the R22 of now and RV17's old code: with "Dark Blush", RV17's older cap)
    assert.equal(p['Ohuhu|RV17'], 'old', JSON.stringify(p));
    // (typed, a code as it is now: the cap of now; R22 alone tells nothing, being RV17's old code too)
    E('scanList = []; scanBrand = "Ohuhu"; scanHandleCodes("R213\\nB115", false, false, false);');
    assert.deepEqual(J(E, 'scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + ":" + (e.cv || "-"))'), [
      'Ohuhu|B115:new',
      'Ohuhu|R213:new',
    ]);
    assert.equal(J(E, 'capCvRead(keyIdx("Ohuhu|R22"), false, false)'), '');
    assert.equal(J(E, 'capCvRead(keyIdx("Ohuhu|R22"), false, true)'), 'new');
  });
  test('Add notes what the caps say on markers yours after it (Undo puts it back); the offer to switch the rest, once', () => {
    const { E } = app();
    E('state.owned.add("Ohuhu|R213"); state.owned.add("Ohuhu|B115"); state.cap["Ohuhu|B115"] = "old"');
    E(
      'scanList = [{ i: keyIdx("Ohuhu|R213"), how: "old", cv: "old" }, { i: keyIdx("Ohuhu|B115"), how: "", cv: "new" }, { i: keyIdx("Ohuhu|R10"), how: "", cv: "" }];',
    );
    const ch = J(E, 'capFromList(scanList)');
    assert.deepEqual(ch, { 'Ohuhu|R213': ['', 'old'], 'Ohuhu|B115': ['old', 'new'] });
    E('capApply(capFromList(scanList))');
    assert.deepEqual(J(E, 'state.cap'), { 'Ohuhu|R213': 'old', 'Ohuhu|B115': 'new' });
    E('capApply(' + JSON.stringify(ch) + ', true)');
    assert.deepEqual(J(E, 'state.cap'), { 'Ohuhu|B115': 'old' });
    // (the offer: five Ohuhu caps at least, half or more the other version than the setting gives; not a pasted list's)
    const list = (o, n, pasted) =>
      'Object.keys(COLORS).filter((i) => COLORS[i].brand === "Ohuhu" && capHasOld(COLORS[i])).slice(0, ' +
      (o + n) +
      ').map((i, k) => ({ i: +i, cv: k < ' +
      o +
      ' ? "old" : "new"' +
      (pasted ? ', pasted: true' : '') +
      ' }))';
    assert.equal(J(E, 'capOfferFor(' + list(5, 4) + ')'), 'old');
    assert.equal(J(E, 'capOfferFor(' + list(4, 0) + ')'), '');
    assert.equal(J(E, 'capOfferFor(' + list(1, 60) + ')'), '');
    assert.equal(J(E, 'capOfferFor(' + list(9, 1, true) + ')'), '');
    E('state.capDef = "old"');
    assert.equal(J(E, 'capOfferFor(' + list(1, 9) + ')'), 'new');
    E('state.capOffer = 1');
    assert.equal(J(E, 'capOfferFor(' + list(1, 9) + ')'), '');
  });
  test('Bought ✓ is the cap of now; the switch and the setting are kept, through a reload', () => {
    const st = memoryStorage();
    const { E } = app({ localStorage: st });
    E(
      'state.owned.add("Ohuhu|R213"); state.cap["Ohuhu|R213"] = "old"; state.wish = [{ k: "Ohuhu|R213", why: "", ts: 1 }]; save(true);',
    );
    E('wishBought("Ohuhu|R213")');
    assert.equal(J(E, 'state.cap["Ohuhu|R213"]'), 'new');
    E('capSetOne("Ohuhu|R213", "old"); capSetDef("old", "menu");');
    const b = createApp({ localStorage: st });
    assert.deepEqual(J(b.__eval, '[state.cap["Ohuhu|R213"], state.capDef, state.capQ]'), ['old', 'old', 1]);
  });
  test('backups carry what caps say: a restore replacing your markers takes them, one adding to yours merges, yours win; the restore’s fingerprint is the same with none', () => {
    const { E } = app();
    E('state.cap = { "Ohuhu|R213": "new" }; state.capDef = "";');
    assert.equal(
      J(E, 'capRestore({ cap: { "Ohuhu|R213": "old", "Ohuhu|CG18": "old" }, capDef: "old" }, false)'),
      1,
    );
    assert.deepEqual(J(E, '[state.cap, state.capDef]'), [{ 'Ohuhu|R213': 'new', 'Ohuhu|CG18': 'old' }, '']);
    E('capRestore({ cap: { "Ohuhu|B115": "old" }, capDef: "old", capQ: 1 }, true)');
    assert.deepEqual(J(E, '[state.cap, state.capDef, state.capQ]'), [{ 'Ohuhu|B115': 'old' }, 'old', 1]);
    // (a backup from before: nothing changes)
    assert.equal(J(E, 'capRestore({ owned: [] }, true)'), 0);
    // (the put-back after a restore, kept by v318.20 with no caps, still matches while no cap is known)
    E('state.cap = {}; state.capDef = ""');
    const now = J(E, 'mkSig()'),
      v31820 = J(
        E,
        'leaveHash(JSON.stringify([[...state.owned].sort(), state.wish.map((w) => w.k), Object.keys(state.ink).sort().map((k) => k + state.ink[k]), state.buyBrands == null ? null : state.buyBrands.slice()]))',
      );
    assert.equal(now, v31820);
  });
  test('a guide with an older cap’s R22 (RV17 now) and the R22 of now: a * on the older one, both named by their caps', () => {
    const { E, t } = app();
    E(
      'state.owned = new Set(["Ohuhu|RV17", "Ohuhu|R22", "Ohuhu|R213", "Copic|R22"]); state.cap = { "Ohuhu|RV17": "old" };',
    );
    t.coll = E('sfCollection()');
    const by = {};
    t.coll.forEach((m) => (by[m.mkey] = m));
    const guide = (keys) => {
      const assign = {},
        order = [];
      keys.forEach((k, i) => {
        assign[i + 1] = by[k];
        order.push(i + 1);
      });
      t.comps = [null].concat(keys.map(() => ({ area: 100, cx: 0, cy: 0 })));
      t.assignData = { assign, order, N: order.length };
    };
    guide(['Ohuhu|RV17', 'Ohuhu|R22', 'Ohuhu|R213']);
    const A = t.assignData.assign;
    assert.equal(t.capLabel(A[1]), 'R22*');
    assert.equal(t.capLabel(A[2]), 'R22');
    assert.equal(t.capLabel(A[3]), 'R213');
    assert.equal(t.sameName(A[2]), 'R22* Dark Blush cap');
    assert.equal(t.sameName(A[1]), 'R22 Ballet Pink cap');
    assert.equal(t.capKeyName(A[1]), 'Dark Blush, now RV17');
    // (without the R22 of now in the guide: no *, nothing to tell apart)
    guide(['Ohuhu|RV17', 'Ohuhu|R213']);
    assert.equal(t.capLabel(t.assignData.assign[1]), 'R22');
    // (three: the Copic R22 too: its brand's mark, as before, and the * on the older Ohuhu cap)
    guide(['Ohuhu|RV17', 'Ohuhu|R22', 'Copic|R22']);
    const B = t.assignData.assign;
    assert.equal(t.capLabel(B[1]), 'R22*');
    assert.deepEqual(Object.keys(t.sameCodeScan().b).sort(), ['Copic|R22', 'Ohuhu|R22', 'Ohuhu|RV17']);
    assert.equal(t.sameName(B[3]), 'Ohuhu R22* or Ohuhu R22');
  });
}

// ---- from v31822-debug.test.mjs ----
// v318.22 debugging pass: the Ⅱ-grey rule by brand (Copic chosen, a stop in a code, a BG cap of now named); a change
// between two markers that show one code names both by their caps. Fails on v318.22's first build.
{
  function photo(caps, brand) {
    const a = createApp();
    return JSON.parse(
      a.__eval(
        '(function () { scanList = []; scanBrand = ' +
          JSON.stringify(brand || '') +
          '; ocrPhotos = 1;' +
          'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
          'ocrRun = r; let id = 0; const lines = [];' +
          JSON.stringify(caps) +
          '.forEach((t, k) => { const x = 300 * (k % 6), y = 400 * Math.floor(k / 6), me = ++id;' +
          '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
          '  (t[1] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: me, box: [x, y + 30 + 20 * j, 80, 20, 0] })); });' +
          'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
          'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + (e.how === "fixed" ? " as " + e.as : "") + (e.cv ? " cv " + e.cv : "")),' +
          ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) }); })()',
      ),
    );
  }
  const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'].map(
    (c) => [c],
  );
  test('the Ⅱ-grey rule by brand: Copic chosen, a stop in a code, a BG cap of now with its name', () => {
    // (Copic chosen, too few caps to tell the photo's brand: Copic's BG05, as v318.21 read it)
    const a = photo([['BG期05'], ['E31']], 'Copic');
    assert.ok(a.list.includes('Copic|BG05') || a.asks.some((q) => /Copic\|BG05/.test(q)), JSON.stringify(a));
    assert.ok(!JSON.stringify(a).includes('B411'), JSON.stringify(a));
    // (a stop or a dash is no Ⅱ: BG05 as read)
    const b = photo(OLD.concat([['BG.05', ['Light Sea Blue']]]));
    assert.ok(
      b.list.some((k) => /^Ohuhu\|BG05/.test(k)) && !JSON.stringify(b).includes('B411'),
      JSON.stringify(b),
    );
    // (junk that may be a Ⅱ, with the BG cap of now's whole name: that cap, as it is now)
    const c = photo(OLD.concat([['BG期05', ['Light Sea Blue']]]));
    assert.ok(c.list.includes('Ohuhu|BG05 as BG期05 cv new'), JSON.stringify(c));
    assert.deepEqual(c.asks, []);
  });
  test('a change between two markers that show one code names both by their caps', () => {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    E(
      'state.owned = new Set(["Ohuhu|RV17","Ohuhu|R22","Ohuhu|R213"]); state.cap = {"Ohuhu|RV17":"old"}; state.capDef="";',
    );
    const by = {};
    E('sfCollection()').forEach((m) => (by[m.mkey] = m));
    t.coll = E('sfCollection()');
    // (after the change, the older cap's R22 gone from the guide: its * gone too)
    t.comps = [null, {}, {}];
    t.assignData = { assign: { 1: by['Ohuhu|R22'], 2: by['Ohuhu|R213'] }, order: [1, 2], N: 2 };
    const p = t.capPair(by['Ohuhu|RV17'], by['Ohuhu|R22']);
    assert.notEqual(p[0], p[1], JSON.stringify(p));
    assert.match(p[0], /^R22\*? \S/);
    assert.match(p[1], /^R22 \S/);
    // (two codes apart: as before, the labels alone)
    const q = t.capPair(by['Ohuhu|R22'], by['Ohuhu|R213']);
    assert.equal(JSON.stringify(q.slice(0, 2)), JSON.stringify(['R22', 'R213']));
  });
  test('second pass: Look closer reads under the photo’s own brand; a worker ended tells a closer look waiting on it', () => {
    const app = createApp();
    assert.equal(app.__eval('ocrBrandOf({ brand0: "", brands: { Ohuhu: 12 } })'), '');
    assert.equal(app.__eval('ocrBrandOf({ brands: { Ohuhu: 12 } })'), 'Ohuhu');
    const r = app.__eval(
      '(function () { let got = ""; ocrCl = { wait: { res: () => (got = "res"), rej: (e) => (got = "rej " + e.message) } };' +
        ' ocrEnd(); const w = ocrCl.wait; ocrCl = null; return got + (w === null ? " cleared" : ""); })()',
    );
    assert.equal(r, 'rej ended cleared');
  });
  test('(v318.22) a field a newer version wrote lives through this one’s save; a retired one doesn’t come back', async () => {
    const { memoryStorage } = await import('./harness.mjs');
    const ls = memoryStorage(),
      first = createApp({ localStorage: ls }),
      K = first.__eval('KEY');
    first.__eval('state.owned = new Set(["Ohuhu|R014"]); save(true)');
    // (a newer version's field, a field this one gave up writing, and a newer per-marker field the size a whole
    // collection's comes to: 364 entries, past the 4 KB a first version of this had capped it at)
    const raw = JSON.parse(ls.getItem(K));
    raw.zFuture = { keep: 'me' };
    raw.finderView = 'gone';
    raw.zBig = Object.fromEntries(
      first
        .__eval('COLORS.filter((c) => c.brand === "Ohuhu").map((c) => c.brand + "|" + c.code)')
        .map((k) => [k, 'old']),
    );
    ls.setItem(K, JSON.stringify(raw));
    const app = createApp({ localStorage: ls }),
      E = app.__eval,
      stored = () => JSON.parse(ls.getItem(K));
    E('save(true)');
    assert.deepEqual(stored().zFuture, { keep: 'me' });
    assert.equal(stored().finderView, undefined, 'a retired field is not put back');
    assert.equal(Object.keys(stored().zBig).length, 364, 'a large field is kept whole');
    assert.deepEqual(stored().owned, ['Ohuhu|R014']);
    // (and through its own next save, with nothing read in between)
    E('save(true)');
    assert.deepEqual(stored().zFuture, { keep: 'me' });
    // another tab adding a field while this one is open: through the storage event, and through save's own read
    const two = stored();
    two.zLater = 7;
    ls.setItem(K, JSON.stringify(two));
    E('syncFromStorage(); save(true)');
    assert.equal(stored().zLater, 7);
    const three = stored();
    three.zNoSync = 9;
    ls.setItem(K, JSON.stringify(three));
    E('save(true)');
    assert.equal(stored().zNoSync, 9, 'savedMerge’s own read of another tab’s save counts too');
    // (v318.22, fourth pass) as many fields as a newer version may add, of every size: 30, one a map over every marker
    // and one a list of 500 entries (a first version kept 20 and dropped the rest)
    const many = stored();
    const all = first.__eval('COLORS.map((c) => c.brand + "|" + c.code)');
    for (let k = 0; k < 28; k++) many['zMany' + k] = k;
    many.zNotes = Object.fromEntries(all.map((m) => [m, 'a note about it']));
    many.zLog = Array.from({ length: 500 }, (_, k) => ({ at: k, what: 'ticked' }));
    ls.setItem(K, JSON.stringify(many));
    const later = createApp({ localStorage: ls });
    later.__eval('save(true); state.owned.add("Ohuhu|R015"); save(true)');
    const kept = stored();
    assert.equal(Object.keys(kept).filter((k) => /^zMany/.test(k)).length, 28);
    assert.equal(Object.keys(kept.zNotes).length, all.length);
    assert.equal(kept.zLog.length, 500);
    // a stored "__proto__" is not carried, and nothing is polluted by it
    const four = JSON.parse(JSON.stringify(stored()).replace(/^\{/, '{"__proto__":{"polluted":1},'));
    ls.setItem(K, JSON.stringify(four));
    assert.match(ls.getItem(K), /"__proto__"/, 'the stored state really holds one');
    const last = createApp({ localStorage: ls });
    last.__eval('save(true)');
    assert.equal(last.__eval('JSON.stringify([({}).polluted, state.polluted])'), '[null,null]');
  });
  test('second pass: another tab’s save from before v318.21 (no caps) leaves what caps say here', async () => {
    const { memoryStorage } = await import('./harness.mjs');
    const ls = memoryStorage(),
      app = createApp({ localStorage: ls }),
      E = app.__eval,
      K = E('KEY');
    E(
      'state.owned = new Set(["Ohuhu|R213"]); state.cap = { "Ohuhu|R213": "old" }; state.capDef = "old"; state.capQ = 1; save(true)',
    );
    const raw = JSON.parse(ls.getItem(K));
    delete raw.cap;
    delete raw.capDef;
    delete raw.capQ;
    delete raw.capOffer;
    raw.wish = ['Ohuhu|R14'];
    ls.setItem(K, JSON.stringify(raw));
    E('syncFromStorage()');
    assert.equal(
      E('JSON.stringify([state.cap, state.capDef, state.capQ])'),
      '[{"Ohuhu|R213":"old"},"old",1]',
    );
    // (a restore's put-back carries the offer's flag too)
    assert.equal(E('state.capOffer = 1; mkSnap().capOffer'), 1);
  });
}

// ---- from v31822-third.test.mjs ----
// v318.22, the third debugging pass: codes typed into Scan kept (left in the box as Scan closes; with a brand tapped;
// a question gone once its marker is in); Tick colours on a chart saving only what was changed there and labelling
// markers by their caps; search by an older cap's name; To buy and the swatch chart by your caps' codes; the * on a
// swatch chart; a copy's name keeping a year; a locked colour kept the base of Generate; a Rainbow's base and its
// failure said; the photo's boxes drawn at Done as later. Each fails on v318.22's first build (68199d0).
{
  const J = (a, s) => JSON.parse(a.__eval('JSON.stringify(' + s + ')'));
  // Scan: the brand set for you (auto) or tapped, cards caught
  function scan(brand, chosen) {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval(`
    scanList = []; scanBrand = ${JSON.stringify(brand)}; scanBrandChosen = ${!!chosen};
    scanAutoB = ${chosen ? "''" : JSON.stringify(brand)}; scanSw = scanSwNew();
    window.__cards = []; scanSay = function (k, a, b, i, ch) { __cards.push({ k: k, big: String(a), small: String(b || ''), labels: ch ? ch.map((c) => c.label || c.head) : [] }); };
    window.__read = function (t, loud) { const n = scanHandle(t, !!loud); scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLastMany = { key: '', at: 0 }; return n; };`);
    return {
      read: (t, loud) => a.__eval('__read(' + JSON.stringify(t) + ',' + !!loud + ')'),
      closing: (t) =>
        a.__eval(
          'scanMute = true; try { __read(' + JSON.stringify(t) + ', false) } finally { scanMute = false }',
        ),
      asks: () => J(a, 'scanList.filter((e) => e.ask).map((e) => e.title)'),
      list: () => J(a, 'scanList.filter((e) => !e.ask).map((e) => mkey(e.i))'),
      last: () => J(a, '__cards[__cards.length - 1]'),
      a,
    };
  }
  test('Scan: a code typed and left in the box as Scan closes is asked in the list, not carded and lost', () => {
    const s = scan('Ohuhu', false);
    s.closing('RV10');
    assert.deepEqual(s.asks(), ['RV10: Copic’s, or an Ohuhu code misread (RV18, RV19)?']);
    // (Scan Text's read with the dialog open is still a card: the cap held still is read whole)
    const t = scan('Ohuhu', false);
    t.read('RV10', false);
    assert.deepEqual(t.asks(), []);
    assert.equal(t.last().small, 'Hold the cap still');
  });
  test('Scan with a brand tapped: another brand’s code typed is a question naming its marker, and the box clears', () => {
    const s = scan('Ohuhu', true);
    assert.equal(s.read('C-3', true), 1, 'read: the box clears');
    assert.equal(s.asks().length, 1);
    assert.match(s.asks()[0], /^Copic C-3 .*: add it\? Another brand than the one chosen \(Ohuhu\)$/);
    assert.equal(s.read('Y06', true), 1);
    assert.deepEqual(s.list(), ['Ohuhu|Y06']);
    assert.equal(s.asks().length, 1, 'C-3 still asked');
    // (a pasted list keeps its own wording)
    const p = scan('Ohuhu', true);
    p.read('B015\nC-3', true);
    assert.ok(
      p.asks().some((q) => /^Another brand than the one chosen \(Ohuhu\): add it\?$/.test(q)),
      p.asks().join(' | '),
    );
  });
  test('Scan: a question about another brand’s marker goes once that marker is in the list', () => {
    const s = scan('Ohuhu', false);
    s.read('RV10', true);
    assert.equal(s.asks().length, 1);
    s.a.__eval('scanTake(keyIdx("Copic|RV10"), "chosen", true)');
    assert.deepEqual(s.list(), ['Copic|RV10']);
    assert.deepEqual(s.asks(), [], 'not left waiting with its answer in');
  });
  test('Tick colours on a chart: Save changes only what was ticked there; markers labelled by your caps', () => {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval(
      'state.owned = new Set(["Ohuhu|R213","Ohuhu|B115"]); chartOn = new Set(state.owned); chartBase = new Set(state.owned);',
    );
    // (another tab added G36 meanwhile; Y26 ticked here)
    a.__eval('state.owned.add("Ohuhu|G36"); chartOn.add("Ohuhu|Y26")');
    assert.deepEqual(J(a, 'chartChanges()'), { add: ['Ohuhu|Y26'], del: [] });
    // (unticked here and still had: removed)
    a.__eval('chartOn.delete("Ohuhu|B115")');
    assert.deepEqual(J(a, 'chartChanges()'), { add: ['Ohuhu|Y26'], del: ['Ohuhu|B115'] });
    // labels: with older codes set, a marker not yet ticked shows its older cap's code (R23 on an older cap is R38 now)
    a.__eval('state.cap = {}; state.capDef = "old"');
    assert.equal(J(a, 'capCodeAny("Ohuhu|R38")'), 'R23');
    assert.equal(
      J(a, 'capCode("Ohuhu|R38")'),
      'R38',
      'elsewhere, one you don’t have shows the code sold now',
    );
    a.__eval('state.capDef = ""');
    assert.equal(J(a, 'capCodeAny("Ohuhu|R38")'), 'R38');
  });
  test('Search finds a marker by its older cap’s name where its cap is shown older', () => {
    const a = createApp();
    a.__eval('state.owned = new Set(["Ohuhu|RV17"]); state.cap = { "Ohuhu|RV17": "old" }; state.capDef = ""');
    assert.equal(J(a, 'sMatch(keyIdx("Ohuhu|RV17"), "dark blush")'), true);
    a.__eval('state.cap = { "Ohuhu|RV17": "new" }');
    // (v318.26: found with the cap of now too, by the older cap's name typed whole (sByCap), its cell saying that cap;
    // it had been "not with the cap of now")
    assert.equal(
      J(a, 'sMatch(keyIdx("Ohuhu|RV17"), "dark blush")'),
      true,
      'with the cap of now too (v318.26)',
    );
    assert.equal(J(a, 'sByCap(keyIdx("Ohuhu|RV17"), "dark blush")'), true);
    assert.equal(J(a, 'sMatch(keyIdx("Ohuhu|RV17"), "dark")'), false, 'not by its first word alone');
    a.__eval('state.owned = new Set(); state.cap = {}; state.capDef = "old"');
    assert.equal(
      J(a, 'sMatch(keyIdx("Ohuhu|R213"), "rose red")'),
      true,
      'nor yours yet, with older codes set',
    );
  });
  test('To buy and the swatch chart go by your caps’ codes; two boxes with one code: the older cap’s gets the *', () => {
    const a = createApp({ performance });
    a.__eval(
      'state.owned = new Set(["Ohuhu|R213"]); state.cap = {"Ohuhu|R213":"old"}; state.capDef = ""; state.wish = []; state.ink = {};',
    );
    a.__eval(
      'state.saved = [{ id: "g1", type: "guide", name: "Rose", ts: 1, keys: ["Ohuhu|R213"], fr: 2 }]; _gbuy = null;',
    );
    const g = J(a, 'guideBuys().want.map((x) => x.for)');
    assert.ok(g.length && g.every((f) => f.join() === 'R6'), JSON.stringify(g));
    // (Code order: as printed, R6 before R22 before RV260)
    a.__eval(
      'state.owned = new Set(["Ohuhu|R213","Ohuhu|RV17","Ohuhu|R22"]); state.cap = {"Ohuhu|R213":"old","Ohuhu|RV17":"old"}',
    );
    const idx = J(a, '["Ohuhu|R22","Ohuhu|RV17","Ohuhu|R213"].map(keyIdx)');
    const order = J(a, `swGroups(${JSON.stringify(idx)}, 'code').map((g) => g.idxs.map((i) => capCode(i)))`);
    assert.deepEqual(order.flat(), ['R6', 'R22', 'R22'], JSON.stringify(order));
    assert.deepEqual(J(a, `[...swStars(${JSON.stringify(idx)})].map((i) => mkey(i))`), ['Ohuhu|RV17']);
  });
  test('a copy’s name: a year in brackets is part of the name; a copy number is counted on', () => {
    const a = createApp();
    assert.equal(J(a, 'copyName("Garden (2024)", new Set(["garden (2024)"]))'), 'Garden (2024) (2)');
    assert.equal(J(a, 'copyName("Moss (2)", new Set(["moss", "moss (2)"]))'), 'Moss (3)');
  });
  test('Palette: with a colour locked, Generate keeps the scheme round it (Analogous’s neighbours stay near)', () => {
    const a = createApp({ localStorage: memoryStorage() });
    const E = a.__eval;
    E(
      'presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k)); state.pool = null; state.ink = {}',
    );
    E(
      'state.mode = "palette"; state.harmony = "analogous"; state.palSize = 5; state.palettes = []; state.locked = []; state.seed = null; state.excluded = new Set(); setPool(null)',
    );
    E(
      'window.__gen = function () { const pal = genPalette(state.palSize, state.harmony, Object.assign(paletteOpts(), { reroll: true })); if (pal) { state.palettes.push(pal); state.locked = state.locked.filter((i) => pal.includes(i)); } return pal; }',
    );
    let far = 0;
    for (let seed = 1; seed <= 6; seed++) {
      E(
        'state.palettes = []; state.locked = []; Math.random = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(' +
          seed * 7919 +
          ')',
      );
      const p = J(a, '__gen()');
      const lock = p[2];
      E('state.locked = [' + lock + ']');
      for (let k = 0; k < 5; k++) J(a, '__gen()');
      const near = J(
        a,
        `(function () { const p = state.palettes[state.palettes.length - 1]; return p.filter((i) => i !== ${lock}).map((i) => hueDist(LCH[i][2], LCH[${lock}][2])); })()`,
      );
      if (Math.min(...near) > 45) far++;
    }
    assert.equal(far, 0, 'every palette has a colour within 45° of the one locked');
  });
  test('Palette: a Rainbow from too few clear colours says so; built from a marker, its line names that base', () => {
    const a = createApp({ localStorage: memoryStorage() });
    const E = a.__eval;
    E(
      'window.__t = []; toast = function (m) { __t.push(m); }; state.harmony = "rainbow"; state.palSize = 6; state.pool = null',
    );
    E('palFailToast()');
    assert.match(J(a, '__t[0]'), /don’t have the 6 clear colours a rainbow needs/);
    // (built from a marker, its line names that base, wherever its hue puts it in the rainbow)
    E(
      'presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k)); state.seed = "Ohuhu|B111"',
    );
    const sub = J(a, 'palSub(genPalette(6, "rainbow", Object.assign(paletteOpts(), { reroll: true })))');
    assert.match(sub, /^Rainbow · Ohuhu .* base$/);
  });
  test('the photo’s boxes at Done are drawn as every later drawing is, outside its reading rules', () => {
    const a = createApp();
    const r = J(
      a,
      `(function () { scanList = []; scanBrand = ''; ocrPhotos = 1; const was = []; const o = ocrDraw; ocrDraw = function (r) { was.push(scanPhoto); };
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', cv: {}, img: { w: 1000, h: 800 } };
    ocrRun = r; ocrDone(r, { lines: [{ id: 1, look: 1, text: 'R10', conf: 0.97, unsure: false, nameOf: 0, box: [100, 100, 60, 30, 0] }], stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon); ocrDraw = o; return was; })()`,
    );
    assert.ok(r.length >= 1 && r[r.length - 1] === false, JSON.stringify(r));
  });
  // ---- the fourth pass: what it found in the third's fixes ----

  test('Undo this photo gives back a question about another brand’s marker that the photo took', () => {
    const a = createApp({ localStorage: memoryStorage() });
    const r = J(
      a,
      `(function () {
    scanList = []; scanBrand = 'Ohuhu'; scanBrandChosen = false; scanAutoB = 'Ohuhu'; scanSw = scanSwNew(); ocrAnswered = [];
    scanTookAt.clear(); scanAnsweredAt.clear(); scanLast = { i: -1, at: 0 }; state.owned = new Set();
    scanSay = function () {};
    scanHandle('E000', true);
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '' };
    ocrRun = r; ocrPhotos = 1;
    const lines = ['E000', 'RV10', 'B0000', 'BG0000', 'C-1', 'C-3', 'E31', 'YG03'].map((t, k) => ({ id: k + 1, look: 1, text: t, conf: 0.9, unsure: false, nameOf: 0, box: [100 * k, 0, 60, 30, 0] }));
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    const took = scanList.some((e) => !e.ask && mkey(e.i) === 'Copic|E000');
    // (Undo this photo, as its button does)
    const mine = (e) => e.photo === r.n;
    scanList = scanList.filter((e) => !mine(e));
    ocrAnswered = ocrAnswered.filter((x) => { if (x.by !== r.n) return true; if (!mine(x.e)) scanList.splice(ocrGroupAt(x.e), 0, x.e); return false; });
    return { took: took, back: scanList.filter((e) => e.ask).map((e) => e.ask) };
  })()`,
    );
    assert.equal(r.took, true);
    assert.deepEqual(r.back, ['other Copic|E000']);
  });
  test('Look closer boxes each cap of a row at real spacing, its code read at any angle', () => {
    // (caps 64 px apart on the photo's 2048 copy, codes 64 × 28 read upright or slanted, the first three misread)
    for (const ang of [0, 90, -63]) {
      const a = createApp();
      const boxed = J(
        a,
        `(function () {
      scanList = []; scanBrand = ''; ocrPhotos = 1; ocrCloserList = [];
      const r = { n: 1, file: { name: 'x.jpg' }, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1536, h: 2048, ow: 3024, oh: 4032 } };
      ocrRun = r;
      const CODES = ['RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1'], MIS = ['RPX9', 'BRX8', 'YRX7'], xs = CODES.map((_, k) => 300 + 64 * k);
      let id = 0;
      const lines = CODES.map((t, k) => ({ id: ++id, look: 1, text: k < 3 ? MIS[k] : t, conf: k < 3 ? 0.5 : 0.97, unsure: k < 3, nameOf: 0, box: [xs[k], 1000, 64, 28, ${ang}] }));
      ['Y7', 'R10', 'YR2', 'R6'].forEach((t, k) => lines.push({ id: ++id, look: 1, text: t, conf: 0.97, unsure: false, nameOf: 0, box: [300 + 200 * k, 1600, 64, 28, ${ang}] }));
      lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);
      r.cv = {};
      const p = ocrCloserList[0];
      const got = { lines: [0, 1, 2, 3].map((k) => ({ id: 900 + k, look: 1, text: CODES[k], conf: 0.98, unsure: false, nameOf: 0, box: [xs[k] + 3, 1002, 64, 28, ${ang}], closer: true })) };
      ocrCloserMerge(p, got);
      ocrCloserBoxes(p, got, {});
      return xs.map((x) => [...r.items.values()].filter((it) => !it.nameOf && Math.abs(it.box[0] - x) < 6 && Math.abs(it.box[1] - 1000) < 6).length);
    })()`,
      );
      assert.deepEqual(
        boxed,
        [1, 1, 1, 1, 1, 1, 1],
        'one box a cap at ' + ang + '°: ' + JSON.stringify(boxed),
      );
    }
  });
  test('To buy’s From your guides names your marker as your cap now says, after the cap changes', () => {
    const a = createApp({ performance });
    a.__eval(
      'state.owned = new Set(["Ohuhu|R213"]); state.cap = {}; state.capDef = ""; state.wish = []; state.ink = {};',
    );
    a.__eval(
      'state.saved = [{ id: "g1", type: "guide", name: "Rose", ts: 1, keys: ["Ohuhu|R213"], fr: 2 }]; _gbuy = null;',
    );
    const f = () => J(a, 'guideBuys().want.map((x) => x.for.join())');
    assert.ok(
      f().every((x) => x === 'R213'),
      JSON.stringify(f()),
    );
    a.__eval('state.cap = { "Ohuhu|R213": "old" }');
    assert.ok(f().length && f().every((x) => x === 'R6'), JSON.stringify(f()));
  });
  test('Palette: a locked colour keeps its own place in every scheme; a Rainbow names its base only when built from it', () => {
    const a = createApp({ localStorage: memoryStorage() });
    const E = a.__eval;
    E(
      'presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k)); state.pool = null; state.ink = {}; state.excluded = new Set(); setPool(null); state.seed = null',
    );
    // (the base worked out from a lock at the ends of an Analogous fan, and in a second hue's place: the slot there lands
    // on the lock's hue, as genSlots lays it out)
    for (const [h, n, pos] of [
      ['analogous', 5, 0],
      ['analogous', 5, 4],
      ['complementary', 6, 5],
      ['triadic', 6, 3],
    ]) {
      const d = J(
        a,
        `(function () { state.harmony = '${h}'; state.palSize = ${n}; const lock = COLORS.findIndex((c, i) => state.owned.has(mkey(i)) && LCH[i][1] >= GREY_C && LCH[i][2] > 200 && LCH[i][2] < 260);
      const pal = []; for (let p = 0; p < ${n}; p++) pal.push(p === ${pos} ? lock : COLORS.findIndex((c, i) => state.owned.has(mkey(i)) && !pal.includes(i) && i !== lock));
      state.palettes = [pal]; state.palH = ['${h}']; state.locked = [lock];
      const o = paletteOpts(), cx = genCtx('${h}', 'neutral', null); cx.bh = o.baseHue; const s = genSlots(cx, ${n});
      return hueDist(s.slots[${pos}].h, LCH[lock][2]); })()`,
      );
      assert.ok(d < 1, h + ' ' + n + ' place ' + pos + ': ' + d);
    }
    // Rainbow: one made before a marker in it was chosen to build from (back by Undo) doesn't say it's that base
    const r = J(
      a,
      `(function () { state.harmony = 'rainbow'; state.palSize = 6; state.locked = []; state.seed = null;
    const plain = genPalette(6, 'rainbow', Object.assign(paletteOpts(), { reroll: true }));
    state.seed = mkey(plain[2]);
    const seeded = genPalette(6, 'rainbow', Object.assign(paletteOpts(), { reroll: true }));
    return [palSub(plain), palSub(seeded)]; })()`,
    );
    assert.equal(r[0], 'Rainbow');
    assert.match(r[1], / base$/);
  });
  test('a copy’s name keeps a number of four figures or more', () => {
    const a = createApp();
    assert.equal(J(a, 'copyName("Kew (1759)", new Set())'), 'Kew (1759) (2)');
  });
  test('Saved fields: as many as a newer version may add are kept, past twenty', () => {
    const ls = memoryStorage(),
      a = createApp({ localStorage: ls }),
      K = a.__eval('KEY');
    a.__eval('save(true)');
    const raw = JSON.parse(ls.getItem(K));
    for (let k = 0; k < 40; k++) raw['zf' + k] = { k: k };
    ls.setItem(K, JSON.stringify(raw));
    const b = createApp({ localStorage: ls });
    b.__eval('save(true)');
    assert.equal(Object.keys(JSON.parse(ls.getItem(K))).filter((k) => /^zf/.test(k)).length, 40);
  });
}

// ---- from v31824.test.mjs ----
// v318.24: Scan's box reads a Copic grey upside down ("8-N" is N-8), only in that shape (a date with a dash isn't a
// marker); a run of zeros isn't G0000; a number or a size read upside down as one marker is asked, not added.
{
  const a = createApp();
  // what scanRead makes of a word read upside down: each option as "Brand CODE", and whether it's sure
  const flips = (t, brand = '') =>
    JSON.parse(
      a.__eval(
        `JSON.stringify(scanRead(${JSON.stringify(t)}, ${JSON.stringify(brand)}).flips.map((f) => ({ opts: f.opts.map((i) => COLORS[i].brand + ' ' + COLORS[i].code).sort(), sure: f.sure })))`,
      ),
    );
  test('a Copic grey read upside down: its number, the dash, the family turned', () => {
    assert.deepEqual(flips('8-N'), [{ opts: ['Copic N-8'], sure: true }]);
    assert.deepEqual(flips('01-N'), [{ opts: ['Copic N-10'], sure: true }]);
    assert.deepEqual(flips('00-M'), [{ opts: ['Copic W-00'], sure: true }]);
    // a turned 3 reads E: C-3 upside down is "E-C" (letters only, so asked, as a size would be)
    assert.deepEqual(flips('E-C'), [{ opts: ['Copic C-3'], sure: false }]);
    // a turned 7 reads L, as a 1 might: asked between them
    assert.deepEqual(flips('L-M'), [{ opts: ['Copic W-1', 'Copic W-7'], sure: false }]);
    // the dash of another kind, or with spaces round it
    for (const t of ['8–N', '8 - N', '8 -N', '8 — N'])
      assert.deepEqual(flips(t), [{ opts: ['Copic N-8'], sure: true }], t);
    // the right way up, as before
    assert.equal(a.__eval(`scanRead('N-8', '').codes[0].code`), 'N8');
  });
  test('words with a dash that aren’t a turned grey stay unread (dates, times, ranges, sizes as markers unasked)', () => {
    for (const t of [
      '6-13',
      '1-23',
      '2-10',
      '9-10',
      '12-8',
      '5-00',
      '00-0',
      '123-456',
      'E-MAIL',
      'T-SHIRT',
      'X-LARGE',
    ])
      assert.deepEqual(flips(t), [], t);
    // a size in the grey's shape: asked, never added on its own
    for (const t of ['S-M', 'H-M', 'B-C']) {
      const f = flips(t);
      assert.equal(f.length, 1, t);
      assert.equal(f[0].sure, false, t);
    }
  });
  test('a run of zeros isn’t Copic G0000 upside down; a turned G0000 (its G read as 9) still is', () => {
    for (const t of ['000', '0000', '00000']) assert.deepEqual(flips(t), [], t);
    assert.ok(flips('00009').some((f) => f.opts.includes('Copic G0000')));
  });
  test('a number read upside down as one marker is asked, not added (digits bent into a code, as v318.2)', () => {
    for (const t of ['1100', '001', '123']) {
      const f = flips(t);
      assert.ok(f.length && f.every((x) => x.sure === false), t + ': ' + JSON.stringify(f));
    }
    // in Scan's box: the question, nothing in the list
    const b = createApp();
    b.__eval(`scanList = []; scanBrand = ''; scanHandle('1100', false)`);
    assert.equal(b.__eval('scanList.filter((e) => !e.ask).length'), 0);
    assert.equal(b.__eval('scanList.filter((e) => e.ask).length'), 1);
    // a turned grey on its own goes in, said as read upside down
    b.__eval(`scanList = []; scanHandle('8-N', false)`);
    assert.deepEqual(
      JSON.parse(b.__eval('JSON.stringify(scanList.filter((e) => !e.ask).map((e) => COLORS[e.i].code))')),
      ['N-8'],
    );
  });
}

// ---- from v31828-y1.test.mjs ----
// v318.28 (fixer Y1, Markers and Scan): "skin" counts the skin tones outside the view; "copic 0" finds the 0s only; a
// long two-brand list is told mixed from its end too; a Honolulu set beside a themed one on the same line; a size after
// " - "; a set's name without its brand's word, with that brand chosen or in Find mode. The browser parts (Home's count,
// the skin search's lines, Tick all shown, the set card, a photo failing after Scan closed, the batch's words) are in
// e2e/v31828-y1. Each fails on v318.27.
{
  const app = createApp(),
    E = app.__eval;
  E('globalThis.Event = globalThis.Event || function (t) { this.type = t; };');
  const idx = (n) => E(`MARKER_SETS.findIndex((p) => p.n === ${JSON.stringify(n)})`);
  const sets = (text, brand, hint) =>
    JSON.parse(
      E(
        `JSON.stringify(scanSets(${JSON.stringify(text)}, ${JSON.stringify(brand || '')}, ${JSON.stringify(hint || '')}).map((g) => g.map((i) => MARKER_SETS[i].n)))`,
      ),
    );
  test('Markers’ "skin" in Owned or Unowned counts the skin tones on the other side, not names with the word', () => {
    // (Honolulu 120: 12 of the 72 skin tones yours; the other 60 are in All)
    E(`state.mode = 'collection'; state.collView = 'owned'; state.excluded = new Set();
     state.owned = new Set(presetMkeys(MARKER_SETS[${idx('Honolulu 120')}])); searchStr = 'skin'`);
    const sk = E('skinIdx().length'),
      mine = E('searchSkin().list.length');
    assert.equal(sk, 72);
    assert.equal(mine, 12);
    assert.equal(E('searchOutside().length'), sk - mine);
    // (none of them yours: all 72 are elsewhere)
    E(`state.owned = new Set(['Ohuhu|B08', 'Ohuhu|B111']); searchStr = 'skin tones'`);
    assert.equal(E('searchSkin()'), null);
    assert.equal(E('searchOutside().length'), 72);
    // (Unowned, the same: the skin tones yours)
    E(`state.collView = 'unowned'; state.owned = new Set(presetMkeys(MARKER_SETS[${idx('Honolulu 120')}]))`);
    assert.equal(E('searchOutside().length'), 12);
    // (another search as before: by name)
    E(`state.collView = 'owned'; searchStr = 'rose red'`);
    assert.deepEqual(
      JSON.parse(E('JSON.stringify(searchOutside().map((i) => COLORS[i].code))')),
      JSON.parse(
        E(
          `JSON.stringify(COLORS.map((c, i) => i).filter((i) => avail(i) && !isOwned(i)).map((i) => COLORS[i].code))`,
        ),
      ),
    );
    E(`searchStr = ''; state.collView = 'all'`);
  });
  test('"copic 0" finds the 0s (C-0, N-0…), not No.10 and No.00 by their names; a number alone as before', () => {
    const find = (q) =>
      JSON.parse(
        E(
          `JSON.stringify(COLORS.map((c, i) => i).filter((i) => sMatch(i, ${JSON.stringify(q)})).map((i) => COLORS[i].code))`,
        ),
      );
    assert.deepEqual(find('copic 0').sort(), ['0', 'C-0', 'N-0', 'T-0', 'W-0']);
    assert.deepEqual(find('cool gray 1'), ['C-1']);
    assert.ok(find('cool gray 10').includes('C-10'));
    assert.deepEqual(find('cool gray 00'), ['C-00']);
    assert.ok(find('gray no 3').includes('C-3'));
    // (alone, a number still looks after a code's letters: "10" finds C-10)
    assert.ok(find('10').includes('C-10'));
  });
  test('Scan: a list of both brands past 20,000 characters, one brand after the other, is read as both', () => {
    const r = JSON.parse(
      E(`(function () {
      state.owned = new Set(); scanSw.on = false; scanSw.added = [];
      scanList = []; scanBrand = 'Ohuhu'; scanBrandChosen = true;
      scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear();
      const line = (c) => c.code + ' ' + c.name + ' - alcohol marker, in stock, add to cart';
      const O = COLORS.filter((c) => c.brand === 'Ohuhu'), C = COLORS.filter((c) => c.brand === 'Copic');
      const t = O.concat(C).map(line).join('\\n');
      const lb = scanListBrand(t);
      scanHandle(t, true);
      const mk = scanList.filter((e) => !e.ask), by = (b) => mk.filter((e) => COLORS[e.i].brand === b).length;
      const out = { len: t.length, mixed: !!(lb && lb.mixed), ohuhu: by('Ohuhu'), copic: by('Copic'),
        asks: scanList.filter((e) => e.ask).length };
      // (one brand's long list still that brand's)
      out.copicOnly = scanListBrand(C.map(line).join('\\n')).brand;
      scanList = []; scanBrand = ''; scanBrandChosen = false;
      return JSON.stringify(out);
    })()`),
    );
    assert.ok(r.len > 40000);
    assert.equal(r.mixed, true);
    assert.equal(r.copic, 357);
    assert.equal(r.ohuhu, 363);
    assert.equal(r.asks, 1, 'only the 0 both brands have');
    assert.equal(r.copicOnly, 'Copic');
  });
  test('Scan: a Honolulu set beside a themed set on one line; a size after " - "; skin sizes unsure asked once', () => {
    assert.deepEqual(sets('Ohuhu Honolulu 72 Colors + 6 Skin Tones'), [['6 Skin Tones'], ['Honolulu 72']]);
    assert.deepEqual(sets('Ohuhu Honolulu 72 Colors + 36 Skin Tones'), [['36 Skin Tones'], ['Honolulu 72']]);
    assert.deepEqual(sets('Ohuhu Honolulu 120 Colors + 24 Portrait'), [['24 Portrait'], ['Honolulu 120']]);
    // (the themed set's own size isn't Honolulu's too)
    assert.deepEqual(sets('Ohuhu Honolulu Mid-tone 48 Colors'), [['48 Mid-tone Set']]);
    assert.deepEqual(sets('Ohuhu Honolulu 24 Skin Tone Colors Dual Tips'), [['24 Portrait']]);
    // (two sizes near "skin", neither said as colours: one question, not both sets)
    assert.deepEqual(sets('Ohuhu Honolulu 24 Skin Tone Colors (Pack of 6)'), [
      ['24 Portrait', '6 Skin Tones'],
    ]);
    // (" - 120 Colors")
    assert.deepEqual(sets('Ohuhu Honolulu Alcohol Markers - 120 Colors'), [['Honolulu 120']]);
    assert.deepEqual(sets('Copic Ciao Set - 36 Colors Set A'), [['Ciao 36 - Set A']]);
    assert.deepEqual(sets('Ohuhu Alcohol Markers Skin Tone - 24 Colors Dual Tip'), [['24 Portrait']]);
    // (still not part of an order number)
    assert.deepEqual(sets('Order #-24 Honolulu'), []);
    assert.deepEqual(sets('Order 123-24 Honolulu'), []);
  });
  test('Scan: a set’s name without its brand’s word, with that brand chosen or in Find mode', () => {
    assert.deepEqual(sets('6 Skin Tones', '', 'Ohuhu'), [['6 Skin Tones']]);
    assert.deepEqual(sets('36 Skin Tones', 'Ohuhu'), [['36 Skin Tones']]);
    assert.deepEqual(sets('48 Mid-tone Set', 'Ohuhu'), [['48 Mid-tone Set']]);
    assert.deepEqual(sets('Sketch 72 Set A', 'Copic'), [['Sketch 72 - Set A']]);
    // (no brand chosen: as before, nothing; the other brand named: not the chosen brand's)
    assert.deepEqual(sets('6 Skin Tones'), []);
    assert.deepEqual(sets('Copic Sketch 36 Gray', '', 'Ohuhu'), [['Sketch 36']]);
  });
}

// ---- from v31829-z1.test.mjs ----
// v318.29 (fixer Z1) Scan: a question about a code asked while the brand set for you read it ("Which R27?" typed with
// Ohuhu set for you) offers the other brand's markers of that code too once the reading switches to both brands, so a
// Copic brand tapped after answers it; Keep Ohuhu takes them off again. Fails on v318.29's HEAD.
{
  function studio() {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval(`
    var T = {};
    T.reset = function (brand) {
      scanList = []; scanBrand = brand; scanBrandChosen = false; scanAutoB = brand;
      scanSw = scanSwNew(); scanLastBrand = ''; scanHandleId = 0; scanUnread = 0;
      scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLast = { i: -1, at: 0 };
      scanLastMany = { key: '', at: 0 };
      state.owned = new Set();
      scanSay = function () {};
    };
    T.read = function (t) { scanHandle(t, true); scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLastMany = { key: '', at: 0 }; };
    T.ask = (k) => { const e = scanList.find((e) => e.ask === k); return e ? e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code + '/' + o.how) : null; };
  `);
    return {
      reset: (b) => a.__eval('T.reset(' + JSON.stringify(b) + ')'),
      read: (t) => a.__eval('T.read(' + JSON.stringify(t) + ')'),
      ask: (k) => JSON.parse(a.__eval('JSON.stringify(T.ask(' + JSON.stringify(k) + '))')),
      ev: (s) => a.__eval(s),
    };
  }
  test('"Which R27?" asked with Ohuhu set for you offers Copic R27 too once both brands are read; Keep Ohuhu takes it off', () => {
    const s = studio();
    // as Either brand asks it: Ohuhu R27, Copic R27, then Ohuhu E711 by its old code
    const either = ['Ohuhu R27/chosen', 'Copic R27/chosen', 'Ohuhu E711/old'];
    s.reset('Ohuhu');
    s.read('R27');
    assert.deepEqual(
      s.ask('old R27'),
      ['Ohuhu R27/chosen', 'Ohuhu E711/old'],
      'set for you: Ohuhu’s only, as before',
    );
    // the tester's order: B000, R27, YG17 (the switch comes at YG17, after the question)
    s.reset('Ohuhu');
    ['B000', 'R27', 'YG17'].forEach(s.read);
    assert.equal(s.ev('scanSw.on'), true, 'switched to both brands');
    assert.deepEqual(s.ask('old R27'), either, 'the question offers Copic R27 too');
    // asked after the switch: the same, as before
    s.reset('Ohuhu');
    ['B000', 'YG17', 'R27'].forEach(s.read);
    assert.deepEqual(s.ask('old R27'), either);
    // Keep Ohuhu: the Copic marker the switch added goes again
    s.reset('Ohuhu');
    ['B000', 'R27', 'YG17'].forEach(s.read);
    s.ev('scanSwitchOff()');
    assert.deepEqual(s.ask('old R27'), ['Ohuhu R27/chosen', 'Ohuhu E711/old']);
    // a misread put right ("R2T"): its codes' Copic markers too
    s.reset('Ohuhu');
    ['R2T', 'B000', 'YG17'].forEach(s.read);
    assert.ok(s.ask('fix R2T').indexOf('Copic R27/chosen') >= 0, JSON.stringify(s.ask('fix R2T')));
  });
}

// ---- from v3187-answer.test.mjs ----
// v318.7 Scan, sections 4 and 5: one answer function for the list's chips and the larger view's — the answer takes the
// question's place in the list (not the top) and its photo; a row taken off; and Undo this photo gives a question back
// at its photo's group, not the top. Each test fails on v318.6 (scanAnswer and ocrGroupAt don't exist there; the old
// chip handler unshifted the answer).
{
  function studio() {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval(`
    var T = {};
    T.reset = function () {
      scanList = []; scanBrand = ''; scanBrandChosen = true; scanSw = scanSwNew(); ocrAnswered = [];
      scanTookAt.clear(); scanAnsweredAt.clear(); scanLast = { i: -1, at: 0 }; state.owned = new Set();
      T.cards = [];
      scanSay = function (k, a, b) { T.cards.push({ k: k, big: String(a), small: String(b || '') }); };
    };
    T.ix = (b, c) => COLORS.findIndex((x) => x.brand === b && x.code === c);
    T.m = (b, c, photo) => Object.assign({ i: T.ix(b, c), how: '' }, photo ? { photo: photo } : {});
    T.q = (code, photo) => Object.assign({ ask: 'brands ' + code, title: code + ': Ohuhu or Copic?', at: 1,
      opts: [{ i: T.ix('Ohuhu', code), how: 'chosen' }, { i: T.ix('Copic', code), how: 'chosen' }] }, photo ? { photo: photo } : {});
    T.rows = () => scanList.map((e) => (e.ask ? '?' + e.ask.slice(7) : COLORS[e.i].brand[0] + COLORS[e.i].code) + (e.photo ? '@' + e.photo : ''));
  `);
    return a;
  }
  test('an answer takes the question’s place in the list and its photo; the question isn’t asked again while its cap’s in view', () => {
    const a = studio();
    a.__eval(
      'T.reset(); scanList = [T.m("Ohuhu", "E19"), T.q("B04", 2), T.m("Ohuhu", "B015", 2), T.q("YR07"), T.m("Ohuhu", "R014")];',
    );
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), [
      'OE19',
      '?B04@2',
      'OB015@2',
      '?YR07',
      'OR014',
    ]);
    const n = a.__eval('scanAnswer(scanList[1], T.ix("Copic", "B04"), "chosen")');
    assert.equal(n, 1, 'the question’s place');
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), [
      'OE19',
      'CB04@2',
      'OB015@2',
      '?YR07',
      'OR014',
    ]);
    assert.ok(a.__eval('scanAnsweredAt.has("brands B04")'), 'not asked again while the cap’s in view');
    assert.equal(a.__eval('T.cards[T.cards.length - 1].small'), 'Added to the list · Copic');
    // one of no photo: in place, no photo of its own
    assert.equal(a.__eval('scanAnswer(scanList[3], T.ix("Ohuhu", "YR07"), "chosen")'), 3);
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), [
      'OE19',
      'CB04@2',
      'OB015@2',
      'OYR07',
      'OR014',
    ]);
    assert.equal(a.__eval('"photo" in scanList[3]'), false);
    // the answer already in the list: the question just goes, said so
    a.__eval('scanList.splice(2, 0, T.q("B04", 3))');
    assert.equal(a.__eval('scanAnswer(scanList[2], T.ix("Copic", "B04"), "chosen")'), 2);
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), [
      'OE19',
      'CB04@2',
      'OB015@2',
      'OYR07',
      'OR014',
    ]);
    assert.match(a.__eval('T.cards[T.cards.length - 1].small'), /^Already in the list/);
    // a question gone from the list meanwhile: nothing, -1
    assert.equal(a.__eval('scanAnswer(T.q("B05"), T.ix("Copic", "B05"), "chosen")'), -1);
    assert.equal(a.__eval('scanList.length'), 5);
  });
  test('a row taken off: a question let go by isn’t asked again while its cap’s in view; the last marker read is forgotten', () => {
    const a = studio();
    a.__eval(
      'T.reset(); scanList = [T.q("B04"), T.m("Ohuhu", "E19")]; scanLast = { i: T.ix("Ohuhu", "E19"), at: Date.now() };',
    );
    a.__eval('scanRemove(0)');
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), ['OE19']);
    assert.ok(a.__eval('scanAnsweredAt.has("brands B04")'));
    a.__eval('scanRemove(0)');
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), []);
    assert.equal(a.__eval('scanLast.i'), -1);
    a.__eval('scanRemove(5)');
    assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(T.rows())')), []);
  });
  test('Undo this photo gives a question answered by that photo back at its own photo’s group, not the top', () => {
    const a = studio();
    // the list newest first: a typed marker, photo 3's, photo 2's, photo 1's
    a.__eval(
      'T.reset(); scanList = [T.m("Ohuhu", "R014"), T.m("Ohuhu", "B03", 3), T.m("Ohuhu", "B08", 2), T.m("Ohuhu", "B09", 2), T.m("Ohuhu", "E19", 1)];',
    );
    assert.equal(a.__eval('ocrGroupAt(T.q("B04", 2))'), 2, 'at the top of photo 2’s group');
    assert.equal(a.__eval('ocrGroupAt(T.q("B04", 1))'), 4, 'at the top of photo 1’s group');
    assert.equal(a.__eval('ocrGroupAt(T.q("B04"))'), 0, 'one of no photo at the top');
    // its group gone (that photo undone too): where its photo would sit
    a.__eval('scanList = [T.m("Ohuhu", "R014"), T.m("Ohuhu", "B03", 3), T.m("Ohuhu", "E19", 1)];');
    assert.equal(a.__eval('ocrGroupAt(T.q("B04", 2))'), 2, 'between photo 3 and photo 1');
    assert.equal(a.__eval('ocrGroupAt(T.q("B04", 4))'), 1, 'above photo 3, under the typed one');
    a.__eval('scanList = [T.m("Ohuhu", "B03", 3)];');
    assert.equal(a.__eval('ocrGroupAt(T.q("B04", 2))'), 1, 'after photo 3');
  });
}

// ---- from v3187-brands.test.mjs ----
// v318.7 Scan: an old Ohuhu code that's a Copic code now is asked about with both (section 0); a list typed, pasted or
// opened is read as its own brand (section 1); with the brand set for you, the sweep that shows the other brand
// switches the reading to both brands, with Keep Ohuhu to take it back (section 6). Reads are made up here and go
// through scanHandle as Scan Text's, Enter's and a paste's do; cards are caught. Each test fails on v318.6.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  // one app: every scenario starts afresh (reset). brand: the brand above the box; chosen: tapped (else set for you)
  function studio() {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval(`
    var T = {};
    T.reset = function (brand, chosen, owned) {
      scanList = []; scanBrand = brand; scanBrandChosen = !!chosen; scanAutoB = chosen ? '' : brand;
      scanSw = scanSwNew(); scanLastBrand = ''; scanHandleId = 0; scanUnread = 0;
      scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLast = { i: -1, at: 0 };
      scanLastMany = { key: '', at: 0 };
      state.owned = new Set(owned || []);
      T.cards = [];
      scanSay = function (k, a, b, i, ch) { T.cards.push({ k: k, big: String(a), small: String(b || ''), labels: ch ? ch.map((c) => c.label || c.head) : [] }); };
    };
    // a read, as Scan Text's (quiet) or Enter's and a paste's (loud); the "still in view" state cleared after, as a
    // cap taken away is
    T.read = function (t, loud) { scanHandle(t, !!loud); scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLastMany = { key: '', at: 0 }; };
    T.again = function (t) { scanHandle(t, false); };
    T.set = (n) => { const i = MARKER_SETS.findIndex((p) => p.n === n); return presetMkeys(MARKER_SETS[i]).map((k) => COLORS[keyIdx(k)]); };
    T.key = (c) => c.brand + '|' + scanKey(c.code);
    T.list = () => scanList.filter((e) => !e.ask).map((e) => T.key(COLORS[e.i]));
    T.asks = () => scanList.filter((e) => e.ask).map((e) => e.title + ' [' + e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code + (o.how ? '/' + o.how : '')).join('|') + ']');
    T.last = () => T.cards[T.cards.length - 1] || { k: '', big: '', small: '', labels: [] };
    // reads: [{ t, k: the cap's marker or null for a misread }] → wrong (in the list, not a cap read), lost (neither
    // listed nor asked about), questions, the read the switch came at (0: none)
    T.sweep = function (reads, keepAt) {
      let at = 0;
      reads.forEach((r, n) => {
        T.read(r.t, r.loud);
        if (r.again) T.again(r.t);
        if (!at && scanSw.on) at = n + 1;
        if (keepAt !== undefined && scanSw.on && at && n + 1 - at >= keepAt && !T.kept) { scanSwitchOff(); T.kept = true; }
      });
      const truth = new Set(reads.map((r) => r.k).filter(Boolean)), list = T.list(),
        qs = scanList.filter((e) => e.ask), qOpts = new Set([].concat(...qs.map((e) => e.opts.map((o) => T.key(COLORS[o.i])))));
      return { wrong: list.filter((k) => !truth.has(k)), lost: [...truth].filter((k) => list.indexOf(k) < 0 && !qOpts.has(k)), q: qs.length, at: at, on: scanSw.on, list: list };
    };
    T.caps = (n, names, misread) => T.set(n).map((c) => { const m = misread && misread[c.code]; return m !== undefined ? { t: m, k: null } : { t: names ? c.code + ' ' + c.name : c.code, k: T.key(c) }; });
  `);
    const ev = (src) => JSON.parse(a.__eval('JSON.stringify((function () { ' + src + ' })())'));
    return {
      a,
      ev,
      reset: (brand, chosen, owned) =>
        a.__eval(
          'T.reset(' +
            JSON.stringify(brand) +
            ',' +
            !!chosen +
            ',' +
            JSON.stringify(owned || []) +
            '); T.kept = false;',
        ),
      read: (t, loud) => a.__eval('T.read(' + JSON.stringify(t) + ',' + !!loud + ')'),
      list: () => ev('return T.list();'),
      asks: () => ev('return T.asks();'),
      last: () => ev('return T.last();'),
      sweep: (mk, keepAt) =>
        ev(
          'return T.sweep((function () { ' +
            mk +
            ' })()' +
            (keepAt === undefined ? '' : ', ' + keepAt) +
            ');',
        ),
      sw: () =>
        ev(
          'return { on: scanSw.on, off: scanSw.off, row: scanSw.row, brand: scanBrand, whole: scanSw.whole.size, other: scanSw.other.size, autoOnly: scanSw.autoOnly };',
        ),
    };
  }
  /* ---- section 1: a list read as its own brand ---- */

  const CIAO = `return T.set('Ciao 36 - Set A').map((c) => c.code)`;
  /* ---- section 0: an old Ohuhu code that's a Copic code now ---- */

  test('the ten old Ohuhu codes that are Copic codes now: with Ohuhu chosen, asked with both, the Ohuhu marker first; Either asks both; Copic as before', () => {
    const s = studio();
    const rows = s.ev(
      `const out = {}; for (const k of ['Y13','R21','R11','R17','R24','Y11','R20','R29','R30','YR20']) { out[k] = {}; for (const b of ['', 'Ohuhu', 'Copic']) { const r = scanRead(k, b); out[k][b || 'Either'] = { asked: r.codes.map((c) => c.asked).join(), opts: [].concat(...r.codes.map((c) => c.opts.map((i) => COLORS[i].brand + ' ' + COLORS[i].code))), other: r.other.map((i) => COLORS[i].brand + ' ' + COLORS[i].code) }; } } return out;`,
    );
    for (const k of Object.keys(rows)) {
      const o = rows[k].Ohuhu;
      // (v318.6: other [Copic k], the Ohuhu marker not offered at all)
      assert.deepEqual(o.other, [], k + ' with Ohuhu: ' + JSON.stringify(o));
      assert.equal(o.asked, 'old', k);
      assert.equal(o.opts.length, 2, k + ': ' + o.opts.join('|'));
      assert.match(o.opts[0], /^Ohuhu /, k + ': the brand chosen first: ' + o.opts.join('|'));
      assert.equal(o.opts[1], 'Copic ' + k);
      assert.deepEqual(rows[k].Either.opts.slice().sort(), o.opts.slice().sort(), k + ' with Either');
      assert.deepEqual(rows[k].Copic.opts, ['Copic ' + k], k + ' with Copic');
      assert.deepEqual(rows[k].Copic.other, []);
    }
  });
  test('typed, pasted or swept with Ohuhu chosen: "Which R29?" in the list with both; a quiet read of a code that could be an Ohuhu code read short is a card with every choice; the name settles it', () => {
    const s = studio();
    s.reset('Ohuhu', true);
    // Enter: a question in the list, the Ohuhu marker by its old code first (v318.6: "Another brand than the one chosen")
    s.read('R29', true);
    assert.deepEqual(s.asks(), ['Which R29? [Ohuhu YR47/old|Copic R29/chosen]']);
    assert.deepEqual(s.list(), []);
    // a quiet read (Scan Text) of Y13, which BGY13 and YGY13 end in: a card with both, never a question in the list
    s.reset('Ohuhu', true);
    s.read('Y13', false);
    assert.deepEqual(s.asks(), []);
    let c = s.last();
    assert.equal(c.big, 'Y13: Ohuhu E515 Black Brown (was Y13), or Copic Y13 Lemon Yellow?');
    assert.equal(c.small, 'Or an Ohuhu code read short (BGY13, YGY13) · Hold the cap still');
    assert.deepEqual(c.labels, ['Add Ohuhu E515', 'Add Copic Y13']);
    // (R29: YR29 ends in it; R30: R38 is one digit away: cards too)
    s.read('R29', false);
    assert.equal(s.last().small, 'Or Ohuhu YR29 read short · Hold the cap still');
    s.read('R30', false);
    assert.equal(s.last().small, 'Or Ohuhu R38 misread · Hold the cap still');
    assert.deepEqual(s.asks(), []);
    // R24 is no Ohuhu code read wrong: a question in the list, quietly read too
    s.read('R24', false);
    assert.deepEqual(s.asks(), ['Which R24? [Ohuhu V38/old|Copic R24/chosen]']);
    // typed with the Ohuhu marker's name: that one, by its old code (v318.6: Copic R29 offered)
    s.reset('Ohuhu', true);
    s.read('R29 Dusty Peach', true);
    assert.deepEqual(s.list(), ['Ohuhu|YR47']);
    assert.deepEqual(s.asks(), []);
    // a paste of one line: each a question with both
    s.reset('Ohuhu', true);
    s.read('R29, R30, YR20', true);
    assert.deepEqual(s.asks().sort(), [
      'Which R29? [Ohuhu YR47/old|Copic R29/chosen]',
      'Which R30? [Ohuhu E81/old|Copic R30/chosen]',
      'Which YR20? [Ohuhu YR37/old|Copic YR20/chosen]',
    ]);
    // the old-code Skin Tones list pasted with Ohuhu chosen: no "another brand" trap at all (v318.6: six of them)
    s.reset('Ohuhu', true);
    s.read(s.ev(`return T.set('36 Skin Tones').map((c) => c.old || c.code).join('\\n');`), true);
    assert.ok(!s.asks().some((t) => /Another brand/.test(t)), s.asks().join(' | '));
    assert.ok(s.asks().filter((t) => /^Which /.test(t) && /Copic/.test(t)).length >= 6, s.asks().join(' | '));
    assert.ok(!s.list().some((k) => /^Copic/.test(k)), s.list().join(' '));
  });
  test('a photo of an Ohuhu tray with a lone scrap: nothing added and nothing new asked, as before; a question the photo keeps offers the Ohuhu marker by its old code too', () => {
    const a = createApp({ localStorage: memoryStorage() });
    const photo = (extra) =>
      JSON.parse(
        a.__eval(`(function () {
    scanList = []; ocrAnswered = []; scanBrand = 'Ohuhu'; scanBrandChosen = true; scanAutoB = ''; scanSw = scanSwNew(); ocrPhotos = 0;
    const H = presetMkeys(MARKER_SETS[3]).map((k) => COLORS[keyIdx(k)]).slice(0, 20);
    const lines = []; let id = 1;
    H.forEach((c, k) => lines.push({ id: id++, text: c.code, conf: 0.95, box: [100 + 120 * (k % 8), 100 + 120 * Math.floor(k / 8), 60, 20, 0], unsure: false }));
    ${JSON.stringify(extra)}.forEach((t, k) => lines.push({ id: id++, text: t, conf: 0.95, box: [100 + 120 * k, 600, 60, 20, 0], unsure: false }));
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1200, h: 900 } };
    ocrRun = r; ocrPhotos = 1;
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => COLORS[e.i].brand + ' ' + COLORS[e.i].code), asks: scanList.filter((e) => e.ask).map((e) => e.title + ' [' + e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code + '/' + o.how).join('|') + ']') });
  })()`),
      );
    for (const scrap of ['R29', 'Y13']) {
      const o = photo([scrap]);
      assert.equal(o.list.length, 20, scrap + ': ' + o.list.join(','));
      assert.ok(!o.list.some((x) => /Copic/.test(x)), scrap);
      assert.deepEqual(o.asks, [], scrap + ': ' + o.asks.join(' | '));
    }
    const o = photo(['R24']);
    assert.equal(o.list.length, 20);
    assert.deepEqual(o.asks, ['Which R24? [Ohuhu V38/old|Copic R24/chosen]']);
  });
  test('a Copic set’s codes pasted with Ohuhu chosen: read as Copic, said; set for you: said, and both brands are read from now on; Either: said', () => {
    const s = studio();
    s.reset('Ohuhu', true);
    s.read(s.ev(CIAO + '.join("\\n");'), true);
    assert.equal(s.list().length, 36, s.asks().join(' | '));
    assert.ok(
      s.list().every((k) => /^Copic/.test(k)),
      s.list().join(' '),
    );
    assert.equal(s.last().small, 'Read as Copic, though Ohuhu is chosen above the box');
    assert.equal(s.sw().brand, 'Ohuhu', 'the brand chosen stays');
    // set for you: the switch to both brands, said on the same card
    s.reset('Ohuhu', false);
    s.read(s.ev(CIAO + '.join("\\n");'), true);
    assert.equal(s.list().length, 36);
    assert.equal(
      s.last().small,
      'Read as Copic: its codes are plainly Copic’s · both brands are read from now on',
    );
    assert.deepEqual([s.sw().on, s.sw().brand], [true, '']);
    // Either brand: the ten codes both brands have go in as Copic's, not asked (v318.6: 13 questions)
    s.reset('', true);
    s.read(s.ev(CIAO + '.join("\\n");'), true);
    assert.equal(s.list().length, 36, s.asks().join(' | '));
    assert.equal(s.last().small, 'Read as Copic: its codes are plainly Copic’s');
    // on one line, typed (the box is one line): by the codes, not the lines; "100" beside other codes is asked as ever
    s.reset('Ohuhu', true);
    s.read(s.ev(CIAO + '.join(" ");'), true);
    assert.equal(s.list().filter((k) => /^Copic/.test(k)).length, 35, s.list().join(' '));
    assert.ok(!s.list().some((k) => /^Ohuhu/.test(k)));
    assert.equal(s.asks().length, 1);
  });
  test('a list of both brands’ codes is read as either (its shared codes asked); fewer than five one-brand codes, as before; a line naming its brand is that brand’s', () => {
    const s = studio();
    // 36 Copic codes and one only Ohuhu has: mixed
    s.reset('Ohuhu', true);
    s.read(s.ev(CIAO + '.concat(["B015"]).join("\\n");'), true);
    assert.ok(s.list().includes('Ohuhu|B015'));
    assert.equal(
      s.asks().filter((t) => /: Ohuhu or Copic\?|: Copic or Ohuhu\?/.test(t)).length,
      10,
      s.asks().join(' | '),
    );
    assert.ok(!s.asks().some((t) => /Another brand/.test(t)), s.asks().join(' | '));
    assert.match(
      s.last().small,
      /^Codes of both brands: those both have are asked · A brand tapped above answers them at once/,
    );
    // four Copic-only codes with Ohuhu chosen: asked as another brand's, as before
    s.reset('Ohuhu', true);
    s.read('E71\nC-3\nE21\nE29\nY06', true);
    assert.equal(
      s.asks().filter((t) => /^Another brand than the one chosen \(Ohuhu\)/.test(t)).length,
      4,
      s.asks().join(' | '),
    );
    assert.deepEqual(s.list(), ['Ohuhu|Y06']);
    // a line naming its brand decides, whatever is chosen, and doesn't make the list mixed: "Ohuhu B02" among a Copic
    // set's codes with Ohuhu chosen goes in as Ohuhu's, said, and the rest are read as Copic
    s.reset('Ohuhu', true);
    s.read(s.ev(CIAO + '.concat(["Ohuhu B02"]).join("\\n");'), true);
    assert.ok(s.list().includes('Ohuhu|B02'), s.list().join(' '));
    assert.equal(s.list().filter((k) => /^Copic/.test(k)).length, 36, s.asks().join(' | '));
    assert.ok(!s.asks().length, s.asks().join(' | '));
    assert.match(s.last().small, /^Read as Copic, though Ohuhu is chosen above the box · 1 named Ohuhu/);
    // ("Ohuhu B02" typed on its own with Copic chosen: Ohuhu's, not "another brand than the one chosen")
    s.reset('Copic', true);
    s.read('Ohuhu B02', true);
    assert.deepEqual([s.list(), s.asks()], [['Ohuhu|B02'], []]);
    // the old-code Skin Tones list with Copic chosen: Ohuhu's old codes count for Ohuhu
    s.reset('Copic', true);
    s.read(s.ev(`return T.set('36 Skin Tones').map((c) => c.old || c.code).join('\\n');`), true);
    assert.match(s.last().small, /^Read as Ohuhu, though Copic is chosen above the box/);
    assert.ok(!s.list().some((k) => /^Copic/.test(k)), s.list().join(' '));
    // Scan Text's reads cap by cap are read by the brand chosen, as before
    s.reset('Ohuhu', true);
    s.read('Y06', false);
    assert.deepEqual(s.list(), ['Ohuhu|Y06']);
  });
  test('a set’s name in the text: its card carries how the list was read; every built-in set’s list, current and old codes, is its own brand’s', () => {
    const s = studio();
    s.reset('Ohuhu', true);
    s.read(
      s.ev(
        `return ['COPIC ciao', '36 colors', 'Set A'].concat(T.set('Ciao 36 - Set A').flatMap((c) => [c.code, c.name])).join('\\n');`,
      ),
      true,
    );
    assert.equal(s.list().length, 36);
    assert.match(s.last().big, /^Copic Ciao 36: which one\?/);
    assert.match(s.last().small, /Read as Copic, though Ohuhu is chosen above the box/);
    const sets = s.ev(
      `return MARKER_SETS.map((p) => { const cs = presetMkeys(p).map((k) => COLORS[keyIdx(k)]).filter(Boolean); if (!cs.length) return null; const cur = scanListBrand(cs.map((c) => c.code).join('\\n')), old = scanListBrand(cs.map((c) => c.old || c.code).join('\\n')); return [p.n, cs[0].brand, cur && cur.brand, old && old.brand]; }).filter(Boolean);`,
    );
    assert.ok(sets.length >= 32);
    for (const [n, b, cur, old] of sets) assert.deepEqual([cur, old], [b, b], n);
  });
  test('a long paste isn’t read twice for its brand: 122 KB in no more than 1.3 times one reading', () => {
    const s = studio();
    const text = s.ev(
      `let t = ''; const cs = COLORS.map((c) => c.code + ' ' + c.name); while (t.length < 122000) t += cs.join('\\n') + '\\n'; return t;`,
    );
    assert.ok(text.length > 120000);
    s.reset('Ohuhu', true);
    // (v318.25: over 20 KB, told from its first 20,000 characters, and that part's reading not kept)
    assert.equal(
      s.ev(
        'const lb = scanListBrand(' +
          JSON.stringify(text) +
          '); return JSON.stringify(lb && [lb.brand, !!lb.mixed, lb.r]);',
      ),
      JSON.stringify(['', true, null]),
      'over 20 KB: its first part classified',
    );
    const t0 = cpuMs();
    s.a.__eval('scanRead(' + JSON.stringify(text) + ', "Ohuhu")');
    const one = cpuMs() - t0;
    s.reset('Ohuhu', true);
    const t1 = cpuMs();
    s.read(text, true);
    const all = cpuMs() - t1;
    assert.ok(all <= 1.3 * one + 150, 'read ' + one.toFixed(0) + ' ms, handled ' + all.toFixed(0) + ' ms');
  });
  /* ---- section 6: the sweep that shows the brand (automatic brand only) ---- */

  test('a Copic set swept cap by cap with Ohuhu set for you: nothing wrong goes in, the reading switches to both brands by the third cap, and codes both brands use are asked', () => {
    const s = studio();
    for (const [n, q] of [
      ['Ciao 36 - Set A', 14],
      ['Ciao 12', 8],
      ['Ciao 72 - Set A', 24],
    ]) {
      s.reset('Ohuhu', false);
      const m = s.sweep(`return T.caps(${JSON.stringify(n)});`);
      // (v318.6: Ciao 36 A → 10 Ohuhu markers in the list, 26 vanishing cards)
      assert.deepEqual(m.wrong, [], n + ': ' + m.wrong.join(','));
      assert.ok(m.at >= 1 && m.at <= 5, n + ': switched at read ' + m.at);
      assert.ok(m.lost.length <= 2, n + ' lost: ' + m.lost.join(','));
      assert.ok(m.q <= q, n + ': ' + m.q + ' questions');
      assert.deepEqual([s.sw().on, s.sw().brand], [true, ''], n);
      // with the names: every cap in, none asked
      s.reset('Ohuhu', false);
      const w = s.sweep(`return T.caps(${JSON.stringify(n)}, true);`);
      assert.deepEqual([w.wrong, w.lost, w.q <= 1], [[], [], true], n + ' with names: ' + JSON.stringify(w));
    }
    // the ten shared codes first: held as Ohuhu's, then asked at the switch (hold-since: all ten)
    s.reset('Ohuhu', false);
    const m = s.sweep(
      `const R = T.caps('Ciao 36 - Set A'); const sh = (r) => COLORS.some((c) => c.brand === 'Copic' && c.brand !== 'x' && T.key(c) === r.k) && COLORS.some((c) => c.brand === 'Ohuhu' && scanKey(c.code) === r.k.split('|')[1]); return R.filter(sh).concat(R.filter((r) => !sh(r)));`,
    );
    assert.deepEqual(m.wrong, []);
    assert.ok(m.at >= 11, 'switched at ' + m.at);
    assert.equal(s.asks().filter((t) => /: Ohuhu or Copic\?/.test(t)).length, 10, s.asks().join(' | '));
    // a brand tapped: as before, the user's choice (ten shared codes go in as Ohuhu's), nothing switches
    s.reset('Ohuhu', true);
    const t = s.sweep(`return T.caps('Ciao 36 - Set A');`);
    assert.equal(t.wrong.length, 10);
    assert.equal(t.at, 0);
  });
  test('an Ohuhu set swept with its caps misread as Copic codes (short, a digit, a doubled character, a letter): nothing wrong goes in and nothing switches', () => {
    const s = studio();
    for (const [why, mis] of [
      ['short', { BG114: 'BG11', BGY13: 'Y13' }],
      ['digit', { B08: 'B00', G49: 'G40', Y08: 'Y00' }],
      ['doubled', { B112: 'B12', B114: 'B14' }],
      ['letter', { B08: 'R08', E14: 'B14', G49: 'C49' }],
      ['mixed', { BG114: 'BG11', B08: 'B00', E14: 'B14', B112: 'B12', YG08: 'YG00' }],
      ['a neighbour’s name on a short read', { BG114: 'BG11 Moon White' }],
    ]) {
      s.reset('Ohuhu', false);
      const m = s.sweep(`return T.caps('Honolulu 120', ${/name/.test(why)}, ${JSON.stringify(mis)});`);
      assert.deepEqual(m.wrong, [], why + ': ' + m.wrong.join(','));
      assert.equal(m.at, 0, why + ': switched at ' + m.at);
      assert.ok(m.q <= 5, why + ': ' + m.q);
    }
    // the misread cap's card says what it could be; typed, there's no cap to hold still
    s.reset('Ohuhu', false);
    s.read('BG11', false);
    assert.equal(s.last().big, 'BG11: Copic’s, or Ohuhu BG114 read short?');
    assert.equal(s.last().small, 'Hold the cap still');
    assert.deepEqual(s.last().labels, ['Add Copic BG11']);
    assert.deepEqual(s.asks(), []);
    // (v318.22 review H) typed, it goes in the list as a question instead: nothing was misread and there's no cap to
    // hold still, and the next code typed used to replace the card and lose it
    s.reset('Ohuhu', false);
    s.read('B00', true);
    assert.equal(s.last().big, 'B00: Copic’s, or an Ohuhu code misread (B06, B08)?');
    assert.equal(s.last().small, 'Choose in the list below');
    assert.deepEqual(s.last().labels, []);
    assert.deepEqual(s.asks(), ['B00: Copic’s, or an Ohuhu code misread (B06, B08)? [Copic B00/chosen]']);
    // the same cap held in view, read again and again, is one; and a plain word of the name is no name
    s.reset('Ohuhu', false);
    const m = s.sweep(
      `const R = T.caps('Honolulu 120', true); R.splice(20, 0, { t: 'E71 Champagne', k: 'Copic|E71', again: true }); return R;`,
    );
    assert.deepEqual([m.wrong, m.at], [[], 0]);
    assert.equal(s.sw().whole, 1);
    s.reset('Ohuhu', false);
    const p = s.sweep(
      `return T.caps('Honolulu 320 (complete set)', true, { B411: 'B41 Rich Slate Blue', YG012: 'YG01 Yellow Green' });`,
    );
    assert.deepEqual([p.wrong, p.at], [[], 0]);
  });
  test('the first cap read whole as Copic’s is a question in the list, said as set for you; at the switch it goes in, codes both brands use taken since the last Ohuhu-only code are asked, and the card says so', () => {
    const s = studio();
    s.reset('Ohuhu', false);
    s.read('B04', false); // both brands have it: Ohuhu's, for now
    s.read('B015', false); // Ohuhu's alone
    s.read('YR07', false); // both brands': since the last Ohuhu-only code
    s.read('E71 Champagne', false);
    assert.deepEqual(s.asks(), ['Copic E71 Champagne: add it? Ohuhu was set for you [Copic E71/chosen]']);
    assert.equal(s.last().big, 'Copic E71 Champagne: add it? Ohuhu was set for you');
    assert.equal(s.sw().on, false);
    s.read('BG11 Moon White', false);
    assert.deepEqual([s.sw().on, s.sw().brand], [true, '']);
    assert.deepEqual(
      s.list().sort(),
      ['Copic|BG11', 'Copic|E71', 'Ohuhu|B015', 'Ohuhu|B04'],
      s.list().join(' '),
    );
    assert.deepEqual(s.asks(), ['YR07: Ohuhu or Copic? [Ohuhu YR07/chosen|Copic YR07/chosen]']);
    assert.equal(s.last().big, 'Reading both brands: Copic caps were read');
    assert.equal(
      s.last().small,
      'Codes both brands use are asked from now on · Keep Ohuhu is at the top of the list',
    );
    assert.equal(s.sw().row, true);
    // from now on a code both brands use is asked, and a Copic-only code goes in
    s.read('Y06', false);
    assert.ok(
      s.asks().some((t) => /^Y06: /.test(t)),
      s.asks().join(' | '),
    );
    s.read('C-3', false);
    assert.ok(s.list().includes('Copic|C3'));
    // Keep Ohuhu: the brand back, the held questions answered as Ohuhu's, the Copic markers taken since asked about
    s.a.__eval('scanSwitchOff()');
    assert.deepEqual([s.sw().on, s.sw().off, s.sw().brand, s.sw().row], [false, true, 'Ohuhu', false]);
    assert.ok(s.list().includes('Ohuhu|YR07') && s.list().includes('Ohuhu|Y06'), s.list().join(' '));
    assert.ok(!s.list().some((k) => /^Copic/.test(k)), s.list().join(' '));
    assert.deepEqual(s.asks().sort(), [
      'Copic BG11 Moon White: add it? Ohuhu was set for you [Copic BG11/name]',
      'Copic C-3 Cool Gray No.3: add it? Ohuhu was set for you [Copic C-3/chosen]',
      'Copic E71 Champagne: add it? Ohuhu was set for you [Copic E71/chosen]',
    ]);
    assert.equal(s.last().big, 'Ohuhu again');
    assert.equal(s.last().small, 'Copic codes read since are asked below');
    // switched again only after two more distinct Copic reads
    s.read('E71 Champagne', false);
    assert.equal(s.sw().on, false);
    s.read('B000', false);
    assert.equal(s.sw().on, true);
    assert.equal(s.sw().row, true);
    // (the whole reads' questions went in again; the questions about codes both brands use came back)
    assert.ok(s.list().includes('Copic|E71') && s.list().includes('Copic|BG11'), s.list().join(' '));
    assert.ok(
      s.asks().some((t) => /^YR07: /.test(t)),
      s.asks().join(' | '),
    );
  });
  test('a noisy read that makes the switch stays a card; two misreads first switch too, and Keep Ohuhu puts it right; three other-brand codes in a row switch mid-sweep', () => {
    const s = studio();
    // the first two reads of the visit misreads: switched (no Ohuhu-only code yet), nothing wrong in the list
    s.reset('Ohuhu', false);
    const m = s.sweep(
      `const M = { BG114: 'BG11', B08: 'B00' }; const R = T.caps('Honolulu 120', false, M); const first = R.filter((r) => !r.k); return first.concat(R.filter((r) => r.k));`,
    );
    assert.equal(m.at, 2);
    assert.deepEqual(m.wrong, []);
    assert.ok(
      !s.list().includes('Copic|B00') && !s.list().includes('Copic|BG11'),
      'the noisy reads stayed cards: ' +
        s
          .list()
          .filter((k) => /Copic/.test(k))
          .join(' '),
    );
    // the same with Keep Ohuhu tapped at the switch: five questions, nothing wrong, no switch again
    s.reset('Ohuhu', false);
    const k = s.sweep(
      `const M = { BG114: 'BG11', B08: 'B00' }; const R = T.caps('Honolulu 120', false, M); const first = R.filter((r) => !r.k); return first.concat(R.filter((r) => r.k));`,
      0,
    );
    assert.deepEqual([k.wrong, k.on], [[], false]);
    assert.ok(k.q <= 6, k.q + ' questions');
    // three misreads in a row after twenty right: the sequence rule switches; Keep Ohuhu takes it back
    s.reset('Ohuhu', false);
    const t = s.sweep(
      `const M = { BG114: 'BG11', B08: 'B00', G49: 'G40' }; const R = T.caps('Honolulu 120', false, M); const mis = R.filter((r) => !r.k), rest = R.filter((r) => r.k); return rest.slice(0, 20).concat(mis, rest.slice(20));`,
    );
    assert.deepEqual([t.at, t.wrong], [23, []]);
    s.reset('Ohuhu', false);
    const u = s.sweep(
      `const M = { BG114: 'BG11', B08: 'B00', G49: 'G40' }; const R = T.caps('Honolulu 120', false, M); const mis = R.filter((r) => !r.k), rest = R.filter((r) => r.k); return rest.slice(0, 20).concat(mis, rest.slice(20));`,
      0,
    );
    assert.deepEqual([u.wrong, u.on], [[], false]);
    assert.ok(u.q <= 6, u.q + ' questions');
    // an Ohuhu tray then a Copic one: switched at the third Copic cap, nothing wrong, the Ohuhu tray's shared codes not asked
    s.reset('Ohuhu', false);
    const v = s.sweep(`return T.caps('Honolulu 120').concat(T.caps('Ciao 36 - Set A'));`);
    assert.deepEqual(v.wrong, []);
    assert.ok(v.at > 120 && v.at <= 125, 'switched at ' + v.at);
    assert.ok(v.q <= 20, v.q + ' questions');
  });
  test('a brand word read with the code, and a code typed with Enter, count as read whole; a photo plainly of Copic caps switches; Clear list and a brand tapped end the switch', () => {
    const s = studio();
    s.reset('Ohuhu', false);
    s.read('COPIC E71', false);
    s.read('COPIC BG11', false);
    assert.equal(s.sw().at, undefined);
    assert.equal(s.sw().on, true);
    assert.deepEqual(s.list().sort(), ['Copic|BG11', 'Copic|E71']);
    s.reset('Ohuhu', false);
    s.read('E71 Champagne', true);
    s.read('BG11 Moon White', true);
    assert.equal(s.sw().on, true);
    // a photo plainly of Copic caps (its end): switched, said on the photo's line and Done's card
    s.reset('Ohuhu', false);
    const o = s.ev(`
    scanList = []; ocrAnswered = []; ocrPhotos = 0;
    const C = T.set('Ciao 36 - Set A').filter((c) => !COLORS.some((x) => x.brand === 'Ohuhu' && scanKey(x.code) === scanKey(c.code))).slice(0, 10);
    const lines = C.map((c, k) => ({ id: k + 1, text: c.code, conf: 0.95, box: [100 + 120 * (k % 8), 100 + 120 * Math.floor(k / 8), 60, 20, 0], unsure: false }));
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1200, h: 900 } };
    ocrRun = r; ocrPhotos = 1;
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    ocrRun = r; ocrFinish();
    return { brand: r.brand, switched: !!r.switched, on: scanSw.on, sb: scanBrand, list: T.list().length, card: T.last() };`);
    assert.deepEqual([o.brand, o.switched, o.on, o.sb, o.list], ['Copic', true, true, '', 10]);
    assert.match(
      o.card.small,
      /Read as Copic: these look like Copic caps, so both brands are read from now on/,
    );
    // Clear list: the brand set for you is back; a brand tapped ends it for good
    s.a.__eval('scanSwitchEnd(true)');
    assert.deepEqual([s.sw().on, s.sw().brand, s.sw().row], [false, 'Ohuhu', false]);
    s.read('COPIC E71', false);
    s.read('COPIC BG11', false);
    assert.equal(s.sw().on, true);
    s.a.__eval('scanSwitchEnd(false); scanBrand = "Copic"; scanBrandChosen = true;');
    assert.deepEqual([s.sw().on, s.sw().row], [false, false]);
    s.read('E71 Champagne', false);
    assert.equal(s.sw().other, 0, 'nothing counted once a brand is tapped');
  });
  /* ---- v318.7 debug ---- */

  test('a code both brands use read in the box after a list of that brand was pasted is that list’s marker read again, "Already in the list", not asked; not after the other brand’s list, nor when the caps just read were the other brand’s', () => {
    const s = studio();
    // a Copic list pasted under Either, then its caps swept: BG23 (Copic’s alone), then YR07 (both brands have it)
    // (v318.7 as built: the list’s markers were never marked as pasted, so "YR07: Ohuhu or Copic?" was asked)
    s.reset('', true);
    s.read(s.ev(CIAO + '.join("\\n");'), true);
    assert.equal(s.list().length, 36);
    s.read('BG23', false);
    s.read('YR07', false);
    assert.deepEqual(s.asks(), [], 'not asked: Copic YR07 is in the list from the paste');
    assert.deepEqual(
      [s.last().k, s.last().big, s.last().small],
      ['same', 'YR07 Cadmium Orange', 'Already in the list · Copic'],
    );
    assert.equal(s.list().length, 36, 'nothing added');
    // the same list typed on one line (without 100, a number beside other codes, asked about): a list too
    s.reset('', true);
    s.read(s.ev(CIAO + '.filter((c) => c !== "100").join(" ");'), true);
    assert.equal(s.list().length, 35);
    s.read('BG23', false);
    s.read('YR07', false);
    assert.deepEqual(s.asks(), []);
    assert.equal(s.list().length, 35);
    // an Ohuhu cap read just before: the Ohuhu marker of the code isn’t in the list, so asked as before
    s.reset('', true);
    s.read(s.ev(CIAO + '.join("\\n");'), true);
    s.read('R014', false);
    s.read('YR07', false);
    assert.deepEqual(s.asks(), ['YR07: Ohuhu or Copic? [Ohuhu YR07/chosen|Copic YR07/chosen]']);
    // the code read in the box before (not pasted): asked, as v303 has it
    s.reset('', true);
    s.read('E71', false);
    s.read('Copic YR07', true);
    s.read('YR07', false);
    assert.deepEqual(s.asks(), ['YR07: Ohuhu or Copic? [Ohuhu YR07/chosen|Copic YR07/chosen]']);
  });
  test('the noisy card with Copic set for you says "a Copic code", not "an Copic code"', () => {
    const s = studio();
    assert.equal(
      s.ev(`return scanNotWholeWhy(scanNotWhole('B08', 'Copic'), 'Copic');`),
      'a Copic code misread (E08, R08)',
    );
    assert.equal(
      s.ev(`return scanNotWholeWhy(scanNotWhole('E71', 'Ohuhu'), 'Ohuhu');`),
      'an Ohuhu code read short (E713, E711)',
    );
    s.reset('Copic', false);
    s.read('B08', true);
    assert.equal(s.last().big, 'B08: Ohuhu’s, or a Copic code misread (E08, R08)?');
    // (v318.22 review H: typed, the choice is in the list, so the card carries no Add of its own)
    assert.deepEqual(s.last().labels, []);
    assert.deepEqual(s.asks(), ['B08: Ohuhu’s, or a Copic code misread (E08, R08)? [Ohuhu B08/chosen]']);
    // quiet, as a cap held in the box: the card with its Add, nothing in the list
    s.reset('Copic', false);
    s.read('B08', false);
    assert.deepEqual(s.last().labels, ['Add Ohuhu B08']);
    assert.deepEqual(s.asks(), []);
  });
  test('(v318.22) a typed other-brand code that could be a misread is kept: the next code typed doesn’t lose it', () => {
    const s = studio();
    s.reset('Ohuhu', false);
    // RV10 is a Copic marker, and near Ohuhu's RV18/RV19, so it used to be a card only and the next code replaced it
    s.read('RV10', true);
    assert.deepEqual(s.asks(), ['RV10: Copic’s, or an Ohuhu code misread (RV18, RV19)? [Copic RV10/chosen]']);
    // (what Add looks at: a question raised by the box is shown before anything is added, 70-dialog.js scanAdd)
    assert.equal(s.ev('return scanAsks();'), 1);
    s.read('Y06', true);
    assert.deepEqual(s.list(), ['Ohuhu|Y06']);
    assert.deepEqual(s.asks(), ['RV10: Copic’s, or an Ohuhu code misread (RV18, RV19)? [Copic RV10/chosen]']);
    // the same code typed again: said, not asked twice, and no Add of its own on the card
    s.read('RV10', true);
    assert.equal(s.last().small, 'Waiting in the list below');
    assert.deepEqual(s.last().labels, []);
    assert.equal(s.asks().length, 1);
    // two of them, then the switch to both brands at the second: both kept, and a Copic cap goes in from then on
    s.reset('Ohuhu', false);
    s.read('RV10', true);
    s.read('RV11', true);
    assert.equal(s.sw().on, true);
    assert.equal(s.asks().length, 2);
    s.read('E71 Champagne', true);
    assert.deepEqual(s.list(), ['Copic|E71']);
  });
  test('a photo not plainly one brand’s, with Ohuhu set for you: another brand’s cap is asked about as Scan’s own reads say it, "set for you", not "chosen"', () => {
    const a = createApp({ localStorage: memoryStorage() });
    const photo = (chosen) =>
      JSON.parse(
        a.__eval(`(function () {
    scanList = []; ocrAnswered = []; scanBrand = 'Ohuhu'; scanBrandChosen = ${chosen}; scanAutoB = ${chosen ? "''" : "'Ohuhu'"}; scanSw = scanSwNew(); ocrPhotos = 0;
    const H = presetMkeys(MARKER_SETS[3]).map((k) => COLORS[keyIdx(k)]).slice(0, 3);
    const lines = []; let id = 1;
    H.forEach((c, k) => lines.push({ id: id++, text: c.code, conf: 0.95, box: [100 + 120 * k, 100, 60, 20, 0], unsure: false }));
    ['E71 Champagne', 'BG11 Moon White'].forEach((t, k) => lines.push({ id: id++, text: t, conf: 0.95, box: [100 + 120 * k, 600, 60, 20, 0], unsure: false }));
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1200, h: 900 } };
    ocrRun = r; ocrPhotos = 1;
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    return JSON.stringify({ seen: r.brand, list: scanList.filter((e) => !e.ask).length, asks: scanList.filter((e) => e.ask).map((e) => e.title).sort() });
  })()`),
      );
    // (v318.7 as built: "Another brand than the one chosen (Ohuhu): add it?", though nothing was chosen)
    assert.deepEqual(photo(false), {
      seen: '',
      list: 3,
      asks: [
        'Copic BG11 Moon White: add it? Ohuhu was set for you',
        'Copic E71 Champagne: add it? Ohuhu was set for you',
      ],
    });
    // Ohuhu tapped: as before
    assert.deepEqual(photo(true).asks, [
      'Another brand than the one chosen (Ohuhu): add it?',
      'Another brand than the one chosen (Ohuhu): add it?',
    ]);
  });
  test('a long paste under the switch to both brands is read in no more than 1.3 times Either’s time: its words are worked out once, not again for each marker; the names still make the markers whole', () => {
    const s = studio();
    const text = s.ev(
      `let t = ''; const cs = COLORS.map((c) => c.code + ' ' + c.name); while (t.length < 122000) t += cs.join('\\n') + '\\n'; return t;`,
    );
    s.reset('', true);
    const t0 = cpuMs();
    s.read(text, true);
    const either = cpuMs() - t0;
    // (v318.7 as built: 2.4 times, the whole text searched for each Copic marker's name, scanWholeOther)
    s.reset('Ohuhu', false);
    s.read('E71 Champagne', false);
    s.read('BG11 Moon White', false);
    assert.equal(s.sw().on, true);
    const t1 = cpuMs();
    s.read(text, true);
    const sw = cpuMs() - t1;
    assert.ok(
      sw <= 1.3 * either + 150,
      'Either ' + either.toFixed(0) + ' ms, under the switch ' + sw.toFixed(0) + ' ms',
    );
    // the paste's Copic markers are read whole by their names, as the text searched for each would have them (Keep Ohuhu
    // asks about them so; a switch again puts them in); a name of plain words alone, Light Blue, makes none whole, as before
    const whole = s.ev(
      `const t = ${JSON.stringify(text)}; return scanList.filter((e) => !e.ask && COLORS[e.i].brand === 'Copic').map((e) => [COLORS[e.i].code, !!e.whole, !!scanWholeOther(e.i, t, 'Ohuhu')]);`,
    );
    assert.ok(whole.length > 300);
    assert.deepEqual(
      whole.filter((w) => w[1] !== w[2]),
      [],
      'read whole as the text searched would have it',
    );
    assert.ok(
      whole.filter((w) => w[1]).length > 300 && whole.some((w) => !w[1]),
      'most whole by their names, some not',
    );
    // codes alone: a code that could be an Ohuhu code read wrong isn't whole, one that couldn't is
    s.reset('Ohuhu', false);
    s.read('E71 Champagne', false);
    s.read('BG11 Moon White', false);
    s.read(['B18', 'B26', 'B37', 'B41'].join('\n'), true);
    assert.deepEqual(
      s.ev(
        `return scanList.filter((e) => !e.ask && COLORS[e.i].brand === 'Copic').map((e) => COLORS[e.i].code + ':' + !!e.whole).sort();`,
      ),
      ['B18:true', 'B26:false', 'B37:true', 'B41:false', 'BG11:true', 'E71:true'],
    );
  });
}

// ---- from v3187-gaps.test.mjs ----
// v318.7 Scan, section 10: which markers of a set weren't read. Of the sets with a marker in this session's list, leaving
// out those complete and any set nine-tenths in a complete set, the largest with nine-tenths of it here (listed or
// yours) is named with what's missing when that's 12 or fewer; a brand's blender is never missing; a question waiting's
// answers are neither here nor missing. "I don't have them" is remembered per set; one card per set per visit. Each test
// fails on v318.6 (scanSetGaps and scanGapChoices don't exist there).
{
  function studio(init) {
    const a = createApp({ localStorage: memoryStorage(init || {}) });
    a.__eval(`
    var T = {};
    T.set = (n) => presetMkeys(MARKER_SETS.find((p) => p.n === n));
    T.drop = (keys, every) => keys.filter((k, i) => i % every !== 0);
    T.reset = function () { scanFind = null; scanList = []; state.owned = new Set(); scanGapsSaid.clear(); T.cards = []; };
    T.list = (keys) => { scanList = keys.map((k) => ({ i: keyIdx(k), how: '' })).concat(scanList.filter((e) => e.ask)); };
    T.ask = (keys) => { scanList.unshift({ ask: 'brands ' + keys[0].split('|')[1], title: '?', at: 1, opts: keys.map((k) => ({ i: keyIdx(k), how: 'chosen' })) }); };
    T.own = (keys) => keys.forEach((k) => state.owned.add(k));
    T.gaps = function () { const g = scanSetGaps(); return g ? g.p.n + ': all but ' + g.miss.length + ' [' + g.miss.map((m) => m.code).join(' ') + ']' + (g.waiting ? ' · ' + g.waiting + ' waiting' : '') : null; };
    scanSay = function (k, a, b, i, ch) { T.cards.push({ k: k, big: String(a), small: String(b || ''), choices: ch || null }); };
    scanBeep = function () {};
    scanRender = function () {};
  `);
    return a;
  }
  test('an owner of a complete Ohuhu set photographs a Copic tray missing a few: that set, not the Ohuhu one; an Ohuhu tray of a smaller set the same', () => {
    const a = studio();
    for (const own of ['Honolulu 120', 'Honolulu 320 (complete set)']) {
      a.__eval(`T.reset(); T.own(T.set('${own}')); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));`);
      assert.equal(a.__eval('T.gaps()'), 'Ciao 36 - Set A: all but 3 [100 E21 V04]', own);
      a.__eval(`T.reset(); T.own(T.set('${own}')); T.list(T.drop(T.set('Sketch 36'), 12));`);
      assert.equal(a.__eval('T.gaps()'), 'Sketch 36: all but 3 [100 C-9 V09]', own);
    }
    // an owner of Honolulu 120 reads a Skin Tones tray missing 4: its blender among them (never missing), and E511 is
    // in the 120 (yours): all but 2
    a.__eval("T.reset(); T.own(T.set('Honolulu 120')); T.list(T.drop(T.set('36 Skin Tones'), 12));");
    assert.equal(a.__eval('T.gaps()'), '36 Skin Tones: all but 2 [YR47 E75]');
  });
  test('the largest set with nine-tenths here; missing more than 12, nothing (no smaller set instead); complete, nothing; a set nine-tenths in a complete set, nothing', () => {
    const a = studio();
    // a fresh user, Honolulu 216 read missing 20: nothing (not "48 Mid-tone Set: all but 2" for 46 of its 49 in 216)
    a.__eval("T.reset(); T.list(T.drop(T.set('Honolulu 216'), 11));");
    assert.equal(a.__eval('T.gaps()'), null);
    // missing 12 or 8: the 216
    a.__eval("T.reset(); T.list(T.drop(T.set('Honolulu 216'), 18));");
    assert.match(a.__eval('T.gaps()'), /^Honolulu 216: all but 12 \[/);
    a.__eval("T.reset(); T.list(T.drop(T.set('Honolulu 216'), 27));");
    assert.match(a.__eval('T.gaps()'), /^Honolulu 216: all but 8 \[/);
    // complete: nothing, and nothing for the sets inside it (an owner of the 216 reads 30 of it again, or all of it)
    a.__eval("T.reset(); T.own(T.set('Honolulu 216')); T.list(T.set('Honolulu 216').slice(0, 30));");
    assert.equal(a.__eval('T.gaps()'), null);
    a.__eval("T.reset(); T.list(T.set('Honolulu 216'));");
    assert.equal(a.__eval('T.gaps()'), null);
    // an owner of the 320 reads 30 of it: nothing (not "48 Pastel Blossoming: all but 1" nor "36 Gray Tones: all but 2")
    a.__eval(
      "T.reset(); T.own(T.set('Honolulu 320 (complete set)')); T.list(T.set('Honolulu 320 (complete set)').slice(0, 30));",
    );
    assert.equal(a.__eval('T.gaps()'), null);
    // an owner of the 216 reads 44 of the Mid-tone set (the 3 outside the 216 not read): nothing, it's in a complete set
    a.__eval(
      "T.reset(); T.own(T.set('Honolulu 216')); T.list(T.set('48 Mid-tone Set').filter((k) => T.set('Honolulu 216').indexOf(k) >= 0));",
    );
    assert.equal(a.__eval('T.gaps()'), null);
    // nothing of the set in this session's list: not named, whatever the collection holds
    a.__eval(
      "T.reset(); T.own(T.drop(T.set('Honolulu 120'), 60)); T.list(T.set('Ciao 36 - Set A').slice(0, 3));",
    );
    assert.equal(a.__eval('T.gaps()'), null);
    // an empty list: nothing
    a.__eval('T.reset();');
    assert.equal(a.__eval('T.gaps()'), null);
    // All Copic markers never (nearly every Copic marker listed: a real set nearly complete is named, not that one)
    a.__eval("T.reset(); T.list(T.drop(T.set('All Copic markers'), 100));");
    assert.doesNotMatch(a.__eval('T.gaps()'), /All Copic/);
  });
  test('a brand’s blender is never missing; a question waiting’s answers are neither here nor missing', () => {
    const a = studio();
    // Ciao 72 Set A read missing 6, its blender (Copic 0) among them: "all but 5"
    a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 72 - Set A'), 12));");
    assert.ok(
      a.__eval("T.set('Ciao 72 - Set A').indexOf('Copic|0') % 12 === 0"),
      'the blender among the dropped',
    );
    assert.equal(a.__eval('scanSetGaps().miss.length'), 5);
    assert.ok(!a.__eval("scanSetGaps().miss.some((m) => m.code === '0')"));
    // Honolulu 120 all but its blender: complete
    a.__eval("T.reset(); T.list(T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0'));");
    assert.equal(a.__eval('T.gaps()'), null);
    // Honolulu 120 all but 4, 3 of them waiting as questions: all but 1, and the 3 waiting
    a.__eval(
      "T.reset(); var H = T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0'); T.list(H.slice(4)); H.slice(0, 3).forEach((k) => T.ask([k, 'Copic|B04']));",
    );
    assert.equal(
      a.__eval('T.gaps()'),
      'Honolulu 120: all but 1 [' +
        a.__eval("COLORS[keyIdx(T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0')[3])].code") +
        '] · 3 waiting',
    );
    // all of it listed or waiting: complete, nothing
    a.__eval(
      "T.reset(); var H = T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0'); T.list(H.slice(3)); H.slice(0, 3).forEach((k) => T.ask([k, 'Copic|B04']));",
    );
    assert.equal(a.__eval('T.gaps()'), null);
  });
  test('the card’s choices: Add these N puts them in the list; I don’t have them is remembered for the set; one card per set per visit', () => {
    const a = studio();
    a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));");
    const ch = JSON.parse(a.__eval('JSON.stringify(scanGapChoices().map((c) => c.head || c.label))'));
    assert.deepEqual(ch, [
      'Ciao 36 - Set A: all but 3 are here — 100, E21 and V04. Not read, or not yours?',
      'Add these 3',
      'I don’t have them',
    ]);
    // said once this visit
    assert.equal(a.__eval('scanGapChoices()'), null);
    a.__eval('scanGapsSaid.clear()');
    // Add these 3: in the list, to check before Add; the card says so
    a.__eval('scanGapChoices()[1].go()');
    assert.equal(a.__eval('scanList.filter((e) => !e.ask).length'), 36);
    assert.equal(a.__eval('T.cards[T.cards.length - 1].big'), '3 added to the list');
    assert.equal(
      a.__eval('T.cards[T.cards.length - 1].small'),
      'Ciao 36 - Set A · Check them below, then Add',
    );
    assert.equal(a.__eval('state.owned.size'), 0, 'nothing in the collection by itself');
    // I don't have them: remembered under an ms- key; not named again, the next set (if any) is
    a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));");
    a.__eval('scanGapChoices()[2].go()');
    assert.equal(a.__eval("localStorage.getItem('ms-scan-nothave')"), '["Copic|Ciao 36 - Set A"]');
    assert.equal(a.__eval('T.cards[T.cards.length - 1].big'), 'Not yours, then');
    a.__eval('scanGapsSaid.clear()');
    assert.equal(a.__eval('T.gaps()'), null);
    // one missing: "all but 1 is here — B24", "Add it", "I don't have it"; waiting questions said
    a.__eval(
      "T.reset(); localStorage.removeItem('ms-scan-nothave'); var C = T.set('Ciao 36 - Set A'); T.list(C.slice(2)); T.ask([C[0], 'Ohuhu|B04']);",
    );
    const one = JSON.parse(a.__eval('JSON.stringify(scanGapChoices().map((c) => c.head || c.label))'));
    assert.deepEqual(one, [
      'Ciao 36 - Set A: all but 1 is here — ' +
        a.__eval('COLORS[keyIdx(C[1])].code') +
        ', and 1 waiting as a question below. Not read, or not yours?',
      'Add it',
      'I don’t have it',
    ]);
    // the words for Add's toast
    a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));");
    assert.equal(a.__eval('scanGapCodes(scanSetGaps())'), '100, E21 and V04');
  });
}

// ---- from v3187-waiting.test.mjs ----
// v318.7 Scan, sections 8 and 9: each entry's photo is saved with the list and read back, the photos numbered 1.. in
// turn; a question every answer of which is in your collection is dropped, not counted among the questions waiting;
// and Add markers' line on them. Each test fails on v318.6 (scanParseList, scanDropOwned, scanWaiting and
// scanWaitHTML don't exist there; the list was saved without photos).
{
  function studio(init) {
    const a = createApp({ localStorage: memoryStorage(init || {}) });
    a.__eval(`
    var T = {};
    T.ix = (b, c) => COLORS.findIndex((x) => x.brand === b && x.code === c);
    T.m = (b, c, photo) => Object.assign({ i: T.ix(b, c), how: '' }, photo ? { photo: photo } : {});
    T.q = (code, photo) => Object.assign({ ask: 'brands ' + code, title: code + ': Ohuhu or Copic?', at: 1,
      opts: [{ i: T.ix('Ohuhu', code), how: 'chosen' }, { i: T.ix('Copic', code), how: 'chosen' }] }, photo ? { photo: photo } : {});
    T.rows = (l) => (l || scanList).map((e) => (e.ask ? '?' + e.ask.slice(7) : COLORS[e.i].brand[0] + COLORS[e.i].code) + (e.photo ? '@' + e.photo : ''));
  `);
    return a;
  }
  const rows = (a, expr) => JSON.parse(a.__eval('JSON.stringify(T.rows(' + (expr || '') + '))'));
  test('the list saved carries each entry’s photo, and read back the photos are numbered 1.. in turn, the next photo after them', () => {
    const a = studio();
    a.__eval(
      'scanFind = null; scanList = [T.m("Ohuhu", "R014"), T.q("B04", 5), T.m("Ohuhu", "B03", 5), T.m("Ohuhu", "B08", 3), T.q("YR07")]; scanSaveList();',
    );
    const saved = JSON.parse(a.__eval('localStorage.getItem("ms-scan-list")'));
    assert.deepEqual(
      saved.map((e) => e.p || 0),
      [0, 5, 5, 3, 0],
      'p: the photo, with markers and questions alike',
    );
    assert.equal(saved[0].k, 'Ohuhu|R014');
    assert.deepEqual(rows(a, 'scanParseList(localStorage.getItem("ms-scan-list"))'), [
      'OR014',
      '?B04@2',
      'OB03@2',
      'OB08@1',
      '?YR07',
    ]);
    a.__eval('scanList = scanParseList(localStorage.getItem("ms-scan-list"))');
    assert.equal(a.__eval('scanPhotoMax()'), 2, 'the next photo read is 3');
    // nothing saved, or no photos: as before
    assert.deepEqual(rows(a, 'scanParseList(null)'), []);
    assert.deepEqual(rows(a, 'scanParseList("[{\\"k\\":\\"Ohuhu|R014\\",\\"how\\":\\"\\"}]")'), ['OR014']);
    // a photo number that isn't one (another version's saving): no photo
    assert.deepEqual(
      rows(a, 'scanParseList("[{\\"k\\":\\"Ohuhu|R014\\",\\"how\\":\\"\\",\\"p\\":\\"x\\"}]")'),
      ['OR014'],
    );
    // the page starting with a list of photos saved: the reader numbers on from them
    const b = studio({ 'ms-scan-list': a.__eval('localStorage.getItem("ms-scan-list")') });
    assert.deepEqual(rows(b), ['OR014', '?B04@2', 'OB03@2', 'OB08@1', '?YR07']);
    assert.equal(b.__eval('ocrPhotos'), 2);
  });
  test('a question every answer of which is in your collection is dropped; one with an answer not yours, or none, stays', () => {
    const a = studio();
    a.__eval(
      'scanFind = null; state.owned = new Set(["Ohuhu|B04", "Copic|B04", "Ohuhu|YR07"]); scanList = [T.q("B04", 1), T.m("Ohuhu", "B03", 1), T.q("YR07"), { ask: "odd", title: "?", opts: [], at: 1 }];',
    );
    assert.equal(a.__eval('scanDropOwned()'), true);
    assert.deepEqual(rows(a), ['OB03@1', '?YR07', '?']);
    assert.equal(a.__eval('scanDropOwned()'), false, 'nothing more to drop');
    assert.equal(JSON.parse(a.__eval('localStorage.getItem("ms-scan-list")')).length, 3, 'saved without it');
    // counted for Add markers' line: the questions left, after the drop; none in Find mode
    a.__eval('state.owned.add("Copic|YR07")');
    assert.equal(a.__eval('scanWaiting()'), 1);
    assert.deepEqual(rows(a), ['OB03@1', '?']);
    assert.match(
      a.__eval('scanWaitHTML("mka")'),
      /^<div class="mkwait" id="mkaWait"><span>1 question still to answer<\/span><button [^>]*data-add="questions" id="mkaQuestions">Answer them<\/button><\/div>$/,
    );
    a.__eval('scanList.push(T.q("B05"))');
    assert.match(a.__eval('scanWaitHTML("mka")'), /2 questions still to answer/);
    a.__eval('scanFind = { brand: "Ohuhu" }');
    assert.equal(a.__eval('scanWaiting()'), 0);
    assert.equal(a.__eval('scanWaitHTML("mka")'), '<div class="mkwait" id="mkaWait" hidden></div>');
    a.__eval('scanFind = null; scanList = []');
    assert.equal(a.__eval('scanWaitHTML("mkc")'), '<div class="mkwait" id="mkcWait" hidden></div>');
  });
}
