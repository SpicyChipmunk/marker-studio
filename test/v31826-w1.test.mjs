// v318.26 (W1): the polish set's unit-testable parts (A1 a kept error without a when, A7 an older cap's name found
// with the setting as it is) and Send feedback's waits (D). Each fails on v318.25.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

test('A1 a kept error without a string when (an older version’s, or written by hand): Send feedback and Copy details don’t throw', () => {
  const a = createApp({
    localStorage: memoryStorage({
      'ms-errors': JSON.stringify([
        { msg: 'old style' },
        { msg: 'a number', when: 1700000000000, where: 7 },
        { msg: 'kept', when: '2026-10-01T09:30:00.000Z', where: 'Opening a guide' },
      ]),
    }),
  });
  const r = a.__eval('feedbackReport()');
  assert.match(r, /\nLast errors:\n- : old style\n- : a number\n- 2026-10-01 09:30 · Opening a guide: kept$/);
  const d = a.__eval('errDetails()');
  assert.ok(!/undefined|NaN/.test(d), d);
  assert.match(d, /\n2026-10-01T09:30:00\.000Z · Opening a guide\nkept/);
  // (a new error is still kept and listed after them)
  a.__eval(`errLog('Saving', new Error('fresh'))`);
  assert.match(a.__eval('feedbackReport()'), /· Saving: fresh$/);
});

{
  const a = createApp();
  const E = a.__eval;
  const found = (q) =>
    JSON.parse(
      E(
        `JSON.stringify(COLORS.flatMap((c, i) => sMatch(i, ${JSON.stringify(q)}) ? [c.brand + ' ' + c.code] : []))`,
      ),
    );
  const byCap = (q) =>
    JSON.parse(
      E(`JSON.stringify(COLORS.flatMap((c, i) => sByCap(i, ${JSON.stringify(q)}) ? [c.code] : []))`),
    );

  test('A7 Markers’ search: an older Ohuhu cap’s printed name finds its marker with the setting as it is (codes of now)', () => {
    assert.equal(E('state.capDef'), '');
    assert.ok(found('Rose Red').includes('Ohuhu R213'), 'R213 Pomegranate, whose older cap says R6 Rose Red');
    assert.ok(found('Rose Red').includes('Copic R85'), 'and Copic’s R85 Rose Red, by its own name');
    assert.ok(found('dark blush').includes('Ohuhu RV17'));
    // (while typing: once the query reaches the name's last word)
    assert.ok(found('dark b').includes('Ohuhu RV17'));
    assert.ok(!found('dark').includes('Ohuhu RV17'), 'not its first word alone');
    // (the start only: not a word inside the name, which had added 17 blues and 28 greys)
    assert.ok(!found('ose red').includes('Ohuhu R213'));
    assert.ok(!found('red').includes('Ohuhu R213'));
    // (and not a family's own words: "yellow grey" had found Yellow Grey 04, 08 and 100, "cool grey" 7 more)
    for (const q of [
      'blue',
      'gray',
      'light',
      'dark',
      'pale',
      'rose',
      'yellow grey',
      'cool grey',
      'warm gray',
    ])
      assert.deepEqual(byCap(q), [], q);
    // (its number begun, it's that cap's name: Yellow Grey 04 is E14's older cap)
    assert.ok(byCap('yellow grey 04').includes('E14'));
    assert.deepEqual(byCap('lemon yellow'), ['Y28']);
    // (found by the cap's name alone, for the cell's label; not when its own name or code is the match)
    assert.deepEqual(byCap('rose red'), ['R213']);
    assert.deepEqual(byCap('R213'), []);
    assert.deepEqual(byCap('pomegranate'), []);
  });

  test('A7 the cell found by an older cap’s name says that cap in its label and title', () => {
    E(`searchStr = 'rose red'; state.mode = 'collection'`);
    const i = +E(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'R213')`);
    const h = E(`cellHtml(${i})`);
    assert.match(h, /aria-label="Ohuhu R213 Pomegranate, older cap R6 Rose Red, not owned/);
    assert.match(h, /title="Ohuhu R213 · Pomegranate · old R6, older cap R6 Rose Red · tap/);
    const j = +E(`COLORS.findIndex((c) => c.brand === 'Copic' && c.code === 'R85')`);
    assert.ok(!/older cap/.test(E(`cellHtml(${j})`)), 'found by its own name: no tag');
    E(`searchStr = ''`);
  });
}

test('D Send feedback carries this visit’s longest waits, after the errors; none, nothing added', () => {
  const a = createApp();
  const E = a.__eval;
  assert.match(E('feedbackReport()'), /No errors recorded\.$/);
  assert.equal(E('feedbackWaitLines()'), '');
  E(`holdAdd('Sections', 1234.4, '2048×1536'); holdAdd('Build', 300)`);
  assert.equal(
    E('feedbackWaitLines()'),
    '\nLongest waits, this visit:\nSections 1234 ms (2048×1536)\nBuild 300 ms',
  );
  assert.match(
    E('feedbackReport("It froze")'),
    /^It froze\n\n[\s\S]*\nNo errors recorded\.\nLongest waits, this visit:\nSections 1234 ms \(2048×1536\)\nBuild 300 ms$/,
  );
});

test('D the form’s Message: the details kept whole, the words cut to fit 4000', () => {
  const a = createApp();
  const fit = a.__eval('feedbackFit');
  const det =
    '\n\nLast errors:\n' +
    'e'.repeat(800) +
    '\nScreen: 820×1180\nLongest waits, this visit:\n' +
    'w'.repeat(390);
  const m = fit('x'.repeat(3000), det, 4000);
  assert.equal(m.length, 4000);
  assert.ok(m.endsWith(det));
  assert.equal(fit('short', det, 4000), 'short' + det);
  assert.equal(fit('short', 'd'.repeat(4100), 4000), 'd'.repeat(4100), 'never a negative cut');
});
