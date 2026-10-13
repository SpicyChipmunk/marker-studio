// v317: a pasted list (text copied from a photo of a tray with Google Lens or Live Text): a line with only a name that
// a code in the same paste accounts for is no question; a name on its own line settles a code both brands use; lines
// of plain words beside codes aren't counted as not read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './harness.mjs';

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
