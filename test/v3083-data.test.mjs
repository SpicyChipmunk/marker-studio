// v308.3 (data): Scan reads Copic's eight fluorescent cap codes (FB2, FY1…) as another brand's markers when Ohuhu is
// chosen, and no other old code of Copic's or Ohuhu's opens up; Markers' search names the colour families its words
// match (searchFams), for the fallback and the offer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const app = createApp({ localStorage: memoryStorage() }),
  E = app.__eval;
const C = E('COLORS');
const nm = (i) => C[i].brand + ' ' + C[i].code;
const read = (t, b) => {
  const r = app.scanRead(t, b);
  return JSON.parse(
    JSON.stringify({
      codes: r.codes.map((c) => c.opts.map(nm).sort().join('|')),
      byName: r.byName >= 0 ? nm(r.byName) : '',
      other: r.other.map(nm),
      unread: r.unread || 0,
    }),
  );
};
const CAP = {
  FB2: 'FB',
  FBG2: 'FBG',
  FYG2: 'FG',
  FRV1: 'FRV',
  FV2: 'FV',
  FY1: 'FY',
  FYG1: 'FYG',
  FYR1: 'FYR',
};

test('Scan, Ohuhu chosen: each Copic fluorescent cap code is that Copic marker, asked about as another brand’s', () => {
  // (the eight are what the data has: every Copic fluorescent with an old code)
  assert.deepEqual(
    [...C.filter((c) => c.brand === 'Copic' && c.old && c.old !== c.code).map((c) => c.old)].sort(),
    Object.keys(CAP).sort(),
  );
  for (const [cap, now] of Object.entries(CAP)) {
    const want = { codes: [], byName: '', other: ['Copic ' + now], unread: 0 };
    assert.deepEqual(read(cap, 'Ohuhu'), want, cap);
    assert.deepEqual(read(cap.toLowerCase(), 'Ohuhu'), want, cap + ' typed in small letters');
    // read in two pieces, as Scan Text can: "FY 1"
    assert.deepEqual(read(cap.replace(/(\d)$/, ' $1'), 'Ohuhu'), want, cap + ' in pieces');
    // with Copic chosen, or either, it's the marker, as before
    assert.deepEqual(read(cap, 'Copic').codes, ['Copic ' + now], cap + ' Copic');
    assert.deepEqual(read(cap, '').codes, ['Copic ' + now], cap + ' either');
  }
  // a pasted list: each line its question, none "not read"; the Ohuhu code beside them is added as before
  assert.deepEqual(read('FB2\nFY1\nB02', 'Ohuhu'), {
    codes: ['Ohuhu B02'],
    byName: '',
    other: ['Copic FB', 'Copic FY'],
    unread: 0,
  });
  // the cap's brand and colour name with it: still Copic's (the name had offered Ohuhu FY00 Fluorescent Yellow)
  assert.deepEqual(read('Copic FY1', 'Ohuhu').other, ['Copic FY']);
  assert.deepEqual(read('FY1 Fluorescent Yellow', 'Ohuhu'), {
    codes: [],
    byName: '',
    other: ['Copic FY'],
    unread: 0,
  });
});

test('Scan, Ohuhu chosen: FY1 is never Ohuhu’s FY01 (nor its old FY010 or FY020), and Ohuhu’s own fluorescents read as before', () => {
  assert.deepEqual(read('FY1', 'Ohuhu').codes, []);
  assert.deepEqual(read('FY01', 'Ohuhu').codes, ['Ohuhu FY01']);
  assert.deepEqual(read('FY010', 'Ohuhu').codes, ['Ohuhu FY00']);
  assert.deepEqual(read('FY020', 'Ohuhu').codes, ['Ohuhu FY01']);
  assert.deepEqual(read('FY1 FY00', 'Ohuhu'), {
    codes: ['Ohuhu FY00'],
    byName: '',
    other: ['Copic FY'],
    unread: 0,
  });
});

test('Scan: no other old code opens up for the other brand (OCR noise such as R4 or G6 stays as it was)', () => {
  // Ohuhu's short old codes with Copic chosen: nothing, not "another brand's"
  for (const t of ['R4', 'G6', 'FY010', 'B090', 'BG4'])
    assert.deepEqual(read(t, 'Copic'), { codes: [], byName: '', other: [], unread: 0 }, t);
  // and with Ohuhu chosen they are Ohuhu's own old codes, as before
  assert.deepEqual(read('R4', 'Ohuhu').codes, ['Ohuhu R412']);
  // another Copic code with Ohuhu chosen is still asked about as before
  assert.deepEqual(read('E000', 'Ohuhu').other, ['Copic E000']);
});

test('Markers’ search names the families every word of it is in: “skin”, “yellow grey”, “red”; not a list of codes, not outside Markers', () => {
  E(`state.mode = 'collection'; state.collView = 'all'; state.pool = null; poolSet = null; state.ink = {};`);
  const fams = (q) => {
    E(`searchStr = ${JSON.stringify(q)}`);
    return JSON.parse(
      E(
        'JSON.stringify(searchFams() && { names: searchFams().names, n: searchFams().list.length, names0: finderMatches().length })',
      ),
    );
  };
  assert.deepEqual(fams('skin'), { names: ['Earth / Skin / Brown'], n: 94, names0: 0 });
  assert.deepEqual(fams('earth skin'), { names: ['Earth / Skin / Brown'], n: 94, names0: 0 });
  // (grey and gray are one word, as search folds them; the one name with both words is Copic YG93 Grayish Yellow)
  assert.deepEqual(fams('yellow grey'), { names: ['Yellow Grey'], n: 6, names0: 1 });
  assert.deepEqual(fams('Gray Yellow'), { names: ['Yellow Grey'], n: 6, names0: 1 });
  // (v308.3, after the build: a search that is a family's whole name names that family only, not Red-Violet and
  // Yellow-Red / Orange too)
  assert.deepEqual(fams('red'), { names: ['Red'], n: 69, names0: 17 });
  assert.deepEqual(fams('neutral'), {
    names: ['Neutral Grey', 'Neutral / Black'],
    n: 16,
    names0: fams('neutral').names0,
  });
  assert.equal(fams('reds'), null, 'whole words only');
  assert.equal(fams('skin tone'), null, 'every word');
  assert.equal(fams('b02, b03'), null, 'a list of codes: the Scan hint');
  E(`state.mode = 'palette'`);
  assert.equal(fams('skin'), null, 'Markers only');
  E(`state.mode = 'collection'`);
  // the line: one family, three, and more than three named briefly
  E(`searchStr = 'skin'`);
  assert.equal(E('famPhrase(searchFams())'), 'the Earth / Skin / Brown family (94)');
  E(`searchStr = 'red'`);
  assert.equal(E('famPhrase(searchFams())'), 'the Red family (69)');
  E(`searchStr = 'neutral'`);
  assert.equal(E('famPhrase(searchFams())'), 'the Neutral Grey and Neutral / Black families (16)');
  E(`searchStr = 'grey'`);
  assert.match(E('famPhrase(searchFams())'), /^the Warm Grey, Yellow Grey and 5 other families \(87\)$/);
});
